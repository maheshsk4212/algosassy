import logging
from threading import RLock
from typing import Dict, List
from app.strategies.base_strategy import BaseStrategy

logger = logging.getLogger(__name__)

class StrategyRegistry:
    """
    Central router for registered strategies. Maps Instrument Tokens to Strategy instances.
    """
    def __init__(self):
        # Structure: { instrument_token: [BaseStrategy_instance, ...] }
        self._routes: Dict[int, List[BaseStrategy]] = {}
        self._lock = RLock()
        
    def register_strategy(self, symbol: int, strategy: BaseStrategy):
        with self._lock:
            if symbol not in self._routes:
                self._routes[symbol] = []
                
            # Prevent exact duplicate strategies on the same symbol
            for existing in self._routes[symbol]:
                if existing.strategy_name == strategy.strategy_name:
                    logger.warning(f"Strategy {strategy.strategy_name} already registered for symbol {symbol}")
                    return
                    
            self._routes[symbol].append(strategy)
            logger.info(f"Registered {strategy.strategy_name} for symbol {symbol}")

    def unregister_strategy(self, symbol: int, strategy_name: str) -> bool:
        with self._lock:
            entries = self._routes.get(symbol, [])
            if not entries:
                return False
            filtered = [s for s in entries if s.strategy_name != strategy_name]
            removed = len(filtered) != len(entries)
            if removed:
                if filtered:
                    self._routes[symbol] = filtered
                else:
                    self._routes.pop(symbol, None)
                logger.info(f"Unregistered {strategy_name} for symbol {symbol}")
            return removed

    def get_strategies_for_symbol(self, symbol: int) -> List[BaseStrategy]:
        """Returns all strategies actively listening to a specific symbol."""
        with self._lock:
            return list(self._routes.get(symbol, []))
        
    def get_all_registered_symbols(self) -> List[int]:
        with self._lock:
            return list(self._routes.keys())

# Global singleton
strategy_registry = StrategyRegistry()
