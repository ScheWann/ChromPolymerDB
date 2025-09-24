from flask import send_file
import numpy as np
from scipy.sparse import csr_matrix, save_npz
from contextlib import contextmanager
import pandas as pd
import os
import re
import tempfile
import subprocess
import redis
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from itertools import combinations
import math
import json
from scipy.spatial.distance import squareform, pdist
from dotenv import load_dotenv
from time import time
import pyarrow.feather as feather
from concurrent.futures import ThreadPoolExecutor
from cell_line_labels import label_mapping
from scipy.stats import ttest_ind
import glob


load_dotenv()


# postgres database connection settings
DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT")

# redis connection settings
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB   = int(os.getenv("REDIS_DB", 0))

# Create a connection pool for the PostgreSQL database
conn_pool = ConnectionPool(
    conninfo=f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} user={DB_USERNAME} password={DB_PASSWORD}",
    min_size=5,
    max_size=50,
    max_waiting=20,
)

# Create a Redis connection pool
redis_pool = redis.ConnectionPool(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
redis_client = redis.Redis(connection_pool=redis_pool)

"""
Read feather file using pandas
"""
def read_feather_pa(path):
    return feather.read_table(path, memory_map=True).to_pandas()


"""
Establish redis cache key
"""
def make_redis_cache_key(cell_line, chromosome_name, start, end, custom_name):
    """
    e.g: "chr8:IMR:127300000:128300000:"
    """
    return f"{cell_line}:{chromosome_name}:{start}:{end}:{custom_name}"


"""
Get the table name for a given cell line
"""
def get_cell_line_table_name(cell_line):
    return f"non_random_hic_{cell_line.replace('-', '_').replace('/', '_').replace(' ', '_')}".lower()


"""
Establish a connection pool to the database.
"""
@contextmanager
def db_conn():
    with conn_pool.connection() as conn:
        yield conn


"""
Return the list of genes
"""
def gene_names_list():
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT symbol
                FROM gene
            """
            )
            rows = cur.fetchall()
    options = [{"value": row["symbol"], "label": row["symbol"]} for row in rows]

    return options


"""
Return the gene name list in searching specific letters
"""
def gene_names_list_search(search):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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

    return options


"""
Returns the list of cell line
"""
def cell_lines_list():
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT DISTINCT cell_line
                FROM valid_regions
            """)
            rows = cur.fetchall()

    options = [
        {
            "value": row["cell_line"],
            "label": label_mapping.get(row["cell_line"], "Unknown"),
        }
        for row in rows
    ]

    return options


"""
Returns the list of chromosomes in the cell line
"""
def chromosomes_list(cell_line):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT chrid
                FROM valid_regions
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

    return sorted_chromosomes_list


"""
Return the chromosome size in the given chromosome name
"""
def chromosome_size(chromosome_name):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT size
                FROM chromosome
                WHERE chrid = %s
            """,
                (chromosome_name,),
            )

            size = cur.fetchone()["size"]

    return size


"""
Returns the all valid original sequences of the chromosome data in the given cell line, chromosome name
"""
def chromosome_original_valid_sequences(cell_line, chromosome_name):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT start_value, end_value
                FROM valid_regions
                WHERE cell_line = %s
                AND chrid = %s
                ORDER BY start_value
            """,
                (cell_line, chromosome_name),
            )
            original_sequences = cur.fetchall()

    formatted_sequences = [
        {"start": row["start_value"], "end": row["end_value"]}
        for row in original_sequences
    ]

    return formatted_sequences


"""
Returns the all valid merged sequences of the chromosome data in the given cell line, chromosome name
"""
def chromosome_merged_valid_sequences(cell_line, chromosome_name):
    def merge_intervals(intervals):
        if not intervals:
            return []

        intervals.sort(key=lambda x: x["start_value"])

        merged = []
        current_start = intervals[0]["start_value"]
        current_end = intervals[0]["end_value"]

        for interval in intervals[1:]:
            start = interval["start_value"]
            end = interval["end_value"]

            if start <= current_end:
                current_end = max(current_end, end)
            else:
                merged.append({"start": current_start, "end": current_end})
                current_start = start
                current_end = end

        merged.append({"start": current_start, "end": current_end})
        return merged

    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT start_value, end_value
                FROM valid_regions
                WHERE cell_line = %s
                AND chrid = %s
                ORDER BY start_value
                """,
                (cell_line, chromosome_name),
            )
            valid_regions = cur.fetchall()

            merged_valid_regions = merge_intervals(valid_regions)
    
    return merged_valid_regions


"""
Return the chromosome size in the given gene name
"""
def chromosome_size_by_gene_name(gene_name):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                    SELECT chromosome, orientation, start_location, end_location
                    FROM gene
                    WHERE symbol = %s
                    AND CAST(chromosome AS integer) >= %s
                    AND CAST(chromosome AS integer) <= %s
                """,
                (gene_name, '1', '22'),
            )

            gene = cur.fetchone()

    return gene


