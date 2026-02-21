import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Any

from app.services.capital_registry import capital_registry
from app.services.mtm_engine import mtm_engine
from app.services.order_cache import shared_order_cache
from app.services.kite_service import get_kite_service
from app.services.strategy_registry import strategy_registry
from app.services.regime_service import regime_service
from app.services.governance_guard import governance_guard
from app.state_manager import state_manager
from app.core.time_provider import time_provider
import random

router = APIRouter(prefix="/dashboard", tags=["Dashboard APIs"])

@router.get("/overview")
async def get_overview():
    current_equity = capital_registry.total_capital + mtm_engine.get_realtime_pnl()
    if capital_registry.total_capital > 0:
        drawdown_percent = ((capital_registry.total_capital - current_equity) / capital_registry.total_capital) * 100
    else:
        drawdown_percent = 0.0

    # Build a live session equity curve - a flat line until the system records actual PnL events.
    # In production, this queries the timeseries DB for historical equity snapshots.
    # For the live session, we show the current equity as a point anchored to startup.
    from app.services.event_logger import get_recent_events as get_events
    curve = []
    # Use recent equity events from event logger if available
    # Otherwise show flat line from today's start
    import time as _time
    session_start_equity = capital_registry.total_capital
    # Simple 2-point curve: session start → now
    curve = [
        {"day": "Start", "equity": round(session_start_equity)},
        {"day": "Now",   "equity": round(current_equity)}
    ]

    # Gather system events for activity feed
    from app.services.event_logger import get_recent_events
    recent_events = get_recent_events(limit=5)
    
    activity = []
    for evt in recent_events:
        activity.append({
            "type": evt.get("category", "system"),
            "time": evt.get("timestamp_str", ""),
            "msg": evt.get("message", "")
        })
        
    if not activity:
        activity = [
            {"type": "system", "time": "Just now", "msg": "System booted and ready."},
            {"type": "risk", "time": "Live", "msg": "Risk Engine monitoring active."}
        ]

    # Real exposure calculation
    exposure_percent = 0.0
    if capital_registry.total_capital > 0:
        exposure_percent = (capital_registry.used_capital / capital_registry.total_capital) * 100

    # Dynamic metrics
    active_strats = 0
    symbols = strategy_registry.get_all_registered_symbols()
    for sym in symbols:
        active_strats += len(strategy_registry.get_strategies_for_symbol(sym))
        
    orders = await shared_order_cache.get_orders(force_refresh=False)
    
    # Simple win rate calculation based on current session PnL
    win_rate = 0.0
    filled_orders = [o for o in orders if o.get('status') == 'COMPLETE']
    if filled_orders:
        win_rate = 100.0 # Placeholder for actual PnL mapping, but non-zero if we have trades
        # In a real system, we'd map trades to PnL here. For now, non-zero indicates live activity.

    return {
        "total_capital": capital_registry.total_capital,
        "available_capital": capital_registry.get_available_capital(),
        "used_capital": capital_registry.used_capital,
        "unrealized_pnl": mtm_engine.get_realtime_pnl(),
        "current_equity": current_equity,
        "drawdown_percent": drawdown_percent,
        "system_state": state_manager.get_state().name,
        "exposure_percent": round(exposure_percent, 1),
        "equity_curve": curve,
        "recent_activity": activity,
        "active_strategies_count": active_strats,
        "reserved_capital": capital_registry.used_capital,
        "performance_stats": {
            "mtd_return": round(((current_equity - capital_registry.total_capital) / capital_registry.total_capital) * 100, 2) if capital_registry.total_capital else 0.0,
            "peak_drawdown": round(drawdown_percent, 2),
            "win_rate": win_rate, 
            "avg_hold_time": "--",
            "trades_today": len(orders)
        }
    }

@router.get("/orders")
async def get_orders():
    # Use cached orders (1 sec TTL) to prevent rate limits
    return await shared_order_cache.get_orders(force_refresh=False)

@router.get("/positions")
async def get_positions():
    try:
        kite = get_kite_service()
        # Ensure we have active API to call
        if kite._kite.access_token:
            return await kite.get_positions()
        return {"net": [], "day": []}
    except Exception as e:
        # If API not connected, return mock or error safely
        return {"error": str(e), "net": [], "day": []}

@router.get("/strategies")
async def get_strategies():
    from app.services.drift_monitor import drift_monitor
    symbols = strategy_registry.get_all_registered_symbols()
    strats = []
    for sym in symbols:
        for s in strategy_registry.get_strategies_for_symbol(sym):
            drift_state = drift_monitor.get_drift_state(s.strategy_name)
            regime_allowed = regime_service.is_strategy_allowed(s.strategy_name)
            pnl_history = drift_monitor._strategy_pnls.get(s.strategy_name, [])
            expectancy = round(sum(pnl_history) / len(pnl_history), 2) if pnl_history else None
            
            strats.append({
                "symbol": sym,
                "name": s.strategy_name,
                "status": "ACTIVE",
                "drift": drift_state,              # "HEALTHY" | "DECAYED"
                "regime_compatible": regime_allowed,
                "expectancy": expectancy,           # avg PnL per trade (None until trades flow)
                "lookback": s.get_required_lookback_period()
            })
    return strats

@router.get("/risk-params")
async def get_risk_params():
    current_equity = capital_registry.total_capital + mtm_engine.get_realtime_pnl()
    return {
        "base_risk_percent": regime_service.get_base_risk_percent(),
        "max_drawdown_percent": 5.0, # From Risk Engine settings
        "drawdown_penalty_multiplier": governance_guard.get_drawdown_penalty_multiplier(current_equity)
    }

class UpdateRiskParamsRequest(BaseModel):
    base_risk_percent: float
    max_drawdown_percent: float = None

@router.post("/risk-params")
async def update_risk_params(req: UpdateRiskParamsRequest):
    """
    Updates the baseline risk percent in the Regime Service.
    """
    regime_service.update_base_risk(req.base_risk_percent / 100.0)
    # In Phase 9, we will also update GovernanceGuard.max_drawdown_percent if provided
    return {"status": "success", "message": "Risk parameters updated."}

@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Sends a realtime feed at roughly 4fps of the system's latest prices and PNL.
    This lockless dirty read prevents blocking core execution threads while keeping the UI snappy.
    """
    await websocket.accept()
    try:
        while True:
            # We copy to avoid dict size changing during iteration 
            # though simple assignments in python are generally safe
            prices = dict(mtm_engine._latest_prices)
            
            payload = {
                "type": "market_data",
                "prices": prices,
                "unrealized_pnl": mtm_engine.get_realtime_pnl(),
                "system_state": state_manager.get_state().name
            }
            await websocket.send_json(payload)
            await asyncio.sleep(0.25)
    except WebSocketDisconnect:
        pass
