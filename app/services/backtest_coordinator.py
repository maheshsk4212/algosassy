import logging
import asyncio
from typing import List

from app.core.time_provider import time_provider
from app.models.tick_model import TickModel
from app.services.tick_processor import tick_processor
from app.services.capital_registry import capital_registry
from app.services.mtm_engine import mtm_engine
from app.state_manager import state_manager, SystemState

logger = logging.getLogger(__name__)

class BacktestCoordinator:
    """
    Phase 7: Offline Orchestrator.
    Bypasses WebSocketManager. Reads historical ticks and pushes them through
    the identical TickProcessor pipeline, manually advancing the TimeProvider.
    """
    def __init__(self):
        self._is_running = False

    def setup_backtest_environment(self, initial_capital: float = 100000.0):
        """Prepare all state managers for an offline run."""
        state_manager.set_state(SystemState.READY)
        time_provider.set_live_mode(False)
        capital_registry._available_capital = initial_capital
        capital_registry._peak_portfolio_equity = initial_capital
        mtm_engine._realized_pnl = 0.0
        
        logger.info(f"Backtest Environment Initialized. Starting Capital: {initial_capital}")

    async def run_historical_ticks(self, historical_ticks: List[TickModel]):
        """
        Feeds ticks sequentially.
        In a real scenario, this reads from CSV/Parquet and yields chunks.
        """
        self._is_running = True
        logger.info(f"Starting Historical Playback: {len(historical_ticks)} ticks...")
        
        for tick in historical_ticks:
            if not self._is_running:
                break
                
            # 1. Advance the simulated clock to exactly when this tick arrived
            time_provider.set_simulated_time(tick.exchange_timestamp)
            
            # 2. Feed the tick directly to the processor (bypassing the queue)
            # True single-threaded determinism vs live concurrent queues
            tick_processor._process_tick(tick)
            
            # Allow asyncio event loop a micro-yield if strategies are processing
            await asyncio.sleep(0)
            
        logger.info("Historical Playback Complete.")
        self.teardown()

    def teardown(self):
        self._is_running = False
        time_provider.set_live_mode(True)
        final_equity = capital_registry.get_available_capital() + mtm_engine.get_total_unrealized_pnl()
        logger.info(f"Backtest Teardown. Final Estimated Equity: {final_equity}")

backtest_coordinator = BacktestCoordinator()
