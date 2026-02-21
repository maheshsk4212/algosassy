import logging
import time
import asyncio
import httpx
from typing import Dict, List
from collections import deque

from app.core.event_bus import event_bus, EventType

logger = logging.getLogger(__name__)

class AlertManager:
    """
    Asynchronous Circuit-Breaked Alert Dispatcher.
    Prevents alert floods while ensuring critical events are transmitted.
    """
    def __init__(self, debounce_seconds: int = 30, cascade_threshold: int = 10, cascade_window: int = 5):
        self.debounce_seconds = debounce_seconds
        self.cascade_threshold = cascade_threshold
        self.cascade_window = cascade_window
        
        # State tracking
        self._last_alert_times: Dict[str, float] = {}
        self._recent_alert_timestamps: deque = deque()
        self._muted_until: float = 0.0

        # Subscriptions
        event_bus.subscribe(EventType.EMERGENCY_LIQUIDATE, self._handle_critical_event)
        event_bus.subscribe(EventType.ORDER_FAILED, self._handle_critical_event)

    def _handle_critical_event(self, data: dict):
        # We fire and forget asyncio task from sync event bus
        # Note: In a true prod app, we'd use a background queue worker for these out-bound HTTP calls
        # to ensure the EventBus thread itself doesn't stall on asyncio.run overhead.
        event_type = data.get('type', 'UNKNOWN_CRITICAL_EVENT')
        reason = data.get('reason', 'No reason provided')
        symbol = data.get('symbol', 'ALL')
        
        fingerprint = f"{event_type}_{symbol}_{reason}"
        
        asyncio.create_task(self._process_and_dispatch(fingerprint, data))

    async def _process_and_dispatch(self, fingerprint: str, data: dict):
        now = time.time()
        
        # 1. Cascade Protection (Flood Control)
        if now < self._muted_until:
            logger.info(f"Alert '{fingerprint}' suppressed by Cascading Silence.")
            return

        self._recent_alert_timestamps.append(now)
        # trim deque
        while self._recent_alert_timestamps and self._recent_alert_timestamps[0] < now - self.cascade_window:
            self._recent_alert_timestamps.popleft()
            
        if len(self._recent_alert_timestamps) >= self.cascade_threshold:
            logger.critical("💥 CASCADING FAILURE DETECTED. Muting external alerts for 60 seconds.")
            self._muted_until = now + 60.0
            await self._dispatch_webhook("🚨 CASCADING FAILURE - MUTING ALERTS for 60s")
            self._recent_alert_timestamps.clear()
            return
            
        # 2. Debouncing (Duplicate Suppression)
        last_time = self._last_alert_times.get(fingerprint, 0.0)
        if now - last_time < self.debounce_seconds:
            logger.debug(f"Alert '{fingerprint}' debounced.")
            return
            
        self._last_alert_times[fingerprint] = now
        
        # 3. Dispatch
        message = f"🚨 ALERT: {fingerprint} | Data: {data}"
        logger.warning(f"Dispatching Alert: {message}")
        await self._dispatch_webhook(message)

    async def _dispatch_webhook(self, message: str):
        """Mock destination. In prod, hits Telegram API or Slack Webhooks."""
        try:
            # Example:
            # async with httpx.AsyncClient() as client:
            #    await client.post("https://my-webhook.url", json={"text": message})
            pass
        except Exception as e:
            logger.error(f"Failed to dispatch webhook alert: {e}")

alert_manager = AlertManager()
