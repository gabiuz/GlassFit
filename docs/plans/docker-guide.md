# GlassFit FastAPI CV Service - Docker Deployment Guide

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Type:** Operational Deployment Guide
**Covers:** Post-implementation cloud deployment of `fastapi-service/` after completing `IMP-MS-DOCKER`
**Targets:** Google Cloud Run (primary, free tier), Hugging Face Spaces Pro (secondary, paid)
**Date:** September 29, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Prerequisite:** Complete all 6 phases in `docs/implementation/ms-docker.md` before following this guide.

---

## Before You Start

Verify that you have completed `IMP-MS-DOCKER` by confirming the following files exist and pass local verification:

- `fastapi-service/Dockerfile` exists
- `fastapi-service/.dockerignore` exists
- `fastapi-service/main.py` uses `USE_TMP_STORAGE` (not `VERCEL`)
- `fastapi-service/main.py` reads `ALLOWED_ORIGINS` for CORS
- Local Docker build and `/health` check pass (Section 9 of `ms-docker.md`)

---

## Part 1: Deploy to Google Cloud Run (Primary, Free Tier)

Google Cloud Run is the recommended primary deployment target. It is container-native, free within generous monthly limits, and handles your ML dependencies cleanly when given sufficient memory.

### Step 1.1 - Create a Google Cloud Account

