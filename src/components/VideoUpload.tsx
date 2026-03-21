import { useState, useRef, useCallback } from 'react';
import {
    uploadVideo,
    getVideoStatus,
    getVideoResults,
    type VideoStatusResponse,
    type VideoResultsResponse,
    type FrameResultItem,
} from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './VideoUpload.css';

// ─── Threat level helpers ────────────────────────────────
const THREAT_COLORS: Record<number, string> = {
    0: '#22c55e', // NORMAL  → green
    2: '#f59e0b', // WARNING → amber
    3: '#ef4444', // CRITICAL→ red
    4: '#dc2626', // URGENT  → darker red
    5: '#7f1d1d', // EMERGENCY→ deep red
};

const THREAT_LABELS: Record<number, string> = {
    0: 'NORMAL',
    2: 'WARNING',
    3: 'CRITICAL',
    4: 'URGENT',
    5: 'EMERGENCY',
};

const threatBadgeClass = (level: number): string => {
    if (level >= 4) return 'threat-emergency';
    if (level >= 3) return 'threat-critical';
    if (level >= 2) return 'threat-warning';
    return 'threat-normal';
};

// ─── Component ───────────────────────────────────────────
type UploadPhase =
    | 'idle'
    | 'uploading'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'error';

const VideoUpload: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [phase, setPhase] = useState<UploadPhase>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [showDetails, setShowDetails] = useState(false);

    // Status + results from API
    const [videoId, setVideoId] = useState<number | null>(null);
    const [status, setStatus] = useState<VideoStatusResponse | null>(null);
    const [results, setResults] = useState<VideoResultsResponse | null>(null);
    const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
    const [analysisEndTime, setAnalysisEndTime] = useState<number | null>(null);

    // Polling ref so we can cancel
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Cleanup polling ────────────────────────────────────
    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    // ── Drag & Drop ────────────────────────────────────────
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
            resetState();
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            resetState();
            setSelectedFile(e.target.files[0]);
        }
    };

    const resetState = () => {
        stopPolling();
        setPhase('idle');
        setErrorMsg('');
        setVideoId(null);
        setStatus(null);
        setResults(null);
        setAnalysisStartTime(null);
        setAnalysisEndTime(null);
        setShowDetails(false);
    };

    // ── Main Analyze Flow ──────────────────────────────────
    const handleAnalyze = async () => {
        if (!selectedFile) return;

        setPhase('uploading');
        setErrorMsg('');
        setAnalysisStartTime(Date.now());

        try {
            // 1) Upload
            const uploadRes = await uploadVideo(selectedFile);
            const id = uploadRes.video_id;
            setVideoId(id);
            setPhase('processing');

            // 2) Start polling every 2s
            const poll = async () => {
                try {
                    const statusRes = await getVideoStatus(id);
                    setStatus(statusRes);

                    if (statusRes.status === 'completed') {
                        stopPolling();
                        // 3) Fetch full results
                        try {
                            const resultsRes = await getVideoResults(id);
                            setResults(resultsRes);
                            setAnalysisEndTime(Date.now());
                            setPhase('completed');
                        } catch (err: any) {
                            setPhase('failed');
                            setErrorMsg(err.message || 'Failed to fetch results.');
                        }
                    } else if (statusRes.status === 'failed') {
                        stopPolling();
                        setPhase('failed');
                        setErrorMsg('Video processing failed on the server.');
                    }
                } catch (err: any) {
                    // Don't stop polling on transient network errors
                    console.warn('Polling error:', err);
                }
            };

            // Immediate first poll
            await poll();
            pollRef.current = setInterval(poll, 2000);
        } catch (err: any) {
            setPhase('error');
            setErrorMsg(err.message || 'Upload failed.');
        }
    };

    // Unified Metrics
    const videoDuration = results?.frames?.length 
        ? Math.max(...results.frames.map(f => f.timestamp)) 
        : (status?.duration_seconds ?? 0);

    const processingTime = (analysisStartTime && analysisEndTime) 
        ? (analysisEndTime - analysisStartTime) / 1000 
        : 0;

    const frameCount = results?.total_frames_analyzed ?? 0;
    const maxThreat = results?.frames?.length
        ? Math.max(...results.frames.map((f) => f.threat_level))
        : 0;

    const threatDensity = results?.frames?.length
        ? (results.alerts.length / results.frames.length) * 100
        : 0;

    // Unique class names detected
    const uniqueClasses = (() => {
        if (!results?.frames) return [];
        const set = new Set<string>();
        for (const fr of results.frames) {
            const det = fr.detections;
            if (det) {
                [...(det.object_detections ?? []),
                ...(det.weapon_detections ?? []),
                ...(det.fire_detections ?? [])].forEach(d => set.add(d.class_name));
            }
        }
        return Array.from(set);
    })();

    // ── Generate PDF Report ─────────────────────────────────
    const generatePDFReport = () => {
        if (!results || !videoId) return;

        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(20, 30, 50);
        doc.text('AegisVision Analysis Report', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        const dateStr = new Date().toLocaleString();
        doc.text(`Video ID: #${videoId} | Date: ${dateStr}`, 14, 30);
        
        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 34, 196, 34);

        // Summary Statistics Section
        doc.setFontSize(14);
        doc.setTextColor(20, 30, 50);
        doc.text('Summary Statistics', 14, 45);

        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.text(`Overall Threat Level: ${THREAT_LABELS[maxThreat] || 'NORMAL'}`, 14, 53);
        doc.text(`Video Duration: ${videoDuration.toFixed(1)}s`, 14, 60);
        doc.text(`Total Frames Analyzed: ${frameCount}`, 14, 67);
        doc.text(`Total Security Alerts: ${results.alerts.length}`, 14, 74);
        
        // Advanced Metrics
        doc.text(`Processing Speed: ${processingTime.toFixed(2)}s`, 14, 86);
        doc.text(`Threat Density: ${threatDensity.toFixed(1)}%`, 14, 93);
        doc.text(`Object Types Detected: ${uniqueClasses.join(', ') || 'None'}`, 14, 100);

        // Alerts Table
        if (results.alerts.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(20, 30, 50);
            doc.text('Detailed Security Alerts Log', 14, 115);

            const tableData = results.alerts.map((alert) => [
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
                didParseCell: function (data: any) {
                    if (data.section === 'body' && data.column.index === 1) {
                        const levelStr = data.cell.raw as string;
                        if (levelStr.includes('Level 4') || levelStr.includes('Level 5')) {
                            data.cell.styles.textColor = [220, 38, 38]; // Red
                            data.cell.styles.fontStyle = 'bold';
                        } else if (levelStr.includes('Level 2') || levelStr.includes('Level 3')) {
                            data.cell.styles.textColor = [245, 158, 11]; // Orange
                        }
                    }
                }
            });
        }

        // Save PDF
        doc.save(`AegisVision_Report_Video_${videoId}.pdf`);
    };

    // ── Render ──────────────────────────────────────────────
    return (
        <section className="video-upload-section" id="video-analysis">
            <div className="video-upload-container">
                <h2 className="section-title">Analyze Your Content</h2>

                <div className="upload-layout">
                    {/* ─── Left: Upload Zone ─────────────────────── */}
                    <div className="upload-card">
                        <div
                            className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                id="file-input"
                                accept="video/*"
                                onChange={handleFileChange}
                                className="file-input"
                            />

                            {selectedFile ? (
                                <div className="file-preview">
                                    <div className="file-icon">🎬</div>
                                    <p className="file-name">{selectedFile.name}</p>
                                    <p className="file-size">
                                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                                    </p>
                                    <button
                                        className="remove-btn"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            resetState();
                                        }}
                                    >
                                        Remove Video
                                    </button>
                                </div>
                            ) : (
                                <label htmlFor="file-input" className="upload-label">
                                    <div className="upload-icon">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 16L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M9 11L12 8L15 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M8 16H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" stroke="currentColor" strokeWidth="2" />
                                        </svg>
                                    </div>
                                    <p className="upload-text"><strong>Click to upload</strong> or drag and drop</p>
                                    <p className="upload-subtext">MP4, AVI, MOV (max 500MB)</p>
                                </label>
                            )}
                        </div>
                    </div>

                    {/* ─── Right: Summary / Results ──────────────── */}
                    <div className="summary-card">
                        <div className="summary-header">
                            <h3>Analysis Summary</h3>
                            <span className={`status-badge ${phase === 'completed' ? 'success' : phase === 'error' || phase === 'failed' ? 'error' : ''}`}>
                                {phase === 'idle' && !selectedFile && 'Waiting for input'}
                                {phase === 'idle' && selectedFile && 'Ready to Analyze'}
                                {phase === 'uploading' && 'Uploading…'}
                                {phase === 'processing' && 'Processing…'}
                                {phase === 'completed' && 'Completed'}
                                {(phase === 'error' || phase === 'failed') && 'Failed'}
                            </span>
                        </div>

                        <div className="summary-content">
                            {/* ── Empty state ─────────────────────────── */}
                            {!selectedFile && phase === 'idle' && (
                                <div className="empty-state">
                                    <p>Upload a video to see AI-generated insights, detected objects, and security alerts here.</p>
                                </div>
                            )}

                            {/* ── Ready / Error – show analyze button ── */}
                            {selectedFile && (phase === 'idle' || phase === 'error' || phase === 'failed') && (
                                <div className="pre-analysis-state">
                                    {(phase === 'error' || phase === 'failed') && (
                                        <div className="result-banner error-banner">
                                            <span className="dot warning" />
                                            <span>{errorMsg || 'Something went wrong.'}</span>
                                        </div>
                                    )}
                                    <p>{phase === 'idle' ? 'Video ready for processing.' : 'Click below to retry.'}</p>
                                    <button className="analyze-btn" onClick={handleAnalyze}>
                                        {phase === 'idle' ? 'Analyze Video' : 'Retry Analysis'}
                                    </button>
                                </div>
                            )}

                            {/* ── Uploading ──────────────────────────── */}
                            {phase === 'uploading' && (
                                <div className="pre-analysis-state">
                                    <p>Uploading video to server…</p>
                                    <div className="spinner" />
                                </div>
                            )}

                            {/* ── Processing with progress bar ──────── */}
                            {phase === 'processing' && (
                                <div className="processing-state">
                                    <div className="processing-info">
                                        <p className="processing-title">AegisVision Threat Engine active</p>
                                        <p className="processing-subtitle">
                                            {(!status || status.frames_analyzed === 0)
                                                ? 'Initializing AI models and extracting frames…'
                                                : 'Performing consolidated security scan…'}
                                        </p>
                                    </div>

                                    <div className="progress-container">
                                        <div className="progress-header">
                                            <span>Progress</span>
                                            <span className="progress-pct">{status?.progress_pct ?? 0}%</span>
                                        </div>
                                        <div className="progress-bar-track">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${status?.progress_pct ?? 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="processing-stats">
                                        <div className="proc-stat">
                                            <span className="proc-stat-value">{status?.frames_analyzed ?? 0}</span>
                                            <span className="proc-stat-label">Frames analyzed</span>
                                        </div>
                                        {status?.duration_seconds != null && (
                                            <div className="proc-stat">
                                                <span className="proc-stat-value">{status.duration_seconds.toFixed(1)}s</span>
                                                <span className="proc-stat-label">Video duration</span>
                                            </div>
                                        )}
                                        {status?.resolution && (
                                            <div className="proc-stat">
                                                <span className="proc-stat-value">{status.resolution}</span>
                                                <span className="proc-stat-label">Resolution</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="spinner" />
                                </div>
                            )}

                            {/* ── Completed – show results ──────────── */}
                            {phase === 'completed' && results && (
                                <div className="analysis-results">
                                    {/* Video ID + threat banner */}
                                    <div className={`result-banner ${threatBadgeClass(maxThreat)}-banner`}>
                                        <span className="dot" style={{ backgroundColor: THREAT_COLORS[maxThreat] || '#22c55e' }} />
                                        <span>
                                            Video #{videoId} &nbsp;·&nbsp; Max Threat:&nbsp;
                                            <strong>{THREAT_LABELS[maxThreat] || 'NORMAL'}</strong>
                                        </span>
                                    </div>

                                    {/* Stats row */}
                                    <div className="stats-row">
                                        <div className="stat-box">
                                            <span className="stat-value">{frameCount}</span>
                                            <span className="stat-label">Frames analyzed</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="stat-value">{results.alerts.length}</span>
                                            <span className="stat-label">Alerts</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="stat-value">{uniqueClasses.length}</span>
                                            <span className="stat-label">Object types</span>
                                        </div>
                                    </div>

                                    {/* Professional Metrics Row */}
                                    <div className="stats-row">
                                        <div className="stat-box">
                                            <span className="stat-value">{videoDuration.toFixed(1)}s</span>
                                            <span className="stat-label">Video Duration</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="stat-value">{processingTime.toFixed(1)}s</span>
                                            <span className="stat-label">Analyzed In</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="stat-value">{threatDensity.toFixed(1)}%</span>
                                            <span className="stat-label">Threat Density</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                                        <button 
                                            className="analyze-btn" 
                                            onClick={() => setShowDetails(!showDetails)}
                                            style={{ flex: 1, background: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                                        >
                                            View Detailed Report
                                        </button>
                                        <button 
                                            className="analyze-btn" 
                                            onClick={generatePDFReport}
                                            style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 15V3M12 15L8 11M12 15L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            Download PDF Report
                                        </button>
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Report Modal Overlay ───────────────────────── */}
                    {showDetails && results && (
                        <div className="report-modal-overlay">
                            <div className="modal-header">
                                <h3>Detailed Security Analysis</h3>
                                <button
                                    className="close-modal-btn"
                                    onClick={() => setShowDetails(false)}
                                >
                                    Hide Detailed Report
                                </button>
                            </div>

                            {/* Detected object tags */}
                            {uniqueClasses.length > 0 && (
                                <div className="ai-report">
                                    <h4>Detected Objects</h4>
                                    <div className="tags">
                                        {uniqueClasses.map((cls) => (
                                            <span key={cls} className="ai-tag conf-high">
                                                <span className="tag-name">{cls}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Alerts */}
                            <div className="ai-report">
                                <h4>Security Alerts</h4>
                                {results.alerts.length > 0 ? (
                                    <div className="warnings-list">
                                        {results.alerts.slice(0, 10).map((a, i) => (
                                            <div key={i} className="result-banner warning-banner">
                                                <span className="dot" style={{ backgroundColor: THREAT_COLORS[a.threat_level] || '#f59e0b' }} />
                                                <span>
                                                    [{a.timestamp.toFixed(1)}s] {a.threat_label}
                                                    <span className={`threat-badge ${threatBadgeClass(a.threat_level)}`}>
                                                        Lv {a.threat_level}
                                                    </span>
                                                </span>
                                            </div>
                                        ))}
                                        {results.alerts.length > 10 && (
                                            <p className="more-alerts">…and {results.alerts.length - 10} more alerts</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="result-banner safe-banner">
                                        <span className="dot safe" />
                                        <span>No security threats detected.</span>
                                    </div>
                                )}
                            </div>

                            {/* Timeline: top 10 highest-threat frames */}
                            {results.frames.length > 0 && (
                                <div className="ai-report">
                                    <h4>Threat Timeline (Top Frames)</h4>
                                    <div className="threat-timeline">
                                        {[...results.frames]
                                            .sort((a, b) => b.threat_level - a.threat_level)
                                            .slice(0, 8)
                                            .map((fr: FrameResultItem) => (
                                                <div key={fr.frame_id} className="timeline-item">
                                                    <span className="timeline-time">{fr.timestamp.toFixed(1)}s</span>
                                                    <span
                                                        className={`threat-badge ${threatBadgeClass(fr.threat_level)}`}
                                                    >
                                                        {fr.threat_label}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default VideoUpload;
