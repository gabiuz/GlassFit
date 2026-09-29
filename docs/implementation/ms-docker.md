# Implementation Specification: FastAPI CV Microservice Containerization for Cloud Deployment (IMP-MS-DOCKER)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** IMP-MS-DOCKER
**Document Function:** Master implementation specification for containerizing the GlassFit FastAPI computer vision microservice using Docker, configuring environment-aware CORS and session storage, and enabling deployment on Google Cloud Run (primary) and Hugging Face Spaces Pro (secondary) as production-ready runtime targets
**Version:** 1.0.0
**Date:** September 29, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation
**Upstream Specifications:** `docs/sdd-glassfit.md`, `docs/build-glassfit.md`, `docs/prd-glassfit.md`, `docs/erd-glassfit.md`
**Primary Traceability:** `PRD-F4`, `PRD-F8`; `SDD-C2`, `SDD-C3`; `BLD-ENV1` through `BLD-ENV12`

> **Identifier note:** `IMP-MS-DOCKER` is a standalone infrastructure milestone outside the sequential `IMP-MS##` feature series. It does not introduce product features or database schema changes. Its sole purpose is to make the existing `fastapi-service/` deployable as a portable, reproducible Docker container on cloud platforms that require containerized workloads. The Next.js frontend deployed on Vercel must be able to communicate with the containerized service after deployment.

---

## 1. Executive Summary & Problem Context

The GlassFit FastAPI computer vision microservice (`fastapi-service/`) runs locally during development using `uvicorn` directly. As of the `docker` branch, no `Dockerfile`, `.dockerignore`, or container build configuration exists in the `fastapi-service/` directory. This prevents deployment on any container-native platform.

### 1.1 Why Containerization is Required

The `fastapi-service/` stack includes:

- `torch==2.13.0+cpu` and `torchvision==0.28.0+cpu` (large binary dependencies, approximately 500 MB installed)
- `ultralytics==8.3.235` with bundled `yolov8s-seg.pt` model weights (22 MB, committed to repository)
- `transformers==5.16.1` for Depth Anything V2 depth pipeline
- `opencv-python==4.11.0.86` for image processing
- `fastapi`, `uvicorn[standard]`, `python-multipart`, `Pillow`, `numpy`

Platforms such as Google Cloud Run and Hugging Face Spaces Pro require a `Dockerfile` to build and run the service. The container must:

1. Install all Python dependencies from `requirements.txt` with the custom PyTorch CPU index.
2. Copy source files and the `yolov8s-seg.pt` model weights into the image.
3. Expose the application on a configurable `$PORT` environment variable (required by Cloud Run).
4. Run `uvicorn` as the process entrypoint.
5. Configure ephemeral file storage under `/tmp` for generated session artifacts (Cloud Run has no persistent disk on free tier).
6. Restrict CORS origins to the deployed Vercel frontend URL via environment variable injection.

### 1.2 Current CORS Limitation

In `fastapi-service/main.py` (lines 40-46), CORS is currently hardcoded:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

This configuration rejects all requests from the production Vercel deployment (e.g., `https://glassfit.vercel.app`). CORS must be updated to accept an environment-variable-driven list of allowed origins alongside the existing localhost pattern for local development.

---

## 2. Upstream Traceability Matrix

| Specification ID | Upstream Requirement Code | Description in Upstream Document | Role in IMP-MS-DOCKER Implementation |
|---|---|---|---|
| `PRD-F4` | CV Image Analysis Pipeline | Automated room photo analysis using YOLOv8 segmentation, brightness, depth, and scene detection | Defines the functional scope of the FastAPI service that the container must serve |
| `PRD-F8` | Foreground Occlusion & Object Layering | YOLOv8s-seg mask generation for realistic foreground occlusion in 3D visualization | Confirms `yolov8s-seg.pt` must be present inside the container at runtime |
| `SDD-C2` | Image Pre-Flight & Upload Normalization | EXIF-corrected image orientation, format validation, and multi-resolution workspace preparation | Governs the `/analyze-image` endpoint and file handling in ephemeral container storage |
| `SDD-C3` | CV Scene Analyzer Microservice | FastAPI service exposing image analysis endpoints: brightness, segmentation, depth, and scene detection | Authoritative blueprint for the service the container must run |
| `BLD-ENV1` through `BLD-ENV12` | Environment Variable Definitions | 12 environment variables defined in `docs/build-glassfit.md` for local and production configuration | New env vars `ALLOWED_ORIGINS` and `USE_TMP_STORAGE` must align with this registry |

---

## 3. Architecture & Deployment Invariants

### 3.1 Ephemeral Storage Invariant

Google Cloud Run containers have no persistent disk. All generated artifacts (upload intermediaries, session masks, workspace images, depth maps) must be written to `/tmp`. The `fastapi-service/main.py` already supports this conditionally using `os.getenv("VERCEL")`. This flag must be generalized to a platform-agnostic `USE_TMP_STORAGE` environment variable so any container platform (Cloud Run, HF Spaces, or others) can activate ephemeral storage without relying on a Vercel-specific key name.

