from flask import send_file
import numpy as np
from scipy.sparse import csr_matrix, save_npz
import pandas as pd
import psycopg2
import os
import re
import tempfile
import subprocess
from psycopg2.extras import RealDictCursor
from psycopg2 import sql
import pyarrow.parquet as pq
import pyarrow.csv as pv
from scipy.spatial.distance import squareform
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")


"""
Establish a connection to the database.
"""
def get_db_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USERNAME,
        password=DB_PASSWORD,
        cursor_factory=RealDictCursor,
    )
    return conn


"""
Return the list of genes
"""
def gene_names_list():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT symbol
        FROM gene
        WHERE chromosome = '12' OR chromosome = '17'
    """
    )
    rows = cur.fetchall()
    options = [{"value": row["symbol"], "label": row["symbol"]} for row in rows]
    conn.close()
    return options


"""
Return the gene name list in searching specific letters
"""
def gene_names_list_search(search):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT symbol
        FROM gene
        WHERE symbol ILIKE %s
    """,
        (f"%{search}%",),
    )
    rows = cur.fetchall()
    options = [{"value": row["symbol"], "label": row["symbol"]} for row in rows]
    conn.close()
    return options


"""
Returns the list of cell line
"""
def cell_lines_list():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT cell_line
        FROM sequence
    """
    )
    rows = cur.fetchall()

    label_mapping = {
        "IMR": "Lung(IMR90)",
        "K": "Blood Leukemia(K562)",
        "GM": "Lymphoblastoid Cell Line(GM12878)",
    }
    options = [
        {
            "value": row["cell_line"],
            "label": label_mapping.get(row["cell_line"], "Unknown"),
        }
        for row in rows
    ]

    conn.close()
    return options


"""
Returns the list of chromosomes in the cell line
"""
def chromosomes_list(cell_line):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT DISTINCT chrid
        FROM sequence
        WHERE cell_line = %s
    """,
        (cell_line,),
    )

    chromosomes = [row["chrid"] for row in cur.fetchall()]

    def sort_key(chromosome):
        match = re.match(r"chr(\d+|\D+)", chromosome)
        if match:
            value = match.group(1)
            return (int(value) if value.isdigit() else float("inf"), value)
        return (float("inf"), "")

    sorted_chromosomes_list = sorted(chromosomes, key=sort_key)
    sorted_chromosomes_list = [
        {"value": chrom, "label": chrom} for chrom in sorted_chromosomes_list
    ]

    conn.close()
    return sorted_chromosomes_list


"""
Return the chromosome size in the given chromosome name
"""
def chromosome_size(chromosome_name):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT size
        FROM chromosome
        WHERE chrid = %s
    """,
        (chromosome_name,),
    )

    size = cur.fetchone()["size"]
    conn.close()
    return size


"""
Returns the all sequences of the chromosome data in the given cell line, chromosome name
"""
def chromosome_sequences(cell_line, chromosome_name):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT start_value, end_value
        FROM sequence
        WHERE cell_line = %s
        AND chrid = %s
        ORDER BY start_value
    """,
        (cell_line, chromosome_name),
    )

    ranges = [
        {"start": row["start_value"], "end": row["end_value"]} for row in cur.fetchall()
    ]

    conn.close()
    return ranges


"""
Return the chromosome size in the given gene name
"""
def chromosome_size_by_gene_name(gene_name):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT chromosome, start_location, end_location
        FROM gene
        WHERE symbol = %s
    """,
        (gene_name,),
    )

    gene = cur.fetchone()
    conn.close()
    return gene


"""
Returns the existing chromosome data in the given cell line, chromosome name, start, end
"""
def chromosome_data(cell_line, chromosome_name, sequences):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT cell_line, chrid, fdr, ibp, jbp, fq, rawc
        FROM non_random_hic
        WHERE chrid = %s
        AND cell_line = %s
        AND ibp >= %s
        AND ibp <= %s
        AND jbp >= %s
        AND jbp <= %s
    """,
        (
            chromosome_name,
            cell_line,
            sequences["start"],
            sequences["end"],
            sequences["start"],
            sequences["end"],
        ),
    )
    chromosome_sequence = cur.fetchall()
    conn.close()

    return chromosome_sequence


