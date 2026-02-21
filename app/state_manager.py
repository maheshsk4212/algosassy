import logging
import threading
from enum import Enum, auto

logger = logging.getLogger(__name__)

class SystemState(Enum):
    INITIALIZING = auto()
    AUTH_REQUIRED = auto()
    READY = auto()
    TRADING_DISABLED = auto()

class StateManager:
    """Centralized thread-safe system state controller."""
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._state = SystemState.INITIALIZING
                cls._instance._state_lock = threading.Lock()
        return cls._instance

    def get_state(self) -> SystemState:
        with self._state_lock:
            return self._state

    def set_state(self, new_state: SystemState):
        with self._state_lock:
            if self._state != new_state:
                logger.info(f"System State Changed: {self._state.name} -> {new_state.name}")
                self._state = new_state

    def is_ready(self) -> bool:
        return self.get_state() == SystemState.READY

# Global singleton instance
state_manager = StateManager()

def restrict_strategy_execution():
    """
    Guard method to prevent strategies from executing if system is not READY.
    Raises RuntimeError if not ready.
    """
    current_state = state_manager.get_state()
    if current_state != SystemState.READY:
        raise RuntimeError(f"Strategy execution blocked. Current system state: {current_state.name}")
