import os
import psycopg
from psycopg import sql
import pandas as pd
from io import StringIO
from cell_line_labels import label_mapping

NEW_DATA_DIR = './new_cell_line'

DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")


def get_cell_line_table_name(cell_line):
    """Get the table name for a given cell line"""
    return f"non_random_hic_{cell_line.replace('-', '_').replace('/', '_').replace(' ', '_')}".lower()


def table_exists(cur, table_name):
    """Check if a table exists in the database."""
    cur.execute(
        sql.SQL(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s);"
        ),
        [table_name],
    )
    return cur.fetchone()[0]


def create_cell_line_table(cur, cell_line):
    """Create a table for a specific cell line"""
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
        print(f"{table_name} table created successfully.")
        return True
    else:
        print(f"{table_name} table already exists.")
        return False


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
            compression="gzip"
        ):
            chunk.rename(columns={"chr": "chrid"}, inplace=True)
            
            # Group by cell line and insert into separate tables
            for cell_line, group in chunk.groupby('cell_line'):
                if cell_line not in label_mapping:
                    print(f"Warning: Cell line '{cell_line}' not found in label_mapping. Skipping.")
                    continue
                
                table_name = get_cell_line_table_name(cell_line)
                
                # Check if table exists and create if necessary
                conn = get_db_connection(database=DB_NAME)
                cur = conn.cursor()
                
                try:
                    # Check if table exists, create if it doesn't
                    table_created = create_cell_line_table(cur, cell_line)
                    if table_created:
                        conn.commit()
                    
                    # Remove cell_line column since it's redundant in separate tables
                    group_data = group[["chrid", "ibp", "jbp", "fq", "fdr", "rawc"]]

                    buffer = StringIO()
                    group_data.to_csv(buffer, sep="\t", index=False, header=False)
                    buffer.seek(0)

                    copy_sql = sql.SQL(
                        "COPY {} ({}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t')"
                    ).format(
                        sql.Identifier(table_name),
                        sql.SQL(", ").join([
                            sql.Identifier(col)
                            for col in ("chrid", "ibp", "jbp", "fq", "fdr", "rawc")
                        ])
                    )

                    with cur.copy(copy_sql) as copy:
                        data_str = buffer.getvalue()
                        copy.write(data_str.encode("utf-8"))

                    conn.commit()
                    print(f"Inserted {len(group_data)} records into {table_name} from {file_name}.")
                    
                except Exception as e:
                    print(f"Error processing data for {table_name}: {e}")
                    conn.rollback()
                finally:
                    cur.close()
                    conn.close()


# def process_sequence_data(cur):
#     """Process and insert sequence data from all CSV files in the specified folder."""
#     folder_path = os.path.join(NEW_DATA_DIR, "seqs")
#     for filename in os.listdir(folder_path):
#         # check if the file is a CSV.gz file
#         if filename.endswith(".csv.gz"):
#             file_path = os.path.join(folder_path, filename)

#             df = pd.read_csv(
#                 file_path, usecols=["chrID", "cell_line", "start_value", "end_value"]
#             )

#             df = df[["chrID", "cell_line", "start_value", "end_value"]]

#             query = """

#             INSERT INTO sequence (chrid, cell_line, start_value, end_value)
#             VALUES (%s, %s, %s, %s);
#             """

#             data_to_insert = df.to_records(index=False).tolist()
#             cur.executemany(query, data_to_insert)


def process_valid_regions_data(cur):
    """Process and insert valid regions data from all CSV files in the specified folder."""
    folder_path = os.path.join(NEW_DATA_DIR, "valid_regions")
    for filename in os.listdir(folder_path):
        # check if the file is a CSV.gz file
        if filename.endswith(".csv.gz"):
            file_path = os.path.join(folder_path, filename)
            try:
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

                print(f"{filename}, inserted {len(df)} records")
            except Exception as e:
                print(f"file {filename} error: {e}")


def insert_new_cell_line():
    """Insert non random HiC data into the database if not already present.(it is seperated from insert_data() to avoid long running transactions)"""
    conn = get_db_connection(database=DB_NAME)
    cur = conn.cursor()

    # Insert non-random Hi-C data only if the table is empty
    chromosome_dir = os.path.join(NEW_DATA_DIR, "refined_processed_HiC")
    process_non_random_hic_data(chromosome_dir)
    conn.commit()
    print("New cell line Non-random Hi-C data inserted successfully.")
    
    # Process sequence data
    # process_sequence_data(cur)
    # conn.commit()
    # print("New cell line sequence data inserted successfully.")
    
    # Process valid regions data
    process_valid_regions_data(cur)
    conn.commit()
    print("New cell line valid regions data inserted successfully.")
    
    cur.close()
    conn.close()


insert_new_cell_line()