from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CandleModel(BaseModel):
    """
    Representation of an OHLCV Candle.
    """
    model_config = ConfigDict(from_attributes=True)

    instrument_token: int
    start_time: datetime
    end_time: datetime
    timeframe: str  # e.g., '1min', '5min'
    
    open: float
    high: float
    low: float
    close: float
    volume: int
    
    is_closed: bool = False
