import logging
import asyncio
from typing import Optional

from app.models.risk_decision import RiskDecision
from app.services.symbol_lock import symbol_lock_manager
from app.services.idempotency_manager import idempotency_manager
from app.services.kite_service import kite_service
from app.core.event_bus import event_bus, EventType
from app.services.mtm_engine import mtm_engine

logger = logging.getLogger(__name__)

class ExecutionEngine:
    """
    Final API Executor. Employs 3-attempt circuit limit protection.
    Notifies EventBus on terminal states (SUCCESS/FAILED).
    """
    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries
        self._broker = kite_service # Default to Live interface
        
        # Subscribe to emergency liquidation events
        event_bus.subscribe(EventType.EMERGENCY_LIQUIDATE, self._handle_emergency_liquidation)

    def _handle_emergency_liquidation(self, data: dict):
        """
        Catastrophic exit. Flattens all positions via the broker interface.
        Triggered by Governance Guard or manual Emergency Guard button.
        """
        reason = data.get("reason", "Unknown Emergency")
        logger.critical(f"🛑 EXECUTION ENGINE: LIQUIDATING ALL POSITIONS. Reason: {reason}")
        
        # We fire and forget this as it might take time, but it's a critical block
        asyncio.create_task(self._broker.exit_all_positions())

    def set_broker(self, broker_instance):
        """Allows injecting the mocked backtester broker."""
        self._broker = broker_instance
        logger.info(f"Execution Engine broker injected: {broker_instance.__class__.__name__}")

    async def execute_decision(self, decision: RiskDecision):
        """Main async entrypoint. Validates decision payload and triggers locked execution loop."""
        if not decision.approved:
            logger.debug(f"Execution Engine received unapproved intent. Ignoring.")
            return

        intent = decision.original_intent
        symbol = intent.symbol
        reservation_id = decision.reservation_id

        logger.info(f"Execution Engine starting flight for {symbol} | Vol: {decision.assigned_position_size}")

        try:
            # 1. Idempotency Check (Clock Drift Safe)
            # We must pass assigned_position_size so it sniffs for the matched broker size
            existing_id = await idempotency_manager.sniff_for_duplicate(intent, decision.assigned_position_size)
            if existing_id:
                logger.info(f"Adopted existing broker order {existing_id} for {symbol}. Releasing capital hold safely.")
                self._emit_success(reservation_id, symbol, decision.assigned_position_size, intent.entry_price)
                symbol_lock_manager.release_execution_lock(symbol)
                return

            # 2. Broker Execution Loop (Circuit Limit Handlers)
            # In Phase 8, execution engine actually needs the sized lot.
            success = await self._attempt_broker_execution(intent, decision.assigned_position_size)

            if success:
                logger.info(f"Order successfully placed for {symbol}")
                self._emit_success(reservation_id, symbol, decision.assigned_position_size, intent.entry_price)
            else:
                logger.error(f"Execution Failed for {symbol} after {self.max_retries} attempts. Rollback triggered.")
                self._emit_failure(reservation_id)
                symbol_lock_manager.lock_critical(symbol, reason="Exhausted Circuit Limit Execution Attempts")

        except Exception as e:
            logger.critical(f"Unhandled Execution Engine Exception for {symbol}: {e}", exc_info=True)
            self._emit_failure(reservation_id)
        
        finally:
            # We never leave the symbol in IN_EXECUTION state. If we fail entirely, it transitions to CRITICAL_LOCKED.
            # If successful, it's NORMAL.
            # Note: lock_critical overwrites NORMAL anyway.
            symbol_lock_manager.release_execution_lock(symbol)


    async def _attempt_broker_execution(self, intent, assigned_position_size: int) -> bool:
        """
        Mocked loop representing the fallback logic required when making kite.place_order().
        In real environments, this would catch specific exceptions (Circuit Limit, Freeze limits)
        and implement offset adjustments or slippage increases up to max_retries.
        """
        for attempt in range(1, self.max_retries + 1):
            try:
                # INTERFACE CALL (Kite Service or Backtest Broker)
                success = await self._broker.place_order(intent, assigned_position_size)
                
                if success:
                    return True 
                
            except Exception as e:
                logger.warning(f"Broker Order Attempt {attempt} failed: {e}")
                if attempt == self.max_retries:
                    return False
                await asyncio.sleep(0.5) # tiny wait between burst retries
                
        return False

    def _emit_success(self, res_id: str, symbol: int, qty: int, price: float):
        event_bus.publish(EventType.ORDER_SUCCESS, {"reservation_id": res_id})
        # Immediately synthetic update MTM for latency reasons before Reconciliation hits
        mtm_engine.update_synthetic_position(symbol, qty, price)

    def _emit_failure(self, res_id: str):
        event_bus.publish(EventType.ORDER_FAILED, {"reservation_id": res_id})

execution_engine = ExecutionEngine()