### 3.2 PORT Environment Variable Invariant

Google Cloud Run injects the `$PORT` environment variable at runtime and requires the service to listen on it. The `uvicorn` start command must use `$PORT` and must not hardcode port `8000`. The `CMD` instruction in the `Dockerfile` must use shell form to support `$PORT` expansion.

### 3.3 CORS Configuration Invariant

CORS allowed origins must be configurable without rebuilding the container image. The implementation must read a `ALLOWED_ORIGINS` environment variable (comma-separated list) and merge it with the existing localhost regex. When `ALLOWED_ORIGINS` is absent or empty, the service defaults to localhost-only mode so local development behavior is unchanged.

### 3.4 Model Weights Invariant

`yolov8s-seg.pt` is committed to the repository and must be copied into the Docker image during build. Runtime model downloads add cold start latency and introduce network failure risk. The `Dockerfile` must embed the weights in an image layer via `COPY`.

### 3.5 Non-Root User Invariant

The container must run as a non-root user. Google Cloud Run and Hugging Face Spaces Pro require or strongly prefer non-root execution for security compliance. A dedicated `appuser` with UID 1000 must be created and activated in the `Dockerfile` before the `CMD` instruction.

### 3.6 System Dependency Invariant

`opencv-python` requires shared libraries (`libgl1`, `libglib2.0-0`) that are absent from the `python:3.11-slim` base image. These must be installed via `apt-get` before the Python dependency installation step.

---

## 4. Files to Create or Modify

### 4.1 Files to Create

| File Path | Purpose |
|---|---|
| `fastapi-service/Dockerfile` | Container image build definition |
| `fastapi-service/.dockerignore` | Excludes unnecessary files from Docker build context |

### 4.2 Files to Modify

| File Path | Architectural Layer | Planned Modification |
|---|---|---|
| `fastapi-service/main.py` | CV Microservice | Replace `VERCEL` env var check with `USE_TMP_STORAGE`; replace hardcoded CORS regex with `ALLOWED_ORIGINS` env var driven middleware configuration |

---

## 5. Dockerfile Specification (`fastapi-service/Dockerfile`)

### 5.1 Base Image

Use `python:3.11-slim` as the base image. This matches the Python version specified in `docs/build-glassfit.md` while minimizing image size compared to the full `python:3.11` image.

### 5.2 Layer Strategy

The following layers must be applied in order to maximize Docker build cache efficiency:

| Layer Order | Instruction Category | Content |
|---|---|---|
| 1 | Environment variables | `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1` |
| 2 | System dependencies | `apt-get install -y --no-install-recommends libgl1 libglib2.0-0` then `rm -rf /var/lib/apt/lists/*` |
| 3 | Working directory | `WORKDIR /app` |
| 4 | Requirements copy | `COPY requirements.txt .` (copy before source for cache) |
| 5 | Python dependencies | `pip install --no-cache-dir -r requirements.txt` |
| 6 | Source copy | `COPY . .` (all Python modules and `yolov8s-seg.pt`) |
| 7 | Non-root user | `useradd -m -u 1000 appuser` then `USER appuser` |
| 8 | Port exposure | `EXPOSE 8080` |
| 9 | Entrypoint | `CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]` |

### 5.3 Design Notes

- Dependencies are installed before the source copy so that code changes do not invalidate the large pip layer.
- `libgl1` and `libglib2.0-0` are minimal OpenCV runtime dependencies; no full desktop display stack is needed.
- `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*` keep the apt layer small.
- `${PORT:-8080}` defaults to port 8080 when `$PORT` is not injected (local Docker testing), and honors Cloud Run's dynamic port injection in production.
- `yolov8s-seg.pt` is included in the `COPY . .` instruction. The `.dockerignore` must not exclude `.pt` files.

---

## 6. .dockerignore Specification (`fastapi-service/.dockerignore`)

The `.dockerignore` reduces build context size and prevents development artifacts from polluting the image. The following patterns must be excluded:

| Pattern | Reason |
|---|---|
| `__pycache__/` | Compiled Python bytecode; rebuilt inside container |
| `*.pyc` | Compiled Python files |
| `generated/` | Runtime-generated session artifacts; written at runtime to `/tmp` |
| `uvicorn.log` | Local development log file |
| `.pytest_cache/` | Test runner cache |
| `tests/` | Unit test directory not needed in production image |
| `test_brightness.py` | Standalone test file not needed in image |
| `.gitignore` | Development metadata |
| `.env` | Local environment secrets must never enter the image |
| `*.md` | Documentation files |

---

## 7. `main.py` Modification Specification

### 7.1 Storage Flag Migration

Replace the platform-specific `VERCEL` environment variable check with the platform-agnostic `USE_TMP_STORAGE`:

```python
# Before (line 22-26 in fastapi-service/main.py)
GENERATED_DIR = (
    Path("/tmp/glassfit/generated")
    if os.getenv("VERCEL")
    else BASE_DIR / "generated"
)

# After
GENERATED_DIR = (
    Path("/tmp/glassfit/generated")
    if os.getenv("USE_TMP_STORAGE")
    else BASE_DIR / "generated"
)
```

