"""
Shared utilities for task management and deduplication.
"""
import json
import hashlib
import time


# Redis key prefix for task registry
TASK_REGISTRY_PREFIX = "chromosome_3d_task:"
USER_TASK_QUEUE_PREFIX = "user_task_queue:"
USER_ACTIVE_TASK_PREFIX = "user_active_task:"


def make_task_signature(cell_line: str, chromosome_name: str, sequences: dict, sample_id: int) -> str:
    """Return a deterministic hexadecimal signature for identifying duplicate tasks.
    
    Args:
        cell_line: The cell line name
        chromosome_name: The chromosome name  
        sequences: Dictionary containing 'start' and 'end' keys
        sample_id: The sample ID
        
    Returns:
        A hexadecimal string representing the task signature
    """
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


def get_task_key(signature: str) -> str:
    """Get the Redis key for a task signature.
    
    Args:
        signature: The task signature
        
    Returns:
        The Redis key for storing the task
    """
    return f"{TASK_REGISTRY_PREFIX}{signature}"


def get_user_task_queue_key(user_id: str) -> str:
    """Get the Redis key for a user's task queue.
    
    Args:
        user_id: The user identifier
        
    Returns:
        The Redis key for the user's task queue
    """
    return f"{USER_TASK_QUEUE_PREFIX}{user_id}"


def get_user_active_task_key(user_id: str) -> str:
    """Get the Redis key for a user's currently active task.
    
    Args:
        user_id: The user identifier
        
    Returns:
        The Redis key for the user's active task
    """
    return f"{USER_ACTIVE_TASK_PREFIX}{user_id}"


def cancel_user_pending_tasks(task_registry_redis, user_id: str, current_task_id: str):
    """Cancel all pending tasks for a user except the current one.
    
    Args:
        task_registry_redis: Redis connection for task registry
        user_id: The user identifier
        current_task_id: The current task ID to keep
    """
    queue_key = get_user_task_queue_key(user_id)
    
    # Get all tasks in the user's queue
    pending_tasks = task_registry_redis.lrange(queue_key, 0, -1)
    
    # Remove all tasks except the current one
    task_registry_redis.delete(queue_key)
    
    # Add back only the current task
    if current_task_id:
        task_registry_redis.lpush(queue_key, current_task_id)
    
    return len(pending_tasks) - (1 if current_task_id else 0)
