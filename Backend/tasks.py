import json
import os
import hashlib
import redis
from dotenv import load_dotenv

from celery_worker import celery_worker
from process import chromosome_3D_data

load_dotenv()

# Redis connection
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB   = int(os.getenv("REDIS_DB", 0))

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# Keys for locking and task registry
WRITE_LOCK_KEY = "chromosome_3d_write_lock"
TASK_REGISTRY_HASH = "chromosome_3d_task_registry"


def _make_task_signature(cell_line: str, chromosome_name: str, sequences: dict, sample_id: int) -> str:
    """Return a deterministic hexadecimal signature for identifying duplicate tasks."""
    # Ensure stable ordering for hashing
    payload = {
        "cell_line": cell_line,
        "chromosome": chromosome_name,
        "start": sequences["start"],
        "end": sequences["end"],
        "sample_id": sample_id,
    }
    raw = json.dumps(payload, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


@celery_worker.task(bind=True, name="tasks.process_chromosome_3d")
def process_chromosome_3d(self, cell_line: str, chromosome_name: str, sequences: dict, sample_id: int):
    """Celery task wrapper around chromosome_3D_data.

    1. Uses Redis hash to skip scheduling identical tasks.
    2. Acquires a global Redis lock so only one task writes to DB at once.
    """
    signature = _make_task_signature(cell_line, chromosome_name, sequences, sample_id)

    print(f"[TASK {self.request.id}] Received request – signature: {signature}")

    # Deduplication check (idempotent): Only allow one task with this signature at a time.
    added = redis_client.hsetnx(TASK_REGISTRY_HASH, signature, self.request.id)
    if not added:
        print(f"[TASK {self.request.id}] Duplicate detected. Skipping execution.")
        return {
            "status": "duplicate_skipped",
            "detail": f"Task with signature {signature} already in progress."
        }

    print(f"[TASK {self.request.id}] Added to registry. Attempting to acquire write lock …")

    # Acquire global write lock so only one task writes at a time.
    lock = redis_client.lock(WRITE_LOCK_KEY, timeout=60 * 30, blocking_timeout=None)
    try:
        with lock:
            print(f"[TASK {self.request.id}] Write lock acquired. Starting chromosome_3D_data computation …")
            result = chromosome_3D_data(cell_line, chromosome_name, sequences, sample_id)
            print(f"[TASK {self.request.id}] chromosome_3D_data computation finished.")
    finally:
        # Clean up the registry so subsequent tasks can proceed
        redis_client.hdel(TASK_REGISTRY_HASH, signature)
        print(f"[TASK {self.request.id}] Task registry entry removed. Task completed.")

    return result 