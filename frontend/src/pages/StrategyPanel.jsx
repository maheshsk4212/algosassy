import React from 'react';
import { Lock } from 'lucide-react';
import { StatefulToggle } from '../components/shared/StatefulToggle';
import { StatusBadge } from '../components/shared/StatusBadge';
import './Strategies.css';

const MOCK_STRATEGIES = [
    {
        id: 'str_1', name: 'MeanReversion_Vol_Scalp',
        allocation: 45.0, expectancy: 1.24,
        drift: 'NOMINAL', regimeCompat: true,
        lastSignal: '2s ago', active: true, lockedReason: null
    },
    {
        id: 'str_2', name: 'TrendFollowing_Macro_HTF',
        allocation: 30.0, expectancy: 2.15,
        drift: 'WARNING', regimeCompat: false,
        lastSignal: '14h ago', active: false, lockedReason: 'REGIME INCOMPATIBLE'
    },
    {
        id: 'str_3', name: 'StatArb_Pairs_Neutral',
        allocation: 25.0, expectancy: 0.85,
        drift: 'DEGRADED', regimeCompat: true,
        lastSignal: '1m ago', active: false, lockedReason: 'DRIFT THRESHOLD BREACH'
    }
];

const StrategyCard = ({ strategy }) => {
    const handleToggle = async (newState) => {
        await new Promise(r => setTimeout(r, 600));
    };

    return (
        <div className={`glass-panel strategy-card ${strategy.lockedReason ? 'locked' : ''}`}>
            <div>
                <div className="card-top">
                    <span className="strat-name">{strategy.name}</span>
                    <StatusBadge
                        status={strategy.drift}
                        type={strategy.drift === 'NOMINAL' ? 'profit' : strategy.drift === 'WARNING' ? 'warning' : 'loss'}
                    />
                </div>
                <div className="card-stats">
                    <div className="card-stat">
                        <span className="stat-label">Allocation</span>
                        <span className="stat-val">{strategy.allocation}%</span>
                    </div>
                    <div className="card-stat">
                        <span className="stat-label">Expectancy</span>
                        <span className="stat-val text-profit">{strategy.expectancy}</span>
                    </div>
                    <div className="card-stat">
                        <span className="stat-label">Last Signal</span>
                        <span className="stat-val" style={{ fontSize: '0.85rem' }}>{strategy.lastSignal}</span>
                    </div>
                    <div className="card-stat">
                        <span className="stat-label">Regime</span>
                        <span className="stat-val" style={{ fontSize: '0.85rem' }}>{strategy.regimeCompat ? 'Compatible' : 'Incompatible'}</span>
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

export const StrategyPanel = () => (
    <div className="strategies-page">
        <div className="section-header">
            <h2>
                Strategies
                <span className="section-sub">Regime-aware allocation control</span>
            </h2>
        </div>
        <div className="strategies-grid">
            {MOCK_STRATEGIES.map(s => <StrategyCard key={s.id} strategy={s} />)}
        </div>
    </div>
);
