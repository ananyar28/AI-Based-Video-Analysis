import React, { useState } from 'react';
import './VideoUpload.css';

const VideoUpload: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzed, setIsAnalyzed] = useState(false);

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
            setIsAnalyzed(false); // Reset on new file
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
            setIsAnalyzed(false); // Reset on new file
        }
    };

    const handleAnalyze = () => {
        if (selectedFile) {
            setIsAnalyzed(true);
        }
    };

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
                                            setIsAnalyzed(false);
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

                    {/* Right Side: Summary/Output Zone */}
                    <div className="summary-card">
                        <div className="summary-header">
                            <h3>Analysis Summary</h3>
                            <span className="status-badge">
                                {selectedFile
                                    ? (isAnalyzed ? 'Analysis Complete' : 'Ready to Analyze')
                                    : 'Waiting for input'}
                            </span>
                        </div>

                        <div className="summary-content">
                            {!selectedFile ? (
                                <div className="empty-state">
                                    <p>Upload a video to see AI-generated insights, detected anomalies, and safety summaries here.</p>
                                </div>
                            ) : !isAnalyzed ? (
                                <div className="pre-analysis-state">
                                    <p>Video ready for processing.</p>
                                    <button className="analyze-btn" onClick={handleAnalyze}>
                                        Analyze Video
                                    </button>
                                </div>
                            ) : (
                                <div className="analysis-placeholder">
                                    <div className="placeholder-line width-80"></div>
                                    <div className="placeholder-line width-60"></div>
                                    <div className="placeholder-line width-90"></div>
                                    <div className="placeholder-item">
                                        <span className="dot warning"></span>
                                        <span>Potential security breach detected at 00:32</span>
                                    </div>
                                    <div className="placeholder-item">
                                        <span className="dot info"></span>
                                        <span>2 individuals identified in restricted zone</span>
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
