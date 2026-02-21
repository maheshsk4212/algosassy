import json
import logging
import redis
from app.services.capital_registry import capital_registry
from app.services.mtm_engine import mtm_engine
from app.state_manager import state_manager
from app.config import config

logger = logging.getLogger(__name__)

class DashboardSeeder:
    """
    Phase 6: Data Shadow Pattern.
    Pushes aggregated state into Redis to completely isolate UI read demands
    from the internal memory of the trading system.
    """
    def __init__(self):
        try:
            self.redis_client = redis.from_url(config.REDIS_URL, decode_responses=True)
            self.enabled = True
        except Exception as e:
            logger.warning(f"Dashboard Seeder Disabled: Could not connect to Redis at {config.REDIS_URL}")
            self.enabled = False

    def push_state_snapshot(self):
        if not self.enabled:
            return
            
        try:
            snapshot = {
                "system_state": state_manager.get_state().name,
                "capital": {
                    "total": capital_registry.total_capital,
                    "available": capital_registry.get_available_capital(),
                    "used": capital_registry.used_capital
                },
                "mtm": {
                    "unrealized_pnl": mtm_engine.get_realtime_pnl(),
                    "synthetic_positions": list(mtm_engine._synthetic_positions.keys())
                }
            }
            
            # Fire and forget SET call
            self.redis_client.set("algo_sassy:dashboard:fast_state", json.dumps(snapshot))
            
        except Exception as e:
            # Swallow exceptions to protect background thread
            pass

dashboard_seeder = DashboardSeeder()
