import logging
import threading
import time
from typing import Optional

from app.models.tick_model import TickModel
from app.services.tick_queue_manager import tick_queue_manager
from app.services.candle_builder import candle_builder
from app.state_manager import state_manager, SystemState

logger = logging.getLogger(__name__)

class TickProcessor:
    """
    Consumer Thread worker. Reads from bounded queue and processes data 
    sequentially safely away from the websocket asyncio loop.
    """
    def __init__(self):
        self._running = False
        self._consumer_thread: Optional[threading.Thread] = None
        self.last_tick_timestamp: Optional[str] = None

    def start_worker(self):
        if self._running:
            return
            
        self._running = True
        # Daemon=True ensures it dies properly when the server stops
        self._consumer_thread = threading.Thread(target=self._consume_loop, daemon=True, name="TickConsumerWorker")
        self._consumer_thread.start()
        logger.info("Tick Consumer Worker thread started.")

    def stop_worker(self):
        self._running = False
        if self._consumer_thread:
            self._consumer_thread.join(timeout=2.0)
            logger.info("Tick Consumer Worker thread stopped.")

    def _consume_loop(self):
        """Infinite loop designed to run in dedicated background thread."""
        while self._running:
            try:
                # State guard: flush queue if trading disabled or auth fail
                if state_manager.get_state() != SystemState.READY:
                    # Optional: sleep and wait if not bursting while unhealthy
                    time.sleep(1)
                    continue

                raw_tick = tick_queue_manager.get_tick(timeout=1.0)
                if raw_tick is None:
                    continue  # Timeout reached, queue empty, loop again
                
                try:
                    self._process_single_tick(raw_tick)
                except Exception as e:
                    # Isolated tick processor boundary
                    logger.error(f"Failed to process tick data: {e}", exc_info=True)
                finally:
                    tick_queue_manager.mark_task_done()
                    
            except Exception as e:
                logger.error(f"Critical error in Consumer Worker loop: {e}", exc_info=True)
                time.sleep(1) # Prevent tight crash loop

    def _process_single_tick(self, raw_tick: dict):
        # 1. Validation & Normalization
        if "instrument_token" not in raw_tick or "last_price" not in raw_tick or "timestamp" not in raw_tick:
            logger.debug("Malformed tick skipped.")
            return

        if raw_tick["last_price"] is None or float(raw_tick["last_price"]) <= 0:
            return  # skip nonsense prices
            
        # Parse timestamp safely
        timestamp = raw_tick["timestamp"]
        self.last_tick_timestamp = timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp)

        # Map to Pydantic Model
        tick_model = TickModel(
            instrument_token=raw_tick["instrument_token"],
            last_price=float(raw_tick["last_price"]),
            timestamp=raw_tick["timestamp"],
            volume_traded=raw_tick.get("volume_traded", 0),
            average_traded_price=raw_tick.get("average_traded_price", 0.0),
            buy_quantity=raw_tick.get("buy_quantity", 0),
            sell_quantity=raw_tick.get("sell_quantity", 0),
            open_interest=raw_tick.get("oi", 0)
        )

        # 2. Forward to Candle Builder
        candle_builder.process_tick(tick_model)

tick_processor = TickProcessor()
