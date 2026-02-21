import logging
import asyncio
import time
from app.core.time_provider import time_provider
from app.core.logging_config import setup_async_logging
from app.services.alert_manager import alert_manager
from app.core.event_bus import event_bus, EventType
from app.models.trade_intent import TradeIntent, TradeDirection

logger = logging.getLogger(__name__)

async def test_async_logging_latency():
    print("\n--- Testing Async Logging Latency ---")
    listener = setup_async_logging()
    
    start = time.perf_counter()
    for i in range(10000):
        # We test how fast the main thread can offload 10,000 logs
        logger.info(f"Test log {i}", extra={"trace_id": f"test_trace_{i}", "symbol": "AAPL"})
        
    end = time.perf_counter()
    elapsed = end - start
    
    print(f"Emitted 10,000 JSON logs in {elapsed:.4f} seconds.")
    # Assuming standard python overhead, should be < 0.5s because there's no disk IO
    assert elapsed < 1.0, f"Logging took too long! {elapsed}s"
    
    listener.stop()

async def test_alert_flood_suppression():
    print("\n--- Testing Alert Manager Flood Suppression ---")
    
    # We will spam 20 events in a loop
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Test Flood", "symbol": 999})
    
    # Let asyncio process the spawned tasks
    await asyncio.sleep(0.5) 
    print(f"Number of timestamps tracked in deque: {len(alert_manager._recent_alert_timestamps)}")
    print(f"Is Muted? {time_provider.time() < alert_manager._muted_until}")
    
    assert len(alert_manager._recent_alert_timestamps) == 0, "Deque should be cleared on mute"
    assert time_provider.time() < alert_manager._muted_until, "AlertManager failed to mute!"

def test_trace_id_generation():
    print("\n--- Testing Trace ID Auto-Generation ---")
    intent1 = TradeIntent(
        strategy_name="trace_test",
        symbol=100,
        direction=TradeDirection.BUY,
        entry_price=10.0,
        stop_loss=9.0,
        target=11.0
    )
    intent2 = TradeIntent(
        strategy_name="trace_test",
        symbol=100,
        direction=TradeDirection.BUY,
        entry_price=10.0,
        stop_loss=9.0,
        target=11.0
    )
    
    print(f"Intent 1 Trace ID: {intent1.trace_id}")
    print(f"Intent 2 Trace ID: {intent2.trace_id}")
    assert intent1.trace_id != intent2.trace_id, "Trace IDs are not unique!"

if __name__ == "__main__":
    test_trace_id_generation()
    asyncio.run(test_async_logging_latency())
    asyncio.run(test_alert_flood_suppression())
