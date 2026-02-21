import logging
import time
from typing import Dict, Optional

from app.models.trade_intent import TradeIntent
from app.services.capital_registry import capital_registry
from app.services.mtm_engine import mtm_engine

logger = logging.getLogger(__name__)

class GovernanceGuard:
    """
    Phase 8: Central authority for Capital Scaling, Portfolio Balancing,
    Emotion Guarding (revenge trading prevention), and absolute risk caps.
    Sub-modules could be split, but for performance, we keep them synchronous in Evaluate().
    """
    def __init__(self):
        # 40% of peak equity Max
        self.max_strategy_concentration = 0.40  
        
        # Monthly Loss Abs Cap
        self.monthly_drawdown_limit = 0.15 # Max 15% loss per month
        self.peak_equity = 100000.0 # Will be synced from DB in Phase 9
        
        # For Sandbox / Emotion Guard
        self._symbol_lockouts: Dict[int, float] = {}

    def get_max_allowed_position_size(self, intent: TradeIntent, requested_size: int, current_equity: float) -> int:
        """
        Enforce Portfolio Balancer & Scaling limits.
        No single strategy can hoard >40% of active equity.
        """
        # Roughly calculate exposure of this intent
        # In a real engine, we'd use the precise margin required, but for this step we estimate 
        # based on entry price * size
        projected_exposure = requested_size * intent.entry_price
        
        max_exposure = current_equity * self.max_strategy_concentration
        
        # Count current exposure for this strategy via MTM Engine
        # (Mocking strat exposure for Phase 8 since MTM Engine tracks per symbol, not strategy yet)
        current_strategy_exposure = 0.0 # TODO Phase 9
        
        available_headroom = max_exposure - current_strategy_exposure
        
        if projected_exposure > available_headroom:
            capped_size = int(available_headroom / intent.entry_price)
            logger.warning(f"🛡️ GOVERNANCE: Strategy {intent.strategy_name} capped at {self.max_strategy_concentration*100}% of portfolio. Reducing size to {capped_size}")
            return capped_size
            
        return requested_size

    def enforce_emotion_guard(self, intent: TradeIntent) -> Optional[str]:
        """
        If a manual trade was detected on this symbol recently, block the algo 
        for 24 hours to prevent revenge trading conflicts.
        """
        lockout_expiry = self._symbol_lockouts.get(intent.symbol, 0.0)
        if time.time() < lockout_expiry:
            time_left = (lockout_expiry - time.time()) / 3600
            return f"Emotion Guard Active. Symbol {intent.symbol} locked for {time_left:.1f} more hours."
        return None

    def trigger_symbol_cooldown(self, symbol: int, hours: float = 24.0):
        """Called by Broker Recon if unexpected manual position is found."""
        logger.warning(f"🛡️ EMOTION GUARD: Locking algorithmic trading on {symbol} for {hours} hours due to detected manual intervention.")
        self._symbol_lockouts[symbol] = time.time() + (hours * 3600)

    def enforce_personal_risk_cap(self, current_equity: float) -> Optional[str]:
        """Absolute financial survival rule."""
        if current_equity > self.peak_equity:
            self.peak_equity = current_equity
            
        drawdown = (self.peak_equity - current_equity) / self.peak_equity
        if drawdown >= self.monthly_drawdown_limit:
            return f"Monthly Loss Cap Reached ({drawdown*100:.1f}%). System entering mandatory cool-off."
            
        return None

governance_guard = GovernanceGuard()
