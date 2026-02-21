import logging
from typing import Optional

from app.core.time_provider import time_provider
from app.core.event_bus import event_bus, EventType

logger = logging.getLogger(__name__)

class ClockMonitor:
    """
    Monitors Exchange Clock Drift against local VPS NTP.
    If drift exceeds 1000ms, halts order placement to preserve trailing-window idempotency.
    """
    def __init__(self, critical_drift_ms: int = 1500, warning_drift_ms: int = 700):
        self.critical_drift_ms = critical_drift_ms
        self.warning_drift_ms = warning_drift_ms

    def verify_tick_drift(self, tick_timestamp_ms: Optional[int]):
        """Called directly by WebSocket on tick processing."""
        if not tick_timestamp_ms:
            return
            
        local_time_ms = time_provider.time_ms()
        # Exchange timestamp might be slightly behind network transit time, 
        # but if we are *ahead* by a huge margin, or *behind* by a huge margin, we have a problem.
        drift_ms = abs(local_time_ms - tick_timestamp_ms)
        
        if drift_ms > self.critical_drift_ms:
            logger.critical(f"⏰ CRITICAL CLOCK DRIFT: {drift_ms}ms. Triggering Kill Switch.")
            event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {
                "source": "ClockMonitor", 
                "reason": f"Clock drift {drift_ms}ms exceeds critical threshold of {self.critical_drift_ms}ms"
            })
            
        elif drift_ms > self.warning_drift_ms:
            # In a true prod app, we'd emit metrics or warning alerts here
            logger.warning(f"⏰ WARNING CLOCK DRIFT: {drift_ms}ms. NTP Sync may be failing.")

clock_monitor = ClockMonitor()
