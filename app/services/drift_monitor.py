import logging
from collections import deque
from statistics import mean, stdev

from app.core.event_bus import event_bus, EventType

logger = logging.getLogger(__name__)

class DriftMonitor:
    """
    Phase 8: Evaluates real-time performance against statistical baseline.
    Prevents strategy decay from destroying capital before manual intervention.
    """
    def __init__(self, window_size: int = 30):
        self.window_size = window_size
        
        # { strategy_name: deque([pnl, pnl, ...]) }
        self._strategy_pnls = {}
        # { strategy_name: "HEALTHY" | "DECAYED" }
        self._strategy_states = {}
        
        # Baseline Expectations (Will be loaded from Phase 9 DB config)
        self.baselines = {
            "EMA_Cross": {
                "expected_mean": 150.0,
                "expected_std": 300.0,
                "max_drawdown": 0.10
            }
        }
        
    def log_trade_closed(self, strategy_name: str, realized_pnl: float):
        """Called by MTM / Portfolio manager when a round-trip resolves."""
        if strategy_name not in self._strategy_pnls:
            self._strategy_pnls[strategy_name] = deque(maxlen=self.window_size)
            
        history = self._strategy_pnls[strategy_name]
        history.append(realized_pnl)
        
        if len(history) >= 10: # Minimum sample size
            self._evaluate_edge_decay(strategy_name, list(history))
            
    def _evaluate_edge_decay(self, strategy_name: str, recent_pnls: list[float]):
        baseline = self.baselines.get(strategy_name)
        if not baseline:
            return
            
        current_mean = mean(recent_pnls)
        
        # Z-Score deterioration check
        # If the rolling expectancy drops below (mean - 1.5 * std_dev), the edge is likely decaying
        critical_floor = baseline["expected_mean"] - (1.5 * baseline["expected_std"])
        
        if current_mean < critical_floor:
            logger.critical(f"📉 DRIFT DETECTED: {strategy_name} Expectancy ({current_mean:.2f}) fell below critical floor ({critical_floor:.2f})")
            self._strategy_states[strategy_name] = "DECAYED"
            event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {
                "source": "DriftMonitor",
                "reason": f"Statistical Edge Decay exactly detected on {strategy_name}",
                "symbol": "ALL"
            })
            
    def get_drift_state(self, strategy_name: str) -> str:
        """Returns HEALTHY or DECAYED so the Risk Engine can block new entries."""
        return self._strategy_states.get(strategy_name, "HEALTHY")
            
drift_monitor = DriftMonitor()
