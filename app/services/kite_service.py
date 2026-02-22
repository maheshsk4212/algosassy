import logging
from typing import Dict, Optional, Tuple

from kiteconnect import KiteConnect

from app.core.time_provider import time_provider
from app.models.trade_intent import TradeIntent
from app.services.execution_wrapper import execute_kite_call

logger = logging.getLogger(__name__)

class KiteService:
    def __init__(self, api_key: str):
        self._kite = KiteConnect(api_key=api_key)
        self._instrument_cache_by_token: Dict[int, Dict[str, str]] = {}
        self._instrument_cache_last_refresh_ts: float = 0.0
        self._instrument_cache_ttl_seconds: float = 6 * 60 * 60
        
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

    async def _refresh_instrument_cache(self):
        """
        Fetches the instrument master and builds a token -> (exchange, tradingsymbol) map.
        This is used by autonomous execution, where strategies emit instrument_token only.
        """
        now = time_provider.time()
        if (
            self._instrument_cache_by_token
            and (now - self._instrument_cache_last_refresh_ts) < self._instrument_cache_ttl_seconds
        ):
            return

        rows = await execute_kite_call(self._kite.instruments)
        token_map: Dict[int, Dict[str, str]] = {}
        if isinstance(rows, list):
            for row in rows:
                token = row.get("instrument_token")
                exchange = (row.get("exchange") or "").strip().upper()
                tradingsymbol = (row.get("tradingsymbol") or "").strip().upper()
                if token is None or not exchange or not tradingsymbol:
                    continue
                try:
                    token_int = int(token)
                except (TypeError, ValueError):
                    continue
                token_map[token_int] = {
                    "exchange": exchange,
                    "tradingsymbol": tradingsymbol,
                }

        self._instrument_cache_by_token = token_map
        self._instrument_cache_last_refresh_ts = now
        logger.info(f"Instrument cache refreshed. Loaded {len(token_map)} symbols.")

    async def _resolve_symbol_identity(self, instrument_token: int) -> Tuple[str, str]:
        """
        Resolves instrument_token to exchange + tradingsymbol for live order placement.
        Uses cached lookups first, then recent broker snapshots, then instrument master.
        """
        token = int(instrument_token)
        cached = self._instrument_cache_by_token.get(token)
        if cached:
            return cached["exchange"], cached["tradingsymbol"]

        # Fast path: recent orders often include this token with tradingsymbol metadata.
        try:
            orders = await self.get_orders()
        except Exception:
            orders = []
        if isinstance(orders, list):
            for order in reversed(orders):
                try:
                    order_token = int(order.get("instrument_token"))
                except (TypeError, ValueError):
                    continue
                if order_token != token:
                    continue
                exchange = (order.get("exchange") or "").strip().upper()
                tradingsymbol = (order.get("tradingsymbol") or "").strip().upper()
                if exchange and tradingsymbol:
                    self._instrument_cache_by_token[token] = {
                        "exchange": exchange,
                        "tradingsymbol": tradingsymbol,
                    }
                    return exchange, tradingsymbol

        # Next: current positions snapshot.
        try:
            positions = await self.get_positions()
        except Exception:
            positions = {}
        for bucket in ("net", "day"):
            rows = positions.get(bucket, []) if isinstance(positions, dict) else []
            for row in rows:
                try:
                    row_token = int(row.get("instrument_token"))
                except (TypeError, ValueError):
                    continue
                if row_token != token:
                    continue
                exchange = (row.get("exchange") or "").strip().upper()
                tradingsymbol = (row.get("tradingsymbol") or "").strip().upper()
                if exchange and tradingsymbol:
                    self._instrument_cache_by_token[token] = {
                        "exchange": exchange,
                        "tradingsymbol": tradingsymbol,
                    }
                    return exchange, tradingsymbol

        # Fallback: full instrument master fetch.
        await self._refresh_instrument_cache()
        cached = self._instrument_cache_by_token.get(token)
        if cached:
            return cached["exchange"], cached["tradingsymbol"]

        raise ValueError(f"Unable to resolve tradingsymbol for instrument token {token}.")

    def _safe_order_tag(self, raw_value: str) -> str:
        cleaned = "".join(ch for ch in (raw_value or "") if ch.isalnum() or ch in {"_", "-"}).upper()
        if not cleaned:
            return "ALGO"
        return cleaned[:20]

    async def place_manual_order(
        self,
        *,
        exchange: str,
        tradingsymbol: str,
        transaction_type: str,
        quantity: int,
        product: str = "MIS",
        order_type: str = "MARKET",
        price: Optional[float] = None,
        tag: str = "MANUAL_UI",
    ) -> str:
        """
        Place a user-triggered manual order from the dashboard order ticket.
        """
        exchange_u = (exchange or "").strip().upper()
        symbol_u = (tradingsymbol or "").strip().upper()
        side_u = (transaction_type or "").strip().upper()
        product_u = (product or "").strip().upper()
        order_type_u = (order_type or "").strip().upper()

        if side_u not in {"BUY", "SELL"}:
            raise ValueError("transaction_type must be BUY or SELL.")
        if order_type_u not in {"MARKET", "LIMIT"}:
            raise ValueError("order_type must be MARKET or LIMIT.")
        if quantity <= 0:
            raise ValueError("quantity must be greater than 0.")
        if order_type_u == "LIMIT" and (price is None or float(price) <= 0):
            raise ValueError("price is required and must be > 0 for LIMIT orders.")

        payload = {
            "variety": self._kite.VARIETY_REGULAR,
            "exchange": exchange_u,
            "tradingsymbol": symbol_u,
            "transaction_type": (
                self._kite.TRANSACTION_TYPE_BUY if side_u == "BUY" else self._kite.TRANSACTION_TYPE_SELL
            ),
            "quantity": int(quantity),
            "product": product_u,
            "order_type": self._kite.ORDER_TYPE_MARKET if order_type_u == "MARKET" else self._kite.ORDER_TYPE_LIMIT,
            "tag": self._safe_order_tag(tag),
        }
        if order_type_u == "LIMIT":
            payload["price"] = float(price)

        order_id = await execute_kite_call(self._kite.place_order, **payload)
        return str(order_id)

    async def place_order(self, intent: TradeIntent, sized_quantity: int) -> bool:
        """
        Live autonomous placement adapter used by ExecutionEngine.
        Converts strategy TradeIntent (instrument token) to the Kite order payload.
        """
        if sized_quantity <= 0:
            raise ValueError("sized_quantity must be greater than 0.")

        exchange, tradingsymbol = await self._resolve_symbol_identity(intent.symbol)
        transaction_type = (
            self._kite.TRANSACTION_TYPE_BUY
            if intent.direction.value == "BUY"
            else self._kite.TRANSACTION_TYPE_SELL
        )

        order_id = await execute_kite_call(
            self._kite.place_order,
            variety=self._kite.VARIETY_REGULAR,
            exchange=exchange,
            tradingsymbol=tradingsymbol,
            transaction_type=transaction_type,
            quantity=int(sized_quantity),
            product=self._kite.PRODUCT_MIS,
            order_type=self._kite.ORDER_TYPE_MARKET,
            tag=self._safe_order_tag(intent.strategy_name),
        )

        logger.info(
            f"Live broker order placed. ID={order_id} token={intent.symbol} {transaction_type} qty={sized_quantity}"
        )
        return bool(order_id)

    async def get_positions(self):
        return await execute_kite_call(self._kite.positions)

    async def get_orders(self):
        return await execute_kite_call(self._kite.orders)

    async def get_margins(self) -> dict:
        """Returns live margin/balance data from the broker."""
        return await execute_kite_call(self._kite.margins)

    async def get_holdings(self) -> list:
        """Returns the long-term equity holdings for the account."""
        return await execute_kite_call(self._kite.holdings)

    async def cancel_order(self, variety: str, order_id: str):
        """Cancels a specific pending order."""
        return await execute_kite_call(self._kite.cancel_order, variety=variety, order_id=order_id)

    async def exit_all_positions(self):
        """
        Emergency exit: closes all net positions (both long and short).
        Used by Emergency Guard / Kill Switch.
        """
        positions = await self.get_positions()
        net = positions.get('net', [])
        results = []
        for pos in net:
            qty = pos.get('quantity', 0)
            if qty == 0:
                continue

            transaction_type = self._kite.TRANSACTION_TYPE_SELL if qty > 0 else self._kite.TRANSACTION_TYPE_BUY
            
            result = await execute_kite_call(
                self._kite.place_order,
                variety=self._kite.VARIETY_REGULAR,
                exchange=pos.get('exchange', 'NSE'),
                tradingsymbol=pos['tradingsymbol'],
                transaction_type=transaction_type,
                quantity=abs(qty),
                product=pos.get('product', self._kite.PRODUCT_MIS),
                order_type=self._kite.ORDER_TYPE_MARKET
            )
            results.append(result)
        return results

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