"""
Returns the existing chromosome data in the given cell line, chromosome name, start, end
"""
def chromosome_data(cell_line, chromosome_name, sequences):
    if cell_line not in label_mapping:
        raise ValueError(f"Cell line '{cell_line}' not found in label_mapping")
    
    table_name = get_cell_line_table_name(cell_line)
    
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT %s as cell_line, chrid, fdr, ibp, jbp, fq, rawc
                FROM {table_name}
                WHERE chrid = %s
                AND ibp >= %s
                AND ibp <= %s
                AND jbp >= %s
                AND jbp <= %s
            """,
                (
                    cell_line,
                    chromosome_name,
                    sequences["start"],
                    sequences["end"],
                    sequences["start"],
                    sequences["end"],
                ),
            )
            chromosome_sequence = cur.fetchall()

    return chromosome_sequence


"""
Returns the existing chromosome data in the given cell line, chromosome name, start, end
"""
def chromosome_valid_ibp_data(cell_line, chromosome_name, sequences):
    if cell_line not in label_mapping:
        raise ValueError(f"Cell line '{cell_line}' not found in label_mapping")
    
    table_name = get_cell_line_table_name(cell_line)
    
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                    SELECT DISTINCT ibp
                    FROM {table_name}
                    WHERE chrid = %s
                    AND ibp >= %s
                    AND ibp <= %s
                    AND jbp >= %s
                    AND jbp <= %s
                """,
                (
                    chromosome_name,
                    sequences["start"],
                    sequences["end"],
                    sequences["start"],
                    sequences["end"],
                ),
            )
            chromosome_valid_ibps = cur.fetchall()

    ibp_values = [ibp["ibp"] for ibp in chromosome_valid_ibps]

    return ibp_values


"""
Returns the existing 3D chromosome data in the given cell line, chromosome name, start, end(IMR-chr8-127300000-128300000)
"""
def exist_chromosome_3D_data(cell_line, sample_id, sequences, chromosome_name="chr8"):
    # Dynamic sample ID mapping based on unique example data set identifiers
    # This will eventually be replaced by a database lookup or configuration
    example_data_set = {
        "GM12878-chr8-127300000-128300000": 4229,
        "IMR90-chr8-127300000-128300000": 1201,
        # "NHEK-chr8-127300000-128300000": 4225,
        "Calu3-chr8-127200000-127750000": 1422,
        "GM12878-chr8-127200000-127750000": 4193,
        "monocytes-chr8-127200000-127750000": 2805
    }
    
    # Keep the original sample_id for progress key
    original_sample_id = sample_id
    
    # Create the example data key for this specific cell line and sequence
    example_key = f"{cell_line}-{chromosome_name}-{sequences['start']}-{sequences['end']}"
    
    # Use mapped sample_id if sample_id is 0, otherwise keep the passed sample_id
    if sample_id == 0 and example_key in example_data_set:
        sample_id = example_data_set[example_key]
    
    # Establish the progress key for tracking whole progress (use original sample_id)
    progress_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"exist_{original_sample_id}_progress")
    redis_client.setex(progress_key, 3600, 0)

    def checking_existing_data(cell_line, sample_id):
        redis_3d_position_data_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"3d_example_{sample_id}_position_data")
        redis_sample_distance_vector_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{sample_id}_example_distance_vector")

        cached_3d_example_position_data = redis_client.get(redis_3d_position_data_key)
        cached_example_sample_distance_vector = redis_client.get(redis_sample_distance_vector_key)

        return cached_3d_example_position_data, cached_example_sample_distance_vector
    
    def get_position_data(cell_line, sid):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"3d_example_{sid}_position_data")
        records = position_df[position_df['sampleid'] == sid].to_dict(orient='records')
        
        data_json = json.dumps(records, ensure_ascii=False, default=str)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))
        
        return records
    
    def get_fq_data(cell_line):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "fq_example_data")
        full_distance_matrix = np.load(f"./example_data/{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_fq_matrix.npy")
        
        data_json = json.dumps(full_distance_matrix.tolist(), ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))
        
        return full_distance_matrix.tolist()

    def get_avg_distance_data(cell_line):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "avg_distance_example_data")

        if redis_client.get(cache_key):
            return json.loads(redis_client.get(cache_key).decode("utf-8"))
        else:
            full_distance_matrix = np.load(f"./example_data/{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_avg_distance_matrix.npy")
            
            data_json = json.dumps(full_distance_matrix.tolist(), ensure_ascii=False)
            redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))

            return full_distance_matrix.tolist()

    def get_distance_vector_by_sample(cell_line, sid):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{sid}_example_distance_vector")
        
        if redis_client.get(cache_key):
            vec = json.loads(redis_client.get(cache_key).decode("utf-8"))
            return vec
        else:
            vec = np.array(distance_df['distance_vector'].iloc[sid], dtype=float)
            mat = squareform(vec).tolist()

            data_json = json.dumps(mat, ensure_ascii=False)
            redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))

            return mat
    
    cached_3d_example_position_data, cached_example_sample_distance_vector = checking_existing_data(cell_line, sample_id)
    redis_client.setex(progress_key, 3600, 15)
    if cached_3d_example_position_data and cached_example_sample_distance_vector is not None:
        position_data = json.loads(cached_3d_example_position_data.decode("utf-8"))
        sample_distance_vector = json.loads(cached_example_sample_distance_vector.decode("utf-8"))
        redis_client.setex(progress_key, 3600, 80)
        avg_distance_matrix = get_avg_distance_data(cell_line)
        fq_data = get_fq_data(cell_line)
        redis_client.setex(progress_key, 3600, 99)

        return {
            "position_data": position_data,
            "avg_distance_data": avg_distance_matrix,
            "fq_data": fq_data,
            "sample_distance_vector": sample_distance_vector
        }
    else:
        pos_path = f"./example_data/{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_original_position.feather"
        dist_path = f"./example_data/{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_original_distance.feather"

        with ThreadPoolExecutor(max_workers=10) as pool:
            fut_pos  = pool.submit(read_feather_pa, pos_path)
            fut_dist = pool.submit(read_feather_pa, dist_path)

        position_df = fut_pos.result()
        distance_df = fut_dist.result()
        
        redis_client.setex(progress_key, 3600, 20)

        position_data = get_position_data(cell_line, sample_id)
        redis_client.setex(progress_key, 3600, 50)

        avg_distance_matrix = get_avg_distance_data(cell_line)
        redis_client.setex(progress_key, 3600, 70)
        
        fq_data = get_fq_data(cell_line)
        sample_distance_vector = get_distance_vector_by_sample(cell_line, sample_id)
        redis_client.setex(progress_key, 3600, 99)

        return {
                "position_data": position_data,
                "avg_distance_data": avg_distance_matrix,
                "fq_data": fq_data,
                "sample_distance_vector": sample_distance_vector
            }


