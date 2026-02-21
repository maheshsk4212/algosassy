import logging
import asyncio
from datetime import datetime, timedelta
import threading
from app.core.time_provider import time_provider

logging.basicConfig(level=logging.INFO)

from app.services.order_cache import shared_order_cache
from app.services.idempotency_manager import idempotency_manager
from app.services.symbol_lock import symbol_lock_manager, SymbolState
from app.models.trade_intent import TradeIntent, TradeDirection

try:
    import zoneinfo
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
except ImportError:
    from datetime import tzinfo, timedelta
    class IST(tzinfo):
        def utcoffset(self, dt): return timedelta(hours=5, minutes=30)
        def tzname(self, dt): return "IST"
        def dst(self, dt): return timedelta(0)
    IST = IST()


async def test_order_cache_rate_limits():
    print("\n--- Testing Shared Order Cache Rate Limit Protection ---")
    
    # Mock the internal property logic since we have no real credentials
    call_counter = {"hits": 0}
    
    async def mock_get_orders(*args, **kwargs):
        call_counter["hits"] += 1
        return []
        
    # We monkey patch it strictly for this test script so we can track network calls
    original_get_orders = shared_order_cache.get_orders
    
    async def get_orders_override(force_refresh=False):
        now = time_provider.time()
        if not force_refresh and (now - shared_order_cache._last_fetch_time) < shared_order_cache.cache_duration:
            return shared_order_cache._last_orders
        with shared_order_cache._lock:
            if not force_refresh and (time_provider.time() - shared_order_cache._last_fetch_time) < shared_order_cache.cache_duration:
                return shared_order_cache._last_orders
            await mock_get_orders() # Simulate network hit
            shared_order_cache._last_orders = []
            shared_order_cache._last_fetch_time = time_provider.time()
            return shared_order_cache._last_orders

    shared_order_cache.get_orders = get_orders_override

    # Simulate 10 simultaneous threads/async workers fetching orders inside the 1 second limit
    await asyncio.gather(*[shared_order_cache.get_orders() for _ in range(10)])
    
    print(f"Total concurrent requests: 10")
    print(f"Total simulated network API calls: {call_counter['hits']}")
    assert call_counter["hits"] == 1, "Cache failed to protect rate limit!"
    
    shared_order_cache.get_orders = original_get_orders

async def test_idempotency_sniff():
    print("\n--- Testing Clock-Drift Idempotency Sniffing ---")
    
    # Mocking a recent order generated EXACTLY 5 seconds ago in IST (Absorbing the 15 sec drift window)
    recent_ist = (datetime.now(IST) - timedelta(seconds=5)).strftime("%Y-%m-%d %H:%M:%S")

    shared_order_cache._last_orders = [{
        "instrument_token": "999",
        "transaction_type": "BUY",
        "quantity": 50,
        "status": "OPEN",
        "order_timestamp": recent_ist,
        "order_id": "SNIFFED_MOCK_ID_123"
    }]
    # Trick cache into thinking it's fresh
    shared_order_cache._last_fetch_time = time_provider.time() 
    
    intent = TradeIntent(
        strategy_name="sniff_test",
        symbol=999,
        direction=TradeDirection.BUY,
        entry_price=100.0,
        stop_loss=90.0,
        target=110.0
    )
    
    # In Phase 8, intent no longer carries size. The execution engine assigns it.
    duplicate_id = await idempotency_manager.sniff_for_duplicate(intent, assigned_size=50)
    print(f"Found Duplicate ID: {duplicate_id}")
    assert duplicate_id == "SNIFFED_MOCK_ID_123", "Failed to detect trailing window clock drift duplicate."

def test_symbol_execution_locks():
    print("\n--- Testing Symbol Execution Locking ---")
    
    sym = 777
    print(f"Initial State: {symbol_lock_manager.get_state(sym).name}")
    
    acquired1 = symbol_lock_manager.acquire_execution_lock(sym)
    print(f"Thread 1 Acquired? {acquired1} | State: {symbol_lock_manager.get_state(sym).name}")
    
    acquired2 = symbol_lock_manager.acquire_execution_lock(sym)
    print(f"Thread 2 Acquired concurrently? {acquired2} (Should be False) | State: {symbol_lock_manager.get_state(sym).name}")
    
    symbol_lock_manager.lock_critical(sym, reason="Circuit Bound Exhaustion Test")
    print(f"After Critical Lock: {symbol_lock_manager.get_state(sym).name}")
    
    assert acquired1 == True
    assert acquired2 == False
    assert symbol_lock_manager.get_state(sym) == SymbolState.CRITICAL_LOCKED

if __name__ == "__main__":
    asyncio.run(test_order_cache_rate_limits())
    asyncio.run(test_idempotency_sniff())
    test_symbol_execution_locks()
    
