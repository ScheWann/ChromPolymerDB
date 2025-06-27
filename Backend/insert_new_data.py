import os
import psycopg
from psycopg import sql
import pandas as pd
from io import StringIO

NEW_DATA_DIR = './new_cell_line'

DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")


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


def process_sequence_data(cur):
    """Process and insert sequence data from all CSV files in the specified folder."""
    folder_path = os.path.join(NEW_DATA_DIR, "seqs")
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
    folder_path = os.path.join(NEW_DATA_DIR, "valid_regions")
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