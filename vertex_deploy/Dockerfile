# Use an official lightweight Python image
FROM python:3.10-slim

# Install system dependencies required by OpenCV (used by ultralytics)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your FastAPI app
COPY main.py .

# Create a models directory and copy your YOLO models
# Make sure you place your 3 .pt files in a "models" folder next to this Dockerfile
COPY models/ /app/models/

# Expose the port (Vertex AI usually uses 8080)
EXPOSE 8080

# Command to run the application
CMD ["python", "main.py"]
