import logging
from typing import Optional

from app.models.trade_intent import TradeIntent
from app.models.risk_decision import RiskDecision
from app.state_manager import state_manager, SystemState
from app.services.capital_registry import capital_registry
from app.services.mtm_engine import mtm_engine
from app.services.symbol_lock import symbol_lock_manager, SymbolState
from app.services.regime_service import regime_service
from app.services.governance_guard import governance_guard

logger = logging.getLogger(__name__)

class RiskEngine:
    """
    Sub-millisecond Pipeline deciding if a pure Strategy Intent 
    should become a live Execution.
    """
    
    def __init__(self, max_drawdown_percent: float = 5.0):
        self.max_drawdown_percent = max_drawdown_percent

    def evaluate_intent(self, intent: TradeIntent) -> RiskDecision:
        """
        Ordered evaluation pipeline. Fails fast without DB calls.
        """
        # 1. System readiness check (Kill Switch verification)
        if state_manager.get_state() != SystemState.READY:
            return self._reject(intent, "System state is not READY (Kill Switch may be active).")
            
        # 2. Phase 5: Per-Symbol Lock Verification
        if symbol_lock_manager.get_state(intent.symbol) != SymbolState.NORMAL:
            return self._reject(intent, f"Symbol {intent.symbol} is currently locked or in execution.")

        # 3. Emotion Guard (Phase 8) - Did we detect illegal manual trades?
        emotion_block = governance_guard.enforce_emotion_guard(intent)
        if emotion_block:
            return self._reject(intent, emotion_block)

        # 4. Drawdown Check & Personal Risk Cap (O(1) Lockless Read)
        current_equity = capital_registry.total_capital + mtm_engine.get_realtime_pnl()
        
        personal_cap_block = governance_guard.enforce_personal_risk_cap(current_equity)
        if personal_cap_block:
            return self._reject(intent, personal_cap_block)
            
        drawdown_percent = ((capital_registry.total_capital - current_equity) / capital_registry.total_capital) * 100
        if drawdown_percent >= self.max_drawdown_percent:
            return self._reject(intent, f"Max drawdown exceeded. Current: {drawdown_percent:.2f}%")
            
        # 5. Volatility Adaptive Position Sizing (Phase 8 Core)
        # Size = (Capital * Base_Risk) / (ATR * VolatilityMultiplier)
        atr_value = regime_service.get_atr(intent.symbol)
        vol_multiplier = regime_service.get_volatility_multiplier(intent.symbol)
        base_risk_amount = current_equity * regime_service.get_base_risk_percent()
        
        # Raw unit size 
        if atr_value <= 0:
            return self._reject(intent, "Invalid ATR retrieved from RegimeService.")
        raw_position_size = int(base_risk_amount / (atr_value * vol_multiplier))
        
        if raw_position_size <= 0:
            return self._reject(intent, "Calculated position size is 0 due to High Volatility or Small Equity.")

        # 6. Governance Portfolio Balancer (Maximum exposure cap per strategy)
        assigned_size = governance_guard.get_max_allowed_position_size(intent, raw_position_size, current_equity)
        if assigned_size <= 0:
            return self._reject(intent, "Portfolio balancer reduced position size to 0 to prevent concentration risk.")

        # 7. Capital Availability Pre-Check (Lockless read)
        required_capital = intent.entry_price * assigned_size
        if capital_registry.get_available_capital() < required_capital:
            return self._reject(intent, f"Insufficient Capital. Needed {required_capital}")

        # 8. Lock execution flow for THIS symbol before acquiring capital
        if not symbol_lock_manager.acquire_execution_lock(intent.symbol):
             return self._reject(intent, "Failed to acquire Phase 5 Symbol Lock.")

        # 9. Atomic Capital Reservation (Phase 2 of Capital Lock Strategy)
        success, res_id = capital_registry.reserve(intent, assigned_size)
        
        if not success:
            symbol_lock_manager.release_execution_lock(intent.symbol)
            return self._reject(intent, "Atomic Capital Reservation Failed.")
            
        # Approval
        decision = RiskDecision(
            approved=True, 
            original_intent=intent, 
            reservation_id=res_id,
            assigned_position_size=assigned_size
        )
        logger.info(f"Risk Engine APPROVED trade from {intent.strategy_name}. Reservation: {res_id}")
        return decision

    def _reject(self, intent: TradeIntent, reason: str) -> RiskDecision:
        """Helper to uniformally format rejections."""
        logger.warning(f"Risk Engine REJECTED {intent.strategy_name}. Reason: {reason}")
        return RiskDecision(approved=False, rejection_reason=reason, original_intent=intent)

risk_engine = RiskEngine()
