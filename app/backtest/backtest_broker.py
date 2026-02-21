import logging
from typing import Dict, Any

from app.core.event_bus import event_bus, EventType
from app.services.mtm_engine import mtm_engine
from app.models.trade_intent import TradeIntent

logger = logging.getLogger(__name__)

class BacktestBroker:
    """
    Phase 7: Simulated Exchange.
    Responsible for simulating fills, observing current market prices, applying slippage, 
    and firing success/failure events back to the bus identically to the KiteService wrapper.
    """
    def __init__(self, slippage_pct: float = 0.0005, flat_commission: float = 0.10):
        self.slippage_pct = slippage_pct
        self.flat_commission = flat_commission
        
        # Central tracker of what the "current" price is in the simulation loop
        self._current_prices: Dict[int, float] = {}
        
    def update_market_price(self, symbol: int, price: float):
        """Called by the BacktestRunner on every tick/candle to ground reality."""
        self._current_prices[symbol] = price

    async def place_order(self, intent: TradeIntent, sized_quantity: int) -> bool:
        """
        Simulate a broker execution. 
        In Phase 7, we assume 100% fill rate (limit orders matching mid-price instantly) 
        but we apply penalty slippage to model liquidity gaps.
        """
        symbol = intent.symbol
        side = intent.action.upper()
        
        # Ground truth price simulation
        if symbol not in self._current_prices:
            logger.error(f"BacktestBroker cannot fill order for {symbol}. No market price tracked.")
            return False
            
        current_market_price = self._current_prices[symbol]
        
        # Calculate simulated slippage
        # Buy higher, Sell lower
        slippage_delta = current_market_price * self.slippage_pct
        if side == "BUY":
            simulated_fill_price = current_market_price + slippage_delta
        else:
            simulated_fill_price = current_market_price - slippage_delta
            
        logger.info(f"SIMULATED BROKER FILL: {side} {sized_quantity} {symbol} @ {simulated_fill_price:.2f} (Slippage applied)")
        
        # We mutate the intent entry price to reflect the "real" fill so the rest of the 
        # system (MtM Engine, PnL) calculates based on the penalized execution.
        intent.entry_price = simulated_fill_price
        
        # Simulate Network Delay?
        # In a purely deterministic loop you don't await asyncio.sleep, 
        # you just return success to move the loop forward immediately.
        
        return True
    
backtest_broker = BacktestBroker()