"""
Returns the example 3D chromosome data in the given cell line, chromosome name, start, end
"""
def chromosome_3D_data(cell_line, chromosome_name, sequences, sample_id):
    temp_folding_input_path = "./Folding_input"
    
    # Establish the progress key for tracking whole progress
    progress_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{sample_id}_progress")
    redis_client.setex(progress_key, 3600, 0)

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

    # Check if the data already exists in the redis cache
    def checking_existing_cache_data(chromosome_name, cell_line, sequences, sample_id):
        redis_3d_position_data_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"3d_{sample_id}_position_data")
        if sample_id == 0:
            redis_sample_distance_vector_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "best_corr_data")
        else:
            redis_sample_distance_vector_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{sample_id}_distance_vector")
        
        cached_3d_position_data = redis_client.get(redis_3d_position_data_key)
        cached_sample_distance_vector = redis_client.get(redis_sample_distance_vector_key)

        return cached_3d_position_data, cached_sample_distance_vector

    # Check if the data already exists in the database
    def checking_existing_data(chromosome_name, cell_line, sequences):
        sql = """
            SELECT
                EXISTS(
                    SELECT 1 FROM position
                    WHERE chrid     = %s
                    AND cell_line   = %s
                    AND start_value = %s
                    AND end_value   = %s
                ) AS position_exists,
                EXISTS(
                    SELECT 1 FROM distance
                    WHERE cell_line = %s
                    AND chrid       = %s
                    AND start_value = %s
                    AND end_value   = %s
                ) AS distance_exists;
        """
        params = (
            chromosome_name, cell_line, sequences["start"], sequences["end"],
            cell_line, chromosome_name, sequences["start"], sequences["end"],
        )

        with db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                pos_exists, dist_exists = cur.fetchone()

        return {
            "position_exists": bool(pos_exists),
            "distance_exists": bool(dist_exists)
        }

    def get_position_data(chromosome_name, cell_line, sequences, sample_id):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"3d_{sample_id}_position_data")

        with db_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                        SELECT *
                        FROM position
                        WHERE chrid = %s
                        AND cell_line = %s
                        AND start_value = %s
                        AND end_value = %s
                        AND sampleid = %s
                        ORDER BY pid
                    """,
                    (chromosome_name, cell_line, sequences["start"], sequences["end"], sample_id),
                )
                data = cur.fetchall()

        position_json = json.dumps(data, ensure_ascii=False, default=str)
        redis_client.setex(cache_key, 3600, position_json.encode("utf-8"))
        
        return data

    # get the average distance data and frequency data of 5000 chain samples
    def get_avg_fq_best_corr_data(cell_line, chromosome_name, sequences):
        cache_avg_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "avg_distance_data")
        cache_fq_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "fq_data")
        cache_best_corr_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "best_corr_data")
        cache_best_sample_id_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "best_sample_id")

        if redis_client.get(cache_avg_key) and redis_client.get(cache_fq_key):
            avg_distance_data = json.loads(redis_client.get(cache_avg_key).decode("utf-8"))
            fq_data = json.loads(redis_client.get(cache_fq_key).decode("utf-8"))
            best_corr_data = json.loads(redis_client.get(cache_best_corr_key).decode("utf-8"))
            best_sample_id = int(redis_client.get(cache_best_sample_id_key).decode("utf-8"))
            return avg_distance_data, fq_data, best_corr_data, best_sample_id
        
        with db_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                        SELECT avg_distance_vector, fq_distance_vector, best_vector, best_sample_id
                        FROM calc_distance
                        WHERE chrid = %s
                            AND cell_line = %s
                            AND start_value = %s
                            AND end_value = %s
                    """,
                    (chromosome_name, cell_line, sequences["start"], sequences["end"]),
                )
                row = cur.fetchone()
                raw_avg = row["avg_distance_vector"]
                raw_fq  = row["fq_distance_vector"]
                raw_best = row["best_vector"]
                best_sample_id = row["best_sample_id"]

                avg_half_arr = np.frombuffer(raw_avg, dtype=np.float32)
                best_half_arr = np.frombuffer(raw_best, dtype=np.float32)
                avg_full_mat = squareform(avg_half_arr)
                best_full_mat = squareform(best_half_arr)
                
                fq_arr = np.frombuffer(raw_fq, dtype=np.float32)
                n = int(np.sqrt(fq_arr.size))
                fq_full_mat = fq_arr.reshape(n, n)

                avg_data_json = json.dumps(avg_full_mat.tolist(), ensure_ascii=False)
                fq_data_json = json.dumps(fq_full_mat.tolist(), ensure_ascii=False)
                best_corr_json = json.dumps(best_full_mat.tolist(), ensure_ascii=False)
        
        redis_client.setex(cache_avg_key, 3600, avg_data_json)
        redis_client.setex(cache_fq_key, 3600, fq_data_json)
        redis_client.setex(cache_best_corr_key, 3600, best_corr_json)
        redis_client.setex(cache_best_sample_id_key, 3600, best_sample_id)

        return avg_full_mat.tolist(), fq_full_mat.tolist(), best_full_mat.tolist(), best_sample_id

    def get_distance_vector_by_sample(cell_line, chromosome_name, sequences, sample_id):
        with db_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                        SELECT distance_vector
                        FROM distance
                        WHERE cell_line = %s
                            AND chrid = %s
                            AND start_value = %s
                            AND end_value = %s
                            AND sampleid = %s
                    """,
                    (cell_line, chromosome_name, sequences["start"], sequences["end"], sample_id),
                )
                row = cur.fetchone()
                raw_vector = row["distance_vector"]

                vectors = np.frombuffer(raw_vector, dtype=np.float32)
                full_mat = squareform(vectors).tolist()

        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{sample_id}_distance_vector")

        data_json = json.dumps(full_mat, ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))

        return full_mat

    t1 = time()
    cached_3d_position_data, cached_sample_distance_vector = checking_existing_cache_data(chromosome_name, cell_line, sequences, sample_id)
    data_in_db_exist_status = checking_existing_data(chromosome_name, cell_line, sequences)
    redis_client.setex(progress_key, 3600, 5)
    t2 = time()
    print(f"[DEBUG] Checking existing data took {t2 - t1:.4f} seconds")

    if cached_3d_position_data is not None and cached_sample_distance_vector is not None:
        print("Using Redis Cache Data")
        position_data = json.loads(cached_3d_position_data.decode("utf-8"))
        sample_distance_vector = json.loads(cached_sample_distance_vector.decode("utf-8"))

        avg_distance_data_cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "avg_distance_data")
        fq_data_cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "fq_data")
        
        avg_distance_matrix = json.loads(redis_client.get(avg_distance_data_cache_key).decode("utf-8"))
        fq_data = json.loads(redis_client.get(fq_data_cache_key).decode("utf-8"))

        redis_client.setex(progress_key, 3600, 99)
        return {
            "position_data": position_data,
            "avg_distance_data": avg_distance_matrix,
            "fq_data": fq_data,
            "sample_distance_vector": sample_distance_vector
        }
    elif data_in_db_exist_status["position_exists"] and data_in_db_exist_status["distance_exists"]:
        print("Using Existing Database Data")
        avg_distance_matrix, fq_data, sample_distance_vector, best_sample_id = get_avg_fq_best_corr_data(cell_line, chromosome_name, sequences)

        if sample_id != 0:
            sample_distance_vector = get_distance_vector_by_sample(cell_line, chromosome_name, sequences, sample_id)
            position_data = get_position_data(chromosome_name, cell_line, sequences, sample_id)
            print(f"Existing Database Data condition -- Using Sample {sample_id} Data")
        else:
            position_data = get_position_data(chromosome_name, cell_line, sequences, best_sample_id)
            print(f"Existing Database Data condition -- Using Best Sample {best_sample_id} Data")
        
        redis_client.setex(progress_key, 3600, 99)
        return {
            "position_data": position_data,
            "avg_distance_data": avg_distance_matrix,
            "fq_data": fq_data,
            "sample_distance_vector": sample_distance_vector
        }
    else:
        print("Using SBIF Generated Data")
        if cell_line not in label_mapping:
            raise ValueError(f"Cell line '{cell_line}' not found in label_mapping")
        
        table_name = get_cell_line_table_name(cell_line)
        
        t3 = time()
        with db_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                f"""
                    SELECT *
                    FROM {table_name}
                    WHERE chrid = %s
                    AND ibp >= %s
                    AND ibp <= %s
                    AND jbp >= %s
                    AND jbp <= %s
                """,
                    (
                        chromosome_name,
                        sequences["start"],
                        sequences["end"],
                        sequences["start"],
                        sequences["end"],
                    ),
                )
                original_data = cur.fetchall()
        t4 = time()
        redis_client.setex(progress_key, 3600, 10)
        print(f"[DEBUG] Fetching original data took {t4 - t3:.4f} seconds")
        if original_data:
            t5 = time()
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
            redis_client.setex(progress_key, 3600, 20)
            t6 = time()
            print(f"[DEBUG] Writing folding input file took {t6 - t5:.4f} seconds")
            t7 = time()
            script = "./sBIF.sh"
            n_samples = 5000
            n_samples_per_run = 100
            result = subprocess.Popen(
                ["bash", script, str(n_samples), str(n_samples_per_run)],
                text=True,
                stdout=subprocess.PIPE,
                bufsize=1,
            )
            pattern = re.compile(r'^\[.*DONE\]')
            progress_values = [50, 90, 91, 92, 93, 94, 95]
            matches = (line.strip() for line in result.stdout if pattern.match(line))
            for val, line in zip(progress_values, matches):
                print(line)
                redis_client.setex(progress_key, 3600, val)
            t8 = time()
            print(f"[DEBUG] Running folding script took {t8 - t7:.4f} seconds")
            t_remove_start = time()
            os.remove(custom_file_path)
            t_remove_end = time()
            print(f"[DEBUG] Removing folding input file took {t_remove_end - t_remove_start:.4f} seconds")

            t11 = time()
            avg_distance_matrix, fq_data, sample_distance_vector, best_sample_id = get_avg_fq_best_corr_data(cell_line, chromosome_name, sequences)
            t12 = time()
            print(f"[DEBUG] Fetching fq data took {t12 - t11:.4f} seconds")
            
            if sample_id != 0:
                t15 = time()
                sample_distance_vector = get_distance_vector_by_sample(cell_line, chromosome_name, sequences, sample_id)
                position_data = get_position_data(chromosome_name, cell_line, sequences, sample_id)
                print(f"SBIF Generated Data condition -- Using Sample {sample_id} Data")
                t16 = time()
                redis_client.setex(progress_key, 3600, 99)
                print(f"[DEBUG] Finding best chain sample took {t16 - t15:.4f} seconds")
            else:
                t15 = time()
                position_data = get_position_data(chromosome_name, cell_line, sequences, best_sample_id)
                print(f"SBIF Generated Data condition -- Using Best Sample {best_sample_id} Data")
                t16 = time()
                redis_client.setex(progress_key, 3600, 99)
                print(f"[DEBUG] Finding best chain sample took {t16 - t15:.4f} seconds")
            
            return {
                "position_data": position_data,
                "avg_distance_data": avg_distance_matrix,
                "fq_data": fq_data,
                "sample_distance_vector": sample_distance_vector
            }
        else:
            redis_client.setex(progress_key, 3600, 99)
            return []


"""
Download the full 3D chromosome samples distance data in the given cell line, chromosome name
"""
def download_full_chromosome_3D_distance_data(cell_line, chromosome_name, sequences, is_example):
    def checking_existing_data():
        with db_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
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

        return data
    
    def get_distance_data():
        vectors = []
        batch_size = 1000
        
        with db_conn() as conn:
            with conn.cursor(name="distance_download_stream") as cur:
                query = """
                    SELECT distance_vector
                    FROM distance
                    WHERE cell_line = %s
                        AND chrid = %s
                        AND start_value = %s
                        AND end_value = %s
                    ORDER BY sampleid
                """
                cur.execute(query, (cell_line, chromosome_name, sequences["start"], sequences["end"]))


                while True:
                    rows = cur.fetchmany(batch_size)
                    if not rows:
                        break
                    for (blob,) in rows:
                        vec = np.frombuffer(blob, dtype=np.float32)
                        vectors.append(vec)

        if not vectors:
            print("No valid distance_vector")
            return None

        matrix = np.stack(vectors, axis=0).astype(np.float32)
        sparse_matrix = csr_matrix(matrix)

        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.npz') as tmp_file:
            save_npz(tmp_file.name, sparse_matrix)
            sparse_file_path = tmp_file.name

        return sparse_file_path

    existing_data_status = checking_existing_data()

    if not is_example:
        if existing_data_status['exists']:
            parquet_file_path = get_distance_data()
            print(f"Existing data found: {parquet_file_path}")
            return parquet_file_path, send_file(
                parquet_file_path,
                as_attachment=True,
                download_name=f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_distance_data.npz",
            )
        else:
            return None, None
    else:
        # For example data, we can directly return the path to the example file
        example_file_path = f"./example_data/{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_converted_distance.npz"
        if os.path.exists(example_file_path):
            return example_file_path, send_file(
                example_file_path,
                as_attachment=True,
                download_name=f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_distance_data.npz",
            )
        else:
            return None, None

"""
Download the full 3D chromosome samples position data in the given cell line, chromosome name
"""
def download_full_chromosome_3D_position_data(cell_line, chromosome_name, sequences, is_example):
    query = """
        SELECT *
        FROM position
        WHERE cell_line = %s
            AND chrid = %s
            AND start_value = %s
            AND end_value = %s
        ORDER BY sampleid, pid
    """
    if not is_example:
        with db_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(query, (cell_line, chromosome_name, sequences["start"], sequences["end"]))
                rows = cur.fetchall()

        if not rows:
            return None, None

        # Convert to DataFrame
        df = pd.DataFrame(rows)

        # Save to a temporary CSV file
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as tmp_file:
            df.to_csv(tmp_file.name, index=False)
            csv_file_path = tmp_file.name

        return csv_file_path, send_file(
            csv_file_path,
            as_attachment=True,
            download_name=f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_position_data.csv",
        )
    else:
        # For example data, we can directly return the path to the example file
        example_file_path = f"./example_data/{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_original_position.csv"
        if os.path.exists(example_file_path):
            return example_file_path, send_file(
                example_file_path,
                as_attachment=True,
                download_name=f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_position_data.csv",
            )
        else:
            return None, None

"""
Returns currently existing other cell line list in given chromosome name and sequences
"""
def comparison_cell_line_list(cell_line):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT cell_line
                FROM valid_regions
            """
            )
            rows = cur.fetchall()

    options = [
        {
            "value": row["cell_line"],
            "label": label_mapping.get(row["cell_line"], "Unknown"),
        }
        for row in rows
        if row["cell_line"] != cell_line
    ]

    return options


