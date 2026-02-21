import secrets
from fastapi import Header, HTTPException, status

from app.config import config


def require_admin_token(x_admin_token: str = Header(default="", alias="X-Admin-Token")) -> None:
    """
    Minimal authN/authZ gate for destructive admin endpoints.
    """
    if not config.ADMIN_API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin token is not configured on the server.",
        )

    if not x_admin_token or not secrets.compare_digest(x_admin_token, config.ADMIN_API_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin token.",
        )
