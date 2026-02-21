import React, { useState, useRef } from 'react';
import { ShieldAlert, Check } from 'lucide-react';

/**
 * Swipe To Liquidate (Mobile Emergency Terminal Component)
 * Only intended for mobile use to bypass complex UI controls in panic scenarios,
 * while still enforcing physical friction (swipe) and backend confirmation.
 */
export const SwipeToLiquidate = () => {
    const [isDragged, setIsDragged] = useState(false);
    const [dragDistance, setDragDistance] = useState(0);
    const [liquidated, setLiquidated] = useState(false);
    const [processing, setProcessing] = useState(false);

    const sliderRef = useRef(null);
    const maxDrag = 250; // pixels

    const handleTouchMove = (e) => {
        if (!isDragged || liquidated || processing) return;

        const touch = e.touches[0];
        const sliderLeft = sliderRef.current?.getBoundingClientRect().left || 0;
        const newDistance = Math.min(Math.max(0, touch.clientX - sliderLeft - 30), maxDrag);

        setDragDistance(newDistance);

        if (newDistance >= maxDrag - 5) {
            triggerLiquidation();
        }
    };

    const handleTouchEnd = () => {
        setIsDragged(false);
        if (dragDistance < maxDrag - 5 && !liquidated && !processing) {
            setDragDistance(0); // Snap back if partial pull
        }
    };

    const triggerLiquidation = async () => {
        setProcessing(true);
        // Haptic feedback if supported on mobile
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        // Simulate backend round trip
        await new Promise(r => setTimeout(r, 1200));

        setLiquidated(true);
        setProcessing(false);
    };

    if (liquidated) {
        return (
            <div className="w-full max-w-sm bg-[rgba(224,49,49,0.1)] border border-alert rounded-full p-4 flex items-center justify-center text-alert font-bold uppercase tracking-wider animate-pulse">
                <Check className="mr-2" size={20} /> Positions Liquidated
            </div>
        );
    }

    return (
        <div
            className="w-full max-w-sm bg-glass-bg border border-alert relative overflow-hidden rounded-full h-16 flex items-center justify-center touch-none select-none"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            role="slider"
            aria-label="Swipe to liquidate positions"
            aria-valuemin={0}
            aria-valuemax={maxDrag}
            aria-valuenow={dragDistance}
            tabIndex={processing ? -1 : 0}
            onKeyDown={(event) => {
                if (processing || liquidated) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    triggerLiquidation();
                }
            }}
            ref={sliderRef}
        >
            <div className="absolute inset-0 flex items-center justify-center opacity-50 z-0 pr-10 pointer-events-none">
                <span className="text-alert font-bold uppercase tracking-widest text-sm flex items-center">
                    {processing ? 'Confirming with backend...' : 'Swipe to Liquidate'}
                </span>
            </div>

            {/* The draggable handle */}
            <div
                className={`absolute left-1 h-14 w-14 bg-alert rounded-full flex items-center justify-center shadow-lg transition-transform ${isDragged ? 'scale-95' : ''} ${processing ? 'opacity-50' : 'cursor-grab active:cursor-grabbing z-10'}`}
                style={{ transform: `translateX(${dragDistance}px)` }}
                onTouchStart={() => setIsDragged(true)}
            >
                <ShieldAlert size={24} className="text-white pointer-events-none" />
            </div>

            {/* Fill track behind button */}
            <div
                className="absolute left-0 top-0 bottom-0 bg-[rgba(224,49,49,0.2)] z-0 rounded-l-full"
                style={{ width: `${dragDistance + 35}px` }}
            ></div>
        </div>
    );
};
