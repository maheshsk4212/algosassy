from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from enum import Enum
import uuid

class TradeDirection(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class TradeIntent(BaseModel):
    """
    Immutable representation of a strategy's desired execution.
    Once emitted from a strategy, it can never be altered.
    """
    model_config = ConfigDict(frozen=True)

    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    strategy_name: str
    symbol: int  # Kite instrument_token
    direction: TradeDirection
    entry_price: float
    stop_loss: float
    target: float
    # position_size and risk_per_trade are removed. RiskEngine owns this.
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
