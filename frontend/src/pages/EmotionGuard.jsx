import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, Timer } from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';

/**
 * Emotion Guard UI
 * Enforces high-friction design for manual overrides. 
 * Requires cooldowns and admin unlocking before manual intervention is allowed.
 */
export const EmotionGuard = () => {
    const [overrideState, setOverrideState] = useState('LOCKED'); // LOCKED -> COOLDOWN -> UNLOCKED
    const [cooldown, setCooldown] = useState(30); // 30 second penalty
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
        <div className="flex flex-col gap-6 max-w-[800px]">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,0,0,0.2)]">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-alert">Emotion Guard Intercept</h2>
                    <p className="text-sm text-text-muted mt-1">Manual trading overrides have been intercepted by the governance engine.</p>
                </div>
            </div>

            <div className="glass-panel border-alert bg-[rgba(224,49,49,0.05)] p-6">
                <h3 className="text-sm font-medium text-alert uppercase tracking-wider flex items-center gap-2 mb-4">
                    <ShieldAlert size={16} /> Containment Protocol Active
                </h3>

                <div className="flex flex-col gap-4 text-sm text-text-secondary">
                    <p>
                        You are attempting to manually override an algorithmic position. Statistical probability of
                        manual outperformance over the vector model is <strong className="text-loss">negative.</strong>
                    </p>
                    <p>
                        Standard operating procedure dictates that you allow the system to reach its
                        defined stop-loss or regime shift parameters dynamically. Check the <strong>Risk Control</strong> panel
                        if macro factors have shifted.
                    </p>
                </div>
            </div>

            <div className="glass-panel p-6 flex flex-col gap-5 border border-glass-border opacity-90">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-2">Request Admin Unlock</h3>

                {overrideState === 'LOCKED' && (
                    <div className="flex flex-col gap-4">
                        <label className="flex flex-col gap-2 relative">
                            <span className="text-sm text-text-muted">Intervention Reason (Logged)</span>
                            <textarea
                                className="bg-[rgba(255,255,255,0.05)] border border-glass-border rounded-md px-3 py-2 text-white font-mono focus:border-profit outline-none h-24 resize-none"
                                placeholder="State your thesis for overriding the algorithmic containment..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                            />
                        </label>

                        <div className="flex justify-end gap-4 mt-2">
                            <button className="base-button text-xs" disabled>
                                Contact Risk Officer (Unavailable)
                            </button>
                            <button
                                className="base-button !text-alert !border-alert"
                                disabled={!reason.trim()}
                                onClick={requestOverride}
                            >
                                Initiate Bypass Cooldown
                            </button>
                        </div>
                    </div>
                )}

                {overrideState === 'COOLDOWN' && (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted gap-4">
                        <Timer size={48} className="text-warning animate-pulse" />
                        <div className="text-2xl font-mono text-warning font-bold">
                            {cooldown}s
                        </div>
                        <p className="text-sm">Mandatory reflection period before manual controls engage.</p>
                        <button onClick={cancelOverride} className="base-button mt-4">Abort Intent</button>
                    </div>
                )}

                {overrideState === 'UNLOCKED' && (
                    <div className="flex flex-col items-center justify-center p-6 text-center border border-alert bg-[rgba(224,49,49,0.05)] rounded">
                        <Lock size={32} className="text-alert mb-4" />
                        <p className="text-alert font-bold uppercase tracking-wider">MANUAL CONTROLS UNLOCKED</p>
                        <p className="text-sm text-text-muted mt-2">All actions are recorded. Algorithmic protection disabled.</p>

                        <div className="flex gap-4 mt-6">
                            <button className="base-button !bg-alert !text-white !border-alert font-bold shadow-lg">
                                Execute Manual Stop
                            </button>
                            <button onClick={cancelOverride} className="base-button">
                                Restore Auto-Pilot
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
