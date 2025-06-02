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
from scipy.spatial.distance import squareform
from scipy.stats import pearsonr
from dotenv import load_dotenv
from time import time
import pyarrow.feather as feather
from concurrent.futures import ThreadPoolExecutor


load_dotenv()


# postgres database connection settings
DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# redis connection settings
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB   = int(os.getenv("REDIS_DB", 0))

# Create a connection pool for the PostgreSQL database
conn_pool = ConnectionPool(
    conninfo=f"host={DB_HOST} dbname={DB_NAME} user={DB_USERNAME} password={DB_PASSWORD}",
    min_size=1,
    max_size=20,
)

# Create a Redis connection pool
redis_pool = redis.ConnectionPool(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
redis_client = redis.Redis(connection_pool=redis_pool)


"""
Establish redis cache key
"""
def make_redis_cache_key(cell_line, chromosome_name, start, end, custom_name):
    """
    e.g: "chr8:IMR:127300000:128300000:"
    """
    return f"{cell_line}:{chromosome_name}:{start}:{end}:{custom_name}"


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
                WHERE chromosome = '12' OR chromosome = '17'
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
                FROM sequence
            """)
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
Returns the all sequences of the chromosome data in the given cell line, chromosome name
"""
def chromosome_sequences(cell_line, chromosome_name):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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

    return ranges


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
            """,
                (gene_name,),
            )

            gene = cur.fetchone()

    return gene


"""
Returns the existing chromosome data in the given cell line, chromosome name, start, end
"""
def chromosome_data(cell_line, chromosome_name, sequences):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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

    return chromosome_sequence


"""
Returns the existing chromosome data in the given cell line, chromosome name, start, end
"""
def chromosome_valid_ibp_data(cell_line, chromosome_name, sequences):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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

    ibp_values = [ibp["ibp"] for ibp in chromosome_valid_ibps]

    return ibp_values


"""
Returns the existing 3D chromosome data in the given cell line, chromosome name, start, end(IMR-chr8-127300000-128300000)
"""
def exist_chromosome_3d_data(cell_line, sample_id):
    def read_feather_pa(path):
        return feather.read_table(path, memory_map=True).to_pandas()

    def checking_existing_data(cell_line, sample_id):
        redis_3d_position_data_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, "3d_example_position_data")
        redis_avg_distance_data_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, "avg_distance_example_data")
        redis_fq_data_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, "fq_example_data")
        redis_sample_distance_vector_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, f"{sample_id}_example_distance_vector")

        cached_3d_example_position_data = redis_client.get(redis_3d_position_data_key)
        cached_avg_distance_example_data = redis_client.get(redis_avg_distance_data_key)
        cached_fq_example_data = redis_client.get(redis_fq_data_key)
        cached_example_sample_distance_vector = redis_client.get(redis_sample_distance_vector_key)

        return cached_3d_example_position_data, cached_avg_distance_example_data, cached_fq_example_data, cached_example_sample_distance_vector
    
    def get_position_data(cell_line, sid):
        cache_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, "3d_example_position_data")
        records = position_df[position_df['sampleid'] == sid].to_dict(orient='records')
        
        data_json = json.dumps(records, ensure_ascii=False, default=str)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))
        
        return records
    
    def get_fq_data(cell_line):
        cache_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, "fq_example_data")
        full_distance_matrix = np.load(f"./example_data/{cell_line}_chr8_127300000_128300000_fq_matrix.npy")
        
        data_json = json.dumps(full_distance_matrix.tolist(), ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))
        
        return full_distance_matrix.tolist()

    def get_avg_distance_data(cell_line):
        cache_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, "avg_distance_example_data")
        full_distance_matrix = np.load(f"./example_data/{cell_line}_chr8_127300000_128300000_avg_distance_matrix.npy")
        
        data_json = json.dumps(full_distance_matrix.tolist(), ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))

        return full_distance_matrix.tolist()

    def get_distance_vector_by_sample(cell_line, sid):
        cache_key = make_redis_cache_key(cell_line, "chr8", 127300000, 128300000, f"{sid}_example_distance_vector")
        vec = np.array(distance_df['distance_vector'].iloc[sid], dtype=float)
        mat = squareform(vec).tolist()

        data_json = json.dumps(mat, ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))

        return mat
    
    cached_3d_example_position_data, cached_avg_distance_example_data, cached_fq_example_data, cached_example_sample_distance_vector = checking_existing_data(cell_line, sample_id)
    
    if cached_3d_example_position_data and cached_avg_distance_example_data and cached_fq_example_data and cached_example_sample_distance_vector is not None:
        position_data = json.loads(cached_3d_example_position_data.decode("utf-8"))
        avg_distance_matrix = json.loads(cached_avg_distance_example_data.decode("utf-8"))
        fq_data = json.loads(cached_fq_example_data.decode("utf-8"))
        sample_distance_vector = json.loads(cached_example_sample_distance_vector.decode("utf-8"))

        return {
            "position_data": position_data,
            "avg_distance_data": avg_distance_matrix,
            "fq_data": fq_data,
            "sample_distance_vector": sample_distance_vector
        }
    else:
        if cell_line == "IMR":
            pos_path = "./example_data/IMR_chr8_127300000_128300000_original_position.feather"
            dist_path = "./example_data/IMR_chr8_127300000_128300000_original_distance.feather"

            with ThreadPoolExecutor(max_workers=10) as pool:
                fut_pos  = pool.submit(read_feather_pa, pos_path)
                fut_dist = pool.submit(read_feather_pa, dist_path)

            position_df = fut_pos.result()
            distance_df = fut_dist.result()
        
        if cell_line == "GM":
            pos_path = "./example_data/GM_chr8_127300000_128300000_original_position.feather"
            dist_path = "./example_data/GM_chr8_127300000_128300000_original_distance.feather"

            with ThreadPoolExecutor(max_workers=10) as pool:
                fut_pos  = pool.submit(read_feather_pa, pos_path)
                fut_dist = pool.submit(read_feather_pa, dist_path)

            position_df = fut_pos.result()
            distance_df = fut_dist.result()

        return {
                "position_data": get_position_data(cell_line, sample_id),
                "avg_distance_data": get_avg_distance_data(cell_line),
                "fq_data": get_fq_data(cell_line),
                "sample_distance_vector": get_distance_vector_by_sample(cell_line, sample_id)
            }


"""
Returns the example 3D chromosome data in the given cell line, chromosome name, start, end
"""
def example_chromosome_3d_data(cell_line, chromosome_name, sequences, sample_id):
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

    # Check if the data already exists in the redis cache
    def checking_existing_data(chromosome_name, cell_line, sequences, sample_id):
        redis_3d_position_data_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "3d_position_data")
        redis_avg_distance_data_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "avg_distance_data")
        redis_fq_data_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "fq_data")
        redis_sample_distance_vector_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{sample_id}_distance_vector")
        
        cached_3d_position_data = redis_client.get(redis_3d_position_data_key)
        cached_avg_distance_data = redis_client.get(redis_avg_distance_data_key)
        cached_fq_data = redis_client.get(redis_fq_data_key)
        cached_sample_distance_vector = redis_client.get(redis_sample_distance_vector_key)

        return cached_3d_position_data, cached_avg_distance_data, cached_fq_data, cached_sample_distance_vector

    def fetch_distance_vectors(chromosome_name, cell_line, sequences, dtype=np.float32, batch_size=50):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "full_distance_vectors")
        cached = redis_client.get(cache_key)
        
        if cached is not None:
            vectors = json.loads(cached.decode("utf-8"))
            vectors = [np.array(vec, dtype=dtype) for vec in vectors]
            return np.stack(vectors, axis=0)
        else:
            vectors = []

            with db_conn() as conn:
                cur = conn.cursor(name="distance_stream")
                cur.execute(
                    """
                        SELECT distance_vector
                        FROM distance
                        WHERE cell_line = %s
                        AND chrid     = %s
                        AND start_value = %s
                        AND end_value   = %s
                        ORDER BY sampleid
                    """,
                    (cell_line, chromosome_name, sequences["start"], sequences["end"])
                )

                while True:
                    rows = cur.fetchmany(batch_size)
                    if not rows:
                        break

                    for (arr_bin,) in rows:
                        if isinstance(arr_bin, memoryview):
                            tmp = np.frombuffer(arr_bin.tobytes(), dtype=np.float32).astype(dtype)
                        elif isinstance(arr_bin, (bytes, bytearray)):
                            tmp = np.frombuffer(arr_bin, dtype=np.float32).astype(dtype)
                        else:
                            tmp = np.array(arr_bin, dtype=dtype)

                        vectors.append(tmp)

                cur.close()

            if not vectors:
                return np.empty((0, 0), dtype=dtype)

            vector_list = [vec.tolist() for vec in vectors]
            data_json = json.dumps(vector_list, ensure_ascii=False)
            redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))
            
            return np.stack(vectors, axis=0)

    def get_position_data(chromosome_name, cell_line, sequences, sample_id):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "3d_position_data")

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
                    """,
                    (chromosome_name, cell_line, sequences["start"], sequences["end"], sample_id),
                )
                data = cur.fetchall()

        position_json = json.dumps(data, ensure_ascii=False, default=str)
        redis_client.setex(cache_key, 3600, position_json.encode("utf-8"))
        
        return data

    # Get the average distance data of 5000 chain samples
    def get_avg_distance_data(vectors, cell_line, chromosome_name, sequences):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "avg_distance_data")
        vectors = np.array(vectors)
        avg_vector = np.mean(vectors, axis=0)
        matrix_list = squareform(avg_vector).tolist()

        data_json = json.dumps(matrix_list, ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))

        return matrix_list

    # Get the frequency data of 5000 chain samples
    def get_fq_data(vectors, cell_line, chromosome_name, sequences):
        cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "fq_data")
        first = vectors[0]
        sum_vec = (first <= 80).astype(int)
        for vec in vectors[1:]:
            sum_vec += (vec <= 80).astype(int)
        avg = sum_vec / len(vectors)

        data_json = json.dumps(avg.tolist(), ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))
        
        return squareform(avg).tolist()

    # Return the most similar chain
    def get_best_chain_sample(vectors, cell_line, chromosome_name, sequences):
        avg_mat = get_avg_distance_data(vectors, cell_line, chromosome_name, sequences)
        avg_vec = np.array(avg_mat).flatten()
        best_corr = None
        best_id = None
        for sid in range(5000):
            vec = np.array(get_distance_vector_by_sample(vectors, sid, cell_line, chromosome_name, sequences, sample_id)).flatten()
            corr, _ = pearsonr(vec, avg_vec)
            if best_corr is None or abs(1 - abs(corr)) < abs(1 - abs(best_corr)):
                best_corr, best_id = corr, sid
        print(f"[DEBUG] best_corr={best_corr:.4f}")
        return best_id, avg_mat

    def get_distance_vector_by_sample(vectors, index, cell_line, chromosome_name, sequences, sample_id):
        vectors = squareform(vectors[index]).tolist()
        
        if sample_id == 0:
            cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "0_distance_vector")
        else:
            cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{index}_distance_vector")
        
        data_json = json.dumps(vectors, ensure_ascii=False)
        redis_client.setex(cache_key, 3600, data_json.encode("utf-8"))
        
        return vectors
    
    t1 = time()
    cached_3d_position_data, cached_avg_distance_data, cached_fq_data, cached_sample_distance_vector = checking_existing_data(chromosome_name, cell_line, sequences, sample_id)
    t2 = time()
    print(f"[DEBUG] Checking existing data took {t2 - t1:.4f} seconds")

    # if existing_data_status["position_exists"] and existing_data_status["distance_exists"]:
    if cached_3d_position_data and cached_avg_distance_data and cached_fq_data and cached_sample_distance_vector is not None:
        position_data = json.loads(cached_3d_position_data.decode("utf-8"))
        avg_distance_matrix = json.loads(cached_avg_distance_data.decode("utf-8"))
        fq_data = json.loads(cached_fq_data.decode("utf-8"))
        sample_distance_vector = json.loads(cached_sample_distance_vector.decode("utf-8"))

        
        return {
            "position_data": position_data,
            "avg_distance_data": avg_distance_matrix,
            "fq_data": fq_data,
            "sample_distance_vector": sample_distance_vector
        }
    else:
        t3 = time()
        with db_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
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
        t4 = time()
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
            t6 = time()
            print(f"[DEBUG] Writing folding input file took {t6 - t5:.4f} seconds")
            t7 = time()
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
            t8 = time()
            print(f"[DEBUG] Running folding script took {t8 - t7:.4f} seconds")
            os.remove(custom_file_path)

            t9 = time()
            distance_vectors = fetch_distance_vectors(chromosome_name, cell_line, sequences)
            t10 = time()
            print(f"[DEBUG] Fetching distance vectors took {t10 - t9:.4f} seconds")

            t11 = time()
            position_data = get_position_data(chromosome_name, cell_line, sequences, sample_id or 0)
            t12 = time()
            print(f"[DEBUG] Fetching position data took {t12 - t11:.4f} seconds")
            t13 = time()
            fq_data = get_fq_data(distance_vectors, cell_line, chromosome_name, sequences)
            t14 = time()
            print(f"[DEBUG] Fetching fq data took {t14 - t13:.4f} seconds")
            
            if sample_id == 0:
                t15 = time()
                best_sample_id, avg_distance_matrix = get_best_chain_sample(distance_vectors, cell_line, chromosome_name, sequences)
                t16 = time()
                print(f"[DEBUG] Finding best chain sample took {t16 - t15:.4f} seconds")
                sid = best_sample_id
            else:
                avg_distance_matrix = get_avg_distance_data(distance_vectors, cell_line, chromosome_name, sequences)
                sid = sample_id
            
            sample_distance_vector = get_distance_vector_by_sample(distance_vectors, sid, cell_line, chromosome_name, sequences, sample_id)

            return {
                "position_data": position_data,
                "avg_distance_data": avg_distance_matrix,
                "fq_data": fq_data,
                "sample_distance_vector": sample_distance_vector
            }
        else:
            return []


"""
Download the full 3D chromosome samples distance data in the given cell line, chromosome name
"""
def download_full_chromosome_3d_distance_data(cell_line, chromosome_name, sequences):
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
            with conn.cursor(row_factory=dict_row) as cur:
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

    existing_data_status = checking_existing_data()

    if existing_data_status['exists']:
        parquet_file_path = get_distance_data()
        print(f"Existing data found: {parquet_file_path}")
        return parquet_file_path, send_file(
            parquet_file_path,
            as_attachment=True,
            download_name=f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}.npz",
        )
    else:
        return None, None

"""
Download the full 3D chromosome samples position data in the given cell line, chromosome name
"""
def download_full_chromosome_3d_position_data(cell_line, chromosome_name, sequences):
    query = """
        SELECT *
        FROM position
        WHERE cell_line = %s
            AND chrid = %s
            AND start_value = %s
            AND end_value = %s
        ORDER BY sampleid, pid
    """
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
        download_name=f"{cell_line}_{chromosome_name}_{sequences['start']}_{sequences['end']}.csv",
    )

"""
Returns currently existing other cell line list in given chromosome name and sequences
"""
def comparison_cell_line_list(cell_line):
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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
    with db_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
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