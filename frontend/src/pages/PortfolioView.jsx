import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon, Maximize2, Layers } from 'lucide-react';
import './PortfolioView.css';

const mockSectors = [
    { name: 'Major Crypto', value: 45 },
    { name: 'Altcoins L1', value: 25 },
    { name: 'DeFi', value: 15 },
    { name: 'Cash/Stables', value: 15 },
];

const mockRiskContrib = [
    { name: 'Alpha-1', risk: 45, capital: 40 },
    { name: 'Beta-Neutral', risk: 15, capital: 30 },
    { name: 'Vol-Harvest', risk: 40, capital: 30 },
];

const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981'];

const mockHeatmap = [
    { symbol: 'BTC', exposure: 2.1, max: 3.0 },
    { symbol: 'ETH', exposure: 1.5, max: 2.0 },
    { symbol: 'SOL', exposure: 0.8, max: 1.0 },
    { symbol: 'AVAX', exposure: -0.5, max: 1.0 }, // Short exp
    { symbol: 'DOGE', exposure: 0.2, max: 0.5 },
    { symbol: 'LINK', exposure: 0.9, max: 1.5 },
];

const mockCorrelation = [
    [1.0, 0.8, 0.6, 0.2],
    [0.8, 1.0, 0.7, 0.3],
    [0.6, 0.7, 1.0, 0.5],
    [0.2, 0.3, 0.5, 1.0]
];
const corrLabels = ['BTC', 'ETH', 'SOL', 'AVAX'];

export const PortfolioView = () => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    return (
        <div className="portfolio-container">
            <div className="portfolio-header">
                <h2><PieIcon size={24} /> Portfolio & Risk Exposure</h2>
                <div className="header-actions">
                    <button className={`btn-toggle ${showAdvanced ? 'active' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)}>
                        <Maximize2 size={16} /> Advanced Correlation
                    </button>
                </div>
            </div>

            <div className="portfolio-grid">
                {/* Exposure Heatmap */}
                <div className="glass-panel heatmap-panel">
                    <h3>Asset Exposure Heatmap</h3>
                    <p className="panel-sub">Current position size vs Max allowed limit</p>
                    <div className="heatmap-grid">
                        {mockHeatmap.map(asset => {
                            const util = Math.abs(asset.exposure) / asset.max;
                            // Color intensity based on utilization
                            const color = asset.exposure > 0
                                ? `rgba(34, 197, 94, ${0.2 + util * 0.8})` // Green for long
                                : `rgba(239, 68, 68, ${0.2 + util * 0.8})`; // Red for short

                            return (
                                <div key={asset.symbol} className="heat-cell" style={{ backgroundColor: color }}>
                                    <span className="heat-symbol">{asset.symbol}</span>
                                    <span className="heat-val">{asset.exposure > 0 ? '+' : ''}{asset.exposure.toFixed(1)}x</span>
                                    <span className="heat-util">{(util * 100).toFixed(0)}% util</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Risk vs Capital Contribution */}
                <div className="glass-panel risk-contrib-panel">
                    <h3>Risk vs Capital Distribution</h3>
                    <p className="panel-sub">Risk contribution is decoupled from capital allocation.</p>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={mockRiskContrib} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                                <XAxis dataKey="name" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
                                    itemStyle={{ fontFamily: 'var(--font-numeric)' }}
                                    formatter={(val) => `${val}%`}
                                />
                                <Bar dataKey="capital" name="Capital %" fill="var(--glass-border)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="risk" name="Risk %" fill="var(--accent-warning)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sector Distribution */}
                <div className="glass-panel sector-panel">
                    <h3>Sector Allocation</h3>
                    <div className="pie-container">
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={mockSectors}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {mockSectors.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--text-primary)' }}
                                    formatter={(val) => `${val}%`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="pie-legend">
                            {mockSectors.map((entry, index) => (
                                <div key={entry.name} className="legend-item">
                                    <div className="legend-color" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                    <span>{entry.name} ({entry.value}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Advanced Correlation Matrix */}
            {showAdvanced && (
                <div className="glass-panel correlation-panel">
                    <h3><Layers size={18} /> Asset Correlation Matrix</h3>
                    <div className="correlation-grid">
                        <div className="corr-row header">
                            <div className="corr-cell corner"></div>
                            {corrLabels.map(l => <div key={l} className="corr-cell header">{l}</div>)}
                        </div>
                        {mockCorrelation.map((row, i) => (
                            <div key={i} className="corr-row">
                                <div className="corr-cell header">{corrLabels[i]}</div>
                                {row.map((val, j) => {
                                    const intensity = Math.abs(val);
                                    const color = val > 0
                                        ? `rgba(245, 158, 11, ${intensity})` // orange for positive corr
                                        : `rgba(59, 130, 246, ${intensity})`; // blue for negative
                                    return (
                                        <div key={j} className="corr-cell value" style={{ backgroundColor: color }}>
                                            {val.toFixed(2)}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioView;
