import os
import glob
from io import StringIO
import psycopg
from psycopg import sql
import pandas as pd
from dotenv import load_dotenv
from cell_line_labels import label_mapping


load_dotenv()

DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")

ROOT_DIR = "../Data"


def get_db_connection(database=None):
    try:
        conn = psycopg.connect(
            host=DB_HOST, user=DB_USERNAME, password=DB_PASSWORD, dbname=database
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


def get_cell_line_table_name(cell_line):
    """Get the table name for a given cell line"""
    return f"non_random_hic_{cell_line.replace('-', '_').replace('/', '_').replace(' ', '_')}".lower()


def create_cell_line_tables():
    """Create separate non_random_hic tables for each cell line"""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    for cell_line in label_mapping.keys():
        table_name = get_cell_line_table_name(cell_line)

        if not table_exists(cur, table_name):
            print(f"Creating {table_name} table...")
            # Create safe constraint name
            constraint_name = f"fk_{table_name}_chrid"
            cur.execute(
                f"CREATE TABLE IF NOT EXISTS {table_name} ("
                "hid serial PRIMARY KEY,"
                "chrid VARCHAR(50) NOT NULL,"
                "ibp BIGINT NOT NULL DEFAULT 0,"
                "jbp BIGINT NOT NULL DEFAULT 0,"
                "fq FLOAT NOT NULL DEFAULT 0.0,"
                "fdr FLOAT NOT NULL DEFAULT 0.0,"
                "rawc FLOAT NOT NULL DEFAULT 0.0,"
                f"CONSTRAINT {constraint_name} FOREIGN KEY (chrid) REFERENCES chromosome(chrid) ON DELETE CASCADE ON UPDATE CASCADE"
                ");"
            )
            conn.commit()
            print(f"{table_name} table created successfully.")
        else:
            print(f"{table_name} table already exists, skipping creation.")

    cur.close()
    conn.close()


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

    if not table_exists(cur, "bintu"):
        print("Creating bintu table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS bintu ("
            "bid serial PRIMARY KEY,"
            "cell_line VARCHAR(50) NOT NULL,"
            "chrid VARCHAR(50) NOT NULL,"
            "start_value BIGINT NOT NULL DEFAULT 0,"
            "end_value BIGINT NOT NULL DEFAULT 0,"
            "cell_id INT NOT NULL,"
            "segment_index INT NOT NULL DEFAULT 0,"
            "Z FLOAT DEFAULT NULL,"
            "Y FLOAT DEFAULT NULL,"
            "X FLOAT DEFAULT NULL,"
            "UNIQUE(cell_id, segment_index)"
            ");"
        )
        conn.commit()
        print("bintu table created successfully.")
    else:
        print("bintu table already exists, skipping creation.")

    # Create separate tables for each cell line
    create_cell_line_tables()

    # if not table_exists(cur, "epigenetic_track"):
    #     print("Creating epigenetic_track table...")
    #     cur.execute(
    #         "CREATE TABLE IF NOT EXISTS epigenetic_track ("
    #         "etid serial PRIMARY KEY,"
    #         "chrid VARCHAR(50) NOT NULL,"
    #         "cell_line VARCHAR(50) NOT NULL,"
    #         "epigenetic VARCHAR(50) NOT NULL,"
    #         "start_value BIGINT NOT NULL DEFAULT 0,"
    #         "end_value BIGINT NOT NULL DEFAULT 0,"
    #         "name VARCHAR(50) NOT NULL,"
    #         "score INT NOT NULL DEFAULT 0,"
    #         "strand VARCHAR(1) NOT NULL,"
    #         "signal_value FLOAT NOT NULL DEFAULT 0.0,"
    #         "p_value FLOAT NOT NULL DEFAULT 0.0,"
    #         "q_value FLOAT NOT NULL DEFAULT 0.0,"
    #         "peak BIGINT NOT NULL DEFAULT 0"
    #         ");"
    #     )
    #     conn.commit()
    #     print("epigenetic_track table created successfully.")
    # else:
    #     print("epigenetic_track table already exists, skipping creation.")

    # if not table_exists(cur, "sequence"):
    #     print("Creating sequence table...")
    #     cur.execute(
    #         "CREATE TABLE IF NOT EXISTS sequence ("
    #         "sid serial PRIMARY KEY,"
    #         "chrid VARCHAR(50) NOT NULL,"
    #         "cell_line VARCHAR(50) NOT NULL,"
    #         "start_value BIGINT NOT NULL DEFAULT 0,"
    #         "end_value BIGINT NOT NULL DEFAULT 0,"
    #         "UNIQUE(chrid, cell_line, start_value, end_value)"
    #         ");"
    #     )
    #     conn.commit()
    #     print("sequence table created successfully.")
    # else:
    #     print("sequence table already exists, skipping creation.")

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
            "best_sample_id INT NOT NULL DEFAULT 0,"
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

    if not table_exists(cur, "gse"):
        print("Creating gse table...")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS gse ("
            "gseid serial PRIMARY KEY,"
            "cell_line VARCHAR(50) NOT NULL,"
            "cell_id VARCHAR(50) NOT NULL,"
            "chrid VARCHAR(50) NOT NULL,"
            "resolution INT NOT NULL,"
            "ibp BIGINT NOT NULL DEFAULT 0,"
            "jbp BIGINT NOT NULL DEFAULT 0,"
            "fq FLOAT NOT NULL DEFAULT 0.0"
            ");"
        )
        conn.commit()
        print("gse table created successfully.")
    else:
        print("gse table already exists, skipping creation.")

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
    """Process and insert data into separate cell line tables"""
    for file_name in os.listdir(chromosome_dir):
        if not file_name.endswith(".csv.gz"):
            continue

        file_path = os.path.join(chromosome_dir, file_name)
        print(f"Processing file: {file_name}")

        for chunk in pd.read_csv(
            file_path,
            usecols=["chr", "ibp", "jbp", "fq", "fdr", "rawc", "cell_line"],
            chunksize=100000,
            compression="gzip",
        ):
            chunk.rename(columns={"chr": "chrid"}, inplace=True)

            # Group by cell line and insert into separate tables
            for cell_line, group in chunk.groupby("cell_line"):
                if cell_line not in label_mapping:
                    print(
                        f"Warning: Cell line '{cell_line}' not found in label_mapping. Skipping."
                    )
                    continue

                table_name = get_cell_line_table_name(cell_line)

                # Remove cell_line column since it's redundant in separate tables
                group_data = group[["chrid", "ibp", "jbp", "fq", "fdr", "rawc"]]

                buffer = StringIO()
                group_data.to_csv(buffer, sep="\t", index=False, header=False)
                buffer.seek(0)

                conn = get_db_connection(database=DB_NAME)
                cur = conn.cursor()

                copy_sql = sql.SQL(
                    "COPY {} ({}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t')"
                ).format(
                    sql.Identifier(table_name),
                    sql.SQL(", ").join(
                        [
                            sql.Identifier(col)
                            for col in ("chrid", "ibp", "jbp", "fq", "fdr", "rawc")
                        ]
                    ),
                )

                try:
                    with cur.copy(copy_sql) as copy:
                        data_str = buffer.getvalue()
                        copy.write(data_str.encode("utf-8"))

                    conn.commit()
                    print(
                        f"Inserted {len(group_data)} records into {table_name} from {file_name}."
                    )
                except Exception as e:
                    print(f"Error inserting data into {table_name}: {e}")
                    conn.rollback()
                finally:
                    cur.close()
                    conn.close()


# def process_epigenetic_track_data(cur):
#     """Process and insert epigenetic track data from all bed.gz files in the specified folder."""
#     folder_path = os.path.join(ROOT_DIR, "epigenetic_tracks")
#     for filename in os.listdir(folder_path):
#         # check if the file is a bed.gz file
#         if filename.endswith(".bed.gz"):
#             file_path = os.path.join(folder_path, filename)

#             parts = filename.replace(".bed.gz", "").split("_")
#             cell_line = parts[0]
#             epigenetic = parts[1]

#             df = pd.read_csv(file_path, sep="\t", header=None)
#             df.columns = ["chrid", "start_value", "end_value", "name", "score", "strand", "signalValue", "pValue", "qValue", "peak"]

#             df["cell_line"] = cell_line
#             df["epigenetic"] = epigenetic

#             df = df[["chrid", "cell_line", "epigenetic", "start_value", "end_value", "name", "score", "strand", "signalValue", "pValue", "qValue", "peak"]]

#             query = """

#             INSERT INTO epigenetic_track (chrid, cell_line, epigenetic, start_value, end_value, name, score, strand, signal_value, p_value, q_value, peak)
#             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
#             """

#             data_to_insert = df.to_records(index=False).tolist()
#             cur.executemany(query, data_to_insert)


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
            try:
                df = pd.read_csv(
                    file_path,
                    usecols=["chrID", "cell_line", "start_value", "end_value"],
                )

                df = df[["chrID", "cell_line", "start_value", "end_value"]]

                query = """
                    INSERT INTO valid_regions (chrid, cell_line, start_value, end_value)
                    VALUES (%s, %s, %s, %s);
                """

                data_to_insert = df.to_records(index=False).tolist()
                cur.executemany(query, data_to_insert)

                print(f"{filename}, inserted {len(df)} records")
            except Exception as e:
                print(f"file {filename} error: {e}")


def process_bintu_data(cur):
    """Process and insert Bintu data from all CSV files in the Bintu folder."""
    folder_path = os.path.join(ROOT_DIR, "Bintu")

    for filename in os.listdir(folder_path):
        if filename.endswith(".csv"):
            file_path = os.path.join(folder_path, filename)

            try:
                # Parse filename to extract metadata
                # Format: {cell_line}_chr{chrid}-{start}-{end}Mb.csv or similar
                base_name = filename.replace(".csv", "")
                print(f"Processing file: {filename}")

                # Handle special cases like HCT116_chr21-28-30Mb_untreated.csv
                if "_untreated" in base_name:
                    base_name = base_name.replace("_untreated", "")

                parts = base_name.split("_")
                cell_line = parts[0]

                chr_pos_part = parts[1]

                chr_parts = chr_pos_part.split("-")
                chrid = chr_parts[0]

                # Extract start and end values (in Mb, need to convert to bp)
                # Handle decimal values like 18.6Mb
                # e.g., 28 or 18.6
                start_mb = float(chr_parts[1])
                end_mb = float(chr_parts[2].replace("Mb", ""))

                start_value = int(start_mb * 1000000)
                end_value = int(end_mb * 1000000)

                print(
                    f"Parsed: cell_line={cell_line}, chrid={chrid}, start={start_value}, end={end_value}"
                )

                df = pd.read_csv(file_path, skiprows=1)

                df = df.rename(
                    columns={
                        "Chromosome index": "cell_id",
                        "Segment index": "segment_index",
                        "Z": "Z",
                        "X": "Y",
                        "Y": "X",
                    }
                )

                df["cell_line"] = cell_line
                df["chrid"] = chrid
                df["start_value"] = start_value
                df["end_value"] = end_value

                for col in ["Z", "Y", "X"]:
                    df[col] = df[col].where(pd.notna(df[col]), None)

                # Prepare data for insertion
                df = df[
                    [
                        "cell_line",
                        "chrid",
                        "start_value",
                        "end_value",
                        "cell_id",
                        "segment_index",
                        "Z",
                        "Y",
                        "X",
                    ]
                ]

                query = """
                    INSERT INTO bintu (cell_line, chrid, start_value, end_value, cell_id, segment_index, Z, Y, X)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (cell_line, chrid, start_value, end_value, cell_id, segment_index) DO NOTHING;
                """

                data_to_insert = df.to_records(index=False).tolist()
                cur.executemany(query, data_to_insert)

                print(
                    f"{filename}: inserted {len(df)} records for {cell_line} {chrid} ({start_mb}-{end_mb}Mb)"
                )

            except Exception as e:
                print(f"Error processing file {filename}: {e}")


def process_gse_data(cur):
    """Process CSV files from GM12878_dipc and K562_limca folders with resolution subdirectories and insert into GSE table"""
    gse_dir = "GSE"

    # Define the folders and their corresponding cell_lines
    folders = {"GM12878_dipc": "GM12878_dipc", "K562_limca": "K562_limca"}

    # Define resolution mapping from folder name to integer value
    resolution_mapping = {"5k": 5000, "50k": 50000, "100k": 100000}

    total_inserted = 0

    for folder_name, cell_line in folders.items():
        folder_path = os.path.join(gse_dir, folder_name)

        if not os.path.exists(folder_path):
            print(f"Warning: Folder {folder_path} does not exist.")
            continue

        print(f"Processing folder: {folder_path}")

        # Check for resolution subdirectories
        subdirs = [
            d
            for d in os.listdir(folder_path)
            if os.path.isdir(os.path.join(folder_path, d))
        ]

        for resolution_dir in subdirs:
            if resolution_dir not in resolution_mapping:
                print(
                    f"Warning: Unknown resolution directory {resolution_dir}. Skipping."
                )
                continue

            resolution_value = resolution_mapping[resolution_dir]
            resolution_path = os.path.join(folder_path, resolution_dir)

            print(
                f"Processing resolution directory: {resolution_dir} (value: {resolution_value})"
            )

            # Get all CSV files in the resolution directory
            csv_files = [f for f in os.listdir(resolution_path) if f.endswith(".csv")]

            for csv_file in csv_files:
                csv_path = os.path.join(resolution_path, csv_file)
                # Extract cell_id from filename (remove .csv extension)
                cell_id = csv_file[:-4]

                print(
                    f"Processing file: {csv_file} (cell_line: {cell_line}, cell_id: {cell_id}, resolution: {resolution_value})"
                )

                try:
                    df = pd.read_csv(csv_path)

                    # Check if required columns exist
                    required_columns = ["chr", "ibp", "jbp", "fq"]
                    if not all(col in df.columns for col in required_columns):
                        print(
                            f"Warning: File {csv_file} missing required columns. Expected: {required_columns}"
                        )
                        continue

                    # Prepare data for insertion
                    insert_data = []
                    for _, row in df.iterrows():
                        insert_data.append(
                            (
                                cell_line,
                                cell_id,
                                row["chr"],
                                resolution_value,
                                int(row["ibp"]),
                                int(row["jbp"]),
                                float(row["fq"]),
                            )
                        )

                    # Batch insert data
                    if insert_data:
                        cur.executemany(
                            "INSERT INTO gse (cell_line, cell_id, chrid, resolution, ibp, jbp, fq) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                            insert_data,
                        )

                        rows_inserted = len(insert_data)
                        total_inserted += rows_inserted
                        print(f"Inserted {rows_inserted} rows from {csv_file}")

                except Exception as e:
                    print(f"Error processing file {csv_file}: {e}")
                    continue

    print(f"GSE data processing completed. Total rows inserted: {total_inserted}")


def insert_bintu_data_only():
    """Standalone function to insert only Bintu data - useful for testing."""
    conn = get_db_connection(database=DB_NAME)
    if conn is None:
        print("Failed to connect to database")
        return

    cur = conn.cursor()

    # Insert Bintu data
    if not data_exists(cur, "bintu"):
        print("Inserting Bintu data...")
        process_bintu_data(cur)
        conn.commit()
        print("Bintu data inserted successfully.")
    else:
        print("Bintu data already exists, skipping insertion.")

    cur.close()
    conn.close()


def insert_gse_data_only():
    """Standalone function to insert only GSE data - useful for testing."""
    conn = get_db_connection(database=DB_NAME)
    if conn is None:
        print("Failed to connect to database")
        return

    cur = conn.cursor()

    # Insert GSE data
    if not data_exists(cur, "gse"):
        print("Inserting GSE data...")
        process_gse_data(cur)
        conn.commit()
        print("GSE data inserted successfully.")
    else:
        print("GSE data already exists, skipping insertion.")

    cur.close()
    conn.close()


def process_non_random_hic_index():
    """Create indexes on all cell line tables for faster search."""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    for cell_line in label_mapping.keys():
        table_name = get_cell_line_table_name(cell_line)
        index_name = f"idx_{table_name}_search"

        # Check if index already exists
        cur.execute(
            """
            SELECT 1 
            FROM pg_indexes 
            WHERE indexname = %s 
            AND tablename = %s;
        """,
            [index_name, table_name],
        )

        if cur.fetchone():
            print(f"Index {index_name} already exists. Skipping creation.")
        else:
            print(f"Creating index {index_name}...")
            try:
                cur.execute(
                    f"CREATE INDEX {index_name} ON {table_name} (chrid, ibp, jbp);"
                )
                conn.commit()
                print(f"Index {index_name} created successfully.")
            except Exception as e:
                print(f"Error creating index {index_name}: {e}")
                conn.rollback()

    cur.close()
    conn.close()


def process_position_index():
    """Create indexes on position table for faster search (if they don't exist)."""
    print("Creating index idx_position_search...")

    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_position_search' 
        AND tablename = 'position';
    """
    )
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

    cur.execute(
        """
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_distance_search' 
        AND tablename = 'distance';
    """
    )
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


def process_gse_index():
    """Create indexes on gse table for faster search (if they don't exist)."""
    print("Creating index idx_gse_search...")

    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_gse_search' 
        AND tablename = 'gse';
    """
    )
    if cur.fetchone():
        print("Index idx_gse_search already exists. Skipping creation.")
    else:
        cur.execute(
            "CREATE INDEX idx_gse_search ON gse (cell_line, resolution, cell_id, chrid);"
        )
        print("Index idx_gse_search created successfully.")

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
    # if not data_exists(cur, "sequence"):
    #     print("Inserting sequence data...")
    #     process_sequence_data(cur)
    #     print("Sequence data inserted successfully.")
    # else:
    #     print("Sequence data already exists, skipping insertion.")

    # Insert valid regions data only if the table is empty
    if not data_exists(cur, "valid_regions"):
        print("Inserting valid regions data...")
        process_valid_regions_data(cur)
        print("valid regions data inserted successfully.")
    else:
        print("valid regions data already exists, skipping insertion.")

    # Insert Bintu data only if the table is empty
    if not data_exists(cur, "bintu"):
        print("Inserting Bintu data...")
        process_bintu_data(cur)
        print("Bintu data inserted successfully.")
    else:
        print("Bintu data already exists, skipping insertion.")

    # Insert GSE data only if the table is empty
    if not data_exists(cur, "gse"):
        print("Inserting GSE data...")
        process_gse_data(cur)
        print("GSE data inserted successfully.")
    else:
        print("GSE data already exists, skipping insertion.")

    # Insert epigenetic track data only if the table is empty
    # if not data_exists(cur, "epigenetic_track"):
    #     print("Inserting epigenetic track data...")
    #     process_epigenetic_track_data(cur)
    #     print("epigenetic track data inserted successfully.")
    # else:
    #     print("epigenetic track data already exists, skipping insertion.")

    # Commit changes and close connection
    conn.commit()
    cur.close()
    conn.close()


def check_cell_line_tables_have_data():
    """Check if any of the cell line tables have data."""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    for cell_line in label_mapping.keys():
        table_name = get_cell_line_table_name(cell_line)
        if table_exists(cur, table_name) and data_exists(cur, table_name):
            cur.close()
            conn.close()
            return True

    cur.close()
    conn.close()
    return False


def insert_non_random_HiC_data():
    """Insert non random HiC data into the database if not already present.(it is separated from insert_data() to avoid long running transactions)"""

    # Check if any cell line table has data
    if check_cell_line_tables_have_data():
        print(
            "Non-random Hi-C data already exists in cell line tables, skipping insertion."
        )
        return

    chromosome_dir = os.path.join(ROOT_DIR, "refined_processed_HiC")
    process_non_random_hic_data(chromosome_dir)
    process_non_random_hic_index()


initialize_tables()
process_position_index()
process_distance_index()
process_gse_index()
insert_data()
insert_non_random_HiC_data()
