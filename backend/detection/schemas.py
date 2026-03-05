"""
detection/schemas.py
====================
Shared dataclasses used by every module in the detection package.
Import these instead of defining your own — keeps everything consistent.

    FrameData   → one extracted frame (from video or stream)
    Detection   → one detected object from a single model
    FrameResult → merged output from all 3 models for one frame
"""

from dataclasses import dataclass, field
from typing import List, Optional
import numpy as np


# ---------------------------------------------------------------------------
# Threat Level constants — used by merger.py and alert engine
# ---------------------------------------------------------------------------
THREAT_LEVELS = {
    0: "NORMAL",
    2: "WARNING",
    3: "CRITICAL",
    4: "URGENT",
    5: "EMERGENCY",
}


# ---------------------------------------------------------------------------
# FrameData — produced by frame_extractor.py / stream_extractor.py
# ---------------------------------------------------------------------------
@dataclass
class FrameData:
    """
    A single sampled frame ready for detection.

    Attributes
    ----------
    frame_number   : absolute index within the video/stream
    timestamp      : seconds from start (frame_number / native_fps)
    image          : BGR numpy array — in memory only, never written to disk
    video_metadata : dict with fps, resolution, duration etc.
    camera_id      : str for live streams; None for video file frames
    """
    frame_number: int
    timestamp: float
    image: np.ndarray
    video_metadata: dict = field(default_factory=dict)
    camera_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Detection — produced by each individual model detector
# ---------------------------------------------------------------------------
@dataclass
class Detection:
    """
    A single detected object from one model's inference pass.

    Attributes
    ----------
    class_id    : integer class ID from the model's label set
    class_name  : human-readable label (e.g. "person", "fire", "gun")
    confidence  : float in [0, 1] — model's confidence score
    bbox        : [x, y, w, h] bounding box in pixel coordinates
                  x, y = top-left corner; w, h = width and height
    track       : True → object should be forwarded to DeepSORT tracking
                  False → alert-only (bags, knives, fire, weapons)
    source      : which model produced this ("object", "fire", "weapon")
    """
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]           # [x, y, w, h]
    track: bool = False
    source: str = "object"      # "object" | "fire" | "weapon"


# ---------------------------------------------------------------------------
# FrameResult — produced by merger.py after all 3 models have run
# ---------------------------------------------------------------------------
@dataclass
class FrameResult:
    """
    Complete detection output for one frame after merging all 3 models.

    Threat Level Scale
    ------------------
    0 → NORMAL     : nothing dangerous detected
    2 → WARNING    : fire detected
    3 → CRITICAL   : weapon detected
    4 → URGENT     : weapon + person in same frame
    5 → EMERGENCY  : fire + weapon + person all in same frame

    Attributes
    ----------
    frame_id           : same as FrameData.frame_number
    timestamp          : same as FrameData.timestamp
    threat_level       : int 0/2/3/4/5
    threat_label       : human-readable threat name
    object_detections  : detections from YOLOv8n (persons, vehicles, bags, knife)
    weapon_detections  : detections from weapon model
    fire_detections    : detections from fire model
    trackable_objects  : subset → persons + vehicles (track=True) → DeepSORT
    alert_objects      : subset → bags, knives, weapons, fire → alert engine only
    """
    frame_id: int
    timestamp: float
    threat_level: int
    threat_label: str
    object_detections: List[Detection] = field(default_factory=list)
    weapon_detections: List[Detection] = field(default_factory=list)
    fire_detections: List[Detection] = field(default_factory=list)
    trackable_objects: List[Detection] = field(default_factory=list)
    alert_objects: List[Detection] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialize to a JSON-safe dict for database storage."""
        def det_list(dets):
            return [
                {
                    "class_id":   d.class_id,
                    "class_name": d.class_name,
                    "confidence": round(d.confidence, 4),
                    "bbox":       [round(v, 2) for v in d.bbox],
                    "track":      d.track,
                    "source":     d.source,
                }
                for d in dets
            ]

        return {
            "frame_id":          self.frame_id,
            "timestamp":         self.timestamp,
            "threat_level":      self.threat_level,
            "threat_label":      self.threat_label,
            "object_detections": det_list(self.object_detections),
            "weapon_detections": det_list(self.weapon_detections),
            "fire_detections":   det_list(self.fire_detections),
            "trackable_objects": det_list(self.trackable_objects),
            "alert_objects":     det_list(self.alert_objects),
        }
