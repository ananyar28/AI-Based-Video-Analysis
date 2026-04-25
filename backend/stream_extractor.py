"""
stream_extractor.py
===================
Handles frame extraction from live streams (RTSP / HTTP / webcam).

Key design decisions:
- Two background daemon threads per stream:
    1. Capture thread  — reads camera, fills queue
    2. Worker thread   — drains queue, sends frames to detection runner
- Frame queue (maxsize=30): if full, oldest frame is dropped to prevent
  memory overflow. Surveillance prioritises fresh frames over stale ones.
- StreamExtractor instances are managed by main.py (stored in a dict by
  camera_id so endpoints can query / stop them).

Usage
-----
    extractor = StreamExtractor(url="rtsp://...", camera_id="cam_01")
    extractor.start()
    ...
    extractor.stop()
    status = extractor.status()
"""

import cv2
import queue
import threading
import time
import logging
from dataclasses import dataclass, field
from typing import Callable, Optional

# Import the shared FrameData schema from frame_extractor
from frame_extractor import FrameData

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_TARGET_FPS   = 1      # frames per second to push to detection
                              # NOTE: 1fps is safe at current Vertex AI latency (~0.87s/frame).
                              # Raise to 2-3fps after enabling batch detection in vertex_client.py.
STREAM_OPEN_TIMEOUT  = 5.0    # seconds to wait when validating a stream URL
QUEUE_MAX_SIZE       = 30     # frames buffered between capture & detection
WORKER_QUEUE_TIMEOUT = 1.0    # seconds worker waits before checking stop_event


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_stream_url(url: str | int) -> None:
    """
    Validate that a stream URL or webcam index is reachable.

    Accepts:
        - int           → webcam index (e.g. 0 for built-in camera)
        - "rtsp://..."  → RTSP stream
        - "http://..."  → HTTP/MJPEG stream
        - "https://..." → HTTPS stream

    Raises
    ------
    ValueError
        If the URL format is invalid or the stream is not reachable.
    """
    # Integer = webcam index — any non-negative int is valid format-wise
    if isinstance(url, int):
        if url < 0:
            raise ValueError(f"Webcam index must be non-negative, got: {url}")
        # We still try to open it to confirm it exists
    elif isinstance(url, str):
        lowered = url.lower()
        valid_prefixes = ("rtsp://", "http://", "https://")
        if not any(lowered.startswith(p) for p in valid_prefixes):
            raise ValueError(
                f"Invalid stream URL format: '{url}'. "
                f"Must start with one of: {', '.join(valid_prefixes)}"
            )
    else:
        raise ValueError(f"url must be a string or int, got: {type(url)}")

    # Attempt to open and read one frame to confirm reachability
    cap = cv2.VideoCapture(url)

    # Give it STREAM_OPEN_TIMEOUT seconds to connect
    start = time.time()
    opened = False
    while time.time() - start < STREAM_OPEN_TIMEOUT:
        if cap.isOpened():
            opened = True
            break
        time.sleep(0.2)

    if not opened:
        cap.release()
        raise ValueError(
            f"Could not connect to stream within {STREAM_OPEN_TIMEOUT}s: {url}"
        )

    success, _ = cap.read()
    cap.release()

    if not success:
        raise ValueError(
            f"Connected to stream but could not read a frame. "
            f"Stream may be empty or incompatible: {url}"
        )


