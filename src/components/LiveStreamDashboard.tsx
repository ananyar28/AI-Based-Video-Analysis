import React, { useEffect, useRef, useState } from 'react';
import { getStreamWSUrl, getStreamVideoUrl, type WSMetadataPayload } from '../services/api';
import { AlertContainer, type AlertData } from './AlertPopup';
import './LiveStreamDashboard.css';

interface LiveStreamDashboardProps {
    cameraId: string;
    onStop: () => void;
}

const LiveStreamDashboard: React.FC<LiveStreamDashboardProps> = ({ cameraId, onStop }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [latestMetadata, setLatestMetadata] = useState<WSMetadataPayload | null>(null);
    const [alerts, setAlerts] = useState<AlertData[]>([]);
    
    // Stats
    const [framesAnalyzed, setFramesAnalyzed] = useState(0);

    // Backend Proxy Stream URL
    const proxyUrl = getStreamVideoUrl(cameraId);

    // WebSocket Connection & Metadata Handling
    useEffect(() => {
        const wsUrl = getStreamWSUrl(cameraId);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setWsStatus('connected');
        ws.onerror = () => setWsStatus('error');
        ws.onclose = () => setWsStatus('error');

        ws.onmessage = (event) => {
            try {
                const data: WSMetadataPayload = JSON.parse(event.data);
                if (data.type === 'metadata') {
                    setLatestMetadata(data);
                    setFramesAnalyzed(prev => prev + 1);
                    
                    // Handle new events for alerts
                    if (data.events && data.events.length > 0) {
                        setAlerts(prev => {
                            const newAlerts = [...prev];
                            data.events.forEach(ev => {
                                // Prevent duplicate alerts for the same event in a short window using a unique ID
                                const alertId = `${ev.event_type}-${ev.timestamp}`;
                                if (!newAlerts.some(a => a.id === alertId)) {
                                    newAlerts.push({
                                        id: alertId,
                                        type: ev.event_type,
                                        level: data.threat_level >= 2 ? data.threat_level : 2, // Ensure behavioral events have a visible level
                                        timestamp: ev.timestamp,
                                        confidence: ev.confidence,
                                        details: `IDs: ${ev.object_ids.join(', ')}`
                                    });
                                }
                            });
                            return newAlerts;
                        });
                    }
                    
                    // Trigger draw on canvas
                    drawOverlay(data);
                }
            } catch (err) {
                console.error("Failed to parse WS message", err);
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [cameraId]);

    const handleDismissAlert = (id: string) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    // Canvas Drawing Logic (Best Effort Sync)
    const drawOverlay = (metadata: WSMetadataPayload) => {
        const canvas = canvasRef.current;
        
        let displayWidth = 0;
        let displayHeight = 0;

        if (imgRef.current) {
            displayWidth = imgRef.current.clientWidth;
            displayHeight = imgRef.current.clientHeight;
        }

        if (!canvas || displayWidth === 0 || displayHeight === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Match canvas internal resolution to display size
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate scaling factors (AI Resolution -> Display Resolution)
        const scaleX = canvas.width / metadata.resolution.width;
        const scaleY = canvas.height / metadata.resolution.height;

        // 1. Draw all detections (burned-in backend boxes are backup, these are high-res)
        metadata.detections.forEach(det => {
            const [x, y, w, h] = det.bbox;
            const x1 = x * scaleX;
            const y1 = y * scaleY;
            const width = w * scaleX;
            const height = h * scaleY;

            let color = '#10b981'; // green
            if (det.source === 'weapon') color = '#ef4444'; // red
            if (det.source === 'fire') color = '#f97316'; // orange

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // Dashed line for raw detections
            ctx.strokeRect(x1, y1, width, height);
            ctx.setLineDash([]); // Reset
        });

        // 2. Draw tracked objects (solid lines, more prominent)
        metadata.tracked_objects.forEach(obj => {
            const x1 = obj.bbox[0] * scaleX;
            const y1 = obj.bbox[1] * scaleY;
            const x2 = obj.bbox[2] * scaleX;
            const y2 = obj.bbox[3] * scaleY;
            const width = x2 - x1;
            const height = y2 - y1;

            let color = '#10b981'; 
            if (obj.class === 'vehicle' || obj.class === 'car') color = '#3b82f6';

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x1, y1, width, height);

            // Label
            ctx.fillStyle = color;
            const label = `${obj.class.toUpperCase()} #${obj.id} ${(obj.confidence * 100).toFixed(0)}%`;
            ctx.font = 'bold 14px Inter, system-ui';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x1 + 5, y1 - 8);
        });
    };

    // Calculate Counts
    const getCounts = () => {
        if (!latestMetadata) return { person: 0, weapon: 0, fire: 0, total: 0 };
        const counts = { person: 0, weapon: 0, fire: 0, total: 0 };
        latestMetadata.detections.forEach(d => {
            if (d.class_name === 'person') counts.person++;
            if (d.source === 'weapon') counts.weapon++;
            if (d.source === 'fire') counts.fire++;
            counts.total++;
        });
        return counts;
    };

    const counts = getCounts();

    return (
        <div className="dashboard-container">
            <AlertContainer alerts={alerts} onDismiss={handleDismissAlert} />
            
            <div className="dashboard-layout">
                {/* Video Feed & Canvas Overlay */}
                <div className="video-section">
                    <div className="connection-status">
                        <div className={`status-dot ${wsStatus}`} />
                        <span>{wsStatus === 'connected' ? 'AI Sync Active' : 'Connecting AI...'}</span>
                    </div>
                    
                    <img 
                        ref={imgRef}
                        src={proxyUrl}
                        className="video-element"
                        alt="Live Surveillance Feed"
                        onError={(e) => {
                            console.error("Stream load error");
                            (e.target as HTMLImageElement).src = 'about:blank';
                        }}
                    />
                    
                    {/* The transparent canvas for bounding boxes */}
                    <canvas ref={canvasRef} className="overlay-canvas" />
                </div>

                {/* Live Stats Sidebar */}
                <div className="stats-sidebar">
                    <div className="stat-card main-stat">
                        <span className="stat-label">AI Status</span>
                        <div className={`threat-indicator threat-${latestMetadata?.threat_level || 0}`}>
                            {latestMetadata?.threat_label || 'NORMAL'}
                        </div>
                        <p className="threat-reason">{latestMetadata?.threat_reason || 'Scanning for threats...'}</p>
                    </div>

                    <div className="counts-grid">
                        <div className="count-item">
                            <span className="count-val">{counts.person}</span>
                            <span className="count-label">Humans</span>
                        </div>
                        <div className="count-item warning">
                            <span className="count-val">{counts.weapon}</span>
                            <span className="count-label">Weapons</span>
                        </div>
                        <div className="count-item error">
                            <span className="count-val">{counts.fire}</span>
                            <span className="count-label">Fire</span>
                        </div>
                    </div>

                    <div className="stat-card">
                        <span className="stat-label">Detections & Confidence</span>
                        <div className="tracked-objects-list">
                            {latestMetadata?.detections.length === 0 && (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No objects detected</div>
                            )}
                            {latestMetadata?.detections.map((det, idx) => (
                                <div key={idx} className="tracked-item">
                                    <div className="det-info">
                                        <span className={`det-source ${det.source}`}>{det.source.charAt(0).toUpperCase()}</span>
                                        <span className="tracked-class">{det.class_name}</span>
                                    </div>
                                    <div className="conf-bar-wrapper">
                                        <div className="conf-bar" style={{ width: `${det.confidence * 100}%`, background: det.source === 'weapon' ? 'var(--error)' : 'var(--accent-color)' }} />
                                        <span className="tracked-conf">{(det.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="footer-stats">
                        <div className="mini-stat">
                            <span>Frames: {framesAnalyzed}</span>
                        </div>
                        <div className="mini-stat">
                            <span>FPS: 5.0</span>
                        </div>
                    </div>

                    <button className="stop-btn" onClick={onStop}>
                        Stop Stream Analysis
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiveStreamDashboard;
