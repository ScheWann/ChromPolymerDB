# Gunicorn configuration file for production deployment
import multiprocessing

# Server socket
bind = "0.0.0.0:5001"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gevent"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
preload_app = True

# Logging
loglevel = "info"
errorlog = "-"
accesslog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "chrompolymerdb_backend"

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Timeout
timeout = 30
keepalive = 2

# SSL
# keyfile = None
# certfile = None 