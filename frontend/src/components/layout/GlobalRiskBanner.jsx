import React from 'react';
import { Shield, TrendingDown, Activity, Zap, Play } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';

/**
 * Global Risk Banner
 * Strictly enforces "Critical metrics always visible" and specific color guidelines.
 * Sticky at the top of the interface.
 */
export const GlobalRiskBanner = () => {
    // In reality, this would consume a React Context or Global Store fed by WebSockets.
    // Mock mock backend state for UI implementation.
    const mockState = {
        tradingStatus: 'ACTIVE',
        killSwitchState: 'ARMED',
        driftStatus: 'NOMINAL',
        regimeState: 'BULL_VOL',
        globalRiskLevel: 'ELEVATED' // Or CRITICAL, NOMINAL
    };

    return (
        <div className="glass-panel sticky top-0 z-50 flex items-center justify-between px-6 py-3 rounded-none border-x-0 border-t-0 bg-[rgba(10,11,16,0.8)] backdrop-blur-xl">
            <div className="flex items-center gap-8">
                <div className="flex flex-col">
                    <span className="text-xs text-text-muted uppercase tracking-wider mb-1">Trading Status</span>
                    <div className="flex items-center gap-2 font-mono text-sm">
                        <Play size={14} className="text-profit" />
                        <span className="text-profit font-bold">{mockState.tradingStatus}</span>
                    </div>
                </div>

                <div className="w-px h-8 bg-glass-border"></div>

                <div className="flex flex-col">
                    <span className="text-xs text-text-muted uppercase tracking-wider mb-1">Regime / Drift</span>
                    <div className="flex items-center gap-3">
                        <StatusBadge status={mockState.regimeState} type="info" />
                        <StatusBadge status={mockState.driftStatus} type="profit" />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-8">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-text-muted uppercase tracking-wider mb-1">Global Risk Level</span>
                    <div className="flex items-center gap-2 font-mono text-sm font-bold">
                        {mockState.globalRiskLevel === 'CRITICAL' && <ShieldAlert size={14} className="text-alert" />}
                        {mockState.globalRiskLevel === 'ELEVATED' && <Shield size={14} className="text-warning text-[#F59E0B]" />}
                        {mockState.globalRiskLevel === 'NOMINAL' && <Shield size={14} className="text-profit" />}
                        <span className={`
              ${mockState.globalRiskLevel === 'CRITICAL' ? 'text-alert' : ''}
              ${mockState.globalRiskLevel === 'ELEVATED' ? 'text-[#F59E0B]' : ''}
              ${mockState.globalRiskLevel === 'NOMINAL' ? 'text-profit' : ''}
            `}>
                            {mockState.globalRiskLevel}
                        </span>
                    </div>
                </div>

                <div className="w-px h-8 bg-glass-border"></div>

                <div className="flex flex-col items-end">
                    <span className="text-xs text-text-muted uppercase tracking-wider mb-1">Kill Switch</span>
                    <StatusBadge status={mockState.killSwitchState} type={mockState.killSwitchState === 'TRIGGERED' ? 'alert' : 'profit'} />
                </div>
            </div>
        </div>
    );
};