# ---------------------------------------------------------------------------
# StreamExtractor
# ---------------------------------------------------------------------------
class StreamExtractor:
    """
    Manages live frame capture and queuing for a single camera/stream.

    Parameters
    ----------
    url         : str or int — stream URL or webcam index
    camera_id   : str        — unique identifier for this stream
    target_fps  : int        — frames per second to process (default: 5)
    on_result   : callable   — optional callback invoked with each FrameResult
                               and FrameData after detection; signature: on_result(FrameResult, FrameData)
    """

    def __init__(
        self,
        url: str | int,
        camera_id: str,
        target_fps: int = DEFAULT_TARGET_FPS,
        on_result: Optional[Callable] = None,
    ):
        self.url        = url
        self.camera_id  = camera_id
        self.target_fps = target_fps
        self.on_result  = on_result    # hook for detection result (set by runner)

        # Thread-safe frame queue: acts as buffer between capture & detection
        self.frame_queue: queue.Queue[FrameData] = queue.Queue(maxsize=QUEUE_MAX_SIZE)

        # Stop signal shared by both threads
        self._stop_event = threading.Event()

        # Background threads (daemon = auto-killed when main process exits)
        self._capture_thread: Optional[threading.Thread] = None
        self._worker_thread:  Optional[threading.Thread] = None

        # Stats (thread-safe via GIL for simple int increments)
        self.frames_captured   = 0
        self.frames_processed  = 0
        self.frames_dropped    = 0
        self._started_at: Optional[float] = None

        # Capture handle (stored here so stop() can force-release it)
        self.cap: Optional[cv2.VideoCapture] = None

        # Frame caching for web proxying
        self._latest_frame: Optional[cv2.Mat] = None
        self._frame_lock = threading.Lock()

        # Activity tracking for auto-cleanup
        self.last_activity = time.time()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self) -> None:
        """
        Start background capture and detection worker threads.
        Raises RuntimeError if the extractor is already running.
        """
        if self._capture_thread and self._capture_thread.is_alive():
            raise RuntimeError(
                f"StreamExtractor for '{self.camera_id}' is already running."
            )

        self._stop_event.clear()
        self._started_at = time.time()

        self._capture_thread = threading.Thread(
            target=self._capture_loop,
            name=f"capture-{self.camera_id}",
            daemon=True,
        )
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            name=f"worker-{self.camera_id}",
            daemon=True,
        )

        self._capture_thread.start()
        self._worker_thread.start()

        logger.info(
            f"[StreamExtractor] Started '{self.camera_id}' | "
            f"URL={self.url} | target_fps={self.target_fps}"
        )

    def stop(self) -> None:
        """
        Signal both threads to stop and wait for them to finish cleanly.
        """
        logger.info(f"[StreamExtractor] Stopping '{self.camera_id}'...")
        self._stop_event.set()

        if self.cap:
            self.cap.release()
            
        if self._capture_thread:
            self._capture_thread.join(timeout=5.0)
        if self._worker_thread:
            self._worker_thread.join(timeout=5.0)

        logger.info(f"[StreamExtractor] '{self.camera_id}' stopped.")

    def is_running(self) -> bool:
        """Return True if both threads are alive."""
        return (
            self._capture_thread is not None
            and self._capture_thread.is_alive()
            and self._worker_thread is not None
            and self._worker_thread.is_alive()
        )

    def status(self) -> dict:
        """
        Return a status snapshot for this stream.
        Also updates the last_activity timestamp.
        """
        self.last_activity = time.time()
        uptime = round(time.time() - self._started_at, 1) if self._started_at else 0.0

        return {
            "camera_id":        self.camera_id,
            "running":          self.is_running(),
            "queue_size":       self.frame_queue.qsize(),
            "frames_captured":  self.frames_captured,
            "frames_processed": self.frames_processed,
            "frames_dropped":   self.frames_dropped,
            "uptime_seconds":   uptime,
        }

    def get_encoded_frame(self) -> Optional[bytes]:
        """
        Returns the latest captured frame encoded as JPEG bytes.
        Used for the MJPEG streaming proxy.
        Also updates the last_activity timestamp.
        """
        self.last_activity = time.time()
        frame = None
        with self._frame_lock:
            if self._latest_frame is not None:
                frame = self._latest_frame.copy()
        
        if frame is None:
            return None

        # --- Draw Bounding Boxes on Proxy Stream (Burn-in) ---
        # We draw the latest results if available
        if hasattr(self, '_latest_result') and self._latest_result:
            result = self._latest_result
            
            # Draw detections
            for det in result.object_detections + result.weapon_detections + result.fire_detections:
                x, y, w, h = map(int, det.bbox)
                color = (0, 255, 0) # Green for objects
                if det.source == "weapon": color = (0, 0, 255) # Red for weapons
                if det.source == "fire": color = (0, 165, 255) # Orange for fire
                
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
                label = f"{det.class_name} {int(det.confidence * 100)}%"
                cv2.putText(frame, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # Draw threat level indicator
            t_color = (0, 255, 0)
            if result.threat_level >= 4: t_color = (0, 0, 255)
            elif result.threat_level >= 2: t_color = (0, 165, 255)
            
            cv2.putText(frame, f"AI Status: {result.threat_label}", (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, t_color, 3)
            
        # Encode to JPEG (outside the lock to avoid blocking capture thread)
        success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not success:
            return None
        
        return buffer.tobytes()

    # ------------------------------------------------------------------
    # Background threads (private)
    # ------------------------------------------------------------------

    def _capture_loop(self) -> None:
        """
        Thread 1 — Continuously reads frames from the stream.

        Sampling logic:
            native_fps=30, target_fps=5 → interval=6
            → every 6th frame is pushed to the queue

        Queue overflow policy:
            If the queue is full (all 30 slots taken — detection lagging),
            drop the OLDEST frame to make room for the newest one.
            This ensures the system always works on the most recent view.
        """
        self.cap = None
        for attempt in range(5):
            self.cap = cv2.VideoCapture(self.url)
            if self.cap.isOpened():
                break
            logger.warning(f"[{self.camera_id}] Capture thread: failed to open, retrying ({attempt+1}/5)...")
            time.sleep(1.0)

        if self.cap is None or not self.cap.isOpened():
            logger.error(
                f"[{self.camera_id}] Capture thread: completely failed to open stream: {self.url}"
            )
            return

        native_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
        width      = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height     = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        interval   = max(1, round(native_fps / self.target_fps))

        metadata = {
            "fps":       round(native_fps, 2),
            "width":     width,
            "height":    height,
            "resolution": f"{width}x{height}",
            "source":    "stream",
        }

        frame_number = 0

        logger.info(
            f"[{self.camera_id}] Capture started | "
            f"native_fps={native_fps} | interval={interval}"
        )

        while not self._stop_event.is_set():
            if self.cap is None:
                break
                
            success, frame = self.cap.read()

            if not success:
                if self._stop_event.is_set():
                    break
                logger.warning(
                    f"[{self.camera_id}] Frame read failed — attempting to reconnect..."
                )
                if self.cap: self.cap.release()
                time.sleep(1.0)
                self.cap = cv2.VideoCapture(self.url)
                continue

            self.frames_captured += 1

            # Update latest frame for proxying (every frame for smooth web preview)
            with self._frame_lock:
                self._latest_frame = frame.copy()

            # Only process every Nth frame for AI detection
            if frame_number % interval == 0:
                timestamp = round(frame_number / native_fps, 4)

                frame_data = FrameData(
                    frame_number=frame_number,
                    timestamp=timestamp,
                    image=frame,
                    video_metadata=metadata,
                    camera_id=self.camera_id,
                )

                # Queue overflow: drop oldest to make room for newest
                if self.frame_queue.full():
                    try:
                        self.frame_queue.get_nowait()
                        self.frames_dropped += 1
                    except queue.Empty:
                        pass

                try:
                    self.frame_queue.put_nowait(frame_data)
                except queue.Full:
                    # Extremely rare race condition: just skip this frame
                    self.frames_dropped += 1

            frame_number += 1

        if self.cap:
            self.cap.release()
        logger.info(f"[{self.camera_id}] Capture thread exited cleanly.")

    def _worker_loop(self) -> None:
        """
        Thread 2 — Drains the frame queue and sends frames to detection.

        If on_result callback is set, it is called with each FrameResult.
        Detection runner will be imported here to avoid circular imports;
        the import is deferred until execution so detection/ package can
        be set up independently.
        """
        # Deferred import — detection package will be built in Phase 2
        # This means stream_extractor.py works even before Phase 2 is done,
        # returning raw FrameData objects if no runner is wired yet.
        runner = None
        try:
            from detection.runner import run_detection
            runner = run_detection
            logger.info(f"[{self.camera_id}] Detection runner loaded successfully.")
        except ImportError:
            logger.warning(
                f"[{self.camera_id}] detection.runner not available yet "
                f"(Phase 2 not implemented). Worker will log frames only."
            )

        logger.info(f"[{self.camera_id}] Worker thread started.")

        while not self._stop_event.is_set():
            try:
                frame_data: FrameData = self.frame_queue.get(
                    timeout=WORKER_QUEUE_TIMEOUT
                )
            except queue.Empty:
                # No frames in queue — loop back and check stop_event
                continue

            try:
                if runner is not None:
                    result = runner(frame_data)
                    self.frames_processed += 1
                    self._latest_result = result # Save for proxy stream burn-in

                    # Call result hook if provided (e.g. to send via WebSocket)
                    if self.on_result:
                        self.on_result(result, frame_data)
                else:
                    # Phase 2 not ready — just count and move on
                    self.frames_processed += 1
                    logger.debug(
                        f"[{self.camera_id}] Frame {frame_data.frame_number} "
                        f"@ {frame_data.timestamp}s — detection not available"
                    )

            except Exception as e:
                logger.error(
                    f"[{self.camera_id}] Detection error on frame "
                    f"{frame_data.frame_number}: {e}",
                    exc_info=True,
                )

        logger.info(f"[{self.camera_id}] Worker thread exited cleanly.")
