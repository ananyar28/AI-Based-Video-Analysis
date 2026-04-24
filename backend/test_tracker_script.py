import numpy as np
from detection.schemas import Detection, FrameData
from tracking.tracker import Tracker

def main():
    print("Initializing Tracker...")
    tracker = Tracker()
    tracker.initialize()
    
    # Create a dummy blank image (BGR format, typical for OpenCV)
    dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # DeepSORT by default requires n_init=3 consecutive detections to "confirm" a track.
    # We will simulate 5 consecutive frames.
    
    for i in range(1, 6):
        print(f"\n--- Frame {i} ---")
        # Move the person 5 pixels right and down each frame
        x = 100.0 + (i * 5.0)
        y = 100.0 + (i * 5.0)
        
        frame = FrameData(frame_number=i, timestamp=0.1 * i, image=dummy_image)
        det = Detection(
            class_id=0, class_name="person", confidence=0.9, 
            bbox=[x, y, 50.0, 100.0], track=True
        )
        
        out = tracker.update([det], frame)
        print("Output:", out)

    print("\n--- Frame 6 (Empty) ---")
    frame6 = FrameData(frame_number=6, timestamp=0.6, image=dummy_image)
    out6 = tracker.update([], frame6)
    print("Output:", out6)

    print("\n--- Frame 7 ---")
    frame7 = FrameData(frame_number=7, timestamp=0.7, image=dummy_image)
    det7 = Detection(
        class_id=0, class_name="person", confidence=0.88, 
        bbox=[130.0, 130.0, 50.0, 100.0], track=True
    )
    out7 = tracker.update([det7], frame7)
    print("Output:", out7)

    print("\nTracking layer is working properly if you see consistent IDs assigned in the outputs above!")

if __name__ == "__main__":
    main()
