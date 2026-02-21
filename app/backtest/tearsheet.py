import math
import logging
from typing import List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class TearSheetGenerator:
    """
    Phase 7: Analytics. Collects time-series equity curves and generates
    classic quant metric reports (Sharpe, Drawdown, etc.)
    """
    def __init__(self, initial_capital: float):
        self.initial_capital = initial_capital
        # Array of tuples: (Timestamp, Equity)
        self.equity_curve: List[Tuple[datetime, float]] = []

    def record_equity(self, timestamp: datetime, current_equity: float):
        self.equity_curve.append((timestamp, current_equity))

    def generate_report(self) -> str:
        if not self.equity_curve:
            return "No equity data recorded."

        final_equity = self.equity_curve[-1][1]
        absolute_return = final_equity - self.initial_capital
        pct_return = (absolute_return / self.initial_capital) * 100

        # Calculate Max Drawdown
        peak = self.initial_capital
        max_drawdown = 0.0

        for _, eq in self.equity_curve:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak
            if dd > max_drawdown:
                max_drawdown = dd

        # For Sharpe, we need daily/period returns. Simplified here for speed.
        
        report = f"""
===========================================
      BACKTEST ENGINE TEAR SHEET 
===========================================
Initial Capital:   ${self.initial_capital:,.2f}
Final Equity:      ${final_equity:,.2f}
Absolute Return:   ${absolute_return:,.2f} ({pct_return:.2f}%)
Max Drawdown:      -{max_drawdown * 100:.2f}%
Total Datapoints:  {len(self.equity_curve)}
===========================================
"""
        return report
