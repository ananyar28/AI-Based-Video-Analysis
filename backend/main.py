"""
main.py — AegisVision FastAPI Backend
=======================================
Endpoints
---------
GET  /                          health check
POST /upload                    upload video (async processing)
GET  /video/{id}/status         poll analysis progress
GET  /video/{id}/results        get all frame-level detection results
POST /stream/start              start a live stream
DELETE /stream/{camera_id}      stop a live stream
GET  /stream/{camera_id}/status live stream health
"""

import os
import uuid
import logging
import asyncio
from datetime import datetime
import time
from typing import Dict

from dotenv import load_dotenv
load_dotenv()  # Load Vertex AI config from .env

from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import database
from frame_extractor import validate_video_file, extract_frames, get_video_metadata
from stream_extractor import StreamExtractor, validate_stream_url
from detection.runner import run_detection
from detection.schemas import FrameResult
from tracking import Tracker
from event_detection import EventEngine
import threading
from ws_manager import manager as ws_manager

global_tracker = Tracker()
global_event_engine = EventEngine()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("aegisvision")

# ---------------------------------------------------------------------------
# DB setup
# ---------------------------------------------------------------------------
models.Base.metadata.create_all(bind=database.engine)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AegisVision API",
    description="AI-Based Video Surveillance Analysis Backend",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def prewarm_vertex():
    """Send a dummy payload to Vertex AI to eliminate cold start."""
    from detection.vertex_client import detector as vertex_detector
    from frame_extractor import FrameData
    import numpy as np

    if vertex_detector.use_vertex:
        logger.info("[Vertex] Pre-warming endpoint to eliminate cold start...")
        try:
            # 1x1 black pixel
            dummy_image = np.zeros((1, 1, 3), dtype=np.uint8)
            dummy_frame = FrameData(
                frame_number=0,
                timestamp=0.0,
                image=dummy_image,
                video_metadata={},
                camera_id=None
            )
            # Catch exceptions here so we don't crash the thread silently,
            # but we also don't want to crash the server if pre-warming fails
            # (e.g., if traffic split is not set yet)
            try:
                vertex_detector.detect_batch([dummy_frame])
                logger.info("[Vertex] Endpoint pre-warming successful.")
            except Exception as inner_e:
                logger.warning(f"[Vertex] Pre-warming failed: {inner_e}")
                
        except Exception as e:
            logger.warning(f"[Vertex] Pre-warming setup failed: {e}")

@app.on_event("startup")
def on_startup():
    """Non-blocking initializations: tracker, event engine, and Vertex AI pre-warming."""
    threading.Thread(target=global_tracker.initialize, daemon=True).start()
    threading.Thread(target=global_event_engine.initialize, daemon=True).start()
    threading.Thread(target=prewarm_vertex, daemon=True).start()


# ---------------------------------------------------------------------------
# Upload config
# ---------------------------------------------------------------------------
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_UPLOAD_BYTES = 500 * 1024 * 1024   # 500 MB

# ---------------------------------------------------------------------------
# In-memory store for active streams  {camera_id → StreamExtractor}
# ---------------------------------------------------------------------------
active_streams: Dict[str, StreamExtractor] = {}


