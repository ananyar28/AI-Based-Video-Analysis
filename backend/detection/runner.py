"""
detection/runner.py
====================
Orchestrates parallel execution of all 3 detection models on a single frame.

Architecture
------------
All 3 models run simultaneously using a ThreadPoolExecutor (3 threads).
Total time per frame ≈ slowest single model (not the sum of all three).

    Frame ──┬──→ ObjectDetector  ──┐
            ├──→ WeaponDetector  ──┼──→ merger.merge_results() → FrameResult
            └──→ FireDetector    ──┘

Thread safety: YOLO models are thread-safe for inference — each call to
model() is independent. The GIL is released during C++/CUDA computation,
so true parallelism applies on the compute-heavy parts.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

from .schemas import FrameData, FrameResult, Detection
from . import object_detector, weapon_detector, fire_detector
from .merger import merge_results

logger = logging.getLogger(__name__)

# Reuse the same executor across calls (avoids thread spawn overhead per frame)
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="detector")


# ---------------------------------------------------------------------------
# Public runner
# ---------------------------------------------------------------------------
def run_detection(frame_data: FrameData) -> FrameResult:
    """
    Run all 3 detectors in parallel on a single frame and return the
    merged FrameResult.

    Parameters
    ----------
    frame_data : FrameData — a single frame from extract_frames() or StreamExtractor

    Returns
    -------
    FrameResult — merged detections with threat level assigned
    """
    # Submit all 3 detectors simultaneously
    future_obj    = _executor.submit(object_detector.detect, frame_data)
    future_weapon = _executor.submit(weapon_detector.detect, frame_data)
    future_fire   = _executor.submit(fire_detector.detect, frame_data)

    # Collect results — with individual error handling per model
    obj_dets:    List[Detection] = _safe_result(future_obj,    "ObjectDetector")
    weapon_dets: List[Detection] = _safe_result(future_weapon, "WeaponDetector")
    fire_dets:   List[Detection] = _safe_result(future_fire,   "FireDetector")

    return merge_results(frame_data, obj_dets, weapon_dets, fire_dets)


def _safe_result(future, model_name: str) -> List[Detection]:
    """
    Retrieve a future's result safely.
    If the model threw an exception, log it and return an empty list
    so the other models' results are not lost.
    """
    try:
        return future.result()
    except Exception as e:
        logger.error(
            f"[Runner] {model_name} failed on this frame: {e}",
            exc_info=True
        )
        return []
