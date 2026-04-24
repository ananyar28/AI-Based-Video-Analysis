/**
 * api.ts — Centralized API client for AegisVision backend
 * ========================================================
 * All backend endpoint calls are defined here with typed
 * request/response interfaces matching the FastAPI backend.
 */

const API_BASE = 'http://localhost:8000';

// ─── Response Types ──────────────────────────────────────

export interface UploadResponse {
    video_id: number;
    filename: string;
    status: string;
    message: string;
}

export interface VideoStatusResponse {
    video_id: number;
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    fps: number | null;
    resolution: string | null;
    duration_seconds: number | null;
    total_frames: number | null;
    frames_analyzed: number;
    progress_pct: number;
}

export interface DetectionItem {
    class_id: number;
    class_name: string;
    confidence: number;
    bbox: number[];
    track: boolean;
    source: 'object' | 'fire' | 'weapon';
}

export interface FrameDetections {
    frame_id: number;
    timestamp: number;
    threat_level: number;
    threat_label: string;
    object_detections: DetectionItem[];
    weapon_detections: DetectionItem[];
    fire_detections: DetectionItem[];
    trackable_objects: DetectionItem[];
    alert_objects: DetectionItem[];
}

export interface AlertItem {
    timestamp: number;
    threat_level: number;
    threat_label: string;
}

export interface FrameResultItem {
    frame_id: number;
    timestamp: number;
    threat_level: number;
    threat_label: string;
    detections: FrameDetections;
}

export interface VideoResultsResponse {
    video_id: number;
    filename: string;
    status: string;
    total_frames_analyzed: number;
    alerts: AlertItem[];
    frames: FrameResultItem[];
}

export interface StreamStartResponse {
    camera_id: string;
    status: string;
    target_fps: number;
    url: string;
}

export interface StreamStatusResponse {
    camera_id: string;
    status: string;
    url: string | number;
    target_fps: number;
    frames_captured: number;
    frames_processed: number;
    running: boolean;
    uptime_seconds: number;
    errors: number;
}

// ─── WebSocket Types ─────────────────────────────────────

export interface TrackedObject {
    id: number;
    class: string;
    bbox: number[]; // [x1, y1, x2, y2]
    center: number[];
    confidence: number;
}

export interface EventItem {
    event_type: string;
    confidence: number;
    object_ids: number[];
    timestamp: number;
    frame_id: number;
}

export interface WSMetadataPayload {
    type: 'metadata';
    camera_id: string;
    frame_id: number;
    timestamp: number;
    threat_level: number;
    threat_label: string;
    tracked_objects: TrackedObject[];
    events: EventItem[];
    resolution: { width: number; height: number };
}

// ─── API Functions ───────────────────────────────────────

/**
 * Upload a video for async analysis.
 * Returns immediately with video_id; poll status with getVideoStatus().
 */
export async function uploadVideo(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || `Upload failed (${res.status})`);
    }

    return res.json();
}

/**
 * Poll the processing status of an uploaded video.
 */
export async function getVideoStatus(videoId: number): Promise<VideoStatusResponse> {
    const res = await fetch(`${API_BASE}/video/${videoId}/status`);

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Status fetch failed' }));
        throw new Error(err.detail || `Status fetch failed (${res.status})`);
    }

    return res.json();
}

/**
 * Retrieve all frame-level detection results for a completed video.
 */
export async function getVideoResults(videoId: number): Promise<VideoResultsResponse> {
    const res = await fetch(`${API_BASE}/video/${videoId}/results`);

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Results fetch failed' }));
        throw new Error(err.detail || `Results fetch failed (${res.status})`);
    }

    return res.json();
}

/**
 * Start capturing a live stream.
 */
export async function startStream(
    url: string,
    cameraId: string,
    targetFps: number = 5,
): Promise<StreamStartResponse> {
    const params = new URLSearchParams({
        url,
        camera_id: cameraId,
        target_fps: String(targetFps),
    });

    const res = await fetch(`${API_BASE}/stream/start?${params}`, {
        method: 'POST',
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Stream start failed' }));
        throw new Error(err.detail || `Stream start failed (${res.status})`);
    }

    return res.json();
}

/**
 * Stop a live stream by camera ID.
 */
export async function stopStream(cameraId: string): Promise<{ camera_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/stream/${encodeURIComponent(cameraId)}`, {
        method: 'DELETE',
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Stream stop failed' }));
        throw new Error(err.detail || `Stream stop failed (${res.status})`);
    }

    return res.json();
}

/**
 * Get health and frame stats for a running stream.
 */
export async function getStreamStatus(cameraId: string): Promise<StreamStatusResponse> {
    const res = await fetch(`${API_BASE}/stream/${encodeURIComponent(cameraId)}/status`);

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Stream status failed' }));
        throw new Error(err.detail || `Stream status failed (${res.status})`);
    }

    return res.json();
}

/**
 * Get the WebSocket URL for streaming AI metadata.
 */
export function getStreamWSUrl(cameraId: string): string {
    return `ws://localhost:8000/ws/stream/${encodeURIComponent(cameraId)}`;
}

/**
 * Get the Backend Video Proxy URL (MJPEG stream).
 */
export function getStreamVideoUrl(cameraId: string): string {
    return `${API_BASE}/stream/${encodeURIComponent(cameraId)}/video`;
}
