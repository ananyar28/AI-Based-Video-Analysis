# detection/__init__.py
# Makes 'detection' a Python package.
# Import the public interface here for convenience.

from .schemas import FrameData, Detection, FrameResult
from .runner import run_detection

__all__ = ["FrameData", "Detection", "FrameResult", "run_detection"]
