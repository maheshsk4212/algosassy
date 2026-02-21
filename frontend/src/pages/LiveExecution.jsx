import React, { useState, useEffect, useRef } from 'react';
import { Activity, ZapOff, Zap, Clock, TrendingUp } from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import { apiUrl } from '../config/api';
import './LiveExecution.css';

export const LiveExecution = () => {
    const [orders, setOrders] = useState([]);
    const [cpuWarning, setCpuWarning] = useState(false);
    const [summary, setSummary] = useState({ avgLatency: null, avgSlippage: null, totalToday: 0 });
    const burstCountRef = useRef(0);
    const burstTimerRef = useRef(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await fetch(apiUrl('/api/v1/dashboard/orders'));
                const data = await res.json();
                if (Array.isArray(data)) {
                    const parsedOrders = data.map(o => ({
                        id: o.order_id,
                        symbol: o.tradingsymbol,
                        side: o.transaction_type,
                        size: o.quantity,
                        price: o.average_price || o.price || 0,
                        status: o.status === 'COMPLETE' ? 'FILLED' : o.status,
                        time: o.order_timestamp,
                        latency_ms: o.latency_ms || null,
                        slippage_pct: o.slippage_pct || null,
                        strategy: o.tag || o.strategy_name || '--',
                        trace_id: o.order_id || '--',
                    }));

                    // Track event burst rate → disable animation if > 20/sec
                    burstCountRef.current++;
                    clearTimeout(burstTimerRef.current);
                    burstTimerRef.current = setTimeout(() => {
                        setCpuWarning(burstCountRef.current > 20);
                        burstCountRef.current = 0;
                    }, 1000);

                    setOrders(parsedOrders.slice(0, 50));

                    // Build execution quality summary
                    const latencies = parsedOrders.filter(o => o.latency_ms).map(o => o.latency_ms);
                    const slippages = parsedOrders.filter(o => o.slippage_pct).map(o => o.slippage_pct);
                    setSummary({
                        avgLatency: latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0) : null,
                        avgSlippage: slippages.length ? (slippages.reduce((a, b) => a + b, 0) / slippages.length).toFixed(3) : null,
                        totalToday: parsedOrders.length,
                    });
                }
            } catch (err) {
                console.error("Failed to fetch orders:", err);
            }
        };

        fetchOrders();
        const mockWS = setInterval(fetchOrders, 1000);
        return () => { clearInterval(mockWS); clearTimeout(burstTimerRef.current); };
    }, []);

    return (
        <div className="page-container">
            <div className="execution-header">
                <div className="header-left">
                    <h2><Activity size={20} /> Live Execution</h2>
                    <p>Direct exchange API gateway states</p>
                </div>
                <div className="header-right">
                    {cpuWarning && (
                        <div className="cpu-warning"><ZapOff size={12} /> HF Animations Disabled</div>
                    )}
                    <div className="section-badge"><Zap size={11} /> 250ms Buffer Active</div>
                </div>
            </div>

            {/* Execution Quality Summary Strip */}
            <div className="exec-summary-strip">
                <div className="exec-summary-item">
                    <span className="exec-summary-label"><Clock size={10} /> Avg Latency</span>
                    <span className={`exec-summary-value ${summary.avgLatency > 200 ? 'latency-warn' : 'latency-ok'}`}>
                        {summary.avgLatency != null ? `${summary.avgLatency}ms` : '--'}
                    </span>
                </div>
                <div className="exec-summary-item">
                    <span className="exec-summary-label"><TrendingUp size={10} /> Avg Slippage</span>
                    <span className={`exec-summary-value ${summary.avgSlippage > 0.1 ? 'slippage-warn' : 'slippage-ok'}`}>
                        {summary.avgSlippage != null ? `${summary.avgSlippage}%` : '--'}
                    </span>
                </div>
                <div className="exec-summary-item">
                    <span className="exec-summary-label">Orders Today</span>
                    <span className="exec-summary-value text-cyan">{summary.totalToday}</span>
                </div>
            </div>

            <div className="glass-panel order-table">
                <div className="order-header">
                    <span>Time</span>
                    <span>Symbol</span>
                    <span>Side</span>
                    <span>Size</span>
                    <span>Price</span>
                    <span>Latency</span>
                    <span>Slippage</span>
                    <span>Strategy</span>
                    <span>State</span>
                </div>
                <div className={`order-body virtualized-table`}>
                    {orders.map((order, idx) => (
                        <div key={order.id + idx} className={`order-row ${!cpuWarning && idx === 0 ? 'new-row' : ''}`}>
                            <span className="col-time">
                                {new Date(order.time).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
                            </span>
                            <span className="col-symbol">{order.symbol}</span>
                            <span className={order.side === 'BUY' ? 'col-side-buy' : 'col-side-sell'}>{order.side}</span>
                            <span className="col-right">{order.size}</span>
                            <span className="col-right">₹{order.price}</span>
                            <span className={`col-right ${order.latency_ms > 200 ? 'latency-warn' : 'latency-ok'}`}>
                                {order.latency_ms != null ? `${order.latency_ms}ms` : '--'}
                            </span>
                            <span className={`col-right ${order.slippage_pct > 0.1 ? 'slippage-warn' : 'slippage-ok'}`}>
                                {order.slippage_pct != null ? `${order.slippage_pct.toFixed(3)}%` : '--'}
                            </span>
                            <span className="col-strategy">{order.strategy}</span>
                            <span className="col-status">
                                <StatusBadge status={order.status} type={order.status === 'FILLED' ? 'profit' : 'loss'} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