"""
Returns the existing chromosome data in the given cell line, chromosome name, start, end
"""
def chromosome_valid_ibp_data(cell_line, chromosome_name, sequences):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
            SELECT DISTINCT ibp
            FROM non_random_hic
            WHERE chrid = %s
            AND cell_line = %s
            AND ibp >= %s
            AND ibp <= %s
            AND jbp >= %s
            AND jbp <= %s
        """,
        (
            chromosome_name,
            cell_line,
            sequences["start"],
            sequences["end"],
            sequences["start"],
            sequences["end"],
        ),
    )
    chromosome_valid_ibps = cur.fetchall()
    conn.close()

    ibp_values = [ibp["ibp"] for ibp in chromosome_valid_ibps]

    return ibp_values


"""
Returns the example(3) 3D chromosome data in the given cell line, chromosome name, start, end
"""
def example_chromosome_3d_data(cell_line, chromosome_name, sequences, sample_id):
    conn = get_db_connection()
    cur = conn.cursor()

    temp_folding_input_path = "../Data/Folding_input"

    def get_spe_inter(hic_data, alpha=0.05):
        """Filter Hi-C data for significant interactions based on the alpha threshold."""
        hic_spe = hic_data.loc[hic_data["fdr"] < alpha]
        return hic_spe

    def get_fold_inputs(spe_df):
        """Prepare folding input file from the filtered significant interactions."""
        spe_out_df = spe_df[["ibp", "jbp", "fq", "chrid", "fdr"]].copy()
        spe_out_df["w"] = 1
        result = spe_out_df[["chrid", "ibp", "jbp", "fq", "w"]]
        return result

    def checking_existing_data(conn, chromosome_name, cell_line, sequences, sample_id):
        cur = conn.cursor()
        
        # checking position table
        query_position = """
            SELECT EXISTS (
                SELECT 1
                FROM position
                WHERE chrid = %s
                AND cell_line = %s
                AND start_value = %s
                AND end_value = %s
                AND sampleID = %s
            );
        """
        cur.execute(query_position, (chromosome_name, cell_line, sequences["start"], sequences["end"], sample_id))
        position_exists = cur.fetchone()['exists']
        
        # # checking distance table
        query_distance = """
            SELECT EXISTS (
                SELECT 1 FROM distance
                WHERE cell_line = %s
                    AND chrid = %s
                    AND start_value = %s
                    AND end_value = %s
                LIMIT 1
            );
        """
        cur.execute(query_distance, (cell_line, chromosome_name, sequences["start"], sequences["end"]))
        distance_exists = cur.fetchone()['exists']
        
        cur.close()
        
        return {
            "position_exists": bool(position_exists),
            "distance_exists": bool(distance_exists)
        }

    def get_position_data(conn, chromosome_name, cell_line, sequences, sample_id):
        cur = conn.cursor()
        cur.execute(
            """
            SELECT *
            FROM position
            WHERE chrid = %s
            AND cell_line = %s
            AND start_value = %s
            AND end_value = %s
            AND sampleID = %s
        """,
            (chromosome_name, cell_line, sequences["start"], sequences["end"], sample_id),
        )
        data = cur.fetchall()
        cur.close()
        return data

    def get_avg_distance_data(conn, chromosome_name, cell_line, sequences):
        cur = conn.cursor()
        cur.execute(
            """
            SELECT distance_vector
            FROM distance
            WHERE cell_line = %s
            AND chrid = %s
            AND start_value = %s
            AND end_value = %s
        """,
            (cell_line, chromosome_name, sequences["start"], sequences["end"]),
        )

        rows = cur.fetchall()
        first_vector = np.array(rows[0]["distance_vector"], dtype=float)
        sum_vector = first_vector.copy()
        
        for row in rows:
            vector = np.array(row["distance_vector"], dtype=float)
            sum_vector += vector

        count = len(rows)
        avg_vector = sum_vector / count
        
        full_distance_matrix = squareform(avg_vector)
        avg_distance_matrix = full_distance_matrix.tolist()
        
        return avg_distance_matrix

    existing_data_status = checking_existing_data(conn, chromosome_name, cell_line, sequences, sample_id)

    if existing_data_status["position_exists"] and existing_data_status["distance_exists"]: 
        return { 
                "position_data": get_position_data(conn, chromosome_name, cell_line, sequences, sample_id),
                "avg_distance_data": get_avg_distance_data(conn, chromosome_name, cell_line, sequences)
            }
    else:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT *
            FROM non_random_hic
            WHERE chrid = %s
            AND cell_line = %s
            AND ibp >= %s
            AND ibp <= %s
            AND jbp >= %s
            AND jbp <= %s
        """,
            (
                chromosome_name,
                cell_line,
                sequences["start"],
                sequences["end"],
                sequences["start"],
                sequences["end"],
            ),
        )
        original_data = cur.fetchall()
        cur.close()

        if original_data:
            original_df = pd.DataFrame(
                original_data, columns=["chrid", "fdr", "ibp", "jbp", "fq"]
            )

            filtered_df = get_spe_inter(original_df)
            fold_inputs = get_fold_inputs(filtered_df)

            txt_data = fold_inputs.to_csv(index=False, sep="\t", header=False)
            custom_name = (
                f"{cell_line}.{chromosome_name}.{sequences['start']}.{sequences['end']}"
            )

            # Ensure the custom path exists, create it if it doesn't
            os.makedirs(temp_folding_input_path, exist_ok=True)

            # Define the full path where the file will be stored
            custom_file_path = os.path.join(
                temp_folding_input_path, custom_name + ".txt"
            )

            # Write the file to the custom path
            with open(custom_file_path, "w") as temp_file:
                temp_file.write(txt_data)

            script = "./sBIF.sh"
            n_samples = 5000
            n_samples_per_run = 100
            is_download = 1
            subprocess.run(
                [
                    "bash",
                    script,
                    str(n_samples),
                    str(n_samples_per_run),
                    str(is_download),
                ],
                capture_output=True,
                text=True,
                check=True,
            )

            os.remove(custom_file_path)

            return { 
                "position_data": get_position_data(conn, chromosome_name, cell_line, sequences, sample_id),
                "avg_distance_data": get_avg_distance_data(conn, chromosome_name, cell_line, sequences)
            }
        else:
            return []