# ---------------------------------------------------------------------------
# DB dependency
# ---------------------------------------------------------------------------
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ===========================================================================
# Background task — runs the full pipeline after upload returns
# ===========================================================================
def _process_video(video_id: int, file_path: str):
    """
    Background task: extract frames → run detection → save results to DB.
    Updates the Video row status throughout.

    Speed optimizations applied
    ---------------------------
    1. target_fps=2 — extracts 2 frames/sec instead of 5 → 60% fewer frames.
    2. Batch Vertex AI calls — packs BATCH_SIZE frames into one HTTP predict()
       call, cutting network round-trips by up to 10×.
    """
    from detection.vertex_client import detector as vertex_detector, BATCH_SIZE
    from detection.merger import merge_results

    db = database.SessionLocal()
    try:
        video = db.query(models.Video).filter(models.Video.id == video_id).first()
        if not video:
            logger.error(f"[BG] Video {video_id} not found in DB.")
            return

        # ── 1. Read metadata and update Video row ───────────────────────
        try:
            meta = get_video_metadata(file_path)
            video.fps              = meta["fps"]
            video.resolution       = meta["resolution"]
            video.total_frames     = meta["total_frames"]
            video.duration_seconds = meta["duration_seconds"]
            video.status           = "processing"
            db.commit()
        except Exception as e:
            logger.error(f"[BG] Metadata read failed for video {video_id}: {e}")
            video.status = "failed"
            db.commit()
            return

        TARGET_FPS = 2   # 2fps → ~60% fewer frames than before (was 5fps)
        logger.info(
            f"[BG] Starting analysis for video {video_id} | "
            f"{meta['duration_seconds']}s | {meta['total_frames']} frames | "
            f"{meta['fps']} fps → extracting at {TARGET_FPS} fps | "
            f"batch_size={BATCH_SIZE}"
        )

        frames_analyzed = 0

        # ── 2. Batch loop ────────────────────────────────────────────────
        # Collect BATCH_SIZE frames, send to Vertex in one HTTP call,
        # then save all results. This is the main speedup.
        batch: list = []
        batch_start_time = time.time()

        def _process_batch(batch_frames):
            """Send one batch to Vertex AI and save all results to DB."""
            nonlocal frames_analyzed, batch_start_time
            
            t_extract = time.time() - batch_start_time
            logger.info(f"[BG] Frame extraction for {len(batch_frames)} frames took {t_extract:.3f}s")

            if vertex_detector.use_vertex:
                # ONE HTTP round-trip for all frames in the batch
                t_vertex_start = time.time()
                batch_results = vertex_detector.detect_batch(batch_frames)
                t_vertex = time.time() - t_vertex_start
                logger.info(f"[BG] Vertex AI detect_batch took {t_vertex:.3f}s")
                
                t_track_start = time.time()
                for frame_data, (obj_dets, weapon_dets, fire_dets) in zip(batch_frames, batch_results):
                    result: FrameResult = merge_results(frame_data, obj_dets, weapon_dets, fire_dets)
                    result.tracked_objects = global_tracker.update(result.trackable_objects, frame_data)
                    event_payload = global_event_engine.process_frame(result.tracked_objects, frame_data.frame_number, frame_data.timestamp)
                    result.events = event_payload["events"]
                    _save_result(result)
                    frames_analyzed += 1
                t_track = time.time() - t_track_start
                logger.info(f"[BG] Tracking & DB save took {t_track:.3f}s")
            else:
                # Fallback: local detectors (CPU), one at a time
                t_local_start = time.time()
                for frame_data in batch_frames:
                    result: FrameResult = run_detection(frame_data)
                    result.tracked_objects = global_tracker.update(result.trackable_objects, frame_data)
                    event_payload = global_event_engine.process_frame(result.tracked_objects, frame_data.frame_number, frame_data.timestamp)
                    result.events = event_payload["events"]
                    _save_result(result)
                    frames_analyzed += 1
                t_local = time.time() - t_local_start
                logger.info(f"[BG] Local CPU detection & tracking took {t_local:.3f}s")

            # Commit after each batch and update progress
            video.frames_analyzed = frames_analyzed
            db.commit()
            logger.info(f"[BG] Video {video_id}: {frames_analyzed} frames analyzed...")
            
            # Reset extraction timer for the next batch
            batch_start_time = time.time()

        def _save_result(result: FrameResult):
            """Persist a single FrameResult (and optional Alert) to DB."""
            db_frame = models.FrameResult(
                video_id=video_id,
                camera_id=None,
                frame_id=result.frame_id,
                timestamp=result.timestamp,
                threat_level=result.threat_level,
                threat_label=result.threat_label,
                detections=result.to_dict(),
            )
            db.add(db_frame)

            if result.threat_level >= 2:
                db_alert = models.Alert(
                    video_id=video_id,
                    camera_id=None,
                    timestamp=result.timestamp,
                    threat_level=result.threat_level,
                    threat_label=result.threat_label,
                )
                db.add(db_alert)
                
            for ev in result.events:
                ev_type = ev['event_type']
                t_level = 2
                if ev_type == "ABANDONED_OBJECT": t_level = 3
                if ev_type == "FIGHT_ASSAULT": t_level = 4
                
                db_alert = models.Alert(
                    video_id=video_id,
                    camera_id=None,
                    timestamp=ev['timestamp'],
                    threat_level=t_level,
                    threat_label=ev_type,
                )
                db.add(db_alert)

        # ── 3. Iterate frames and fill batches ───────────────────────────
        is_first_batch = True
        for frame_data in extract_frames(file_path, target_fps=TARGET_FPS):
            batch.append(frame_data)
            
            # Dynamic batch sizing: first batch is smaller for immediate UI feedback
            current_target_size = 2 if is_first_batch else BATCH_SIZE
            
            if len(batch) >= current_target_size:
                try:
                    _process_batch(batch)
                except Exception as e:
                    logger.warning(f"[BG] Batch failed for video {video_id}: {e}")
                    raise e
                batch = []
                is_first_batch = False

        # ── 4. Flush any remaining frames (last partial batch) ───────────
        if batch:
            try:
                _process_batch(batch)
            except Exception as e:
                logger.warning(f"[BG] Final batch failed for video {video_id}: {e}")
                raise e

        # ── 5. Final commit + mark completed ────────────────────────────
        video.frames_analyzed = frames_analyzed
        video.status = "completed"
        db.commit()
        logger.info(
            f"[BG] Video {video_id} analysis complete. "
            f"{frames_analyzed} frames processed in {BATCH_SIZE}-frame batches."
        )

    except Exception as e:
        logger.error(f"[BG] Unexpected error processing video {video_id}: {e}", exc_info=True)
        try:
            video = db.query(models.Video).filter(models.Video.id == video_id).first()
            if video:
                video.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ===========================================================================
