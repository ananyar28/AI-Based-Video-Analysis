"""
frame_extractor.py
==================
Handles validation and frame extraction for uploaded video files.

Flow:
  validate_video_file(path)  → raises ValueError on bad input
  extract_frames(path)       → generator yielding FrameData objects
  get_video_metadata(path)   → returns metadata dict without extracting frames
"""

import os
import cv2
from dataclasses import dataclass, field
from typing import Generator
import numpy as np

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov"}
MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024   # 500 MB
DEFAULT_TARGET_FPS = 5                    # frames per second to extract


# ---------------------------------------------------------------------------
# Shared data structure — also imported by detection layer
# ---------------------------------------------------------------------------
@dataclass
class FrameData:
    """
    Represents a single extracted frame ready for detection.

    Attributes
    ----------
    frame_number   : absolute frame index in the source video/stream
    timestamp      : time in seconds (frame_number / native_fps)
    image          : BGR numpy array — NOT saved to disk, lives in RAM only
    video_metadata : dict with fps, resolution, duration info
    camera_id      : set for live stream frames; None for video file frames
    """
    frame_number: int
    timestamp: float
    image: np.ndarray
    video_metadata: dict = field(default_factory=dict)
    camera_id: str = None


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_video_file(path: str) -> None:
    """
    Validate a video file before processing.

    Checks:
    1. File extension is in ALLOWED_EXTENSIONS (.mp4, .avi, .mov)
    2. File size does not exceed MAX_FILE_SIZE_BYTES (500 MB)
    3. OpenCV can open the file (i.e. file is not corrupt/unreadable)

    Parameters
    ----------
    path : str
        Absolute or relative path to the video file.

    Raises
    ------
    ValueError
        With a descriptive message if any check fails.
    FileNotFoundError
        If the file does not exist at the given path.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Video file not found: {path}")

    # 1. Extension check
    _, ext = os.path.splitext(path)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            f"Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 2. File size check
    size_bytes = os.path.getsize(path)
    if size_bytes > MAX_FILE_SIZE_BYTES:
        size_mb = size_bytes / (1024 * 1024)
        limit_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
        raise ValueError(
            f"File too large ({size_mb:.1f} MB). Maximum allowed: {limit_mb:.0f} MB."
        )

    # 3. Corruption / readability check
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        cap.release()
        raise ValueError(f"File appears corrupt or unreadable: {path}")

    # Try reading one frame to confirm the file is truly valid
    success, _ = cap.read()
    cap.release()
    if not success:
        raise ValueError(
            f"File could be opened but no frames could be read. "
            f"It may be empty or corrupt: {path}"
        )


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------
def get_video_metadata(path: str) -> dict:
    """
    Read video metadata without extracting any frames.

    Returns
    -------
    dict with keys:
        fps            : float  — native frames per second
        width          : int    — frame width in pixels
        height         : int    — frame height in pixels
        total_frames   : int    — total number of frames in video
        duration_seconds : float — total duration in seconds
        resolution     : str   — e.g. "1920x1080"
    """
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video for metadata: {path}")

    fps           = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width         = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height        = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    duration = total_frames / fps if fps > 0 else 0.0

    return {
        "fps":              round(fps, 2),
        "width":            width,
        "height":           height,
        "total_frames":     total_frames,
        "duration_seconds": round(duration, 2),
        "resolution":       f"{width}x{height}",
    }


# ---------------------------------------------------------------------------
# Frame Extraction
# ---------------------------------------------------------------------------
def extract_frames(
    path: str,
    target_fps: int = DEFAULT_TARGET_FPS,
    resize_to: int = 640
) -> Generator[FrameData, None, None]:
    """
    Extract sampled frames from a video file as a generator.
    Uses fast seeking to skip redundant frames.
    """
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video for extraction: {path}")

    native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    metadata = {
        "fps": round(native_fps, 2),
        "width": width,
        "height": height,
        "total_frames": total_frames,
        "duration_seconds": round(total_frames / native_fps, 2) if native_fps > 0 else 0.0,
        "resolution": f"{width}x{height}",
    }

    interval = max(1, round(native_fps / target_fps))
    
    current_frame = 0
    try:
        while current_frame < total_frames:
            # Fast seek to the target frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame)
            success, frame = cap.read()
            if not success:
                break

            # Optimization: Downscale if image is larger than target
            # YOLO models usually perform best at 640px
            if resize_to and (width > resize_to or height > resize_to):
                h, w = frame.shape[:2]
                scale = resize_to / max(w, h)
                new_size = (int(w * scale), int(h * scale))
                frame = cv2.resize(frame, new_size, interpolation=cv2.INTER_LINEAR)

            yield FrameData(
                frame_number=current_frame,
                timestamp=round(current_frame / native_fps, 4),
                image=frame,
                video_metadata=metadata,
                camera_id=None,
            )

            current_frame += interval

    finally:
        cap.release()
