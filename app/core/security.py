import secrets

from fastapi import Header, HTTPException, Query, status, WebSocket

from app.config import config


def _extract_bearer_token(authorization: str) -> str:
    if not authorization:
        return ""
    prefix = "bearer "
    if authorization.lower().startswith(prefix):
        return authorization[len(prefix):].strip()
    return ""


def resolve_app_access_token(
    x_app_token: str = "",
    authorization: str = "",
    app_token: str = "",
) -> str:
    return (x_app_token or _extract_bearer_token(authorization) or app_token or "").strip()


def verify_app_access_token(token: str) -> bool:
    if not config.APP_ACCESS_TOKEN:
        return True
    return bool(token) and secrets.compare_digest(token, config.APP_ACCESS_TOKEN)


def require_app_access(
    x_app_token: str = Header(default="", alias="X-App-Token"),
    authorization: str = Header(default="", alias="Authorization"),
    app_token: str = Query(default=""),
) -> None:
    """
    Global read/write access gate for the public deployment.
    Supports header or bearer token and query fallback.
    """
    if not config.APP_ACCESS_TOKEN:
        return

    token = resolve_app_access_token(
        x_app_token=x_app_token,
        authorization=authorization,
        app_token=app_token,
    )
    if not verify_app_access_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing app access token.",
        )


async def websocket_app_access_allowed(websocket: WebSocket) -> bool:
    if not config.APP_ACCESS_TOKEN:
        return True

    token = resolve_app_access_token(
        x_app_token=websocket.headers.get("x-app-token", ""),
        authorization=websocket.headers.get("authorization", ""),
        app_token=websocket.query_params.get("app_token", ""),
    )
    if verify_app_access_token(token):
        return True

    await websocket.close(code=1008, reason="Unauthorized")
    return False


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
