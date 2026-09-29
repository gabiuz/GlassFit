# Implementation Specification: FastAPI Migration from Vercel Services to Render Free Native Python (fix-11)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Technical specification for moving the FastAPI CV microservice from Vercel Services to a Render Free native Python web service while retaining the Next.js 16 frontend on Vercel
**Version:** 2.0.0
**Date:** September 29, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Local implementation complete; Render and Vercel preview cutover pending the mandatory cloud feasibility gate in Section 8
**Upstream Specifications:** PRD-F3, PRD-F4, PRD-F7, PRD-F8, SDD-C2, SDD-C3, SDD-C5, SDD-NFR1, SDD-NFR4, SDD-NFR5, BLD-ENV5, BLD-ENV11, BLD-ENV12, BLD-S5, BLD-S6, QAD-TC3, QAD-TC4, QAD-TC8, QAD-VG2

---

## 1. Decision Summary

GlassFit will use the following split-hosting topology:

1. The Next.js 16 frontend remains a standard Vercel application.
2. The FastAPI CV microservice moves to a Render Free native Python web service.
3. Docker is not used.
4. The browser calls Render directly for image analysis and generated session artifacts.
5. The Vercel image-analysis proxy is removed after the direct Render path passes preview verification.
6. Render local storage is treated as temporary and disposable. No persistent disk is available on the Free plan.

The direct browser-to-Render connection is required because a Vercel Route Handler remains subject to Vercel's function request-body limit. Keeping the upload proxy would prevent the existing 12 MB application limit from working even though FastAPI runs on Render.

This migration removes the FastAPI Python bundle from Vercel and gives the service a native Python process on Render. It does not provide persistent compute, guaranteed warm models, production availability, or the existing production performance targets on the Render Free plan.

### 1.1 Scope classification

The Render Free deployment is a capstone preview and functional validation environment. It is not approved as the final production host while SDD-NFR1, SDD-NFR4, and SDD-NFR5 remain unchanged because Render Free:

- provides one 0.1 CPU, 512 MB instance;
- spins down after 15 minutes without inbound traffic;
- can take approximately one minute to start again;
- uses an ephemeral filesystem;
- cannot attach a persistent disk; and
- cannot scale beyond one instance.

The implementation must stop before production cutover if the mandatory feasibility gate in Section 8 fails.

---

## 2. Current and Target Architecture

### 2.1 Current architecture

| Component | Current host | Current connection |
|---|---|---|
| Next.js 16 App Router (`src/`) | Vercel Services `app` | Public project domain |
| FastAPI CV service (`fastapi-service/`) | Vercel Services `fastapi-service` | Internal service binding |
| Image-analysis proxy (`src/app/api/image-analysis/[...path]/route.ts`) | Vercel | Proxies browser uploads and artifact reads to FastAPI |
| Client API (`src/lib/imageApi.ts`) | Browser | Calls the same-origin `/api/image-analysis` proxy |

### 2.2 Target architecture

| Component | Target host | Target connection |
|---|---|---|
| Next.js 16 App Router (`src/`) | Vercel | Public project domain |
| FastAPI CV service (`fastapi-service/`) | Render Free native Python | Public HTTPS `onrender.com` service URL |
| Client API (`src/lib/imageApi.ts`) | Browser | Calls `NEXT_PUBLIC_IMAGE_API_URL` directly |
| Generated session artifacts | Render ephemeral filesystem | Loaded directly from the Render service URL |
| Image-analysis proxy | Removed | No image body passes through a Vercel Function |

### 2.3 Request flow

1. The browser validates the selected JPG or PNG using the existing MIME, decode, and 12 MB checks.
2. The browser sends multipart form data directly to `${NEXT_PUBLIC_IMAGE_API_URL}/analyze-image`.
3. FastAPI validates the content type and byte count again.
4. FastAPI performs brightness, lighting, and YOLO segmentation. Optional depth and scene analysis follow the Render Free feature profile in Section 5.3.
5. FastAPI returns relative artifact paths.
6. `src/lib/imageApi.ts` resolves those paths against `NEXT_PUBLIC_IMAGE_API_URL`.
7. The browser loads the workspace image and masks directly from Render.

---

## 3. Render Free Service Configuration

### 3.1 Native Python deployment

