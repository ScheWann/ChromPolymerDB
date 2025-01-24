import pandas as pd
import psycopg2
import os
import re
import tempfile
import subprocess
import shutil
from psycopg2.extras import RealDictCursor
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
        AND (chromosome = '12' OR chromosome = '17')
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
        SELECT DISTINCT chrID
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
        WHERE chrID = %s
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
        AND chrID = %s
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
        SELECT cell_line, chrid, fdr, ibp, jbp, fq
        FROM non_random_hic
        WHERE chrID = %s
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
            WHERE chrID = %s
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

    def delete_old_samples(conn):
        """Delete old samples from the position table."""
        cur = conn.cursor()

        cur.execute("""
            DELETE FROM position
            WHERE insert_time < CURRENT_TIMESTAMP - INTERVAL '10 minutes';
        """)

        print("Old samples deleted successfully.")
    
    delete_old_samples(conn)
    
    temp_folding_input_path = "../Data/Folding_input"
    def get_spe_inter(hic_data, alpha=0.05):
        """Filter Hi-C data for significant interactions based on the alpha threshold."""
        hic_spe = hic_data.loc[hic_data["fdr"] < alpha]
        return hic_spe

    def get_fold_inputs(spe_df):
        """Prepare folding input file from the filtered significant interactions."""
        spe_out_df = spe_df[["ibp", "jbp", "fq", "chrid", "fdr"]]
        spe_out_df["w"] = 1
        result = spe_out_df[["chrid", "ibp", "jbp", "fq", "w"]]
        return result

    def checking_existing_data(conn, chromosome_name, cell_line, sequences, sample_id):
        cur = conn.cursor()
        cur.execute(
            """
            SELECT *
            FROM position
            WHERE chrID = %s
            AND cell_line = %s
            AND start_value = %s
            AND end_value = %s
            AND sampleID = %s
        """,
            (chromosome_name, cell_line, sequences["start"], sequences["end"], sample_id),
        )
        position_data = cur.fetchall()
        
        if position_data:
            return position_data
        else: 
            return None

    if checking_existing_data(conn, chromosome_name, cell_line, sequences, sample_id):
        return checking_existing_data(conn, chromosome_name, cell_line, sequences, sample_id)
    else:
        cur.execute(
            """
            SELECT *
            FROM non_random_hic
            WHERE chrID = %s
            AND cell_line = %s
            AND ibp >= %s
            AND ibp <= %s
            AND jbp >= %s
            AND jbp <= %s
        """,
            (chromosome_name, cell_line, sequences["start"], sequences["end"], sequences["start"], sequences["end"]),
        )
        original_data = cur.fetchall()

        if original_data:
            original_df = pd.DataFrame(original_data, columns=["chrid", "fdr", "ibp", "jbp", "fq"])

            filtered_df = get_spe_inter(original_df)
            fold_inputs = get_fold_inputs(filtered_df)

            txt_data = fold_inputs.to_csv(index=False, sep="\t", header=False)
            custom_name = f"{cell_line}.{chromosome_name}.{sequences['start']}.{sequences['end']}"

            # Ensure the custom path exists, create it if it doesn't
            os.makedirs(temp_folding_input_path, exist_ok=True)

            # Define the full path where the file will be stored
            custom_file_path = os.path.join(temp_folding_input_path, custom_name + ".txt")

            # Write the file to the custom path
            with open(custom_file_path, 'w') as temp_file:
                temp_file.write(txt_data)

            script = "./sBIF.sh"
            n_samples = 5000
            n_samples_per_run = 100
            is_download = "false"
            subprocess.run(
                ["bash", script, str(n_samples), str(n_samples_per_run), str(is_download)],
                capture_output=True,
                text=True,
                check=True,
            )

            os.remove(custom_file_path)

            return checking_existing_data(conn, chromosome_name, cell_line, sequences, sample_id)
        else:
            return []


"""
Download the full 3D chromosome data(including distances, 50000) in the given cell line, chromosome name, start, end
"""
def download_full_chromosome_3d_data(cell_line, chromosome_name, sequences):
    conn = get_db_connection()
    cur = conn.cursor()

    def get_spe_inter(hic_data, alpha=0.05):
        """Filter Hi-C data for significant interactions based on the alpha threshold."""
        hic_spe = hic_data.loc[hic_data["fdr"] < alpha]
        return hic_spe

    def get_fold_inputs(spe_df):
        """Prepare folding input file from the filtered significant interactions."""
        spe_out_df = spe_df[["ibp", "jbp", "fq", "chr", "fdr"]]
        spe_out_df["w"] = 1
        result = spe_out_df[["cell_line", "chr", "ibp", "jbp", "fq", "w"]]
        return result

    cur.execute(
        """
        SELECT *
        FROM non_random_hic
        WHERE chrID = %s
        AND cell_line = %s
        AND ibp >= %s
        AND ibp <= %s
        ORDER BY start_value
    """,
        (chromosome_name, cell_line, sequences["start"], sequences["end"]),
    )
    original_data = cur.fetchall()
    conn.close()

    column_names = [desc[0] for desc in cur.description]
    original_df = pd.DataFrame(original_data, columns=column_names)

    filtered_df = get_spe_inter(original_df)
    fold_inputs = get_fold_inputs(filtered_df)

    txt_data = fold_inputs.to_csv(index=False, sep="\t")
    custom_name = (
        f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}"
    )
    with tempfile.NamedTemporaryFile(
        delete=False, mode="w", suffix=".txt"
    ) as temp_file:
        temp_file.write(txt_data)
        temp_file_path = temp_file.name
        os.rename(temp_file_path, custom_name)
        temp_file_path = custom_name

    script = "./sBIF.sh"
    n_samples = 50000
    n_runs = 100
    is_download = True
    subprocess.run(
        ["bash", script, n_samples, n_runs, is_download],
        capture_output=True,
        text=True,
        check=True,
    )

    os.remove(custom_name)

    return "Success send download full chromosome 3D data request"


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
        (chromosome_name, sequences["start"], sequences["end"], sequences["start"], sequences["end"], sequences["start"], sequences["end"]),
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
        WHERE chrID = %s
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
        epigenetic_key = row['epigenetic']  # Replace with the actual column name
        if epigenetic_key not in aggregated_data:
            aggregated_data[epigenetic_key] = []
        
        # Append the current row or necessary data to the list under the epigenetic key
        aggregated_data[epigenetic_key].append(row)

    return aggregated_data
