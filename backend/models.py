from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name     = Column(String, nullable=True)


class Video(Base):
    __tablename__ = "videos"

    id               = Column(Integer, primary_key=True, index=True)
    filename         = Column(String, index=True)
    file_path        = Column(String)
    upload_time      = Column(DateTime, default=datetime.utcnow)
    status           = Column(String, default="pending")   # pending | processing | completed | failed
    # Video metadata (populated after frame extraction begins)
    fps              = Column(Float, nullable=True)
    resolution       = Column(String, nullable=True)        # e.g. "1920x1080"
    total_frames     = Column(Integer, nullable=True)
    frames_analyzed  = Column(Integer, default=0)
    duration_seconds = Column(Float, nullable=True)
    # Legacy report column (kept for backward compatibility with old detector.py)
    report           = Column(JSON, nullable=True)

    frame_results = relationship("FrameResult", back_populates="video", cascade="all, delete-orphan")
    alerts        = relationship("Alert", back_populates="video", cascade="all, delete-orphan")


class FrameResult(Base):
    """One row per analyzed frame — stores the full merged detection output."""
    __tablename__ = "frame_results"

    id           = Column(Integer, primary_key=True, index=True)
    video_id     = Column(Integer, ForeignKey("videos.id"), nullable=True)
    camera_id    = Column(String, nullable=True)            # set for live streams
    frame_id     = Column(Integer)                          # frame index in video
    timestamp    = Column(Float)                            # seconds from start
    threat_level = Column(Integer, default=0)
    threat_label = Column(String, default="NORMAL")
    detections   = Column(JSON)                             # full FrameResult.to_dict()
    created_at   = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", back_populates="frame_results")


class Alert(Base):
    """One row per frame where threat_level >= 2 (WARNING or above)."""
    __tablename__ = "alerts"

    id             = Column(Integer, primary_key=True, index=True)
    video_id       = Column(Integer, ForeignKey("videos.id"), nullable=True)
    camera_id      = Column(String, nullable=True)
    timestamp      = Column(Float)
    threat_level   = Column(Integer)
    threat_label   = Column(String)
    frame_snapshot = Column(String, nullable=True)           # path to saved JPEG
    created_at     = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", back_populates="alerts")


class Stream(Base):
    """One row per live stream session (active or stopped)."""
    __tablename__ = "streams"

    id         = Column(Integer, primary_key=True, index=True)
    camera_id  = Column(String, unique=True, index=True)
    url        = Column(String)
    status     = Column(String, default="active")           # active | stopped
    started_at = Column(DateTime, default=datetime.utcnow)
    stopped_at = Column(DateTime, nullable=True)