Create `render.yaml` at the repository root with these required settings:

```yaml
services:
  - type: web
    name: glassfit-cv
    runtime: python
    plan: free
    rootDir: fastapi-service
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    autoDeployTrigger: commit
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.11
      - key: TEMP_SESSION_TTL_MINUTES
        value: 120
      - key: ALLOWED_ORIGINS
        sync: false
      - key: RENDER_FREE_MODE
        value: "true"
      - key: ENABLE_DEPTH_ANALYSIS
        value: "false"
      - key: ENABLE_SCENE_ANALYSIS
        value: "false"
      - key: MAX_CONCURRENT_ANALYSES
        value: 1
      - key: ANALYSIS_QUEUE_TIMEOUT_SECONDS
        value: 5
      - key: RATE_LIMIT_REQUESTS
        value: 5
      - key: RATE_LIMIT_WINDOW_SECONDS
        value: 600
```

`PYTHON_VERSION` is pinned because Render's default Python version is newer than the Python 3.11 runtime required by the GlassFit build specification. `PORT` is supplied by Render and must not be hardcoded.

No Dockerfile, `.dockerignore`, Docker context, Docker command, or persistent disk is part of this fix.

### 3.2 Ephemeral storage contract

The service uses `fastapi-service/generated` through `BASE_DIR / "generated"`. The existing Vercel `/tmp` conditional is removed.

Generated sessions are best-effort temporary artifacts:

- They can disappear when Render spins down, restarts, or redeploys.
- They are not available as durable customer records.
- A workspace reload after service restart can require the customer to upload the room image again.
- Confirmed snapshots continue to use the existing permanent snapshot pipeline and must not depend on Render local storage.

No documentation may describe Render Free local storage as persistent.

### 3.3 Build dependency preflight

The implementation branch must verify that the pinned requirements install under Render's native Python 3.11 runtime. The deploy must stop if OpenCV cannot import in the native environment or if the PyTorch CPU wheels cannot be installed.

No dependency may be added or replaced solely to make Render work without first updating the approved dependency inventory in `docs/sdd-glassfit.md` and the build runbook.

### 3.4 MCP-assisted cloud workflow

Use the configured Vercel and Render MCP servers as the primary control plane for cloud inspection, configuration, deployment, log review, and rollback. Repository configuration remains authoritative. MCP operations must apply the reviewed `vercel.json`, `render.yaml`, and environment-variable contract rather than creating undocumented platform settings.

Before any cloud mutation:

1. Confirm that both MCP servers are loaded, authenticated, and authorized for the required project or workspace scope in the active Codex session.
2. Use the Vercel MCP server to list accessible projects and locate exactly one existing project named `glassfit`.
3. Verify that the selected Vercel project is connected to the GlassFit repository and expected production branch.
4. Do not create a second Vercel project. Stop for user selection if zero or multiple matching projects are returned.
5. Use the existing Render workspace named `GlassFit`. Do not create another Render workspace.
6. Pass the confirmed `GlassFit` workspace identifier explicitly on every Render MCP call instead of relying on implicit workspace selection.
7. Use the Render MCP server to list services in `GlassFit` and confirm that no existing service already represents the GlassFit CV backend before creating `glassfit-cv`.
8. Stop for user selection if the `GlassFit` workspace cannot be resolved uniquely or if a possible duplicate service is found.

During an authorized implementation, use the Render MCP server to:

- create the `glassfit-cv` native Python web service from the reviewed repository and `render.yaml`;
- select the Free plan and expected source branch;
- configure environment variables without printing secret values;
- inspect build and runtime logs;
- inspect service and deploy status;
- trigger a redeploy when required by the approved sequence; and
- inspect or activate a prior deploy during rollback.

Use the Vercel MCP server to:

- inspect the existing `glassfit` project's framework and deployment settings;
- inspect environment-variable names and scopes without exposing secret values;
- set or remove the environment variables listed in Section 6.2;
- trigger or inspect Preview and Production deployments;
- verify that the frontend build no longer includes the FastAPI service; and
- promote or restore the recorded known-good deployment during rollback.

If either MCP server is unavailable or unauthenticated, local implementation and tests may continue, but cloud project creation, environment changes, deployment, and rollback must pause. Do not silently replace the MCP workflow with dashboard clicks or provider CLIs unless the user explicitly approves that fallback.

