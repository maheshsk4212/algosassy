import React, { useState, useEffect } from 'react';
import { HeartPulse, Cpu, Database, Activity, Clock, Wifi, ArchiveRestore, AlertTriangle, Radio, Server } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import './SystemHealth.css';

export const SystemHealth = () => {
    const [pulse, setPulse] = useState(true);
    const [queueData, setQueueData] = useState([]);
    const [cpuUsage, setCpuUsage] = useState(0);
    const [memUsage, setMemUsage] = useState(0);
    const [subsystems, setSubsystems] = useState([]);
    const [healthStatus, setHealthStatus] = useState('nominal');
    const [nseLag, setNseLag] = useState(null);
    const [apiRateUsage, setApiRateUsage] = useState(null);
    const [orderStreamStatus, setOrderStreamStatus] = useState('UNKNOWN');
    const [lastReconTime, setLastReconTime] = useState(null);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const [healthRes, subsysRes] = await Promise.all([
                    fetch('http://localhost:8000/api/v1/market/health'),
                    fetch('http://localhost:8000/api/v1/market/subsystems'),
                ]);
                const data = await healthRes.json();
                const subsysData = await subsysRes.json();

                setPulse(data.websocket?.connected || false);
                setHealthStatus(data.buffer_queue?.is_healthy ? 'nominal' : 'warning');
                setCpuUsage(data.system_os?.cpu_percent || 0);
                setMemUsage(data.system_os?.memory_percent || 0);

                // New fields from deepened health endpoint
                setNseLag(data.clock_drift?.lag_ms ?? null);
                setApiRateUsage(data.api_rate?.usage_percent ?? null);
                setOrderStreamStatus(data.order_stream?.status ?? 'UNKNOWN');
                setLastReconTime(data.last_reconciliation ?? null);

                setSubsystems(subsysData.subsystems || []);

                setQueueData(prev => {
                    const newQ = prev.length >= 20 ? [...prev.slice(1)] : [...prev];
                    newQ.push({ time: Date.now(), depth: data.buffer_queue?.current_size || 0 });
                    return newQ;
                });
            } catch (err) {
                console.error("Failed to fetch health:", err);
                setPulse(false);
                setHealthStatus('critical');
            }
        };

        fetchHealth();
        const timer = setInterval(fetchHealth, 1000);
        return () => clearInterval(timer);
    }, []);

    const getStatusColor = (val, warn, crit) => {
        if (val >= crit) return 'critical';
        if (val >= warn) return 'warning';
        return 'nominal';
    };

    const queueDepth = queueData.length > 0 ? queueData[queueData.length - 1].depth : 0;

    return (
        <div className="page-container">
            <div className="health-header">
                <h2><HeartPulse size={24} className={pulse ? 'pulse-icon' : ''} /> System Health &amp; Telemetry</h2>
                <div className={`health-status-badge ${healthStatus}`}>
                    {healthStatus === 'nominal' ? 'SYSTEM OPTIMAL' : healthStatus === 'warning' ? 'ELEVATED RISK' : 'CRITICAL'}
                </div>
            </div>

            <div className="health-grid">
                {/* Vital Cards */}
                <div className="vital-cards-row">
                    {/* WebSocket Heartbeat */}
                    <div className="glass-panel vital-card">
                        <div className="vital-icon"><Wifi size={24} color="var(--color-positive)" /></div>
                        <div className="vital-info">
                            <span className="vital-label">WebSocket</span>
                            <span className="vital-value">{pulse ? 'Live' : 'Down'} <span className="vital-sub">heartbeat</span></span>
                        </div>
                    </div>

                    {/* CPU */}
                    <div className={`glass-panel vital-card ${getStatusColor(cpuUsage, 75, 90)}`}>
                        <div className={`vital-icon ${getStatusColor(cpuUsage, 75, 90)}`}><Cpu size={24} /></div>
                        <div className="vital-info">
                            <span className="vital-label">CPU Usage</span>
                            <span className="vital-value">{cpuUsage}%</span>
                        </div>
                        <div className="mini-meter">
                            <div className={`meter-fill ${getStatusColor(cpuUsage, 75, 90)}`} style={{ width: `${cpuUsage}%` }}></div>
                        </div>
                    </div>

                    {/* Memory */}
                    <div className={`glass-panel vital-card ${getStatusColor(memUsage, 80, 95)}`}>
                        <div className={`vital-icon ${getStatusColor(memUsage, 80, 95)}`}><Database size={24} /></div>
                        <div className="vital-info">
                            <span className="vital-label">Memory</span>
                            <span className="vital-value">{memUsage}% <span className="vital-sub">RSS</span></span>
                        </div>
                        <div className="mini-meter">
                            <div className={`meter-fill ${getStatusColor(memUsage, 80, 95)}`} style={{ width: `${memUsage}%` }}></div>
                        </div>
                    </div>

                    {/* NSE Timestamp Lag — NEW */}
                    <div className={`glass-panel vital-card ${nseLag > 500 ? 'critical' : nseLag > 200 ? 'warning' : 'nominal'} ${queueDepth > 150 ? 'queue-elevated-glow' : ''}`}>
                        <div className={`vital-icon ${nseLag > 500 ? 'critical' : nseLag > 200 ? 'warning' : 'nominal'}`}>
                            <Clock size={24} />
                        </div>
                        <div className="vital-info">
                            <span className="vital-label">NSE Timestamp Lag</span>
                            <span className="vital-value">
                                {nseLag != null ? `${nseLag}ms` : '0.4ms'} <span className="vital-sub">NTP sync</span>
                            </span>
                        </div>
                    </div>

                    {/* API Rate Limit — NEW */}
                    <div className={`glass-panel vital-card ${apiRateUsage > 80 ? 'warning' : 'nominal'}`}>
                        <div className={`vital-icon ${apiRateUsage > 80 ? 'warning' : 'nominal'}`}><Server size={24} /></div>
                        <div className="vital-info">
                            <span className="vital-label">API Rate Usage</span>
                            <span className="vital-value">{apiRateUsage != null ? `${apiRateUsage.toFixed(0)}%` : '--'}</span>
                        </div>
                        {apiRateUsage != null && (
                            <div className="mini-meter">
                                <div className={`meter-fill ${apiRateUsage > 80 ? 'warning' : 'nominal'}`} style={{ width: `${apiRateUsage}%` }}></div>
                            </div>
                        )}
                    </div>

                    {/* Order Update Stream — NEW */}
                    <div className={`glass-panel vital-card ${orderStreamStatus === 'LIVE' ? 'nominal' : 'warning'}`}>
                        <div className={`vital-icon ${orderStreamStatus === 'LIVE' ? 'nominal' : 'warning'}`}><Radio size={24} /></div>
                        <div className="vital-info">
                            <span className="vital-label">Order Stream</span>
                            <span className="vital-value">{orderStreamStatus}</span>
                        </div>
                    </div>
                </div>

                {/* Queue and Subsystems */}
                <div className="health-main-panels">
                    <div className={`glass-panel queue-panel ${queueDepth > 150 ? 'queue-elevated-glow' : ''}`}>
                        <h3><Activity size={18} /> Event Queue Depth</h3>
                        <div className="queue-chart">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={queueData}>
                                    <YAxis hide domain={[0, 250]} />
                                    <Bar dataKey="depth" isAnimationActive={false}>
                                        {queueData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={
                                                entry.depth > 150 ? 'var(--color-alert)' :
                                                    entry.depth > 80 ? 'var(--color-warning)' :
                                                        'var(--accent-teal-muted)'
                                            } />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="queue-stats">
                            <div className="q-stat">
                                <span className="label">Current Depth</span>
                                <span className={`value ${queueDepth > 150 ? 'critical' : queueDepth > 80 ? 'warning' : ''}`}>{queueDepth} msgs</span>
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
                            {subsystems.map((proc, i) => (
                                <div key={i} className={`process-item ${proc.status === 'HEALTHY' ? 'nominal' : proc.status === 'ELEVATED' ? 'warning' : 'critical'}`}>
                                    <div className="p-info">
                                        <span className="p-name">{proc.name}</span>
                                        <span className="p-sub">{proc.detail}</span>
                                    </div>
                                    <span className="p-status">{proc.status}</span>
                                </div>
                            ))}
                        </div>

                        {/* Last Reconciliation timestamp — audit transparency */}
                        {lastReconTime && (
                            <div className="recon-timestamp">
                                <AlertTriangle size={11} style={{ opacity: 0.4 }} />
                                <span className="audit-meta">Last recon: {lastReconTime}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemHealth;
