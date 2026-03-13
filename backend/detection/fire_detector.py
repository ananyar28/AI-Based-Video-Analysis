"""
detection/fire_detector.py
===========================
YOLOv8s fire detection model.

Model : models/fire_detector.pt  (your custom-trained YOLOv8s)
Role  : Detect fire and smoke in frames.

All fire/smoke detections have track=False — they are alert-only objects.
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
CONFIDENCE_THRESHOLD = 0.4

# ---------------------------------------------------------------------------
# Model — loaded lazily on first call
# ---------------------------------------------------------------------------
def _resolve_model_path() -> str:
    """Find fire_detector.pt in backend/models/."""
    base = os.path.dirname(__file__)             # detection/
    backend = os.path.dirname(base)              # backend/
    # Allow override via environment variable
    env_path = os.environ.get("FIRE_MODEL_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    path = os.path.join(backend, "models", "fire_detector.pt")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Fire detection model not found at: {path}\n"
            f"Please place fire_detector.pt in backend/models/ "
            f"or set the FIRE_MODEL_PATH environment variable."
        )
    return path


_model: YOLO = None


def _get_model() -> YOLO:
    global _model
    if _model is None:
        path = _resolve_model_path()
        logger.info(f"[FireDetector] Loading model from: {path}")
        from .runner import get_device
        device = get_device()
        _model = YOLO(path).to(device)
        logger.info(f"[FireDetector] Model loaded on {device}. Classes: {_model.names}")
    return _model


# ---------------------------------------------------------------------------
# Detection function
# ---------------------------------------------------------------------------
def detect(frame_data: FrameData) -> List[Detection]:
    """
    Run the fire detection model on a single frame.

    Parameters
    ----------
    frame_data : FrameData — contains the BGR image array

    Returns
    -------
    List[Detection] — all fire/smoke detections above confidence threshold.
    Empty list if none found.
    """
    try:
        model = _get_model()
    except FileNotFoundError as e:
        logger.error(f"[FireDetector] {e}")
        return []

    results = model(frame_data.image, conf=CONFIDENCE_THRESHOLD, verbose=False)
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
                track=False,      # fire/smoke — alert only, don't track
                source="fire",
            ))

    return detections
