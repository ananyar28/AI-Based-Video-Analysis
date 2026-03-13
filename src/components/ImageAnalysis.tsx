import React from 'react';
import './DummyFeatures.css';

const ImageAnalysis: React.FC = () => {
    return (
        <section className="dummy-feature-section">
            <div className="dummy-feature-container" style={{ maxWidth: '1200px' }}>
                <div className="dummy-feature-header" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '1rem' }}>
                        <h2 className="dummy-feature-title" style={{ margin: 0 }}>Image Analysis</h2>
                        <span className="dummy-badge" style={{ margin: 0 }}>Phase 2 Preview</span>
                    </div>
                    <p className="dummy-feature-subtitle">
                        Upload and analyze static imagery for comprehensive threat detection. <em>(Mockup Demonstration)</em>
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
                    {/* Left: Upload / Image Preview */}
                    <div className="dummy-content-card" style={{ flex: 1, padding: '20px', minWidth: '300px', alignItems: 'stretch' }}>
                        <h3 style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.2rem', textAlign: 'left' }}>Source Image</h3>
                        <div style={{
                            background: 'var(--background-end)',
                            borderRadius: '8px',
                            height: '350px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '1px solid var(--surface-border)'
                        }}>
                            {/* Dummy Image Background */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(45deg, #1e293b 25%, #0f172a 25%, #0f172a 50%, #1e293b 50%, #1e293b 75%, #0f172a 75%, #0f172a 100%)',
                                backgroundSize: '20px 20px', opacity: 0.5
                            }} />

                            <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-muted)' }}>airport_terminal_gate4.jpg</span>

                            {/* Dummy Bounding Boxes */}
                            <div style={{ position: 'absolute', top: '30%', left: '40%', width: '15%', height: '40%', border: '2px solid var(--error)', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', zIndex: 2 }}>
                                <span style={{ position: 'absolute', top: '-20px', left: '-2px', background: 'var(--error)', color: 'white', fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }}>Weapon 88%</span>
                            </div>

                            <div style={{ position: 'absolute', top: '50%', left: '70%', width: '20%', height: '30%', border: '2px solid var(--success)', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', zIndex: 2 }}>
                                <span style={{ position: 'absolute', top: '-20px', left: '-2px', background: 'var(--success)', color: 'white', fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }}>Luggage 95%</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Analysis Results */}
                    <div className="dummy-content-card" style={{ flex: 1, padding: '20px', minWidth: '300px', alignItems: 'stretch', justifyContent: 'flex-start' }}>
                        <h3 style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.2rem', textAlign: 'left' }}>Analysis Report</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--error)' }}>1</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Critical Threats</div>
                            </div>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success)' }}>12</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Safe Objects</div>
                            </div>
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '0.9rem' }}>Detected Entities</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-color)', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                                    <span style={{ color: 'var(--error)', fontWeight: 600 }}>Weapon Det.</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Conf: 88%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-color)', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>Luggage</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Conf: 95%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-color)', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>Person</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Conf: 99%</span>
                                </div>
                            </div>
                        </div>

                        <button style={{ marginTop: 'auto', background: 'var(--surface-color)', color: 'var(--text-muted)', border: '1px dashed var(--surface-border)', padding: '12px', borderRadius: '8px', cursor: 'not-allowed', width: '100%' }}>
                            Export PDF Report (Disabled)
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ImageAnalysis;
