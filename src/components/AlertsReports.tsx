import React from 'react';
import './DummyFeatures.css';

const AlertsReports: React.FC = () => {
    return (
        <section className="dummy-feature-section">
            <div className="dummy-feature-container">
                <div className="dummy-feature-header">
                    <h2 className="dummy-feature-title">Alerts & Reports</h2>
                    <p className="dummy-feature-subtitle">
                        Comprehensive logging, analytics dashboards, and customizable notification rules.
                    </p>
                </div>

                <div className="dummy-content-card">
                    <span className="dummy-badge">Coming in Phase 2</span>
                    <div className="dummy-icon">📊</div>
                    <h3>Insights & Notification Center</h3>
                    <p>
                        Manage your security history through a rich analytics interface. Generate exportable reports, review historical alarm data, and configure webhooks or SMS alerts.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default AlertsReports;
