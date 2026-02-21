import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.config import config
from app.core.backtest_runner import backtest_runner

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backtest", tags=["Backtest"])


class BacktestRunRequest(BaseModel):
    strategy_name: str = Field(min_length=1)
    time_range: str = Field(default="ytd")
    vol_model: str = Field(default="historical")
    symbols: Optional[List[int]] = None


class BacktestSaveRequest(BaseModel):
    strategy: str = Field(min_length=1)
    stats: Optional[Dict[str, Any]] = None
    curve: Optional[List[Dict[str, Any]]] = None


def _ensure_backtest_enabled() -> None:
    if not config.BACKTEST_API_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backtest API is disabled on this server.",
        )


def _build_equity_curve(initial_equity: float, final_equity: float, points: int = 30) -> List[Dict[str, float]]:
    if points <= 1:
        return [{"day": 0, "equity": round(final_equity, 2)}]
    return [
        {
            "day": i,
            "equity": round(initial_equity + ((final_equity - initial_equity) * (i / (points - 1))), 2),
        }
        for i in range(points)
    ]


@router.get("/status")
async def backtest_status():
    return {
        "enabled": config.BACKTEST_API_ENABLED,
        "save_dir": config.BACKTEST_SAVE_DIR,
    }


@router.post("/run")
async def run_backtest(req: BacktestRunRequest):
    _ensure_backtest_enabled()

    symbols = req.symbols or [256265]
    results = await asyncio.to_thread(
        backtest_runner.run_multi_symbol_sweep, symbols, req.time_range
    )

    valid_results = [row for row in results if "error" not in row]
    if not valid_results:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backtest run failed for all symbols.",
        )

    initial_equity = 100000.0
    total_trades = sum(max(int(row.get("total_trades", 0)), 0) for row in valid_results)
    win_rate_pct = mean(float(row.get("win_rate_pct", 0.0)) for row in valid_results)
    net_pnl = float(sum(float(row.get("net_pnl", 0.0)) for row in valid_results))
    max_drawdown_abs = max(abs(float(row.get("max_drawdown", 0.0))) for row in valid_results)
    sharpe_ratio = mean(float(row.get("edge_ratio", 0.0)) for row in valid_results)

    final_equity = initial_equity + net_pnl
    cagr = (net_pnl / initial_equity) * 100.0
    expectancy = (net_pnl / total_trades) if total_trades else 0.0

    slippage_drag = 0.0
    missed_fills = 0.0
    risk_drag = 0.0
    net_adjusted_return = cagr - slippage_drag - risk_drag

    return {
        "strategy_name": req.strategy_name,
        "time_range": req.time_range,
        "symbols_tested": symbols,
        "equity_curve": _build_equity_curve(initial_equity, final_equity),
        "max_drawdown": round(max_drawdown_abs, 2),
        "cagr": round(cagr, 2),
        "sharpe_ratio": round(sharpe_ratio, 2),
        "expectancy": round(expectancy, 2),
        "slippage_drag": round(slippage_drag, 2),
        "missed_fills": round(missed_fills, 2),
        "risk_drag": round(risk_drag, 2),
        "net_adjusted_return": round(net_adjusted_return, 2),
        "total_trades": total_trades,
        "win_rate": round(max(0.0, min(1.0, win_rate_pct / 100.0)), 4),
    }


@router.post("/save")
async def save_backtest(req: BacktestSaveRequest):
    _ensure_backtest_enabled()

    save_dir = Path(config.BACKTEST_SAVE_DIR)
    save_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_strategy = "".join(c if c.isalnum() or c in {"-", "_"} else "_" for c in req.strategy)[:64]
    filename = f"{timestamp}_{safe_strategy or 'run'}.json"
    file_path = save_dir / filename

    payload = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "strategy": req.strategy,
        "stats": req.stats or {},
        "curve": req.curve or [],
    }
    file_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2))

    logger.info(f"Saved backtest run: {file_path}")
    return {
        "status": "saved",
        "path": str(file_path),
    }
