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
# How many frames to pack into a single Vertex AI predict() call.
# Vertex AI supports up to 64 instances per call.
# 10 is a safe default: big enough to cut network overhead by 10×,
# small enough to avoid hitting request-size limits.
# ---------------------------------------------------------------------------
BATCH_SIZE = 10


class VertexDetector:
    def __init__(self):
        self.project_id = os.getenv("PROJECT_ID", "aegisvision")
        self.location = os.getenv("REGION", "asia-south1")
        self.endpoint_id = os.getenv("ENDPOINT_ID")
        self.use_vertex = os.getenv("USE_VERTEX_AI", "false").lower() == "true"

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
        image_rgb = image_array[..., ::-1]          # BGR → RGB
        img = Image.fromarray(image_rgb)
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=85) # quality=85 cuts size ~15% vs default
        return base64.b64encode(buffered.getvalue()).decode("utf-8")

    # -----------------------------------------------------------------------
    # Shared parser — converts a raw prediction list into Detection objects
    # -----------------------------------------------------------------------
    def _to_detections(self, raw_list: list) -> List[Detection]:
        return [
            Detection(
                class_id=d["class_id"],
                class_name=d["class_name"],
                confidence=d["confidence"],
                bbox=d["bbox"],
                track=(d["class_name"] in ["person", "car", "motorcycle", "bus", "truck"]),
                source=d["source"],
            )
            for d in raw_list
        ]

    # -----------------------------------------------------------------------
    # Single-frame detect  (kept for backwards-compat with runner.py)
    # -----------------------------------------------------------------------
    def detect(
        self, frame_data: FrameData
    ) -> Tuple[List[Detection], List[Detection], List[Detection]]:
        """
        Send a single frame to Vertex AI.
        Internally calls detect_batch() with a list of one frame.
        """
        if not self.use_vertex:
            return [], [], []
        results = self.detect_batch([frame_data])
        return results[0] if results else ([], [], [])

    # -----------------------------------------------------------------------
    # Batch detect  (NEW — the main speedup)
    # -----------------------------------------------------------------------
    def detect_batch(
        self, frame_data_list: List[FrameData]
    ) -> List[Tuple[List[Detection], List[Detection], List[Detection]]]:
        """
        Send multiple frames to Vertex AI in a SINGLE HTTP call.

        Parameters
        ----------
        frame_data_list : list of FrameData
            Up to BATCH_SIZE (10) frames to analyze together.

        Returns
        -------
        List of (obj_dets, weapon_dets, fire_dets) tuples — one per input frame,
        in the same order as the input list.

        Why this is fast
        ----------------
        Each Vertex AI predict() call has fixed overhead:
          - TCP setup, TLS handshake, request upload, response download
          ≈ 400–600 ms regardless of how many frames are in the call.
        By sending 10 frames at once, we amortize that overhead across 10 results
        instead of paying it 10 separate times.
        """
        if not self.use_vertex:
            return [([], [], [])] * len(frame_data_list)

        try:
            # Build one instance per frame
            instances = [
                {"image_b64": self._prepare_image(fd.image)}
                for fd in frame_data_list
            ]

            # ONE HTTP round-trip for all frames in the batch
            response = self.endpoint.predict(instances=instances)

            # Parse each prediction (one entry per input frame)
            results = []
            for pred in response.predictions:
                results.append((
                    self._to_detections(pred.get("objects", [])),
                    self._to_detections(pred.get("weapons", [])),
                    self._to_detections(pred.get("fire", [])),
                ))
            return results

        except Exception as e:
            logger.error(f"[Vertex] Batch prediction failed: {e}")
            # Return empty detections for each frame so the pipeline continues
            return [([], [], [])] * len(frame_data_list)


# Global instance — imported by runner.py and main.py
detector = VertexDetector()
