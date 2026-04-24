import React from 'react';
import { Link } from 'react-router-dom';

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
                    <Link to="/live-stream" className="secondary-btn">Live Stream</Link>
                </div>
            </div>
        </section>
    );
};

export default Hero;
