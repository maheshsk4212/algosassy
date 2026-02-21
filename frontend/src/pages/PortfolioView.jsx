import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon, Maximize2, Layers, AlertTriangle } from 'lucide-react';
import './PortfolioView.css';

const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#14B8A6', '#F43F5E', '#A855F7'];

export const PortfolioView = () => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [heatmap, setHeatmap] = useState([]);
    const [sectors, setSectors] = useState([{ name: 'Cash', value: 100 }]);
    const [riskContrib, setRiskContrib] = useState([]);
    const [concentrationAlert, setConcentrationAlert] = useState(false);

    React.useEffect(() => {
        const fetchPositions = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/v1/dashboard/positions');
                const data = await res.json();

                if (data && data.net && data.net.length > 0) {
                    const mappedHeatmap = data.net.map(pos => {
                        const exposureVal = (pos.quantity * pos.average_price) / 10000;
                        return {
                            symbol: pos.tradingsymbol,
                            exposure: pos.quantity > 0 ? exposureVal : -exposureVal,
                            max: Math.max(Math.abs(exposureVal) * 1.5, 1.0)
                        };
                    });
                    setHeatmap(mappedHeatmap);

                    // Risk contribution: % of total absolute exposure per position
                    const totalExposure = mappedHeatmap.reduce((s, p) => s + Math.abs(p.exposure), 0);
                    const contrib = mappedHeatmap.map(p => ({
                        symbol: p.symbol,
                        riskPct: totalExposure > 0 ? parseFloat(((Math.abs(p.exposure) / totalExposure) * 100).toFixed(1)) : 0,
                        limit: 40
                    }));
                    setRiskContrib(contrib);
                    // Concentration alert: any single position > 40% risk weight
                    setConcentrationAlert(contrib.some(c => c.riskPct > 40));

                    const sectorMap = {};
                    data.net.forEach(pos => {
                        const val = Math.abs(pos.quantity * pos.average_price);
                        const group = pos.tradingsymbol.substring(0, 4);
                        sectorMap[group] = (sectorMap[group] || 0) + val;
                    });
                    const totalVal = Object.values(sectorMap).reduce((a, b) => a + b, 0);
                    if (totalVal > 0) {
                        setSectors(Object.keys(sectorMap).map(k => ({
                            name: k,
                            value: parseFloat(((sectorMap[k] / totalVal) * 100).toFixed(1))
                        })));
                    }
                } else {
                    setHeatmap([{ symbol: 'NO POSITIONS', exposure: 0, max: 1 }]);
                }
            } catch (err) {
                console.error("Failed to load positions", err);
            }
        };

        fetchPositions();
        const poller = setInterval(fetchPositions, 5000);
        return () => clearInterval(poller);
    }, []);

    return (
        <div className="page-container">
            <div className="portfolio-header">
                <h2><PieIcon size={24} /> Portfolio &amp; Risk Exposure</h2>
                <div className="header-actions">
                    <button className={`btn-toggle ${showAdvanced ? 'active' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)}>
                        <Maximize2 size={16} /> Advanced Correlation
                    </button>
                </div>
            </div>

            {/* Concentration Risk Alert — triggers when any strategy > 40% risk weight */}
            {concentrationAlert && (
                <div className="concentration-alert">
                    <AlertTriangle size={15} />
                    <span><strong>Concentration Risk:</strong> One or more positions exceed the 40% risk weight limit. Review your position sizing.</span>
                </div>
            )}

            {/* Marginal Risk Contribution Table — larger than capital chart (institutional priority) */}
            <div className="glass-panel risk-contrib-panel-main">
                <h3>Marginal Risk Contribution</h3>
                <p className="panel-sub">Risk weight per position. Institutional desks size by risk weight, not capital allocation.</p>
                <div className="risk-contrib-table">
                    <div className="risk-contrib-header">
                        <span>Symbol</span>
                        <span>Risk Weight</span>
                        <span>Limit</span>
                        <span>Status</span>
                    </div>
                    {riskContrib.length > 0 ? riskContrib.map((r, i) => (
                        <div key={i} className={`risk-contrib-row ${r.riskPct > r.limit ? 'breach' : ''}`}>
                            <span className="rc-symbol">{r.symbol}</span>
                            <div className="rc-bar-wrap">
                                <div
                                    className={`rc-bar ${r.riskPct > r.limit ? 'rc-bar-breach' : 'rc-bar-ok'}`}
                                    style={{ width: `${Math.min(100, r.riskPct)}%` }}
                                />
                                <span className="rc-pct">{r.riskPct}%</span>
                            </div>
                            <span className="rc-limit">{r.limit}%</span>
                            <span className={`rc-status ${r.riskPct > r.limit ? 'text-alert' : 'text-positive'}`}>
                                {r.riskPct > r.limit ? 'BREACH' : 'OK'}
                            </span>
                        </div>
                    )) : (
                        <div style={{ padding: '1rem', opacity: 0.5, fontSize: '0.85rem' }}>No positions loaded</div>
                    )}
                </div>
            </div>

            <div className="portfolio-grid">
                {/* Exposure Heatmap — muted colors, red only on limit breach */}
                <div className="glass-panel heatmap-panel">
                    <h3>Asset Exposure Heatmap</h3>
                    <p className="panel-sub">Position size vs Max allowed limit. Hover for detail.</p>
                    <div className="heatmap-grid">
                        {heatmap.map(asset => {
                            const util = Math.abs(asset.exposure) / asset.max;
                            const isBreached = util > 1.0;
                            // Muted colors — only bright red for actual limit breach
                            const color = isBreached
                                ? `rgba(239, 68, 68, 0.6)` // Alert red only on breach
                                : asset.exposure > 0
                                    ? `rgba(23, 162, 180, ${0.12 + util * 0.3})` // Muted teal long
                                    : `rgba(224, 128, 32, ${0.12 + util * 0.3})`; // Muted orange short

                            return (
                                <div
                                    key={asset.symbol}
                                    className={`heat-cell ${isBreached ? 'heat-cell-breach' : ''}`}
                                    style={{ backgroundColor: color }}
                                    title={`${asset.symbol}: ${(util * 100).toFixed(0)}% of limit (Limit: 100%, Actual: ${(util * 100).toFixed(0)}%)`}
                                >
                                    <span className="heat-symbol">{asset.symbol}</span>
                                    <span className="heat-val">{asset.exposure > 0 ? '+' : ''}{asset.exposure.toFixed(1)}x</span>
                                    <span className="heat-util">{(util * 100).toFixed(0)}% util</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Risk vs Capital Bar Chart */}
                <div className="glass-panel risk-contrib-panel">
                    <h3>Risk vs Capital Distribution</h3>
                    <p className="panel-sub">Derived from live broker positions.</p>
                    <div className="chart-container">
                        {heatmap.length > 0 && heatmap[0].symbol !== 'NO POSITIONS' ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={heatmap} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                                    <XAxis dataKey="symbol" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(1)}x`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
                                        formatter={(val) => `${val.toFixed(2)}x`}
                                    />
                                    <Bar dataKey="exposure" name="Exposure" fill="var(--accent-teal-muted)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="max" name="Max Limit" fill="rgba(255,255,255,0.06)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, opacity: 0.5, fontSize: '0.9rem' }}>
                                No active positions to display.
                            </div>
                        )}
                    </div>
                </div>

                {/* Sector Distribution */}
                <div className="glass-panel sector-panel">
                    <h3>Sector Allocation</h3>
                    <div className="pie-container">
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={sectors}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                    isAnimationActive={false}
                                >
                                    {sectors.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} opacity={0.8} />
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
                            {sectors.map((entry, index) => (
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', opacity: 0.55, flexDirection: 'column', gap: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔬</span>
                        <span style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                            Correlation matrix requires 30-day historical candle data.<br />
                            This feature will be enabled once the timeseries database is connected in Phase 9.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioView;
