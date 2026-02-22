import logging
import threading
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from kiteconnect.exceptions import TokenException, KiteException

from app.models.auth_token_model import AuthToken
from app.services.kite_service import get_kite_service
from app.state_manager import state_manager, SystemState
from app.config import config

logger = logging.getLogger(__name__)

class AuthManager:
    def __init__(self):
        self._diag_lock = threading.Lock()
        self._last_reason_code = "STARTUP"
        self._last_reason = "Authentication status not evaluated yet."
        self._last_updated_utc = None

    def _set_auth_diagnostic(self, reason_code: str, reason: str):
        clean_reason = (reason or "").strip()
        if len(clean_reason) > 280:
            clean_reason = f"{clean_reason[:277]}..."
        with self._diag_lock:
            self._last_reason_code = reason_code
            self._last_reason = clean_reason
            self._last_updated_utc = datetime.now(timezone.utc).isoformat()

    def get_status_snapshot(self, db: Session):
        active_token = db.query(AuthToken).filter(AuthToken.is_active == True).first()
        current_state = state_manager.get_state()

        with self._diag_lock:
            reason_code = self._last_reason_code
            reason = self._last_reason
            last_updated_utc = self._last_updated_utc

        if not config.KITE_API_KEY or not config.KITE_API_SECRET:
            reason_code = "MISSING_KITE_CONFIG"
            reason = "Kite API key/secret is not configured on the server."
        elif current_state == SystemState.READY:
            reason_code = "READY"
            reason = "Kite account authenticated and trading is enabled."
        elif not active_token:
            reason_code = "NO_ACTIVE_TOKEN"
            reason = "No active Kite session token found. Please login again."
        elif reason_code in {"READY", "STARTUP"}:
            reason_code = "AUTH_REQUIRED"
            reason = "Authentication is required to enable trading."

        return {
            "system_state": current_state.name,
            "authenticated": current_state == SystemState.READY,
            "has_active_token": bool(active_token),
            "reason_code": reason_code,
            "reason": reason,
            "last_updated_utc": last_updated_utc,
            "login_path": "/api/v1/auth/login",
        }

    async def process_callback(self, request_token: str, db: Session):
        """Processes the Kite login callback, exchanges token, and updates state."""
        kite = get_kite_service()
        try:
            logger.info("Generating session from request token...")
            session_data = await kite.generate_session(request_token, config.KITE_API_SECRET)
            access_token = session_data.get("access_token")
            
            if not access_token:
                logger.error("Failed to retrieve access token from Kite session data.")
                state_manager.set_state(SystemState.AUTH_REQUIRED)
                self._set_auth_diagnostic(
                    "CALLBACK_NO_ACCESS_TOKEN",
                    "Kite callback did not return an access token.",
                )
                return False

            self._store_new_token(access_token, db)
            kite.set_access_token(access_token)
            
            # Validate immediately
            profile = await kite.get_profile()
            logger.info(f"Successfully authenticated as {profile.get('user_name', 'Unknown')}")
            
            state_manager.set_state(SystemState.READY)
            self._set_auth_diagnostic(
                "READY",
                f"Authenticated as {profile.get('user_name', 'Unknown')}.",
            )
            return True

        except TokenException as e:
            logger.error(f"Token error during callback processing: {e}")
            state_manager.set_state(SystemState.AUTH_REQUIRED)
            self._set_auth_diagnostic("TOKEN_EXCEPTION", str(e))
            raise
        except KiteException as e:
            logger.error(f"Kite error during callback processing: {e}")
            state_manager.set_state(SystemState.AUTH_REQUIRED)
            self._set_auth_diagnostic("KITE_EXCEPTION", str(e))
            raise
        except Exception as e:
            logger.error(f"Error during callback processing: {e}")
            state_manager.set_state(SystemState.AUTH_REQUIRED)
            self._set_auth_diagnostic("CALLBACK_ERROR", str(e))
            raise

    def _store_new_token(self, access_token: str, db: Session):
        """Deactivates old tokens and stores the new active token."""
        active_tokens = db.query(AuthToken).filter(AuthToken.is_active == True).all()
        for t in active_tokens:
            t.is_active = False
            
        new_token = AuthToken(
            access_token=access_token,
            is_active=True
        )
        db.add(new_token)
        db.commit()
        logger.info("New access token stored in database.")

    async def validate_current_token(self, db: Session):
        """Checks if current active token is valid, updates system state."""
        active_token = db.query(AuthToken).filter(AuthToken.is_active == True).first()
        
        if not active_token:
            logger.warning("No active token found in database.")
            state_manager.set_state(SystemState.AUTH_REQUIRED)
            self._set_auth_diagnostic("NO_ACTIVE_TOKEN", "No active token found in database.")
            return False

        kite = get_kite_service()
        kite.set_access_token(active_token.access_token)
        
        try:
            logger.debug("Validating token with Kite API...")
            await kite.get_profile()
            state_manager.set_state(SystemState.READY)
            self._set_auth_diagnostic("READY", "Token validated successfully.")
            return True
        except TokenException:
            logger.warning("Token expired or invalid.")
            active_token.is_active = False
            db.commit()
            state_manager.set_state(SystemState.AUTH_REQUIRED)
            self._set_auth_diagnostic("TOKEN_INVALID", "Token expired or invalid.")
            return False
        except Exception as e:
            logger.error(f"Error during token validation: {e}")
            self._set_auth_diagnostic("TOKEN_VALIDATION_ERROR", str(e))
            return False

auth_manager = AuthManager()
