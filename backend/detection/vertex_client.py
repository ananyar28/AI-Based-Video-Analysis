"""
detection/vertex_client.py
===========================
Sends frames to Google Vertex AI for detection.

KEY FIX: Previously this file blindly accepted ALL objects returned by the
Vertex AI cloud endpoint (which uses base YOLOv8 trained on 80 COCO classes).
This caused chairs, cats, random household objects, and false weapon detections
to appear in the live stream.

Now each response category has its own filter applied BEFORE creating Detection
objects — identical to the filtering the local CPU detectors do.

Filters applied:
    objects  → OBJECT_WHITELIST (person, vehicle, bags, knife only)
    weapons  → confidence >= WEAPON_CONFIDENCE_MIN (0.65 — high bar, reduces false guns)
    fire     → confidence >= FIRE_CONFIDENCE_MIN   (0.50 — standard)
"""

import os
import io
import base64
import numpy as np
import logging
from typing import List, Tuple
from PIL import Image
from google.cloud import aiplatform
from .schemas import FrameData, Detection

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Batch size — how many frames to pack into one Vertex AI predict() call.
# Vertex AI supports up to 64 instances per call.
# 10 is safe default: cuts network round-trips by 10x without hitting size limits.
# ---------------------------------------------------------------------------
BATCH_SIZE = 10

# ---------------------------------------------------------------------------
# Object whitelist — mirrors object_detector.py WHITELIST.
# Any class from Vertex AI NOT in this set is silently discarded.
# This prevents chairs, cats, TVs, clocks, etc. from polluting the feed.
# ---------------------------------------------------------------------------
OBJECT_WHITELIST = {
    # Trackable: people & vehicles
    "person", "bicycle", "car", "motorcycle", "bus", "truck",
    # Alert-only: unattended / suspicious objects
    "backpack", "handbag", "suitcase", "knife",
}

# These whitelisted classes get track=True (forwarded to DeepSORT tracker)
TRACKABLE_CLASSES = {"person", "bicycle", "car", "motorcycle", "bus", "truck"}

# ---------------------------------------------------------------------------
# Confidence thresholds per detection type.
# Raising these thresholds directly reduces false positives.
# ---------------------------------------------------------------------------
OBJECT_CONFIDENCE_MIN = 0.80   # General objects: person, car, etc.
WEAPON_CONFIDENCE_MIN = 0.80   # Weapons — high bar to prevent false positives
FIRE_CONFIDENCE_MIN   = 0.80   # Fire/smoke — consistent accuracy threshold


