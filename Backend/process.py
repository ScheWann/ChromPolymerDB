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
from itertools import combinations
import math
from scipy.spatial.distance import squareform, pdist
from scipy.stats import pearsonr
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
Returns the example 3D chromosome data in the given cell line, chromosome name, start, end
"""
def example_chromosome_3d_data(cell_line, chromosome_name, sequences, sample_id):
    conn = get_db_connection()
    cur = conn.cursor()

    temp_folding_input_path = "./Folding_input"

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

    # Check if the data already exists in the database
    def checking_existing_data(conn, chromosome_name, cell_line, sequences):
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
            );
        """
        cur.execute(query_position, (chromosome_name, cell_line, sequences["start"], sequences["end"]))
        position_exists = cur.fetchone()['exists']
        
        # checking distance table
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
            AND sampleid = %s
        """,
            (chromosome_name, cell_line, sequences["start"], sequences["end"], sample_id),
        )
        data = cur.fetchall()
        cur.close()
        return data

    # Get the average distance data of 5000 chain samples
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
        cur.close()

        if not rows:
            return []

        # Convert all vectors at once for efficiency
        vectors = np.array([np.array(row["distance_vector"], dtype=float) for row in rows])
        avg_vector = np.mean(vectors, axis=0)
        
        # Convert the upper triangular distance vector to a full matrix
        avg_distance_matrix = squareform(avg_vector).tolist()
        
        return avg_distance_matrix

    def get_fq_data(conn, chromosome_name, cell_line, sequences):
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
        binary_vector = np.where(first_vector <= 80, 1, 0) 
        sum_vector = binary_vector.copy()

        for row in rows[1:]:
            vector = np.array(row["distance_vector"], dtype=float)
            binary_vector = np.where(vector <= 80, 1, 0)
            sum_vector += binary_vector
        
        count = len(rows)
        avg_vector = sum_vector / count

        full_distance_matrix = squareform(avg_vector)
        avg_distance_matrix = full_distance_matrix.tolist()
        
        return avg_distance_matrix

    # Return the most similar chain
    def get_best_chain_sample():
        avg_distance_matrix = get_avg_distance_data(conn, chromosome_name, cell_line, sequences)
        avg_distance_vector = np.array(avg_distance_matrix).flatten()

        best_corr = None
        best_sample_id = None

        for sample_id in range(5000):
            sample_distance_matrix = get_distance_vector_by_sample(conn, chromosome_name, cell_line, sample_id, sequences)
            sample_distance_vector = np.array(sample_distance_matrix).flatten()
            
            corr, _ = pearsonr(sample_distance_vector, avg_distance_vector)
            print(corr, sample_id, 'corr_value')
            
            if best_corr is None or abs(1 - abs(corr)) < abs(1 - abs(best_corr)):
                best_corr = corr
                best_sample_id = sample_id

        print(best_corr, 'best_corr')
        return best_sample_id if best_corr is not None else None

    existing_data_status = checking_existing_data(conn, chromosome_name, cell_line, sequences)

    def get_distance_vector_by_sample(conn, chromosome_name, cell_line, sampleid, sequences):
        cur = conn.cursor()
        query = """
            SELECT distance_vector
            FROM distance
            WHERE cell_line = %s
                AND sampleid = %s
                AND chrid = %s
                AND start_value = %s
                AND end_value = %s
            LIMIT 1;
        """
        cur.execute(query, (cell_line, sampleid, chromosome_name, sequences["start"], sequences["end"]))
        row = cur.fetchone()
        cur.close()

        full_distance_matrix = squareform(row["distance_vector"])
        avg_distance_matrix = full_distance_matrix.tolist()
        return avg_distance_matrix

    if existing_data_status["position_exists"] and existing_data_status["distance_exists"]:
        if sample_id is 0:
            best_sample_id = get_best_chain_sample()
            sample_distance_vector = get_distance_vector_by_sample(conn, chromosome_name, cell_line, best_sample_id, sequences)

            return {
                "position_data": get_position_data(conn, chromosome_name, cell_line, sequences, best_sample_id),
                "avg_distance_data": get_avg_distance_data(conn, chromosome_name, cell_line, sequences),
                "fq_data": get_fq_data(conn, chromosome_name, cell_line, sequences),
                "sample_distance_vector": sample_distance_vector
            }
        else:
            sample_distance_vector = get_distance_vector_by_sample(conn, chromosome_name, cell_line, sample_id, sequences)
            return {
                "position_data": get_position_data(conn, chromosome_name, cell_line, sequences, sample_id),
                "avg_distance_data": get_avg_distance_data(conn, chromosome_name, cell_line, sequences),
                "fq_data": get_fq_data(conn, chromosome_name, cell_line, sequences),
                "sample_distance_vector": sample_distance_vector
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

            if sample_id == 0:
                best_sample_id = get_best_chain_sample()
                sample_distance_vector = get_distance_vector_by_sample(conn, chromosome_name, cell_line, best_sample_id, sequences)

                return { 
                    "position_data": get_position_data(conn, chromosome_name, cell_line, sequences, best_sample_id),
                    "avg_distance_data": get_avg_distance_data(conn, chromosome_name, cell_line, sequences),
                    "fq_data": get_fq_data(conn, chromosome_name, cell_line, sequences),
                    "sample_distance_vector": sample_distance_vector
                }
            else:
                sample_distance_vector = get_distance_vector_by_sample(conn, chromosome_name, cell_line, sample_id, sequences)
                return { 
                    "position_data": get_position_data(conn, chromosome_name, cell_line, sequences, sample_id),
                    "avg_distance_data": get_avg_distance_data(conn, chromosome_name, cell_line, sequences),
                    "fq_data": get_fq_data(conn, chromosome_name, cell_line, sequences),
                    "sample_distance_vector": sample_distance_vector
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


"""
Return the distribution of selected beads in all samples
"""
def bead_distribution(cell_line, chromosome_name, sequences, indices):
    indices = [int(idx) for idx in indices]
    conn = get_db_connection()
    cur = conn.cursor()

    distributions = {}
    for i, j in combinations(indices, 2):
        distributions[f"{i}-{j}"] = []
    
    query = """
        SELECT sampleid, X, Y, Z
        FROM position
        WHERE chrid = %s
        AND cell_line = %s
        AND start_value = %s
        AND end_value = %s
        ORDER BY sampleid, pid
    """
    cur.execute(query, (chromosome_name, cell_line, sequences["start"], sequences["end"]))
    rows = cur.fetchall()

    conn.close()
    cur.close()

    sample_dict = {}
    for row in rows:
        sampleid = row["sampleid"]
        x = row["x"]
        y = row["y"]
        z = row["z"]
        if sampleid not in sample_dict:
            sample_dict[sampleid] = []
        sample_dict[sampleid].append((x, y, z))
    
    for sampleid, beads in sample_dict.items():
        if len(beads) <= max(indices):
            continue

        for i, j in combinations(indices, 2):
            bead1 = beads[i]
            bead2 = beads[j]

            x1, y1, z1 = float(bead1[0]), float(bead1[1]), float(bead1[2])
            x2, y2, z2 = float(bead2[0]), float(bead2[1]), float(bead2[2])
            distance = math.sqrt((x1 - x2)**2 + (y1 - y2)**2 + (z1 - z2)**2)
            distributions[f"{i}-{j}"].append(distance)

    return distributions