import logging
import asyncio
from typing import List

from app.core.time_provider import time_provider
from app.backtest.history_feeder import HistoryFeeder
from app.backtest.backtest_broker import backtest_broker
from app.services.candle_builder import candle_builder
from app.services.strategy_worker import strategy_worker
from app.services.execution_engine import execution_engine
from app.services.mtm_engine import mtm_engine
from app.state_manager import state_manager, SystemState
from app.backtest.tearsheet import TearSheetGenerator

logger = logging.getLogger(__name__)

class BacktestRunner:
    """
    Phase 7: Deterministic Backtest Event Loop.
    Isolates the system, pumps data at max CPU speed, guarantees synchronous evaluation 
    before advancing the clock.
    """
    def __init__(self, data_filepath: str, initial_capital: float = 100000.0):
        self.feeder = HistoryFeeder(data_filepath)
        self.tearsheet = TearSheetGenerator(initial_capital)
        
        # Bind the mock broker to the execution engine
        # (We will add a method in execution_engine to support dependency injection)
        execution_engine.set_broker(backtest_broker)

    async def run(self):
        """The main simulation loop."""
        logger.info("Initializing Deterministic Backtest Run...")
        
        # 1. System Overrides
        time_provider.set_live_mode(False)
        state_manager.set_state(SystemState.READY)
        
        # Wipe background queues. In Backtesting, we evaluate the strategies synchronously.
        strategy_worker.stop_worker() 

        # 2. Event Loop
        simulated_start = None
        simulated_end = None
        total_ticks = 0

        for candle in self.feeder.yield_candles():
            # A. Advance Clock
            time_provider.set_simulated_time(int(candle.start_time.timestamp() * 1000))
            if not simulated_start:
                simulated_start = time_provider.utcnow()
            simulated_end = time_provider.utcnow()
            
            # B. Ground the Broker Reality
            backtest_broker.update_market_price(candle.instrument_token, candle.close)

            # C. Inject data into Builder
            # Flush MTM Engine synchronously against current market prices
            mtm_engine.update_price(candle.instrument_token, candle.close)
            
            # The exact equity is the starting allocated capital + unrealized PnL 
            # (Assuming the broker deduction logic happens automatically in live against the capital registry)
            from app.services.capital_registry import capital_registry
            current_equity = capital_registry.total_capital + mtm_engine.get_realtime_pnl()
            
            self.tearsheet.record_equity(time_provider.utcnow(), current_equity)

            # D. Synchronously Evaluate Strategies
            # Hijack the normal threaded route to guarantee determinism
            strategy_worker._evaluate_strategies(candle) 
            
            # At this point, any generated TradeIntents went to the ExecutionEngine,
            # which awaited backtest_broker, locking execution, completing the trade, 
            # and updating the MTM engine—all in the same event loop step.

            total_ticks += 1
            if total_ticks % 1000 == 0:
                logger.debug(f"Simulated {total_ticks} steps. Current simulated time: {time_provider.utcnow()}")

        # 3. Finalization
        logger.info("Backtest Simulation Exhausted.")
        logger.info(f"Start: {simulated_start} | End: {simulated_end} | Ticks: {total_ticks}")
        
        # Flatten remaining open positions
        self._liquidate_all_positions()

        # Generate Tear Sheet
        report = self.tearsheet.generate_report()
        logger.info(f"--- TEAR SHEET RESULT ---\n{report}")
        return report

    def _liquidate_all_positions(self):
        """Closes any remaining exposure at the end of the simulation."""
        # Simple hack for metrics: Just realize the current MTM values into capital
        # without dealing with intent routing.
        pass # To be fully implemented for strict accounting
