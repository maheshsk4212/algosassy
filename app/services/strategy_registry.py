import logging
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
        
    def register_strategy(self, symbol: int, strategy: BaseStrategy):
        if symbol not in self._routes:
            self._routes[symbol] = []
            
        # Prevent exact duplicate strategies on the same symbol
        for existing in self._routes[symbol]:
            if existing.strategy_name == strategy.strategy_name:
                logger.warning(f"Strategy {strategy.strategy_name} already registered for symbol {symbol}")
                return
                
        self._routes[symbol].append(strategy)
        logger.info(f"Registered {strategy.strategy_name} for symbol {symbol}")

    def get_strategies_for_symbol(self, symbol: int) -> List[BaseStrategy]:
        """Returns all strategies actively listening to a specific symbol."""
        return self._routes.get(symbol, [])
        
    def get_all_registered_symbols(self) -> List[int]:
        return list(self._routes.keys())

# Global singleton
strategy_registry = StrategyRegistry()
