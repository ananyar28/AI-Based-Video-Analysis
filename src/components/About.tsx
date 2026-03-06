import React from 'react';

const About: React.FC = () => {
    return (
        <section className="about-section">
            <div className="about-container">
                <div className="about-text">
                    <h2>Intelligent Surveillance for a Safer World</h2>
                    <p>
                        AegisVision is a cutting-edge AI platform designed to transform how we monitor and analyze video feeds. 
                        By leveraging advanced computer vision algorithms, we turn standard surveillance into proactive intelligent systems.
                    </p>
                    <p>
                        In an era where security is paramount, our technology ensures 24/7 vigilance, detecting abnormal behaviors, 
                        unauthorized access, and potential threats the moment they occur.
                    </p>
                </div>
                <div className="about-card">
                    <h3>Comprehensive Threat Detection</h3>
                    <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>
                        From live stream processing to static media analysis, AegisVision provides automated reporting and instant 
                        threat identification (weapons, fire, unauthorized objects) leading to robust public safety and asset protection.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default About;
