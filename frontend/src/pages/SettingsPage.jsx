import React, { useState } from 'react';
import { Settings, Shield, Bell, Monitor, Database, Clock, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import './SettingsPage.css';

export const SettingsPage = () => {
    const [saved, setSaved] = useState(false);
    const [config, setConfig] = useState({
        renderFPS: '4',
        bufferMs: '250',
        maxDOMOrders: '50',
        theme: 'dark-glass',
        alertSound: true,
        desktopNotifications: true,
        emailDigest: false,
        emotionGuardCooldown: '300',
        killSwitchDoubleConfirm: true,
        autoReconcile: true,
        reconcileIntervalSec: '5',
        dataRetentionDays: '90',
    });

    const update = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handleReset = () => {
        setConfig({
            renderFPS: '4',
            bufferMs: '250',
            maxDOMOrders: '50',
            theme: 'dark-glass',
            alertSound: true,
            desktopNotifications: true,
            emailDigest: false,
            emotionGuardCooldown: '300',
            killSwitchDoubleConfirm: true,
            autoReconcile: true,
            reconcileIntervalSec: '5',
            dataRetentionDays: '90',
        });
        setSaved(false);
    };

    return (
        <div className="settings-page">
            <div className="section-header">
                <h2><Settings size={20} /> Settings</h2>
                <div className="settings-actions">
                    {saved && (
                        <span className="save-confirm"><CheckCircle2 size={14} /> Saved</span>
                    )}
                    <button className="btn" onClick={handleReset}><RotateCcw size={14} /> Reset Defaults</button>
                    <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Save Changes</button>
                </div>
            </div>

            <div className="settings-grid">
                {/* Performance */}
                <div className="glass-panel settings-section">
                    <h3><Monitor size={16} /> Performance &amp; Rendering</h3>
                    <div className="settings-fields">
                        <div className="form-group">
                            <label>Max Render FPS</label>
                            <input className="ui-input" type="number" value={config.renderFPS} onChange={e => update('renderFPS', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>WebSocket Buffer Interval (ms)</label>
                            <input className="ui-input" type="number" value={config.bufferMs} onChange={e => update('bufferMs', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Max DOM Order Rows</label>
                            <input className="ui-input" type="number" value={config.maxDOMOrders} onChange={e => update('maxDOMOrders', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Theme</label>
                            <select className="ui-select" value={config.theme} onChange={e => update('theme', e.target.value)}>
                                <option value="dark-glass">Dark Glass (Default)</option>
                                <option value="dark-flat">Dark Flat</option>
                                <option value="midnight">Midnight</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="glass-panel settings-section">
                    <h3><Bell size={16} /> Notifications</h3>
                    <div className="settings-fields">
                        <ToggleRow label="Alert Sound Effects" checked={config.alertSound} onChange={v => update('alertSound', v)} />
                        <ToggleRow label="Desktop Push Notifications" checked={config.desktopNotifications} onChange={v => update('desktopNotifications', v)} />
                        <ToggleRow label="Daily Email Digest" checked={config.emailDigest} onChange={v => update('emailDigest', v)} />
                    </div>
                </div>

                {/* Governance */}
                <div className="glass-panel settings-section">
                    <h3><Shield size={16} /> Governance &amp; Safety</h3>
                    <div className="settings-fields">
                        <div className="form-group">
                            <label>Emotion Guard Cooldown (seconds)</label>
                            <input className="ui-input" type="number" value={config.emotionGuardCooldown} onChange={e => update('emotionGuardCooldown', e.target.value)} />
                        </div>
                        <ToggleRow label="Kill Switch Double Confirm (Mobile)" checked={config.killSwitchDoubleConfirm} onChange={v => update('killSwitchDoubleConfirm', v)} />
                    </div>
                </div>

                {/* Data & Infra */}
                <div className="glass-panel settings-section">
                    <h3><Database size={16} /> Data &amp; Infrastructure</h3>
                    <div className="settings-fields">
                        <ToggleRow label="Auto Reconciliation" checked={config.autoReconcile} onChange={v => update('autoReconcile', v)} />
                        <div className="form-group">
                            <label>Reconciliation Interval (sec)</label>
                            <input className="ui-input" type="number" value={config.reconcileIntervalSec} onChange={e => update('reconcileIntervalSec', e.target.value)} disabled={!config.autoReconcile} />
                        </div>
                        <div className="form-group">
                            <label>Data Retention (days)</label>
                            <input className="ui-input" type="number" value={config.dataRetentionDays} onChange={e => update('dataRetentionDays', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ToggleRow = ({ label, checked, onChange }) => (
    <div className="toggle-row">
        <span className="toggle-label">{label}</span>
        <div className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
            <div className="toggle-knob"></div>
        </div>
    </div>
);

export default SettingsPage;
