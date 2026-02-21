from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from app.models.trade_intent import TradeIntent

class RiskDecision(BaseModel):
    """
    Immutable boundary output of the Risk Engine.
    Instructs the Execution Engine precisely on what to do.
    """
    model_config = ConfigDict(frozen=True)

    approved: bool
    rejection_reason: Optional[str] = None
    
    # Securely tied to the specific intent
    original_intent: TradeIntent
    
    # Governance Layer assigns the final size
    assigned_position_size: int = 0
    
    # Required for capital rollback if order fails
    reservation_id: Optional[str] = None