class VertexDetector:
    def __init__(self):
        self.project_id  = os.getenv("PROJECT_ID", "aegisvision")
        self.location    = os.getenv("REGION", "asia-south1")
        self.endpoint_id = os.getenv("ENDPOINT_ID")
        self.use_vertex  = os.getenv("USE_VERTEX_AI", "false").lower() == "true"

        if self.use_vertex and not self.endpoint_id:
            logger.error("[Vertex] USE_VERTEX_AI is true but ENDPOINT_ID is not set!")
            self.use_vertex = False

        if self.use_vertex:
            aiplatform.init(project=self.project_id, location=self.location)
            self.endpoint = aiplatform.Endpoint(self.endpoint_id)
            logger.info(
                f"[Vertex] Initialized client for endpoint: {self.endpoint_id} "
                f"| batch_size={BATCH_SIZE}"
            )

    # -----------------------------------------------------------------------
    # Image encoding
    # -----------------------------------------------------------------------
    def _prepare_image(self, image_array: np.ndarray) -> str:
        """Converts numpy array (BGR) to Base64 JPEG string for API transfer."""
        image_rgb = image_array[..., ::-1]
        img = Image.fromarray(image_rgb)
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=85)
        return base64.b64encode(buffered.getvalue()).decode("utf-8")

    # -----------------------------------------------------------------------
    # Parsers — each applies its own whitelist / confidence gate
    # -----------------------------------------------------------------------
    def _to_object_detections(self, raw_list: list) -> List[Detection]:
        """
        Parse object detections from Vertex AI, applying the OBJECT_WHITELIST.

        Classes NOT in the whitelist (chair, cat, TV, clock, tie, etc.) are
        discarded before a Detection object is even created — exactly like the
        local YOLOv8 object_detector.py does with its WHITELIST dict.
        """
        detections = []
        for d in raw_list:
            name = d.get("class_name", "").lower().strip()
            conf = float(d.get("confidence", 0))

            # Gate 1: whitelist — only surveillance-relevant classes pass
            if name not in OBJECT_WHITELIST:
                logger.debug(f"[Vertex][Objects] Filtered (not whitelisted): '{name}' conf={conf:.2f}")
                continue

            # Gate 2: minimum confidence
            if conf < OBJECT_CONFIDENCE_MIN:
                logger.debug(f"[Vertex][Objects] Filtered (low conf): '{name}' conf={conf:.2f}")
                continue

            detections.append(Detection(
                class_id=int(d.get("class_id", 0)),
                class_name=name,
                confidence=conf,
                bbox=d["bbox"],
                track=(name in TRACKABLE_CLASSES),
                source="object",
            ))
        return detections

    def _to_weapon_detections(self, raw_list: list) -> List[Detection]:
        """
        Parse weapon detections with a HIGH confidence threshold.

        The Vertex AI weapon model sometimes returns detections with low
        confidence when it sees elongated shapes, dark lines on walls, etc.
        Setting WEAPON_CONFIDENCE_MIN=0.65 eliminates most false positives
        like phantom 'Automatic Rifle' from curtains / furniture edges.
        """
        detections = []
        for d in raw_list:
            name = d.get("class_name", "")
            conf = float(d.get("confidence", 0))

            # Strict confidence gate for weapons — reject likely false positives
            if conf < WEAPON_CONFIDENCE_MIN:
                logger.info(
                    f"[Vertex][Weapons] Rejected '{name}' conf={conf:.2f} "
                    f"(threshold={WEAPON_CONFIDENCE_MIN:.2f}) — likely false positive"
                )
                continue

            detections.append(Detection(
                class_id=int(d.get("class_id", 0)),
                class_name=name,
                confidence=conf,
                bbox=d["bbox"],
                track=False,     # weapons are alert-only, not tracked
                source="weapon",
            ))
        return detections

    def _to_fire_detections(self, raw_list: list) -> List[Detection]:
        """Parse fire/smoke detections with a standard confidence gate."""
        detections = []
        for d in raw_list:
            name = d.get("class_name", "")
            conf = float(d.get("confidence", 0))

            if conf < FIRE_CONFIDENCE_MIN:
                logger.debug(f"[Vertex][Fire] Filtered (low conf): '{name}' conf={conf:.2f}")
                continue

            detections.append(Detection(
                class_id=int(d.get("class_id", 0)),
                class_name=name,
                confidence=conf,
                bbox=d["bbox"],
                track=False,
                source="fire",
            ))
        return detections

    # -----------------------------------------------------------------------
    # Single-frame detect (backwards-compat with runner.py)
    # -----------------------------------------------------------------------
    def detect(
        self, frame_data: FrameData
    ) -> Tuple[List[Detection], List[Detection], List[Detection]]:
        """Send a single frame to Vertex AI. Wraps detect_batch()."""
        if not self.use_vertex:
            return [], [], []
        results = self.detect_batch([frame_data])
        return results[0] if results else ([], [], [])

    # -----------------------------------------------------------------------
    # Batch detect — main path (10× fewer network round-trips)
    # -----------------------------------------------------------------------
    def detect_batch(
        self, frame_data_list: List[FrameData]
    ) -> List[Tuple[List[Detection], List[Detection], List[Detection]]]:
        """
        Send multiple frames to Vertex AI in a SINGLE HTTP call.
        Each response category is independently filtered with the
        appropriate whitelist + confidence threshold before returning.

        Returns
        -------
        List of (obj_dets, weapon_dets, fire_dets) — one tuple per input frame.
        """
        if not self.use_vertex:
            return [([], [], [])] * len(frame_data_list)

        try:
            instances = [
                {"image_b64": self._prepare_image(fd.image)}
                for fd in frame_data_list
            ]

            # ONE HTTP round-trip for all frames in the batch
            response = self.endpoint.predict(instances=instances)

            results = []
            for pred in response.predictions:
                obj_dets    = self._to_object_detections(pred.get("objects", []))
                weapon_dets = self._to_weapon_detections(pred.get("weapons", []))
                fire_dets   = self._to_fire_detections(pred.get("fire", []))

                logger.debug(
                    f"[Vertex] Filtered frame result: "
                    f"{len(obj_dets)} objects | "
                    f"{len(weapon_dets)} weapons | "
                    f"{len(fire_dets)} fire"
                )

                results.append((obj_dets, weapon_dets, fire_dets))

            return results

        except Exception as e:
            logger.error(f"[Vertex] Batch prediction failed: {e}")
            raise e


# Global instance — imported by runner.py and main.py
detector = VertexDetector()
