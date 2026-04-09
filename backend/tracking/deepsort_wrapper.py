import logging
from deep_sort_realtime.deepsort_tracker import DeepSort

logger = logging.getLogger(__name__)

class DeepSortWrapper:
    def __init__(self, max_age=30, nn_budget=100, embedder="mobilenet_v2"):
        self.max_age = max_age
        self.nn_budget = nn_budget
        self.embedder = embedder
        self.tracker = None
        
    def initialize(self):
        """
        Loads the tracker and ReID embedder weights into memory.
        This must be called at startup asynchronously to prevent blocking.
        """
        if self.tracker is None:
            logger.info(f"[DeepSORT] Initializing embedder '{self.embedder}'...")
            self.tracker = DeepSort(
                max_age=self.max_age,
                nn_budget=self.nn_budget,
                embedder=self.embedder,
                half=True, # Use FP16 if GPU available
            )
            logger.info("[DeepSORT] Initialization completed.")

    def update_tracks(self, bboxes, frame):
        """
        Runs tracking update. bboxes format: [[left, top, w, h], confidence, class_name]
        """
        if self.tracker is None:
            self.initialize()
            
        return self.tracker.update_tracks(bboxes, frame=frame)
