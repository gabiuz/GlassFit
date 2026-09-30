FROM python:3.11-slim

# libglib2.0-0 is required by some ultralytics/torch transitive deps.
# libgl1 is NOT needed because we use opencv-python-headless (no display/GUI).
# libsm6, libxext6, libxrender-dev are also skipped for the same reason.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
