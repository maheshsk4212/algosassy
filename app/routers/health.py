from fastapi import APIRouter
import psutil
from app.services.tick_queue_manager import tick_queue_manager
from app.services.websocket_manager import websocket_manager
from app.services.tick_processor import tick_processor
from app.services.candle_builder import candle_builder

router = APIRouter(prefix="/market", tags=["Market Data Monitoring"])

@router.get("/health")
async def get_market_health():
    """Diagnostic health route for Phase 2 data engine."""
    
    # Safely fetch recent diagnostic stats
    queue_size = tick_queue_manager.get_queue_size()
    dropped_ticks = tick_queue_manager.dropped_ticks
    last_tick_timestamp = tick_processor.last_tick_timestamp
    
    return {
        "websocket": {
            "connected": websocket_manager.is_connected,
            "subscribed_tokens": websocket_manager.subscribed_tokens
        },
        "buffer_queue": {
            "current_size": queue_size,
            "max_size": tick_queue_manager.maxsize,
            "dropped_ticks": dropped_ticks,
            "is_healthy": tick_queue_manager.is_healthy()
        },
        "tick_processor": {
            "thread_alive": tick_processor._consumer_thread.is_alive() if tick_processor._consumer_thread else False,
            "last_tick_timestamp": last_tick_timestamp
        },
        "candle_builder": {
            "symbols_tracked": list(candle_builder._candle_store.keys()) # Thread-safe shallow read
        },
        "system_os": {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent
        }
    }

@router.get("/subsystems")
async def get_subsystems_health():
    """Returns real-time health status of each internal sub-system for the dashboard UI."""
    from app.services.broker_reconciliation import broker_reconciliation_service
    from app.services.drift_monitor import drift_monitor
    from app.services.capital_registry import capital_registry
    from app.state_manager import state_manager
    import time as _t

    reservation_count = len(capital_registry._reservations)
    queue_depth = tick_queue_manager.get_queue_size()

    systems = [
        {
            "name": "Reconciliation Engine",
            "detail": f"Watching {len(broker_reconciliation_service._mismatch_watch)} mismatch(es)",
            "status": "WARNING" if broker_reconciliation_service._mismatch_watch else "HEALTHY"
        },
        {
            "name": "Capital Reservation Queue",
            "detail": f"{reservation_count} order(s) pending capital lock",
            "status": "ELEVATED" if reservation_count > 3 else "HEALTHY"
        },
        {
            "name": "Tick Data Buffer",
            "detail": f"Queue depth: {queue_depth} msgs",
            "status": "WARNING" if queue_depth > 150 else "HEALTHY"
        },
        {
            "name": "Drift Monitor",
            "detail": f"{len(drift_monitor._strategy_pnls)} strategy/strategies tracked",
            "status": "HEALTHY"
        },
        {
            "name": "System State",
            "detail": state_manager.get_state().name,
            "status": "HEALTHY" if state_manager.get_state().name in ["READY", "TRADING"] else "WARNING"
        }
    ]

    return {"subsystems": systems}
