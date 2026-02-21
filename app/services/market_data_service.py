import logging
from typing import List, Optional

from app.services.candle_builder import candle_builder
from app.models.candle_model import CandleModel

logger = logging.getLogger(__name__)

class MarketDataService:
    """
    Exclusive read-layer for accessing actively built market data.
    Provides encapsulated, thread-safe reading of candles for the Strategy Engine, 
    preventing race conditions with the consumer thread currently appending to the deque.
    """
    def get_latest_candle(self, symbol: int, timeframe: str = "1min") -> Optional[CandleModel]:
        """Fetch the most recent candle (which may be open)."""
        with candle_builder._store_lock:
            store = candle_builder._candle_store
            
            if symbol not in store or timeframe not in store[symbol]:
                return None
                
            q = store[symbol][timeframe]
            if len(q) == 0:
                return None
                
            # Return a copy to prevent downstream mutation issues
            return q[-1].model_copy()

    def get_last_n_candles(self, symbol: int, n: int, timeframe: str = "1min") -> List[CandleModel]:
        """Fetch the last N candles up to the max retained history."""
        with candle_builder._store_lock:
            store = candle_builder._candle_store
            
            if symbol not in store or timeframe not in store[symbol]:
                return []
                
            q = store[symbol][timeframe]
            # Slicing from a deque creates a list of references. 
            # We copy models for true thread safe encapsulation.
            return [candle.model_copy() for candle in list(q)[-n:]]
            
    def get_last_closed_candle(self, symbol: int, timeframe: str = "1min") -> Optional[CandleModel]:
        """Fetch the most recent completely formed candle. Important for strategies."""
        with candle_builder._store_lock:
            store = candle_builder._candle_store
            
            if symbol not in store or timeframe not in store[symbol]:
                return None
                
            q = list(store[symbol][timeframe])
            
            # Iterate backwards through history to find the most recent closed one
            for candle in reversed(q):
                if candle.is_closed:
                    return candle.model_copy()
            return None

market_data_service = MarketDataService()
