import React, { useState } from 'react';
import { Settings, Shield, Bell, Monitor, Database, Save, RotateCcw, CheckCircle2, Sun, Moon, Layers } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { NotificationSettings } from '../components/shared/NotificationSettings';
import { getAdminToken, setAdminToken } from '../config/admin';
import './SettingsPage.css';

const THEMES = [
    {
        value: 'dark-glass',
        label: 'Dark Glass',
        description: 'Deep space — default terminal look',
        preview: ['#06080d', '#1fc8e0', '#0b0e17'],
        icon: <Layers size={13} />,
    },
    {
        value: 'light',
        label: 'Light',
        description: 'Clean, high-contrast paper-white terminal',
        preview: ['#f0f2f5', '#0891b2', '#ffffff'],
        icon: <Sun size={13} />,
    },
    {
        value: 'midnight',
        label: 'Midnight',
        description: 'Pure black — true OLED dark mode',
        preview: ['#000000', '#06b6d4', '#101010'],
        icon: <Moon size={13} />,
    },
];

export const SettingsPage = () => {
    const { theme, setTheme } = useTheme();
    const [saved, setSaved] = useState(false);
    const [config, setConfig] = useState({
        renderFPS: '4',
        bufferMs: '250',
        maxDOMOrders: '50',
        alertSound: true,
        desktopNotifications: true,
        emailDigest: false,
        emotionGuardCooldown: '300',
        killSwitchDoubleConfirm: true,
        adminApiToken: getAdminToken(),
        autoReconcile: true,
        reconcileIntervalSec: '5',
        dataRetentionDays: '90',
    });

    const update = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        if (key === 'adminApiToken') {
            setAdminToken(value);
        }
        setSaved(false);
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handleReset = () => {
        setConfig({
            renderFPS: '4', bufferMs: '250', maxDOMOrders: '50',
            alertSound: true, desktopNotifications: true, emailDigest: false,
            emotionGuardCooldown: '300', killSwitchDoubleConfirm: true,
            adminApiToken: '',
            autoReconcile: true, reconcileIntervalSec: '5', dataRetentionDays: '90',
        });
        setAdminToken('');
        setTheme('dark-glass');
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
                {/* Performance & Rendering */}
                <div className="glass-panel settings-section">
                    <h3><Monitor size={16} /> Performance &amp; Rendering</h3>
                    <div className="settings-fields">
                        <div className="form-group">
                            <label>Max Render FPS</label>
                            <input className="ui-input" type="number" value={config.renderFPS}
                                onChange={e => update('renderFPS', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>WebSocket Buffer Interval (ms)</label>
                            <input className="ui-input" type="number" value={config.bufferMs}
                                onChange={e => update('bufferMs', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Max DOM Order Rows</label>
                            <input className="ui-input" type="number" value={config.maxDOMOrders}
                                onChange={e => update('maxDOMOrders', e.target.value)} />
                        </div>

                        {/* ── Theme Visual Picker ───────────────────── */}
                        <div className="form-group">
                            <label>Interface Theme</label>
                            <div className="theme-picker">
                                {THEMES.map(t => (
                                    <button
                                        key={t.value}
                                        className={`theme-card ${theme === t.value ? 'selected' : ''}`}
                                        onClick={() => setTheme(t.value)}
                                        title={t.description}
                                    >
                                        {/* Colour swatch preview */}
                                        <div className="theme-swatches">
                                            {t.preview.map((c, i) => (
                                                <span key={i} className="theme-swatch" style={{ background: c }} />
                                            ))}
                                        </div>
                                        <div className="theme-info">
                                            <span className="theme-icon">{t.icon}</span>
                                            <span className="theme-name">{t.label}</span>
                                        </div>
                                        {theme === t.value && (
                                            <CheckCircle2 size={12} className="theme-check" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <NotificationSettings />

                {/* Governance */}
                <div className="glass-panel settings-section">
                    <h3><Shield size={16} /> Governance &amp; Safety</h3>
                    <div className="settings-fields">
                        <div className="form-group">
                            <label>Emotion Guard Cooldown (seconds)</label>
                            <input className="ui-input" type="number" value={config.emotionGuardCooldown}
                                onChange={e => update('emotionGuardCooldown', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Admin API Token (for kill-switch/audit)</label>
                            <input
                                className="ui-input"
                                type="password"
                                autoComplete="off"
                                value={config.adminApiToken}
                                onChange={e => update('adminApiToken', e.target.value)}
                            />
                        </div>
                        <ToggleRow label="Kill Switch Double Confirm (Mobile)" checked={config.killSwitchDoubleConfirm} onChange={v => update('killSwitchDoubleConfirm', v)} />
                    </div>
                </div>

                {/* Data & Infrastructure */}
                <div className="glass-panel settings-section">
                    <h3><Database size={16} /> Data &amp; Infrastructure</h3>
                    <div className="settings-fields">
                        <ToggleRow label="Auto Reconciliation" checked={config.autoReconcile} onChange={v => update('autoReconcile', v)} />
                        <div className="form-group">
                            <label>Reconciliation Interval (sec)</label>
                            <input className="ui-input" type="number" value={config.reconcileIntervalSec}
                                onChange={e => update('reconcileIntervalSec', e.target.value)}
                                disabled={!config.autoReconcile} />
                        </div>
                        <div className="form-group">
                            <label>Data Retention (days)</label>
                            <input className="ui-input" type="number" value={config.dataRetentionDays}
                                onChange={e => update('dataRetentionDays', e.target.value)} />
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
        <div
            className={`toggle-switch ${checked ? 'on' : ''}`}
            onClick={() => onChange(!checked)}
            role="switch"
            aria-label={label}
            aria-checked={checked}
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onChange(!checked);
                }
            }}
        >
            <div className="toggle-knob"></div>
        </div>
    </div>
);

export default SettingsPage;
