import logging
import logging.handlers
import queue
import json
import sys
from datetime import datetime
try:
    import zoneinfo
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
except ImportError:
    from datetime import tzinfo, timedelta
    class IST(tzinfo):
        def utcoffset(self, dt): return timedelta(hours=5, minutes=30)
        def tzname(self, dt): return "IST"
        def dst(self, dt): return timedelta(0)
    IST = IST()

class JSONFormatter(logging.Formatter):
    """
    Format logs as JSON lines for ingestion (e.g. ELK, Datadog), structured tightly.
    Always uses Asia/Kolkata timezone.
    """
    def format(self, record: logging.LogRecord) -> str:
        # Avoid blocking timestamp calls inside format, ideally time is grabbed at emit
        # but Python's logrecord creation handles that mostly. We just format it to IST.
        log_obj = {
            "timestamp": datetime.fromtimestamp(record.created, tz=IST).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Inject custom 'extra' kwargs dynamically (Trace ID, etc)
        for key, val in record.__dict__.items():
            if key not in ['args', 'asctime', 'created', 'exc_info', 'exc_text', 'filename',
                           'funcName', 'id', 'levelname', 'levelno', 'lineno', 'module',
                           'msecs', 'msg', 'name', 'pathname', 'process', 'processName',
                           'relativeCreated', 'stack_info', 'thread', 'threadName', 'taskName']:
                log_obj[key] = val
                
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_obj)

def setup_async_logging():
    """
    Overhauls the root logger. Replaces blocking Stream/File handlers with
    a single QueueHandler. Starts a background thread listener pulling from the queue.
    Ensures O(1) latency on hot-path log emissions.
    """
    log_queue = queue.Queue(-1) # Infinite queue for safety, alert via metrics if depth > 1000
    
    # 1. The Async Sink
    queue_handler = logging.handlers.QueueHandler(log_queue)
    
    # 2. The Actual blocking writers
    console_handler = logging.StreamHandler(sys.stdout)
    file_handler = logging.handlers.TimedRotatingFileHandler(
        "algo_sassy.log", when="midnight", interval=1, backupCount=30
    )
    
    json_formatter = JSONFormatter()
    file_handler.setFormatter(json_formatter)
    
    # Optional console formatting for readability while developing
    console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    # 3. The threaded listener
    listener = logging.handlers.QueueListener(
        log_queue, 
        console_handler, 
        file_handler,
        respect_handler_level=True
    )
    
    # Strip existing Root handlers and replace with our FAST queue handler
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(queue_handler)
    root_logger.setLevel(logging.INFO)
    
    # Start the background disk-write thread
    listener.start()
    
    # Expose stop method for graceful shutdown in main.py lifespan
    return listener

# We will init this inside main.py lifespan.
