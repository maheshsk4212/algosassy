import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Activity, Clock, ArrowUpRight, ArrowDownRight, Zap, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { apiUrl, WS_BASE_URL } from '../config/api';
import './OverviewDashboard.css';

/**
 * MetricCard — base card
 * large=true: Drawdown-class dominance (larger font, bolder)
 * muted=true: P&L etc. (smaller, de-emphasized)
 */
const MetricCard = ({ label, value, sub, glow, change, positive, large, muted, icon, alert }) => (
    <div className={`metric-card ${glow || ''} ${large ? 'metric-card-large' : ''} ${muted ? 'metric-card-muted' : ''} ${alert ? 'metric-card-alert' : ''}`}>
        <span className="metric-label">
            {icon && React.createElement(icon, { size: 11, style: { marginRight: 4, opacity: 0.7 } })}
            {label}
        </span>
        <span className={`metric-value ${muted ? 'metric-value-muted' : large ? 'metric-value-large' : ''}`}>
            {value}
        </span>
        {sub && <span className="metric-sub">{sub}</span>}
        {change && (
            <span className="metric-sub" style={{
                color: positive ? 'var(--accent-teal-muted)' : 'var(--accent-orange-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'var(--transition-pnl)'
            }}>
                {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {change}
            </span>
        )}
    </div>
);

export const OverviewDashboard = () => {
    const [metrics, setMetrics] = useState({
        equity: '₹--',
        dailyPnL: '₹--',
        dailyPnLPositive: true,
        drawdown: '--%',
        exposure: '--%',
        capital: '₹--',
        mtdReturn: null,
        peakDrawdown: null,
        activeStrategies: null,
        reservedCapital: 0,
        equityCurve: [],
        activities: [],
        stats: { win_rate: '--', avg_hold_time: '--', trades_today: 0, sharpe_30d: null, risk_adjusted_return: null, worst_trade_today: null },
        globalRisk: 'NORMAL',
        drawdownRaw: 0,
    });

    useEffect(() => {
        fetch(apiUrl('/api/v1/dashboard/overview'))
            .then(res => res.json())
            .then(data => {
                const eq = data.current_equity;
                const dd = data.drawdown_percent || 0;
                setMetrics(prev => ({
                    ...prev,
                    equity: `₹${eq.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    capital: `₹${data.available_capital.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    drawdown: `-${dd.toFixed(2)}%`,
                    drawdownRaw: dd,
                    mtdReturn: data.performance_stats?.mtd_return,
                    peakDrawdown: data.performance_stats?.peak_drawdown,
                    activeStrategies: data.active_strategies_count,
                    reservedCapital: data.reserved_capital || 0,
                    equityCurve: data.equity_curve || [],
                    activities: data.recent_activity || [],
                    stats: {
                        ...(data.performance_stats || { win_rate: '--', avg_hold_time: '--', trades_today: 0 }),
                        sharpe_30d: data.performance_stats?.sharpe_30d,
                        risk_adjusted_return: data.performance_stats?.risk_adjusted_return,
                        worst_trade_today: data.performance_stats?.worst_trade_today,
                    },
                    exposure: `${(data.exposure_percent || 0).toFixed(1)}%`,
                    dailyPnL: `₹${(data.unrealized_pnl || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    dailyPnLPositive: (data.unrealized_pnl || 0) >= 0,
                    globalRisk: dd > 5 ? 'HIGH' : dd > 2 ? 'ELEVATED' : 'NORMAL',
                }));
            })
            .catch(err => console.error("Error fetching overview:", err));

        // WebSocket 4FPS live feed
        const ws = new WebSocket(`${WS_BASE_URL}/api/v1/dashboard/ws/stream`);
        let buffer = null;
        let lastFlush = Date.now();
        let frameId;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'market_data') buffer = data;
            } catch {
                // Ignore malformed websocket frames and continue streaming.
            }
        };

        const flush = () => {
            if (buffer && Date.now() - lastFlush >= 250) {
                setMetrics(prev => {
                    const livePnL = buffer.unrealized_pnl || 0;
                    const isPositive = livePnL >= 0;
                    return {
                        ...prev,
                        dailyPnL: `${isPositive ? '+' : '-'}₹${Math.abs(livePnL).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                        dailyPnLPositive: isPositive,
                    };
                });
                buffer = null;
                lastFlush = Date.now();
            }
            frameId = requestAnimationFrame(flush);
        };
        flush();

        return () => { ws.close(); cancelAnimationFrame(frameId); };
    }, []);

    return (
        <div className="page-container">
            <div className="section-header">
                <h2>
                    <TrendingUp size={20} />
                    Overview
                    <span className="section-sub">System Dashboard</span>
                </h2>
                <div className="section-badge">
                    <Zap size={12} /> Render: 4 FPS Lock
                </div>
            </div>

            {/* ROW 1 — SURVIVAL METRICS (drawdown dominant) */}
            <div className="metrics-grid metrics-grid-survival">
                <MetricCard
                    label="Current Drawdown"
                    value={metrics.drawdown}
                    glow={metrics.drawdownRaw > 5 ? 'glow-rose' : 'glow-amber'}
                    sub={`Peak: ${metrics.peakDrawdown || '--'}%`}
                    large
                    icon={TrendingDown}
                    alert={metrics.drawdownRaw > 10}
                />
                <MetricCard
                    label="Portfolio Exposure"
                    value={metrics.exposure}
                    glow="glow-violet"
                    sub={`${metrics.activeStrategies || 0} active strategies`}
                    large
                />
                <MetricCard
                    label="Global Risk State"
                    value={metrics.globalRisk}
                    glow={metrics.globalRisk === 'HIGH' ? 'glow-rose' : metrics.globalRisk === 'ELEVATED' ? 'glow-amber' : 'glow-emerald'}
                    sub="From governance engine"
                    large
                    icon={AlertTriangle}
                />
            </div>

            {/* ROW 2 — PERFORMANCE METRICS (de-emphasized) */}
            <div className="metrics-grid">
                <MetricCard label="Total Equity" value={metrics.equity} glow="glow-cyan" change={metrics.mtdReturn != null ? `${metrics.mtdReturn}% MTD` : null} positive={metrics.mtdReturn > 0} muted />
                <MetricCard label="Available Capital" value={metrics.capital} sub={`Reserved: ₹${metrics.reservedCapital || 0}`} muted />
                <MetricCard
                    label="Daily P&L"
                    value={metrics.dailyPnL}
                    positive={metrics.dailyPnLPositive}
                    change={null}
                    muted
                />
            </div>

            <div className="charts-row">
                <div className="glass-panel equity-panel">
                    <h3><Activity size={16} /> Equity Curve — 60 Day</h3>
                    <div className="equity-chart-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.equityCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ background: 'rgba(6,8,13,0.95)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                                    itemStyle={{ color: 'var(--accent-cyan)' }}
                                    formatter={v => [`₹${v.toLocaleString()}`, 'Equity']}
                                    labelFormatter={l => `Day ${l}`}
                                />
                                <Area type="monotone" dataKey="equity" stroke="var(--accent-cyan)" strokeWidth={1.5} fill="url(#eqGrad)" dot={false} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel activity-panel">
                    <h3><Clock size={16} /> Recent Activity</h3>
                    <div className="activity-list">
                        {metrics.activities.map((a, i) => (
                            <div key={i} className={`activity-item ${a.type}`}>
                                <span className="activity-time">{a.time}</span>
                                <span className="activity-msg">{a.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* BOTTOM STATS STRIP — extended with Sharpe and Risk-adjusted */}
            <div className="bottom-stats">
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Win Rate (30d)</span>
                    <span className="stat-mini-value text-profit">{metrics.stats.win_rate}%</span>
                </div>
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Avg Hold Time</span>
                    <span className="stat-mini-value">{metrics.stats.avg_hold_time}</span>
                </div>
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Trades Today</span>
                    <span className="stat-mini-value text-cyan">{metrics.stats.trades_today}</span>
                </div>
                <div className="stat-mini-card">
                    <span className="stat-mini-label">30D Sharpe</span>
                    <span className={`stat-mini-value ${metrics.stats.sharpe_30d >= 1 ? 'text-profit' : 'text-muted'}`}>
                        {metrics.stats.sharpe_30d != null ? metrics.stats.sharpe_30d.toFixed(2) : '--'}
                    </span>
                </div>
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Risk-Adj Return</span>
                    <span className="stat-mini-value">{metrics.stats.risk_adjusted_return != null ? `${metrics.stats.risk_adjusted_return.toFixed(1)}%` : '--'}</span>
                </div>
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Worst Trade</span>
                    <span className="stat-mini-value" style={{ color: 'var(--accent-orange-muted)' }}>
                        {metrics.stats.worst_trade_today != null ? `₹${metrics.stats.worst_trade_today.toLocaleString()}` : '--'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OverviewDashboard;
