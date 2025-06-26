import os
import glob
from io import StringIO
import psycopg
from psycopg import sql
import pandas as pd
from dotenv import load_dotenv


load_dotenv()

DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")

ROOT_DIR = "../Data"
EXAMPLE_DIR = './example_data'

def get_db_connection(database=None):
    try:
        conn = psycopg.connect(
            host=DB_HOST,
            user=DB_USERNAME,
            password=DB_PASSWORD,
            dbname=database
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
            "chrid varchar(50) PRIMARY KEY,"
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
            "gid serial PRIMARY KEY,"
            "chromosome VARCHAR(50) NOT NULL,"
            "orientation VARCHAR(10) NOT NULL DEFAULT 'plus',"
            "start_location BIGINT NOT NULL DEFAULT 0,"
            "end_location BIGINT NOT NULL DEFAULT 0,"
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
            "hid serial PRIMARY KEY,"
            "chrid VARCHAR(50) NOT NULL,"
            "ibp BIGINT NOT NULL DEFAULT 0,"
            "jbp BIGINT NOT NULL DEFAULT 0,"
            "fq FLOAT NOT NULL DEFAULT 0.0,"
            "fdr FLOAT NOT NULL DEFAULT 0.0,"
            "rawc FLOAT NOT NULL DEFAULT 0.0,"
            "cell_line VARCHAR(50) NOT NULL,"
            "CONSTRAINT fk_non_random_hic_chrid FOREIGN KEY (chrid) REFERENCES chromosome(chrid) ON DELETE CASCADE ON UPDATE CASCADE"
            ");"
        )
        conn.commit()
        print("non_random_hic table created successfully.")
    else:
        print("non_random_hic table already exists, skipping creation.")

    if not table_exists(cur, "epigenetic_track"):
        print("Creating epigenetic_track table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS epigenetic_track ("
            "etid serial PRIMARY KEY,"
            "chrid VARCHAR(50) NOT NULL,"
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
            "sid serial PRIMARY KEY,"
            "chrid VARCHAR(50) NOT NULL,"
            "cell_line VARCHAR(50) NOT NULL,"
            "start_value BIGINT NOT NULL DEFAULT 0,"
            "end_value BIGINT NOT NULL DEFAULT 0,"
            "UNIQUE(chrid, cell_line, start_value, end_value)"
            ");"
        )
        conn.commit()
        print("sequence table created successfully.")
    else:
        print("sequence table already exists, skipping creation.")
    
    if not table_exists(cur, "valid_regions"):
        print("Creating valid_regions table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS valid_regions ("
            "vrid serial PRIMARY KEY,"
            "chrid VARCHAR(50) NOT NULL,"
            "cell_line VARCHAR(50) NOT NULL,"
            "start_value BIGINT NOT NULL DEFAULT 0,"
            "end_value BIGINT NOT NULL DEFAULT 0,"
            "UNIQUE(chrid, cell_line, start_value, end_value)"
            ");"
        )
        conn.commit()
        print("valid_regions table created successfully.")
    else:
        print("valid_regions table already exists, skipping creation.")

    if not table_exists(cur, "position"):
        print("Creating position table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS position ("
            "pid serial PRIMARY KEY,"
            "cell_line VARCHAR(50) NOT NULL,"
            "chrid VARCHAR(50) NOT NULL,"
            "sampleid INT NOT NULL DEFAULT 0,"
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

    if not table_exists(cur, "distance"):
        print("Creating distance table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS distance ("
            "did Serial PRIMARY KEY,"
            "cell_line VARCHAR(50) NOT NULL,"
            "chrid VARCHAR(50) NOT NULL,"
            "sampleid INT NOT NULL DEFAULT 0,"
            "start_value BIGINT NOT NULL DEFAULT 0,"
            "end_value BIGINT NOT NULL DEFAULT 0,"
            "n_beads INT NOT NULL,"
            "distance_vector BYTEA NOT NULL,"
            "insert_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"
            "UNIQUE(cell_line, chrid, sampleid, start_value, end_value, n_beads)"
            ");"
        )
        conn.commit()
        print("distance table created successfully.")
    else:
        print("distance table already exists, skipping creation.")

    if not table_exists(cur, "calc_distance"):
        print("Creating calc_distance table...")
        cur.execute(
            "CREATE TABLE calc_distance ("
            "cdid           SERIAL PRIMARY KEY,"
            "cell_line      VARCHAR(50) NOT NULL,"
            "chrid          VARCHAR(50) NOT NULL,"
            "start_value    BIGINT NOT NULL,"
            "end_value      BIGINT NOT NULL,"
            "avg_distance_vector BYTEA NOT NULL,"
            "fq_distance_vector BYTEA NOT NULL,"
            "best_vector BYTEA NOT NULL,"
            "insert_time    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,"
            "UNIQUE(cell_line, chrid, start_value, end_value)"
            ");"
        )
        conn.commit()
        print("example table created successfully.")
    else:
        print("calc_distance table already exists, skipping creation.")

    # Close connection
    cur.close()
    conn.close()


def process_chromosome_data(cur, file_path):
    """Process and insert chromosome data from the specified file."""
    with open(file_path, "r") as f:
        data_to_insert = []
        query = "INSERT INTO chromosome (chrid, size) VALUES (%s, %s);"
        for line in f:
            # Split each line by tab and strip extra spaces/newlines
            data = line.strip().split("\t")
            data_to_insert.append((data[0], int(data[1])))

        cur.executemany(query, data_to_insert)


def process_gene_data(cur, file_path):
    """Process and insert gene data from the specified file."""
    gene_df = pd.read_csv(file_path, sep="\t")
    gene_df = gene_df[["Chromosome", "Begin", "End", "Orientation", "Symbol"]]

    query = """
    INSERT INTO gene (chromosome, start_location, end_location, orientation, symbol)
    VALUES (%s, %s, %s, %s, %s);
    """
    data_to_insert = gene_df[
        ["Chromosome", "Begin", "End", "Orientation", "Symbol"]
    ].values.tolist()

    cur.executemany(query, data_to_insert)


def process_non_random_hic_data(chromosome_dir):
    for file_name in os.listdir(chromosome_dir):
        if not file_name.endswith(".csv.gz"):
            continue

        file_path = os.path.join(chromosome_dir, file_name)
        print(f"Processing file: {file_name}")

        for chunk in pd.read_csv(
            file_path,
            usecols=["chr", "ibp", "jbp", "fq", "fdr", "rawc", "cell_line"],
            chunksize=100000,
            compression="gzip"
        ):
            chunk.rename(columns={"chr": "chrid"}, inplace=True)

            buffer = StringIO()
            chunk.to_csv(buffer, sep="\t", index=False, header=False)
            buffer.seek(0)

            conn = get_db_connection(database=DB_NAME)
            cur = conn.cursor()

            copy_sql = sql.SQL(
                "COPY {} ({}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t')"
            ).format(
                sql.Identifier("non_random_hic"),
                sql.SQL(", ").join([
                    sql.Identifier(col)
                    for col in ("chrid", "ibp", "jbp", "fq", "fdr", "rawc", "cell_line")
                ])
            )

            with cur.copy(copy_sql) as copy:
                data_str = buffer.getvalue()
                copy.write(data_str.encode("utf-8"))

            conn.commit()
            cur.close()
            conn.close()

            print(f"Inserted {len(chunk)} records from {file_name}.")


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
            df.columns = ["chrid", "start_value", "end_value", "name", "score", "strand", "signalValue", "pValue", "qValue", "peak"]

            df["cell_line"] = cell_line
            df["epigenetic"] = epigenetic
            
            df = df[["chrid", "cell_line", "epigenetic", "start_value", "end_value", "name", "score", "strand", "signalValue", "pValue", "qValue", "peak"]]

            query = """

            INSERT INTO epigenetic_track (chrid, cell_line, epigenetic, start_value, end_value, name, score, strand, signal_value, p_value, q_value, peak)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """

            data_to_insert = df.to_records(index=False).tolist()
            cur.executemany(query, data_to_insert)


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

            INSERT INTO sequence (chrid, cell_line, start_value, end_value)
            VALUES (%s, %s, %s, %s);
            """

            data_to_insert = df.to_records(index=False).tolist()
            cur.executemany(query, data_to_insert)


def process_valid_regions_data(cur):
    """Process and insert valid regions data from all CSV files in the specified folder."""
    folder_path = os.path.join(ROOT_DIR, "valid_regions")
    for filename in os.listdir(folder_path):
        # check if the file is a CSV.gz file
        if filename.endswith(".csv.gz"):
            file_path = os.path.join(folder_path, filename)

            df = pd.read_csv(
                file_path, usecols=["chrID", "cell_line", "start_value", "end_value"]
            )

            df = df[["chrID", "cell_line", "start_value", "end_value"]]

            query = """

            INSERT INTO valid_regions (chrid, cell_line, start_value, end_value)
            VALUES (%s, %s, %s, %s);
            """

            data_to_insert = df.to_records(index=False).tolist()
            cur.executemany(query, data_to_insert)


def process_non_random_hic_index(cur):
    """Create index on non_random_hic table for faster search."""
    print("Creating index idx_hic_search...")
    cur.execute(
        """
        CREATE INDEX idx_hic_search ON non_random_hic (chrid, cell_line, ibp, jbp);
        """
    )
    print("Index idx_hic_search created successfully.")


def process_position_index():
    """Create indexes on position table for faster search (if they don't exist)."""
    print("Creating index idx_position_search...")
    
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()
    cur.execute("""
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_position_search' 
        AND tablename = 'position';
    """)
    if cur.fetchone():
        print("Index idx_position_search already exists. Skipping creation.")
    else:
        cur.execute(
            "CREATE INDEX idx_position_search ON position (cell_line, chrid, start_value, end_value, sampleid);"
        )
        print("Index idx_position_search created successfully.")
    
    conn.commit()
    cur.close()
    conn.close()


def process_distance_index():
    """Create indexes on distance table for faster search (if they don't exist)."""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    cur.execute("""
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_distance_search' 
        AND tablename = 'distance';
    """)
    if cur.fetchone():
        print("Index idx_distance_search already exists. Skipping creation.")
    else:
        print("Creating index idx_distance_search...")
        cur.execute(
            "CREATE INDEX idx_distance_search ON distance (cell_line, chrid, start_value, end_value, sampleid);"
        )
        print("Index idx_distance_search created successfully.")
    
    conn.commit()
    cur.close()
    conn.close()


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
        file_path = os.path.join(ROOT_DIR, "gene_list.csv")
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
    else:
        print("Sequence data already exists, skipping insertion.")
    
    # Insert valid regions data only if the table is empty
    if not data_exists(cur, "valid_regions"):
        print("Inserting valid regions data...")
        process_valid_regions_data(cur)
        print("valid regions data inserted successfully.")
    else:
        print("valid regions data already exists, skipping insertion.")

    # Insert epigenetic track data only if the table is empty
    if not data_exists(cur, "epigenetic_track"):
        print("Inserting epigenetic track data...")
        process_epigenetic_track_data(cur)
        print("epigenetic track data inserted successfully.")
    else:
        print("epigenetic track data already exists, skipping insertion.")

    # Commit changes and close connection
    conn.commit()
    cur.close()
    conn.close()


def insert_non_random_HiC_data():
    """Insert non random HiC data into the database if not already present.(it is seperated from insert_data() to avoid long running transactions)"""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    # Insert non-random Hi-C data only if the table is empty
    if not data_exists(cur, "non_random_hic"):
        chromosome_dir = os.path.join(ROOT_DIR, "refined_processed_HiC")
        process_non_random_hic_data(chromosome_dir)
        conn.commit()
        process_non_random_hic_index(cur)
        conn.commit()
    else:
        print("Non-random Hi-C data already exists, skipping insertion.")
    
    cur.close()
    conn.close()


initialize_tables()
process_position_index()
process_distance_index()
insert_data()
insert_non_random_HiC_data()