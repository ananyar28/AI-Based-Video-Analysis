from event_detection.event_engine import EventEngine

def main():
    print("Initializing EventEngine...")
    engine = EventEngine()
    engine.initialize()

    # We will simulate 25 seconds of video at 1 fps.
    # Person 1 stands completely still at (100, 100).
    # Bag 1 sits completely still at (500, 500). Distance between them is > 120.
    
    print("\nSimulating frames from t=1.0 to t=25.0...")
    
    for i in range(1, 26):
        timestamp = float(i)
        frame_id = i
        
        # Mock tracked objects (normally comes from tracking layer)
        tracked_objects = [
            {
                "id": 1,
                "class": "person",
                "bbox": [80.0, 50.0, 120.0, 150.0],
                "center": [100.0, 100.0],
                "confidence": 0.95,
                "timestamp": timestamp,
                "frame_id": frame_id
            },
            {
                "id": 2,
                "class": "bag",
                "bbox": [480.0, 480.0, 520.0, 520.0],
                "center": [500.0, 500.0],
                "confidence": 0.88,
                "timestamp": timestamp,
                "frame_id": frame_id
            }
        ]
        
        # Process frame
        result = engine.process_frame(tracked_objects, frame_id, timestamp)
        
        # Only print when an event actually fires
        if result["events"]:
            print(f"--- Frame {frame_id} (t={timestamp}s) ---")
            for evt in result["events"]:
                print(f"DETECTED {evt['event_type']} (Confidence: {evt['confidence']}) for IDs: {evt['object_ids']}")

    print("\nEventEngine is working properly if you see LOITERING at t=15s and ABANDONED_OBJECT at t=20s!")

if __name__ == "__main__":
    main()
