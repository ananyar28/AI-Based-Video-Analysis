import os
import cv2
import pytest
import numpy as np

from frame_extractor import (
    validate_video_file,
    get_video_metadata,
    extract_frames,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES
)

@pytest.fixture
def dummy_video_path(tmp_path):
    """Creates a dummy video file for testing."""
    path = str(tmp_path / "dummy_video.mp4")
    fps = 30
    duration = 2
    width = 640
    height = 480
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(path, fourcc, fps, (width, height))
    for _ in range(fps * duration):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        out.write(frame)
    out.release()
    return path

@pytest.fixture
def corrupt_video_path(tmp_path):
    """Creates a corrupt video file for testing."""
    path = str(tmp_path / "corrupt_video.mp4")
    with open(path, "wb") as f:
        f.write(b"This is not a valid video file content at all.")
    return path

@pytest.fixture
def large_video_path(tmp_path, monkeypatch):
    """Mocks max file size to test large file validation."""
    monkeypatch.setattr("frame_extractor.MAX_FILE_SIZE_BYTES", 100)
    path = str(tmp_path / "large_video.mp4")
    with open(path, "wb") as f:
        f.write(b"0" * 200)
    return path

def test_validate_video_file_valid(dummy_video_path):
    # Should not raise an exception
    validate_video_file(dummy_video_path)

def test_validate_video_file_not_found():
    with pytest.raises(FileNotFoundError):
        validate_video_file("nonexistent_video.mp4")

def test_validate_video_file_invalid_extension(tmp_path):
    path = str(tmp_path / "video.txt")
    with open(path, "w") as f:
        f.write("text")
    with pytest.raises(ValueError, match="Unsupported file type"):
        validate_video_file(path)

def test_validate_video_file_too_large(large_video_path):
    with pytest.raises(ValueError, match="File too large"):
        validate_video_file(large_video_path)

def test_validate_video_file_corrupt(corrupt_video_path):
    with pytest.raises(ValueError, match="appears corrupt or unreadable"):
        validate_video_file(corrupt_video_path)

def test_get_video_metadata(dummy_video_path):
    metadata = get_video_metadata(dummy_video_path)
    assert metadata["fps"] == 30.0
    assert metadata["width"] == 640
    assert metadata["height"] == 480
    assert metadata["total_frames"] == 60
    assert metadata["duration_seconds"] == 2.0
    assert metadata["resolution"] == "640x480"

def test_get_video_metadata_corrupt(corrupt_video_path):
    with pytest.raises(ValueError, match="Cannot open video for metadata"):
         get_video_metadata(corrupt_video_path)

def test_extract_frames(dummy_video_path):
    # target fps 5, native 30 -> interval 6
    # 60 total frames -> yields frame 0, 6, 12, ... 54 (10 frames)
    generator = extract_frames(dummy_video_path, target_fps=5)
    
    frames = list(generator)
    assert len(frames) == 10
    
    assert frames[0].frame_number == 0
    assert frames[0].timestamp == 0.0
    assert frames[0].camera_id is None
    
    assert frames[1].frame_number == 6
    assert frames[1].timestamp == 6 / 30.0
    
    assert frames[-1].frame_number == 54
    
def test_extract_frames_corrupt(corrupt_video_path):
    with pytest.raises(ValueError, match="Cannot open video for extraction"):
         list(extract_frames(corrupt_video_path))
