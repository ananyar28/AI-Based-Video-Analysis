import React, { useState, useRef, useEffect } from 'react';
import { startStream, stopStream, getStreamStatus } from '../services/api';
import LiveStreamDashboard from './LiveStreamDashboard';
import './VideoUpload.css'; // Reuse styles for consistency

const LiveStreamAnalysis: React.FC = () => {
    const [sourceType, setSourceType] = useState<'webcam' | 'url'>('webcam');
    const [url, setUrl] = useState('');
    const [cameraId, setCameraId] = useState('');
    const [phase, setPhase] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Refs
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const stopVideoTracks = () => {
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();
            stopVideoTracks();
        };
    }, []);

    const handleStart = async (e: React.FormEvent) => {
        e.preventDefault();

        let targetUrl = url.replace(/\s+/g, '');
        if (sourceType === 'webcam') {
            targetUrl = '0'; // Default webcam index for OpenCV
        } else if (!url) {
            return;
        }

        const id = cameraId || `cam-${Date.now()}`;
        if (!cameraId) setCameraId(id);

        setPhase('connecting');
        setErrorMsg('');

        // Removed getUserMedia call here to prevent hardware lock contention 
        // with the Python backend cv2.VideoCapture(0).

        try {
            await startStream(targetUrl, id, 5); // Target 5 FPS
            setPhase('streaming');

            // Poll status every 2 seconds
            pollRef.current = setInterval(async () => {
                try {
                    const st = await getStreamStatus(id);
                    if (!st.is_running) {
                        stopPolling();
                        stopVideoTracks();
                        setPhase('error');
                        setErrorMsg('Stream disconnected or stopped gracefully.');
                    }
                } catch (err: any) {
                    console.warn("Polling error", err);
                }
            }, 2000);

        } catch (err: any) {
            setPhase('error');
            stopVideoTracks();
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
        stopVideoTracks();

        setPhase('idle');
        if (sourceType === 'url') {
            setUrl('');
        }
    };

    if (phase === 'streaming') {
        return (
            <LiveStreamDashboard 
                cameraId={cameraId}
                sourceType={sourceType}
                url={url}
                mediaStream={streamRef.current}
                onStop={handleStop}
            />
        );
    }

    return (
        <section className="video-upload-section">
            <div className="video-upload-container" style={{ maxWidth: '1100px' }}>
                <h2 className="section-title">Live Stream Analysis</h2>

                <div className="upload-layout" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    {/* Left: Input Config */}
                    <div className="upload-card" style={{ flex: 1, minWidth: '350px' }}>
                        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Source Configuration</h3>

                                    {/* Source Toggle */}
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', background: 'var(--surface-color)', padding: '6px', borderRadius: '10px', border: '1px solid var(--surface-border)' }}>
                                        <button
                                            type="button"
                                            onClick={() => setSourceType('webcam')}
                                            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: sourceType === 'webcam' ? 'var(--accent-color)' : 'transparent', color: sourceType === 'webcam' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s' }}
                                        >
                                            Local Webcam
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSourceType('url')}
                                            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: sourceType === 'url' ? 'var(--accent-color)' : 'transparent', color: sourceType === 'url' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s' }}
                                        >
                                            IP / RTSP URL
                                        </button>
                                    </div>

                                    {sourceType === 'webcam' ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <p>Select "Local Webcam" to use your device's built-in camera.</p>
                                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '3px solid #f59e0b', padding: '8px 12px', borderRadius: '4px' }}>
                                                <strong>Note:</strong> To prevent hardware freezing, the browser preview is disabled while the AI backend takes exclusive control of the camera. You will see AI metadata floating on a black canvas.
                                            </div>
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                            Enter an RTSP, HTTP(S) URL to begin real-time analysis on a remote IP Camera.
                                        </p>
                                    )}
                                </div>

                                {sourceType === 'url' && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Stream URL</label>
                                        <input
                                            type="text"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="e.g. rtsp://192.168.1.100:554/stream1"
                                            disabled={phase !== 'idle' && phase !== 'error'}
                                            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}
                                            required={sourceType === 'url'}
                                        />
                                    </div>
                                )}

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Camera ID (Optional)</label>
                                    <input
                                        type="text"
                                        value={cameraId}
                                        onChange={(e) => setCameraId(e.target.value)}
                                        placeholder="e.g. lobby-cam-01"
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

                    {/* Right: Status Summary (Empty/Connecting/Error state) */}
                    <div className="summary-card" style={{ flex: 1.5, minWidth: '400px' }}>
                        <div className="summary-header">
                            <h3>Live Status</h3>
                            <span className={`status-badge ${phase === 'error' ? 'error' : ''}`}>
                                {phase === 'idle' && 'Disconnected'}
                                {phase === 'connecting' && 'Connecting...'}
                                {phase === 'error' && 'Error'}
                            </span>
                        </div>

                        <div className="summary-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{
                                background: '#000',
                                borderRadius: '8px',
                                aspectRatio: '16/9',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--surface-border)',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: phase === 'connecting' && sourceType === 'webcam' ? 'block' : 'none' }}
                                />

                                {(phase === 'idle' || phase === 'error' || sourceType === 'url') && (
                                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                                        {sourceType === 'url' ? 'Awaiting Connection...' : (phase === 'error' ? errorMsg : 'AI Backend taking control of webcam...')}
                                    </div>
                                )}
                            </div>

                            {phase === 'connecting' && (
                                <div className="pre-analysis-state" style={{ flex: 1 }}>
                                    <p>Initializing Connection...</p>
                                    <div className="spinner" />
                                </div>
                            )}

                            {phase === 'error' && (
                                <div className="pre-analysis-state" style={{ flex: 1 }}>
                                    <div className="result-banner error-banner">
                                        <span className="dot" />
                                        <span>{errorMsg}</span>
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
