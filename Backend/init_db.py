import os
import re
from psycopg2 import sql
import psycopg2.extras
import pandas as pd
from dotenv import load_dotenv


load_dotenv()

DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")

ROOT_DIR = "../Data"


def get_db_connection(database=None):
    """Create a connection to the database."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST, user=DB_USERNAME, password=DB_PASSWORD, database=database
        )
        return conn
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return None


def table_exists(cur, table_name):
    """Check if a table exists in the database."""
    cur.execute(
        sql.SQL(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s);"
        ),
        [table_name],
    )
    return cur.fetchone()[0]


def data_exists(cur, table_name):
    """Check if a table has data."""
    cur.execute(
        sql.SQL("SELECT EXISTS (SELECT 1 FROM {} LIMIT 1);").format(
            sql.Identifier(table_name)
        )
    )
    return cur.fetchone()[0]


def initialize_tables():
    """Create tables"""

    # Connect to the newly created database to create tables
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    # Check if tables already exist
    if not table_exists(cur, "chromosome"):
        print("Creating chromosome table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS chromosome ("
            "chrID varchar(50) PRIMARY KEY,"
            "size INT NOT NULL DEFAULT 0"
            ");"
        )
        conn.commit()
        print("chromosome table created successfully.")
    else:
        print("chromosome table already exists, skipping creation.")

    if not table_exists(cur, "gene"):
        print("Creating gene table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS gene ("
            "gID serial PRIMARY KEY,"
            "gene_id BIGINT NOT NULL,"
            "chromosome VARCHAR(50) NOT NULL,"
            "start_location BIGINT NOT NULL DEFAULT 0,"
            "end_location BIGINT NOT NULL DEFAULT 0,"
            "gene_name VARCHAR(255) NOT NULL,"
            "symbol VARCHAR(30) NOT NULL"
            ");"
        )
        conn.commit()
        print("gene table created successfully.")
    else:
        print("gene table already exists, skipping creation.")

    if not table_exists(cur, "non_random_hic"):
        print("Creating non_random_hic table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS non_random_hic ("
            "hID serial PRIMARY KEY,"
            "chrID VARCHAR(50) NOT NULL,"
            "cell_line VARCHAR(50) NOT NULL,"
            "fq FLOAT NOT NULL DEFAULT 0.0,"
            "fdr FLOAT NOT NULL DEFAULT 0.0,"
            "ibp BIGINT NOT NULL DEFAULT 0,"
            "jbp BIGINT NOT NULL DEFAULT 0,"
            "CONSTRAINT fk_non_random_hic_chrID FOREIGN KEY (chrID) REFERENCES chromosome(chrID) ON DELETE CASCADE ON UPDATE CASCADE"
            ");"
        )
        conn.commit()
        print("non_random_hic table created successfully.")

        print("Creating index idx_hic_optimized...")
        cur.execute(
            """
            CREATE INDEX idx_hic_optimized ON non_random_hic (chrID, cell_line, ibp, jbp);
            """
        )
        conn.commit()
        print("Index idx_hic_optimized created successfully.")
    else:
        print("non_random_hic table already exists, skipping creation.")

    if not table_exists(cur, "epigenetic_track"):
        print("Creating epigenetic_track table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS epigenetic_track ("
            "etID serial PRIMARY KEY,"
            "chrID VARCHAR(50) NOT NULL,"
            "cell_line VARCHAR(50) NOT NULL,"
            "epigenetic VARCHAR(50) NOT NULL,"
            "start_value BIGINT NOT NULL DEFAULT 0,"
            "end_value BIGINT NOT NULL DEFAULT 0,"
            "name VARCHAR(50) NOT NULL,"
            "score INT NOT NULL DEFAULT 0,"
            "strand VARCHAR(1) NOT NULL,"
            "signal_value FLOAT NOT NULL DEFAULT 0.0,"
            "p_value FLOAT NOT NULL DEFAULT 0.0,"
            "q_value FLOAT NOT NULL DEFAULT 0.0,"
            "peak BIGINT NOT NULL DEFAULT 0"
            ");"
        )
        conn.commit()
        print("epigenetic_track table created successfully.")
    else:
        print("epigenetic_track table already exists, skipping creation.")

    if not table_exists(cur, "sequence"):
        print("Creating sequence table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS sequence ("
            "sID serial PRIMARY KEY,"
            "chrID VARCHAR(50) NOT NULL,"
            "cell_line VARCHAR(50) NOT NULL,"
            "start_value BIGINT NOT NULL DEFAULT 0,"
            "end_value BIGINT NOT NULL DEFAULT 0,"
            "UNIQUE(chrID, cell_line, start_value, end_value)"
            ");"
        )
        conn.commit()
        print("sequence table created successfully.")
    else:
        print("sequence table already exists, skipping creation.")

    if not table_exists(cur, "position"):
        print("Creating position table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS position ("
            "pID serial PRIMARY KEY,"
            "cell_line VARCHAR(50) NOT NULL,"
            "chrID VARCHAR(50) NOT NULL,"
            "sampleID INT NOT NULL DEFAULT 0,"
            "start_value BIGINT NOT NULL DEFAULT 0,"
            "end_value BIGINT NOT NULL DEFAULT 0,"
            "X FLOAT NOT NULL DEFAULT 0.0,"
            "Y FLOAT NOT NULL DEFAULT 0.0,"
            "Z FLOAT NOT NULL DEFAULT 0.0,"
            "insert_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
            ");"
        )
        conn.commit()
        print("position table created successfully.")
    else:
        print("position table already exists, skipping creation.")

    # Close connection
    cur.close()
    conn.close()
    return


def process_chromosome_data(cur, file_path):
    """Process and insert chromosome data from the specified file."""
    with open(file_path, "r") as f:
        data_to_insert = []
        query = "INSERT INTO chromosome (chrID, size) VALUES (%s, %s);"
        for line in f:
            # Split each line by tab and strip extra spaces/newlines
            data = line.strip().split("\t")
            data_to_insert.append((data[0], int(data[1])))

        psycopg2.extras.execute_batch(cur, query, data_to_insert)


def process_gene_data(cur, file_path):
    """Process and insert gene data from the specified file."""
    gene_df = pd.read_csv(file_path, sep="\t")
    gene_df = gene_df[["Gene ID", "Name", "Symbol", "Chromosome", "Begin", "End"]]

    query = """
    INSERT INTO gene (gene_id, chromosome, start_location, end_location, gene_name, symbol)
    VALUES (%s, %s, %s, %s, %s, %s);
    """
    data_to_insert = gene_df[
        ["Gene ID", "Chromosome", "Begin", "End", "Name", "Symbol"]
    ].values.tolist()

    psycopg2.extras.execute_batch(cur, query, data_to_insert)


def process_non_random_hic_data(chromosome_dir):
    """Process and insert Hi-C data from CSV files in the specified directory."""
    query = """
    INSERT INTO non_random_hic (chrID, cell_line, ibp, jbp, fq, fdr)
    VALUES (%s, %s, %s, %s, %s, %s);
    """

    # Loop through all files in the directory
    for file_name in os.listdir(chromosome_dir):
        if file_name.endswith(".csv.gz"):
            # Get the cell_line from the file name
            cell_line = re.search(r"^(\w+)_", file_name).group(1)
            file_path = os.path.join(chromosome_dir, file_name)

            # Read the CSV file in chunks
            for chunk in pd.read_csv(
                file_path, usecols=["chr", "cell_line", "ibp", "jbp", "fq", "fdr"], chunksize=10000
            ):
                # Convert the chunk to a list of tuples
                non_random_hic_records = chunk[
                    ["chr", "cell_line", "ibp", "jbp", "fq", "fdr"]
                ].values.tolist()

                # Prepare data for batch insertion
                data_to_insert = [
                    (record[0], record[1], record[2], record[3], record[4], record[5])
                    for record in non_random_hic_records
                ]

                conn = get_db_connection(database=DB_NAME)
                cur = conn.cursor()

                # Batch insert the records and commit after each chunk
                psycopg2.extras.execute_batch(cur, query, data_to_insert)
                print(f"Inserted {len(data_to_insert)} records for {cell_line}.")
                
                conn.commit()
                cur.close()
                conn.close()

            print(
                f"Non-random Hi-C data for cell line {cell_line} inserted successfully."
            )


def process_epigenetic_track_data(cur):
    """Process and insert epigenetic track data from all bed.gz files in the specified folder."""
    folder_path = os.path.join(ROOT_DIR, "epigenetic_tracks")
    for filename in os.listdir(folder_path):
        # check if the file is a bed.gz file
        if filename.endswith(".bed.gz"):
            file_path = os.path.join(folder_path, filename)

            parts = filename.replace(".bed.gz", "").split("_")
            cell_line = parts[0]
            epigenetic = parts[1]

            df = pd.read_csv(file_path, sep="\t", header=None)
            df.columns = ["chrID", "start_value", "end_value", "name", "score", "strand", "signalValue", "pValue", "qValue", "peak"]

            df["cell_line"] = cell_line
            df["epigenetic"] = epigenetic
            
            df = df[["chrID", "cell_line", "epigenetic", "start_value", "end_value", "name", "score", "strand", "signalValue", "pValue", "qValue", "peak"]]

            query = """

            INSERT INTO epigenetic_track (chrID, cell_line, epigenetic, start_value, end_value, name, score, strand, signal_value, p_value, q_value, peak)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """

            data_to_insert = df.to_records(index=False).tolist()
            psycopg2.extras.execute_batch(cur, query, data_to_insert)


def process_sequence_data(cur):
    """Process and insert sequence data from all CSV files in the specified folder."""
    folder_path = os.path.join(ROOT_DIR, "seqs")
    for filename in os.listdir(folder_path):
        # check if the file is a CSV.gz file
        if filename.endswith(".csv.gz"):
            file_path = os.path.join(folder_path, filename)

            df = pd.read_csv(
                file_path, usecols=["chrID", "cell_line", "start_value", "end_value"]
            )

            df = df[["chrID", "cell_line", "start_value", "end_value"]]

            query = """

            INSERT INTO sequence (chrID, cell_line, start_value, end_value)
            VALUES (%s, %s, %s, %s);
            """

            data_to_insert = df.to_records(index=False).tolist()
            psycopg2.extras.execute_batch(cur, query, data_to_insert)


def insert_data():
    """Insert data(Except for the data of non random HiC) into the database if not already present."""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    # Insert chromosome data only if the table is empty
    if not data_exists(cur, "chromosome"):
        file_path = os.path.join(ROOT_DIR, "chromosome_sizes.txt")
        print("Inserting chromosome data...")
        process_chromosome_data(cur, file_path)
        print("Chromosome data inserted successfully.")
    else:
        print("Chromosome data already exists, skipping insertion.")

    # Insert gene data only if the table is empty
    if not data_exists(cur, "gene"):
        file_path = os.path.join(ROOT_DIR, "ncbi_dataset.tsv")
        print("Inserting gene data...")
        process_gene_data(cur, file_path)
        print("Gene data inserted successfully.")
    else:
        print("Gene data already exists, skipping insertion.")

    # Insert sequence data only if the table is empty
    if not data_exists(cur, "sequence"):
        print("Inserting sequence data...")
        process_sequence_data(cur)
        print("Sequence data inserted successfully.")

    # Insert epigenetic track data only if the table is empty
    if not data_exists(cur, "epigenetic_track"):
        print("Inserting epigenetic track data...")
        process_epigenetic_track_data(cur)
        print("epigenetic track data inserted successfully.")

    # Commit changes and close connection
    conn.commit()
    cur.close()
    conn.close()
    return


def insert_non_random_HiC_data():
    """Insert non random HiC data into the database if not already present.(it is seperated from insert_data() to avoid long running transactions)"""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    # Insert non-random Hi-C data only if the table is empty
    if not data_exists(cur, "non_random_hic"):
        chromosome_dir = os.path.join(ROOT_DIR, "refined_processed_HiC")
        process_non_random_hic_data(chromosome_dir)
    else:
        print("Non-random Hi-C data already exists, skipping insertion.")


initialize_tables()
insert_data()
insert_non_random_HiC_data()