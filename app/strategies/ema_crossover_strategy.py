import logging
from typing import Optional
from decimal import Decimal

from app.strategies.base_strategy import BaseStrategy
from app.models.candle_model import CandleModel
from app.models.trade_intent import TradeIntent, TradeDirection
from app.services.market_data_service import market_data_service

logger = logging.getLogger(__name__)

class EMACrossoverStrategy(BaseStrategy):
    """
    Standard 9/21 Exponential Moving Average Crossover Strategy.
    """
    def __init__(self, short_period: int = 9, long_period: int = 21, risk_percent: float = 1.0):
        self._short_period = short_period
        self._long_period = long_period
        self._risk_percent = risk_percent
        # Requires at least the long_period worth of data to compute the EMA
        self._lookback = self.long_period + 1 
        
    @property
    def strategy_name(self) -> str:
        return "ema_9_21_crossover"

    @property
    def short_period(self): return self._short_period
    
    @property
    def long_period(self): return self._long_period

    def get_required_lookback_period(self) -> int:
        return self._lookback

    def _calculate_ema(self, prices: list[float], period: int) -> Optional[float]:
        """Basic EMA calculation without relying on external heavy dataframe libraries like Pandas inside the event loop."""
        if len(prices) < period:
            return None
            
        multiplier = 2 / (period + 1)
        # Seed the EMA with an initial SMA
        ema = sum(prices[:period]) / period
        
        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema
        return ema

    def on_candle_close(self, closed_candle: CandleModel) -> Optional[TradeIntent]:
        """Evaluates closing prices against SMA/EMAs and emits immutable TradeIntents."""
        symbol = closed_candle.instrument_token
        
        # 1. Fetch History from Thread-Safe Service ONLY
        history = market_data_service.get_last_n_candles(symbol, self.get_required_lookback_period(), closed_candle.timeframe)
        if len(history) < self.get_required_lookback_period():
            logger.debug(f"[{symbol}] Not enough data for EMA calculation.")
            return None
            
        # 2. Extract closing prices
        closes = [c.close for c in history]
        
        # We need the previous EMAs and the current EMAs to detect the exact crossover tick
        short_ema_prev = self._calculate_ema(closes[:-1], self.short_period)
        long_ema_prev = self._calculate_ema(closes[:-1], self.long_period)
        
        short_ema_curr = self._calculate_ema(closes, self.short_period)
        long_ema_curr = self._calculate_ema(closes, self.long_period)

        if not all([short_ema_prev, long_ema_prev, short_ema_curr, long_ema_curr]):
            return None

        # 3. Detect "Bullish Crossover" - Short EMA crosses above Long EMA
        if short_ema_prev <= long_ema_prev and short_ema_curr > long_ema_curr:
            logger.info(f"[{symbol}] BULLISH EMA CROSSOVER DETECTED @ {closed_candle.close}")
            
            # Entry logic (simple example using mock capital of 100,000 for sizing)
            entry_price = closed_candle.close
            stop_loss = closed_candle.low * 0.99  # 1% below current low
            target = entry_price + ((entry_price - stop_loss) * 2) # 1:2 R:R
            
            size = self.calculate_position_size(entry_price, stop_loss, capital=100000.0)
            
            # Emitting Immortal Entity Tracker
            return TradeIntent(
                strategy_name=self.strategy_name,
                symbol=symbol,
                direction=TradeDirection.BUY,
                entry_price=entry_price,
                stop_loss=stop_loss,
                target=target
            )
            
        return None

    def calculate_position_size(self, current_price: float, stop_loss: float, capital: float) -> int:
        """Returns safe integer positions bounded by fractional risks."""
        if stop_loss >= current_price:
            return 0
            
        risk_amount = capital * (self._risk_percent / 100)
        risk_per_share = current_price - stop_loss
        
        return max(int(risk_amount // risk_per_share), 1)

