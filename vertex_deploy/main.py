import os
import io
import base64
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from PIL import Image

app = FastAPI()

# Load models globally when the container starts
# Replace these with the actual paths to your .pt files inside the container
MODEL_DIR = "/app/models"
try:
    model_object = YOLO(f"{MODEL_DIR}/yolov8n.pt")
    model_weapon = YOLO(f"{MODEL_DIR}/weapons_detector.pt")
    model_fire = YOLO(f"{MODEL_DIR}/fire_detector.pt")
    print("Models loaded successfully.")
except Exception as e:
    print(f"Error loading models: {e}")

@app.get("/health")
def health_check():
    """Vertex AI uses this to check if the container is ready to accept traffic."""
    return {"status": "healthy"}

@app.post("/predict")
async def predict(request: Request):
    """
    Vertex AI sends traffic here. The payload format is:
    {
        "instances": [
             {"image_b64": "base64_string_of_image"}
        ]
    }
    """
    try:
        body = await request.json()
        instances = body.get("instances", [])
        
        if not instances:
            return JSONResponse(status_code=400, content={"error": "No instances provided"})

        results = []
        for instance in instances:
            image_b64 = instance.get("image_b64")
            if not image_b64:
                continue

            # Decode the base64 image
            image_bytes = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_bytes))

            # Run inference on all 3 models
            res_object = model_object(image)[0]
            res_weapon = model_weapon(image)[0]
            res_fire = model_fire(image)[0]

            def parse_results(res, source):
                parsed = []
                # res.boxes contains: cls, conf, xywh (or xyxy)
                for box in res.boxes:
                    # Convert [x_center, y_center, w, h] to [x_topleft, y_topleft, w, h]
                    # because your frontend merger.py likely expects pixel coordinates
                    x, y, w, h = box.xywh[0].tolist()
                    x_tl = x - (w / 2)
                    y_tl = y - (h / 2)
                    
                    parsed.append({
                        "class_id": int(box.cls[0]),
                        "class_name": res.names[int(box.cls[0])],
                        "confidence": float(box.conf[0]),
                        "bbox": [round(x_tl, 2), round(y_tl, 2), round(w, 2), round(h, 2)],
                        "source": source
                    })
                return parsed

            detections = {
                "objects": parse_results(res_object, "object"),
                "weapons": parse_results(res_weapon, "weapon"),
                "fire": parse_results(res_fire, "fire")
            }
            results.append(detections)

        # Vertex AI expects the response to have a "predictions" key
        return {"predictions": results}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    # Vertex AI sets the AIP_HTTP_PORT environment variable. Default to 8080.
    port = int(os.environ.get("AIP_HTTP_PORT", 8080))
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)
