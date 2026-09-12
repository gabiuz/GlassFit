# Build & Deployment Runbook (BUILD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** September 9, 2026 (Reconciled with Next.js 16 package.json, FastAPI dependencies, and Supabase migrations)  
**SDD:** docs/sdd-glassfit.md

---

## 1. Toolchain Prerequisites & Runtimes

| Tool / Runtime | Pinned Version | Verification Command | Operational Role |
|---|---|---|---|
| Node.js Runtime | `>= 20.10.0 LTS` | `node --version` | Application execution engine for Next.js 16 App Router |
| Node Package Manager | `npm >= 10.2.0` | `npm --version` | Frontend dependency resolution and script runner |
| Python Runtime | `3.11.x` | `python --version` | Computer vision microservice inference runtime |
| Python Package Manager | `pip >= 23.2.0` | `pip --version` | Python dependency package manager |
| Supabase CLI | `>= 1.140.0` | `supabase --version` | Local database management and migration runner |
| Git Version Control | `>= 2.40.0` | `git --version` | Source code management and CI deployment triggers |

---

## 2. Environment Configuration Matrix

| Config ID | Variable Name | Required? | Example / Default | Secret? | Description |
|---|---|---|---|---|---|
| BLD-ENV1 | `NODE_ENV` | Yes | `development` / `production` | No | Operational execution environment flag |
| BLD-ENV2 | `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xyzcompany.supabase.co` | No | Public Supabase project HTTPS URL |
| BLD-ENV3 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOi...` | No | Public anon key for client authentication |
| BLD-ENV4 | `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJhbGciOi...` | Yes | Administrative secret key for server actions and RLS bypass |
| BLD-ENV5 | `NEXT_PUBLIC_IMAGE_API_URL` | Yes | `http://localhost:8000` | No | Ingress endpoint URL for the FastAPI CV microservice |
| BLD-ENV6 | `CLOUDFLARE_R2_ACCOUNT_ID` | Yes | `a1b2c3d4e5f6...` | Yes | Cloudflare account identifier for R2 storage |
| BLD-ENV7 | `R2_ACCESS_KEY_ID` | Yes | `e7f8g9...` | Yes | S3-compatible API access key for R2 uploads |
| BLD-ENV8 | `R2_SECRET_ACCESS_KEY` | Yes | `123456789abcdef...` | Yes | S3-compatible API secret key for R2 uploads |
| BLD-ENV9 | `R2_BUCKET_NAME` | Yes | `glassfit-assets` | No | Destination R2 storage bucket for 3D GLB models and snapshots |
| BLD-ENV10 | `NEXT_PUBLIC_R2_PUBLIC_URL` | Yes | `https://cdn.glassfit.ph` | No | Public CDN distribution domain for catalog 3D models and images |
| BLD-ENV11 | `TEMP_SESSION_TTL_MINUTES` | No | `120` | No | Retention time for temporary room photos and YOLOv8 masks |
| BLD-ENV12 | `PORT` | No | `8000` | No | Microservice binding port for FastAPI Uvicorn server |

---

## 3. Local Workstation Bootstrap Sequence

### 3.1 Repository Cloning & Environment Setup
1. Clone the repository and enter the project root:
   ```bash
   git clone https://github.com/gabiuz/GlassFit.git
   cd GlassFit
   ```
2. Configure frontend environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Populate `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and R2 storage keys.
3. Install frontend dependencies:
   ```bash
   npm install
   ```

### 3.2 Computer Vision Microservice Setup
1. Navigate to the FastAPI service directory:
   ```bash
   cd fastapi-service
   ```
2. Create and activate a Python 3.11 virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install computer vision and deep learning dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Return to project root:
   ```bash
   cd ..
   ```

### 3.3 Database Migration Verification
1. Apply relational migrations to your target Supabase PostgreSQL instance:
   ```bash
   npx supabase db push
   ```
   Or execute sequential migration scripts via Supabase SQL Editor:
   - `supabase/migrations/001_backend_core.sql` (16 core tables, security definers, RLS policies)
   - `supabase/migrations/002_admin_roles_seed.sql` (Role hierarchy provisioning)
   - `supabase/migrations/003_storage_buckets.sql` (Cloudflare R2 and Supabase storage policies)
   - `supabase/migrations/004_catalog_seed.sql` (Sample products and templates)
   - `supabase/migrations/005_parametric_pricing_engine.sql` (Raw materials table ERD-E17, product component 1D/2D bindings, structural rule guardrails, grouped quotation items, and Philippine market benchmark seed data)

### 3.4 Launching Development Servers
1. Start the FastAPI microservice in terminal 1:
   ```bash
   cd fastapi-service
   uvicorn main:app --reload --port 8000
   ```
   Verify health probe at `http://localhost:8000/health`.
2. Start the Next.js development server in terminal 2:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the GlassFit application.

---

## 4. Production Build & Deployment Pipeline

| Step # | Pipeline Stage | Terminal Command | Success Verification Threshold |
|---|---|---|---|
| BLD-S1 | Code Quality Lint | `npm run lint` | Exits code 0 with zero linting errors |
| BLD-S2 | Static Type Verification | `npx tsc --noEmit` | TypeScript compiler completes with zero type errors |
| BLD-S3 | Automated Test Suite | `npm run test` | All Vitest and Playwright test assertions pass successfully |
| BLD-S4 | Next.js Production Build | `npm run build` | Next.js App Router bundles compiled into `.next` without bundle warnings |
| BLD-S5 | CV Container Build | `docker build -t glassfit-cv ./fastapi-service` | Docker engine completes multi-stage container build |
| BLD-S6 | Production Deployment | `vercel --prod` (or Git Push to `main`) | Hosting platform reports active healthy deployment status |

---

## 5. Post-Deployment Verification & Emergency Rollback

**Smoke test verification checklist:**
- Synthetic health probe (`GET http://cv-service/health`) returns HTTP 200 with `{"status": "ok"}`.
- Next.js root page (`GET /`) loads in < 800ms with catalog products visible.
- Product detail 3D inspector loads GLB mesh from Cloudflare R2 without WebGL errors.
- Test room image uploaded to `/analyze-image` returns lighting and object masks in < 2,500ms.
- Test simulation snapshot composites cleanly and saves record to `visualization_snapshots`.
- Signed consultation booking link successfully triggers Facebook Messenger / Viber protocol redirect.

**Rollback execution protocol:**
- Rollback Triggers:
  - Error rate exceeds 1.5% of total requests over a 5-minute rolling period.
  - FastAPI CV service fails health checks for 3 consecutive minutes.
  - Any P0 defect (such as 3D canvas rendering crash or silent pricing computation failure) is observed.
- Rollback Execution Steps:
  1. Instantly revert the Next.js deployment to the previous immutable deployment commit in Vercel.
  2. Roll back containerized CV microservice to previous stable container tag.
  3. If database schema migrations were applied, run down-migration scripts or restore snapshot backup from Supabase.
  4. Perform post-rollback smoke verification against restored production URLs.
  5. Convene technical post-mortem and log incident findings in `docs/index.md`.

---

## Self-Check

- [x] Toolchain runtimes specify pinned versions and verification commands
- [x] Environment variables table classifies secrets and provides operational descriptions
- [x] Local workstation bootstrap instructions execute deterministically without hidden steps
- [x] Build and deployment pipeline stages document exact commands and success criteria
- [x] Post-deployment verification smoke tests and rollback triggers are defined
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
