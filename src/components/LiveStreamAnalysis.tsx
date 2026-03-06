import React, { useState, useRef, useEffect } from 'react';
import { startStream, stopStream, getStreamStatus, type StreamStatusResponse } from '../services/api';
import './VideoUpload.css'; // Reuse styles for consistency

const LiveStreamAnalysis: React.FC = () => {
    const [url, setUrl] = useState('');
    const [cameraId, setCameraId] = useState('');
    const [phase, setPhase] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [status, setStatus] = useState<StreamStatusResponse | null>(null);

    // Polling ref
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => stopPolling();
    }, []);

    const handleStart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        const id = cameraId || `cam-${Date.now()}`;
        if (!cameraId) setCameraId(id);

        setPhase('connecting');
        setErrorMsg('');

        try {
            await startStream(url, id, 5); // Target 5 FPS
            setPhase('streaming');

            // Poll status every 2 seconds
            pollRef.current = setInterval(async () => {
                try {
                    const st = await getStreamStatus(id);
                    setStatus(st);
                    if (!st.is_running) {
                        stopPolling();
                        setPhase('error');
                        setErrorMsg('Stream disconnected or stopped gracefully.');
                    }
                } catch (err: any) {
                    console.warn("Polling error", err);
                }
            }, 2000);

        } catch (err: any) {
            setPhase('error');
            setErrorMsg(err.message || 'Failed to connect to stream.');
        }
    };

    const handleStop = async () => {
        try {
            await stopStream(cameraId);
        } catch (err) {
            console.warn("Could not stop stream cleanly", err);
        }
        stopPolling();
        setPhase('idle');
        setStatus(null);
        setCameraId('');
        setUrl('');
    };

    return (
        <section className="video-upload-section">
            <div className="video-upload-container">
                <h2 className="section-title">Live Stream Analysis</h2>

                <div className="upload-layout">
                    {/* Left: Input Config */}
                    <div className="upload-card">
                        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Stream Configuration</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                        Enter an RTSP, HTTP(S) URL, or a local camera index (like `0` or `1`) to begin real-time analysis.
                                    </p>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Camera / Stream URL</label>
                                    <input
                                        type="text"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="e.g. rtsp://admin:12345@192.168.1.100:554/stream1"
                                        disabled={phase !== 'idle' && phase !== 'error'}
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}
                                        required
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Camera ID (Optional)</label>
                                    <input
                                        type="text"
                                        value={cameraId}
                                        onChange={(e) => setCameraId(e.target.value)}
                                        placeholder="e.g. front-door-cam"
                                        disabled={phase !== 'idle' && phase !== 'error'}
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>

                            <div>
                                {phase === 'idle' || phase === 'error' ? (
                                    <button type="submit" className="analyze-btn" style={{ width: '100%' }}>
                                        Connect & Analyze
                                    </button>
                                ) : (
                                    <button type="button" onClick={handleStop} className="analyze-btn" style={{ width: '100%', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--error)', color: 'var(--error)' }}>
                                        Stop Stream
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Right: Status Summary */}
                    <div className="summary-card">
                        <div className="summary-header">
                            <h3>Live Status</h3>
                            <span className={`status-badge ${phase === 'streaming' ? 'success' : phase === 'error' ? 'error' : ''}`}>
                                {phase === 'idle' && 'Disconnected'}
                                {phase === 'connecting' && 'Connecting...'}
                                {phase === 'streaming' && 'Live'}
                                {phase === 'error' && 'Error'}
                            </span>
                        </div>

                        <div className="summary-content">
                            {phase === 'idle' && (
                                <div className="empty-state">
                                    <p>Connect a camera to view real-time analysis health and statistics.</p>
                                </div>
                            )}

                            {phase === 'connecting' && (
                                <div className="pre-analysis-state">
                                    <p>Connecting to {url}...</p>
                                    <div className="spinner" />
                                </div>
                            )}

                            {phase === 'error' && (
                                <div className="pre-analysis-state">
                                    <div className="result-banner error-banner">
                                        <span className="dot" />
                                        <span>{errorMsg}</span>
                                    </div>
                                    <button className="analyze-btn secondary" onClick={() => setPhase('idle')}>Reset</button>
                                </div>
                            )}

                            {phase === 'streaming' && status && (
                                <div className="processing-state" style={{ paddingTop: '0' }}>

                                    <div className="processing-info" style={{ marginBottom: '1rem', width: '100%' }}>
                                        <div className="result-banner success-banner" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
                                            <span className="dot safe" />
                                            <span>Stream active: <strong>{status.camera_id}</strong></span>
                                        </div>
                                    </div>

                                    <div className="processing-stats" style={{ flexWrap: 'wrap' }}>
                                        <div className="proc-stat">
                                            <span className="proc-stat-value">{status.frames_captured}</span>
                                            <span className="proc-stat-label">Frames Captured</span>
                                        </div>
                                        <div className="proc-stat">
                                            <span className="proc-stat-value">{status.frames_processed}</span>
                                            <span className="proc-stat-label">Frames Analyzed</span>
                                        </div>
                                        <div className="proc-stat" style={{ minWidth: '100%' }}>
                                            <span className="proc-stat-value">{status.uptime_seconds.toFixed(1)}s</span>
                                            <span className="proc-stat-label">Uptime</span>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        <p>Target FPS: {status.target_fps} | Errors: {status.errors}</p>
                                        <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '2px', marginTop: '1rem' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LiveStreamAnalysis;
