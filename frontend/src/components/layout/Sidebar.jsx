import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LineChart, Activity, ShieldAlert, ListTree, PieChart,
    FlaskConical, BarChart3, HeartPulse, ScrollText, Settings
} from 'lucide-react';

const NAV_ITEMS = [
    { path: '/', label: 'Overview', icon: <LineChart size={18} /> },
    { path: '/execution', label: 'Live Execution', icon: <Activity size={18} /> },
    { path: '/risk', label: 'Risk Control', icon: <ShieldAlert size={18} /> },
    { path: '/strategies', label: 'Strategies', icon: <ListTree size={18} /> },
    { path: '/portfolio', label: 'Portfolio', icon: <PieChart size={18} /> },
    { path: '/backtest', label: 'Backtest Lab', icon: <FlaskConical size={18} /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { path: '/health', label: 'System Health', icon: <HeartPulse size={18} /> },
    { path: '/audit', label: 'Audit Logs', icon: <ScrollText size={18} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export const Sidebar = () => {
    return (
        <nav className="glass-panel w-64 h-full flex flex-col pt-6 pb-4 shrink-0 rounded-none border-t-0 border-l-0 border-b-0">
            <div className="px-6 mb-8 flex items-center justify-between">
                <h1 className="text-xl font-bold tracking-tight text-text-primary uppercase">
                    Quant<span className="text-text-muted">Master</span>
                </h1>
                <div className="w-2 h-2 rounded-full bg-profit animate-pulse" style={{ animationDuration: '3s' }} title="Core Online"></div>
            </div>

            <div className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200
              ${isActive
                                ? 'bg-[rgba(255,255,255,0.08)] text-white font-medium border-l-2 border-l-profit'
                                : 'text-text-muted hover:text-white hover:bg-[rgba(255,255,255,0.04)] border-l-2 border-transparent'}
            `}
                    >
                        <span className="opacity-80">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
            </div>

            <div className="px-6 mt-4 pt-4 border-t border-glass-border">
                <div className="text-xs text-text-muted flex items-center gap-2">
                    <Activity size={12} className="text-profit" />
                    Latency: <span className="font-mono text-profit">12ms</span>
                </div>
            </div>
        </nav>
    );
};
