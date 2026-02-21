import multiprocessing
import os
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

def _worker_process(symbol: int, time_range: str) -> Dict[str, float]:
    """
    Isolated process worker. 
    It's critical this happens in a unique process so singletons (like StateManager, 
    CapitalRegistry) don't bleed states across multiple parallel symbol tests.
    """
    try:
        # In a real scenario, this worker would:
        # 1. Initialize its own fresh SQLite/InMemory DB
        # 2. Instantiate a fresh BacktestCoordinator
        # 3. Load historical parquet files from disk for 'symbol'
        # 4. Await coordinator.run_historical_ticks(ticks)
        # 5. Return dict of final metrics (Win Rate, Peak Drawdown, Net Return)
        
        # Simulating work and result
        pid = os.getpid()
        logging.info(f"[PID {pid}] Running Backtest Simulation for Symbol: {symbol} | Range: {time_range}")
        
        # Synthetic output metrics
        metrics = {
            "symbol": symbol,
            "total_trades": 142,
            "win_rate_pct": 54.3,
            "net_pnl": 12450.0,
            "max_drawdown": -4200.0,
            "edge_ratio": 1.2
        }
        return metrics
    except Exception as e:
        logger.error(f"Worker process failed on symbol {symbol}: {e}")
        return {"symbol": symbol, "error": str(e)}

class BacktestRunner:
    """
    Phase 7: Distributed Multiprocessing Entrypoint
    Forks isolated OS processes to evaluate hundreds of symbols 
    and parameter sweeps at maximum CPU utilization.
    """
    def __init__(self, max_workers: int = None):
        # Defaults to the number of logical CPU cores on the system
        self.max_workers = max_workers or multiprocessing.cpu_count()

    def run_multi_symbol_sweep(self, symbols: List[int], time_range: str) -> List[Dict]:
        """Orchestrates the multiprocessing pool and aggregates the results."""
        logger.info(f"Setting up multiprocessing pool with {self.max_workers} physical workers.")
        
        results = []
        # Creates a Pool of worker processes. 
        # Using context manager ensures proper cleanup of forks.
        with multiprocessing.Pool(processes=self.max_workers) as pool:
            # Map issues the async tasks and collects them in order
            
            # Note: We must use a list comprehension or zip to pass the constant 'time_range'
            # arguments to the pool map. Starmap handles multiple args cleanly.
            args_list = [(sym, time_range) for sym in symbols]
            
            logger.info(f"Dispatching {len(symbols)} parallel backtesting jobs...")
            results = pool.starmap(_worker_process, args_list)
            
        logger.info("All multiprocessing tasks finished. Aggregating output.")
        return results

backtest_runner = BacktestRunner()
