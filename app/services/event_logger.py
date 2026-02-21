import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Very simple in-memory log for demo UI
_events = []

def log_event(category: str, message: str) -> None:
    event = {
        "category": category,
        "message": message,
        "timestamp_str": datetime.now().strftime("%H:%M:%S")
    }
    _events.insert(0, event)
    if len(_events) > 50:
        _events.pop()

def get_recent_events(limit: int = 5) -> List[Dict[str, Any]]:
    return _events[:limit]
