import logging
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.kite_service import get_kite_service
from app.services.auth_manager import auth_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

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
            return {"status": "success", "message": "Authentication successful. System state is READY."}
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed.")
    except Exception as e:
        logger.error(f"Callback processing failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred during authentication.")
