import logging
import psutil
from app.services.alert_manager import alert_manager
from app.services.capital_registry import capital_registry
from app.services.mtm_engine import mtm_engine
from app.state_manager import state_manager

logger = logging.getLogger(__name__)

class AuditReporter:
    """
    Phase 8: Submits Weekly subjective Governance checks.
    Forces infrastructure discipline and enforces objective reviews.
    """
    def __init__(self):
        self.disk_threshold_percent = 90.0
        self.mem_threshold_percent = 85.0

    async def run_weekly_audit(self):
        logger.info("Running Weekly Governance Audit...")
        
        # 1. Infra Discipline Read
        disk_usage = psutil.disk_usage('/').percent
        memory_usage = psutil.virtual_memory().percent
        
        infra_warnings = []
        if disk_usage > self.disk_threshold_percent:
            infra_warnings.append(f"CRITICAL: Disk usage at {disk_usage}%")
        if memory_usage > self.mem_threshold_percent:
            infra_warnings.append(f"WARNING: Memory usage at {memory_usage}%")
            
        # 2. Capital Status
        available = capital_registry.get_available_capital()
        used = capital_registry.used_capital
        unrealized = mtm_engine.get_realtime_pnl()
        
        report = f"""
        📊 **ALGO-SASSY WEEKLY GOVERNANCE REPORT**
        
        **💰 Capital Metrics:**
        - Available Equity: {available}
        - Deployed Margin: {used}
        - Synthetic PnL: {unrealized}
        
        **🔒 System Status:**
        - Current State: {state_manager.get_state().name}
        
        **🖥️ Infrastructure:**
        - Disk: {disk_usage}%
        - RAM: {memory_usage}%
        """
        
        for w in infra_warnings:
            report += f"\n🚨 {w}"
            
        # Push through Webhook/Telegram
        await alert_manager._dispatch_webhook(report)
        logger.info("Weekly Audit Dispatched.")

audit_reporter = AuditReporter()
