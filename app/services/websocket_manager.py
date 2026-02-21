import logging
import threading
from typing import List
from kiteconnect import KiteTicker

from app.models.tick_model import TickModel
from app.services.tick_queue_manager import tick_queue_manager
from app.services.mtm_engine import mtm_engine
from app.state_manager import state_manager, SystemState
from app.core.event_bus import event_bus, EventType
from app.models.auth_token_model import AuthToken

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.kws: KiteTicker = None
        self.is_connected = False
        self.subscribed_tokens: List[int] = []
        self._reconnect_delay = 2
        self.last_tick_timestamp: float = time.time()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._monitor_running: bool = False
        self.is_degraded: bool = False
        
        # Start Phase 5 Monitor
        if not self._monitor_running:
            self._monitor_running = True
            self._heartbeat_thread = threading.Thread(target=self._monitor_heartbeat, daemon=True, name="WsHeartbeat")
            self._heartbeat_thread.start()

    def _monitor_heartbeat(self):
        """Phase 5: Asserts stream vitality. Triggers reconciliation immediately upon silent drop."""
        logger.info("WebSocket Heartbeat Monitor started.")
        while self._monitor_running:
            time.sleep(1)
            # Active only if READY and CONNECTED flags say we should be getting data
            if self.is_connected and state_manager.get_state() == SystemState.READY:
                idle_seconds = time.time() - self.last_tick_timestamp
                
                # Dark Period Threshold (3 seconds)
                if idle_seconds > 3.0:
                    if not self.is_degraded:
                        logger.warning(f"WebSocket DARK PERIOD DETECTED. No ticks in {idle_seconds:.1f}s")
                        self.is_degraded = True
                        event_bus.publish(EventType.TICK_UPDATE, {"status": "DEGRADED"})
                else:
                    if self.is_degraded:
                        logger.info("WebSocket Feed recovered.")
                        self.is_degraded = False

    def start_stream(self):
        """Initializes the connection if the system state is READY."""
        if state_manager.get_state() != SystemState.READY:
            logger.warning("Attempted to start WebSocket but system state is not READY.")
            return

        db = SessionLocal()
        try:
            active_token = db.query(AuthToken).filter(AuthToken.is_active == True).first()
            if not active_token:
                logger.error("No active token found to start WebSocket.")
                return
            access_token = active_token.access_token
        finally:
            db.close()

        logger.info("Initializing Kite Ticker WebSocket...")
        self.kws = KiteTicker(config.KITE_API_KEY, access_token)

        # Register callbacks
        self.kws.on_ticks = self._on_ticks
        self.kws.on_connect = self._on_connect
        self.kws.on_close = self._on_close
        self.kws.on_error = self._on_error
        self.kws.on_reconnect = self._on_reconnect
        self.kws.on_noreconnect = self._on_noreconnect

        # Start listening in a background thread 
        # (KiteTicker.connect() blocks the current thread)
        def connect_thread():
            try:
                self.kws.connect(threaded=False) # We wrap it in our own thread
            except Exception as e:
                logger.error(f"WebSocket Connect Error: {e}")

        logger.info("Starting WebSocket Producer thread...")
        threading.Thread(target=connect_thread, daemon=True, name="KiteTickerProducer").start()

    def stop_stream(self):
        if self.kws and self.is_connected:
            logger.info("Closing WebSocket stream...")
            self.kws.close()
            self.is_connected = False
            self._reconnect_delay = 2
        
        # Phase 5 Dark Period Tracker
        self.last_tick_timestamp = time.time()
        self._monitor_running = False
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_thread.join(timeout=1) # Give it a moment to stop
        self._heartbeat_thread = None
        self.is_degraded = False

    def subscribe(self, tokens: List[int], mode=None):
        """Thread-safe mechanism to subscribe to kite ticker tokens."""
        if not self.kws or not self.is_connected:
            logger.warning("WebSocket not connected. Preparing subscriptions.")
            # Merge lists without duplicates
            self.subscribed_tokens = list(set(self.subscribed_tokens + tokens))
            return
            
        mode = mode or self.kws.MODE_FULL
        self.kws.subscribe(tokens)
        self.kws.set_mode(mode, tokens)
        self.subscribed_tokens = list(set(self.subscribed_tokens + tokens))
        logger.info(f"Subscribed to {len(tokens)} tokens.")

    # --- Callbacks --- 
    # Must contain minimalist logic to avoid blocking the twisted loop

    def _on_ticks(self, ws, ticks):
        """
        PRODUCER FUNCTION: Enqueue ticks immediately. Zero processing logic here.
        """
        self.last_tick_timestamp = time.time()
        # Guard clause
        if state_manager.get_state() != SystemState.READY:
            logger.warning("Received ticks while NOT ready. Dropping.")
            return
            
        tick_queue_manager.enqueue_ticks(ticks)

    def _on_connect(self, ws, response):
        logger.info("WebSocket Connected successfully.")
        self.is_connected = True
        
        # Restore previous subscriptions upon reconnect
        if self.subscribed_tokens:
            self.subscribe(self.subscribed_tokens)

    def _on_close(self, ws, code, reason):
        logger.warning(f"WebSocket closed. Code: {code}, Reason: {reason}")
        self.is_connected = False

    def _on_error(self, ws, code, reason):
        logger.error(f"WebSocket Error. Code: {code}, Reason: {reason}")

    def _on_reconnect(self, ws, attempts_count):
        logger.info(f"WebSocket Reconnection attempt {attempts_count}...")

    def _on_noreconnect(self, ws):
        logger.error("WebSocket max auto-reconnects exceeded.")
        # Fire state change so the system knows data stopped flowing
        # Currently we just log, strategy engine handles stale data.

websocket_manager = WebSocketManager()
