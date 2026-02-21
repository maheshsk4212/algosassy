import React from 'react';
import { Lock, TrendingDown, AlertTriangle, Zap } from 'lucide-react';
import { StatefulToggle } from '../components/shared/StatefulToggle';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import './Strategies.css';

/** Mini sparkline for per-strategy 7-day equity */
const MiniSparkline = ({ data, positive }) => {
    if (!data || data.length < 2) return (
        <div className="sparkline-placeholder">
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No data</span>
        </div>
    );
    return (
        <div className="sparkline-wrap">
            <ResponsiveContainer width="100%" height={36}>
                <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                    <defs>
                        <linearGradient id={`sg_${positive}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={positive ? 'var(--accent-teal-muted)' : 'var(--accent-orange-muted)'} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={positive ? 'var(--accent-teal-muted)' : 'var(--accent-orange-muted)'} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="equity"
                        stroke={positive ? 'var(--accent-teal-muted)' : 'var(--accent-orange-muted)'}
                        strokeWidth={1.5}
                        fill={`url(#sg_${positive})`}
                        dot={false}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

const StrategyCard = ({ strategy }) => {
    const handleToggle = async (newState) => {
        await new Promise(r => setTimeout(r, 600));
    };

    const sparklinePositive = strategy.expectancyRaw > 0;

    return (
        <div className={`glass-panel strategy-card ${strategy.lockedReason ? 'locked' : ''}`}>
            <div>
                <div className="card-top">
                    <div className="card-title-row">
                        {/* Drift Warning dot — amber pulsing */}
                        {strategy.drift === 'DECAYED' && (
                            <span className="drift-flag" title="Edge decay detected by Drift Monitor" />
                        )}
                        <span className="strat-name">{strategy.name}</span>
                    </div>
                    <div className="card-badges">
                        {/* Drift status badge */}
                        <StatusBadge
                            status={strategy.drift}
                            type={strategy.drift === 'NOMINAL' ? 'profit' : strategy.drift === 'WARNING' ? 'warning' : 'loss'}
                        />
                        {/* Regime compatibility badge */}
                        <span className={`status-badge ${strategy.regimeCompat ? 'regime-badge-compat' : 'regime-badge-mismatch'}`}>
                            {strategy.regimeCompat ? 'COMPAT' : 'MISMATCH'}
                        </span>
                        {/* Allocation scaled down flag */}
                        {strategy.scaledDown && (
                            <span className="status-badge warning" title="Sizing penalty active from Governance Guard">
                                <TrendingDown size={9} /> SCALED
                            </span>
                        )}
                    </div>
                </div>

                {/* Mini equity sparkline */}
                <MiniSparkline data={strategy.equityHistory} positive={sparklinePositive} />

                <div className="card-stats">
                    <div className="card-stat">
                        <span className="stat-label">Allocation</span>
                        <span className="stat-val">{strategy.allocation}%</span>
                    </div>
                    <div className="card-stat">
                        <span className="stat-label">Expectancy</span>
                        <span className={`stat-val ${sparklinePositive ? 'text-profit' : ''}`} style={{ color: sparklinePositive ? 'var(--accent-teal-muted)' : 'var(--accent-orange-muted)' }}>
                            {strategy.expectancy}
                        </span>
                    </div>
                    <div className="card-stat">
                        <span className="stat-label">Risk Contrib</span>
                        <span className="stat-val">{strategy.riskContribution != null ? `${strategy.riskContribution.toFixed(1)}%` : '--'}</span>
                    </div>
                    <div className="card-stat">
                        <span className="stat-label">Regime</span>
                        <span className={`stat-val ${strategy.regimeCompat ? 'text-positive' : 'text-warning'}`} style={{ fontSize: '0.85rem' }}>
                            {strategy.regimeCompat ? 'Compatible' : 'Incompatible'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="card-footer">
                <StatefulToggle
                    initialState={strategy.active}
                    onToggle={handleToggle}
                    locked={!!strategy.lockedReason}
                    lockReason={strategy.lockedReason}
                    label={strategy.active ? 'Online' : 'Halted'}
                />
                {strategy.lockedReason && (
                    <div className="lock-reason">
                        <Lock size={10} /> {strategy.lockedReason}
                    </div>
                )}
            </div>
        </div>
    );
};

export const StrategyPanel = () => {
    const [strategies, setStrategies] = React.useState([]);
    const [regime, setRegime] = React.useState('--');

    React.useEffect(() => {
        const fetchStrats = async () => {
            try {
                const [stratRes, govRes] = await Promise.all([
                    fetch('http://localhost:8000/api/v1/dashboard/strategies'),
                    fetch('http://localhost:8000/api/v1/governance/status'),
                ]);
                const data = await stratRes.json();
                const gov = await govRes.json();
                setRegime(gov.current_market_regime || 'TRENDING');

                if (Array.isArray(data)) {
                    setStrategies(data.map((s, idx) => ({
                        id: `str_${s.symbol}_${idx}`,
                        name: s.name,
                        symbol: s.symbol,
                        allocation: (100.0 / Math.max(1, data.length)).toFixed(1),
                        expectancy: s.expectancy != null ? `₹${s.expectancy.toFixed(2)}` : 'No trades yet',
                        expectancyRaw: s.expectancy || 0,
                        drift: s.drift === 'DECAYED' ? 'DECAYED' : 'NOMINAL',
                        regimeCompat: s.regime_compatible !== false,
                        active: s.status === 'ACTIVE',
                        lockedReason: s.drift === 'DECAYED' ? 'Edge decay detected by Drift Monitor' : null,
                        scaledDown: gov.active_sizing_penalty < 1.0,
                        riskContribution: s.risk_contribution || null,
                        equityHistory: s.equity_history || [],
                    })));
                }
            } catch (err) {
                console.error("Failed to fetch strategies", err);
            }
        };
        fetchStrats();
        const poller = setInterval(fetchStrats, 5000);
        return () => clearInterval(poller);
    }, []);

    return (
        <div className="page-container">
            <div className="section-header">
                <h2>
                    Strategies
                    <span className="section-sub">Regime-aware allocation control</span>
                </h2>
                <div className="section-badge"><Zap size={11} /> Regime: {regime}</div>
            </div>
            <div className="strategies-grid">
                {strategies.length > 0 ? (
                    strategies.map(s => <StrategyCard key={s.id} strategy={s} />)
                ) : (
                    <div className="glass-panel strategy-empty-state">
                        <AlertTriangle size={28} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                        <p>No strategies active for the current <strong>{regime}</strong> regime.</p>
                        <p style={{ opacity: 0.6, marginTop: 6 }}>
                            The governance engine has filtered strategies based on regime compatibility rules. Strategies will activate when market conditions match their configured parameters.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
