import logging
from sqlalchemy.orm import Session
from kiteconnect.exceptions import TokenException, KiteException

from app.models.auth_token_model import AuthToken
from app.services.kite_service import get_kite_service
from app.state_manager import state_manager, SystemState
from app.config import config

logger = logging.getLogger(__name__)

class AuthManager:
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
                return False

            self._store_new_token(access_token, db)
            kite.set_access_token(access_token)
            
            # Validate immediately
            profile = await kite.get_profile()
            logger.info(f"Successfully authenticated as {profile.get('user_name', 'Unknown')}")
            
            state_manager.set_state(SystemState.READY)
            return True

        except Exception as e:
            logger.error(f"Error during callback processing: {e}")
            state_manager.set_state(SystemState.AUTH_REQUIRED)
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
            return False

        kite = get_kite_service()
        kite.set_access_token(active_token.access_token)
        
        try:
            logger.debug("Validating token with Kite API...")
            await kite.get_profile()
            state_manager.set_state(SystemState.READY)
            return True
        except TokenException:
            logger.warning("Token expired or invalid.")
            active_token.is_active = False
            db.commit()
            state_manager.set_state(SystemState.AUTH_REQUIRED)
            return False
        except Exception as e:
            logger.error(f"Error during token validation: {e}")
            return False

auth_manager = AuthManager()
