import logging
import threading
import uuid
from typing import Dict, Tuple

from app.core.time_provider import time_provider

from app.models.trade_intent import TradeIntent
from app.core.event_bus import event_bus, EventType

logger = logging.getLogger(__name__)

class CapitalRegistry:
    """
    Thread-Safe Atomic Capital Reservation System.
    Prevents double-spending by temporarily withholding capital during the flight of an order.
    """
    def __init__(self, initial_capital: float = 100000.0, reservation_expiry_seconds: int = 15):
        self._lock = threading.Lock()
        
        self.total_capital: float = initial_capital
        self.used_capital: float = 0.0  # Actually deployed in market
        
        # { reservation_id: (amount, timestamp) }
        self._reservations: Dict[str, Tuple[float, float]] = {}
        
        self.reservation_expiry_seconds = reservation_expiry_seconds
        
        # Self-healing hook
        event_bus.subscribe(EventType.ORDER_SUCCESS, self._handle_order_success)
        event_bus.subscribe(EventType.ORDER_FAILED, self._handle_order_failure)

    def get_available_capital(self) -> float:
        """Atomic read of available capital (net of used and reserved)."""
        with self._lock:
            reserved = sum(amount for amount, _ in self._reservations.values())
            return self.total_capital - self.used_capital - reserved

    def reserve(self, intent: TradeIntent, assigned_position_size: int) -> Tuple[bool, str]:
        """
        Atomic Phase 2: Acquire lock, re-validate, reserve.
        """
        amount_required = intent.entry_price * assigned_position_size
        
        with self._lock:
            # Recompute exact available inside lock
            reserved = sum(amount for amount, _ in self._reservations.values())
            true_available = self.total_capital - self.used_capital - reserved
            
            if true_available >= amount_required:
                res_id = str(uuid.uuid4())
                self._reservations[res_id] = (amount_required, time_provider.time())
                logger.debug(f"Capital Reserved: {amount_required} | ID: {res_id} | Avail left: {true_available - amount_required}")
                return True, res_id
            else:
                logger.warning(f"Insufficient Capital to reserve {amount_required}. Max available: {true_available}")
                return False, ""

    def confirm_reservation(self, res_id: str):
        """Called upon successful broker execution. Moves reserved -> used."""
        with self._lock:
            if res_id in self._reservations:
                amount, _ = self._reservations.pop(res_id)
                self.used_capital += amount
                logger.info(f"Reservation {res_id} confirmed. Capital {amount} deployed.")

    def release_reservation(self, res_id: str):
        """Atomic rollback. Returns capital to available pool."""
        with self._lock:
            if res_id in self._reservations:
                amount, _ = self._reservations.pop(res_id)
                logger.info(f"Reservation {res_id} released. Capital {amount} returned.")

    def sweep_expired_reservations(self):
        """Fail-safe background process to catch orphaned reservations."""
        now = time_provider.time()
        with self._lock:
            expired_ids = [
                r_id for r_id, (amt, ts) in self._reservations.items() 
                if now - ts > self.reservation_expiry_seconds
            ]
            for r_id in expired_ids:
                amount, _ = self._reservations.pop(r_id)
                logger.error(f"Sweeping orphaned reservation {r_id} ({amount}). Broker sync needed.")

    def _handle_order_failure(self, data: dict):
        """Event Bus listener allowing Execution Engine to rollback Risk cleanly."""
        res_id = data.get("reservation_id")
        if res_id:
            logger.warning(f"Event ORDER_FAILED trapped. Releasing capital {res_id}")
            self.release_reservation(res_id)

    def _handle_order_success(self, data: dict):
        """Event Bus listener to confirm reservations after successful broker placement."""
        res_id = data.get("reservation_id")
        if res_id:
            self.confirm_reservation(res_id)

capital_registry = CapitalRegistry()
