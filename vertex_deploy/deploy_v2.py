import os
from google.cloud import aiplatform

# --- CONFIGURATION ---
PROJECT_ID = "aegisvision"
REGION = "asia-south1"
ENDPOINT_ID = "6446834696859942912"  # aegis-vision-v2
# Replace this with your actual image URI from Artifact Registry
# Example: "asia-south1-docker.pkg.dev/aegisvision/aegis-repo/aegis-vision-v2:latest"
IMAGE_URI = "PASTE_YOUR_IMAGE_URI_HERE"

def deploy_v2():
    print(f"--- [Deploying aegis-vision-v2 to Vertex AI] ---")
    
    # 1. Initialize AI Platform SDK
    aiplatform.init(project=PROJECT_ID, location=REGION)
    
    # 2. Upload/Register the Model
    print(f"Registering Model from image: {IMAGE_URI}...")
    model = aiplatform.Model.upload(
        display_name="aegis-vision-v2",
        serving_container_image_uri=IMAGE_URI,
        serving_container_predict_route="/predict",
        serving_container_health_route="/health",
        serving_container_ports=[8080],
    )
    print(f"Model created: {model.resource_name}")

    # 3. Get the existing Endpoint
    endpoint = aiplatform.Endpoint(ENDPOINT_ID)
    print(f"Deploying to Endpoint: {endpoint.display_name} ({ENDPOINT_ID})...")

    # 4. Deploy Model to Endpoint
    # We use n1-standard-4 with a Tesla T4 GPU for high-speed inference
    deployed_model = model.deploy(
        endpoint=endpoint,
        deployed_model_display_name="aegis-vision-v2-deployment",
        machine_type="n1-standard-4",
        accelerator_type="NVIDIA_TESLA_T4",
        accelerator_count=1,
        traffic_percentage=100,
    )
    
    print("\nSUCCESS: Model is now deploying to the endpoint!")
    print("This usually takes 10-15 minutes. Check the Google Cloud Console for progress.")

if __name__ == "__main__":
    if "PASTE" in IMAGE_URI:
        print("ERROR: Please update 'IMAGE_URI' in this script before running.")
    else:
        deploy_v2()
