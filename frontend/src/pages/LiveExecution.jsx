import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Activity, ZapOff, Zap, Clock, TrendingUp } from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import { apiUrl } from '../config/api';
import { withAdminHeaders } from '../config/admin';
import './LiveExecution.css';

export const LiveExecution = () => {
    const [orders, setOrders] = useState([]);
    const [cpuWarning, setCpuWarning] = useState(false);
    const [summary, setSummary] = useState({ avgLatency: null, avgSlippage: null, totalToday: 0 });
    const [manualOrder, setManualOrder] = useState({
        tradingsymbol: '',
        exchange: 'NSE',
        quantity: 1,
        product: 'MIS',
        orderType: 'MARKET',
        price: '',
    });
    const [manualSubmit, setManualSubmit] = useState({ loading: false, type: '', message: '' });
    const burstCountRef = useRef(0);
    const burstTimerRef = useRef(null);

    const fetchOrders = useCallback(async () => {
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

                // Track event burst rate -> disable animation if > 20/sec
                burstCountRef.current++;
                clearTimeout(burstTimerRef.current);
                burstTimerRef.current = setTimeout(() => {
                    setCpuWarning(burstCountRef.current > 20);
                    burstCountRef.current = 0;
                }, 1000);

                setOrders(parsedOrders.slice(0, 50));

                // Build execution quality summary
                const latencies = parsedOrders
                    .filter(o => Number.isFinite(o.latency_ms))
                    .map(o => Number(o.latency_ms));
                const slippages = parsedOrders
                    .filter(o => Number.isFinite(o.slippage_pct))
                    .map(o => Number(o.slippage_pct));
                setSummary({
                    avgLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
                    avgSlippage: slippages.length
                        ? Number((slippages.reduce((a, b) => a + b, 0) / slippages.length).toFixed(3))
                        : null,
                    totalToday: parsedOrders.length,
                });
            }
        } catch (err) {
            console.error("Failed to fetch orders:", err);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
        const mockWS = setInterval(fetchOrders, 1000);
        return () => { clearInterval(mockWS); clearTimeout(burstTimerRef.current); };
    }, [fetchOrders]);

    const setTicketField = (key, value) => {
        setManualOrder(prev => ({ ...prev, [key]: value }));
    };

    const submitManualOrder = async (transactionType) => {
        const tradingsymbol = manualOrder.tradingsymbol.trim().toUpperCase();
        const quantity = Number(manualOrder.quantity);
        const orderType = manualOrder.orderType.toUpperCase();
        const price = manualOrder.price === '' ? null : Number(manualOrder.price);

        if (!tradingsymbol) {
            setManualSubmit({ loading: false, type: 'error', message: 'Tradingsymbol is required.' });
            return;
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            setManualSubmit({ loading: false, type: 'error', message: 'Quantity must be a positive whole number.' });
            return;
        }
        if (orderType === 'LIMIT' && (!Number.isFinite(price) || price <= 0)) {
            setManualSubmit({ loading: false, type: 'error', message: 'Valid limit price is required for LIMIT orders.' });
            return;
        }

        setManualSubmit({ loading: true, type: '', message: '' });
        try {
            const response = await fetch(
                apiUrl('/api/v1/dashboard/manual-order'),
                withAdminHeaders({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tradingsymbol,
                        exchange: manualOrder.exchange,
                        transaction_type: transactionType,
                        quantity,
                        product: manualOrder.product,
                        order_type: orderType,
                        price: orderType === 'LIMIT' ? price : null,
                    }),
                })
            );
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.detail || 'Manual order request failed.');
            }

            setManualSubmit({
                loading: false,
                type: 'success',
                message: `${transactionType} order sent. Order ID: ${result.order_id || '--'}`,
            });
            await fetchOrders();
        } catch (error) {
            setManualSubmit({
                loading: false,
                type: 'error',
                message: error.message || 'Manual order failed.',
            });
        }
    };

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

            <div className="glass-panel manual-order-ticket">
                <div className="manual-order-head">
                    <h3>Manual Order Ticket</h3>
                    <p>Admin token required. Configure it in Settings before placing manual orders.</p>
                </div>
                <div className="manual-order-grid">
                    <div className="form-group">
                        <label>Tradingsymbol</label>
                        <input
                            className="ui-input"
                            value={manualOrder.tradingsymbol}
                            onChange={(event) => setTicketField('tradingsymbol', event.target.value)}
                            placeholder="e.g. INFY"
                            autoComplete="off"
                        />
                    </div>
                    <div className="form-group">
                        <label>Exchange</label>
                        <select
                            className="ui-select"
                            value={manualOrder.exchange}
                            onChange={(event) => setTicketField('exchange', event.target.value)}
                        >
                            <option value="NSE">NSE</option>
                            <option value="BSE">BSE</option>
                            <option value="NFO">NFO</option>
                            <option value="MCX">MCX</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Quantity</label>
                        <input
                            className="ui-input"
                            type="number"
                            min="1"
                            step="1"
                            value={manualOrder.quantity}
                            onChange={(event) => setTicketField('quantity', event.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Product</label>
                        <select
                            className="ui-select"
                            value={manualOrder.product}
                            onChange={(event) => setTicketField('product', event.target.value)}
                        >
                            <option value="MIS">MIS</option>
                            <option value="CNC">CNC</option>
                            <option value="NRML">NRML</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Order Type</label>
                        <select
                            className="ui-select"
                            value={manualOrder.orderType}
                            onChange={(event) => setTicketField('orderType', event.target.value)}
                        >
                            <option value="MARKET">MARKET</option>
                            <option value="LIMIT">LIMIT</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Limit Price</label>
                        <input
                            className="ui-input"
                            type="number"
                            min="0"
                            step="0.05"
                            value={manualOrder.price}
                            onChange={(event) => setTicketField('price', event.target.value)}
                            placeholder={manualOrder.orderType === 'LIMIT' ? 'Required for LIMIT' : 'Not used for MARKET'}
                            disabled={manualOrder.orderType !== 'LIMIT'}
                        />
                    </div>
                </div>
                <div className="manual-order-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => submitManualOrder('BUY')}
                        disabled={manualSubmit.loading}
                    >
                        {manualSubmit.loading ? 'Submitting...' : 'Manual BUY'}
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={() => submitManualOrder('SELL')}
                        disabled={manualSubmit.loading}
                    >
                        {manualSubmit.loading ? 'Submitting...' : 'Manual SELL'}
                    </button>
                </div>
                {manualSubmit.message && (
                    <p className={`manual-order-feedback ${manualSubmit.type === 'success' ? 'success' : 'error'}`}>
                        {manualSubmit.message}
                    </p>
                )}
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
