import logging
from enum import Enum
from typing import Dict, Any

logger = logging.getLogger(__name__)

class RegimeType(str, Enum):
    TRENDING = "TRENDING"
    MEAN_REVERTING = "MEAN_REVERTING"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    LOW_VOLATILITY = "LOW_VOLATILITY"
    CRASH_MODE = "CRASH_MODE"

class RegimeService:
    """
    Phase 8: Evaluates market mood based on ATR, VIX, and variance compression.
    Dictates risk multipliers and strategy active states.
    """
    def __init__(self):
        self.current_regime = RegimeType.TRENDING
        
        # Mocked data tracking for Phase 8 until historical data ingestion is ready in Phase 9
        self._mocked_base_risk: float = 0.01  # 1% per trade

    def get_current_regime(self) -> RegimeType:
        return self.current_regime
        
    def get_volatility_multiplier(self, symbol: int) -> float:
        """
        Returns a scalar multiplier. Normal = 1.0. High Volatility = 2.0 (halves size).
        Crash = 0.5 (doubles size, wait no, we want smaller size in crash, so scalar denominator).
        Formula: size = (Capital * Risk) / (ATR * VolatilityMultiplier)
        """
        if self.current_regime == RegimeType.CRASH_MODE:
            return 3.0 # Significantly reduces size
        if self.current_regime == RegimeType.HIGH_VOLATILITY:
            return 1.5
        if self.current_regime == RegimeType.LOW_VOLATILITY:
            return 0.8 # Slightly increase size in low vol
        return 1.0

    def is_strategy_allowed(self, strategy_type: str) -> bool:
        """Trending strategies disabled in Mean Reverting regimes, etc."""
        if self.current_regime == RegimeType.CRASH_MODE:
            # Crash mode blocks "Long Only Trending" strategies entirely
            if "trend" in strategy_type.lower() and "long" in strategy_type.lower():
                return False
        return True
        
    def get_atr(self, symbol: int) -> float:
        """Mocked ATR retrieval."""
        # For a 1000 Rs stock, ATR might be ~15
        return 15.0 

    def get_base_risk_percent(self) -> float:
        """Returns the baseline portfolio risk percent before drawdown penalties."""
        return self._mocked_base_risk

regime_service = RegimeService()
