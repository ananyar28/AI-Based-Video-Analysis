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

import os

# Reuse the same executor across calls
_executor = ThreadPoolExecutor(max_workers=9, thread_name_prefix="detector")

# Global device cache
_DEVICE = None

def get_device():
    global _DEVICE
    if _DEVICE is None:
        try:
            import torch
            _DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
        except Exception:
            _DEVICE = 'cpu'
        logger.info(f"[Runner] Using device: {_DEVICE}")
    return _DEVICE


# ---------------------------------------------------------------------------
# Public runner
# ---------------------------------------------------------------------------
def run_detection(frame_data: FrameData) -> FrameResult:
    """
    Run all 3 detectors on a single frame and return the merged FrameResult.
    Sequential execution here is safer when called from a parallel frame-level pool.
    """
    # Run detectors one by one (safe within a parent thread)
    obj_dets = []
    try:
        obj_dets = object_detector.detect(frame_data)
    except Exception as e:
        logger.error(f"[Runner] ObjectDetector failed: {e}")

    weapon_dets = []
    try:
        weapon_dets = weapon_detector.detect(frame_data)
    except Exception as e:
        logger.error(f"[Runner] WeaponDetector failed: {e}")

    fire_dets = []
    try:
        fire_dets = fire_detector.detect(frame_data)
    except Exception as e:
        logger.error(f"[Runner] FireDetector failed: {e}")

    return merge_results(frame_data, obj_dets, weapon_dets, fire_dets)


    return merge_results(frame_data, obj_dets, weapon_dets, fire_dets)
