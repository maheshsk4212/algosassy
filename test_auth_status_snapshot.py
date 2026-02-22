import unittest
from unittest.mock import MagicMock, patch

from app.services.auth_manager import AuthManager
from app.state_manager import SystemState


def _mock_db_with_active_token(active: bool):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = object() if active else None
    return db


class AuthStatusSnapshotTest(unittest.TestCase):
    def test_reports_no_active_token_reason(self):
        manager = AuthManager()
        db = _mock_db_with_active_token(active=False)

        with patch(
            "app.services.auth_manager.state_manager.get_state",
            return_value=SystemState.AUTH_REQUIRED,
        ), patch(
            "app.services.auth_manager.config.KITE_API_KEY",
            "key",
        ), patch(
            "app.services.auth_manager.config.KITE_API_SECRET",
            "secret",
        ):
            snapshot = manager.get_status_snapshot(db)

        self.assertEqual(snapshot["reason_code"], "NO_ACTIVE_TOKEN")
        self.assertFalse(snapshot["authenticated"])
        self.assertFalse(snapshot["has_active_token"])

    def test_reports_ready_when_state_ready(self):
        manager = AuthManager()
        db = _mock_db_with_active_token(active=True)

        with patch(
            "app.services.auth_manager.state_manager.get_state",
            return_value=SystemState.READY,
        ), patch(
            "app.services.auth_manager.config.KITE_API_KEY",
            "key",
        ), patch(
            "app.services.auth_manager.config.KITE_API_SECRET",
            "secret",
        ):
            snapshot = manager.get_status_snapshot(db)

        self.assertEqual(snapshot["reason_code"], "READY")
        self.assertTrue(snapshot["authenticated"])
        self.assertTrue(snapshot["has_active_token"])


if __name__ == "__main__":
    unittest.main()
