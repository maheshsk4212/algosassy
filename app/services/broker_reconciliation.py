import logging
import threading
import time
from typing import Dict

from app.core.event_bus import event_bus, EventType
from app.services.kite_service import init_kite_service  # Using the wrapper

logger = logging.getLogger(__name__)

class BrokerReconciliationService:
    """
    Periodic job ensuring Local Synthetic State matches true Broker State.
    Uses 'Grace Periods' to tolerate microsecond desyncs during active flight.
    """
    def __init__(self, grace_period_seconds: int = 3):
        self._grace_period_seconds = grace_period_seconds
        
        # Track persistent mismatches { symbol: first_detected_timestamp }
        self._mismatch_watch: Dict[int, float] = {}

    async def run_reconciliation_cycle(self):
        """Called by APScheduler every ~15 seconds."""
        logger.debug("Starting Broker Reconciliation Cycle...")
        
        try:
            from app.services.kite_service import get_kite_service
            from app.services.mtm_engine import mtm_engine
            kite = get_kite_service()
            
            # 1. Guard: skip if no access token (not yet authenticated)
            if not kite._kite.access_token:
                logger.debug("Reconciliation skipped: no active access token.")
                return
            
            # 2. Fetch live positions from the broker
            broker_data = await kite.get_positions()
            broker_positions = {
                p['instrument_token']: p['quantity']
                for p in broker_data.get('net', [])
                if p.get('instrument_token')
            }
            
            # 3. Snapshot synthetic positions
            local_positions = dict(mtm_engine._synthetic_positions)
            
            current_time = time.time()
            
            # 4. Phantom Position Check - positions existing on broker NOT in our system
            for token, broker_qty in broker_positions.items():
                if broker_qty != 0 and token not in local_positions:
                    logger.critical(f"🚨 PHANTOM POSITION DETECTED: Token {token} has {broker_qty} shares at broker but nothing locally!")
                    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {
                        "reason": f"Phantom position detected for token {token}",
                        "symbol": token
                    })
                    return  # Halt reconciliation after emergency signal
            
            # 5. Size Mismatch Grace Period Check
            for token, local_info in local_positions.items():
                local_qty = local_info.get('position_size', 0)
                broker_qty = broker_positions.get(token, 0)
                
                if local_qty != broker_qty:
                    if token not in self._mismatch_watch:
                        self._mismatch_watch[token] = current_time
                        logger.warning(f"⚠️  Size mismatch on token {token}: Local={local_qty}, Broker={broker_qty}. Grace period started.")
                    elif current_time - self._mismatch_watch[token] > self._grace_period_seconds:
                        logger.critical(f"🚨 PERSISTENT MISMATCH on {token} for > {self._grace_period_seconds}s. Triggering emergency!")
                        event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {
                            "reason": f"Persistent size mismatch on token {token}",
                            "symbol": token
                        })
                else:
                    # Clear grace period if mismatch resolved
                    self._mismatch_watch.pop(token, None)
            
            logger.debug(f"Reconciliation OK. Broker: {len(broker_positions)} positions. Local: {len(local_positions)} synthetic.")
            
        except RuntimeError:
            logger.debug("Reconciliation skipped: KiteService not initialized.")
        except Exception as e:
            logger.error(f"Reconciliation cycle error: {e}")

broker_reconciliation_service = BrokerReconciliationService()
