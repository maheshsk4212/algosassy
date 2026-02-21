from fastapi import APIRouter
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
        }
    }
