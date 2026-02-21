import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { FrictionAction } from '../components/shared/FrictionAction';
import { NotificationSettings } from '../components/shared/NotificationSettings';
import './RiskControl.css';

export const RiskControlPanel = () => {
    const [params, setParams] = useState({
        baseRiskPercent: 1.5,
        maxExposure: 50.0,
        monthlyLossCap: 10.0
    });

    const [liveRiskState, setLiveRiskState] = useState({
        base_risk_percent: '--',
        drawdown_penalty_multiplier: '--',
        max_drawdown_percent: '--',
        volatility_regime: '--',
        current_drawdown: '--',
    });

    const [projecting, setProjecting] = useState(false);
    const [projectionResult, setProjectionResult] = useState(null);
    const [appliedSuccess, setAppliedSuccess] = useState(false);

    // Fetch live risk params from the backend
    useEffect(() => {
        const fetchRiskParams = async () => {
            try {
                const [riskRes, govRes] = await Promise.all([
                    fetch('http://localhost:8000/api/v1/dashboard/risk-params'),
                    fetch('http://localhost:8000/api/v1/governance/status'),
                ]);
                const risk = await riskRes.json();
                const gov = await govRes.json();
                setLiveRiskState({
                    base_risk_percent: ((risk.base_risk_percent || 0) * 100).toFixed(2),
                    drawdown_penalty_multiplier: risk.drawdown_penalty_multiplier?.toFixed(2) ?? '--',
                    max_drawdown_percent: risk.max_drawdown_percent ?? '--',
                    volatility_regime: gov.current_market_regime ?? '--',
                    current_drawdown: gov.drawdown_percent?.toFixed(2) ?? '--',
                });

                // Only initialize if not already edited
                if (params.baseRiskPercent === 1.5) {
                    setParams(prev => ({
                        ...prev,
                        baseRiskPercent: parseFloat(((risk.base_risk_percent || 0) * 100).toFixed(2)),
                        monthlyLossCap: risk.max_drawdown_percent || 5.0
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch risk params:", err);
            }
        };
        fetchRiskParams();
        const t = setInterval(fetchRiskParams, 3000);
        return () => clearInterval(t);
    }, []);

    const handleSimulate = async () => {
        setProjecting(true);
        setProjectionResult(null);
        setAppliedSuccess(false);
        try {
            const res = await fetch('http://localhost:8000/api/v1/governance/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_risk_percent: params.baseRiskPercent,
                    max_exposure: params.maxExposure,
                    monthly_loss_cap: params.monthlyLossCap
                })
            });
            const data = await res.json();
            setProjectionResult({
                estimatedDrawdownCap: data.estimated_drawdown_cap,
                estimatedRecoveryDays: data.estimated_recovery_days,
                viabilityScore: data.viability_score
            });
        } catch (err) {
            console.error("Simulation failed:", err);
        } finally {
            setProjecting(false);
        }
    };

    const handleApply = async () => {
        try {
            await Promise.all([
                fetch('http://localhost:8000/api/v1/dashboard/risk-params', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        base_risk_percent: params.baseRiskPercent,
                        max_drawdown_percent: params.monthlyLossCap
                    })
                }),
                fetch('http://localhost:8000/api/v1/governance/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        monthly_drawdown_limit: params.monthlyLossCap / 100.0,
                        max_strategy_concentration: params.maxExposure / 100.0
                    })
                })
            ]);

            setAppliedSuccess(true);
            setProjectionResult(null);
            setTimeout(() => setAppliedSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to apply risk rules:", err);
        }
    };

    return (
        <div className="page-container">
            <div className="section-header">
                <h2>
                    <ShieldAlert size={20} />
                    Risk Control
                    <span className="section-sub">Parameterized Containment</span>
                </h2>
                <div className="risk-alert-banner">
                    <AlertTriangle size={13} /> UI override blocked during active drawdown &gt; 5%
                </div>
            </div>

            <div className="risk-panels">
                <div className="risk-left-col">
                    <div className="glass-panel risk-editor">
                        <h3><ShieldAlert size={16} /> Editable Parameters</h3>
                        <div className="risk-inputs">
                            <div className="form-group">
                                <label>Base Risk Per Trade (%)</label>
                                <input
                                    type="number" step="0.1" className="ui-input"
                                    value={params.baseRiskPercent}
                                    onChange={e => setParams({ ...params, baseRiskPercent: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Max Single Strategy Exposure (%)</label>
                                <input
                                    type="number" step="1" className="ui-input"
                                    value={params.maxExposure}
                                    onChange={e => setParams({ ...params, maxExposure: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Monthly Loss Cap (%)</label>
                                <input
                                    type="number" step="0.5" className="ui-input"
                                    value={params.monthlyLossCap}
                                    onChange={e => setParams({ ...params, monthlyLossCap: parseFloat(e.target.value) })}
                                />
                            </div>
                            <button className="btn btn-primary" onClick={handleSimulate} disabled={projecting}>
                                {projecting ? <><Loader2 size={14} className="spin-icon" /> Running Projection...</> : 'Run Simulation'}
                            </button>
                            {appliedSuccess && (
                                <div className="apply-success-msg">
                                    <CheckCircle2 size={14} /> Risk rules applied successfully
                                </div>
                            )}
                        </div>
                    </div>

                    <NotificationSettings />
                </div>

                <div className="risk-readonly">
                    <div className="glass-panel readonly-card">
                        <div className="card-title-row">
                            <h3>Live Engine States</h3>
                            <span className="live-badge">LIVE</span>
                        </div>
                        <div className="readonly-rows">
                            <div className="readonly-row">
                                <span className="ro-label">Base Risk %</span>
                                <span className="ro-value">{liveRiskState.base_risk_percent}%</span>
                            </div>
                            <div className="readonly-row">
                                <span className="ro-label">Drawdown Penalty</span>
                                <span className="ro-value">{liveRiskState.drawdown_penalty_multiplier}x</span>
                            </div>
                            <div className="readonly-row">
                                <span className="ro-label">Max Drawdown Cap</span>
                                <span className="ro-value">{liveRiskState.max_drawdown_percent}%</span>
                            </div>
                            <div className="readonly-row">
                                <span className="ro-label">Current Drawdown</span>
                                <span className="ro-value">{liveRiskState.current_drawdown === '--' ? '0.00' : liveRiskState.current_drawdown}%</span>
                            </div>
                            <div className="readonly-row">
                                <span className="ro-label">Volatility Regime</span>
                                <span className="ro-value">{liveRiskState.volatility_regime}</span>
                            </div>
                        </div>
                    </div>

                    {projectionResult && (
                        <div className={`glass-panel sim-result ${projectionResult.viabilityScore === 'DANGEROUS' ? 'danger' : 'safe'}`}>
                            <h3>Simulation Results</h3>
                            <div className="sim-metric">
                                <span className="sim-label">Est. Max Drawdown Limit</span>
                                <span className="sim-value">{projectionResult.estimatedDrawdownCap}%</span>
                            </div>
                            <div className="sim-metric">
                                <span className="sim-label">Est. Recovery Days</span>
                                <span className="sim-value">{projectionResult.estimatedRecoveryDays}d</span>
                            </div>
                            <div className="sim-metric">
                                <span className="sim-label">Viability Score</span>
                                <span className={`sim-value ${projectionResult.viabilityScore === 'DANGEROUS' ? 'text-alert' : 'text-positive'}`}>
                                    {projectionResult.viabilityScore}
                                </span>
                            </div>
                            <div className="sim-actions">
                                <FrictionAction delayMs={3000} onAction={handleApply}>
                                    Commit Risk Rules <ArrowRight size={14} />
                                </FrictionAction>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RiskControlPanel;
