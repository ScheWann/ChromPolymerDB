import os
import importlib
from dotenv import load_dotenv
from celery import Celery

load_dotenv()

# Redis settings
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", 6379)
REDIS_BROKER_DB = os.getenv("REDIS_BROKER_DB", 1)

broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_BROKER_DB}"
result_backend = broker_url

celery_worker = Celery("chrom_polymer_db", broker=broker_url, backend=result_backend)

# Celery configuration
celery_worker.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,  # Prevent workers from prefetching too many tasks
    # Connection and task timeout settings to prevent connection pool exhaustion
    task_soft_time_limit=1800,    # 30 minutes soft limit
    task_time_limit=2400,         # 40 minutes hard limit  
    worker_max_tasks_per_child=5, # Reduced from 10 to restart workers more frequently and prevent memory leaks
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    # Additional settings to handle generator cleanup and prevent connection issues
    task_reject_on_worker_lost=True,   # Reject tasks if worker connection is lost
    task_acks_late=True,               # Only acknowledge tasks after completion
    worker_disable_rate_limits=True,   # Disable rate limiting to prevent queue buildup
    result_expires=3600,               # Results expire after 1 hour
    # Performance optimizations for multiple concurrent tasks
    worker_pool_restarts=True,         # Enable worker pool restarts
    task_compression='gzip',           # Compress task payloads to reduce Redis memory usage
    result_compression='gzip',         # Compress results
    task_queue_max_priority=10,        # Enable task prioritization
) 

try:
    importlib.import_module("tasks")
except ModuleNotFoundError as exc:
    celery_worker.log.get_default_logger().warning(
        "Could not import the tasks module: %s", exc
    ) 