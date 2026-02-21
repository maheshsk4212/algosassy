import asyncio
import logging

from app.core.logging_config import setup_async_logging
from app.backtest.backtest_runner import BacktestRunner

# Simple mock strategy hook for testing
from app.services.strategy_registry import strategy_registry
from app.strategies.ema_crossover_strategy import EMACrossoverStrategy

async def main():
    listener = setup_async_logging()
    
    # Register the strategy to standard symbol (1) matching our test data
    strategy_registry.register_strategy(1, EMACrossoverStrategy(short_period=2, long_period=4))
    
    # Initialize the runner with test history
    runner = BacktestRunner(
        data_filepath="data/history/test_data.csv",
        initial_capital=100000.0
    )
    
    # Fire the deterministic loop
    report = await runner.run()
    print(report)

if __name__ == "__main__":
    asyncio.run(main())