"""
Download the full 3D chromosome samples distance data in the given cell line, chromosome name
"""
def download_full_chromosome_3d_distance_data(cell_line, chromosome_name, sequences):
    def checking_existing_data(conn):
        cur = conn.cursor()
        query = """
            SELECT EXISTS (
                SELECT 1 FROM distance
                WHERE cell_line = %s
                    AND chrid = %s
                    AND start_value = %s
                    AND end_value = %s
                LIMIT 1
            );
        """
        cur.execute(query, (cell_line, chromosome_name, sequences["start"], sequences["end"]))
        data = cur.fetchone()
        print("Existing data check:", data)
        cur.close()
        return data
    
    def get_distance_data(conn):
        with conn.cursor() as cur:
            query = """
                SELECT distance_vector
                FROM distance
                WHERE cell_line = %s
                    AND chrid = %s
                    AND start_value = %s
                    AND end_value = %s
            """
            cur.execute(query, (cell_line, chromosome_name, sequences["start"], sequences["end"]))

            vectors = []
            batch_size = 1000

            while True:
                rows = cur.fetchmany(batch_size)
                if not rows:
                    break
                for row in rows:
                    vector_str = row["distance_vector"]
                    try:
                        vector = np.array(vector_str, dtype=np.float32)
                        vectors.append(vector)
                    except Exception as e:
                        print("Error parsing distance_vector:", e)
                        continue

        if not vectors:
            print("No valid distance_vector")
            return None

        matrix = np.array(vectors, dtype=np.float32)
        sparse_matrix = csr_matrix(matrix)

        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.npz') as tmp_file:
            save_npz(tmp_file.name, sparse_matrix)
            sparse_file_path = tmp_file.name

        return sparse_file_path
    
    conn = get_db_connection()

    existing_data_status = checking_existing_data(conn)

    if existing_data_status['exists']:
        parquet_file_path = get_distance_data(conn)
        print(f"Existing data found: {parquet_file_path}")
        return parquet_file_path, send_file(
            parquet_file_path,
            as_attachment=True,
            download_name=f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}.npz",
        )
    else:
        return None, None

"""
Returns currently existing other cell line list in given chromosome name and sequences
"""
def comparison_cell_line_list(cell_line):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT DISTINCT cell_line
        FROM sequence
    """
    )

    rows = cur.fetchall()

    label_mapping = {
        "IMR": "Lung(IMR90)",
        "K": "Blood Leukemia(K562)",
        "GM": "Lymphoblastoid Cell Line(GM12878)",
    }

    options = [
        {
            "value": row["cell_line"],
            "label": label_mapping.get(row["cell_line"], "Unknown"),
        }
        for row in rows
        if row["cell_line"] != cell_line
    ]
    conn.close()

    return options


"""
Return the gene list in the given chromosome_name and sequence
"""
def gene_list(chromosome_name, sequences):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT *
        FROM gene
        WHERE chromosome = %s
        AND (
            (start_location BETWEEN %s AND %s)
            OR (end_location BETWEEN %s AND %s)
            OR (start_location <= %s AND end_location >= %s)
        )
    """,
        (
            chromosome_name,
            sequences["start"],
            sequences["end"],
            sequences["start"],
            sequences["end"],
            sequences["start"],
            sequences["end"],
        ),
    )

    gene_list = cur.fetchall()
    conn.close()

    return gene_list


"""
Return the epigenetic track data in the given cell_line, chromosome_name and sequence
"""
def epigenetic_track_data(cell_line, chromosome_name, sequences):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT *
        FROM epigenetic_track
        WHERE chrid = %s
        AND cell_line = %s
        AND start_value >= %s
        AND end_value <= %s
    """,
        (chromosome_name, cell_line, sequences["start"], sequences["end"]),
    )

    # Fetch all the data from the query
    epigenetic_track_data = cur.fetchall()

    # Close the database connection
    conn.close()

    # Initialize a dictionary to store the aggregated data by epigenetic key
    aggregated_data = {}

    # Loop through the fetched rows and aggregate by epigenetic key
    for row in epigenetic_track_data:
        # Assuming 'epigenetic' is one of the columns in the row
        epigenetic_key = row["epigenetic"]  # Replace with the actual column name
        if epigenetic_key not in aggregated_data:
            aggregated_data[epigenetic_key] = []

        # Append the current row or necessary data to the list under the epigenetic key
        aggregated_data[epigenetic_key].append(row)

    return aggregated_data
