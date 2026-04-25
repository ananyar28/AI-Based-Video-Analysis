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

        // Draw non-tracked detections (weapons, bags, fire, etc.)
        if (metadata.all_detections) {
            metadata.all_detections.forEach(det => {
                if (det.track) return; // Skip trackable objects, handled below

                const x = det.bbox[0] * scaleX;
                const y = det.bbox[1] * scaleY;
                const width = det.bbox[2] * scaleX;
                const height = det.bbox[3] * scaleY;

                let color = '#f59e0b'; // orange for bags, etc.
                if (det.source === 'weapon' || det.class_name === 'fire') color = '#ef4444'; // red for weapons/fire

                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                ctx.fillStyle = color;
                const label = `${det.class_name.toUpperCase()} ${(det.confidence * 100).toFixed(0)}%`;
                ctx.font = '14px Arial';
                const textWidth = ctx.measureText(label).width;
                ctx.fillRect(x, y - 20, textWidth + 10, 20);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, x + 5, y - 5);
            });
        }

        // Draw tracked objects (person, vehicles)
        metadata.tracked_objects.forEach(obj => {
            // The bbox from tracker is [x1, y1, x2, y2]
            const x1 = obj.bbox[0] * scaleX;
            const y1 = obj.bbox[1] * scaleY;
            const x2 = obj.bbox[2] * scaleX;
            const y2 = obj.bbox[3] * scaleY;
            const width = x2 - x1;
            const height = y2 - y1;

            // Determine color based on class
            let color = '#10b981'; // default green (person)
            if (obj.class === 'vehicle' || obj.class === 'car') color = '#3b82f6';
            if (['bag', 'backpack', 'suitcase'].includes(obj.class)) color = '#f59e0b';

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x1, y1, width, height);

            // Label
            ctx.fillStyle = color;
            const label = `${obj.class.toUpperCase()} #${obj.id} ${(obj.confidence * 100).toFixed(0)}%`;
            ctx.font = '14px Arial';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x1, y1 - 20, textWidth + 10, 20);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x1 + 5, y1 - 5);
        });
    };

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
                    <div className="stat-card">
                        <span className="stat-label">AI Frames Analyzed</span>
                        <span className="stat-value">{framesAnalyzed}</span>
                    </div>

                    <div className={`threat-indicator threat-${latestMetadata?.threat_level || 0}`}>
                        THREAT LEVEL: {latestMetadata?.threat_label || 'NORMAL'}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '0.5rem', overflow: 'hidden' }}>
                        <span className="stat-label">Detected Objects</span>
                        <div className="tracked-objects-list" style={{ overflowY: 'auto' }}>
                            {(!latestMetadata?.tracked_objects.length && !latestMetadata?.all_detections?.filter(d => !d.track).length) && (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No objects detected</div>
                            )}
                            
                            {/* Tracked Objects */}
                            {latestMetadata?.tracked_objects.map(obj => (
                                <div key={`tracked-${obj.id}`} className="tracked-item">
                                    <div>
                                        <span className="tracked-id">#{obj.id}</span>
                                        <span className="tracked-class">{obj.class}</span>
                                    </div>
                                    <span className="tracked-conf">{(obj.confidence * 100).toFixed(0)}%</span>
                                </div>
                            ))}

                            {/* Untracked Detections (weapons, fire, bags) */}
                            {latestMetadata?.all_detections?.filter(d => !d.track).map((det, idx) => (
                                <div key={`untracked-${idx}`} className="tracked-item">
                                    <div>
                                        <span className="tracked-class" style={{ color: (det.source === 'weapon' || det.class_name === 'fire') ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                                            {det.class_name.toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="tracked-conf">{(det.confidence * 100).toFixed(0)}%</span>
                                </div>
                            ))}
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
