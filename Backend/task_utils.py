"""
Shared utilities for task management and deduplication.
"""
import json
import hashlib


# Redis key prefix for task registry
TASK_REGISTRY_PREFIX = "chromosome_3d_task:"


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
