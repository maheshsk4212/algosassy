import logging
import threading
import time

logging.basicConfig(level=logging.INFO)

from app.models.trade_intent import TradeIntent, TradeDirection
from app.services.risk_engine import risk_engine
from app.services.mtm_engine import mtm_engine
from app.services.capital_registry import capital_registry
from app.services import kill_switch
from app.core.event_bus import event_bus, EventType
from app.state_manager import state_manager, SystemState

def test_atomic_reservations():
    print("\n--- Testing Atomic Reservations (Concurrent) ---")
    state_manager.set_state(SystemState.READY)
    
    intent = TradeIntent(
        strategy_name="concurrent_test",
        symbol=123,
        direction=TradeDirection.BUY,
        entry_price=1000.0,
        stop_loss=900.0,
        target=1200.0
    )
    
    results = []
    
    def worker():
        decision = risk_engine.evaluate_intent(intent)
        results.append(decision.approved)

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()
    
    approved_count = results.count(True)
    rejected_count = results.count(False)
    
    print(f"Initial Capital (Hardcoded Default): 100,000")
    print(f"Total Intents Sent: 10 (Dynamic sizing will approve based on 100k equity)")
    print(f"Approved: {approved_count} | Rejected: {rejected_count}")
    print(f"Available Capital Left: {capital_registry.get_available_capital()}")
    # With 100k equity, 1% risk = 1000. ATR = 15. Size = 66. Cost = 66000.
    # Only 1 approval fits into 100k capital.
    assert approved_count == 1, "Should exactly approve 1 due to dynamic regime sizing"
    assert rejected_count == 9, "Should exactly reject 9"


def test_reversibility():
    print("\n--- Testing Capital Reversibility on Event Failure ---")
    intent = TradeIntent(
        strategy_name="fail_test",
        symbol=124,
        direction=TradeDirection.BUY,
        entry_price=1000.0,
        stop_loss=900.0,
        target=1200.0
    )
    
    # 1. We start from whatever the previous test left us. Let's capture it.
    capital_registry.total_capital += 10000.0
    initial_available = capital_registry.get_available_capital()
    print(f"Added fresh 10,000. Available before intent: {initial_available}")
    
    decision = risk_engine.evaluate_intent(intent)
    print(f"Risk Decision: {decision.approved} | Reservation: {decision.reservation_id}")
    print(f"Available after intent: {capital_registry.get_available_capital()}")
    
    # Fire order failure
    print("Firing EVENT -> ORDER_FAILED")
    event_bus.publish(EventType.ORDER_FAILED, {"reservation_id": decision.reservation_id})
    print(f"Available after rollback: {capital_registry.get_available_capital()}")
    
    assert capital_registry.get_available_capital() == initial_available, "Capital should be fully rolled back"

def test_kill_switch():
    print("\n--- Testing Kill Switch Routing ---")
    state_manager.set_state(SystemState.READY)
    
    print("Publishing EMERGENCY_LIQUIDATE via EventBus")
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {"reason": "Manual Execution Override"})
    
    time.sleep(0.1) # small wait for event sub
    current_state = state_manager.get_state()
    print(f"System State verified as: {current_state.name}")
    assert current_state == SystemState.TRADING_DISABLED, "State did not lock down!"
    

if __name__ == "__main__":
    test_atomic_reservations()
    test_reversibility()
    test_kill_switch()