Planning-time connection check on September 29, 2026:

| Server | Local configuration | Active-session result | Project inventory result |
|---|---|---|---|
| Vercel MCP | Configured, enabled, and loaded | Connected for project listing; detailed access requires reauthorization for the `gabiuzs-projects` scope | Exactly one project named `glassfit` was returned; repository and framework details remain unverified |
| Render MCP | Configured, enabled, loaded, and authenticated | The dedicated `GlassFit` workspace was created on the Hobby workspace plan and resolved through MCP | The `GlassFit` workspace contains no services; no project, web service, or deployment was created |

This connection snapshot is informational and must be checked again at implementation time. The existing Vercel `glassfit` project and Render `GlassFit` workspace must be reused. Provider identifiers must be recorded only in implementation evidence or the active session, not committed to this document. No additional Render workspace may be created for this fix.

---

## 4. Direct Browser API Migration

### 4.1 Client API base URL

Update `src/lib/imageApi.ts` so that:

- production and Vercel Preview use `process.env.NEXT_PUBLIC_IMAGE_API_URL`;
- local development defaults to `http://localhost:8000` when the variable is absent;
- the configured value has trailing slashes removed; and
- production fails with an explicit configuration error when the variable is absent or is not an HTTPS URL.

The existing response mapping remains responsible for resolving relative workspace, mask, depth, and scene URLs against this base URL.

### 4.2 Remove the Vercel proxy

Delete `src/app/api/image-analysis/[...path]/route.ts` only after the direct Render endpoint passes the preview tests in Section 8.

Removing the proxy is intentional. It prevents a 12 MB room image from being parsed by a Vercel Function and removes the Vercel request-body limit from the image upload path.

### 4.3 CORS contract

Replace the localhost-only CORS rule with deterministic parsing of `ALLOWED_ORIGINS`:

- The variable is a comma-separated list of complete origins with no path.
- Empty entries and trailing slashes are removed.
- Local development always permits `http://localhost:<port>` and `http://127.0.0.1:<port>`.
- Production permits only the canonical Vercel domain and explicitly listed preview origins.
- Wildcard origins are prohibited.
- Credentials remain disabled because the current upload flow does not use cookies.
- Allowed methods are limited to `GET`, `POST`, and `OPTIONS`.
- Allowed headers are limited to those required by the browser upload.

Vercel preview URLs are not covered by a broad `*.vercel.app` rule. Each preview origin used for acceptance testing must be explicitly configured in Render.

---

## 5. FastAPI Free-Tier Safety Changes

### 5.1 Generated directory

Replace the Vercel-specific path selection with:

```python
GENERATED_DIR = Path(os.getenv("GENERATED_DIR", str(BASE_DIR / "generated")))
```

The service creates its masks, uploads, and sessions directories at startup.

### 5.2 Bounded inference concurrency

Add a process-local analysis semaphore controlled by `MAX_CONCURRENT_ANALYSES` and set it to `1` on Render Free.

- One analysis may execute at a time.
- Additional requests wait for at most `ANALYSIS_QUEUE_TIMEOUT_SECONDS`, set to 5 seconds on Render Free.
- A request that cannot acquire the slot returns HTTP 503 with `{"detail":"Image analysis capacity is busy.","code":"ANALYSIS_BUSY","retryable":true}`.
- The semaphore is always released in a `finally` block.
- Health and artifact GET requests do not acquire the inference semaphore.

This protects the single 512 MB instance from simultaneous model execution. It does not satisfy the production concurrency target in SDD-NFR5.

### 5.3 Render Free feature profile

The Free profile keeps the required PRD-F4 baseline active:

- image validation;
- orientation normalization and workspace WebP generation;
- brightness and lighting analysis; and
- YOLOv8s-seg foreground object detection.

Depth Anything V2 and SegFormer scene analysis are disabled by default using `ENABLE_DEPTH_ANALYSIS=false` and `ENABLE_SCENE_ANALYSIS=false`. Their response objects must remain schema-compatible and report `available: false` with a deterministic Free-tier-disabled reason.

This choice avoids loading all three neural networks into a 512 MB process. It is an explicit preview-environment capability reduction and must be documented in the SDD and QAD. It must not silently appear as an inference failure.

