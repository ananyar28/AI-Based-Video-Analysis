import logging
from typing import List, Dict, Any
from .state_manager import StateManager
from . import event_rules

logger = logging.getLogger(__name__)

class EventEngine:
    """
    Non-blocking deterministic event engine evaluating tracked identities temporally.
    """
    def __init__(self):
        self.state = StateManager()
        self.last_fired_events: Dict[str, float] = {}   # To prevent alert spam: { "type_id": timestamp }

    def initialize(self):
        """
        Pre-loads or binds any configurations required dynamically upon startup.
        (Called via Async/ThreadPool hook at startup to remain 100% non-blocking).
        """
        logger.info("[EventEngine] Engine initialized asynchronously and waiting for DeepSort frames.")

    def _can_fire(self, event_key: str, current_time: float, cooldown: float = 10.0) -> bool:
        """Prevent spamming the same event for the same ID every single frame."""
        last_time = self.last_fired_events.get(event_key, 0.0)
        if current_time - last_time >= cooldown:
            self.last_fired_events[event_key] = current_time
            return True
        return False

    def process_frame(self, tracked_objects: List[dict], frame_id: int, timestamp: float) -> Dict[str, Any]:
        """
        Given the sequence of tracked items from DeepSORT, evaluates if any behavioral alert triggers.
        Returns: { "events": [ {event_type, confidence, object_ids, timestamp, frame_id} ] }
        """
        # 1. Store frame into temporal state
        self.state.update(tracked_objects, timestamp)
        
        events_fired = []

        # 2. Extract subsets for rule execution
        active_persons = self.state.get_all_active_by_class("person", timestamp)
        active_bags = self.state.get_all_active_by_class("bag", timestamp)

        # Build quick reference subset dicts
        person_histories = {pid: self.state.get_history(pid) for pid in active_persons}
        
        # 3. LOITERING Rules
        for pid, history in person_histories.items():
            is_loiter, conf = event_rules.check_loitering(history, timestamp)
            if is_loiter:
                key = f"LOITERING_{pid}"
                if self._can_fire(key, timestamp):
                    events_fired.append({
                        "event_type": "LOITERING",
                        "confidence": round(conf, 2),
                        "object_ids": [pid],
                        "timestamp": timestamp,
                        "frame_id": frame_id
                    })

        # 4. FIGHT/ASSAULT Rules
        if len(person_histories) >= 2:
            fights = event_rules.check_fight(person_histories, timestamp)
            for (id1, id2, conf) in fights:
                key = f"FIGHT_{min(id1, id2)}_{max(id1, id2)}"
                if self._can_fire(key, timestamp):
                    events_fired.append({
                        "event_type": "FIGHT_ASSAULT",
                        "confidence": round(conf, 2),
                        "object_ids": [id1, id2],
                        "timestamp": timestamp,
                        "frame_id": frame_id
                    })

        # 5. ABANDONED OBJECT Rules
        all_person_centers = [hist[-1]["center"] for hist in person_histories.values() if len(hist) > 0]
        for bid in active_bags:
            bag_history = self.state.get_history(bid)
            is_abnd, conf = event_rules.check_abandoned_object(bag_history, all_person_centers, timestamp)
            if is_abnd:
                key = f"ABANDONED_OBJECT_{bid}"
                if self._can_fire(key, timestamp):
                    events_fired.append({
                        "event_type": "ABANDONED_OBJECT",
                        "confidence": round(conf, 2),
                        "object_ids": [bid],
                        "timestamp": timestamp,
                        "frame_id": frame_id
                    })
                    
        return {"events": events_fired}