# Routes
# ===========================================================================

@app.get("/")
def read_root():
    return {"message": "AegisVision API v2.0 — ready.", "docs": "/docs"}


# ---------------------------------------------------------------------------
# Video upload — async (returns immediately, processes in background)
# ---------------------------------------------------------------------------
@app.post("/upload")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a video file for analysis.

    Returns immediately with video_id and status='processing'.
    Poll GET /video/{id}/status to track progress.
    """
    # ── 1. Quick size check before reading ──────────────────────────────
    # content_length may be None for chunked uploads; we check after save
    original_name = file.filename or "upload"
    _, ext = os.path.splitext(original_name)
    ext = ext.lower()

    ALLOWED = {".mp4", ".avi", ".mov"}
    if ext not in ALLOWED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED)}"
        )

    # ── 2. Save with UUID prefix to avoid name collisions ───────────────
    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    file_path   = os.path.join(UPLOAD_DIR, unique_name)

    try:
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum allowed size: 500 MB."
            )
        with open(file_path, "wb") as f:
            f.write(contents)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # ── 3. Validate the saved file (extension + corruption check) ────────
    try:
        validate_video_file(file_path)
    except (ValueError, FileNotFoundError) as e:
        os.remove(file_path)   # clean up bad file
        raise HTTPException(status_code=400, detail=str(e))

    # ── 4. Create Video row in DB with status='pending' ──────────────────
    try:
        db_video = models.Video(
            filename=original_name,
            file_path=file_path,
            status="pending",
        )
        db.add(db_video)
        db.commit()
        db.refresh(db_video)
    except Exception as e:
        db.rollback()
        if os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f"[Upload] DB insert failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}. "
                   f"If you see 'column does not exist', run: "
                   f"venv\\Scripts\\python.exe migrate_db.py"
        )
    video_id = db_video.id


    # ── 5. Launch background processing (non-blocking) ───────────────────
    background_tasks.add_task(_process_video, video_id, file_path)

    logger.info(f"[Upload] Video {video_id} queued for processing: {original_name}")

    return {
        "video_id": video_id,
        "filename": original_name,
        "status":   "processing",
        "message":  f"Upload successful. Poll /video/{video_id}/status for progress.",
    }


# ---------------------------------------------------------------------------
# Video status polling
# ---------------------------------------------------------------------------
@app.get("/video/{video_id}/status")
def get_video_status(video_id: int, db: Session = Depends(get_db)):
    """
    Poll the processing status of an uploaded video.

    Returns status, progress %, and frame counts.
    """
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found.")

    total    = video.total_frames or 0
    analyzed = video.frames_analyzed or 0
    # Progress: analyzed vs expected extracted frames (at 2fps — matches TARGET_FPS in _process_video)
    extracted_expected = max(1, round(total / max(1, (video.fps or 30) / 2)))
    progress_pct = min(100, round((analyzed / extracted_expected) * 100)) if extracted_expected else 0

    return {
        "video_id":        video_id,
        "filename":        video.filename,
        "status":          video.status,
        "fps":             video.fps,
        "resolution":      video.resolution,
        "duration_seconds":video.duration_seconds,
        "total_frames":    video.total_frames,
        "frames_analyzed": analyzed,
        "progress_pct":    progress_pct if video.status == "processing" else
                           (100 if video.status == "completed" else 0),
    }


# ---------------------------------------------------------------------------
# Video results — all frame detections
# ---------------------------------------------------------------------------
@app.get("/video/{video_id}/results")
def get_video_results(video_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all frame-level detection results for a video.
    Only available after status = 'completed'.
    """
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found.")

    if video.status not in ("completed", "processing"):
        raise HTTPException(
            status_code=400,
            detail=f"Video is still in '{video.status}' state. Results not available yet."
        )

    frames = (
        db.query(models.FrameResult)
        .filter(models.FrameResult.video_id == video_id)
        .order_by(models.FrameResult.timestamp)
        .all()
    )

    alerts = (
        db.query(models.Alert)
        .filter(models.Alert.video_id == video_id)
        .order_by(models.Alert.timestamp)
        .all()
    )

    return {
        "video_id":      video_id,
        "filename":      video.filename,
        "status":        video.status,
        "total_frames_analyzed": len(frames),
        "alerts": [
            {
                "timestamp":   a.timestamp,
                "threat_level":a.threat_level,
                "threat_label":a.threat_label,
            }
            for a in alerts
        ],
        "frames": [
            {
                "frame_id":    f.frame_id,
                "timestamp":   f.timestamp,
                "threat_level":f.threat_level,
                "threat_label":f.threat_label,
                "detections":  f.detections,
            }
            for f in frames
        ],
    }


