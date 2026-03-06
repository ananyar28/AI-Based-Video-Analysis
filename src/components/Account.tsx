import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    uploadVideo,
    getVideoStatus,
    getVideoResults,
    startStream,
    stopStream,
    getStreamStatus,
    type VideoStatusResponse,
    type VideoResultsResponse,
    type StreamStatusResponse,
} from '../services/api';
import './Account.css';

// ── Threat helpers ────────────────────────────────────────
const THREAT_COLORS: Record<number, string> = {
    0: '#22c55e', 2: '#f59e0b', 3: '#ef4444', 4: '#dc2626', 5: '#7f1d1d',
};
const THREAT_LABELS: Record<number, string> = {
    0: 'NORMAL', 2: 'WARNING', 3: 'CRITICAL', 4: 'URGENT', 5: 'EMERGENCY',
};

const Account: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();
    const [activeTab, setActiveTab] = useState('analysis');

    // ── Video analysis state ──────────────────────────────
    const [analysisFile, setAnalysisFile] = useState<File | null>(null);
    const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
    const [analysisVideoId, setAnalysisVideoId] = useState<number | null>(null);
    const [analysisStatus, setAnalysisStatus] = useState<VideoStatusResponse | null>(null);
    const [analysisResults, setAnalysisResults] = useState<VideoResultsResponse | null>(null);
    const [analysisError, setAnalysisError] = useState('');
    const analysisPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Stream state ──────────────────────────────────────
    const [streamUrl, setStreamUrl] = useState('');
    const [streamCameraId, setStreamCameraId] = useState('');
    const [streamFps, setStreamFps] = useState(5);
    const [activeStreams, setActiveStreams] = useState<Array<{ camera_id: string; url: string; status: StreamStatusResponse | null }>>([]);
    const [streamError, setStreamError] = useState('');
    const [streamLoading, setStreamLoading] = useState(false);
    const streamPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // Cleanup polls on unmount
    useEffect(() => {
        return () => {
            if (analysisPollRef.current) clearInterval(analysisPollRef.current);
            if (streamPollRef.current) clearInterval(streamPollRef.current);
        };
    }, []);

    if (!user) return null;

    const safeUser = {
        name: user.name || "User",
        email: user.email || "user@example.com",
        plan: "Free Tier",
        usage: 45,
        avatar: user.avatar ? <img src={user.avatar} alt="Avatar" className="avatar-img" /> : (user.name?.charAt(0) || "U"),
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // ── Video Analysis Handler ────────────────────────────
    const handleAnalysisUpload = async () => {
        if (!analysisFile) return;
        setAnalysisPhase('uploading');
        setAnalysisError('');

        try {
            const res = await uploadVideo(analysisFile);
            const id = res.video_id;
            setAnalysisVideoId(id);
            setAnalysisPhase('processing');

            const poll = async () => {
                try {
                    const statusRes = await getVideoStatus(id);
                    setAnalysisStatus(statusRes);
                    if (statusRes.status === 'completed') {
                        if (analysisPollRef.current) clearInterval(analysisPollRef.current);
                        const results = await getVideoResults(id);
                        setAnalysisResults(results);
                        setAnalysisPhase('completed');
                    } else if (statusRes.status === 'failed') {
                        if (analysisPollRef.current) clearInterval(analysisPollRef.current);
                        setAnalysisPhase('failed');
                        setAnalysisError('Processing failed on the server.');
                    }
                } catch (err) { console.warn('Poll error:', err); }
            };
            await poll();
            analysisPollRef.current = setInterval(poll, 2000);
        } catch (err: any) {
            setAnalysisPhase('failed');
            setAnalysisError(err.message || 'Upload failed.');
        }
    };

    // ── Stream Handlers ───────────────────────────────────
    const handleStartStream = async () => {
        if (!streamUrl || !streamCameraId) {
            setStreamError('Both URL and Camera ID are required.');
            return;
        }
        setStreamLoading(true);
        setStreamError('');
        try {
            await startStream(streamUrl, streamCameraId, streamFps);
            setActiveStreams(prev => [...prev, { camera_id: streamCameraId, url: streamUrl, status: null }]);
            setStreamUrl('');
            setStreamCameraId('');

            // Start polling stream status
            if (!streamPollRef.current) {
                streamPollRef.current = setInterval(async () => {
                    setActiveStreams(prev => {
                        prev.forEach(async (s) => {
                            try {
                                const st = await getStreamStatus(s.camera_id);
                                setActiveStreams(current =>
                                    current.map(c => c.camera_id === s.camera_id ? { ...c, status: st } : c)
                                );
                            } catch { /* stream may have stopped */ }
                        });
                        return prev;
                    });
                }, 3000);
            }
        } catch (err: any) {
            setStreamError(err.message || 'Failed to start stream.');
        } finally {
            setStreamLoading(false);
        }
    };

    const handleStopStream = async (cameraId: string) => {
        try {
            await stopStream(cameraId);
            setActiveStreams(prev => prev.filter(s => s.camera_id !== cameraId));
        } catch (err: any) {
            setStreamError(err.message || 'Failed to stop stream.');
        }
    };

    // ── Derived analysis stats ────────────────────────────
    const alertCount = analysisResults?.alerts?.length ?? 0;
    const frameCount = analysisResults?.total_frames_analyzed ?? 0;
    const maxThreat = analysisResults?.frames?.length
        ? Math.max(...analysisResults.frames.map(f => f.threat_level))
        : 0;

    return (
        <div className="account-container">
            <div className="account-sidebar">
                <div className="user-brief">
                    <div className="avatar-large">{safeUser.avatar}</div>
                    <h3>{safeUser.name}</h3>
                    <p>{safeUser.email}</p>
                </div>

                <nav className="account-nav">
                    <button className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
                        🎥 Video Analysis
                    </button>
                    <button className={`nav-item ${activeTab === 'stream' ? 'active' : ''}`} onClick={() => setActiveTab('stream')}>
                        📡 Live Stream
                    </button>
                    <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                        Profile Settings
                    </button>
                    <button className={`nav-item ${activeTab === 'usage' ? 'active' : ''}`} onClick={() => setActiveTab('usage')}>
                        Usage & Billing
                    </button>
                    <button className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
                        Security
                    </button>
                    <button className="nav-item logout" onClick={handleLogout}>
                        Sign Out
                    </button>
                </nav>
            </div>

            <div className="account-content">
                {/* ═══════════════════════════════════════════
                    Video Analysis Tab
                   ═══════════════════════════════════════════ */}
                {activeTab === 'analysis' && (
                    <div className="content-section fade-in">
                        <h2>Video Analysis</h2>
                        <p className="tab-subtitle">Upload a video to run AI-powered object, weapon &amp; fire detection.</p>

                        {/* Upload card */}
                        <div className="dash-upload-card">
                            <div className="dash-upload-area">
                                <input
                                    type="file"
                                    id="dash-file"
                                    accept="video/*"
                                    className="file-input-hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.length) {
                                            setAnalysisFile(e.target.files[0]);
                                            setAnalysisPhase('idle');
                                            setAnalysisResults(null);
                                            setAnalysisError('');
                                        }
                                    }}
                                />
                                {analysisFile ? (
                                    <div className="dash-file-info">
                                        <span className="dash-file-icon">🎬</span>
                                        <div>
                                            <p className="dash-file-name">{analysisFile.name}</p>
                                            <p className="dash-file-size">{(analysisFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                                        </div>
                                        <button className="dash-remove-btn" onClick={() => {
                                            setAnalysisFile(null);
                                            setAnalysisPhase('idle');
                                            setAnalysisResults(null);
                                            if (analysisPollRef.current) clearInterval(analysisPollRef.current);
                                        }}>✕</button>
                                    </div>
                                ) : (
                                    <label htmlFor="dash-file" className="dash-upload-label">
                                        <span className="dash-upload-icon">📁</span>
                                        <span>Click to select a video (MP4, AVI, MOV)</span>
                                    </label>
                                )}
                            </div>

                            {analysisFile && analysisPhase === 'idle' && (
                                <button className="btn-primary dash-analyze-btn" onClick={handleAnalysisUpload}>
                                    Analyze Video
                                </button>
                            )}

                            {analysisPhase === 'uploading' && (
                                <div className="dash-status-row">
                                    <div className="dash-spinner" />
                                    <span>Uploading…</span>
                                </div>
                            )}

                            {analysisPhase === 'processing' && analysisStatus && (
                                <div className="dash-processing">
                                    <div className="dash-progress-header">
                                        <span>Processing…</span>
                                        <span className="dash-progress-pct">{analysisStatus.progress_pct}%</span>
                                    </div>
                                    <div className="dash-progress-track">
                                        <div className="dash-progress-fill" style={{ width: `${analysisStatus.progress_pct}%` }} />
                                    </div>
                                    <p className="dash-progress-detail">
                                        {analysisStatus.frames_analyzed} frames analyzed
                                        {analysisStatus.duration_seconds != null && ` · ${analysisStatus.duration_seconds.toFixed(1)}s video`}
                                    </p>
                                </div>
                            )}

                            {analysisPhase === 'failed' && (
                                <div className="dash-error">
                                    <span>❌ {analysisError}</span>
                                    <button className="btn-primary" onClick={handleAnalysisUpload}>Retry</button>
                                </div>
                            )}
                        </div>

                        {/* Results */}
                        {analysisPhase === 'completed' && analysisResults && (
                            <div className="dash-results fade-in">
                                <h3>Results — Video #{analysisVideoId}</h3>

                                <div className="dash-stats-grid">
                                    <div className="dash-stat">
                                        <span className="dash-stat-value">{frameCount}</span>
                                        <span className="dash-stat-label">Frames</span>
                                    </div>
                                    <div className="dash-stat">
                                        <span className="dash-stat-value">{alertCount}</span>
                                        <span className="dash-stat-label">Alerts</span>
                                    </div>
                                    <div className="dash-stat">
                                        <span className="dash-stat-value" style={{ color: THREAT_COLORS[maxThreat] }}>
                                            {THREAT_LABELS[maxThreat] || 'NORMAL'}
                                        </span>
                                        <span className="dash-stat-label">Max Threat</span>
                                    </div>
                                </div>

                                {/* Alerts list */}
                                {alertCount > 0 && (
                                    <div className="dash-alert-list">
                                        <h4>Security Alerts</h4>
                                        {analysisResults.alerts.slice(0, 15).map((a, i) => (
                                            <div key={i} className="dash-alert-item">
                                                <span className="dash-dot" style={{ backgroundColor: THREAT_COLORS[a.threat_level] }} />
                                                <span className="dash-alert-time">[{a.timestamp.toFixed(1)}s]</span>
                                                <span>{a.threat_label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {alertCount === 0 && (
                                    <div className="dash-safe-banner">
                                        ✅ No security threats detected in this video.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════
                    Live Stream Tab
                   ═══════════════════════════════════════════ */}
                {activeTab === 'stream' && (
                    <div className="content-section fade-in">
                        <h2>Live Stream Analysis</h2>
                        <p className="tab-subtitle">Connect to RTSP / HTTP / webcam feeds for real-time AI analysis.</p>

                        <div className="setting-card">
                            <div className="stream-form">
                                <div className="input-group">
                                    <label>Stream URL</label>
                                    <input
                                        type="text"
                                        placeholder="rtsp://... or http://... or 0 (webcam)"
                                        value={streamUrl}
                                        onChange={(e) => setStreamUrl(e.target.value)}
                                    />
                                </div>
                                <div className="stream-form-row">
                                    <div className="input-group" style={{ flex: 2 }}>
                                        <label>Camera ID</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. lobby-cam-1"
                                            value={streamCameraId}
                                            onChange={(e) => setStreamCameraId(e.target.value)}
                                        />
                                    </div>
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label>Target FPS</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={streamFps}
                                            onChange={(e) => setStreamFps(Number(e.target.value))}
                                        />
                                    </div>
                                </div>

                                {streamError && (
                                    <div className="dash-error" style={{ marginBottom: '1rem' }}>
                                        <span>❌ {streamError}</span>
                                    </div>
                                )}

                                <button
                                    className="btn-primary"
                                    onClick={handleStartStream}
                                    disabled={streamLoading}
                                >
                                    {streamLoading ? 'Starting…' : 'Start Stream'}
                                </button>
                            </div>
                        </div>

                        {/* Active streams list */}
                        {activeStreams.length > 0 && (
                            <div className="dash-streams">
                                <h3>Active Streams</h3>
                                {activeStreams.map((s) => (
                                    <div key={s.camera_id} className="dash-stream-card">
                                        <div className="dash-stream-header">
                                            <div>
                                                <span className="dash-stream-dot active" />
                                                <strong>{s.camera_id}</strong>
                                            </div>
                                            <button
                                                className="dash-stop-btn"
                                                onClick={() => handleStopStream(s.camera_id)}
                                            >
                                                Stop
                                            </button>
                                        </div>
                                        <p className="dash-stream-url">{s.url}</p>
                                        {s.status && (
                                            <div className="dash-stream-stats">
                                                <span>Frames: {s.status.frames_captured}</span>
                                                <span>Processed: {s.status.frames_processed}</span>
                                                <span>Uptime: {Math.round(s.status.uptime_seconds)}s</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeStreams.length === 0 && (
                            <div className="dash-empty-streams">
                                <p>No active streams. Start one above to begin real-time analysis.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════
                    Profile Tab (original)
                   ═══════════════════════════════════════════ */}
                {activeTab === 'profile' && (
                    <div className="content-section fade-in">
                        <h2>Profile Settings</h2>
                        <div className="setting-card">
                            <div className="input-group">
                                <label>Full Name</label>
                                <input type="text" defaultValue={user.name} />
                            </div>
                            <div className="input-group">
                                <label>Email Address</label>
                                <input type="email" defaultValue={user.email} disabled />
                                <span className="helper-text">Contact support to change email</span>
                            </div>
                        </div>
                        <div className="action-row">
                            <button className="btn-primary">Save Changes</button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════
                    Usage Tab (original)
                   ═══════════════════════════════════════════ */}
                {activeTab === 'usage' && (
                    <div className="content-section fade-in">
                        <h2>Usage & Billing</h2>
                        <div className="usage-card">
                            <div className="plan-header">
                                <div>
                                    <h3>Current Plan: {safeUser.plan}</h3>
                                    <p>Renewals on Feb 18, 2026</p>
                                </div>
                                <button className="btn-secondary">Upgrade Plan</button>
                            </div>
                            <div className="usage-meter">
                                <div className="usage-label">
                                    <span>Video Analysis Minutes</span>
                                    <span>{safeUser.usage} / 100 mins</span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${safeUser.usage}%` }} />
                                </div>
                            </div>
                        </div>
                        <h3>Payment Method</h3>
                        <div className="setting-card">
                            <div className="payment-method">
                                <span>•••• •••• •••• 4242</span>
                                <span className="card-expiry">Expires 12/28</span>
                                <button className="btn-text">Edit</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════
                    Security Tab (original)
                   ═══════════════════════════════════════════ */}
                {activeTab === 'security' && (
                    <div className="content-section fade-in">
                        <h2>Security</h2>
                        <div className="setting-card">
                            <div className="input-group">
                                <label>Current Password</label>
                                <input type="password" placeholder="••••••••" />
                            </div>
                            <div className="input-group">
                                <label>New Password</label>
                                <input type="password" placeholder="Enter new password" />
                            </div>
                            <div className="input-group">
                                <label>Confirm New Password</label>
                                <input type="password" placeholder="Confirm new password" />
                            </div>
                        </div>
                        <div className="action-row">
                            <button className="btn-primary">Update Password</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Account;
