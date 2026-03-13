"""
detection/weapon_detector.py
=============================
YOLOv8s weapon detection model.

Model : models/weapons_detector.pt  (your custom-trained YOLOv8s)
Role  : Detect weapons (guns, knives, etc.) in frames.

⚠️ GRACEFUL FALLBACK: If the model file is not found, this module logs a
warning and returns an empty list rather than crashing the pipeline.
This allows the rest of the detection layer (object + fire) to keep working
while the weapon model is being set up.

All weapon detections have track=False — they are alert-only objects.
"""

import os
import logging
from typing import List

from ultralytics import YOLO
from .schemas import Detection, FrameData

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONFIDENCE_THRESHOLD = 0.5      # slightly higher to reduce false positives

# ---------------------------------------------------------------------------
# Model — loaded lazily, with graceful fallback if file not found
# ---------------------------------------------------------------------------
def _resolve_model_path() -> str | None:
    """
    Find weapons_detector.pt in backend/models/.
    Returns None if the file doesn't exist (triggers graceful skip).
    """
    base = os.path.dirname(__file__)
    backend = os.path.dirname(base)

    # Allow override via environment variable
    env_path = os.environ.get("WEAPON_MODEL_PATH")
    if env_path:
        if os.path.exists(env_path):
            return env_path
        logger.warning(f"[WeaponDetector] WEAPON_MODEL_PATH set but file not found: {env_path}")

    path = os.path.join(backend, "models", "weapons_detector.pt")
    if os.path.exists(path):
        return path

    # File not found — return None, caller handles gracefully
    return None


_model: YOLO = None
_model_available: bool = None   # None = not checked yet


def _get_model() -> YOLO | None:
    """
    Returns the loaded YOLO model, or None if model file is unavailable.
    The availability check is done once and cached.
    """
    global _model, _model_available

    # Already checked and confirmed unavailable
    if _model_available is False:
        return None

    # Already loaded
    if _model is not None:
        return _model

    path = _resolve_model_path()

    if path is None:
        logger.warning(
            "[WeaponDetector] weapons_detector.pt not found in backend/models/. "
            "Weapon detection is DISABLED. All frames will return empty weapon detections. "
            "Add weapons_detector.pt to models/ folder and restart to enable."
        )
        _model_available = False
        return None

    try:
        logger.info(f"[WeaponDetector] Loading model from: {path}")
        from .runner import get_device
        device = get_device()
        _model = YOLO(path).to(device)
        _model_available = True
        logger.info(f"[WeaponDetector] Model loaded on {device}. Classes: {_model.names}")
        return _model
    except Exception as e:
        logger.error(f"[WeaponDetector] Failed to load model: {e}")
        _model_available = False
        return None


# ---------------------------------------------------------------------------
# Detection function
# ---------------------------------------------------------------------------
def detect(frame_data: FrameData) -> List[Detection]:
    """
    Run the weapon detection model on a single frame.

    Parameters
    ----------
    frame_data : FrameData — contains the BGR image array

    Returns
    -------
    List[Detection] — all weapon detections above confidence threshold.
    Empty list if model not available or no weapons found.
    """
    model = _get_model()
    if model is None:
        return []   # graceful fallback — no crash

    try:
        results = model(frame_data.image, conf=CONFIDENCE_THRESHOLD, verbose=False)
    except Exception as e:
        logger.error(f"[WeaponDetector] Inference error: {e}")
        return []

    detections: List[Detection] = []

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            class_name = model.names[cls_id]
            confidence = float(box.conf[0])

            # Convert xyxy → xywh
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            bbox = [x1, y1, x2 - x1, y2 - y1]

            detections.append(Detection(
                class_id=cls_id,
                class_name=class_name,
                confidence=confidence,
                bbox=bbox,
                track=False,      # weapons — alert only, don't track
                source="weapon",
            ))

    return detections


def is_available() -> bool:
    """Check if the weapon model is loaded and ready."""
    return _get_model() is not None
