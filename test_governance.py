import logging
import time
import asyncio

logging.basicConfig(level=logging.INFO)

from app.models.trade_intent import TradeIntent, TradeDirection
from app.services.governance_guard import governance_guard
from app.services.drift_monitor import drift_monitor
from app.services.audit_reporter import audit_reporter
from app.services.risk_engine import risk_engine
from app.core.event_bus import event_bus, EventType
from app.state_manager import state_manager, SystemState

def test_drift_monitor_edge_decay():
    print("\n--- Testing Edge Decay / Drift Monitor ---")
    strategy = "EMA_Cross"
    
    # Feed the drift monitor exactly 10 trades with huge losses
    # The expected standard for EMA_Cross is Mean: 150, Std: 300
    # Floor = 150 - (1.5 * 300) = -300.
    
    # Let's feed 9 trades doing fine
    for _ in range(9):
        drift_monitor.log_trade_closed(strategy, 150.0)
        
    # The 10th trade is a catastrophic stop slip, destroying the rolling mean
    # 9 * 150 = 1350. We need total to be < -3000 to drop mean to -300 per trade over window of 10.
    # 1350 - 4500 = -3150 / 10 = -315.
    
    # Subscribe to Event Bus to catch liquidation
    liquidation_caught = False
    details = {}
    
    def trap_event(data):
        nonlocal liquidation_caught, details
        liquidation_caught = True
        details = data

    event_bus.subscribe(EventType.EMERGENCY_LIQUIDATE, trap_event)
    
    print("Feeding sequential PnL logs to DriftMonitor...")
    drift_monitor.log_trade_closed(strategy, -4500.0)
    
    time.sleep(0.1) # Async context switch for Event Bus
    
    print(f"Liquidation Event Triggered? {liquidation_caught}")
    assert liquidation_caught == True, "Drift Monitor failed to detect Edge Decay string."
    assert "Decay exactly detected" in details["reason"]
    
def test_emotion_guard_lockout():
    print("\n--- Testing Emotion Guard Manual Trade Sandbox ---")
    
    intent = TradeIntent(
        strategy_name="revenge_test",
        symbol=555,
        direction=TradeDirection.BUY,
        entry_price=10.0,
        stop_loss=9.0,
        target=11.0
    )
    
    print("Simulating Broker Reconciliation detecting a manual trade on Ticker 555...")
    governance_guard.trigger_symbol_cooldown(555, hours=24.0)
    
    decision = risk_engine.evaluate_intent(intent)
    
    print(f"Risk Decision: {decision.approved} | Reason: {decision.rejection_reason}")
    assert decision.approved == False, "Governance Guard should have blocked."
    assert "Emotion Guard Active" in decision.rejection_reason

async def test_audit_run():
    print("\n--- Testing Weekly Governance Audit Generation ---")
    await audit_reporter.run_weekly_audit()
    print("Audit run complete. (Webhook bypassed in dev)")


if __name__ == "__main__":
    state_manager.set_state(SystemState.READY)
    test_drift_monitor_edge_decay()
    test_emotion_guard_lockout()
    asyncio.run(test_audit_run())
