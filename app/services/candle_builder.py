import logging
from collections import deque
from datetime import datetime, timezone
import threading
from typing import Dict

from app.models.tick_model import TickModel
from app.models.candle_model import CandleModel
from app.services.strategy_worker import strategy_worker

logger = logging.getLogger(__name__)

class CandleBuilder:
    def __init__(self, max_history: int = 200):
        self.max_history = max_history
        # Structure: { symbol: { timeframe: deque([CandleModel, ...]) } }
        self._candle_store: Dict[int, Dict[str, deque]] = {}
        # Thread-safe lock used exclusively during reads or critical writes
        self._store_lock = threading.Lock()
        
    def process_tick(self, tick: TickModel):
        """
        Takes a normalized tick and updates current 1-min OHLC candle.
        """
        # Ensure UTC time processing
        dt = tick.timestamp
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
            
        # Floor timestamp to nearest minute boundary for 1-min candle
        candle_start = dt.replace(second=0, microsecond=0)
        candle_end = candle_start.replace(second=59, microsecond=999999)
        timeframe = "1min"

        with self._store_lock:
            # Initialize data structure if empty
            if tick.instrument_token not in self._candle_store:
                self._candle_store[tick.instrument_token] = {}
            if timeframe not in self._candle_store[tick.instrument_token]:
                self._candle_store[tick.instrument_token][timeframe] = deque(maxlen=self.max_history)

            q = self._candle_store[tick.instrument_token][timeframe]
            
            # Logic: No candles yet OR new minute has started
            if len(q) == 0 or q[-1].start_time < candle_start:
                # Close the previous candle if it exists
                if len(q) > 0:
                    q[-1].is_closed = True
                    # TRIGGER STRATEGY EVALUATION (Push to background queue without blocking)
                    try:
                        strategy_worker.event_queue.put(q[-1].model_copy(), block=False)
                    except queue.Full:
                        logger.error("Strategy Event Queue is full! Dropping candle evaluation event.")
                    
                # Create a fresh candle
                new_candle = CandleModel(
                    instrument_token=tick.instrument_token,
                    start_time=candle_start,
                    end_time=candle_end,
                    timeframe=timeframe,
                    open=tick.last_price,
                    high=tick.last_price,
                    low=tick.last_price,
                    close=tick.last_price,
                    volume=tick.volume_traded
                )
                q.append(new_candle)
            
            # Logic: Update existing minute candle
            elif q[-1].start_time == candle_start:
                curr_candle = q[-1]
                curr_candle.high = max(curr_candle.high, tick.last_price)
                curr_candle.low = min(curr_candle.low, tick.last_price)
                curr_candle.close = tick.last_price
                curr_candle.volume = max(curr_candle.volume, tick.volume_traded) # cumulative volume usually
                
            # If tick is older than current candle, we ignore it (out of order tick edge-case)
            else:
                logger.debug(f"Late tick discarded for {tick.instrument_token}")

# Global Singleton representing in-memory OHLC datastore
candle_builder = CandleBuilder()
