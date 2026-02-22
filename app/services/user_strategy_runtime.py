import re
from typing import Optional, Tuple

from app.services.strategy_registry import strategy_registry
from app.strategies.ema_crossover_strategy import EMACrossoverStrategy

# Common NSE index tokens for Zerodha.
INSTRUMENT_TOKEN_MAP = {
    "NIFTY 50": 256265,
    "NIFTY": 256265,
    "BANKNIFTY": 260105,
    "NIFTY BANK": 260105,
    "FINNIFTY": 257801,
}


def instrument_to_token(instrument: str) -> int:
    normalized = (instrument or "").strip().upper()
    for key, token in INSTRUMENT_TOKEN_MAP.items():
        if normalized == key.upper():
            return token
    return 256265


def runtime_name_for(strategy_id: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_]+", "_", (strategy_id or "strategy")).strip("_").lower()
    safe = safe[:80] if safe else "strategy"
    return f"user_{safe}"


class NamedEMACrossoverStrategy(EMACrossoverStrategy):
    def __init__(self, strategy_name: str, short_period: int = 9, long_period: int = 21, risk_percent: float = 1.0):
        super().__init__(short_period=short_period, long_period=long_period, risk_percent=risk_percent)
        self._strategy_name_override = strategy_name

    @property
    def strategy_name(self) -> str:
        return self._strategy_name_override


def deploy_user_strategy(strategy_id: str, instrument: str, risk_percent: Optional[float] = None) -> Tuple[int, str]:
    symbol = instrument_to_token(instrument)
    runtime_name = runtime_name_for(strategy_id)

    # Idempotent deploy: replace if already registered under same name/symbol.
    strategy_registry.unregister_strategy(symbol=symbol, strategy_name=runtime_name)

    rp = 1.0
    if risk_percent is not None:
        try:
            rp = max(0.1, min(float(risk_percent), 10.0))
        except (TypeError, ValueError):
            rp = 1.0

    strategy_registry.register_strategy(
        symbol=symbol,
        strategy=NamedEMACrossoverStrategy(
            strategy_name=runtime_name,
            short_period=9,
            long_period=21,
            risk_percent=rp,
        ),
    )
    return symbol, runtime_name


def undeploy_user_strategy(symbol: int, runtime_strategy_name: str) -> None:
    strategy_registry.unregister_strategy(symbol=symbol, strategy_name=runtime_strategy_name)
