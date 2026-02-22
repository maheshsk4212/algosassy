import logging
from dataclasses import dataclass
from typing import Optional

from app.strategies.base_strategy import BaseStrategy
from app.models.candle_model import CandleModel
from app.models.trade_intent import TradeIntent, TradeDirection
from app.services.market_data_service import market_data_service
from app.services.mtm_engine import mtm_engine

logger = logging.getLogger(__name__)

@dataclass
class _PositionState:
    entry_price: float
    stop_loss: float
    target: float
    trailing_stop: float
    highest_price: float
    bars_held: int = 0
    exit_pending_bars: int = 0

class EMACrossoverStrategy(BaseStrategy):
    """
    Standard 9/21 EMA crossover strategy with autonomous exit engine:
    - Stop loss exit
    - Target exit
    - Trailing stop exit
    - Time-based exit
    - Bearish crossover exit
    """
    def __init__(
        self,
        short_period: int = 9,
        long_period: int = 21,
        risk_percent: float = 1.0,
        trailing_stop_pct: float = 0.006,
        max_hold_bars: int = 30,
        exit_retry_bars: int = 2,
    ):
        self._short_period = short_period
        self._long_period = long_period
        self._risk_percent = risk_percent
        self._trailing_stop_pct = max(0.001, trailing_stop_pct)
        self._max_hold_bars = max(1, int(max_hold_bars))
        self._exit_retry_bars = max(1, int(exit_retry_bars))
        # Requires at least the long_period worth of data to compute the EMA
        self._lookback = self.long_period + 1
        self._position: Optional[_PositionState] = None
        
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

    def _new_position_state(self, entry_price: float, candle_low: float) -> _PositionState:
        stop_loss = min(candle_low * 0.99, entry_price * 0.9925)
        if stop_loss >= entry_price:
            stop_loss = entry_price * 0.99

        per_unit_risk = max(entry_price - stop_loss, max(entry_price * 0.003, 0.05))
        target = entry_price + (per_unit_risk * 2.0)
        return _PositionState(
            entry_price=entry_price,
            stop_loss=stop_loss,
            target=target,
            trailing_stop=stop_loss,
            highest_price=entry_price,
        )

    def _bootstrap_position_from_mtm(self, symbol: int, candle: CandleModel):
        snapshot = mtm_engine.get_position_snapshot(symbol)
        if not snapshot:
            return
        qty = int(snapshot.get("position_size", 0))
        avg_price = float(snapshot.get("avg_price", 0.0))
        if qty <= 0:
            return
        if self._position is None:
            anchor_entry = avg_price if avg_price > 0 else float(candle.close)
            self._position = self._new_position_state(anchor_entry, float(candle.low))
            self._position.highest_price = max(anchor_entry, float(candle.high))
            logger.info(f"[{symbol}] Position state initialized from MTM snapshot.")

    def on_candle_close(self, closed_candle: CandleModel) -> Optional[TradeIntent]:
        """Evaluates closing prices against SMA/EMAs and emits immutable TradeIntents."""
        symbol = closed_candle.instrument_token

        # Keep strategy-local position state synchronized with synthetic broker position.
        open_qty = mtm_engine.get_position_size(symbol)
        if open_qty > 0:
            self._bootstrap_position_from_mtm(symbol, closed_candle)
        elif self._position is not None:
            logger.info(f"[{symbol}] Position closed. Resetting strategy position state.")
            self._position = None

        # 1. Fetch History from Thread-Safe Service ONLY
        history = market_data_service.get_last_n_candles(symbol, self.get_required_lookback_period(), closed_candle.timeframe)
        bullish_cross = False
        bearish_cross = False

        if len(history) >= self.get_required_lookback_period():
            # 2. Extract closing prices
            closes = [c.close for c in history]

            # We need previous and current EMA to detect exact crossover candle
            short_ema_prev = self._calculate_ema(closes[:-1], self.short_period)
            long_ema_prev = self._calculate_ema(closes[:-1], self.long_period)
            short_ema_curr = self._calculate_ema(closes, self.short_period)
            long_ema_curr = self._calculate_ema(closes, self.long_period)

            if all([short_ema_prev, long_ema_prev, short_ema_curr, long_ema_curr]):
                bullish_cross = short_ema_prev <= long_ema_prev and short_ema_curr > long_ema_curr
                bearish_cross = short_ema_prev >= long_ema_prev and short_ema_curr < long_ema_curr
        elif open_qty <= 0:
            logger.debug(f"[{symbol}] Not enough data for EMA calculation.")

        # 3. Exit engine (autonomous SELL) if position exists
        if open_qty > 0 and self._position:
            pos = self._position

            # Debounce repeated exits while waiting for broker/order pipeline.
            if pos.exit_pending_bars > 0:
                pos.exit_pending_bars += 1
                if pos.exit_pending_bars <= self._exit_retry_bars:
                    return None
                pos.exit_pending_bars = 0

            pos.bars_held += 1
            pos.highest_price = max(pos.highest_price, float(closed_candle.high))
            trailing_candidate = pos.highest_price * (1 - self._trailing_stop_pct)
            if trailing_candidate > pos.trailing_stop:
                pos.trailing_stop = trailing_candidate

            stop_hit = float(closed_candle.low) <= pos.stop_loss
            trailing_hit = float(closed_candle.low) <= pos.trailing_stop
            target_hit = float(closed_candle.high) >= pos.target
            time_hit = pos.bars_held >= self._max_hold_bars

            exit_reason = ""
            if stop_hit:
                exit_reason = "STOP_LOSS"
            elif trailing_hit:
                exit_reason = "TRAILING_STOP"
            elif target_hit:
                exit_reason = "TARGET"
            elif time_hit:
                exit_reason = "TIME_EXIT"
            elif bearish_cross:
                exit_reason = "BEARISH_CROSSOVER"

            if exit_reason:
                logger.info(f"[{symbol}] EXIT SIGNAL {exit_reason} @ {closed_candle.close}")
                pos.exit_pending_bars = 1
                return TradeIntent(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    direction=TradeDirection.SELL,
                    entry_price=float(closed_candle.close),
                    stop_loss=pos.stop_loss,
                    target=pos.target,
                    is_exit=True,
                    exit_reason=exit_reason,
                )

            return None

        # 4. Entry engine (autonomous BUY) if flat
        if bullish_cross:
            logger.info(f"[{symbol}] BULLISH EMA CROSSOVER DETECTED @ {closed_candle.close}")

            entry_price = float(closed_candle.close)
            planned = self._new_position_state(entry_price, float(closed_candle.low))

            return TradeIntent(
                strategy_name=self.strategy_name,
                symbol=symbol,
                direction=TradeDirection.BUY,
                entry_price=entry_price,
                stop_loss=planned.stop_loss,
                target=planned.target,
            )

        return None

    def calculate_position_size(self, current_price: float, stop_loss: float, capital: float) -> int:
        """Returns safe integer positions bounded by fractional risks."""
        if stop_loss >= current_price:
            return 0
            
        risk_amount = capital * (self._risk_percent / 100)
        risk_per_share = current_price - stop_loss
        
        return max(int(risk_amount // risk_per_share), 1)
