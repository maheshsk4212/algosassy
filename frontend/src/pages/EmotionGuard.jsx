import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, Timer, Octagon, RotateCcw, Activity } from 'lucide-react';
import './EmotionGuard.css';

export const EmotionGuard = () => {
    const [overrideState, setOverrideState] = useState('LOCKED'); // LOCKED -> COOLDOWN -> UNLOCKED
    const [cooldown, setCooldown] = useState(30);
    const [reason, setReason] = useState('');

    useEffect(() => {
        let timer;
        if (overrideState === 'COOLDOWN') {
            timer = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setOverrideState('UNLOCKED');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [overrideState]);

    const requestOverride = () => {
        if (!reason.trim()) return;
        setOverrideState('COOLDOWN');
        setCooldown(30);
    };

    const cancelOverride = () => {
        setOverrideState('LOCKED');
        setReason('');
    };

    return (
        <div className="emotion-guard-page animate-in">
            <div className="emotion-header">
                <h2>Emotion Guard Intercept</h2>
                <span className="section-sub">Manual trading overrides have been intercepted by the governance engine.</span>
            </div>

            <div className="glass-panel intercept-panel">
                <h3>
                    <ShieldAlert size={16} /> Containment Protocol Active
                </h3>

                <div className="intercept-copy">
                    <p>
                        You are attempting to manually override an algorithmic position. Statistical probability of
                        manual outperformance over the vector model is <strong className="text-alert">highly negative.</strong>
                    </p>
                    <p>
                        Standard operating procedure mandates allowing the system to reach defined stop-loss or regime
                        shift parameters. Check the <strong>Risk Control</strong> panel if macro factors have shifted.
                    </p>
                </div>
            </div>

            <div className="glass-panel bypass-panel">
                <h3>Request Admin Unlock</h3>

                {overrideState === 'LOCKED' && (
                    <div className="reason-input-group">
                        <label className="metric-label">Intervention Reason (Logged)</label>
                        <textarea
                            className="reason-field"
                            placeholder="State your thesis for overriding the algorithmic containment..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                        />

                        <div className="bypass-actions">
                            <button className="btn" disabled>
                                Contact Risk Officer
                            </button>
                            <button
                                className="btn btn-danger"
                                disabled={!reason.trim()}
                                onClick={requestOverride}
                            >
                                <Lock size={14} /> Initiate Bypass Cooldown
                            </button>
                        </div>
                    </div>
                )}

                {overrideState === 'COOLDOWN' && (
                    <div className="cooldown-state">
                        <Timer size={48} className="text-warning animate-pulse" />
                        <div className="cooldown-timer">
                            {cooldown}s
                        </div>
                        <p className="cooldown-label">Mandatory reflection period before manual controls engage.</p>
                        <button onClick={cancelOverride} className="btn">
                            <RotateCcw size={14} /> Abort Intent
                        </button>
                    </div>
                )}

                {overrideState === 'UNLOCKED' && (
                    <div className="unlocked-alert">
                        <Lock size={32} className="text-alert" />
                        <p className="unlocked-title">MANUAL CONTROLS UNLOCKED</p>
                        <p className="unlocked-desc">All actions are recorded. Algorithmic protection disabled. Exercise extreme caution.</p>

                        <div className="bypass-actions" style={{ marginTop: 'var(--sp-6)' }}>
                            <button className="btn critical-btn">
                                <Octagon size={14} /> Execute Manual Stop
                            </button>
                            <button onClick={cancelOverride} className="btn">
                                <Activity size={14} /> Restore Auto-Pilot
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmotionGuard;
