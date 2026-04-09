from typing import List, Dict, Any, Tuple
from . import config, utils

def check_loitering(history: List[Dict[str, Any]], current_time: float) -> Tuple[bool, float]:
    """
    Returns (is_loitering, confidence).
    Requires a person to exist in the camera longer than LOITERING_TIME_SEC 
    without traveling further than LOITERING_MAX_MOVEMENT_RADIUS from their start point.
    """
    if not history: return False, 0.0

    first_record = history[0]
    duration = current_time - first_record["timestamp"]

    if duration >= config.LOITERING_TIME_SEC:
        start_center = first_record["center"]
        current_center = history[-1]["center"]
        dist = utils.calculate_distance(start_center, current_center)
        
        if dist <= config.LOITERING_MAX_MOVEMENT_RADIUS:
            # High confidence if they have been completely still for long time
            confidence = min(0.99, 0.70 + (duration / 100.0))
            return True, confidence

    return False, 0.0


def check_fight(person_histories: Dict[int, List[Dict[str, Any]]], current_time: float) -> List[Tuple[int, int, float]]:
    """
    Returns list of fighting pairs: (id1, id2, confidence)
    If two persons interlock bounding boxes for extended periods while moving rapidly.
    """
    fights = []
    person_ids = list(person_histories.keys())
    
    for i in range(len(person_ids)):
        for j in range(i + 1, len(person_ids)):
            id1, id2 = person_ids[i], person_ids[j]
            h1, h2 = person_histories[id1], person_histories[id2]
            
            # Find temporally matching frames
            overlaps = 0
            erratic_distance = 0.0
            
            # Simple synchronous alignment test: compare last 10 records (roughly 2 seconds)
            min_len = min(len(h1), len(h2), 10)
            if min_len < 3: 
                continue
                
            # Iterate backwards
            for k in range(1, min_len + 1):
                r1 = h1[-k]
                r2 = h2[-k]
                
                iou = utils.calculate_iou(r1["bbox"], r2["bbox"])
                if iou >= config.FIGHT_IOU_THRESHOLD:
                    overlaps += 1
                    
                # Track shift velocity 
                if k > 1:
                    prev_r1, prev_r2 = h1[-(k-1)], h2[-(k-1)]
                    shift1 = utils.calculate_distance(r1["center"], prev_r1["center"])
                    shift2 = utils.calculate_distance(r2["center"], prev_r2["center"])
                    erratic_distance += (shift1 + shift2) / 2
                    
            if overlaps >= 3 and erratic_distance >= config.FIGHT_ERRATIC_MOVEMENT_MIN:
                fights.append((id1, id2, 0.85))
                
    return fights


def check_abandoned_object(bag_history: List[Dict[str, Any]], all_person_centers: List[Tuple[float, float]], current_time: float) -> Tuple[bool, float]:
    """
    Returns (is_abandoned, confidence).
    Triggers if a bag remains still for > ABANDONED_OBJECT_TIME_SEC and 
    there is no person actively standing near it.
    """
    if not bag_history: return False, 0.0
    
    first_record = bag_history[0]
    duration = current_time - first_record["timestamp"]
    
    if duration >= config.ABANDONED_OBJECT_TIME_SEC:
        start_center = first_record["center"]
        current_center = bag_history[-1]["center"]
        
        # Verify it hasn't moved
        dist = utils.calculate_distance(start_center, current_center)
        if dist <= 15.0: # Bags shouldn't move AT ALL
            # Check proximity to any current person
            is_near_person = False
            for p_center in all_person_centers:
                pd = utils.calculate_distance(current_center, p_center)
                if pd <= config.ABANDONED_OBJECT_MIN_DISTANCE_PERSON:
                    is_near_person = True
                    break
                    
            if not is_near_person:
                # Bag is alone and stationary
                return True, 0.90
                
    return False, 0.0
