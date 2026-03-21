import sys
print("Python version:", sys.version)
try:
    import google.cloud.aiplatform
    print("google-cloud-aiplatform is installed.")
except ImportError:
    print("google-cloud-aiplatform is NOT installed.")
