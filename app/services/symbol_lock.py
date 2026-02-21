import logging
import threading
from enum import Enum
from typing import Dict

logger = logging.getLogger(__name__)

class SymbolState(str, Enum):
    NORMAL = "NORMAL"
    IN_EXECUTION = "IN_EXECUTION"
    CRITICAL_LOCKED = "CRITICAL_LOCKED"

class SymbolLockManager:
    """
    Prevents duplicate executions on the same symbol before the first confirms.
    Also acts as a circuit-breaker lock for symbols in cascading failure.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._states: Dict[int, SymbolState] = {}

    def get_state(self, symbol: int) -> SymbolState:
        with self._lock:
            return self._states.get(symbol, SymbolState.NORMAL)

    def acquire_execution_lock(self, symbol: int) -> bool:
        """Attempts to transition a symbol from NORMAL to IN_EXECUTION."""
        with self._lock:
            current = self._states.get(symbol, SymbolState.NORMAL)
            if current == SymbolState.NORMAL:
                self._states[symbol] = SymbolState.IN_EXECUTION
                logger.debug(f"Acquired execution lock for symbol {symbol}")
                return True
            logger.warning(f"Prevented execution on {symbol}. State is currently {current.name}")
            return False

    def release_execution_lock(self, symbol: int):
        """Transitions symbol back to NORMAL from IN_EXECUTION."""
        with self._lock:
            current = self._states.get(symbol, SymbolState.NORMAL)
            if current == SymbolState.IN_EXECUTION:
                self._states[symbol] = SymbolState.NORMAL
                logger.debug(f"Released execution lock for symbol {symbol}")

    def lock_critical(self, symbol: int, reason: str):
        """Hard locks a symbol. Requires manual/admin reset."""
        with self._lock:
            self._states[symbol] = SymbolState.CRITICAL_LOCKED
            logger.critical(f"🔒 SYMBOL {symbol} CRITICALLY LOCKED. Reason: {reason}")
            
    def unlock_critical(self, symbol: int):
        with self._lock:
            self._states[symbol] = SymbolState.NORMAL
            logger.info(f"🔓 SYMBOL {symbol} manual critical lock lifted.")

symbol_lock_manager = SymbolLockManager()
