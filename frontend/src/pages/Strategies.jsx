import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { Lock, Unlock, AlertTriangle, CheckCircle, TrendingDown, Clock, Activity } from 'lucide-react';
import './Strategies.css';

const generateMiniCurve = (trend) => {
    let base = 100;
    return Array.from({ length: 20 }, () => {
        base += (Math.random() - (trend === 'down' ? 0.6 : 0.4)) * 5;
        return { val: base };
    });
};

const mockStrategies = [
    {
        id: 'str-1',
        name: 'Alpha-1 Momentum',
        allocation: 40,
        expectancy: 1.25,
        driftStatus: 'NOMINAL',
        driftReduction: 0,
        regimeCompat: 'HIGH',
        isActive: true,
        lastSignal: '12 mins ago',
        curve: generateMiniCurve('up'),
        lockedByDrift: false,
        regimeBlocked: false
    },
    {
        id: 'str-2',
        name: 'Beta-Neutral Arb',
        allocation: 30,
        expectancy: 0.85,
        driftStatus: 'WARNING',
        driftReduction: 25,
        regimeCompat: 'INCOMPATIBLE',
        isActive: false,
        lastSignal: '4 hours ago',
        curve: generateMiniCurve('down'),
        lockedByDrift: false,
        regimeBlocked: true
    },
    {
        id: 'str-3',
        name: 'Vol-Harvester',
        allocation: 30,
        expectancy: 1.05,
        driftStatus: 'CRITICAL',
        driftReduction: 100,
        regimeCompat: 'MODERATE',
        isActive: false,
        lastSignal: '2 days ago',
        curve: generateMiniCurve('down'),
        lockedByDrift: true,
        regimeBlocked: false
    }
];

const mockDriftTimeline = [
    { time: '14:22', event: 'Vol-Harvester breached 2-sigma drift limit. Risk engine set to 0%.' },
    { time: '11:05', event: 'Beta-Neutral Arb regime incompatibility detected. Paused.' },
    { time: '09:30', event: 'System startup. Alpha-1 enabled.' }
];

const Strategies = () => {
    const [strategies, setStrategies] = useState(mockStrategies);

    const toggleStrategy = (id) => {
        setStrategies(strategies.map(s => {
            if (s.id === id) {
                if (s.regimeBlocked || s.lockedByDrift) return s; // Cannot toggle if blocked
                return { ...s, isActive: !s.isActive };
            }
            return s;
        }));
    };

    const overrideLock = (id) => {
        // In a real app, this would require admin auth
        alert(`Admin override invoked for ${id}. Logging action...`);
        setStrategies(strategies.map(s => {
            if (s.id === id) {
                return { ...s, lockedByDrift: false, regimeBlocked: false };
            }
            return s;
        }));
    };

    return (
        <div className="strategies-container">
            <div className="strat-header">
                <h2><Activity size={24} /> Strategy Matrix & Drift Monitor</h2>
            </div>

            <div className="strategies-grid">
                <div className="cards-column">
                    {strategies.map(strat => (
                        <StrategyCard key={strat.id} strat={strat} onToggle={() => toggleStrategy(strat.id)} onOverride={() => overrideLock(strat.id)} />
                    ))}
                </div>

                <div className="drift-column">
                    <div className="glass-panel drift-panel">
                        <h3>Drift Visualization & Governance</h3>
                        <div className="drift-status-summary">
                            <div className="drift-stat">
                                <span className="stat-label">Global Risk Reduction applied</span>
                                <span className="stat-value warning">25%</span>
                            </div>
                        </div>

                        <h4 className="timeline-title"><Clock size={16} /> Recent Drift Events</h4>
                        <div className="drift-timeline">
                            {mockDriftTimeline.map((item, idx) => (
                                <div key={idx} className="timeline-item">
                                    <div className="timeline-bullet"></div>
                                    <div className="timeline-content">
                                        <span className="time">{item.time}</span>
                                        <span className="event">{item.event}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StrategyCard = ({ strat, onToggle, onOverride }) => {
    const isLocked = strat.regimeBlocked || strat.lockedByDrift;

    return (
        <div className={`glass-panel strategy-card ${strat.isActive ? 'active-border' : ''}`}>
            <div className="card-header">
                <div className="title-area">
                    <h3>{strat.name}</h3>
                    <span className="last-signal">Last Signal: {strat.lastSignal}</span>
                </div>
                <div className="toggle-area">
                    {isLocked && (
                        <button className="btn-override" onClick={onOverride} title="Admin Override Request">
                            <Lock size={14} />
                        </button>
                    )}
                    <div
                        className={`toggle-switch ${strat.isActive ? 'on' : 'off'} ${isLocked ? 'disabled' : ''}`}
                        onClick={onToggle}
                        role="switch"
                        aria-checked={strat.isActive}
                        aria-disabled={isLocked}
                        tabIndex={isLocked ? -1 : 0}
                        onKeyDown={(event) => {
                            if (isLocked) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onToggle();
                            }
                        }}
                    >
                        <div className="toggle-knob"></div>
                    </div>
                </div>
            </div>

            <div className="card-metrics">
                <div className="metric">
                    <span className="label">Allocation</span>
                    <span className="value">{strat.allocation}%</span>
                </div>
                <div className="metric">
                    <span className="label">Rolling Exp.</span>
                    <span className="value">{strat.expectancy.toFixed(2)}</span>
                </div>
                <div className="metric">
                    <span className="label">Regime Compat.</span>
                    <span className={`badge ${strat.regimeCompat.toLowerCase()}`}>{strat.regimeCompat}</span>
                </div>
                <div className="metric">
                    <span className="label">Drift Status</span>
                    <span className={`badge ${strat.driftStatus.toLowerCase()}`}>{strat.driftStatus}</span>
                </div>
            </div>

            <div className="card-footer">
                <div className="mini-curve">
                    <ResponsiveContainer width="100%" height={40}>
                        <LineChart data={strat.curve}>
                            <YAxis domain={['auto', 'auto']} hide />
                            <Line
                                type="monotone"
                                dataKey="val"
                                stroke={strat.curve[strat.curve.length - 1].val >= strat.curve[0].val ? 'var(--accent-positive)' : 'var(--accent-negative)'}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                {strat.driftReduction > 0 && (
                    <div className="drift-warning">
                        <TrendingDown size={14} /> Risk reduced by {strat.driftReduction}%
                    </div>
                )}
                {strat.regimeBlocked && (
                    <div className="regime-warning">
                        <AlertTriangle size={14} /> Regime implies negative expectancy. Forced pause.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Strategies;
