import logging
import queue
import threading
import time
from typing import Optional

from app.models.candle_model import CandleModel
from app.services.strategy_registry import strategy_registry
from app.state_manager import state_manager, SystemState

from app.services.risk_engine import risk_engine
from app.services.execution_engine import execution_engine
import asyncio

logger = logging.getLogger(__name__)

class StrategyWorker:
    """
    Dedicated Consumer Thread for event-driven strategy evaluation.
    Isolates slow strategy algorithms from the critical TickProcessing/CandleBuilding loop.
    """
    def __init__(self, maxsize: int = 5000):
        # The buffer connecting CandleBuilder to StrategyEngine
        self.event_queue = queue.Queue(maxsize=maxsize)
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None

    def start_worker(self):
        if self._running:
            return
            
        self._running = True
        self._worker_thread = threading.Thread(target=self._consume_loop, daemon=True, name="StrategyWorker")
        self._worker_thread.start()
        logger.info("Strategy Worker thread started.")

    def stop_worker(self):
        self._running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=2.0)
            logger.info("Strategy Worker thread stopped.")

    def _consume_loop(self):
        """Infinite loop designed to run in dedicated background thread."""
        while self._running:
            try:
                # State guard: Skip execution if system is not READY
                # (Still clears the queue to prevent stale backlogs if state recovers later)
                if state_manager.get_state() != SystemState.READY:
                    try:
                        self.event_queue.get_nowait()
                        self.event_queue.task_done()
                    except queue.Empty:
                        time.sleep(1)
                    continue

                try:
                    closed_candle: CandleModel = self.event_queue.get(timeout=1.0)
                except queue.Empty:
                    continue  # Timeout, loop again
                
                try:
                    self._evaluate_strategies(closed_candle)
                except Exception as e:
                    logger.error(f"Failed during strategy evaluation route: {e}", exc_info=True)
                finally:
                    self.event_queue.task_done()
                    
            except Exception as e:
                logger.error(f"Critical error in Strategy Worker loop: {e}", exc_info=True)
                time.sleep(1) 

    def _evaluate_strategies(self, candle: CandleModel):
        """Routes completed candles to registered strategies safely."""
        logger.debug(f"Strategy Worker received closed candle for {candle.instrument_token}")
        
        strategies = strategy_registry.get_strategies_for_symbol(candle.instrument_token)
        
        if not strategies:
            return

        for strategy in strategies:
            try:
                # Execution of Pure Function Strategy
                intent = strategy.on_candle_close(candle)
                
                if intent is not None:
                    logger.info(f"TRADE INTENT GENERATED: {intent}")
                    
                    # Phase 4 & 5 Routing
                    decision = risk_engine.evaluate_intent(intent)
                    if decision.approved:
                        # Offload to asyncio event loop without blocking the strategy thread
                        # For safety, since StrategyWorker is a threading.Thread, we use asyncio.run 
                        # or dispatch to the main ASGI event loop. We'll use a fast background task.
                        asyncio.run(execution_engine.execute_decision(decision))
                    
            except Exception as e:
                # Isolate exceptions per strategy so others don't fail
                logger.error(f"Strategy [{strategy.strategy_name}] threw exception: {e}", exc_info=True)

strategy_worker = StrategyWorker()
