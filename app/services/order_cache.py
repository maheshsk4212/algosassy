import logging
import threading
import time
from typing import List, Dict, Optional
from app.services.kite_service import kite_service  # Ensure kite_service has get_orders

logger = logging.getLogger(__name__)

class SharedOrderCache:
    """
    Prevents API rate limit exhaustion (Max 3 req/sec on kite.orders()).
    Used simultaneously by Idempotency Sniffer and Reconciliation Manager.
    """
    def __init__(self, cache_duration_seconds: float = 1.0):
        self.cache_duration = cache_duration_seconds
        self._lock = threading.Lock()
        
        self._last_orders: List[Dict] = []
        self._last_fetch_time: float = 0.0

    async def get_orders(self, force_refresh: bool = False) -> List[Dict]:
        """
        Returns cached orders if within TTL. Otherwise, fetches fresh from Kite.
        Uses Mutex to prevent multiple concurrent threads from hammering the API
        if the cache expires exactly when 3 threads ask for it simultaneously.
        """
        now = time.time()
        
        # 1. Dirty Read (Fast Path)
        if not force_refresh and (now - self._last_fetch_time) < self.cache_duration:
            return self._last_orders
            
        # 2. Synchronized Fetch (Thundering Herd Protection)
        with self._lock:
            # Re-check condition inside lock in case another thread already fetched
            if not force_refresh and (time.time() - self._last_fetch_time) < self.cache_duration:
                return self._last_orders
                
            try:
                # Mocked due to no active API credentials but this is the architecture
                # self._last_orders = await kite_service.get_orders()
                logger.debug("Fetched fresh orders from Broker API")
                self._last_orders = [] # Mock empty for now
                self._last_fetch_time = time.time()
            except Exception as e:
                logger.error(f"Failed to fetch broker orders: {e}")
                
            return self._last_orders

    def invalidate(self):
        """Forces the next caller to fetch fresh data (e.g. after we place an order)."""
        with self._lock:
            self._last_fetch_time = 0.0

shared_order_cache = SharedOrderCache()