1. Go to [cloud.google.com](https://cloud.google.com) and click **Get started for free**.
2. Sign in with a Google account.
3. Enter billing details. Google Cloud requires a credit card to activate. **You will not be charged** as long as you stay within free tier limits. For 4 testers with low traffic, free tier is more than sufficient.
4. Activate your account.

### Step 1.2 - Create a New Project

1. In the Google Cloud Console, click the project selector at the top of the page.
2. Click **New Project**.
3. Name it `glassfit` (or `glassfit-cv`).
4. Click **Create**.
5. Make sure the new project is selected in the project selector before continuing.

### Step 1.3 - Enable Required APIs

You need two APIs enabled. The easiest way is via the Cloud Console:

1. Go to **APIs & Services** in the left sidebar.
2. Click **Enable APIs and Services**.
3. Search for and enable **Cloud Run API**.
4. Search for and enable **Artifact Registry API** (used to store your Docker image).

Alternatively, if you install `gcloud` CLI (Step 1.4), you can run:

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

### Step 1.4 - Install the gcloud CLI

The `gcloud` CLI is the most reliable way to deploy from your terminal.

1. Go to [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install).
2. Download the **Windows installer**.
3. Run the installer and follow the prompts. Accept all defaults.
4. After installation, open a new PowerShell window and run:

```powershell
gcloud init
```

5. Follow the prompts: log in with your Google account, select your `glassfit` project.
6. Verify setup:

```powershell
gcloud auth list
gcloud config get-value project
# Should output: glassfit (or your project ID)
```

### Step 1.5 - Create an Artifact Registry Repository

Cloud Run pulls your Docker image from Artifact Registry (Google's private image registry).

```powershell
gcloud artifacts repositories create glassfit-cv `
  --repository-format=docker `
  --location=asia-southeast1 `
  --description="GlassFit CV microservice images"
```

`asia-southeast1` is the Singapore region, closest to the Philippines.

### Step 1.6 - Configure Docker to Authenticate with Artifact Registry

```powershell
gcloud auth configure-docker asia-southeast1-pkg.dev
```

This allows `docker push` to authenticate against your Artifact Registry repository.

### Step 1.7 - Build and Push the Docker Image

Run the following commands from inside the `fastapi-service/` directory:

```powershell
cd c:\Users\reyna\GlassFit\fastapi-service

# Set your project ID (replace glassfit with your actual project ID if different)
$PROJECT_ID = "glassfit"
$REGION = "asia-southeast1"
$IMAGE = "$REGION-pkg.dev/$PROJECT_ID/glassfit-cv/api:latest"

# Build the image locally
docker build -t $IMAGE .

# Push the image to Artifact Registry
docker push $IMAGE
```

This step takes 5-15 minutes the first time because it uploads the full image including PyTorch and YOLOv8 weights (~2-3 GB).

### Step 1.8 - Deploy to Cloud Run

```powershell
gcloud run deploy glassfit-cv `
  --image=$IMAGE `
  --region=asia-southeast1 `
  --platform=managed `
  --allow-unauthenticated `
  --memory=2Gi `
  --cpu=1 `
  --min-instances=0 `
  --max-instances=1 `
  --port=8080 `
  --set-env-vars="USE_TMP_STORAGE=1,TEMP_SESSION_TTL_MINUTES=120,ALLOWED_ORIGINS=https://YOUR_VERCEL_APP_URL.vercel.app"
```

Replace `https://YOUR_VERCEL_APP_URL.vercel.app` with your actual Vercel frontend URL. You can add multiple origins comma-separated without spaces.

**Key flags explained:**

| Flag | Value | Reason |
|---|---|---|
| `--memory=2Gi` | 2 GB | Required for YOLOv8 + Depth pipeline + SegFormer to load without OOM |
| `--cpu=1` | 1 vCPU | Sufficient for 4 testers; CPU billing only applies while requests are processing |
| `--min-instances=0` | Scale to zero | No cost when idle; cold starts apply (~30-60s after inactivity) |
| `--max-instances=1` | Cap at 1 instance | Prevents runaway scaling costs |
| `--allow-unauthenticated` | Public | Allows your Vercel frontend to call the API without Google auth tokens |

### Step 1.9 - Get Your Service URL

After deploy completes, Cloud Run prints the service URL:

```
Service URL: https://glassfit-cv-xxxxxxxxxx-as.a.run.app
```

Copy this URL. You will need it for the next step.

### Step 1.10 - Verify the Deployment

```powershell
# Replace with your actual service URL
curl https://glassfit-cv-xxxxxxxxxx-as.a.run.app/health
# Expected: {"status": "ok"}
```

If you see `{"status": "ok"}`, the service is live.

### Step 1.11 - Update Vercel Environment Variables

1. Go to your Vercel project dashboard at [vercel.com](https://vercel.com).
2. Click **Settings** -> **Environment Variables**.
3. Add or update the variable that points to your FastAPI service. Based on your codebase, find the env var name used in your Next.js code when calling the FastAPI service (likely something like `FASTAPI_BASE_URL`, `NEXT_PUBLIC_CV_API_URL`, or similar).
4. Set its value to your Cloud Run service URL (e.g., `https://glassfit-cv-xxxxxxxxxx-as.a.run.app`).
5. Click **Save**.
6. Redeploy your Vercel project: **Deployments** -> click the three dots on the latest deployment -> **Redeploy**.

### Step 1.12 - Understand Cold Starts

Cloud Run with `--min-instances=0` scales to zero when idle. This means:

- The **first request after 15+ minutes of inactivity** will take 30-90 seconds as the container starts and loads YOLOv8, Depth Anything V2, and SegFormer models.
- **Subsequent requests** within the active window are fast (model warmup runs on startup via `warmup_models()`).
- For your capstone demo: open the app and submit one test image 2-3 minutes before presenting. This warms the container and eliminates cold start delay during the demo.

To prevent cold starts entirely, change `--min-instances=0` to `--min-instances=1`. This keeps one container always warm but will consume free tier CPU-seconds continuously. For 4 testers on a budget, `--min-instances=0` is recommended.

---

## Part 2: Redeploying After Code Changes

When you update `fastapi-service/` code, redeploy with:

```powershell
cd c:\Users\reyna\GlassFit\fastapi-service

docker build -t $IMAGE .
docker push $IMAGE

gcloud run deploy glassfit-cv `
  --image=$IMAGE `
  --region=asia-southeast1
```

Subsequent builds are faster because Docker caches layers (only changed files are rebuilt).

---

## Part 3: Updating Environment Variables on Cloud Run

To update env vars without rebuilding the image:

```powershell
gcloud run services update glassfit-cv `
  --region=asia-southeast1 `
  --set-env-vars="USE_TMP_STORAGE=1,ALLOWED_ORIGINS=https://glassfit.vercel.app,https://staging.glassfit.vercel.app"
```

---

## Part 4: Monitoring & Logs

View real-time logs from Cloud Run:

```powershell
gcloud run services logs tail glassfit-cv --region=asia-southeast1
```

Or in the Cloud Console: **Cloud Run** -> `glassfit-cv` -> **Logs** tab.

Check current service status:

```powershell
gcloud run services describe glassfit-cv --region=asia-southeast1
```

---

## Part 5: Deploy to Hugging Face Spaces Pro (Secondary)

Use this when you upgrade to Hugging Face Spaces Pro ($9/mo). HF Spaces Pro gives you 16 GB RAM, no cold starts, and is purpose-built for ML workloads like YOLOv8 and Depth Anything V2.

### Step 5.1 - Create a Hugging Face Account and Upgrade to Pro

1. Go to [huggingface.co](https://huggingface.co) and create a free account.
2. Go to **Settings** -> **Billing** and subscribe to the **Pro** plan ($9/mo).
3. Verify your account has Pro access.

### Step 5.2 - Create a New Space

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Fill in:
   - **Space name:** `glassfit-cv`
   - **License:** MIT (or your preferred license)
   - **SDK:** Docker
   - **Visibility:** Public (required for free access from Vercel)
3. Click **Create Space**.

HF Spaces creates a Git repository for your space at `https://huggingface.co/spaces/your-username/glassfit-cv`.

### Step 5.3 - Clone the Space Repository

```powershell
git clone https://huggingface.co/spaces/YOUR_USERNAME/glassfit-cv hf-glassfit-cv
cd hf-glassfit-cv
```

### Step 5.4 - Copy fastapi-service Contents into the Space

HF Spaces Docker requires the `Dockerfile` to be at the root of the space repository.

```powershell
# From the repository root
Copy-Item c:\Users\reyna\GlassFit\fastapi-service\* .\hf-glassfit-cv\ -Recurse
```

Verify the structure in `hf-glassfit-cv/`:

```
Dockerfile
.dockerignore
main.py
requirements.txt
yolov8s-seg.pt
brightness.py
depth.py
... (all other Python modules)
```

### Step 5.5 - Add a README with Space Metadata

HF Spaces requires a `README.md` with YAML frontmatter at the top. Create or update `hf-glassfit-cv/README.md`:

```markdown
---
title: GlassFit CV Service
emoji: 🪟
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

GlassFit Computer Vision Microservice (FastAPI + YOLOv8 + Depth Anything V2)
```

Note: HF Spaces uses port `7860` by default for Docker spaces. Update `EXPOSE` in the Dockerfile to `7860` for HF Spaces (or use the `app_port` setting to match your `EXPOSE 8080`).

### Step 5.6 - Add Secrets (Environment Variables)

In the HF Space:

1. Go to your space at `https://huggingface.co/spaces/YOUR_USERNAME/glassfit-cv`.
2. Click **Settings** -> **Repository Secrets**.
3. Add each secret:
   - `USE_TMP_STORAGE` = `1`
   - `TEMP_SESSION_TTL_MINUTES` = `120`
   - `ALLOWED_ORIGINS` = `https://glassfit.vercel.app`

### Step 5.7 - Push to HF Spaces

```powershell
cd hf-glassfit-cv
git add .
git commit -m "deploy: GlassFit CV microservice"
git push
```

HF Spaces automatically builds and deploys when you push. Watch the build logs in the **Logs** tab of your space. The first build takes 10-20 minutes due to the large image.

### Step 5.8 - Get Your Service URL

Your space URL is: `https://YOUR_USERNAME-glassfit-cv.hf.space`

Verify:

```powershell
curl https://YOUR_USERNAME-glassfit-cv.hf.space/health
# Expected: {"status": "ok"}
```

### Step 5.9 - Update Vercel Environment Variables

Repeat Step 1.11 but use the HF Spaces URL instead of the Cloud Run URL.

---

## Part 6: Switching Between Deployments

You can switch between Cloud Run and HF Spaces at any time by updating the single Vercel environment variable that points to your FastAPI service URL. No code changes are needed on either the Next.js or FastAPI side.

| Platform | Vercel env var value |
|---|---|
| Google Cloud Run | `https://glassfit-cv-xxxxxxxxxx-as.a.run.app` |
| HF Spaces Pro | `https://YOUR_USERNAME-glassfit-cv.hf.space` |

---

## Quick Reference

| Task | Command |
|---|---|
| Build Docker image | `docker build -t IMAGE_TAG .` (from `fastapi-service/`) |
| Push image to Artifact Registry | `docker push IMAGE_TAG` |
| Deploy to Cloud Run | `gcloud run deploy glassfit-cv --image=IMAGE_TAG --region=asia-southeast1` |
| View Cloud Run logs | `gcloud run services logs tail glassfit-cv --region=asia-southeast1` |
| Check Cloud Run service | `gcloud run services describe glassfit-cv --region=asia-southeast1` |
| Update Cloud Run env vars | `gcloud run services update glassfit-cv --region=asia-southeast1 --set-env-vars="KEY=VALUE"` |
| Push to HF Spaces | `git push` (from inside `hf-glassfit-cv/` clone) |
| Verify health | `curl https://YOUR_SERVICE_URL/health` |