If YOLO plus the application still exceeds the Render Free memory limit, the feasibility gate fails and the migration must not proceed. Removing YOLO is not an acceptable fallback because QAD-TC4 and QAD-TC8 require object masks.

### 5.4 Model startup behavior and health

Replace unconditional startup warmup with the following behavior:

- `/health` is a liveness endpoint and returns 200 when the FastAPI process is running.
- `/ready` reports the active feature profile, model availability, generated-directory writability, and whether an analysis slot can be created.
- Render uses `/health` for platform health checks so a sleeping Free service can start without loading every model first.
- Preview acceptance must call `/ready` and then submit a real image. `/health` alone is not deployment proof.
- Required YOLO load failure makes `/ready` return HTTP 503.
- Disabled optional models appear as `disabled`, not `failed`.

YOLO may be loaded lazily on the first analysis request. The first request after a Render cold start is allowed to be slower than subsequent requests and must display the existing frontend loading state.

### 5.5 Temporary-file cleanup

Retain cleanup at startup and before analysis, and add a lightweight periodic cleanup task using FastAPI lifespan management and standard-library `asyncio`.

- Cleanup runs at least every 15 minutes while the service is awake.
- Session directories older than `TEMP_SESSION_TTL_MINUTES` are removed.
- Cleanup errors are logged without terminating the service.
- Raw uploads continue to be deleted in the request `finally` block.
- The cleanup task is cancelled cleanly during shutdown.

This makes the 120-minute deletion policy deterministic while the service remains running. Render restart or spin-down deletes the entire ephemeral filesystem sooner.

### 5.6 Public endpoint abuse controls

Because the browser calls Render directly and the visualization workflow permits anonymous use, the endpoint cannot rely on a private service secret. Apply controls that work without adding a new external dependency:

- retain server-side MIME and 12 MB byte limits;
- limit inference concurrency to one;
- allow at most 5 analysis requests per client IP in a rolling 600-second window;
- return HTTP 429 with `{"detail":"Too many image analysis requests.","code":"RATE_LIMITED","retryable":true}` when the request window is exceeded;
- identify the client from the first `X-Forwarded-For` address supplied through Render, falling back to `request.client.host` when the header is absent;
- keep at most 10,000 active rate-limit entries and evict expired entries before admitting new keys;
- never treat CORS as authentication; and
- do not expose filesystem paths or model exception traces in responses.

The in-memory limiter resets whenever the Free service restarts. This is acceptable only for the constrained preview classification. Production requires a durable edge rate limiter or authenticated upload flow.

---

## 6. Vercel Configuration Changes

### 6.1 Frontend-only `vercel.json`

Replace the multi-service configuration with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

The Vercel project framework setting must be changed from Services to Next.js if it is currently set to Services.

### 6.2 Vercel environment variables

Add the following to both Preview and Production, using the appropriate Render service URL:

| Variable | Example | Classification |
|---|---|---|
| `NEXT_PUBLIC_IMAGE_API_URL` | `https://glassfit-cv.onrender.com` | Public runtime configuration |

Remove after successful cutover:

- `FASTAPI_SERVICE_URL`;
- `VERCEL_SUPPORT_LARGE_FUNCTIONS`; and
- Python build variables used only by the former Vercel FastAPI service.

The public Render URL is intentionally visible in the browser. It is not a secret.

### 6.3 Vercel build exclusion

Verify from deployment logs that the standard Next.js build does not process `fastapi-service/`. Add `fastapi-service/` to `.vercelignore` only if Vercel attempts to include it after the Services configuration is removed.

---

## 7. Documentation and Test Changes

### 7.1 Required documentation updates

Update these specifications in the same change:

| File | Required reconciliation |
|---|---|
| `docs/index.md` | Register fix-11 and its PRD, SDD, BUILD, and QAD traceability |
| `docs/build-glassfit.md` | Replace Docker and Vercel Services deployment instructions with Render native Python Free instructions |
| `docs/sdd-glassfit.md` | Document direct browser-to-Render traffic, ephemeral storage, Free-tier feature profile, and preview-only limitations |
| `docs/prd-glassfit.md` | Reconcile `/analyze-space` to the implemented `/analyze-image` contract and document unavailable optional depth/scene data in Free mode |
| `docs/qad-glassfit.md` | Add fix-11 functional, cold-start, CORS, cleanup, overload, and rollback cases; record that production NFR gates are not waived |

