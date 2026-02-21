import logging
import queue
from typing import Optional

logger = logging.getLogger(__name__)

class TickQueueManager:
    """
    Bounded queue acting as a buffer between the Kite WebSocket (Producer)
    and the Candle Builder (Consumer) to protect against 9:15 AM tick burst race conditions.
    """
    def __init__(self, maxsize: int = 20000):
        self.maxsize = maxsize
        self.tick_queue = queue.Queue(maxsize=maxsize)
        self.dropped_ticks = 0

    def enqueue_ticks(self, ticks: list[dict]):
        """
        Pushes raw ticks directly from the websocket into the bounded queue.
        This must be completely non-blocking to protect the websocket thread.
        """
        for tick in ticks:
            try:
                # Use block=False to prevent halting the websocket thread if queue is full
                self.tick_queue.put(tick, block=False)
            except queue.Full:
                self.dropped_ticks += 1
                logger.error(f"Tick Queue is Full! Dropped incoming tick. Total dropped: {self.dropped_ticks}")

    def get_tick(self, timeout: float = 1.0) -> Optional[dict]:
        """
        Blocking read with a timeout used by the Consumer thread.
        """
        try:
            return self.tick_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def mark_task_done(self):
        """Signals that the retrieved tick has been fully processed."""
        self.tick_queue.task_done()

    def get_queue_size(self) -> int:
        return self.tick_queue.qsize()

    def is_healthy(self) -> bool:
        # Consider unhealthy if queue is more than 90% full
        return self.get_queue_size() < (self.maxsize * 0.9)

# Global singleton instance
tick_queue_manager = TickQueueManager()
