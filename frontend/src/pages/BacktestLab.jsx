import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FlaskConical, Play, Save, Settings2, ShieldAlert } from 'lucide-react';
import './BacktestLab.css';

const mockSimData = Array.from({ length: 100 }, (_, i) => ({
    day: i,
    equity: 100000 * Math.pow(1.0005 + (Math.random() - 0.45) * 0.02, i)
}));

export const BacktestLab = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);

    const runSimulation = () => {
        setIsRunning(true);
        setProgress(0);
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) {
                    clearInterval(interval);
                    setIsRunning(false);
                    return 100;
                }
                return p + 5;
            });
        }, 100);
    };

    return (
        <div className="backtest-container">
            <div className="lab-header">
                <h2><FlaskConical size={24} /> Backtest Engine Lab</h2>
                <div className="lab-header-actions">
                    <button className="btn-secondary"><Save size={16} /> Save Run</button>
                    <button className="btn-primary" onClick={runSimulation} disabled={isRunning}>
                        {isRunning ? 'Simulating...' : <><Play size={16} /> Run Full Simulation</>}
                    </button>
                </div>
            </div>

            <div className="lab-warning-banner">
                <ShieldAlert size={16} />
                <span><strong>Engine Enforced:</strong> Instant-fill shortcuts and risk engine bypasses disabled. Validating via Live Risk parameters.</span>
            </div>

            <div className="lab-layout">
                {/* Left Panel: Configuration */}
                <div className="glass-panel lab-config">
                    <h3><Settings2 size={18} /> Engine Parameters</h3>

                    <div className="config-group">
                        <label>Strategy Selection</label>
                        <select className="ui-select">
                            <option>Alpha-1 Momentum</option>
                            <option>Beta-Neutral Arb</option>
                            <option>Vol-Harvester</option>
                        </select>
                    </div>

                    <div className="config-group">
                        <label>Time Range</label>
                        <select className="ui-select">
                            <option>Year To Date (YTD)</option>
                            <option>1 Year Lookback</option>
                            <option>3 Year Cycle</option>
                            <option>Custom Range</option>
                        </select>
                    </div>

                    <div className="config-group">
                        <label>Volatility Model Override</label>
                        <select className="ui-select">
                            <option>GARCH(1,1) Estimated</option>
                            <option>Historical Walk</option>
                            <option>Stress Test (+3 Sigma)</option>
                        </select>
                    </div>

                    <div className="config-group locked-group">
                        <div className="locked-label">
                            <label>Slippage Model</label>
                            <span className="badge-lock">Always On</span>
                        </div>
                        <select className="ui-select" disabled>
                            <option>Tiered Volume Decay (Active)</option>
                        </select>
                    </div>

                    <div className="config-group locked-group">
                        <div className="locked-label">
                            <label>Partial Fill Simulation</label>
                            <span className="badge-lock">Enabled</span>
                        </div>
                        <div className="toggle-switch on disabled">
                            <div className="toggle-knob"></div>
                        </div>
                    </div>
                </div>

                {/* Center Panel: Equity Curve Simulation */}
                <div className="glass-panel lab-main">
                    <div className="main-header">
                        <h3>Simulation Equity Curve</h3>
                        {isRunning && (
                            <div className="progress-wrap">
                                <span className="progress-text">{progress}%</span>
                                <div className="progress-bar">
                                    <div className="progress-fill nominal" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="chart-wrapper-large">
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={isRunning ? mockSimData.slice(0, Math.max(1, Math.floor(progress))) : mockSimData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="day" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                                <YAxis domain={['auto', 'auto']} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--text-primary)', fontFamily: 'var(--font-numeric)' }}
                                    formatter={(val) => `$${val.toFixed(2)}`}
                                    labelFormatter={(l) => `Day ${l}`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="equity"
                                    stroke="var(--accent-info)"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={!isRunning}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Panel: Results & Stats */}
                <div className="glass-panel lab-stats">
                    <h3>Simulation Results</h3>

                    <div className="stats-grid">
                        <div className="stat-box">
                            <span className="stat-label">Max Drawdown</span>
                            <span className="stat-value negative">-8.4%</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">CAGR</span>
                            <span className="stat-value positive">+34.2%</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">Sharpe Ratio</span>
                            <span className="stat-value">1.85</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">Expectancy</span>
                            <span className="stat-value">1.2x</span>
                        </div>
                    </div>

                    <div className="detailed-stats">
                        <h4>Execution Constraints Impact</h4>
                        <div className="impact-row">
                            <span>Slippage Drag</span>
                            <span className="negative">-1.2%</span>
                        </div>
                        <div className="impact-row">
                            <span>Partial Fills Missed</span>
                            <span className="negative">-0.8%</span>
                        </div>
                        <div className="impact-row">
                            <span>Risk Scaling Drag</span>
                            <span className="negative">-2.1%</span>
                        </div>
                        <div className="impact-total">
                            <span>Realism Adjusted Net</span>
                            <span className="positive">30.1%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BacktestLab;
