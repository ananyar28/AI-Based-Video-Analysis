import logging
from typing import Dict, List, Any
from . import config

logger = logging.getLogger(__name__)

class StateManager:
    """
    Maintains a rolling history of active tracking IDs across frames.
    Avoids O(N) bloat by actively cleaning up old stale entries.
    """
    def __init__(self):
        # Format: { track_id: [ {"timestamp": t, "center": [cx,cy], "bbox": [..], "class": c, "confidence": conf}, ... ] }
        self.history: Dict[int, List[Dict[str, Any]]] = {}

    def update(self, tracked_objects: List[dict], current_time: float):
        """
        Record instantaneous data points for all currently updated tracking objects.
        """
        active_ids = set()
        
        for obj in tracked_objects:
            t_id = obj['id']
            active_ids.add(t_id)
            
            if t_id not in self.history:
                self.history[t_id] = []
                
            self.history[t_id].append({
                "timestamp": obj['timestamp'],
                "center": obj['center'],
                "bbox": obj['bbox'],
                "class": obj['class'],
                "confidence": obj['confidence']
            })

        self._cleanup(current_time)

    def _cleanup(self, current_time: float):
        """
        Evict states older than MAX_HISTORY_SECONDS and drop dead IDs entirely.
        """
        dead_ids = []
        for t_id, records in self.history.items():
            # Remove states that are too old to care about
            filtered_records = [r for r in records if current_time - r["timestamp"] <= config.MAX_HISTORY_SECONDS]
            
            if not filtered_records:
                dead_ids.append(t_id)
            else:
                self.history[t_id] = filtered_records
                
        for t_id in dead_ids:
            del self.history[t_id]

    def get_history(self, track_id: int) -> List[Dict[str, Any]]:
        return self.history.get(track_id, [])

    def get_all_active_by_class(self, class_name: str, current_time: float, min_freshness: float = 2.0) -> List[int]:
        """
        Returns all track IDs matching 'class_name' that have been seen within the last 'min_freshness' seconds.
        """
        results = []
        for t_id, records in self.history.items():
            if not records:
                continue
            if records[-1]["class"] == class_name and (current_time - records[-1]["timestamp"] <= min_freshness):
                results.append(t_id)
        return results
