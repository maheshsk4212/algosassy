import logging
import uuid
import random
from typing import Dict, Any, Optional

from app.core.time_provider import time_provider
from app.core.event_bus import event_bus, EventType
from app.models.trade_intent import TradeIntent
from app.models.risk_decision import RiskDecision

logger = logging.getLogger(__name__)

class SimulatedBrokerAdapter:
    """
    Phase 7: Offline Mock Broker for Backtesting.
    Mimics Kite Connect's 'place_order' and applies synthetic slippage.
    Automatically emits ORDER_SUCCESS or ORDER_FAILED identical to live events.
    """
    def __init__(self):
        # 0.05% slippage default
        self.default_slippage_bps = 5 
        # Chance an order gets rejected by Exchange artificially in backtest
        self.artificial_rejection_rate = 0.01 
        
    def _apply_slippage(self, direction: str, target_price: float, bps: float) -> float:
        """Worsens the fill price based on direction."""
        slip_ratio = bps / 10000.0
        if direction == "BUY":
            return target_price * (1 + slip_ratio)
        else: # SELL
            return target_price * (1 - slip_ratio)

    async def place_order(self, decision: RiskDecision, intent: TradeIntent) -> bool:
        """
        Mimics execution_engine's interaction with the real broker.
        """
        # 1. Simulate Network/Exchange Rejection
        if random.random() < self.artificial_rejection_rate:
            logger.warning(f"SIMULATED BROKER: Synthetic Rejection hit for {intent.symbol}")
            event_bus.publish(EventType.ORDER_FAILED, {"reservation_id": decision.reservation_id})
            return False

        # 2. Simulate Fill and Slippage
        filled_price = self._apply_slippage(
            direction=intent.direction.value, 
            target_price=intent.entry_price, 
            bps=self.default_slippage_bps
        )
        
        # 3. Formulate Mock Order payload analogous to Kite response
        order_id = f"SIM_{uuid.uuid4().hex[:8].upper()}"
        
        # 4. Success Emission
        logger.info(f"SIMULATED BROKER: Filled {decision.assigned_position_size} of {intent.symbol} @ {filled_price:.2f} (Target: {intent.entry_price})")
        
        # Push mock event into EventBus so CapitalRegistry confirms the reservation
        event_bus.publish(EventType.ORDER_SUCCESS, {
            "symbol": intent.symbol,
            "reservation_id": decision.reservation_id,
            "order_id": order_id,
            "filled_quantity": decision.assigned_position_size,
            "average_price": filled_price,
            "timestamp": time_provider.time()
        })
        return True

simulated_broker = SimulatedBrokerAdapter()
