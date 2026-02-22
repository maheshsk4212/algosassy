import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon, Maximize2, Layers, AlertTriangle } from 'lucide-react';
import { apiUrl } from '../config/api';
import './PortfolioView.css';

const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#14B8A6', '#F43F5E', '#A855F7'];
const DEFAULT_SECTORS = [{ name: 'Cash', value: 100 }];

const symbolBucket = (symbol) => (symbol && symbol.length >= 4 ? symbol.substring(0, 4) : 'OTHER');

const formatInr = (value) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toSectorChart = (rows, valueKey) => {
    const sectorMap = {};
    rows.forEach((row) => {
        const bucket = symbolBucket(row.symbol || row.tradingsymbol);
        const val = Math.abs(Number(row[valueKey] || 0));
        sectorMap[bucket] = (sectorMap[bucket] || 0) + val;
    });

    const total = Object.values(sectorMap).reduce((sum, val) => sum + val, 0);
    if (total <= 0) return DEFAULT_SECTORS;

    return Object.keys(sectorMap).map((name) => ({
        name,
        value: parseFloat(((sectorMap[name] / total) * 100).toFixed(1)),
    }));
};

const compressSectors = (sectors, maxBuckets = 10) => {
    if (!Array.isArray(sectors) || sectors.length <= maxBuckets) return sectors;

    const sorted = [...sectors].sort((a, b) => b.value - a.value);
    const primary = sorted.slice(0, maxBuckets - 1);
    const otherValue = sorted
        .slice(maxBuckets - 1)
        .reduce((sum, row) => sum + Number(row.value || 0), 0);

    if (otherValue <= 0) return primary;

    return [...primary, { name: 'OTHER', value: parseFloat(otherValue.toFixed(1)) }];
};

