import logging
import asyncio
from typing import Optional

from app.models.risk_decision import RiskDecision
from app.services.symbol_lock import symbol_lock_manager
from app.services.idempotency_manager import idempotency_manager
from app.services.kite_service import get_kite_service
from app.services.order_cache import shared_order_cache
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
        self._broker = None
        self._use_live_broker = True

        # Subscribe to emergency liquidation events
        event_bus.subscribe(EventType.EMERGENCY_LIQUIDATE, self._handle_emergency_liquidation)

    def use_live_broker(self):
        """Resets any injected broker and binds to live broker lazily."""
        self._use_live_broker = True
        self._broker = None

    def _resolve_broker(self):
        if self._broker is not None:
            return self._broker

        if not self._use_live_broker:
            raise RuntimeError("No broker configured for execution engine.")

        self._broker = get_kite_service()
        return self._broker

    def _handle_emergency_liquidation(self, data: dict):
        """
        Catastrophic exit. Flattens all positions via the broker interface.
        Triggered by Governance Guard or manual Emergency Guard button.
        """
        reason = data.get("reason", "Unknown Emergency")
        logger.critical(f"🛑 EXECUTION ENGINE: LIQUIDATING ALL POSITIONS. Reason: {reason}")

        try:
            broker = self._resolve_broker()
            # We fire and forget this as it might take time, but it's a critical block
            asyncio.create_task(broker.exit_all_positions())
        except Exception as e:
            logger.error(f"Emergency liquidation skipped: broker unavailable ({e})")

    def set_broker(self, broker_instance):
        """Allows injecting the mocked backtester broker."""
        self._broker = broker_instance
        self._use_live_broker = False
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
                self._emit_success(
                    res_id=reservation_id,
                    symbol=symbol,
                    qty=decision.assigned_position_size,
                    price=intent.entry_price,
                    direction=intent.direction.value,
                    is_exit=intent.is_exit,
                    update_position=False,
                )
                symbol_lock_manager.release_execution_lock(symbol)
                return

            # 2. Broker Execution Loop (Circuit Limit Handlers)
            # In Phase 8, execution engine actually needs the sized lot.
            success = await self._attempt_broker_execution(intent, decision.assigned_position_size)

            if success:
                logger.info(f"Order successfully placed for {symbol}")
                self._emit_success(
                    res_id=reservation_id,
                    symbol=symbol,
                    qty=decision.assigned_position_size,
                    price=intent.entry_price,
                    direction=intent.direction.value,
                    is_exit=intent.is_exit,
                    update_position=True,
                )
            else:
                logger.error(f"Execution Failed for {symbol} after {self.max_retries} attempts. Rollback triggered.")
                self._emit_failure(
                    res_id=reservation_id,
                    symbol=symbol,
                    direction=intent.direction.value,
                    is_exit=intent.is_exit,
                )
                symbol_lock_manager.lock_critical(symbol, reason="Exhausted Circuit Limit Execution Attempts")

        except Exception as e:
            logger.critical(f"Unhandled Execution Engine Exception for {symbol}: {e}", exc_info=True)
            self._emit_failure(
                res_id=reservation_id,
                symbol=symbol,
                direction=intent.direction.value,
                is_exit=intent.is_exit,
            )
        
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
        broker = self._resolve_broker()
        for attempt in range(1, self.max_retries + 1):
            try:
                # INTERFACE CALL (Kite Service or Backtest Broker)
                success = await broker.place_order(intent, assigned_position_size)
                
                if success:
                    # Pull fresh broker orders on the next read after any successful placement.
                    shared_order_cache.invalidate()
                    return True 
                
            except Exception as e:
                logger.warning(f"Broker Order Attempt {attempt} failed: {e}")
                if attempt == self.max_retries:
                    return False
                await asyncio.sleep(0.5) # tiny wait between burst retries
                
        return False

    def _emit_success(
        self,
        res_id: Optional[str],
        symbol: int,
        qty: int,
        price: float,
        direction: str,
        is_exit: bool,
        update_position: bool,
    ):
        release_notional = 0.0
        side = (direction or "").strip().upper()
        if side == "SELL" and update_position:
            snapshot = mtm_engine.get_position_snapshot(symbol)
            if snapshot and int(snapshot.get("position_size", 0)) > 0:
                closable_qty = min(int(snapshot["position_size"]), int(qty))
                release_notional = closable_qty * float(snapshot.get("avg_price", 0.0))

        event_bus.publish(
            EventType.ORDER_SUCCESS,
            {
                "reservation_id": res_id,
                "symbol": symbol,
                "direction": side,
                "quantity": int(qty),
                "price": float(price),
                "is_exit": bool(is_exit),
                "capital_release": float(release_notional),
            },
        )
        # Update local synthetic position only when this execution path truly placed the order.
        if update_position:
            mtm_engine.apply_order_fill(symbol, side, int(qty), float(price))

    def _emit_failure(self, res_id: Optional[str], symbol: int, direction: str, is_exit: bool):
        event_bus.publish(
            EventType.ORDER_FAILED,
            {
                "reservation_id": res_id,
                "symbol": symbol,
                "direction": (direction or "").strip().upper(),
                "is_exit": bool(is_exit),
            },
        )

execution_engine = ExecutionEngine()
