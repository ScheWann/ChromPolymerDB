import json
import os
import hashlib
import redis
from dotenv import load_dotenv

from celery_worker import celery_worker
from process import chromosome_3D_data, exist_chromosome_3D_data, make_redis_cache_key, redis_client, db_conn
from task_utils import make_task_signature, get_task_key

load_dotenv()

# Redis connection for task registry (separate from main redis_client in process.py)
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB   = int(os.getenv("REDIS_TASK_DB", 2))  # Separate DB for task registry

task_registry_redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# Keys for locking
WRITE_LOCK_KEY = "chromosome_3d_write_lock"


@celery_worker.task(bind=True, name="tasks.process_chromosome_3d")
def process_chromosome_3d(self, cell_line: str, chromosome_name: str, sequences: dict, sample_id: int):
    """Celery task wrapper around chromosome_3D_data.

    Follows the three-step logic:
    1. Check Redis cache - if exists, return immediately
    2. Check database - if exists, return immediately  
    3. Run expensive computation with locking
    """
    signature = make_task_signature(cell_line, chromosome_name, sequences, sample_id)
    print(f"[TASK {self.request.id}] Received request – signature: {signature}")

    # Helper functions for checking cache and database
    def check_redis_cache():
        """Check if data exists in Redis cache"""
        redis_3d_position_data_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"3d_{sample_id}_position_data")
        if sample_id == 0:
            redis_sample_distance_vector_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "best_corr_data")
        else:
            redis_sample_distance_vector_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], f"{sample_id}_distance_vector")
        
        cached_3d_position_data = redis_client.get(redis_3d_position_data_key)
        cached_sample_distance_vector = redis_client.get(redis_sample_distance_vector_key)
        
        return cached_3d_position_data, cached_sample_distance_vector

    def check_database():
        """Check if data exists in database"""
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

    # Step 1: Check Redis cache
    print(f"[TASK {self.request.id}] Step 1: Checking Redis cache...")
    cached_3d_position_data, cached_sample_distance_vector = check_redis_cache()
    
    if cached_3d_position_data is not None and cached_sample_distance_vector is not None:
        print(f"[TASK {self.request.id}] Data found in Redis cache. Returning immediately.")
        
        # Get additional cached data
        avg_distance_data_cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "avg_distance_data")
        fq_data_cache_key = make_redis_cache_key(cell_line, chromosome_name, sequences["start"], sequences["end"], "fq_data")
        
        position_data = json.loads(cached_3d_position_data.decode("utf-8"))
        sample_distance_vector = json.loads(cached_sample_distance_vector.decode("utf-8"))
        avg_distance_matrix = json.loads(redis_client.get(avg_distance_data_cache_key).decode("utf-8"))
        fq_data = json.loads(redis_client.get(fq_data_cache_key).decode("utf-8"))

        self.request.update_state(state='SUCCESS', meta={'current': 100, 'total': 100, 'status': 'Cache hit'})
        return {
            "status": "cache_hit",
            "position_data": position_data,
            "avg_distance_data": avg_distance_matrix,
            "fq_data": fq_data,
            "sample_distance_vector": sample_distance_vector
        }

    # Step 2: Check database
    print(f"[TASK {self.request.id}] Step 2: Checking database...")
    data_in_db_exist_status = check_database()
    
    if data_in_db_exist_status["position_exists"] and data_in_db_exist_status["distance_exists"]:
        print(f"[TASK {self.request.id}] Data found in database. Processing and returning immediately.")
        
        # Use chromosome_3D_data to process database data (it will handle the database case)
        result = chromosome_3D_data(cell_line, chromosome_name, sequences, sample_id, task_instance=self)
        
        self.request.update_state(state='SUCCESS', meta={'current': 100, 'total': 100, 'status': 'Database hit'})
        return {
            "status": "database_hit",
            **result
        }

    # Step 3: Run expensive computation with deduplication and locking
    print(f"[TASK {self.request.id}] Step 3: Data not found. Starting expensive computation...")
    
    # Deduplication check (idempotent): Only allow one task with this signature at a time.
    task_key = get_task_key(signature)
    existing_task_id = task_registry_redis.get(task_key)
    
    if existing_task_id is not None:
        existing_task_id = existing_task_id.decode('utf-8')
        if existing_task_id != self.request.id:
            print(f"[TASK {self.request.id}] Duplicate detected. Task {existing_task_id} already processing this signature. Skipping execution.")
            return {
                "status": "duplicate_skipped",
                "detail": f"Task with signature {signature} already in progress by task {existing_task_id}."
            }
        else:
            print(f"[TASK {self.request.id}] Same task ID found in registry, proceeding...")
    else:
        # Register this task
        task_registry_redis.setex(task_key, 1800, self.request.id)  # 30 minutes TTL
        print(f"[TASK {self.request.id}] Registered in task registry.")

    print(f"[TASK {self.request.id}] Added to registry. Attempting to acquire write lock …")

    # Acquire global write lock so only one task writes at a time.
    lock = redis_client.lock(WRITE_LOCK_KEY, timeout=60 * 30, blocking_timeout=None)
    try:
        with lock:
            print(f"[TASK {self.request.id}] Write lock acquired. Starting chromosome_3D_data computation …")
            result = chromosome_3D_data(cell_line, chromosome_name, sequences, sample_id, task_instance=self)
            print(f"[TASK {self.request.id}] chromosome_3D_data computation finished.")
    finally:
        # Clean up the registry so subsequent tasks can proceed
        task_key = get_task_key(signature)
        task_registry_redis.delete(task_key)
        print(f"[TASK {self.request.id}] Task registry entry removed. Task completed.")

    return {
        "status": "computed",
        **result
    } 


@celery_worker.task(bind=True, name="tasks.process_exist_chromosome_3d")
def process_exist_chromosome_3d(self, cell_line: str, sample_id: int):
    """Celery task wrapper around exist_chromosome_3D_data.

    Provides progress tracking through Celery task metadata.
    """
    print(f"[TASK {self.request.id}] Processing existing chromosome 3D data for {cell_line}, sample {sample_id}")
    
    try:
        result = exist_chromosome_3D_data(cell_line, sample_id, task_instance=self)
        print(f"[TASK {self.request.id}] exist_chromosome_3D_data computation finished.")
        return result
    except Exception as e:
        print(f"[TASK {self.request.id}] Error in exist_chromosome_3D_data: {e}")
        raise