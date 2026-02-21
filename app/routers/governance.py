import logging
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.governance_guard import governance_guard
from app.services.regime_service import regime_service
from app.services.drift_monitor import drift_monitor
from app.services.capital_registry import capital_registry
from app.services.mtm_engine import mtm_engine

logger = logging.getLogger(__name__)

router = APIRouter()

class GovernanceStatusResponse(BaseModel):
    portfolio_peak_equity: float
    current_equity: float
    drawdown_percent: float
    active_sizing_penalty: float
    current_market_regime: str

class GovernanceSettingsRequest(BaseModel):
    monthly_drawdown_limit: float = None
    max_strategy_concentration: float = None

class SimulationRequest(BaseModel):
    base_risk_percent: float
    max_exposure: float
    monthly_loss_cap: float

class SimulationResponse(BaseModel):
    estimated_drawdown_cap: float
    estimated_recovery_days: int
    viability_score: str

@router.get("/governance/status", response_model=GovernanceStatusResponse)
def get_governance_status():
    """
    Returns real-time health and capital protection metrics for the Phase 8 UI Dashboard.
    """
    current_equity = capital_registry.total_capital + mtm_engine.get_realtime_pnl()
    
    # Calculate drawdown relative to the locked High Water Mark
    peak = governance_guard.peak_equity
    if peak <= 0:
        peak = 1.0 # Safe default
        
    drawdown = max(0.0, (peak - current_equity) / peak) * 100
    penalty = governance_guard.get_drawdown_penalty_multiplier(current_equity)

    return GovernanceStatusResponse(
        portfolio_peak_equity=peak,
        current_equity=current_equity,
        drawdown_percent=drawdown,
        active_sizing_penalty=penalty,
        current_market_regime=regime_service.get_current_regime().value
    )

@router.get("/governance/drift/{strategy_name}")
def get_strategy_drift(strategy_name: str):
    """
    Returns the current Edge Decay status for a specific strategy.
    """
    state = drift_monitor.get_drift_state(strategy_name)
    # The current Z-Score implementation of DriftMonitor sets state to "DECAYED" or "HEALTHY"
    
    # (Optional lookup if you need the raw Z-score data. For now we just return the string)
    return {
        "strategy": strategy_name,
        "drift_status": state
    }

@router.post("/governance/settings")
def update_governance_settings(settings: GovernanceSettingsRequest):
    """
    Updates global governance constraints.
    """
    governance_guard.update_settings(
        drawdown_limit=settings.monthly_drawdown_limit,
        concentration=settings.max_strategy_concentration
    )
    return {"status": "success", "message": "Governance settings updated."}

@router.post("/governance/simulate", response_model=SimulationResponse)
def run_risk_simulation(req: SimulationRequest):
    """
    Runs a basic statistical projection based on proposed risk parameters.
    """
    # Simple linear heuristic for Phase 8: 
    # Max DD is roughly 3.5x the base risk in a mean-reverting regime.
    drawdown_cap = req.base_risk_percent * 3.5
    recovery_days = int(14 / max(0.1, req.base_risk_percent) * 1.5)
    viability = "SAFE" if req.base_risk_percent <= 3.0 else "DANGEROUS"
    
    return SimulationResponse(
        estimated_drawdown_cap=round(drawdown_cap, 2),
        estimated_recovery_days=recovery_days,
        viability_score=viability
    )
