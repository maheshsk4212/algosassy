import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { FrictionAction } from '../components/shared/FrictionAction';
import './RiskControl.css';

export const RiskControlPanel = () => {
    const [params, setParams] = useState({
        baseRiskPercent: 1.5,
        maxExposure: 50.0,
        monthlyLossCap: 10.0
    });

    const [projecting, setProjecting] = useState(false);
    const [projectionResult, setProjectionResult] = useState(null);

    const currentRiskState = {
        volatilityAdjustedRisk: 1.2,
        driftAdjustedRisk: 1.4,
        regimeAdjustedRisk: 0.8
    };

    const handleSimulate = async () => {
        setProjecting(true);
        setProjectionResult(null);
        await new Promise(r => setTimeout(r, 1500));
        setProjectionResult({
            estimatedDrawdownCap: (params.baseRiskPercent * 3.5).toFixed(1),
            estimatedRecoveryDays: 14,
            viabilityScore: params.baseRiskPercent > 3.0 ? 'DANGEROUS' : 'SAFE'
        });
        setProjecting(false);
    };

    const handleApply = async () => {
        await new Promise(r => setTimeout(r, 1000));
        setProjectionResult(null);
    };

    return (
        <div className="risk-page">
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
                            <label>Max Portfolio Exposure (%)</label>
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
                            {projecting ? <><Loader2 size={14} className="spin-icon" /> Running Projection...</> : 'Run Simulation Endpoint'}
                        </button>
                    </div>
                </div>

                <div className="risk-readonly">
                    <div className="glass-panel readonly-card">
                        <h3>Non-Editable Engine States</h3>
                        <div className="readonly-rows">
                            <div className="readonly-row">
                                <span className="ro-label">Vol Adjusted Risk</span>
                                <span className="ro-value">{currentRiskState.volatilityAdjustedRisk}%</span>
                            </div>
                            <div className="readonly-row">
                                <span className="ro-label">Drift Adjusted Risk</span>
                                <span className="ro-value">{currentRiskState.driftAdjustedRisk}%</span>
                            </div>
                            <div className="readonly-row">
                                <span className="ro-label">Regime Adjusted Risk</span>
                                <span className="ro-value">{currentRiskState.regimeAdjustedRisk}%</span>
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
                            <div className="sim-actions">
                                <FrictionAction delayMs={5000} onAction={handleApply}>
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