`AGENTS.md` requires no change.

### 7.2 Required automated tests

Add tests for:

- client base URL selection and trailing-slash normalization;
- missing or insecure production API URL rejection;
- relative artifact URL resolution against the Render base URL;
- CORS allow-list parsing and rejected origins;
- 12 MB backend enforcement;
- single-analysis concurrency and HTTP 503 behavior;
- per-IP throttling and HTTP 429 behavior;
- Free-profile deterministic depth and scene responses;
- `/ready` success and required-model failure;
- periodic expiry cleanup; and
- path traversal rejection for generated artifacts.

No test may depend on a live Render service unless it is explicitly classified as a deployment smoke test.

---

## 8. Deployment Sequence and Mandatory Feasibility Gate

### 8.1 Preparation

1. Connect and authenticate the Vercel and Render MCP servers in the active Codex session, including the Vercel team scope required to inspect `glassfit`.
2. Resolve exactly one existing Render workspace named `GlassFit` and pass its identifier explicitly to each Render MCP operation. Do not create another workspace.
3. Verify the existing Vercel `glassfit` project and confirm that the Render `GlassFit` workspace still contains no matching CV service.
4. Record the Vercel project identifier, Render workspace identifier, source repository, source branch, and last known-good Vercel deployment without placing opaque provider identifiers in committed documentation.
5. Implement Render native-runtime configuration and the Free-tier backend controls on a feature branch.
6. Implement direct client API configuration without deleting the Vercel proxy yet.
7. Run the local lint, typecheck, frontend build, Python tests, and FastAPI health checks.
8. Use the Render MCP server to create the `glassfit-cv` service from `render.yaml` and deploy the feature branch.
9. Use the Render MCP server to configure `ALLOWED_ORIGINS` with the exact Vercel Preview origin.
10. Inspect the Render build and runtime logs through MCP before starting the feasibility gate.

### 8.2 Mandatory Render Free feasibility gate

The migration may continue only when all of these pass on the actual Free service:

- native Python dependency installation completes;
- OpenCV, PyTorch, Ultralytics, and the bundled YOLO model import successfully;
- `/health` returns HTTP 200 after a cold start;
- `/ready` returns HTTP 200 with YOLO available;
- a representative valid JPG completes analysis without process restart or out-of-memory failure;
- the response includes brightness, lighting, workspace image, and YOLO segmentation data;
- every returned workspace and mask URL loads successfully;
- a file larger than 4.5 MB but no larger than 12 MB reaches Render directly and completes without a Vercel 413 response;
- invalid origin, invalid MIME type, oversized upload, rate-limit, and concurrency-limit behavior match the documented contract; and
- service restart behavior is confirmed to invalidate old ephemeral session artifact URLs without affecting the frontend's ability to request a new analysis.

Record cold-start duration, warm analysis duration, and failure behavior. QAD-VG2 remains a production release gate. A slower Free-tier preview result may be documented, but it may not be reported as satisfying SDD-NFR1.

If dependency installation, YOLO readiness, or one representative analysis fails because of the 512 MB or 0.1 CPU limits, stop the migration. Do not remove the Vercel service and do not disable YOLO to force the gate to pass.

### 8.3 Preview cutover

1. Use the Vercel MCP server to set `NEXT_PUBLIC_IMAGE_API_URL` in Preview to the verified Render URL.
2. Use the Vercel MCP server to deploy or inspect the frontend Preview deployment.
3. Execute QAD-TC3, QAD-TC4, and QAD-TC8.
4. Confirm browser requests go directly to Render and no image body reaches `/api/image-analysis` on Vercel.
5. Delete the Vercel proxy route on the feature branch.
6. Replace `vercel.json` with the frontend-only configuration.
7. Redeploy Preview through Vercel MCP and repeat the full smoke suite.
8. Inspect both Vercel and Render logs through their MCP servers for the same test window.

### 8.4 Production cutover restriction

Do not label the Render Free service as the production-compliant CV host while it fails SDD-NFR1, SDD-NFR4, or SDD-NFR5. A production cutover requires either:

- approved upstream specification changes that explicitly accept Free-tier availability and capacity; or
- migration to a compute plan proven to satisfy the existing production gates.