"""
Return the gene list in the given chromosome_name and sequence
"""
def gene_list(chromosome_name, sequences):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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

    return gene_list


"""
Return the epigenetic track data in the given cell_line, chromosome_name and sequence
"""
def epigenetic_track_data(cell_line, chromosome_name, sequences):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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

    distributions: dict[str, list[float]] = {
        f"{i}-{j}": [] for i, j in combinations(indices, 2)
    }

    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT sampleid, distance_vector
                FROM distance
                WHERE chrid         = %s
                    AND cell_line   = %s
                    AND start_value = %s
                    AND end_value   = %s
                ORDER BY sampleid
                """,
                (
                    chromosome_name,
                    cell_line,
                    sequences["start"],
                    sequences["end"],
                )
            )
            rows = cur.fetchall()

    for row in rows:
        blob = row["distance_vector"]
        dist_vec = np.frombuffer(blob, dtype=np.float32)  # shape = (L,)

        L = dist_vec.shape[0]
        N = int((1 + math.isqrt(1 + 8 * L)) // 2)

        for i, j in combinations(indices, 2):
            if i < 0 or j < 0 or i >= N or j >= N:
                continue

            row_offset = i * N - (i * (i + 1) // 2)
            in_row_offset = j - i - 1
            idx = row_offset + in_row_offset

            dist_val = max(0.0, float(dist_vec[idx]) - 34.3)   # diameter of beads
            distributions[f"{i}-{j}"].append(dist_val)

    return distributions


"""
Return the distribution of selected beads from existing 3D chromosome data
"""
def exist_bead_distribution(cell_line, indices, chromosome_name="chr8", sequences={"start": 127300000, "end": 128300000}):
    indices = [int(idx) for idx in indices]

    distributions: dict[str, list[float]] = {
        f"{i}-{j}": [] for i, j in combinations(indices, 2)
    }

    distance_path = f"./example_data/{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}_original_distance.feather"

    with ThreadPoolExecutor(max_workers=10) as pool:
        fut_dist = pool.submit(read_feather_pa, distance_path)
    
    distance_df = fut_dist.result()
    for _, row in distance_df.iterrows():
        dist_vec = np.array(row['distance_vector'], dtype=float)  # shape = (L,)

        L = dist_vec.shape[0]
        N = int((1 + math.isqrt(1 + 8 * L)) // 2)

        for i, j in combinations(indices, 2):
            if i < 0 or j < 0 or i >= N or j >= N:
                continue

            row_offset = i * N - (i * (i + 1) // 2)
            in_row_offset = j - i - 1
            idx = row_offset + in_row_offset

            dist_val = max(0.0, float(dist_vec[idx]) - 34.3)   # diameter of beads
            distributions[f"{i}-{j}"].append(dist_val)

    return distributions


"""
Compute pairwise t-test p-values between groups for each bead pair category
Input format:
{
    "GroupA": { "i-j": [vals...], ... },
    "GroupB": { "i-j": [vals...], ... },
    ...
}
Returns:
{
    "i-j": { "GroupA|GroupB": pvalue, ... },
    ...
}
"""
def bead_distribution_pvalues(distribution_groups: dict) -> dict:
    if not isinstance(distribution_groups, dict) or len(distribution_groups) < 2:
        return {}

    group_names = list(distribution_groups.keys())
    # Collect all categories present in at least one group
    categories: set[str] = set()
    for g in group_names:
        if isinstance(distribution_groups[g], dict):
            categories.update(distribution_groups[g].keys())

    result: dict[str, dict[str, float]] = {}

    MIN_P_VALUE = 1e-300

    for category in categories:
        pair_to_p: dict[str, float] = {}
        for i in range(len(group_names) - 1):
            for j in range(i + 1, len(group_names)):
                g1 = group_names[i]
                g2 = group_names[j]
                arr1 = distribution_groups.get(g1, {}).get(category, []) or []
                arr2 = distribution_groups.get(g2, {}).get(category, []) or []

                # Clean arrays: drop NaNs and non-finite values
                a1 = [float(x) for x in arr1 if x is not None and np.isfinite(x)]
                a2 = [float(x) for x in arr2 if x is not None and np.isfinite(x)]

                # Need at least 2 observations per group for t-test
                if len(a1) >= 2 and len(a2) >= 2:
                    # Check if all values in either group are the same (zero variance)
                    a1_array = np.array(a1)
                    a2_array = np.array(a2)
                    var1 = np.var(a1_array, ddof=1) if len(a1_array) > 1 else 0
                    var2 = np.var(a2_array, ddof=1) if len(a2_array) > 1 else 0
                    
                    # If both groups have zero variance (all same values), p-value = 1
                    if var1 == 0 and var2 == 0:
                        p_val = 1.0
                    else:
                        try:
                            # Two-sample independent t-test
                            stat, p = ttest_ind(a1, a2, equal_var=False)
                            p_val = float(p)
                            
                            # Check for NaN or invalid p-value
                            if np.isnan(p_val) or not np.isfinite(p_val):
                                p_val = None
                            # Replace 0.0 p-values with extremely small value
                            elif p_val == 0.0:
                                p_val = MIN_P_VALUE
                        except Exception:
                            p_val = None
                else:
                    p_val = None

                key = f"{g1}|{g2}" if g1 <= g2 else f"{g2}|{g1}"
                pair_to_p[key] = p_val
        if pair_to_p:
            result[category] = pair_to_p

    return result


"""
Cluster cells from the bintu table and return options
"""
def get_bintu_cell_clusters():
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Query to get unique combinations of cell_line, chrid, start_value, end_value
            # and count the number of cells in each cluster
            cur.execute(
                """
                SELECT 
                    cell_line,
                    chrid,
                    start_value,
                    end_value,
                    COUNT(DISTINCT cell_id) as cell_count,
                    ARRAY_AGG(DISTINCT cell_id ORDER BY cell_id) as cell_ids
                FROM bintu
                GROUP BY cell_line, chrid, start_value, end_value
                ORDER BY cell_line, chrid, start_value, end_value
                """
            )
            rows = cur.fetchall()
    
    options = []
    for row in rows:
        # Create value: cell_line_chrid_start_value_end_value
        value = f"{row['cell_line']}_{row['chrid']}_{row['start_value']}_{row['end_value']}"
        
        # Create label in format like "A549_chr21-28-30Mb"
        start_mb = row['start_value'] // 1000000
        end_mb = row['end_value'] // 1000000
        label = f"{row['cell_line']}_{row['chrid']}-{start_mb}-{end_mb}Mb"
        
        options.append({
            "value": value,
            "label": label,
            "cell_line": row['cell_line'],
            "chrid": row['chrid'], 
            "start_value": row['start_value'],
            "end_value": row['end_value'],
            "cell_count": row['cell_count'],
            "cell_ids": row['cell_ids']
        })
    
    return options


"""
Get Bintu distance matrix for a specific cell ID
"""
def get_bintu_distance_matrix(cell_line, chrid, start_value, end_value, cell_id):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get the 3D coordinates for the specific cell
            # Assuming the bintu table has columns: cell_id, segment_index, x, y, z
            cur.execute(
                """
                SELECT segment_index, x, y, z
                FROM bintu
                WHERE cell_line = %s AND chrid = %s AND start_value = %s AND end_value = %s AND cell_id = %s
                ORDER BY segment_index
                """,
                (cell_line, chrid, start_value, end_value, cell_id)
            )
            rows = cur.fetchall()
    
    if not rows:
        return None
    
    # Extract coordinates and segment indices
    segment_indices = [row['segment_index'] for row in rows]
    coordinates = np.array([(row['x'], row['y'], row['z']) for row in rows], dtype=float)

    # Mark invalid coordinates (any NaN/Inf in x,y,z)
    valid_mask = np.isfinite(coordinates).all(axis=1)
    n = coordinates.shape[0]

    # Initialize distance matrix with -1 (white in frontend) for any pair involving invalid coords
    distance_matrix = np.full((n, n), -1.0, dtype=float)

    # Compute distances only for valid coordinates subset
    if n > 0 and valid_mask.any():
        valid_idx = np.where(valid_mask)[0]
        coords_valid = coordinates[valid_mask]
        # squareform handles size 1 as [[0.]] which is fine
        dm_valid = squareform(pdist(coords_valid))
        # Place computed distances back into the full matrix at valid indices
        distance_matrix[np.ix_(valid_idx, valid_idx)] = dm_valid

    # As a safety, convert any remaining non-finite to -1
    distance_matrix[~np.isfinite(distance_matrix)] = -1.0
    
    # Create genomic positions from segment indices
    # Each segment represents 30kb, so position = start_value + segment_index * 30000
    positions = [start_value + seg_idx * 30000 for seg_idx in segment_indices]
    
    # Create the result structure similar to chromosome_data
    result = []
    n_positions = len(positions)
    
    for i in range(n_positions):
        for j in range(n_positions):
            result.append({
                'x': int(positions[i]),
                'y': int(positions[j]),
                'value': float(distance_matrix[i][j])
            })
    
    return {
        'data': result,
        'positions': positions,
        'cell_line': cell_line,
        'chrid': chrid,
        'start_value': start_value,
        'end_value': end_value,
        'cell_id': cell_id,
        'step': 30000  # Bintu uses 30kb step size
    }


"""
Download Bintu CSV for a specific dataset cluster
File naming convention under ./Bintu: {cell_line}_{chrid}-{start_mb}-{end_mb}Mb.csv
"""
def download_bintu_csv(cell_line: str, chrid: str, start_value: int, end_value: int):
    # Convert to Mb for filename construction
    try:
        start_mb = int(start_value) // 1_000_000
        end_mb = int(end_value) // 1_000_000
    except Exception:
        return None

    base_prefix = f"{cell_line}_{chrid}-{start_mb}-{end_mb}Mb"
    direct_filename = f"{base_prefix}.csv"
    direct_path = os.path.join("./Bintu", direct_filename)

    # Prefer exact match, else fallback to any file with the prefix (e.g., _untreated)
    candidate_path = None
    candidate_name = None
    if os.path.exists(direct_path):
        candidate_path = direct_path
        candidate_name = direct_filename
    else:
        pattern = os.path.join("./Bintu", base_prefix + "*.csv")
        matches = glob.glob(pattern)
        if matches:
            # Choose the first match deterministically (sorted)
            matches.sort()
            candidate_path = matches[0]
            candidate_name = os.path.basename(candidate_path)

    if not candidate_path:
        return None

    return send_file(
        candidate_path,
        as_attachment=True,
        download_name=candidate_name,
        mimetype='text/csv'
    )


"""
Download GSE CSV for a specific cell line and cell ID
File naming convention under ./GSE: {cell_line}/{cell_id}.csv
"""
def download_gse_csv(cell_line: str, cell_id: str):
    # Construct the file path based on the expected structure
    file_path = os.path.join("./GSE", cell_line, f"{cell_id}.csv")
    
    # Check if the file exists
    if not os.path.exists(file_path):
        return None
    
    # Return the file for download
    return send_file(
        file_path,
        as_attachment=True,
        download_name=f"{cell_line}_{cell_id}.csv",
        mimetype='text/csv'
    )


"""
Return currently existing GSE cell line options"""
def get_gse_cell_line_options():
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT cell_line
                FROM gse
                """
            )
            rows = cur.fetchall()
    
    options = [
        {
            "value": row["cell_line"],
            "label": row["cell_line"],
        }
        for row in rows
    ]

    return options


