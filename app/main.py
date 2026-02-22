import logging
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import config
from app.core.database import Base, engine, SessionLocal
from app.state_manager import state_manager, SystemState
from app.services.kite_service import init_kite_service
from app.services.auth_manager import auth_manager
from app.services.tick_processor import tick_processor
from app.services.websocket_manager import websocket_manager
from app.services.strategy_worker import strategy_worker
from app.services.strategy_registry import strategy_registry
from app.services.user_strategy_runtime import deploy_user_strategy
from app.strategies.ema_crossover_strategy import EMACrossoverStrategy
from app.models.strategy_definition_model import StrategyDefinition

# Initialize sub-systems for early listener binding
from app.services import kill_switch
from app.services.broker_reconciliation import broker_reconciliation_service
from app.services.execution_engine import execution_engine
from app.services.order_cache import shared_order_cache
from app.services.idempotency_manager import idempotency_manager
from app.services.alert_manager import alert_manager
from app.services.audit_reporter import audit_reporter
from app.services.governance_guard import governance_guard
from app.core.metrics import (
    router as metrics_router, TICK_QUEUE_DEPTH, STRATEGY_QUEUE_DEPTH, 
    AVAILABLE_CAPITAL, UNREALIZED_PNL, SYSTEM_STATE_GAUGE
)
from app.core.logging_config import setup_async_logging
from app.core.security import resolve_app_access_token, verify_app_access_token

from app.routers import auth, protected, health, dashboard, governance, audit, backtest

# Ensure tables are created (useful for dev/sqlite without migrations)
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
logging.getLogger("apscheduler").setLevel(logging.WARNING)

scheduler = AsyncIOScheduler()

async def daily_token_check():
    """Scheduled job to check token validity at 08:30 IST."""
    logger.info("Running daily pre-market token validation...")
    db = SessionLocal()
    try:
        is_valid = await auth_manager.validate_current_token(db)
        if not is_valid:
            logger.error("ALERT: Daily token validation failed. Trading is blocked until re-authenticated.")
    finally:
        db.close()

