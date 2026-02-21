import logging
import asyncio
import time
from app.core.time_provider import time_provider
from app.models.tick_model import TickModel
from app.services.backtest_coordinator import backtest_coordinator
from app.core.backtest_runner import backtest_runner

logging.basicConfig(level=logging.INFO)

def test_time_abstraction():
    print("\n--- Testing TimeProvider Abstraction ---")
    time_provider.set_live_mode(False)
    
    # Simulate January 1, 2024 at 09:15:00 IST
    # 1704080700000 ms
    test_time_ms = 1704080700000
    time_provider.set_simulated_time(test_time_ms)
    
    assert time_provider.time_ms() == test_time_ms, "Failed to warp ms time"
    assert time_provider.time() == (test_time_ms / 1000.0), "Failed to warp sec time"
    
    print(f"System Clock Hijacked to: {time_provider.utcnow()}")

def test_multiprocessing_runner():
    print("\n--- Testing Multiprocessing Execution Engine ---")
    start = time.perf_counter()
    
    # We will "backtest" 10 symbols across the CPU cores
    symbols_to_test = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    
    results = backtest_runner.run_multi_symbol_sweep(symbols_to_test, time_range="2024-01-01 to 2024-01-31")
    
    end = time.perf_counter()
    elapsed = end - start
    
    print(f"\nMultiprocessing sweep completed in {elapsed:.4f} seconds.")
    print("Results Array Sample:")
    for r in results[:3]:
        print(r)
        
    assert len(results) == 10, "Not all symbols were processed!"
    assert all("win_rate_pct" in r for r in results), "Metrics dict malformed."

if __name__ == "__main__":
    test_time_abstraction()
    test_multiprocessing_runner()
