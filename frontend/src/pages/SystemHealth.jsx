import React, { useState, useEffect } from 'react';
import { HeartPulse, Cpu, Database, Activity, Clock, Wifi, ArchiveRestore } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import './SystemHealth.css';

const generateQueueData = () => Array.from({ length: 20 }, (_, i) => ({
    time: i,
    depth: Math.floor(Math.random() * 50) + (Math.random() > 0.8 ? 150 : 0) // Occasional spikes
}));

export const SystemHealth = () => {
    const [pulse, setPulse] = useState(true);
    const [queueData, setQueueData] = useState(generateQueueData());
    const [cpuUsage, setCpuUsage] = useState(42);
    const [memUsage, setMemUsage] = useState(68);

    useEffect(() => {
        // Simulate heartbeats and live metric updates
        const timer = setInterval(() => {
            setPulse(p => !p);
            setQueueData(generateQueueData());
            setCpuUsage(Math.floor(40 + Math.random() * 15));
            setMemUsage(Math.floor(65 + Math.random() * 5));
        }, 2000);
        return () => clearInterval(timer);
    }, []);

    const getStatusColor = (val, warn, crit) => {
        if (val >= crit) return 'critical';
        if (val >= warn) return 'warning';
        return 'nominal';
    };

    return (
        <div className="health-container">
            <div className="health-header">
                <h2><HeartPulse size={24} className={pulse ? 'pulse-icon' : ''} /> System Health & Telemetry</h2>
                <div className="health-status-badge nominal">
                    SYSTEM OPTIMAL
                </div>
            </div>

            <div className="health-grid">
                {/* Top level global vitals */}
                <div className="vital-cards-row">
                    <div className="glass-panel vital-card">
                        <div className="vital-icon"><Wifi size={24} color="var(--accent-positive)" /></div>
                        <div className="vital-info">
                            <span className="vital-label">WebSocket Heartbeat</span>
                            <span className="vital-value">12ms <span className="vital-sub">ping</span></span>
                        </div>
                    </div>
                    <div className="glass-panel vital-card">
                        <div className={`vital-icon ${getStatusColor(cpuUsage, 75, 90)}`}><Cpu size={24} /></div>
                        <div className="vital-info">
                            <span className="vital-label">CPU Usage</span>
                            <span className="vital-value">{cpuUsage}%</span>
                        </div>
                        <div className="mini-meter">
                            <div className={`meter-fill ${getStatusColor(cpuUsage, 75, 90)}`} style={{ width: `${cpuUsage}%` }}></div>
                        </div>
                    </div>
                    <div className="glass-panel vital-card">
                        <div className={`vital-icon ${getStatusColor(memUsage, 80, 95)}`}><Database size={24} /></div>
                        <div className="vital-info">
                            <span className="vital-label">Memory Allocation</span>
                            <span className="vital-value">{memUsage}% <span className="vital-sub">12.4 GB</span></span>
                        </div>
                        <div className="mini-meter">
                            <div className={`meter-fill ${getStatusColor(memUsage, 80, 95)}`} style={{ width: `${memUsage}%` }}></div>
                        </div>
                    </div>
                    <div className="glass-panel vital-card">
                        <div className="vital-icon nominal"><Clock size={24} /></div>
                        <div className="vital-info">
                            <span className="vital-label">Clock Drift</span>
                            <span className="vital-value">0.4ms <span className="vital-sub">NTP Synced</span></span>
                        </div>
                    </div>
                </div>

                {/* Queue and DB details */}
                <div className="health-main-panels">
                    <div className="glass-panel queue-panel">
                        <h3><Activity size={18} /> Event Queue Depth</h3>
                        <div className="queue-chart">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={queueData}>
                                    <YAxis hide domain={[0, 250]} />
                                    <Bar dataKey="depth" isAnimationActive={false}>
                                        {queueData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={
                                                entry.depth > 150 ? 'var(--accent-negative)' :
                                                    entry.depth > 80 ? 'var(--accent-warning)' :
                                                        'var(--accent-info)'
                                            } />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="queue-stats">
                            <div className="q-stat">
                                <span className="label">Current Depth</span>
                                <span className="value">14 msgs</span>
                            </div>
                            <div className="q-stat">
                                <span className="label">Processing Rate</span>
                                <span className="value">4.2k / sec</span>
                            </div>
                            <div className="q-stat">
                                <span className="label">Peak (1hr)</span>
                                <span className="value warning">184 msgs</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel processes-panel">
                        <h3><ArchiveRestore size={18} /> Subsystem Status</h3>
                        <div className="process-list">
                            <div className="process-item nominal">
                                <div className="p-info">
                                    <span className="p-name">Reconciliation Engine</span>
                                    <span className="p-sub">Last sync: 1.2s ago</span>
                                </div>
                                <span className="p-status">HEALTHY</span>
                            </div>
                            <div className="process-item warning">
                                <div className="p-info">
                                    <span className="p-name">Reservation Queue</span>
                                    <span className="p-sub">7 orders pending capital lock</span>
                                </div>
                                <span className="p-status">ELEVATED</span>
                            </div>
                            <div className="process-item nominal">
                                <div className="p-info">
                                    <span className="p-name">Tick Data Recorder</span>
                                    <span className="p-sub">Writing 1.2MB/s to disk</span>
                                </div>
                                <span className="p-status">HEALTHY</span>
                            </div>
                            <div className="process-item nominal">
                                <div className="p-info">
                                    <span className="p-name">Drift Monitor</span>
                                    <span className="p-sub">Evaluating 40 strategies/s</span>
                                </div>
                                <span className="p-status">HEALTHY</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemHealth;
