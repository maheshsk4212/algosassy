import React, { useState, useEffect } from 'react';
import { ShieldAlert, Info, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { apiUrl } from '../config/api';
import './RiskControl.css';

const RiskControl = () => {
    const [params, setParams] = useState({
        baseRisk: 1.0,
        maxExposure: 2.0,
        monthlyLossCap: 5.0,
    });

    const [liveGovernance, setLiveGovernance] = useState({
        baseRiskPercent: 1.0,
        drawdownPenalty: 1.0,
        maxDrawdownPercent: 5.0
    });

    const [pendingParams, setPendingParams] = useState(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        // Fetch actual system state on load
        fetch(apiUrl('/api/v1/dashboard/risk-params'))
            .then(res => res.json())
            .then(data => {
                setLiveGovernance({
                    baseRiskPercent: data.base_risk_percent,
                    drawdownPenalty: data.drawdown_penalty_multiplier,
                    maxDrawdownPercent: data.max_drawdown_percent
                });
                // Initialize default form with what backend is actually running
                setParams({
                    baseRisk: data.base_risk_percent,
                    maxExposure: 2.0, // Future: fetch from backend
                    monthlyLossCap: data.max_drawdown_percent,
                });
            })
            .catch(console.error);
    }, []);

    const handleApply = () => {
        if (!pendingParams) {
            setPendingParams({ ...params });
        }
        setIsConfirming(true);
        setCountdown(5);
    };

    useEffect(() => {
        if (isConfirming && countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }

        if (isConfirming && countdown === 0) {
            const timer = setTimeout(() => {
                if (pendingParams) {
                    setParams(pendingParams);
                }
                setIsConfirming(false);
                setPendingParams(null);
            }, 0);
            return () => clearTimeout(timer);
        }

        return undefined;
    }, [isConfirming, countdown, pendingParams]);

    const handleChange = (key, value) => {
        if (!pendingParams) setPendingParams({ ...params });
        setPendingParams(prev => ({ ...prev, [key]: parseFloat(value) }));
    };

    const cancelApply = () => {
        setIsConfirming(false);
        setCountdown(0);
        setPendingParams(null);
    };

    const currentParams = pendingParams || params;
    const isChanged = pendingParams !== null;

    return (
        <div className="risk-control-container">
            <div className="risk-header">
                <h2><ShieldAlert size={24} /> Global Risk Governance</h2>
                <p>Institutional grade risk constraints. System enforces discipline.</p>
            </div>

            <div className="risk-panels">
                {/* Editable Parameters */}
                <div className="glass-panel edit-panel">
                    <h3>Primary Constraints</h3>

                    <div className="input-group">
                        <label>Base Risk per Trade (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={currentParams.baseRisk}
                            onChange={(e) => handleChange('baseRisk', e.target.value)}
                            disabled={isConfirming}
                        />
                    </div>

                    <div className="input-group">
                        <label>Max Portfolio Exposure (x)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={currentParams.maxExposure}
                            onChange={(e) => handleChange('maxExposure', e.target.value)}
                            disabled={isConfirming}
                        />
                    </div>

                    <div className="input-group">
                        <label>Monthly Loss Cap (%)</label>
                        <input
                            type="number"
                            step="0.5"
                            value={currentParams.monthlyLossCap}
                            onChange={(e) => handleChange('monthlyLossCap', e.target.value)}
                            disabled={isConfirming}
                        />
                    </div>

                    {isChanged && !isConfirming && (
                        <div className="action-row">
                            <button className="btn-secondary" onClick={cancelApply}>Discard</button>
                            <button className="btn-primary" onClick={handleApply}>Review Changes</button>
                        </div>
                    )}

                    {isConfirming && (
                        <div className="confirmation-box">
                            <div className="countdown-wrap">
                                <Clock className="spin-icon" size={20} />
                                <span>Applying in {countdown}s...</span>
                            </div>
                            <div className="projected-impact">
                                <AlertTriangle size={16} color="var(--accent-warning)" />
                                <span>Projected Max Drawdown Impact: <strong>+4.2%</strong></span>
                            </div>
                            <button className="btn-cancel" onClick={cancelApply}>CANCEL</button>
                        </div>
                    )}
                </div>

                {/* Display Only Parameters */}
                <div className="glass-panel display-panel">
                    <h3>Auto-Adjusted Risk Profile</h3>
                    <p className="panel-desc">Calculated dynamically by the Risk Engine. Not manually overriding.</p>

                    <div className="read-only-list">
                        <div className="read-only-item nominal">
                            <div className="item-main">
                                <span className="item-label">Base Volatility Risk</span>
                                <span className="item-value">{liveGovernance.baseRiskPercent.toFixed(2)}%</span>
                            </div>
                        </div>
                        <div className={`read-only-item ${liveGovernance.drawdownPenalty < 1.0 ? 'warning' : 'nominal'}`}>
                            <div className="item-main">
                                <span className="item-label">Drawdown Penalty Multiplier</span>
                                <span className="item-value">{liveGovernance.drawdownPenalty.toFixed(2)}x</span>
                            </div>
                            {liveGovernance.drawdownPenalty < 1.0 && (
                                <div className="item-note">
                                    <Info size={14} /> Risk automatically reduced due to local drawdown
                                </div>
                            )}
                        </div>
                        <div className="read-only-item nominal">
                            <div className="item-main">
                                <span className="item-label">Max Allowed Drawdown</span>
                                <span className="item-value">{liveGovernance.maxDrawdownPercent.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="governance-rules-summary">
                        <h4>Governance Rules Active:</h4>
                        <ul>
                            <li><CheckCircle2 size={14} /> Strategy cannot override position size</li>
                            <li><CheckCircle2 size={14} /> Drift active: risk increase locked</li>
                            <li><CheckCircle2 size={14} /> Regime blocked constraints enabled</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiskControl;
