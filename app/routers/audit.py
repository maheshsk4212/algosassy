import logging
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.services.event_logger import get_recent_events, log_event
from app.services.audit_reporter import audit_reporter
from app.core.security import require_admin_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("/logs")
async def get_audit_logs(
    limit: int = Query(default=100, le=500),
    category: Optional[str] = Query(default=None)
):
    """
    Returns recent system audit events from the in-memory event logger.
    Used by the Audit Log dashboard page.
    """
    events = get_recent_events(limit=limit)
    if category:
        events = [e for e in events if e.get("category") == category]
    return {
        "total": len(events),
        "events": events
    }


@router.post("/log", dependencies=[Depends(require_admin_token)])
async def create_log_entry(category: str, message: str):
    """Allows external triggers to add entries to the audit log."""
    log_event(category, message)
    return {"status": "logged"}


@router.post("/run-weekly", dependencies=[Depends(require_admin_token)])
async def trigger_weekly_audit():
    """
    Manually triggers the weekly governance audit report.
    Normally runs on a schedule but can be triggered from the UI.
    """
    try:
        await audit_reporter.run_weekly_audit()
        return {"status": "dispatched", "message": "Weekly audit report dispatched successfully."}
    except Exception as e:
        logger.error(f"Weekly audit trigger failed: {e}")
        return {"status": "error", "message": str(e)}
