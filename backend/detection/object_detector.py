"""
detection/object_detector.py
=============================
YOLOv8n general object detector with whitelist class filtering.

Model : yolov8n.pt (COCO-pretrained, 80 classes)
Role  : Detect persons, vehicles, and suspicious objects.
        Everything else (chairs, clocks, TVs, etc.) is silently ignored.

Whitelist
---------
Trackable (forwarded to DeepSORT):
    0  person       — core human tracking
    1  bicycle      — vehicle tracking
    2  car          — vehicle tracking
    3  motorcycle   — vehicle tracking
    5  bus          — vehicle tracking
    7  truck        — vehicle tracking

Alert-only (flagged, not tracked):
    24 backpack     — unattended object
    26 handbag      — unattended object
    28 suitcase     — suspicious / unattended
    43 knife        — basic threat hint
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

# Whitelist: class_id → (class_name, track_flag)
# track=True  → person/vehicle → DeepSORT
# track=False → bags/knife    → alert only
WHITELIST: dict[int, tuple[str, bool]] = {
    0:  ("person",    True),
    1:  ("bicycle",   True),
    2:  ("car",       True),
    3:  ("motorcycle",True),
    5:  ("bus",       True),
    7:  ("truck",     True),
    24: ("backpack",  False),
    26: ("handbag",   False),
    28: ("suitcase",  False),
    43: ("knife",     False),
}

# ---------------------------------------------------------------------------
# Model — loaded once at module import (singleton)
# ---------------------------------------------------------------------------
def _resolve_model_path() -> str:
    """Find yolov8n.pt relative to this file (../../models/yolov8n.pt)."""
    base = os.path.dirname(__file__)               # detection/
    backend = os.path.dirname(base)                # backend/
    path = os.path.join(backend, "models", "yolov8n.pt")
    if not os.path.exists(path):
        # Fallback: ultralytics will auto-download
        logger.warning(f"yolov8n.pt not found at {path}. Ultralytics will attempt download.")
        return "yolov8n.pt"
    return path

_model: YOLO = None   # loaded lazily on first call


def _get_model() -> YOLO:
    global _model
    if _model is None:
        path = _resolve_model_path()
        logger.info(f"[ObjectDetector] Loading model from: {path}")
        _model = YOLO(path)
        logger.info("[ObjectDetector] Model loaded.")
    return _model


# ---------------------------------------------------------------------------
# Detection function
# ---------------------------------------------------------------------------
def detect(frame_data: FrameData) -> List[Detection]:
    """
    Run YOLOv8n on a single frame and return whitelisted detections.

    Parameters
    ----------
    frame_data : FrameData — contains the BGR image array

    Returns
    -------
    List[Detection] — only objects in the WHITELIST, with track flag set.
    Empty list if no whitelisted objects are detected.
    """
    model = _get_model()
    results = model(frame_data.image, conf=CONFIDENCE_THRESHOLD, verbose=False)
    detections: List[Detection] = []

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])

            # Skip classes not in whitelist
            if cls_id not in WHITELIST:
                continue

            class_name, track = WHITELIST[cls_id]
            confidence = float(box.conf[0])

            # Convert xyxy → xywh
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            bbox = [x1, y1, x2 - x1, y2 - y1]  # [x, y, w, h]

            detections.append(Detection(
                class_id=cls_id,
                class_name=class_name,
                confidence=confidence,
                bbox=bbox,
                track=track,
                source="object",
            ))

    return detections
