# ---------------------------------------------------------------------------
# Temporal Thresholds (Seconds)
# ---------------------------------------------------------------------------
LOITERING_TIME_SEC = 15.0
ABANDONED_OBJECT_TIME_SEC = 20.0

# Time to keep a tracked object's history if it disappears (reduces memory bloat)
MAX_HISTORY_SECONDS = 40.0 

# ---------------------------------------------------------------------------
# Spatial / Movement Thresholds (Pixels / Ratios)
# ---------------------------------------------------------------------------
LOITERING_MAX_MOVEMENT_RADIUS = 60.0  # Pixels. If they move further, they aren't loitering

FIGHT_MIN_DURATION_SEC = 1.0          # Minimum overlapping time to constitute a fight
FIGHT_IOU_THRESHOLD = 0.2             # High overlap suggests struggle
FIGHT_ERRATIC_MOVEMENT_MIN = 10.0     # Minimum px/sec velocity to differentiate standing near from fighting

ABANDONED_OBJECT_MIN_DISTANCE_PERSON = 120.0  # Pixels separating bag and person
