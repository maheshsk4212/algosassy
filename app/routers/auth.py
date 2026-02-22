import logging
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.kite_service import get_kite_service
from app.services.auth_manager import auth_manager
from app.services.capital_registry import capital_registry
from app.services.websocket_manager import websocket_manager
from app.services.strategy_registry import strategy_registry
from app.services.event_logger import log_event
from app.config import config
from app.state_manager import state_manager, SystemState

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/status")
async def auth_status(db: Session = Depends(get_db)):
    """
    Lightweight auth diagnostic endpoint for UI visibility.
    Does not make network calls to Kite; returns current local auth diagnosis.
    """
    return auth_manager.get_status_snapshot(db)

@router.get("/login")
async def login():
    """Redirects user to the Kite API login page."""
    kite = get_kite_service()
    login_url = kite.login_url()
    logger.info("Redirecting to Kite login page.")
    return RedirectResponse(login_url)

@router.get("/callback")
async def callback(request_token: str = Query(..., description="The request token returned by Kite API"), db: Session = Depends(get_db)):
    """Handles Kite callback, validates request_token and retrieves access_token."""
    logger.info("Received callback from Kite API.")
    try:
        success = await auth_manager.process_callback(request_token, db)
        if success:
            # Sync capital registry with live Zerodha balance
            try:
                kite = get_kite_service()
                margins = await kite.get_margins()
                equity_available = margins.get('equity', {}).get('available', {}).get('live_balance', 0.0)
                if equity_available > 0:
                    capital_registry.total_capital = equity_available
                    logger.info(f"Capital registry seeded from Kite margins: ₹{equity_available:,.2f}")
                    log_event("system", f"Capital synced from Zerodha: ₹{equity_available:,.2f}")
            except Exception as margin_err:
                logger.warning(f"Failed to sync margins: {margin_err}. Keeping default capital.")

            # After login from any device, wire subscriptions and start live stream immediately.
            symbols = strategy_registry.get_all_registered_symbols() or (config.AUTOTRADE_SYMBOLS or [256265])
            try:
                websocket_manager.subscribe(symbols)
                if state_manager.get_state() == SystemState.READY and not websocket_manager.is_connected:
                    websocket_manager.start_stream()
            except Exception as ws_err:
                logger.warning(f"WebSocket auto-start after login failed: {ws_err}")
            return RedirectResponse(url=f"{config.FRONTEND_URL}/")
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Callback processing failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred during authentication.")
