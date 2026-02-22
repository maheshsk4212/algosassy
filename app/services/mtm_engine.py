import logging
import threading
from typing import Dict, Optional

from app.core.event_bus import event_bus, EventType

logger = logging.getLogger(__name__)

class MTMEngine:
    """
    Maintains purely local real-time Unrealized PnL to allow
    for zero-network-latency evaluation of drawdowns.
    """
    def __init__(self):
        self._lock = threading.Lock()
        
        # Structure: { symbol: { position_size: int, avg_price: float } }
        self._synthetic_positions: Dict[int, Dict] = {}
        
        # Real-time state
        self._latest_prices: Dict[int, float] = {}
        
        self.unrealized_pnl: float = 0.0

    def update_price(self, symbol: int, last_price: float):
        """Called directly by WebSocket on tick update stream."""
        with self._lock:
            self._latest_prices[symbol] = last_price
            self._recompute_unrealized_pnl()

    def update_synthetic_position(self, symbol: int, size: int, avg_price: float):
        """Updated by ExecutionEngine / BrokerReconciliation upon successful sync."""
        with self._lock:
            if size == 0:
                self._synthetic_positions.pop(symbol, None)
            else:
                self._synthetic_positions[symbol] = {
                    "position_size": size,
                    "avg_price": avg_price
                }
            self._recompute_unrealized_pnl()

    def get_position_snapshot(self, symbol: int) -> Optional[Dict]:
        """Returns a copy of the synthetic position for a symbol, if present."""
        with self._lock:
            pos = self._synthetic_positions.get(symbol)
            if not pos:
                return None
            return {
                "position_size": int(pos.get("position_size", 0)),
                "avg_price": float(pos.get("avg_price", 0.0)),
            }

    def get_position_size(self, symbol: int) -> int:
        snapshot = self.get_position_snapshot(symbol)
        return int(snapshot["position_size"]) if snapshot else 0

    def apply_order_fill(self, symbol: int, direction: str, quantity: int, fill_price: float):
        """
        Applies an executed fill to local synthetic positions.
        Supports net long/short accounting but is primarily used for long-entry + sell-exit flow.
        """
        qty = int(quantity)
        if qty <= 0:
            return

        side = (direction or "").strip().upper()
        if side not in {"BUY", "SELL"}:
            return

        with self._lock:
            current = self._synthetic_positions.get(symbol, {"position_size": 0, "avg_price": 0.0})
            current_qty = int(current.get("position_size", 0))
            current_avg = float(current.get("avg_price", 0.0))

            if side == "BUY":
                if current_qty >= 0:
                    new_qty = current_qty + qty
                    if new_qty == 0:
                        self._synthetic_positions.pop(symbol, None)
                    else:
                        new_avg = (
                            ((current_avg * current_qty) + (fill_price * qty)) / new_qty
                            if current_qty > 0
                            else float(fill_price)
                        )
                        self._synthetic_positions[symbol] = {
                            "position_size": new_qty,
                            "avg_price": new_avg,
                        }
                else:
                    # Covering a short; if we flip long, reset average to fill price.
                    new_qty = current_qty + qty
                    if new_qty > 0:
                        self._synthetic_positions[symbol] = {
                            "position_size": new_qty,
                            "avg_price": float(fill_price),
                        }
                    elif new_qty == 0:
                        self._synthetic_positions.pop(symbol, None)
                    else:
                        self._synthetic_positions[symbol] = {
                            "position_size": new_qty,
                            "avg_price": current_avg,
                        }
            else:  # SELL
                if current_qty > 0:
                    new_qty = current_qty - qty
                    if new_qty > 0:
                        self._synthetic_positions[symbol] = {
                            "position_size": new_qty,
                            "avg_price": current_avg,
                        }
                    elif new_qty == 0:
                        self._synthetic_positions.pop(symbol, None)
                    else:
                        # Oversold beyond flat; treat the overflow as a short position.
                        self._synthetic_positions[symbol] = {
                            "position_size": new_qty,
                            "avg_price": float(fill_price),
                        }
                else:
                    # Opening / extending a short.
                    if current_qty < 0:
                        new_qty = current_qty - qty
                        new_avg = (
                            ((abs(current_avg * current_qty)) + (fill_price * qty)) / abs(new_qty)
                            if current_qty != 0
                            else float(fill_price)
                        )
                        self._synthetic_positions[symbol] = {
                            "position_size": new_qty,
                            "avg_price": new_avg,
                        }
                    else:
                        self._synthetic_positions[symbol] = {
                            "position_size": -qty,
                            "avg_price": float(fill_price),
                        }

            self._recompute_unrealized_pnl()

    def _recompute_unrealized_pnl(self):
        """Internal recalculation tightly scoped inside the lock."""
        pnl = 0.0
        for symbol, pos in self._synthetic_positions.items():
            current_price = self._latest_prices.get(symbol)
            if current_price is None:
                continue # Skip if no live price yet
                
            # Universal PnL formula: (MarketPrice - EntryPrice) * Quantity
            # If Qty is negative (Short), PnL is positive if MarketPrice < EntryPrice.
            diff = current_price - pos['avg_price']
            pnl += (diff * pos['position_size'])
            
        self.unrealized_pnl = pnl

    def get_realtime_pnl(self) -> float:
        """Lockless dirty read for massive throughput."""
        return self.unrealized_pnl

mtm_engine = MTMEngine()
