from fastapi import APIRouter, Depends, HTTPException, status
from app.state_manager import state_manager, SystemState
from app.core.event_bus import event_bus, EventType

router = APIRouter(prefix="/protected", tags=["Protected Actions"])

def require_ready_state():
    """Dependency to enforce that system must be in READY state."""
    current_state = state_manager.get_state()
    if current_state != SystemState.READY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=f"Action blocked. System state is {current_state.name}."
        )

@router.get("/health", dependencies=[Depends(require_ready_state)])
async def protected_health():
    """Test route that is only accessible when the system is READY."""
    return {"status": "success", "message": "System is READY and trading is enabled."}

@router.get("/status")
async def status_check():
    """Unprotected route to check the current system state."""
    return {"state": state_manager.get_state().name}

@router.post("/kill-switch", dependencies=[Depends(require_ready_state)])
async def trigger_kill_switch():
    """
    Manual emergency trigger from the UI Sidebar.
    Fires the global liquidation event.
    """
    event_bus.publish(EventType.EMERGENCY_LIQUIDATE, {
        "reason": "Manual UI Intervention",
        "source": "User-Admin"
    })
    return {"status": "success", "message": "Emergency Liquidation Triggered"}
