import React from 'react';
import './DummyFeatures.css';

const IncidentDetection: React.FC = () => {
    return (
        <section className="dummy-feature-section">
            <div className="dummy-feature-container" style={{ maxWidth: '1200px' }}>
                <div className="dummy-feature-header" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '1rem' }}>
                        <h2 className="dummy-feature-title" style={{ margin: 0 }}>Incident Detection</h2>
                        <span className="dummy-badge" style={{ margin: 0 }}>Phase 2 Preview</span>
                    </div>
                    <p className="dummy-feature-subtitle">
                        Advanced tracking and anomaly recognition to identify security incidents autonomously. <em>(Mockup Demonstration)</em>
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
                    {/* Left: Video Area */}
                    <div className="dummy-content-card" style={{ flex: 2, padding: '20px', minWidth: '400px', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '10px', marginBottom: '15px' }}>
                            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Live Tracking View</h3>
                            <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>● REC</span>
                        </div>

                        <div style={{
                            background: '#000',
                            borderRadius: '8px',
                            aspectRatio: '16/9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '1px solid var(--surface-border)'
                        }}>
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'radial-gradient(circle, #334155 0%, #020617 100%)',
                                opacity: 0.8
                            }} />
                            <div style={{ position: 'relative', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎥</div>
                                <div>Multiple Object Tracking Model Placeholder</div>
                            </div>

                            {/* Tracking Trajectory Line */}
                            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                <path d="M 100 300 Q 250 250 400 350 T 700 200" fill="none" stroke="var(--accent-color)" strokeWidth="3" strokeDasharray="5,5" className="trajectory-path" />
                            </svg>
                        </div>
                    </div>

                    {/* Right: Incident Feed */}
                    <div className="dummy-content-card" style={{ flex: 1, padding: '20px', minWidth: '300px', alignItems: 'stretch', justifyContent: 'flex-start' }}>
                        <h3 style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '10px', marginBottom: '15px', fontSize: '1.2rem', textAlign: 'left' }}>Incident Feed</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                            {[
                                { time: '11:32:04', type: 'Loitering', conf: '89%', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' },
                                { time: '11:28:15', type: 'Unauthorized Access', conf: '94%', color: 'var(--error)', bg: 'rgba(239, 68, 68, 0.1)' },
                                { time: '11:15:02', type: 'Package Left', conf: '81%', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' },
                                { time: '11:02:40', type: 'Crowd Gathering', conf: '75%', color: 'var(--accent-color)', bg: 'rgba(20, 184, 166, 0.1)' }
                            ].map((inc, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-color)', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${inc.color}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inc.type}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{inc.time}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cam: Main-Lobby</span>
                                        <span style={{ background: inc.bg, color: inc.color, padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{inc.conf} Match</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button style={{ marginTop: '20px', background: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)', padding: '10px', borderRadius: '8px', cursor: 'not-allowed', width: '100%', transition: 'all 0.3s' }}>
                            View Full History
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IncidentDetection;
