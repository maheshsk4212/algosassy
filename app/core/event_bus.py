import logging
import threading
from typing import Callable, Dict, List
from enum import Enum

logger = logging.getLogger(__name__)

class EventType(str, Enum):
    EMERGENCY_LIQUIDATE = "EMERGENCY_LIQUIDATE"
    ORDER_FAILED = "ORDER_FAILED"
    ORDER_SUCCESS = "ORDER_SUCCESS"
    TICK_UPDATE = "TICK_UPDATE"

class EventBus:
    """
    Thread-safe synchronous Pub-Sub Event Bus for internal decoupling.
    """
    def __init__(self):
        self._subscribers: Dict[EventType, List[Callable]] = {}
        self._lock = threading.Lock()

    def subscribe(self, event_type: EventType, callback: Callable):
        with self._lock:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            if callback not in self._subscribers[event_type]:
                self._subscribers[event_type].append(callback)
                logger.debug(f"Subscribed {callback.__name__} to {event_type.name}")

    def publish(self, event_type: EventType, data: dict = None):
        """Dispatches event to all subscribers synchronously."""
        data = data or {}
        with self._lock:
            subscribers = list(self._subscribers.get(event_type, []))
            
        for callback in subscribers:
            try:
                callback(data)
            except Exception as e:
                logger.error(f"Error in subscriber {callback.__name__} for event {event_type.name}: {e}", exc_info=True)

event_bus = EventBus()
