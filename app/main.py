import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
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
from app.strategies.ema_crossover_strategy import EMACrossoverStrategy

# Initialize sub-systems for early listener binding
from app.services import kill_switch
from app.services.broker_reconciliation import broker_reconciliation_service
from app.services.execution_engine import execution_engine
from app.services.order_cache import shared_order_cache
from app.services.idempotency_manager import idempotency_manager
from app.services.alert_manager import alert_manager
from app.services.audit_reporter import audit_reporter
from app.core.metrics import (
    router as metrics_router, TICK_QUEUE_DEPTH, STRATEGY_QUEUE_DEPTH, 
    AVAILABLE_CAPITAL, UNREALIZED_PNL, SYSTEM_STATE_GAUGE
)
from app.core.logging_config import setup_async_logging

from app.routers import auth, protected, health, dashboard, governance, audit

# Ensure tables are created (useful for dev/sqlite without migrations)
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

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
    
    # Register Dummy Example Strategy for testing on NIFTY 50 (Token: 256265)
    default_strategy = EMACrossoverStrategy(short_period=9, long_period=21, risk_percent=1.0)
    strategy_registry.register_strategy(symbol=256265, strategy=default_strategy)

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

app = FastAPI(title="Algo-Sassy API", lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(protected.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(governance.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(metrics_router)  # Phase 6 Metrics exposed on /metrics

@app.get("/")
def root():
    return {"message": "Algo-Sassy Backend System", "state": state_manager.get_state().name}
