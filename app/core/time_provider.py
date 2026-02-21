import time
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class TimeProvider:
    """
    Phase 7: Central Time Source.
    In Live mode, returns actual system time.
    In Backtest mode, returns simulated tick time.
    Decouples all TTLs, Caches, and Drift Monitors from OS clock.
    """
    def __init__(self):
        self._is_live = True
        self._simulated_time_ms: int = 0
        
    def set_live_mode(self, is_live: bool):
        self._is_live = is_live
        logger.info(f"TimeProvider mapped to Live Mode: {is_live}")
        
    def set_simulated_time(self, timestamp_ms: int):
        if self._is_live:
             logger.warning("Attempted to set simulated time while in Live Mode. Ignored.")
             return
        self._simulated_time_ms = timestamp_ms

    def time(self) -> float:
        """Returns time in seconds since epoch."""
        if self._is_live:
            return time.time()
        return self._simulated_time_ms / 1000.0

    def time_ms(self) -> int:
        """Returns time in milliseconds since epoch."""
        if self._is_live:
            return int(time.time() * 1000)
        return self._simulated_time_ms

    def utcnow(self) -> datetime:
        """Returns an aware UTC datetime object."""
        if self._is_live:
            return datetime.now(timezone.utc)
        return datetime.fromtimestamp(self._simulated_time_ms / 1000.0, tz=timezone.utc)

time_provider = TimeProvider()
