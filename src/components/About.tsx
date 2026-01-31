import React from 'react';

const About: React.FC = () => {
    return (
        <section className="about-section">
            <div className="about-container">
                <h2>Intelligent Surveillance for a Safer World</h2>

                <p>
                    AegisVision is a cutting-edge AI platform designed to transform how we monitor and analyze video feeds.
                    By leveraging advanced computer vision algorithms, we turn standard surveillance into proactive intelligent systems
                    capable of understanding complex environments in real-time.
                </p>

                <p>
                    In an era where security is paramount, relying solely on human monitoring can lead to fatigue and missed details.
                    Our technology ensures 24/7 vigilance, detecting abnormal behaviors, unauthorized access, and potential threats
                    the moment they occur, ensuring public safety and asset protection.
                </p>

                <p>
                    From live stream analysis to static image processing, AegisVision provides comprehensive incident detection
                    and automated reporting. This leads to faster response times, reduced operational costs, and a significant
                    improvement in overall safety standards for businesses and clear public spaces.
                </p>
            </div>
        </section>
    );
};

export default About;
