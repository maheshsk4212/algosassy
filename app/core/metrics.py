from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi import APIRouter
from fastapi.responses import Response

# The Router exposing /metrics to Prometheus scrapers
router = APIRouter()

@router.get("/metrics")
def get_metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# --- 1. Latency Histograms ---
# High resolution buckets for sub-millisecond tracking
BUCKETS = (0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, float("inf"))

STRATEGY_EVAL_LATENCY_MS = Histogram(
    "algo_strategy_eval_latency_ms",
    "Time taken for pure strategy evaluation",
    ["strategy_name"],
    buckets=BUCKETS
)

RISK_EVAL_LATENCY_MS = Histogram(
    "algo_risk_eval_latency_ms",
    "Time taken for full risk engine pipeline (MTM read + Mutex reserve)",
    buckets=BUCKETS
)

EXECUTION_LATENCY_MS = Histogram(
    "algo_execution_latency_ms",
    "Time taken for broker placement (Proxy latency)",
    buckets=BUCKETS
)

# --- 2. Throughput Counters ---
TICK_UPDATES_TOTAL = Counter(
    "algo_tick_updates_total",
    "Total raw ticks processed by WebSocket"
)

TRADE_INTENTS_TOTAL = Counter(
    "algo_trade_intents_total",
    "Total intents proposed by strategies",
    ["strategy_name"]
)

ORDERS_PLACED_TOTAL = Counter(
    "algo_orders_placed_total",
    "Total orders confirmed sent to broker",
    ["symbol", "status"] # status = SUCCESS, FAILED
)

# --- 3. State Gauges ---
TICK_QUEUE_DEPTH = Gauge(
    "algo_tick_queue_depth",
    "Current backlog of ticks waiting processor thread"
)

STRATEGY_QUEUE_DEPTH = Gauge(
    "algo_strategy_queue_depth",
    "Current backlog of closed candles waiting eval"
)

AVAILABLE_CAPITAL = Gauge(
    "algo_available_capital",
    "Current lockless available equity for new intents"
)

UNREALIZED_PNL = Gauge(
    "algo_unrealized_pnl",
    "Current synthetic realtime local MTM PnL"
)

SYSTEM_STATE_GAUGE = Gauge(
    "algo_system_state",
    "Enum integer representation of State (0=INIT, 1=READY, etc)"
)

WEBSOCKET_HEARTBEAT_AGE = Gauge(
    "algo_websocket_heartbeat_age_seconds",
    "Time since last tick. > 3 triggers reconciliation."
)
