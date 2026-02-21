import unittest
from unittest.mock import AsyncMock, patch

from app.models.trade_intent import TradeIntent, TradeDirection
from app.services.execution_engine import ExecutionEngine


def _sample_intent() -> TradeIntent:
    return TradeIntent(
        strategy_name="regression_test",
        symbol=256265,
        direction=TradeDirection.BUY,
        entry_price=100.0,
        stop_loss=95.0,
        target=110.0,
    )


class ExecutionEngineBrokerInitRegressionTest(unittest.IsolatedAsyncioTestCase):
    async def test_live_broker_is_resolved_lazily(self):
        engine = ExecutionEngine(max_retries=1)
        mock_broker = type("MockBroker", (), {})()
        mock_broker.place_order = AsyncMock(return_value=True)

        with patch("app.services.execution_engine.get_kite_service", return_value=mock_broker):
            result = await engine._attempt_broker_execution(_sample_intent(), assigned_position_size=5)

        self.assertTrue(result)
        mock_broker.place_order.assert_awaited_once()
        self.assertIs(engine._broker, mock_broker)

    async def test_injected_broker_overrides_live_lookup(self):
        engine = ExecutionEngine(max_retries=1)
        mock_broker = type("MockBacktestBroker", (), {})()
        mock_broker.place_order = AsyncMock(return_value=True)
        engine.set_broker(mock_broker)

        with patch("app.services.execution_engine.get_kite_service", side_effect=AssertionError("Should not be called")):
            result = await engine._attempt_broker_execution(_sample_intent(), assigned_position_size=5)

        self.assertTrue(result)
        mock_broker.place_order.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
