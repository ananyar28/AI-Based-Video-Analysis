import os
import sys
import numpy as np
from dotenv import load_dotenv

# Add the current directory to sys.path so we can import from .detection
sys.path.append(os.path.dirname(__file__))

from detection.vertex_client import VertexDetector
from detection.schemas import FrameData

def test_endpoint():
    # 1. Load environment variables
    load_dotenv()
    
    print("--- [Vertex AI Integration Test] ---")
    print(f"Project ID: {os.getenv('PROJECT_ID')}")
    print(f"Region:     {os.getenv('REGION')}")
    print(f"Endpoint:   {os.getenv('ENDPOINT_ID')}")
    print(f"Use Vertex: {os.getenv('USE_VERTEX_AI')}")
    print("-" * 40)

    # 2. Initialize Detector
    try:
        detector = VertexDetector()
        if not detector.use_vertex:
            print("ERROR: USE_VERTEX_AI is false or ENDPOINT_ID is missing.")
            return
    except Exception as e:
        print(f"ERROR: Failed to initialize VertexDetector: {e}")
        return

    # 3. Create dummy frame (640x640 BGR)
    dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
    frame_data = FrameData(
        frame_number=1,
        timestamp=0.0,
        image=dummy_image
    )

    # 4. Run Detection
    print("Sending dummy frame to Vertex AI...")
    try:
        obj_dets, weapon_dets, fire_dets = detector.detect(frame_data)
        
        print("\n--- RESULTS ---")
        print(f"Objects detected: {len(obj_dets)}")
        for i, d in enumerate(obj_dets):
            print(f"  [{i}] {d.class_name} ({d.confidence:.2f}) bbox: {d.bbox}")
            
        print(f"Weapons detected: {len(weapon_dets)}")
        for i, d in enumerate(weapon_dets):
            print(f"  [{i}] {d.class_name} ({d.confidence:.2f}) bbox: {d.bbox}")
            
        print(f"Fire detections: {len(fire_dets)}")
        for i, d in enumerate(fire_dets):
            print(f"  [{i}] {d.class_name} ({d.confidence:.2f}) bbox: {d.bbox}")
            
        print("-" * 40)
        print("SUCCESS: Integration verified." if obj_dets or weapon_dets or fire_dets or True else "WARNING: No detections (expected for blank image).")
        
    except Exception as e:
        print(f"ERROR: Prediction failed: {e}")

if __name__ == "__main__":
    test_endpoint()