export const PortfolioView = () => {
    const [activeTab, setActiveTab] = useState('positions');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [positionHeatmap, setPositionHeatmap] = useState([{ symbol: 'NO POSITIONS', exposure: 0, max: 1 }]);
    const [positionSectors, setPositionSectors] = useState(DEFAULT_SECTORS);
    const [riskContrib, setRiskContrib] = useState([]);
    const [concentrationAlert, setConcentrationAlert] = useState(false);

    const [holdings, setHoldings] = useState([]);
    const [holdingsSectors, setHoldingsSectors] = useState(DEFAULT_SECTORS);
    const [holdingsError, setHoldingsError] = useState('');

    React.useEffect(() => {
        const fetchPositions = async () => {
            try {
                const res = await fetch(apiUrl('/api/v1/dashboard/positions'));
                const data = await res.json();
                const net = Array.isArray(data?.net) ? data.net : [];

                if (net.length === 0) {
                    setPositionHeatmap([{ symbol: 'NO POSITIONS', exposure: 0, max: 1 }]);
                    setRiskContrib([]);
                    setConcentrationAlert(false);
                    setPositionSectors(DEFAULT_SECTORS);
                    return;
                }

                const mappedHeatmap = net.map((pos) => {
                    const quantity = Number(pos.quantity || 0);
                    const averagePrice = Number(pos.average_price || 0);
                    const exposureVal = (quantity * averagePrice) / 10000;
                    return {
                        symbol: pos.tradingsymbol,
                        exposure: quantity > 0 ? exposureVal : -Math.abs(exposureVal),
                        max: Math.max(Math.abs(exposureVal) * 1.5, 1.0),
                    };
                });
                setPositionHeatmap(mappedHeatmap);

                const totalExposure = mappedHeatmap.reduce((sum, row) => sum + Math.abs(row.exposure), 0);
                const contrib = mappedHeatmap.map((row) => ({
                    symbol: row.symbol,
                    riskPct: totalExposure > 0 ? parseFloat(((Math.abs(row.exposure) / totalExposure) * 100).toFixed(1)) : 0,
                    limit: 40,
                }));
                setRiskContrib(contrib);
                setConcentrationAlert(contrib.some((item) => item.riskPct > item.limit));

                const positionRows = net.map((pos) => ({
                    symbol: pos.tradingsymbol,
                    positionValue: Number(pos.quantity || 0) * Number(pos.average_price || 0),
                }));
                setPositionSectors(toSectorChart(positionRows, 'positionValue'));
            } catch (err) {
                console.error('Failed to load positions', err);
                setPositionHeatmap([{ symbol: 'NO POSITIONS', exposure: 0, max: 1 }]);
                setRiskContrib([]);
                setConcentrationAlert(false);
                setPositionSectors(DEFAULT_SECTORS);
            }
        };

        const fetchHoldings = async () => {
            try {
                const res = await fetch(apiUrl('/api/v1/dashboard/holdings'));
                const data = await res.json();
                const list = Array.isArray(data?.holdings) ? data.holdings : [];

                const mapped = list
                    .map((item) => {
                        const settledQty = Number(item.quantity || 0);
                        const t1Qty = Number(item.t1_quantity || 0);
                        const qty = settledQty + t1Qty;
                        const avgPrice = Number(item.average_price || 0);
                        const ltp = Number(item.last_price || 0);
                        const invested = qty * avgPrice;
                        const marketValue = qty * ltp;
                        const pnl = marketValue - invested;
                        return {
                            symbol: item.tradingsymbol,
                            quantity: qty,
                            averagePrice: avgPrice,
                            ltp,
                            invested,
                            marketValue,
                            pnl,
                        };
                    })
                    .filter((row) => row.quantity > 0);

                setHoldings(mapped);
                setHoldingsSectors(compressSectors(toSectorChart(mapped, 'marketValue'), 9));
                setHoldingsError(data?.error || '');
            } catch (err) {
                console.error('Failed to load holdings', err);
                setHoldings([]);
                setHoldingsSectors(DEFAULT_SECTORS);
                setHoldingsError('Unable to fetch holdings from broker.');
            }
        };

        fetchPositions();
        fetchHoldings();
        const poller = setInterval(() => {
            fetchPositions();
            fetchHoldings();
        }, 5000);
        return () => clearInterval(poller);
    }, []);

    const topHoldings = [...holdings]
        .sort((a, b) => b.marketValue - a.marketValue)
        .slice(0, 8)
        .map((row) => ({ symbol: row.symbol, marketValue: row.marketValue }));

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

            <div className="portfolio-tabs" role="tablist" aria-label="Portfolio data views">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'positions'}
                    className={`portfolio-tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('positions')}
                >
                    Positions
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'holdings'}
                    className={`portfolio-tab-btn ${activeTab === 'holdings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('holdings')}
                >
                    Holdings
                </button>
            </div>

            {activeTab === 'positions' && (
                <>
                    {concentrationAlert && (
                        <div className="concentration-alert">
                            <AlertTriangle size={15} />
                            <span><strong>Concentration Risk:</strong> One or more positions exceed the 40% risk weight limit. Review your position sizing.</span>
                        </div>
                    )}

                    <div className="glass-panel risk-contrib-panel-main">
                        <h3>Marginal Risk Contribution</h3>
                        <p className="panel-sub">Risk weight per open position. Institutional desks size by risk weight, not capital allocation.</p>
                        <div className="risk-contrib-table">
                            <div className="risk-contrib-header">
                                <span>Symbol</span>
                                <span>Risk Weight</span>
                                <span>Limit</span>
                                <span>Status</span>
                            </div>
                            {riskContrib.length > 0 ? riskContrib.map((row, idx) => (
                                <div key={`${row.symbol}_${idx}`} className={`risk-contrib-row ${row.riskPct > row.limit ? 'breach' : ''}`}>
                                    <span className="rc-symbol">{row.symbol}</span>
                                    <div className="rc-bar-wrap">
                                        <div
                                            className={`rc-bar ${row.riskPct > row.limit ? 'rc-bar-breach' : 'rc-bar-ok'}`}
                                            style={{ width: `${Math.min(100, row.riskPct)}%` }}
                                        />
                                        <span className="rc-pct">{row.riskPct}%</span>
                                    </div>
                                    <span className="rc-limit">{row.limit}%</span>
                                    <span className={`rc-status ${row.riskPct > row.limit ? 'text-alert' : 'text-positive'}`}>
                                        {row.riskPct > row.limit ? 'BREACH' : 'OK'}
                                    </span>
                                </div>
                            )) : (
                                <div className="table-empty">No positions loaded</div>
                            )}
                        </div>
                    </div>

                    <div className="portfolio-grid">
                        <div className="glass-panel heatmap-panel">
                            <h3>Asset Exposure Heatmap</h3>
                            <p className="panel-sub">Position size vs max allowed limit. Hover for detail.</p>
                            <div className="heatmap-grid">
                                {positionHeatmap.map((asset) => {
                                    const util = Math.abs(asset.exposure) / asset.max;
                                    const isBreached = util > 1.0;
                                    const color = isBreached
                                        ? 'rgba(239, 68, 68, 0.6)'
                                        : asset.exposure > 0
                                            ? `rgba(23, 162, 180, ${0.12 + util * 0.3})`
                                            : `rgba(224, 128, 32, ${0.12 + util * 0.3})`;

                                    return (
                                        <div
                                            key={asset.symbol}
                                            className={`heat-cell ${isBreached ? 'heat-cell-breach' : ''}`}
                                            style={{ backgroundColor: color }}
                                            title={`${asset.symbol}: ${(util * 100).toFixed(0)}% of limit`}
                                        >
                                            <span className="heat-symbol">{asset.symbol}</span>
                                            <span className="heat-val">{asset.exposure > 0 ? '+' : ''}{asset.exposure.toFixed(1)}x</span>
                                            <span className="heat-util">{(util * 100).toFixed(0)}% util</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="glass-panel risk-contrib-panel">
                            <h3>Risk vs Capital Distribution</h3>
                            <p className="panel-sub">Derived from live open positions.</p>
                            <div className="chart-container">
                                {positionHeatmap.length > 0 && positionHeatmap[0].symbol !== 'NO POSITIONS' ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={positionHeatmap} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                                            <XAxis dataKey="symbol" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                                            <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
                                                formatter={(val) => `${Number(val).toFixed(2)}x`}
                                            />
                                            <Bar dataKey="exposure" name="Exposure" fill="var(--accent-teal-muted)" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="max" name="Max Limit" fill="rgba(255,255,255,0.06)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="chart-empty">No active positions to display.</div>
                                )}
                            </div>
                        </div>

                        <div className="glass-panel sector-panel">
                            <h3>Sector Allocation (Positions)</h3>
                            <div className="pie-container">
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={positionSectors}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                            isAnimationActive={false}
                                        >
                                            {positionSectors.map((entry, index) => (
                                                <Cell key={`${entry.name}_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} opacity={0.8} />
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
                                    {positionSectors.map((entry, index) => (
                                        <div key={`${entry.name}_${index}`} className="legend-item">
                                            <div className="legend-color" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                            <span>{entry.name} ({entry.value}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'holdings' && (
                <div className="portfolio-grid holdings-grid">
                    <div className="glass-panel holdings-panel-main">
                        <h3>Holdings Snapshot</h3>
                        <p className="panel-sub">Long-term holdings (CNC + T1) pulled from broker holdings API.</p>
                        {holdingsError && (
                            <div className="table-empty" style={{ marginBottom: '0.75rem' }}>
                                Broker warning: {holdingsError}
                            </div>
                        )}
                        <div className="holdings-table-wrap desktop-only">
                            <div className="holdings-header">
                                <span>Symbol</span>
                                <span>Qty</span>
                                <span>Avg</span>
                                <span>LTP</span>
                                <span>Invested</span>
                                <span>Value</span>
                                <span>PnL</span>
                            </div>
                            {holdings.length > 0 ? holdings.map((row) => (
                                <div key={row.symbol} className="holdings-row">
                                    <span className="holdings-symbol">{row.symbol}</span>
                                    <span>{row.quantity}</span>
                                    <span>{formatInr(row.averagePrice)}</span>
                                    <span>{formatInr(row.ltp)}</span>
                                    <span>{formatInr(row.invested)}</span>
                                    <span>{formatInr(row.marketValue)}</span>
                                    <span className={row.pnl >= 0 ? 'holdings-pnl-positive' : 'holdings-pnl-negative'}>
                                        {formatInr(row.pnl)}
                                    </span>
                                </div>
                            )) : (
                                <div className="table-empty">No holdings found for this account.</div>
                            )}
                        </div>

                        <div className="holdings-cards mobile-only">
                            {holdings.length > 0 ? holdings.map((row) => (
                                <article key={`${row.symbol}_card`} className="holdings-card">
                                    <div className="holdings-card-head">
                                        <span className="holdings-symbol">{row.symbol}</span>
                                        <span className="holdings-qty">Qty {row.quantity}</span>
                                    </div>
                                    <div className="holdings-card-grid">
                                        <div className="holdings-card-metric">
                                            <span className="metric-label">Avg</span>
                                            <span>{formatInr(row.averagePrice)}</span>
                                        </div>
                                        <div className="holdings-card-metric">
                                            <span className="metric-label">LTP</span>
                                            <span>{formatInr(row.ltp)}</span>
                                        </div>
                                        <div className="holdings-card-metric">
                                            <span className="metric-label">Invested</span>
                                            <span>{formatInr(row.invested)}</span>
                                        </div>
                                        <div className="holdings-card-metric">
                                            <span className="metric-label">Value</span>
                                            <span>{formatInr(row.marketValue)}</span>
                                        </div>
                                    </div>
                                    <div className="holdings-card-pnl">
                                        <span className="metric-label">PnL</span>
                                        <span className={row.pnl >= 0 ? 'holdings-pnl-positive' : 'holdings-pnl-negative'}>
                                            {formatInr(row.pnl)}
                                        </span>
                                    </div>
                                </article>
                            )) : (
                                <div className="table-empty">No holdings found for this account.</div>
                            )}
                        </div>
                    </div>

                    <div className="glass-panel sector-panel">
                        <h3>Sector Allocation (Holdings)</h3>
                        <div className="pie-container">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={holdingsSectors}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        isAnimationActive={false}
                                    >
                                        {holdingsSectors.map((entry, index) => (
                                            <Cell key={`${entry.name}_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} opacity={0.8} />
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
                                {holdingsSectors.map((entry, index) => (
                                    <div key={`${entry.name}_${index}`} className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                        <span>{entry.name} ({entry.value}%)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel risk-contrib-panel">
                        <h3>Top Holdings by Value</h3>
                        <p className="panel-sub">Largest holdings by mark-to-market value.</p>
                        <div className="chart-container">
                            {topHoldings.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={topHoldings} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="symbol" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
                                            formatter={(val) => formatInr(Number(val))}
                                        />
                                        <Bar dataKey="marketValue" fill="var(--accent-teal-muted)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="chart-empty">No holdings value distribution available.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
