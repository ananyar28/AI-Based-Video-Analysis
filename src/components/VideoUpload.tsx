import React, { useState } from 'react';
import './VideoUpload.css';

interface ObjectInfo {
    count: number;
    avg_confidence: number;
}

interface AnalysisReport {
    status: string;
    total_frames_analyzed: number;
    objects_detected: Record<string, ObjectInfo>;
    security_warnings: string[];
    timeline: Record<string, number[]>;
    error?: string;
}

interface UploadResponse {
    id: number;
    filename: string;
    status: string;
    report: AnalysisReport;
}

const VideoUpload: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);

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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setSelectedFile(e.dataTransfer.files[0]);
            setUploadStatus('idle');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
            setUploadStatus('idle');
        }
    };

    const handleAnalyze = async () => {
        if (!selectedFile) return;

        setUploadStatus('uploading');

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('http://localhost:8000/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data: UploadResponse = await response.json();
            setUploadResponse(data);
            setUploadStatus('success');
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadStatus('error');
        }
    };

    /** Confidence colour: green ≥ 70%, yellow ≥ 50%, red below */
    const confClass = (conf: number): string => {
        if (conf >= 0.7) return 'conf-high';
        if (conf >= 0.5) return 'conf-mid';
        return 'conf-low';
    };

    const report = uploadResponse?.report;

    return (
        <section className="video-upload-section">
            <div className="video-upload-container">
                <h2 className="section-title">Analyze Your Content</h2>

                <div className="upload-layout">
                    {/* Left Side: Upload Zone */}
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
                                    <button
                                        className="remove-btn"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            setUploadStatus('idle');
                                            setUploadResponse(null);
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

                    {/* Right Side: Summary / Output Zone */}
                    <div className="summary-card">
                        <div className="summary-header">
                            <h3>Analysis Summary</h3>
                            <span className={`status-badge ${uploadStatus === 'success' ? 'success' : uploadStatus === 'error' ? 'error' : ''}`}>
                                {selectedFile
                                    ? (uploadStatus === 'uploading' ? 'Analyzing…' : uploadStatus === 'success' ? 'Completed' : 'Ready to Analyze')
                                    : 'Waiting for input'}
                            </span>
                        </div>

                        <div className="summary-content">
                            {/* --- Empty state --- */}
                            {!selectedFile ? (
                                <div className="empty-state">
                                    <p>Upload a video to see AI-generated insights, detected objects, and security alerts here.</p>
                                </div>

                                /* --- Pre-analysis / error --- */
                            ) : uploadStatus === 'idle' || uploadStatus === 'error' ? (
                                <div className="pre-analysis-state">
                                    <p>{uploadStatus === 'error' ? 'Upload failed. Please try again.' : 'Video ready for processing.'}</p>
                                    <button className="analyze-btn" onClick={handleAnalyze}>
                                        {uploadStatus === 'error' ? 'Retry Analysis' : 'Analyze Video'}
                                    </button>
                                </div>

                                /* --- Uploading / processing --- */
                            ) : uploadStatus === 'uploading' ? (
                                <div className="pre-analysis-state">
                                    <p>Running YOLOv8 inference — this may take a moment…</p>
                                    <div className="spinner" />
                                </div>

                                /* --- Results --- */
                            ) : (
                                <div className="analysis-results">

                                    {/* File stored banner */}
                                    <div className="result-banner success-banner">
                                        <span className="dot info" />
                                        <span>File stored successfully &nbsp;·&nbsp; ID: <strong>{uploadResponse?.id}</strong></span>
                                    </div>

                                    {/* AI error fallback */}
                                    {report?.error && (
                                        <div className="result-banner error-banner">
                                            <span className="dot warning" />
                                            <span>AI analysis failed: {report.error}</span>
                                        </div>
                                    )}

                                    {/* Stats row */}
                                    {!report?.error && (
                                        <div className="stats-row">
                                            <div className="stat-box">
                                                <span className="stat-value">
                                                    {Object.keys(report?.objects_detected ?? {}).length}
                                                </span>
                                                <span className="stat-label">Object types</span>
                                            </div>
                                            <div className="stat-box">
                                                <span className="stat-value">
                                                    {Object.values(report?.objects_detected ?? {}).reduce((s, o) => s + o.count, 0)}
                                                </span>
                                                <span className="stat-label">Total detections</span>
                                            </div>
                                            <div className="stat-box">
                                                <span className="stat-value">{report?.total_frames_analyzed ?? 0}</span>
                                                <span className="stat-label">Frames analyzed</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Detected objects */}
                                    {report?.objects_detected && Object.keys(report.objects_detected).length > 0 ? (
                                        <div className="ai-report">
                                            <h4>Detected Objects</h4>
                                            <div className="tags">
                                                {Object.entries(report.objects_detected).map(([obj, info]) => (
                                                    <span key={obj} className={`ai-tag ${confClass(info.avg_confidence)}`}>
                                                        <span className="tag-name">{obj}</span>
                                                        <span className="tag-meta">
                                                            {info.count}× &nbsp;·&nbsp; {Math.round(info.avg_confidence * 100)}% conf
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : !report?.error ? (
                                        <div className="result-banner">
                                            <span className="dot info" />
                                            <span>No objects detected above confidence threshold.</span>
                                        </div>
                                    ) : null}

                                    {/* Security warnings */}
                                    <div className="ai-report">
                                        <h4>Security Alerts</h4>
                                        {report?.security_warnings && report.security_warnings.length > 0 ? (
                                            <div className="warnings-list">
                                                {report.security_warnings.map((warning, i) => (
                                                    <div key={i} className="result-banner warning-banner">
                                                        <span className="dot warning" />
                                                        <span>{warning}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="result-banner safe-banner">
                                                <span className="dot safe" />
                                                <span>No security threats detected.</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="cta-area">
                                        <button className="analyze-btn secondary">Download Full Report</button>
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

export default VideoUpload;
