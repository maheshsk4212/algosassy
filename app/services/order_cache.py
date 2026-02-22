import logging
import threading
from typing import List, Dict

from app.core.time_provider import time_provider
from app.services.kite_service import get_kite_service

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
        now = time_provider.time()
        
        # 1. Dirty Read (Fast Path)
        if not force_refresh and (now - self._last_fetch_time) < self.cache_duration:
            return self._last_orders
            
        # 2. Synchronized Fetch Trigger (Thundering Herd Protection)
        with self._lock:
            # Re-check condition inside lock in case another thread already fetched
            if not force_refresh and (time_provider.time() - self._last_fetch_time) < self.cache_duration:
                return self._last_orders

        try:
            kite = get_kite_service()
            if not getattr(kite._kite, "access_token", None):
                fresh_orders: List[Dict] = []
            else:
                raw_orders = await kite.get_orders()
                fresh_orders = raw_orders if isinstance(raw_orders, list) else []
            logger.debug(f"Fetched {len(fresh_orders)} orders from broker API")
        except RuntimeError:
            # Kite service may be unavailable early during startup.
            fresh_orders = []
        except Exception as e:
            logger.error(f"Failed to fetch broker orders: {e}")
            # Return stale cache if available; otherwise fallback to empty list.
            with self._lock:
                if self._last_orders:
                    return self._last_orders
            fresh_orders = []

        with self._lock:
            self._last_orders = fresh_orders
            self._last_fetch_time = time_provider.time()
            return self._last_orders

    def invalidate(self):
        """Forces the next caller to fetch fresh data (e.g. after we place an order)."""
        with self._lock:
            self._last_fetch_time = 0.0

shared_order_cache = SharedOrderCache()
