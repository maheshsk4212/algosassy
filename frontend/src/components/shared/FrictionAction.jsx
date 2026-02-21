import React, { useState, useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';

/**
 * FrictionAction Component
 * Enforces a mandatory delay and specific confirmation pattern for critical actions,
 * adhering to the "high friction" design principle.
 */
export const FrictionAction = ({
    onAction,
    children,
    actionText = "Apply",
    delayMs = 5000,
    disabled = false,
    requireConfirm = true,
    className = ''
}) => {
    const [stage, setStage] = useState('idle'); // idle -> confirming -> executing -> done
    const [timeLeft, setTimeLeft] = useState(delayMs / 1000);

    useEffect(() => {
        let timer;
        if (stage === 'confirming') {
            timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        executeAction();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [stage]);

    const initiateAction = () => {
        if (requireConfirm) {
            setStage('confirming');
            setTimeLeft(delayMs / 1000);
        } else {
            executeAction();
        }
    };

    const cancelAction = () => {
        setStage('idle');
        setTimeLeft(delayMs / 1000);
    };

    const executeAction = async () => {
        setStage('executing');
        try {
            await onAction();
            setStage('done');
            // Reset after a short delay
            setTimeout(() => setStage('idle'), 2000);
        } catch (e) {
            console.error(e);
            setStage('idle');
        }
    };

    if (stage === 'confirming') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <span className="text-alert text-sm font-mono flex items-center gap-1">
                    <Lock size={14} /> Unlocking in {timeLeft}s
                </span>
                <button
                    onClick={cancelAction}
                    className="base-button !text-xs !py-1 !px-2 border-alert"
                >
                    Cancel
                </button>
            </div>
        );
    }

    if (stage === 'executing') {
        return (
            <button disabled className={`base-button ${className}`}>
                <Loader2 size={16} className="animate-spin" />
                Processing backend confirmation...
            </button>
        );
    }

    if (stage === 'done') {
        return (
            <button disabled className={`base-button !border-profit !text-profit ${className}`}>
                Confirmed
            </button>
        );
    }

    return (
        <button
            onClick={initiateAction}
            disabled={disabled}
            className={`base-button ${className}`}
        >
            {children || actionText}
        </button>
    );
};