If maintainers explicitly approve the Free service for a public capstone demonstration, use Vercel MCP to set the Production `NEXT_PUBLIC_IMAGE_API_URL`, deploy the frontend, verify direct traffic, and only then remove obsolete Vercel variables.

---

## 9. Rollback Strategy

### 9.1 Before Vercel Services removal

Use Vercel MCP to remove `NEXT_PUBLIC_IMAGE_API_URL` from the Preview environment and redeploy or promote the recorded last known-good Vercel Services deployment.

### 9.2 After Vercel Services removal

1. Use Vercel MCP to promote or redeploy the last known-good Vercel deployment that still contains the Services configuration and proxy route.
2. Confirm `/api/image-analysis/health` reaches the former internal FastAPI service.
3. Remove or revert `NEXT_PUBLIC_IMAGE_API_URL` only after the old deployment is healthy.
4. Use Render MCP to suspend or stop repeated failed deployments when supported. Do not delete the Render service during incident response.

The rollback reference must be recorded as an immutable Vercel deployment URL or Git commit before cutover. A generated service-binding URL must not be copied into `FASTAPI_SERVICE_URL` and treated as a stable manual fallback.

---

## 10. Files Affected

| File | Action | Purpose |
|---|---|---|
| `render.yaml` | Create | Define the Render Free native Python service |
| `vercel.json` | Modify | Convert Vercel to a frontend-only Next.js project |
| `src/lib/imageApi.ts` | Modify | Call Render directly through `NEXT_PUBLIC_IMAGE_API_URL` |
| `src/app/api/image-analysis/[...path]/route.ts` | Delete after preview verification | Remove the Vercel image proxy and its upload limit |
| `fastapi-service/main.py` | Modify | Add portable storage, CORS, Free profile, readiness, concurrency, throttling, and periodic cleanup |
| FastAPI test files | Create or modify | Verify the new backend contracts |
| Frontend unit tests | Create or modify | Verify base URL and artifact URL behavior |
| `docs/index.md` | Modify | Register fix-11 traceability |
| `docs/build-glassfit.md` | Modify | Document native Render deployment and environment configuration |
| `docs/sdd-glassfit.md` | Modify | Document topology and Free-tier limitations |
| `docs/prd-glassfit.md` | Modify | Reconcile the CV endpoint contract |
| `docs/qad-glassfit.md` | Modify | Add migration acceptance cases and preserve production gates |
| `next.config.ts` | Review | Revalidate whether `images.unoptimized` remains necessary in standard Vercel mode |
| `.env.local` | Retain and verify | Continue using the local FastAPI URL through `NEXT_PUBLIC_IMAGE_API_URL` |

Files that must not be created:

- `fastapi-service/Dockerfile`
- `fastapi-service/.dockerignore`

---

## 11. Environment Variable Matrix

### 11.1 Vercel frontend

| Variable | Required | Value |
|---|---|---|
| `NEXT_PUBLIC_IMAGE_API_URL` | Yes in Preview and Production | Exact HTTPS Render service origin |

### 11.2 Render backend

| Variable | Required | Value or default |
|---|---|---|
| `PYTHON_VERSION` | Yes | `3.11.11` |
| `ALLOWED_ORIGINS` | Yes | Comma-separated exact Vercel origins |
| `TEMP_SESSION_TTL_MINUTES` | No | `120` |
| `RENDER_FREE_MODE` | Yes for this deployment | `true` |
| `ENABLE_DEPTH_ANALYSIS` | Yes for this deployment | `false` |
| `ENABLE_SCENE_ANALYSIS` | Yes for this deployment | `false` |
| `MAX_CONCURRENT_ANALYSES` | Yes for this deployment | `1` |
| `ANALYSIS_QUEUE_TIMEOUT_SECONDS` | Yes for this deployment | `5` |
| `RATE_LIMIT_REQUESTS` | Yes for this deployment | `5` |
| `RATE_LIMIT_WINDOW_SECONDS` | Yes for this deployment | `600` |
| `GENERATED_DIR` | No | Defaults to `fastapi-service/generated` |
| `PORT` | Render managed | Do not hardcode |

---

## 12. Verification Checklist

