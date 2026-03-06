import React from 'react';
import './DummyFeatures.css';

const IncidentDetection: React.FC = () => {
    return (
        <section className="dummy-feature-section">
            <div className="dummy-feature-container">
                <div className="dummy-feature-header">
                    <h2 className="dummy-feature-title">Incident Detection</h2>
                    <p className="dummy-feature-subtitle">
                        Advanced tracking and anomaly recognition to identify security incidents autonomously.
                    </p>
                </div>

                <div className="dummy-content-card">
                    <span className="dummy-badge">Coming in Phase 2</span>
                    <div className="dummy-icon">🔍</div>
                    <h3>Behavioral & Incident Tracking</h3>
                    <p>
                        Beyond simple object detection, this upcoming feature implements temporal tracking to understand context, identify suspicious behavior patterns, and classify complex security incidents.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default IncidentDetection;