# ---------------------------------------------------------------------------
# Stream — start
# ---------------------------------------------------------------------------
@app.post("/stream/start")
def start_stream(
    url: str,
    camera_id: str,
    target_fps: int = 5,
    db: Session = Depends(get_db),
):
    """
    Start capturing and processing a live stream.

    Parameters
    ----------
    url       : RTSP / HTTP / HTTPS URL, or integer webcam index as string
    camera_id : unique identifier for this camera
    target_fps: frames per second to analyze (default: 5)
    """
    if camera_id in active_streams and active_streams[camera_id].is_running():
        raise HTTPException(
            status_code=409,
            detail=f"Stream '{camera_id}' is already running."
        )

    # Convert webcam index string to int if needed
    stream_url: str | int = url
    if url.isdigit():
        stream_url = int(url)

    # Validate stream reachability
    try:
        validate_stream_url(stream_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save to DB
    existing = db.query(models.Stream).filter(models.Stream.camera_id == camera_id).first()
    if existing:
        existing.status     = "active"
        existing.started_at = datetime.utcnow()
        existing.stopped_at = None
        existing.url        = url
    else:
        db.add(models.Stream(camera_id=camera_id, url=url, status="active"))
    db.commit()

    # Create and start extractor
    def stream_callback(result: FrameResult, frame_data):
        # We also need to save to DB (simulating what was there before, if needed, though previously stream wasn't saving to DB in the worker, wait, stream didn't save to DB before).
        width = frame_data.video_metadata.get("width", 1920)
        height = frame_data.video_metadata.get("height", 1080)
        metadata = {
            "type": "metadata",
            "camera_id": camera_id,
            "frame_id": frame_data.frame_number,
            "timestamp": frame_data.timestamp,
            "threat_level": result.threat_level,
            "threat_label": result.threat_label,
            "tracked_objects": result.tracked_objects,
            "events": result.events,
            "resolution": {"width": width, "height": height}
        }
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(ws_manager.broadcast_metadata(camera_id, metadata))
            loop.close()
        except Exception as e:
            logger.error(f"[WebSocket] Broadcast failed for {camera_id}: {e}")

    extractor = StreamExtractor(url=stream_url, camera_id=camera_id, target_fps=target_fps, on_result=stream_callback)
    extractor.start()
    active_streams[camera_id] = extractor

    logger.info(f"[Stream] Started '{camera_id}' from {url} at {target_fps} fps")

    return {
        "camera_id":  camera_id,
        "status":     "started",
        "target_fps": target_fps,
        "url":        url,
    }


# ---------------------------------------------------------------------------
# Stream — stop
# ---------------------------------------------------------------------------
@app.delete("/stream/{camera_id}")
def stop_stream(camera_id: str, db: Session = Depends(get_db)):
    """Stop and clean up a live stream by camera_id."""
    if camera_id not in active_streams:
        raise HTTPException(status_code=404, detail=f"Stream '{camera_id}' not found.")

    extractor = active_streams[camera_id]
    extractor.stop()
    del active_streams[camera_id]

    # Update DB
    stream = db.query(models.Stream).filter(models.Stream.camera_id == camera_id).first()
    if stream:
        stream.status     = "stopped"
        stream.stopped_at = datetime.utcnow()
        db.commit()

    logger.info(f"[Stream] Stopped '{camera_id}'")
    return {"camera_id": camera_id, "status": "stopped"}


# ---------------------------------------------------------------------------
# Stream — status
# ---------------------------------------------------------------------------
@app.get("/stream/{camera_id}/status")
def get_stream_status(camera_id: str):
    """Get health and frame stats for a running stream."""
    if camera_id not in active_streams:
        raise HTTPException(status_code=404, detail=f"Stream '{camera_id}' not found or not running.")

    return active_streams[camera_id].status()


# ---------------------------------------------------------------------------
# Stream — WebSocket (Metadata)
# ---------------------------------------------------------------------------
@app.websocket("/ws/stream/{camera_id}")
async def websocket_endpoint(websocket: WebSocket, camera_id: str):
    """
    WebSocket endpoint for real-time AI metadata broadcast.
    Client connects and listens for JSON payloads containing bounding boxes and events.
    """
    await ws_manager.connect(websocket, camera_id)
    try:
        while True:
            # We don't expect the client to send anything, but we must await to keep the connection open
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, camera_id)
