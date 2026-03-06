import React from 'react';

const Hero: React.FC = () => {
    return (
        <section className="hero-section">
            <div className="hero-content">
                <h1 className="hero-title">AI Video & Live Stream Analysis</h1>
                <p className="hero-subtitle">
                    Enhance security and safety across your organization with our state-of-the-art computer vision platform. Real-time threat detection at scale.
                </p>
                <div className="hero-actions">
                    <a href="#video-analysis" className="primary-btn">Start Analysis</a>
                    <a href="/live-stream" className="secondary-btn">Live Stream</a>
                </div>
            </div>
        </section>
    );
};

export default Hero;
