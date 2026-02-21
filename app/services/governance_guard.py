import logging
from typing import Dict, Optional
from app.core.time_provider import time_provider

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
        self._peak_equity: float = 0.0 # Will be synced from CapitalRegistry on startup
        
        # Drawdown Penalty Tiers
        self.drawdown_tiers = [
            (0.05, 0.8), # 5% drawdown -> 20% size cut
            (0.10, 0.5), # 10% drawdown -> 50% size cut
            (0.12, 0.2)  # 12% drawdown -> 80% size cut
        ]
        
        # For Sandbox / Emotion Guard
        self._symbol_lockouts: Dict[int, float] = {}
        
    def update_settings(self, drawdown_limit: float = None, concentration: float = None):
        if drawdown_limit is not None:
            self.monthly_drawdown_limit = drawdown_limit
        if concentration is not None:
            self.max_strategy_concentration = concentration
        logger.info(f"🛡️ GOVERNANCE: Settings updated. Drawdown Limit: {self.monthly_drawdown_limit*100}%, Concentration: {self.max_strategy_concentration*100}%")

    @property
    def peak_equity(self) -> float:
        # Fallback to total capital if peak hasn't been set yet
        if self._peak_equity <= 0:
            return capital_registry.total_capital
        return self._peak_equity

    @peak_equity.setter
    def peak_equity(self, value: float):
        self._peak_equity = value

    def get_drawdown_penalty_multiplier(self, current_equity: float) -> float:
        """
        Asymmetric Compounding. Returns a scalar <= 1.0 to forcibly shrink
        baseline risk percent as the portfolio shrinks from its High Water Mark.
        """
        if current_equity >= self.peak_equity:
            self.peak_equity = current_equity
            return 1.0
            
        drawdown = (self.peak_equity - current_equity) / self.peak_equity
        
        # Iterate backwards to find highest applicable penalty
        for threshold, multiplier in reversed(self.drawdown_tiers):
            if drawdown >= threshold:
                logger.info(f"🛡️ GOVERNANCE: Drawdown at {drawdown*100:.1f}%. Applying {multiplier}x sizing penalty.")
                return multiplier
                
        return 1.0

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
        current = time_provider.time()
        if current < lockout_expiry:
            time_left = (lockout_expiry - current) / 3600
            return f"Emotion Guard Active. Symbol {intent.symbol} locked for {time_left:.1f} more hours."
        return None

    def trigger_symbol_cooldown(self, symbol: int, hours: float = 24.0):
        """Called by Broker Recon if unexpected manual position is found."""
        logger.warning(f"🛡️ EMOTION GUARD: Locking algorithmic trading on {symbol} for {hours} hours due to detected manual intervention.")
        self._symbol_lockouts[symbol] = time_provider.time() + (hours * 3600)

    def enforce_personal_risk_cap(self, current_equity: float) -> Optional[str]:
        """Absolute financial survival rule."""
        if current_equity > self.peak_equity:
            self.peak_equity = current_equity
            
        drawdown = (self.peak_equity - current_equity) / self.peak_equity
        if drawdown >= self.monthly_drawdown_limit:
            return f"Monthly Loss Cap Reached ({drawdown*100:.1f}%). System entering mandatory cool-off."
            
        return None

governance_guard = GovernanceGuard()
