import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

try:
    import zoneinfo
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
except ImportError:
    from datetime import tzinfo
    class IST(tzinfo):
        def utcoffset(self, dt): return timedelta(hours=5, minutes=30)
        def tzname(self, dt): return "IST"
        def dst(self, dt): return timedelta(0)
    IST = IST()

from app.models.trade_intent import TradeIntent
from app.services.order_cache import shared_order_cache

logger = logging.getLogger(__name__)

class IdempotencyManager:
    """
    Prevents duplicate market orders caused by network retries or clock drift.
    Sniffs the shared order cache to see if we already placed this exact intent
    within the last 15 seconds.
    """
    def __init__(self, sniff_window_seconds: int = 15):
        self.sniff_window_seconds = sniff_window_seconds

    async def sniff_for_duplicate(self, intent: TradeIntent) -> Optional[str]:
        """
        Returns an order_id if it finds a match, preventing execution.
        Returns None if safe to place order.
        """
        orders = await shared_order_cache.get_orders()
        
        now_ist = datetime.now(IST)
        cutoff_time = now_ist - timedelta(seconds=self.sniff_window_seconds)
        
        matches = []
        for o in orders:
            # Fast filters
            if str(o.get('instrument_token')) != str(intent.symbol): continue
            if o.get('transaction_type') != intent.direction.value: continue
            if int(o.get('quantity', 0)) != intent.position_size: continue
            
            # Status filter - terminal statuses (REJECTED, CANCELLED) are safe to retry.
            # We only want to avoid duplicating orders that are OPEN, VALIDATION PENDING, COMPLETE
            status = o.get('status', '').upper()
            if status in ['REJECTED', 'CANCELLED']: continue
            
            # Time filter (Hardcoded to IST to avoid VPS local naive clock drift issues)
            o_time_str = o.get('order_timestamp')
            if not o_time_str: continue
            
            try:
                # Example Kite Format: '2023-11-20 09:15:00'
                # Assuming kite returns naive IST, make it aware
                o_time = datetime.strptime(o_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
                
                if o_time >= cutoff_time:
                    matches.append(o)
            except Exception as e:
                logger.error(f"Failed to parse order timestamp: {e}")
                
        if len(matches) == 1:
            order_id = matches[0].get('order_id')
            logger.warning(f"IDEMPOTENCY HIT: Absorbed Duplicate Order into existing Order ID {order_id}")
            return order_id
        
        if len(matches) > 1:
            logger.warning(f"IDEMPOTENCY CONFLICT: Found multiple matches for intent {intent}. Returning first match.")
            return matches[0].get('order_id')
            
        return None

idempotency_manager = IdempotencyManager()
