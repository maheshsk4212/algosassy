import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';

/**
 * StatefulToggle Component
 * Prevents optimistic UI updates. Only changes state when the backend confirms.
 */
export const StatefulToggle = ({
    initialState,
    onToggle,
    locked = false,
    lockReason = '',
    label
}) => {
    const [isProcessing, setIsProcessing] = useState(false);

    // The UI state deliberately ONLY reflects the prop provided by the parent
    // (which in a real app would be the confirmed backend state).
    // We do NOT update this locally on click.

    const handleClick = async () => {
        if (locked || isProcessing) return;

        setIsProcessing(true);
        try {
            // Send intent to backend
            await onToggle(!initialState);
            // We don't change local state here; we wait for the parent to re-render 
            // with the new initialState once the backend WebSocket confirms the change.
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex flex-col">
                <span className="text-body font-medium">{label}</span>
                {locked && lockReason && (
                    <span className="text-xs text-alert flex items-center gap-1 mt-1">
                        <Lock size={10} /> {lockReason}
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={handleClick}
                disabled={locked || isProcessing}
                role="switch"
                aria-label={label}
                aria-checked={initialState}
                aria-disabled={locked || isProcessing}
                className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${initialState ? 'bg-profit' : 'bg-[rgba(255,255,255,0.1)]'}
          ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
            >
                <span
                    className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${initialState ? 'translate-x-6' : 'translate-x-1'}
          `}
                />
                {isProcessing && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={12} className="animate-spin text-white drop-shadow-md" />
                    </span>
                )}
            </button>
        </div>
    );
};
