import asyncio
import logging
import threading
from unittest.mock import AsyncMock, MagicMock

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_audit_fixes")

# Import components to test
from app.services.kite_service import KiteService, init_kite_service, get_kite_service
from app.services.capital_registry import CapitalRegistry
from app.services.mtm_engine import MTMEngine
from app.services.governance_guard import GovernanceGuard

async def test_emergency_exit_shorts():
    print("\n--- 1. Testing Emergency Exit (Short Handling) ---")
    service = KiteService(api_key="mock")
    # Mock kite.positions and kite.place_order
    service._kite = MagicMock()
    service._kite.positions = MagicMock(return_value={
        "net": [
            {"tradingsymbol": "LONG_REL", "quantity": 100, "exchange": "NSE", "product": "MIS"},
            {"tradingsymbol": "SHORT_SBI", "quantity": -50, "exchange": "NSE", "product": "MIS"}
        ]
    })
    service._kite.positions.__name__ = "positions"
    service._kite.place_order = MagicMock(return_value="ORDER_123")
    service._kite.place_order.__name__ = "place_order"
    service._kite.TRANSACTION_TYPE_SELL = "SELL"
    service._kite.TRANSACTION_TYPE_BUY = "BUY"
    service._kite.VARIETY_REGULAR = "regular"
    service._kite.PRODUCT_MIS = "MIS"
    service._kite.ORDER_TYPE_MARKET = "MARKET"

    results = await service.exit_all_positions()
    
    # Assertions
    assert len(results) == 2
    calls = service._kite.place_order.call_args_list
    
    # Find the SELL order for LONG_REL
    long_order = next(c for c in calls if c.kwargs['tradingsymbol'] == "LONG_REL")
    assert long_order.kwargs['transaction_type'] == "SELL"
    assert long_order.kwargs['quantity'] == 100
    
    # Find the BUY order for SHORT_SBI
    short_order = next(c for c in calls if c.kwargs['tradingsymbol'] == "SHORT_SBI")
    assert short_order.kwargs['transaction_type'] == "BUY"
    assert short_order.kwargs['quantity'] == 50
    
    print("✓ Emergency Exit correctly handles longs and shorts.")

def test_capital_registry_concurrency():
    print("\n--- 2. Testing Capital Registry Concurrency ---")
    registry = CapitalRegistry(initial_capital=100000)
    
    # Mock data to trigger dictionary iteration during sum
    for i in range(100):
        registry._reservations[f"id_{i}"] = (100.0, 123456789.0)

    errors = []
    def noisy_reader():
        try:
            for _ in range(1000):
                registry.get_available_capital()
        except RuntimeError as e:
            errors.append(e)

    def noisy_writer():
        try:
            for i in range(1000):
                registry._reservations[f"writer_{i}"] = (1.0, 1.0)
                registry._reservations.pop(f"writer_{i}", None)
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=noisy_reader) for _ in range(5)]
    threads += [threading.Thread(target=noisy_writer) for _ in range(2)]

    for t in threads: t.start()
    for t in threads: t.join()

    assert len(errors) == 0, f"Concurrency errors detected: {errors}"
    print("✓ Capital Registry is thread-safe.")

def test_mtm_short_pnl():
    print("\n--- 3. Testing MTM Short Position PnL ---")
    engine = MTMEngine()
    
    # Setup a short position: -100 qty at ₹500
    engine.update_synthetic_position(symbol=456, size=-100, avg_price=500.0)
    
    # Case A: Price drops to 450 (Profit for short)
    engine.update_price(symbol=456, last_price=450.0)
    # Expected PnL: (450 - 500) * -100 = -50 * -100 = +5000
    assert engine.get_realtime_pnl() == 5000.0
    
    # Case B: Price rises to 550 (Loss for short)
    engine.update_price(symbol=456, last_price=550.0)
    # Expected PnL: (550 - 500) * -100 = 50 * -100 = -5000
    assert engine.get_realtime_pnl() == -5000.0
    
    print("✓ MTM Engine correctly computes PnL for short positions.")

def test_governance_peak_equity_sync():
    print("\n--- 4. Testing Governance Peak Equity Sync ---")
    registry = CapitalRegistry(initial_capital=250000)
    # Governance guard imports current capital_registry, so we need to ensure it sees the right value
    # For this test, we mimic the logic or use the actual guard if we can mock the registry it uses.
    
    # Actual guard logic: self.peak_equity = capital_registry.total_capital
    from app.services.governance_guard import GovernanceGuard
    from app.services.capital_registry import capital_registry as global_registry
    
    # Temporarily override global registry total for sync check
    original_total = global_registry.total_capital
    try:
        global_registry.total_capital = 300000.0
        guard = GovernanceGuard()
        assert guard.peak_equity == 300000.0
    finally:
        global_registry.total_capital = original_total
        
    print("✓ Governance Guard dynamically picks up starting capital baseline.")

async def run_all():
    await test_emergency_exit_shorts()
    test_capital_registry_concurrency()
    test_mtm_short_pnl()
    test_governance_peak_equity_sync()
    print("\nALL AUDIT FIX TESTS PASSED! 🛡️")

if __name__ == "__main__":
    asyncio.run(run_all())