def update_telemetry_gauges():
    """Background job feeding Phase 6 Prometheus Gauges without halting hot-paths."""
    from app.services.tick_queue_manager import tick_queue_manager
    from app.services.strategy_worker import strategy_worker
    from app.services.capital_registry import capital_registry
    from app.services.mtm_engine import mtm_engine
    
    TICK_QUEUE_DEPTH.set(tick_queue_manager.get_queue_size())
    STRATEGY_QUEUE_DEPTH.set(strategy_worker.event_queue.qsize())
    AVAILABLE_CAPITAL.set(capital_registry.get_available_capital())
    UNREALIZED_PNL.set(mtm_engine.get_realtime_pnl())
    SYSTEM_STATE_GAUGE.set(state_manager.get_state().value)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 6: Start Async JSON Logger
    log_listener = setup_async_logging()
    
    # 1. Database init
    Base.metadata.create_all(bind=engine)
    logger.info("Initializing Algo-Sassy Application...")
    
    if not config.KITE_API_KEY:
        logger.warning("KITE_API_KEY missing from environment variables.")
    init_kite_service(api_key=config.KITE_API_KEY)
    execution_engine.use_live_broker()
    
    # Startup validation
    db = SessionLocal()
    try:
        logger.info("Validating existing authentication token...")
        await auth_manager.validate_current_token(db)
    finally:
        db.close()
        
    logger.info(f"Startup complete. Current system state: {state_manager.get_state().name}")
    
    # If already authenticated, seed the capital registry with live margin balance
    if state_manager.get_state() == SystemState.READY:
        try:
            from app.services.kite_service import get_kite_service
            from app.services.capital_registry import capital_registry
            from app.services.event_logger import log_event
            kite = get_kite_service()
            margins = await kite.get_margins()
            equity_available = margins.get('equity', {}).get('available', {}).get('live_balance', 0.0)
            if equity_available > 0:
                capital_registry.total_capital = equity_available
                governance_guard.peak_equity = equity_available
                logger.info(f"Capital registry seeded from Kite margins on startup: ₹{equity_available:,.2f}")
                log_event("system", f"Capital synced from Zerodha at startup: ₹{equity_available:,.2f}")
        except Exception as e:
            logger.warning(f"Startup margin sync failed: {e}. Trading will use default capital.")

    # Phase 2 component startup
    logger.info("Starting Tick Consumer Worker thread...")
    tick_processor.start_worker()

    # Phase 3 component startup
    logger.info("Starting Strategy Engine Worker thread...")
    strategy_worker.start_worker()
    
    # Register configured autonomous strategies.
    # Use AUTOTRADE_SYMBOLS (comma-separated instrument tokens) to control live tradable symbols.
    symbols = config.AUTOTRADE_SYMBOLS or [256265]
    for symbol in symbols:
        strategy_registry.register_strategy(
            symbol=symbol,
            strategy=EMACrossoverStrategy(short_period=9, long_period=21, risk_percent=1.0),
        )
    logger.info(f"Auto strategies registered for symbols: {symbols}")

    # Restore user-deployed strategies so autonomous flow survives process restarts.
    restore_db = None
    try:
        restored = 0
        restored_symbols = set()
        restore_db = SessionLocal()
        rows = restore_db.query(StrategyDefinition).filter(StrategyDefinition.is_deployed.is_(True)).all()
        for row in rows:
            risk_percent = None
            try:
                risk_payload = json.loads(row.risk_json or "{}")
                risk_percent = risk_payload.get("risk_percent") or risk_payload.get("base_risk_percent")
            except (TypeError, ValueError):
                risk_percent = None
            symbol, runtime_name = deploy_user_strategy(
                strategy_id=row.strategy_id,
                instrument=row.instrument,
                risk_percent=risk_percent,
            )
            row.runtime_symbol = symbol
            row.runtime_strategy_name = runtime_name
            restored += 1
            restored_symbols.add(symbol)
        if rows:
            restore_db.commit()
        if restored:
            symbols = sorted(set(symbols).union(restored_symbols))
            logger.info(f"Restored {restored} deployed user strategies.")
    except Exception as restore_err:
        logger.warning(f"User strategy restore skipped: {restore_err}")
    finally:
        if restore_db is not None:
            restore_db.close()

    websocket_manager.subscribe(symbols)
    logger.info(f"Prepared WebSocket subscriptions for symbols: {symbols}")

    if state_manager.get_state() == SystemState.READY:
        logger.info("System READY. Initializing WebSocket Producer...")
        websocket_manager.start_stream()

    # Start APScheduler
    scheduler.add_job(daily_token_check, 'cron', day_of_week='mon-fri', hour=8, minute=30, id='daily_token_check')
    
    # Phase 4 Broker Reconciliation Schedule (Every 15 Seconds)
    scheduler.add_job(broker_reconciliation_service.run_reconciliation_cycle, 'interval', seconds=15, id='broker_recon')
    
    # Phase 6 Prometheus Gauge Update Schedule (Every 1 Second)
    scheduler.add_job(update_telemetry_gauges, 'interval', seconds=1, id='telemetry_gauges')
    
    # Phase 8 Weekly Audit Reporter (Runs Friday at 16:30 IST typically)
    # Using async wrapper since APScheduler is sync by default unless AsyncIOScheduler is used
    # Assuming AsyncIOScheduler in this context for async run_weekly_audit
    scheduler.add_job(audit_reporter.run_weekly_audit, 'cron', day_of_week='fri', hour=16, minute=30, id='weekly_audit')
        
    scheduler.start()
    
    yield

    # Shutdown Phase 6 Async Logger cleanly
    if log_listener:
        log_listener.stop()
    
    logger.info("Shutting down Algo-Sassy Application...")
    scheduler.shutdown()
    tick_processor.stop_worker()
    strategy_worker.stop_worker()
    websocket_manager.stop_stream()

app = FastAPI(
    title="Algo-Sassy API",
    lifespan=lifespan,
    docs_url="/docs" if config.API_DOCS_ENABLED else None,
    redoc_url="/redoc" if config.API_DOCS_ENABLED else None,
    openapi_url="/openapi.json" if config.API_DOCS_ENABLED else None,
)

from fastapi.middleware.cors import CORSMiddleware

allowed_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
if config.FRONTEND_URL:
    allowed_origins.add(config.FRONTEND_URL)
allowed_origins.update(config.CORS_ALLOWED_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PUBLIC_PATHS = {
    "/",
    "/api/v1/auth/login",
    "/api/v1/auth/callback",
}


def _is_protected_surface(path: str) -> bool:
    return path.startswith("/api/v1/") or path == "/metrics"


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    path = request.url.path

    if (
        config.APP_ACCESS_TOKEN
        and request.method != "OPTIONS"
        and _is_protected_surface(path)
        and path not in PUBLIC_PATHS
    ):
        token = resolve_app_access_token(
            x_app_token=request.headers.get("x-app-token", ""),
            authorization=request.headers.get("authorization", ""),
            app_token=request.query_params.get("app_token", ""),
        )
        if not verify_app_access_token(token):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing app access token."},
            )

    response = await call_next(request)

    # Baseline response hardening headers.
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
    return response

app.include_router(auth.router, prefix="/api/v1")
app.include_router(protected.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(governance.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(backtest.router, prefix="/api/v1")
app.include_router(metrics_router)  # Phase 6 Metrics exposed on /metrics

@app.get("/")
def root():
    return {"message": "Algo-Sassy Backend System"}
