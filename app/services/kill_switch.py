import logging
from app.core.event_bus import event_bus, EventType
from app.state_manager import state_manager, SystemState

logger = logging.getLogger(__name__)

class KillSwitch:
    """
    Subscribes to EMERGENCY_LIQUIDATE events.
    Does NOT call the broker directly. Simply flips the Mutex lock
    on the SystemState to freeze the incoming pipeline.
    """
    def __init__(self):
        event_bus.subscribe(EventType.EMERGENCY_LIQUIDATE, self._handle_kill_switch)

    def _handle_kill_switch(self, data: dict):
        reason = data.get("reason", "Unknown Critical Failure")
        source = data.get("source", "System")
        
        logger.critical(f"🚨 KILL SWITCH ACTIVATED by {source} 🚨 reason: {reason}")
        
        # 1. Flip global state
        state_manager.set_state(SystemState.TRADING_DISABLED)
        
        # The ExecutionEngine (Phase 5) will also subscribe to EMERGENCY_LIQUIDATE
        # and it will handle the complex logic of actually canceling open orders
        # and throwing market orders to flatten positions.

kill_switch = KillSwitch()
