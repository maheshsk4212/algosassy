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

    def _recompute_unrealized_pnl(self):
        """Internal recalculation tightly scoped inside the lock."""
        pnl = 0.0
        for symbol, pos in self._synthetic_positions.items():
            current_price = self._latest_prices.get(symbol)
            if current_price is None:
                continue # Skip if no live price yet
                
            # LONG ONLY assumption for Phase 4 architecture currently
            diff = current_price - pos['avg_price']
            pnl += (diff * pos['position_size'])
            
        self.unrealized_pnl = pnl

    def get_realtime_pnl(self) -> float:
        """Lockless dirty read for massive throughput."""
        return self.unrealized_pnl

mtm_engine = MTMEngine()
