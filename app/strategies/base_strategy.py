from abc import ABC, abstractmethod
from typing import Optional
from app.models.candle_model import CandleModel
from app.models.trade_intent import TradeIntent

class BaseStrategy(ABC):
    """
    Abstract Base Class enforcing the strict contract for all strategies.
    Strategies must be pure functions of historical data that return
    an immutable TradeIntent, with zero direct execution privileges.
    """
    
    @property
    @abstractmethod
    def strategy_name(self) -> str:
        """Returns the unique string identifier for this strategy."""
        pass

    @abstractmethod
    def get_required_lookback_period(self) -> int:
        """Returns how many past candles the strategy requires to calculate indicators."""
        pass

    @abstractmethod
    def on_candle_close(self, closed_candle: CandleModel) -> Optional[TradeIntent]:
        """
        The single event loop entrypoint. Evaluated only when a candle closes.
        Must use `app.services.market_data_service` to fetch history.
        MUST NOT mutate any state or classes.
        Returns:
            TradeIntent: Immutable order request if a signal is generated.
            None: If no signals are present.
        """
        pass

    @abstractmethod
    def calculate_position_size(self, current_price: float, stop_loss: float, capital: float) -> int:
        """Determines the number of shares/units based on capital allocation."""
        pass
