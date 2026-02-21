import React, { useState, useEffect } from 'react';
import { Bell, Info } from 'lucide-react';

export const NotificationSettings = () => {
    const [config, setConfig] = useState({
        alertSound: true,
        desktopNotifications: true,
        emailDigest: false,
    });

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('sassy_notifications');
        if (saved) {
            try {
                setConfig(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse notifications config", e);
            }
        }
    }, []);

    const toggle = (key) => {
        const newConfig = { ...config, [key]: !config[key] };
        setConfig(newConfig);
        localStorage.setItem('sassy_notifications', JSON.stringify(newConfig));
    };

    return (
        <div className="glass-panel settings-section">
            <h3><Bell size={16} /> Notification Settings</h3>
            <div className="settings-fields">
                <ToggleRow
                    label="Alert Sound Effects"
                    checked={config.alertSound}
                    onChange={() => toggle('alertSound')}
                />
                <ToggleRow
                    label="Desktop Push Notifications"
                    checked={config.desktopNotifications}
                    onChange={() => toggle('desktopNotifications')}
                />
                <ToggleRow
                    label="Daily Email Digest"
                    checked={config.emailDigest}
                    onChange={() => toggle('emailDigest')}
                />
            </div>
            <div className="item-note" style={{ marginTop: 'var(--sp-2)', opacity: 0.7 }}>
                <Info size={14} /> Settings are persisted locally in your browser.
            </div>
        </div>
    );
};

const ToggleRow = ({ label, checked, onChange }) => (
    <div className="toggle-row">
        <span className="toggle-label">{label}</span>
        <div
            className={`toggle-switch ${checked ? 'on' : ''}`}
            onClick={onChange}
            role="switch"
            aria-checked={checked}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(); } }}
        >
            <div className="toggle-knob"></div>
        </div>
    </div>
);

export default NotificationSettings;
