"""
detection/merger.py
====================
Merges results from all 3 detectors and assigns a threat level to the frame.

Threat Level Scale
------------------
0 → NORMAL    : no threatening detections
2 → WARNING   : fire/smoke detected
3 → CRITICAL  : weapon detected
4 → URGENT    : weapon + person both present in same frame
5 → EMERGENCY : fire + weapon + person all present

Note: Level 1 is intentionally skipped to leave room for future expansion
(e.g. Level 1 = Suspicious behaviour from motion analysis layer).
"""

import logging
from typing import List

from .schemas import Detection, FrameData, FrameResult, THREAT_LEVELS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Threat classification helpers
# ---------------------------------------------------------------------------
def _classify_threat(
    obj_dets: List[Detection],
    weapon_dets: List[Detection],
    fire_dets: List[Detection],
) -> tuple[int, str, str]:
    """
    Determine the threat level for a frame based on what was detected.

    Rules are evaluated from highest to lowest — first match wins.

    Returns
    -------
    (threat_level: int, threat_label: str, threat_reason: str)
    """
    has_person  = any(d.class_name == "person" for d in obj_dets)
    has_weapon  = len(weapon_dets) > 0
    has_fire    = len(fire_dets) > 0

    # Level 5 — EMERGENCY: all three present
    if has_fire and has_weapon and has_person:
        return 5, THREAT_LEVELS[5], "Fire, weapon, and person detected simultaneously."

    # Level 4 — URGENT: weapon + person
    if has_weapon and has_person:
        return 4, THREAT_LEVELS[4], "Person detected in possession of a weapon."

    # Level 3 — CRITICAL: weapon (no person confirmed)
    if has_weapon:
        return 3, THREAT_LEVELS[3], f"Weapon ({weapon_dets[0].class_name}) detected in the area."

    # Level 2 — WARNING: fire or smoke
    if has_fire:
        return 2, THREAT_LEVELS[2], "Fire or smoke detected in the frame."

    # Level 0 — NORMAL
    if has_person:
        return 0, THREAT_LEVELS[0], "Monitoring: Person(s) present, no threats detected."
        
    return 0, THREAT_LEVELS[0], "No significant objects or threats detected."


def _split_trackable_alerts(
    obj_dets: List[Detection],
    weapon_dets: List[Detection],
    fire_dets: List[Detection],
) -> tuple[List[Detection], List[Detection]]:
    """
    Split detections into two groups:

    trackable_objects → persons + vehicles  → forwarded to DeepSORT
    alert_objects     → bags, knives, fire, weapons → alert engine only

    Parameters
    ----------
    obj_dets    : detections from object model (track flag already set)
    weapon_dets : detections from weapon model (all track=False)
    fire_dets   : detections from fire model   (all track=False)

    Returns
    -------
    (trackable_objects, alert_objects)
    """
    trackable = [d for d in obj_dets if d.track]
    # Alert objects = non-trackable objects + all weapon + all fire detections
    alerts = [d for d in obj_dets if not d.track] + weapon_dets + fire_dets
    return trackable, alerts


# ---------------------------------------------------------------------------
# Public merge function
# ---------------------------------------------------------------------------
def merge_results(
    frame_data: FrameData,
    obj_dets: List[Detection],
    weapon_dets: List[Detection],
    fire_dets: List[Detection],
) -> FrameResult:
    """
    Combine detections from all 3 models into a single FrameResult.

    Parameters
    ----------
    frame_data  : the source FrameData (for frame_id and timestamp)
    obj_dets    : detections from object_detector.detect()
    weapon_dets : detections from weapon_detector.detect()
    fire_dets   : detections from fire_detector.detect()

    Returns
    -------
    FrameResult with:
        - merged detections from all models
        - threat_level and threat_label
        - threat_reason
        - trackable_objects split
        - alert_objects split
    """
    threat_level, threat_label, threat_reason = _classify_threat(obj_dets, weapon_dets, fire_dets)
    trackable, alerts = _split_trackable_alerts(obj_dets, weapon_dets, fire_dets)

    if threat_level >= 2:
        logger.info(
            f"[Merger] Frame {frame_data.frame_number} @ {frame_data.timestamp}s "
            f"| Threat: {threat_label} (Level {threat_level}) "
            f"| Reason: {threat_reason} "
            f"| Objects: {len(obj_dets)} | Weapons: {len(weapon_dets)} | Fire: {len(fire_dets)}"
        )

    return FrameResult(
        frame_id=frame_data.frame_number,
        timestamp=frame_data.timestamp,
        threat_level=threat_level,
        threat_label=threat_label,
        threat_reason=threat_reason,
        object_detections=obj_dets,
        weapon_detections=weapon_dets,
        fire_detections=fire_dets,
        trackable_objects=trackable,
        alert_objects=alerts,
    )
