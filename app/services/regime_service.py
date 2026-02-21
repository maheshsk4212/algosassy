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
        Returns a dynamic scalar divisor to auto-throttle position sizing.
        Size = (Capital * Risk) / (ATR * VolatilityMultiplier)
        """
        atr = self.get_atr(symbol)
        if atr <= 0:
            return 1.0
            
        # In a full system, you'd compare ATR to a 30-day baseline ATR.
        # For this phase, we use static thresholds based on typical asset behavior.
        # Assume an asset trading at 55000 with a normal ATR of 200.
        
        # If ATR spikes heavily (e.g. > 500 for BTC), we are in High Vol.
        if atr > 500:
            self.current_regime = RegimeType.HIGH_VOLATILITY
            return 2.0  # Halves the position size since size is divided by VolMultiplier
            
        elif atr > 1000:
            self.current_regime = RegimeType.CRASH_MODE
            return 3.0  # Slash size by 66%
            
        elif atr < 100:
            self.current_regime = RegimeType.LOW_VOLATILITY
            return 0.8  # Increase size slightly in low vol
            
        self.current_regime = RegimeType.TRENDING
        return 1.0

    def is_strategy_allowed(self, strategy_type: str) -> bool:
        """Trending strategies disabled in Mean Reverting regimes, etc."""
        if self.current_regime == RegimeType.CRASH_MODE:
            # Crash mode blocks "Long Only Trending" strategies entirely
            if "trend" in strategy_type.lower() and "long" in strategy_type.lower():
                return False
        return True
        
    def get_atr(self, symbol: int, period: int = 14) -> float:
        """Calculates Average True Range over N periods."""
        # Avoiding circular imports by lazy-loading inside the method if needed, 
        # or assuming market_data_service is injected.
        from app.services.market_data_service import market_data_service
        
        # Get one extra candle to calculate the first True Range (requires prev close)
        history = market_data_service.get_last_n_candles(symbol, period + 1, "1min")
        
        if len(history) < 2:
            return 0.0
            
        true_ranges = []
        for i in range(1, len(history)):
            curr = history[i]
            prev = history[i-1]
            
            # TR = max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))
            tr = max(
                curr.high - curr.low,
                abs(curr.high - prev.close),
                abs(curr.low - prev.close)
            )
            true_ranges.append(tr)
            
        if not true_ranges:
            return 0.0
            
        # Simple Moving Average of True Range to represent ATR for speed
        # Alternatively, Wilder's Smoothing can be used.
        return sum(true_ranges[-period:]) / min(len(true_ranges), period)

    def get_base_risk_percent(self) -> float:
        """Returns the baseline portfolio risk percent before drawdown penalties."""
        return self._mocked_base_risk

    def update_base_risk(self, risk_percent: float):
        """Updates the baseline portfolio risk percent."""
        self._mocked_base_risk = risk_percent
        logger.info(f"🛡️ REGIME: Base risk updated to {risk_percent*100:.2f}%")

regime_service = RegimeService()
