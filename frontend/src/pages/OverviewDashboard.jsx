import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Clock, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import './OverviewDashboard.css';

// Generate mock equity curve
const generateEquityCurve = () => {
    let val = 100000;
    return Array.from({ length: 60 }, (_, i) => {
        val += val * (Math.random() - 0.46) * 0.015;
        return { day: i, equity: Math.round(val) };
    });
};

const equityData = generateEquityCurve();

const MetricCard = ({ label, value, sub, glow, change, positive }) => (
    <div className={`metric-card ${glow || ''}`}>
        <span className="metric-label">{label}</span>
        <span className="metric-value">{value}</span>
        {sub && <span className="metric-sub">{sub}</span>}
        {change && (
            <span className="metric-sub" style={{ color: positive ? 'var(--color-profit)' : 'var(--color-loss)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {change}
            </span>
        )}
    </div>
);

const ACTIVITIES = [
    { type: 'trade', time: '16:24:01', msg: 'MeanReversion filled BUY 0.42 BTC @ $54,281' },
    { type: 'risk', time: '16:22:18', msg: 'Drift monitor recalibrated — Vol model updated to GARCH(1,1)' },
    { type: 'system', time: '16:20:05', msg: 'Regime detection transition: RANGING → TRENDING' },
    { type: 'trade', time: '16:18:33', msg: 'StatArb exit SELL 1.2 ETH @ $3,412 — partial fill' },
    { type: 'risk', time: '16:15:00', msg: 'Exposure rebalance: Portfolio heat reduced to 34%' },
];

export const OverviewDashboard = () => {
    const [metrics, setMetrics] = useState({
        equity: '$142,500',
        dailyPnL: '+$1,280',
        dailyPnLPositive: true,
        drawdown: '-1.2%',
        exposure: '34%',
        capital: '$94,050'
    });

    useEffect(() => {
        let buffer = null;
        let lastFlush = Date.now();
        let frameId;

        const feed = setInterval(() => {
            const delta = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 40 + 5);
            const base = parseInt(metrics.equity.replace(/[$,]/g, ''));
            const newEquity = base + delta;
            buffer = {
                equity: `$${newEquity.toLocaleString()}`,
                dailyPnL: delta >= 0 ? `+$${Math.abs(delta + 1280)}` : `-$${Math.abs(delta - 1280)}`,
                dailyPnLPositive: delta >= 0,
                drawdown: `-${(1.2 + Math.random() * 0.3).toFixed(1)}%`,
                exposure: `${Math.floor(33 + Math.random() * 3)}%`,
                capital: `$${(94050 + delta).toLocaleString()}`
            };
        }, 80);

        const flush = () => {
            if (buffer && Date.now() - lastFlush >= 250) {
                setMetrics(buffer);
                buffer = null;
                lastFlush = Date.now();
            }
            frameId = requestAnimationFrame(flush);
        };
        flush();

        return () => { clearInterval(feed); cancelAnimationFrame(frameId); };
    }, []);

    return (
        <div className="overview-page">
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

            <div className="metrics-grid">
                <MetricCard label="Total Equity" value={metrics.equity} glow="glow-cyan" change="+2.1% MTD" positive />
                <MetricCard label="Daily P&L" value={metrics.dailyPnL} glow={metrics.dailyPnLPositive ? 'glow-emerald' : 'glow-rose'} positive={metrics.dailyPnLPositive} />
                <MetricCard label="Current Drawdown" value={metrics.drawdown} glow="glow-amber" sub="Peak: -3.8%" />
                <MetricCard label="Portfolio Exposure" value={metrics.exposure} glow="glow-violet" sub="3 active strategies" />
                <MetricCard label="Available Capital" value={metrics.capital} sub="Reservation: $0" />
            </div>

            <div className="charts-row">
                <div className="glass-panel equity-panel">
                    <h3><Activity size={16} /> Equity Curve — 60 Day</h3>
                    <div className="equity-chart-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ background: 'rgba(6,8,13,0.95)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                                    itemStyle={{ color: 'var(--accent-cyan)' }}
                                    formatter={v => [`$${v.toLocaleString()}`, 'Equity']}
                                    labelFormatter={l => `Day ${l}`}
                                />
                                <Area type="monotone" dataKey="equity" stroke="var(--accent-cyan)" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel activity-panel">
                    <h3><Clock size={16} /> Recent Activity</h3>
                    <div className="activity-list">
                        {ACTIVITIES.map((a, i) => (
                            <div key={i} className={`activity-item ${a.type}`}>
                                <span className="activity-time">{a.time}</span>
                                <span className="activity-msg">{a.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bottom-stats">
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Win Rate (30d)</span>
                    <span className="stat-mini-value text-profit">62.4%</span>
                </div>
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Avg Hold Time</span>
                    <span className="stat-mini-value">4h 12m</span>
                </div>
                <div className="stat-mini-card">
                    <span className="stat-mini-label">Trades Today</span>
                    <span className="stat-mini-value text-cyan">14</span>
                </div>
            </div>
        </div>
    );
};

export default OverviewDashboard;
