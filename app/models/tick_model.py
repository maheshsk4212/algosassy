from datetime import datetime
from pydantic import BaseModel, ConfigDict

class TickModel(BaseModel):
    """
    Structured representation of a raw tick from Kite Connect WebSocket.
    """
    model_config = ConfigDict(from_attributes=True)

    instrument_token: int
    last_price: float
    timestamp: datetime
    volume_traded: int = 0
    average_traded_price: float = 0.0
    
    # Optional fields depending on tick mode (full/quote)
    buy_quantity: int = 0
    sell_quantity: int = 0
    open_interest: int = 0
