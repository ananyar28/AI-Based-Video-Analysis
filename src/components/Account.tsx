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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
    const [analysisEndTime, setAnalysisEndTime] = useState<number | null>(null);
    const [showDetails, setShowDetails] = useState(false);

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

    const handleAnalysisUpload = async () => {
        if (!analysisFile) return;
        setAnalysisPhase('uploading');
        setAnalysisError('');
        setAnalysisStartTime(Date.now());

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
                        setAnalysisEndTime(Date.now());
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

    const videoDuration = analysisResults?.frames?.length 
        ? Math.max(...analysisResults.frames.map(f => f.timestamp)) 
        : (analysisStatus?.duration_seconds ?? 0);

    const processingTime = (analysisStartTime && analysisEndTime) 
        ? (analysisEndTime - analysisStartTime) / 1000 
        : 0;

    const threatDensity = analysisResults?.frames?.length
        ? (alertCount / analysisResults.frames.length) * 100
        : 0;

    const uniqueClasses = (() => {
        if (!analysisResults?.frames) return [];
        const set = new Set<string>();
        for (const fr of analysisResults.frames) {
            const det = fr.detections;
            if (det) {
                [...(det.object_detections ?? []),
                ...(det.weapon_detections ?? []),
                ...(det.fire_detections ?? [])].forEach(d => set.add(d.class_name));
            }
        }
        return Array.from(set);
    })();

    const threatBadgeClass = (level: number): string => {
        if (level >= 4) return 'threat-badge-ui high';
        if (level >= 2) return 'threat-badge-ui medium';
        return 'threat-badge-ui low';
    };

    const generatePDFReport = () => {
        if (!analysisResults || !analysisVideoId) return;
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.setTextColor(20, 30, 50);
        doc.text('AegisVision Analysis Report', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        const dateStr = new Date().toLocaleString();
        doc.text(`Video ID: #${analysisVideoId} | Date: ${dateStr}`, 14, 30);
        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 34, 196, 34);
        doc.setFontSize(14);
        doc.setTextColor(20, 30, 50);
        doc.text('Summary Statistics', 14, 45);
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.text(`Overall Threat Level: ${THREAT_LABELS[maxThreat] || 'NORMAL'}`, 14, 53);
        doc.text(`Video Duration: ${videoDuration.toFixed(1)}s`, 14, 60);
        doc.text(`Total Frames Analyzed: ${frameCount}`, 14, 67);
        doc.text(`Total Security Alerts: ${alertCount}`, 14, 74);
        doc.text(`Processing Speed: ${processingTime.toFixed(2)}s`, 14, 86);
        doc.text(`Threat Density: ${threatDensity.toFixed(1)}%`, 14, 93);
        doc.text(`Object Types Detected: ${uniqueClasses.join(', ') || 'None'}`, 14, 100);

        if (alertCount > 0) {
            doc.setFontSize(14);
            doc.setTextColor(20, 30, 50);
            doc.text('Detailed Security Alerts Log', 14, 115);
            const tableData = analysisResults.alerts.map((alert) => [
                `${alert.timestamp.toFixed(1)}s`,
                `Level ${alert.threat_level} (${THREAT_LABELS[alert.threat_level]})`,
                alert.threat_label,
            ]);
            autoTable(doc, {
                startY: 120,
                head: [['Timestamp', 'Threat Level', 'Description']],
                body: tableData,
                styles: { fontSize: 10, cellPadding: 4 },
                headStyles: { fillColor: [40, 50, 70] },
                alternateRowStyles: { fillColor: [248, 248, 248] },
            });
        }
        doc.save(`AegisVision_Report_Video_${analysisVideoId}.pdf`);
    };

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
                        <div className="section-header">
                            <h2>Video Analysis</h2>
                            <p className="tab-subtitle">Upload a video to run AI-powered analysis.</p>
                        </div>

                        <div className="analysis-layout">
                            {analysisPhase !== 'completed' && (
                                <div className="dash-upload-card fade-in">
                                    <div className="dash-upload-area" style={analysisFile ? {minHeight: 'auto', padding: '1.5rem', maxWidth: '500px', margin: '0 auto'} : {}}>
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
                                            <div className="dash-file-info" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)', padding: '1rem', borderRadius: '12px' }}>
                                                <span className="dash-file-icon" style={{ fontSize: '1.5rem' }}>🎬</span>
                                                <div style={{ flex: 1, textAlign: 'left' }}>
                                                    <p className="dash-file-name" style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{analysisFile.name}</p>
                                                    <p className="dash-file-size" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{(analysisFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                                                </div>
                                                <button className="icon-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }} onClick={() => {
                                                    setAnalysisFile(null);
                                                    setAnalysisPhase('idle');
                                                    setAnalysisResults(null);
                                                    if (analysisPollRef.current) clearInterval(analysisPollRef.current);
                                                }}>✕</button>
                                            </div>
                                        ) : (
                                            <label htmlFor="dash-file" className="dash-upload-label">
                                                <span className="dash-upload-icon-large">☁️</span>
                                                <h3>Drag and drop your video here</h3>
                                                <p>or click to browse from your computer</p>
                                                <span className="dash-upload-formats">Supported formats: MP4, AVI, MOV (Max 50MB)</span>
                                            </label>
                                        )}
                                    </div>

                                    {analysisFile && analysisPhase === 'idle' && (
                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                                            <button className="btn-primary dash-analyze-btn" onClick={handleAnalysisUpload} style={{ width: '100%', maxWidth: '500px', display: 'block' }}>
                                                Analyze Video
                                            </button>
                                        </div>
                                    )}

                                    {analysisPhase === 'uploading' && (
                                        <div className="dash-status-row" style={{ marginTop: '1rem', padding: '1.5rem', background: 'var(--surface-color)', borderRadius: '12px', minHeight: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', maxWidth: '500px', margin: '1rem auto 0' }}>
                                            <div className="dash-spinner" style={{ marginBottom: '1rem', width: '40px', height: '40px' }} />
                                            <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Uploading video to server…</span>
                                        </div>
                                    )}

                                    {analysisPhase === 'processing' && analysisStatus && (
                                        <div className="dash-processing" style={{ marginTop: '1rem', padding: '3rem 2rem', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--surface-border)', minHeight: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '500px', margin: '1rem auto 0' }}>
                                            <div className="dash-progress-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.1rem' }}>
                                                <span><strong>Processing…</strong> AegisVision active</span>
                                                <span className="dash-progress-pct" style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{analysisStatus.progress_pct}%</span>
                                            </div>
                                            <div className="dash-progress-track" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', height: '12px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                                                <div className="dash-progress-fill" style={{ width: `${analysisStatus.progress_pct}%`, background: 'var(--accent-color)', height: '100%', transition: 'width 0.3s ease' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '2rem', fontSize: '1rem', color: 'var(--text-secondary)', justifyContent: 'center' }}>
                                                <span>✔️ {analysisStatus.frames_analyzed} frames analyzed</span>
                                                {analysisStatus.duration_seconds != null && <span>⏱️ {analysisStatus.duration_seconds.toFixed(1)}s video</span>}
                                            </div>
                                        </div>
                                    )}

                                    {analysisPhase === 'failed' && (
                                        <div className="dash-error" style={{ marginTop: '1rem', padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: '12px', minHeight: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', maxWidth: '500px', margin: '1rem auto 0' }}>
                                            <span style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem' }}>❌ {analysisError || 'Processing failed.'}</span>
                                            <button className="btn-primary" onClick={handleAnalysisUpload}>Retry Analysis</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Completed Results Overlay */}
                            {analysisPhase === 'completed' && analysisResults && (
                                <div className="dash-upload-card fade-in">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3>Analysis Results</h3>
                                        <button className="btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }} onClick={() => {
                                            setAnalysisFile(null);
                                            setAnalysisPhase('idle');
                                            setAnalysisResults(null);
                                        }}>+ New Analysis</button>
                                    </div>
                                    
                                    <div style={{ background: THREAT_COLORS[maxThreat] ? `${THREAT_COLORS[maxThreat]}20` : 'rgba(34, 197, 94, 0.1)', border: `1px solid ${THREAT_COLORS[maxThreat] || '#22c55e'}`, padding: '1rem 1.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                                        <span className="dash-dot" style={{ backgroundColor: THREAT_COLORS[maxThreat] || '#22c55e', width: '12px', height: '12px', borderRadius: '50%' }} />
                                        <span>
                                            Video #{analysisVideoId} &nbsp;·&nbsp; Max Threat:&nbsp;
                                            <strong style={{ color: THREAT_COLORS[maxThreat] || '#22c55e' }}>{THREAT_LABELS[maxThreat] || 'NORMAL'}</strong>
                                        </span>
                                    </div>

                                    <div className="dash-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                        <div className="dash-stat" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                                            <span className="dash-stat-value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{frameCount}</span>
                                            <span className="dash-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Frames analyzed</span>
                                        </div>
                                        <div className="dash-stat" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                                            <span className="dash-stat-value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{alertCount}</span>
                                            <span className="dash-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Alerts</span>
                                        </div>
                                        <div className="dash-stat" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                                            <span className="dash-stat-value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{uniqueClasses.length}</span>
                                            <span className="dash-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Object types</span>
                                        </div>
                                    </div>

                                    <div className="dash-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                        <div className="dash-stat" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                                            <span className="dash-stat-value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{videoDuration.toFixed(1)}s</span>
                                            <span className="dash-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Video Duration</span>
                                        </div>
                                        <div className="dash-stat" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                                            <span className="dash-stat-value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{processingTime.toFixed(1)}s</span>
                                            <span className="dash-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Analyzed In</span>
                                        </div>
                                        <div className="dash-stat" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                                            <span className="dash-stat-value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{threatDensity.toFixed(1)}%</span>
                                            <span className="dash-stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Threat Density</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button 
                                            className="btn-primary" 
                                            onClick={() => setShowDetails(true)}
                                            style={{ flex: 1, background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
                                        >
                                            View Detailed Report
                                        </button>
                                        <button 
                                            className="btn-primary" 
                                            onClick={generatePDFReport}
                                            style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            📄 Download PDF Report
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Report Modal Overlay */}
                        {showDetails && analysisResults && (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                                <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
                                        <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>Detailed Security Analysis</h3>
                                        <button className="icon-btn" onClick={() => setShowDetails(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                                    </div>

                                    {uniqueClasses.length > 0 && (
                                        <div style={{ marginBottom: '2rem' }}>
                                            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Detected Objects</h4>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {uniqueClasses.map((cls) => (
                                                    <span key={cls} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{cls}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ marginBottom: '2rem' }}>
                                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Security Alerts</h4>
                                        {analysisResults.alerts.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {analysisResults.alerts.slice(0, 10).map((a, i) => (
                                                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-primary)' }}>
                                                        <span style={{ backgroundColor: THREAT_COLORS[a.threat_level] || '#f59e0b', width: '10px', height: '10px', borderRadius: '50%' }} />
                                                        <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>[{a.timestamp.toFixed(1)}s] {a.threat_label}</span>
                                                            <span className={threatBadgeClass(a.threat_level)}>Lv {a.threat_level}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                                {analysisResults.alerts.length > 10 && (
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem' }}>…and {analysisResults.alerts.length - 10} more alerts</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '1rem', borderRadius: '8px', color: 'var(--success)' }}>
                                                ✅ No security threats detected.
                                            </div>
                                        )}
                                    </div>

                                    {analysisResults.frames.length > 0 && (
                                        <div>
                                            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Threat Timeline (Top Frames)</h4>
                                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
                                                {[...analysisResults.frames]
                                                    .sort((a, b) => b.threat_level - a.threat_level)
                                                    .slice(0, 8)
                                                    .map((fr, idx, arr) => (
                                                        <div key={fr.frame_id} style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--surface-border)' }}>
                                                            <strong style={{ color: 'var(--text-muted)' }}>{fr.timestamp.toFixed(1)}s</strong>
                                                            <span className={threatBadgeClass(fr.threat_level)}>{fr.threat_label}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Recent History Mockup */}
                        <div className="dash-history-section fade-in">
                            <div className="section-header" style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
                                <h2>Recent Analysis History</h2>
                            </div>
                            <div className="dash-history-table-container">
                                <table className="dash-history-table">
                                    <thead>
                                        <tr>
                                            <th>File Name</th>
                                            <th>Date</th>
                                            <th>Duration</th>
                                            <th>Status</th>
                                            <th>Max Threat</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>lobby_footage_001.mp4</td>
                                            <td>Today, 10:42 AM</td>
                                            <td>02:14</td>
                                            <td><span className="status-badge success">Completed</span></td>
                                            <td><span className="threat-badge-ui low">Low</span></td>
                                        </tr>
                                        <tr>
                                            <td>parking_cam_night.mov</td>
                                            <td>Yesterday, 11:20 PM</td>
                                            <td>14:05</td>
                                            <td><span className="status-badge success">Completed</span></td>
                                            <td><span className="threat-badge-ui high">High</span></td>
                                        </tr>
                                        <tr>
                                            <td>warehouse_entrance.avi</td>
                                            <td>Oct 24, 08:15 AM</td>
                                            <td>05:30</td>
                                            <td><span className="status-badge success">Completed</span></td>
                                            <td><span className="threat-badge-ui medium">Medium</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

                {/* ═══════════════════════════════════════════
                    Live Stream Tab
                   ═══════════════════════════════════════════ */}
                {activeTab === 'stream' && (
                    <div className="content-section fade-in">
                        <div className="section-header">
                            <h2>Live Stream Analysis</h2>
                            <p className="tab-subtitle">Connect to RTSP / HTTP / webcam feeds for real-time AI analysis.</p>
                        </div>

                        <div className="stream-control-panel">
                            <div className="stream-form-compact">
                                <div className="input-group">
                                    <label>Stream URL</label>
                                    <input
                                        type="text"
                                        placeholder="rtsp://... or http://... or 0 (webcam)"
                                        value={streamUrl}
                                        onChange={(e) => setStreamUrl(e.target.value)}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Camera ID</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. lobby-cam-1"
                                        value={streamCameraId}
                                        onChange={(e) => setStreamCameraId(e.target.value)}
                                    />
                                </div>
                                <div className="input-group flex-small">
                                    <label>FPS</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={streamFps}
                                        onChange={(e) => setStreamFps(Number(e.target.value))}
                                    />
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={handleStartStream}
                                    disabled={streamLoading}
                                >
                                    {streamLoading ? 'Starting…' : 'Add Stream'}
                                </button>
                            </div>

                            {streamError && (
                                <div className="dash-error" style={{ marginTop: '1rem' }}>
                                    <span>❌ {streamError}</span>
                                </div>
                            )}
                        </div>

                        {/* Active streams grid */}
                        <div className="stream-grid">
                            {activeStreams.length > 0 ? (
                                activeStreams.map((s) => (
                                    <div key={s.camera_id} className="stream-feed-card fade-in">
                                        <div className="stream-feed-header">
                                            <span className="live-badge"><span className="pulse-dot"></span> LIVE</span>
                                            <strong>{s.camera_id}</strong>
                                            <button
                                                className="icon-btn stop-btn"
                                                onClick={() => handleStopStream(s.camera_id)}
                                                title="Stop Stream"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="stream-feed-view">
                                            <div className="feed-placeholder">
                                                <span className="camera-icon" style={{ opacity: 0.1 }}>🎥</span>
                                            </div>
                                            {s.status && (
                                                <div className="stream-feed-overlay">
                                                    <span>Processed: {s.status.frames_processed}</span>
                                                    <span>Uptime: {Math.round(s.status.uptime_seconds)}s</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="dash-empty-streams">
                                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem', opacity: 0.2 }}>📡</span>
                                    <p>No active streams. Add a camera above to begin monitoring.</p>
                                </div>
                            )}
                        </div>
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