"""
Return currently existing GSE cell ID options in the given cell line
"""
def get_gse_cell_id_options(cell_line: str):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT cell_id
                FROM gse
                WHERE cell_line = %s
                """,
                (cell_line,)
            )
            rows = cur.fetchall()
    
    options = [
        {
            "value": row["cell_id"],
            "label": row["cell_id"],
        }
        for row in rows
    ]

    return options



"""
Return the GSE chrid options in the given cell line and cell ID
"""
def get_gse_chrid_options(cell_line: str, cell_id: str):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT chrid
                FROM gse
                WHERE cell_line = %s
                    AND cell_id = %s
                ORDER BY chrid
                """,
                (cell_line, cell_id)
            )
            rows = cur.fetchall()
    
    options = [
        {
            "value": row["chrid"],
            "label": row["chrid"],
        }
        for row in rows
    ]

    return options


"""
Get GSE distance matrix for given parameters
"""
def get_gse_distance_matrix(cell_line: str, cell_id: str, chrid: str, start_value: int = None, end_value: int = None):
    """
    Get Hi-C interaction data from GSE table for the specified parameters.
    GSE table contains Hi-C data with ibp, jbp, fq columns (not coordinates).
    Uses fq values for heatmap rendering instead of calculating distances.
    """
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Base query
            base_query = """
                SELECT ibp, jbp, fq
                FROM gse
                WHERE cell_line = %s
                    AND cell_id = %s
                    AND chrid = %s
            """
            params = [cell_line, cell_id, chrid]
            
            # Add range filtering if start_value and end_value are provided
            if start_value is not None and end_value is not None:
                base_query += " AND ibp >= %s AND ibp <= %s AND jbp >= %s AND jbp <= %s"
                params.extend([start_value, end_value, start_value, end_value])
            
            base_query += " ORDER BY ibp, jbp"
            
            cur.execute(base_query, params)
            rows = cur.fetchall()
    
    if not rows:
        return None
    
    # Create the result structure similar to chromosome_data for heatmap rendering
    result = []
    
    for row in rows:
        result.append({
            'x': int(row['ibp']),
            'y': int(row['jbp']),
            'value': float(row['fq']) if row['fq'] is not None else 0.0
        })
    
    # Get unique positions for metadata and calculate start/end values from data
    positions = sorted(set([row['ibp'] for row in rows] + [row['jbp'] for row in rows]))
    data_start_value = min(positions) if positions else 0
    data_end_value = max(positions) if positions else 0
    
    return {
        'data': result,
        'positions': positions,
        'cell_line': cell_line,
        'cell_id': cell_id,
        'chrid': chrid,
        'start_value': start_value if start_value is not None else data_start_value,
        'end_value': end_value if end_value is not None else data_end_value,
        'step': 5000  # GSE data step size
    }