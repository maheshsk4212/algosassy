import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Filter, Download, Search, AlertTriangle, Activity, ShieldAlert, Info, Zap, Trash2 } from 'lucide-react';
import { apiUrl } from '../config/api';
import './AuditLog.css';

const CATEGORY_ICONS = {
    risk: <ShieldAlert size={13} />,
    trade: <Activity size={13} />,
    system: <Info size={13} />,
    alert: <AlertTriangle size={13} />,
    order: <Zap size={13} />,
};

const CATEGORY_COLORS = {
    risk: 'cat-risk',
    trade: 'cat-trade',
    system: 'cat-system',
    alert: 'cat-alert',
    order: 'cat-order',
};

export const AuditLogPage = () => {
    const [logs, setLogs] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch(apiUrl('/api/v1/audit/logs'));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setLogs(data.events || []);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        if (!autoRefresh) return;
        const t = setInterval(fetchLogs, 3000);
        return () => clearInterval(t);
    }, [fetchLogs, autoRefresh]);

    // Apply filter + search
    useEffect(() => {
        let result = logs;
        if (activeFilter !== 'all') {
            result = result.filter(e => e.category === activeFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(e =>
                e.message?.toLowerCase().includes(q) ||
                e.category?.toLowerCase().includes(q)
            );
        }
        setFiltered(result);
    }, [logs, activeFilter, search]);

    const handleExport = () => {
        const csv = ['Timestamp,Category,Message',
            ...filtered.map(e => `"${e.timestamp_str}","${e.category}","${e.message?.replace(/"/g, '""') ?? ''}"`)
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const categories = ['all', ...Array.from(new Set(logs.map(e => e.category)))];

    return (
        <div className="page-container">
            <div className="audit-header">
                <h2><FileText size={20} /> Audit Logs</h2>
                <div className="audit-header-actions">
                    <button
                        className={`audit-btn-icon ${autoRefresh ? 'active' : ''}`}
                        onClick={() => setAutoRefresh(p => !p)}
                        title={autoRefresh ? 'Auto-refresh ON — click to pause' : 'Auto-refresh OFF — click to enable'}
                    >
                        <RefreshCw size={14} className={autoRefresh ? 'spin-slow' : ''} />
                        {autoRefresh ? 'Live' : 'Paused'}
                    </button>
                    <button className="audit-btn-icon" onClick={fetchLogs} title="Refresh now">
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button className="audit-btn-icon" onClick={handleExport} title="Export to CSV" disabled={filtered.length === 0}>
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filters + Search */}
            <div className="audit-toolbar">
                <div className="audit-filters">
                    <Filter size={13} />
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`filter-chip ${activeFilter === cat ? 'active' : ''} ${cat !== 'all' ? CATEGORY_COLORS[cat] || '' : ''}`}
                            onClick={() => setActiveFilter(cat)}
                        >
                            {cat !== 'all' && CATEGORY_ICONS[cat]}
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="audit-search">
                    <Search size={13} />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="audit-search-input"
                    />
                    {search && (
                        <button className="search-clear" onClick={() => setSearch('')}>
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Log Table */}
            <div className="glass-panel audit-table-wrap">
                {loading ? (
                    <div className="audit-empty">
                        <RefreshCw size={24} className="spin-slow" style={{ opacity: 0.4 }} />
                        <span>Loading audit log...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="audit-empty">
                        <FileText size={28} style={{ opacity: 0.3 }} />
                        <span>No log entries found{search ? ` matching "${search}"` : ''}.</span>
                        <span className="audit-empty-sub">Events are logged as the system processes orders, risk checks, and governance actions.</span>
                    </div>
                ) : (
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Category</th>
                                <th>Message</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((entry, i) => (
                                <tr key={i} className={`audit-row ${CATEGORY_COLORS[entry.category] || ''}`}>
                                    <td className="audit-time">{entry.timestamp_str}</td>
                                    <td>
                                        <span className={`cat-badge ${CATEGORY_COLORS[entry.category] || 'cat-system'}`}>
                                            {CATEGORY_ICONS[entry.category] || <Info size={13} />}
                                            {entry.category}
                                        </span>
                                    </td>
                                    <td className="audit-message">{entry.message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="audit-footer">
                Showing {filtered.length} of {logs.length} total events
                {autoRefresh && <span className="auto-refresh-dot"><span className="pulse-dot" /> Live</span>}
            </div>
        </div>
    );
};

export default AuditLogPage;
