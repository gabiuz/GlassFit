FROM python:3.11-slim

# libglib2.0-0 and libgl1 are required by ultralytics/cv2 transitive deps.
# opencv-python-headless is used (no display/GUI), but libgl1 is still needed
# by ultralytics at runtime. libsm6, libxext6, libxrender-dev are not needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${PORT:-8000}
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
