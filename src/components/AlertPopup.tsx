import React, { useEffect } from 'react';
import './AlertPopup.css';

export interface AlertData {
    id: string; // unique ID for React keys
    type: string;
    level: number;
    timestamp: number;
    confidence: number;
    details?: string;
}

interface AlertPopupProps {
    alert: AlertData;
    onDismiss: (id: string) => void;
}

const AlertPopup: React.FC<AlertPopupProps> = ({ alert, onDismiss }) => {
    // Auto-dismiss after 8 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(alert.id);
        }, 8000);
        return () => clearTimeout(timer);
    }, [alert.id, onDismiss]);

    return (
        <div className={`alert-popup level-${alert.level}`}>
            <div className="alert-content">
                <div className="alert-header">
                    <span className="alert-label">{alert.type.replace(/_/g, ' ')}</span>
                    <span className="alert-time">{alert.timestamp.toFixed(1)}s</span>
                </div>
                <div className="alert-details">
                    Confidence: {(alert.confidence * 100).toFixed(0)}%
                    {alert.details && ` | ${alert.details}`}
                </div>
            </div>
            <button className="alert-close" onClick={() => onDismiss(alert.id)}>
                &times;
            </button>
        </div>
    );
};

interface AlertContainerProps {
    alerts: AlertData[];
    onDismiss: (id: string) => void;
}

export const AlertContainer: React.FC<AlertContainerProps> = ({ alerts, onDismiss }) => {
    return (
        <div className="alert-popup-container">
            {alerts.map(alert => (
                <AlertPopup key={alert.id} alert={alert} onDismiss={onDismiss} />
            ))}
        </div>
    );
};
