import React from 'react';
import './DummyFeatures.css';

const ImageAnalysis: React.FC = () => {
    return (
        <section className="dummy-feature-section">
            <div className="dummy-feature-container">
                <div className="dummy-feature-header">
                    <h2 className="dummy-feature-title">Image Analysis</h2>
                    <p className="dummy-feature-subtitle">
                        Upload and analyze static imagery for comprehensive threat detection.
                    </p>
                </div>

                <div className="dummy-content-card">
                    <span className="dummy-badge">Coming in Phase 2</span>
                    <div className="dummy-icon">🖼️</div>
                    <h3>Static Image Evaluation</h3>
                    <p>
                        Integration for high-resolution image uploads is currently under development.
                        Soon, you will be able to perform instant analysis for objects, weapons, and fire hazards on standalone photos.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default ImageAnalysis;
