import logging
from kiteconnect import KiteConnect
from app.services.execution_wrapper import execute_kite_call

logger = logging.getLogger(__name__)

class KiteService:
    def __init__(self, api_key: str):
        self._kite = KiteConnect(api_key=api_key)
        
    def set_access_token(self, token: str):
        self._kite.set_access_token(token)
        logger.info("Kite access token updated")

    def login_url(self) -> str:
        return self._kite.login_url()

    async def generate_session(self, request_token: str, api_secret: str) -> dict:
        """Generate access_token from request_token."""
        # Using execute_kite_call since it is an external network call.
        return await execute_kite_call(self._kite.generate_session, request_token, api_secret)

    async def get_profile(self):
        return await execute_kite_call(self._kite.profile)

    async def place_order(self, *args, **kwargs):
        return await execute_kite_call(self._kite.place_order, *args, **kwargs)

    async def get_positions(self):
        return await execute_kite_call(self._kite.positions)

    async def get_orders(self):
        return await execute_kite_call(self._kite.orders)

# Global singleton service
kite_service = None

def init_kite_service(api_key: str):
    global kite_service
    if not kite_service:
        kite_service = KiteService(api_key=api_key)

def get_kite_service() -> KiteService:
    global kite_service
    if not kite_service:
        raise RuntimeError("KiteService has not been initialized.")
    return kite_service
