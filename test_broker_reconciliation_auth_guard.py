import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services.broker_reconciliation import BrokerReconciliationService
from app.state_manager import SystemState


class BrokerReconciliationAuthGuardTest(unittest.IsolatedAsyncioTestCase):
    async def test_skips_broker_calls_when_system_not_ready(self):
        service = BrokerReconciliationService()

        with patch(
            "app.services.broker_reconciliation.state_manager.get_state",
            return_value=SystemState.AUTH_REQUIRED,
        ), patch(
            "app.services.kite_service.get_kite_service",
            side_effect=AssertionError("Broker service should not be resolved when not ready."),
        ):
            await service.run_reconciliation_cycle()

    async def test_skips_positions_call_without_access_token(self):
        service = BrokerReconciliationService()
        mock_kite = SimpleNamespace(
            _kite=SimpleNamespace(access_token=""),
            get_positions=AsyncMock(return_value={"net": []}),
        )

        with patch(
            "app.services.broker_reconciliation.state_manager.get_state",
            return_value=SystemState.READY,
        ), patch(
            "app.services.kite_service.get_kite_service",
            return_value=mock_kite,
        ):
            await service.run_reconciliation_cycle()

        mock_kite.get_positions.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
