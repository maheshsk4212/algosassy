import React, { useState, useEffect } from 'react';

// Status Badge Component
// Follows strict color policy (Muted Blue, Muted Gray, Bright Red)
export const StatusBadge = ({ status, type, className = '' }) => {
    // Map standard statuses to our rigid types
    const getTypeClass = () => {
        switch (type) {
            case 'profit':
            case 'positive':
            case 'active':
            case 'online':
                return 'profit';
            case 'loss':
            case 'negative':
            case 'inactive':
            case 'offline':
                return 'loss';
            case 'alert':
            case 'critical':
            case 'error':
            case 'killed':
                return 'alert';
            default:
                return 'loss'; // Default to muted gray if unknown
        }
    };

    return (
        <span className={`status-badge ${getTypeClass()} ${className}`}>
            {/* Optional dot indicator */}
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {status}
        </span>
    );
};
