import React, { useState, useEffect } from 'react';
import { Shield, AlertOctagon, Lock, FileText, Ban } from 'lucide-react';
import './EmotionGuard.css';

export const EmotionGuardOverlay = ({ isTriggered, triggerReason, cooldownSeconds, onCooldownComplete }) => {
    const [timeLeft, setTimeLeft] = useState(cooldownSeconds);

    useEffect(() => {
        if (!isTriggered) return;

        setTimeLeft(cooldownSeconds);
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onCooldownComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isTriggered, cooldownSeconds]);

    if (!isTriggered) return null;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <div className="emotion-guard-backdrop">
            <div className="glass-panel guard-modal">
                <div className="guard-header">
                    <AlertOctagon size={48} className="critical-icon pulse" />
                    <h2>Emotion Guard Triggered</h2>
                </div>

                <div className="guard-body">
                    <p className="guard-reason">
                        <strong>Trigger: </strong> {triggerReason}
                    </p>
                    <p className="guard-desc">
                        System has detected a potential emotional intervention. All manual controls are locked. Strategy modifications are frozen.
                    </p>

                    <div className="cooldown-box">
                        <Lock size={24} />
                        <span className="cooldown-timer">
                            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                        </span>
                        <span className="cooldown-label">Mandatory Cooldown Remaining</span>
                    </div>

                    <div className="audit-log-preview">
                        <h4><FileText size={14} /> Audit Log Entry</h4>
                        <div className="log-entry">
                            <span className="log-time">{new Date().toLocaleTimeString()}</span>
                            <span className="log-msg">Manual override attempt blocked by Emotion Guard (Rule 42.b)</span>
                        </div>
                    </div>
                </div>

                <div className="guard-footer">
                    <Ban size={16} /> Parameter editing disabled during cooldown
                </div>
            </div>
        </div>
    );
};