- [ ] Vercel MCP is loaded and authenticated before cloud changes begin.
- [x] Render MCP is loaded and authenticated before cloud changes begin.
- [ ] Vercel MCP resolves exactly one existing `glassfit` project connected to the expected repository.
- [x] Render MCP confirms that no duplicate GlassFit CV service exists before `glassfit-cv` is created.
- [x] Provider project, workspace, and deployment identifiers are kept out of committed documentation.
- [x] Environment-variable values are not exposed in logs or agent responses.
- [x] No Dockerfile or Docker deployment step is introduced.
- [x] `render.yaml` uses `runtime: python`, `plan: free`, and `rootDir: fastapi-service`.
- [x] The native service command starts Uvicorn on `$PORT`.
- [ ] The actual Python version is 3.11.x.
- [x] The browser client is implemented to send image uploads directly to the configured FastAPI origin.
- [ ] A valid upload above 4.5 MB and at or below 12 MB completes successfully.
- [ ] No production image upload passes through a Vercel Function.
- [x] Exact-origin CORS behavior is verified locally and by automated tests.
- [ ] YOLO is available and produces masks on the Free instance.
- [x] YOLO loads and produces a mask in the local Python 3.11 Free profile.
- [x] Depth and scene responses explicitly report Free-tier disabled status.
- [x] Concurrent analysis is bounded to one request.
- [x] Rate-limit and overload responses are deterministic and retryable.
- [x] `/health` and `/ready` satisfy their separate contracts locally.
- [x] Periodic cleanup removes expired session files while the service is awake.
- [ ] Restarting Render invalidates old ephemeral artifacts as documented.
- [ ] Vercel deploys only the standard Next.js application.
- [ ] `npm run lint` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm run build` passes.
- [x] FastAPI tests pass under Python 3.11.
- [ ] QAD-TC3, QAD-TC4, and QAD-TC8 pass in Vercel Preview.
- [ ] Cold-start and warm-analysis measurements are recorded without claiming the production NFR gate passed unless it actually did.
- [ ] A tested immutable rollback deployment or commit is recorded before cutover.
- [ ] Vercel and Render MCP deploy and log inspection results are recorded in the implementation evidence.

---

## Self-Check

- [x] The plan uses Render Free native Python and does not use Docker.
- [x] The Vercel upload-size issue is resolved by direct browser-to-Render traffic.
- [x] Free-tier storage, sleep, CPU, memory, and scaling limitations are explicit.
- [x] The plan does not claim persistent storage or guaranteed warm models.
- [x] Required YOLO behavior is preserved and optional models have a deterministic disabled state.
- [x] Public endpoint controls, concurrency protection, cleanup, readiness, and rollback are specified.
- [x] Vercel and Render MCP servers are the primary cloud control plane, with connection checks and safe stop conditions.
- [x] Production SDD and QAD gates are preserved rather than silently waived.
- [x] Implementation files are inventoried and the local implementation matches the staged rollout boundary.
- [x] AGENTS hard bans are applied; requirements have traceability and no secrets are hardcoded.

### 12.1 Local implementation evidence

Evidence recorded on September 29, 2026:

| Check | Result |
|---|---|
| Clean Python 3.11 dependency installation | Passed after correcting the existing PyTorch and Torchvision CPU-index pins to `2.13.0` and `0.28.0` without the unresolvable `+cpu` suffix |
| Python automated tests | 23 passed |
| Frontend automated tests | 403 passed |
| TypeScript typecheck | Passed |
| Next.js production build | Passed while intentionally retaining the proxy route for staged rollback |
| Targeted lint for fix-11 TypeScript files | Passed |
| Repository-wide lint | Blocked by pre-existing errors in unrelated files and ignored Python virtual-environment contents discovered by ESLint |
| Local Free-profile liveness and readiness | `/health` and `/ready` returned HTTP 200; YOLO available; depth and scene disabled |
| Representative local analysis | HTTP 200, YOLO mode active, foreground mask produced, and workspace plus mask artifacts returned HTTP 200 |
| Unauthorized-origin preflight | Rejected with HTTP 400 and no `Access-Control-Allow-Origin` header |
| Render MCP inventory | Dedicated `GlassFit` workspace exists and contains no services |
| Vercel MCP detail access | Blocked pending reauthorization to the project team scope; no Vercel or Render cloud mutation was attempted |