This change is backward compatible. Local development (no env var set) continues to write to `BASE_DIR / "generated"`. Cloud Run and HF Spaces set `USE_TMP_STORAGE=1` to activate ephemeral storage.

### 7.2 CORS Middleware Refactoring

Replace the hardcoded localhost-only `allow_origin_regex` with an environment-variable-driven configuration immediately after the `app = FastAPI(...)` declaration:

```python
import re

_ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
_EXTRA_ORIGINS: list[str] = [
    origin.strip()
    for origin in _ALLOWED_ORIGINS_ENV.split(",")
    if origin.strip()
]
_LOCALHOST_REGEX = r"http://(localhost|127\.0\.0\.1):\d+"

if _EXTRA_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_EXTRA_ORIGINS,
        allow_origin_regex=_LOCALHOST_REGEX,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=_LOCALHOST_REGEX,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

In Cloud Run and HF Spaces, inject `ALLOWED_ORIGINS=https://glassfit.vercel.app` as an environment variable. Multiple origins can be comma-separated (e.g., `https://glassfit.vercel.app,https://staging.glassfit.vercel.app`).

---

## 8. File Modification & Architectural Matrix

| File Path | Architectural Layer | Planned Modifications |
|---|---|---|
| `fastapi-service/Dockerfile` | Container Infrastructure | New file: Python 3.11-slim base, system deps for OpenCV, pip install from requirements.txt, COPY source and model weights, non-root user creation, uvicorn CMD with $PORT |
| `fastapi-service/.dockerignore` | Container Infrastructure | New file: excludes pycache, generated/, uvicorn.log, tests/, .env, .pytest_cache from build context |
| `fastapi-service/main.py` | CV Microservice | Replace `VERCEL` check with `USE_TMP_STORAGE`; refactor CORS middleware to read `ALLOWED_ORIGINS` env var |
| `docs/index.md` | Governance & Documentation Index | Register IMP-MS-DOCKER reconciliation log entry |

---

## 9. Verification Protocol

```bash
# 1. Build the Docker image locally (run from inside fastapi-service/)
docker build -t glassfit-cv:local .

# 2. Run the container locally and verify the health endpoint
docker run --rm -p 8080:8080 -e USE_TMP_STORAGE=1 glassfit-cv:local

# In a second terminal:
curl http://localhost:8080/health
# Expected response: {"status": "ok"}

# 3. Verify CORS header with production origin
curl -H "Origin: https://glassfit.vercel.app" \
     -I http://localhost:8080/health
# Expected: Access-Control-Allow-Origin header present

# 4. Verify image size (target: under 4 GB)
docker image ls glassfit-cv:local

# 5. Verify non-root user
docker run --rm glassfit-cv:local whoami
# Expected: appuser
```

---

## 10. Step-by-Step Implementation Roadmap

1. **Phase 1: Storage Flag Migration**
   - In `fastapi-service/main.py`, replace `os.getenv("VERCEL")` with `os.getenv("USE_TMP_STORAGE")`.
   - Verify local development still writes to `BASE_DIR / "generated"` when `USE_TMP_STORAGE` is unset.

2. **Phase 2: CORS Refactoring**
   - In `fastapi-service/main.py`, implement the environment-variable-driven CORS middleware configuration per Section 7.2.
   - Verify local development still allows localhost requests when `ALLOWED_ORIGINS` is unset.

3. **Phase 3: .dockerignore Creation**
   - Create `fastapi-service/.dockerignore` with all exclusions from Section 6.

4. **Phase 4: Dockerfile Creation**
   - Create `fastapi-service/Dockerfile` following the layer strategy in Section 5.2.
   - Confirm `yolov8s-seg.pt` is included in the COPY and not excluded by `.dockerignore`.
   - Confirm non-root user is applied before `CMD`.

5. **Phase 5: Local Build & Verification**
   - Build and run the image locally following Section 9 verification commands.
   - Confirm `/health` returns `{"status":"ok"}`.
   - Confirm image size is under 4 GB.
   - Confirm CORS header is returned for the production Vercel origin.

6. **Phase 6: Governance**
   - Register IMP-MS-DOCKER in `docs/index.md` reconciliation log.
   - Proceed to `docs/plans/docker-guide.md` for cloud deployment steps.

---

## Self-Check

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] BAN-PUNCT-01 enforced: zero em-dashes anywhere in documentation or code snippets
- [x] BAN-SPEC-02 enforced: explicit traceability to PRD-F#, SDD-C#, and BLD-ENV# IDs
- [x] BAN-DIAG-03 enforced: no box diagrams or ASCII trees in code blocks
- [x] BAN-AUTH-04 enforced: no hardcoded secrets; all credentials injected via environment variables
- [x] BAN-TYPE-05 enforced: no TypeScript `any` annotations affected; this milestone is Python-only
- [x] BAN-AR-08 respected: Docker containerization does not alter the async photo-based simulation architecture
- [x] BAN-UI-09 respected: no frontend UI changes in this milestone
- [x] Specification only: zero implementation code modifications committed in this document
