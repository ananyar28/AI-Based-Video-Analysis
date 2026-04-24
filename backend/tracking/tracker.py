import logging
from typing import List
from detection.schemas import Detection, FrameData
from .deepsort_wrapper import DeepSortWrapper
from .config import TRACKABLE_CLASSES, MAX_AGE, NN_BUDGET, EMBEDDING_MODEL

logger = logging.getLogger(__name__)

class Tracker:
    def __init__(self):
        self.wrapper = DeepSortWrapper(
            max_age=MAX_AGE,
            nn_budget=NN_BUDGET,
            embedder=EMBEDDING_MODEL
        )

    def initialize(self):
        """
        Non-blocking initialization meant to be called at server startup dynamically.
        """
        self.wrapper.initialize()

    def update(self, trackable_objects: List[Detection], frame_data: FrameData) -> List[dict]:
        """
        Convert detections to deep-sort format, run tracking, and return structured output.
        """
        if not trackable_objects:
            # We must still update the tracker with an empty list to increment ages on lost tracks
            self.wrapper.update_tracks([], frame=frame_data.image)
            return []

        # Convert YOLO standard detections into deep_sort_realtime expected format: 
        # [[left, top, w, h], confidence, detection_class]
        deepsort_input = []
        for det in trackable_objects:
            if det.class_name not in TRACKABLE_CLASSES:
                continue
                
            x, y, w, h = det.bbox
            deepsort_input.append(([x, y, w, h], det.confidence, det.class_name))

        # Update tracks
        tracks = self.wrapper.update_tracks(deepsort_input, frame=frame_data.image)
        
        # Build the required output format
        output_objects = []
        for track in tracks:
            if not track.is_confirmed() or track.time_since_update > 1:
                continue
                
            track_id = int(track.track_id)
            ltrb = track.to_ltrb() # [left, top, right, bottom]
            class_name = track.det_class
            confidence = track.det_conf or 0.0
            
            x1, y1, x2, y2 = ltrb
            
            # The prompt bounding box was x1, y1, x2, y2 originally but detection schemas use x,y,w,h. 
            # Output required by prompt uses actual standard bbox format. 
            # "bbox": [x1, y1, w, h] or [x1, y1, x2, y2]? 
            # Wait, detection schema uses [x,y,w,h]. Let's format exactly as specified!
            # center calculation
            center_x = (x1 + x2) / 2.0
            center_y = (y1 + y2) / 2.0
            
            output_objects.append({
                "id": track_id,
                "class": class_name,
                "bbox": [float(round(x1, 2)), float(round(y1, 2)), float(round(x2, 2)), float(round(y2, 2))],
                "center": [float(round(center_x, 2)), float(round(center_y, 2))],
                "confidence": round(float(confidence), 4),
                "timestamp": frame_data.timestamp,
                "frame_id": frame_data.frame_number
            })

        return output_objects
