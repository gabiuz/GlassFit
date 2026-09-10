# System Design Document (SDD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** September 9, 2026 (Reconciled with 16-table Supabase schema, Next.js 16 App Router, and FastAPI CV backend)  
**PRD:** docs/prd-glassfit.md

---

## 1. System Architecture & Topology

**Core architectural pattern:**
Asynchronous hybrid multi-tier web architecture decoupling interactive client-side 3D WebGL rendering from compute-heavy backend computer vision and relational persistence. The system combines:
1. A Next.js 16 (React 19, TypeScript) presentation and edge orchestration layer hosted on Node.js 20 LTS.
2. A decoupled Python 3.11 FastAPI microservice running OpenCV, YOLOv8 segmentation, and Depth Anything V2 for asynchronous space image analysis.
3. A managed Supabase PostgreSQL 16 database enforcing 16 relational tables with Row-Level Security (RLS) and security definer functions.
4. A Cloudflare R2 S3-compatible object storage infrastructure distributing 3D GLB assets, component models, processed space photos, composite snapshots, and quotation PDFs via globally cached edge CDN endpoints.

**Runtime infrastructure:**
- Compute Frontend & API Layer: Node.js 20 LTS executing Next.js 16 App Router on Vercel / serverless runtime with standalone proxy middleware.
- Compute Computer Vision Layer: Python 3.11 runtime running FastAPI and Uvicorn workers on containerized Linux compute equipped with OpenCV-Python, Ultralytics YOLOv8s-seg, and PyTorch inference pipelines.
- Persistence Engine: Supabase PostgreSQL 16 with pgvector capability, RLS policies, automated schema triggers, and connection pooling.
- Object & Asset Storage: Cloudflare R2 bucket with private signed upload policies and public CDN distribution for static catalog assets.
- Identity & Authentication Provider: Supabase Auth supporting Email/Password and Google OAuth 2.0 PKCE flows, synchronized with internal user profiles.
- External Integration Targets: Facebook Messenger (`https://m.me/` and `fb-messenger://`) and Viber (`viber://chat?number=`) deep-link protocol schemes.

**Primary execution flow:**
1. Ingress Boundary: Client browser initiates TLS 1.3 HTTPS request to the Next.js edge route.
2. Authentication Verification: Next.js middleware and proxy handlers validate Supabase session JWT cookies, resolving user role context.
3. Space Image Upload and CV Analysis: The client transmits a space photograph to FastAPI `/analyze-image`. The service validates MIME headers, normalizes orientation, compresses to WebP, analyzes ambient luminance/color temperature, extracts foreground segmentation masks via YOLOv8, and returns a JSON scene descriptor within 1,800 milliseconds.
4. Client Visualization Assembly: The browser initializes a single Three.js WebGL canvas. Parametric models (such as multi-pane windows) query structural definitions from Supabase, dynamically instantiating frames, mullions, and glass panes based on real-time width parameters. Placed objects are cached as offscreen canvas layers to minimize mobile GPU pressure.
5. Canvas Compositing and Snapshot Generation: Upon configuration confirmation, the client composites the background photo, environmental light filters, 3D overlays, contact shadows, and YOLOv8 occlusion cutouts onto an HTML5 canvas. The flattened high-resolution image is uploaded directly to Cloudflare R2.
6. Quotation and Booking Handoff: The user enters real-world dimensions in the measurement modal. The server computes budgetary pricing, records `visualization_snapshots`, `product_configurations`, and `quotation_estimates`, generates a token-hashed `signed_booking_links` record, creates a PDF summary, and deep-links the client to the fabricator on Messenger or Viber.

---

## 2. Component Decomposition & Traceability

| Component ID | Component Name | Runtime Layer | Architectural Responsibility | Traces to PRD | Dependencies |
|---|---|---|---|---|---|
| SDD-C1 | Public Catalog & 3D Inspector | Next.js Client / SSR | Renders public product browsing catalog, filter grids, and interactive 360-degree Three.js WebGL model inspector on product detail pages. | PRD-F1, PRD-F2 | Supabase `products`, `product_assets`, Cloudflare R2 CDN, Three.js GLTFLoader |
| SDD-C2 | Space Image Pre-Flight Validator | Next.js Client | Performs client-side image validation (MIME type, file size <= 12MB, image decode integrity, aspect ratio sanity) prior to network transit. | PRD-F3 | HTML5 File API, Image Decode API, `src/lib/imageApi.ts` |
| SDD-C3 | Computer Vision Scene Analyzer | FastAPI Python Backend | Ingests uploaded room photo, extracts average brightness, color temperature (warm/cool), contrast, sharpness, runs YOLOv8s-seg foreground masks, and caches session WebP images. | PRD-F4, PRD-F7, PRD-F8 | FastAPI, OpenCV, NumPy, Ultralytics YOLOv8, PyTorch |
| SDD-C4 | Parametric 3D Assembly & Guardrail Engine | Three.js Client Runtime | Evaluates structural rules, leaf dead loads (2.5 rule), and width thresholds (W >= 2400mm) to dynamically assemble modular components or trigger Behavior B hybrid confirmation modals. | PRD-F5 | Three.js, `src/lib/visualization/guardrailEngine.ts`, Supabase `structural_rules` |
| SDD-C5 | Photo-Based Visualization Canvas | Next.js Client / HTML5 | Manages interactive placement, drag translation, uniform scaling, yaw/pitch rotation, layer reordering, environmental lighting filters, glass modes, and foreground occlusion. | PRD-F6, PRD-F7, PRD-F8, PRD-F16 | HTML Canvas 2D, Three.js WebGLRenderer, FastAPI Mask endpoints |
| SDD-C6 | Canvas Compositor & Snapshot Pipeline | Next.js Client / Edge | Blends background space photo, active/cached 3D product layers, contact shadows, and foreground occlusion masks into a flattened PNG snapshot; uploads to Cloudflare R2. | PRD-F9, PRD-F15 | HTML5 Canvas `toBlob()`, S3 Presigned URL client, Cloudflare R2, Supabase `visualization_snapshots` |
| SDD-C7 | Parametric BOM Pricing Engine & PDF Generator | Next.js Domain Service / Action | Computes decoupled 1D framing, 2D glass, O(1) hardware, 12% aluminum scrap, 10% glass scrap, Option A labor, and 25% margin; generates PDF with structural waiver disclaimers. | PRD-F10, PRD-F11 | Supabase `raw_materials`, `quotation_estimates`, `quotation_items`, `src/lib/pricing/pricingEngine.ts`, Cloudflare R2 |
| SDD-C8 | Signed Booking Link & Messaging Handoff | Next.js Server Action | Generates SHA-256 token-hashed consultation reference URLs (`signed_booking_links`), logs booking requests, and formats deep-links to Facebook Messenger and Viber. | PRD-F12, PRD-F13 | Supabase Auth, Crypto API, URL scheme builders (`m.me`, `viber://chat`) |
| SDD-C9 | Role-Based Admin Portal & Part Inspector | Next.js Protected Routes | Administrative console (`/admin`) with split-screen Three.js Part Inspector, raw materials master catalog (`/admin/materials`), and live test-drive calculation sandbox. | PRD-F14, PRD-F19 | Supabase RLS, `src/lib/admin/materials/materialActions.ts`, `src/lib/admin/products/autoDetection.ts`, S3 Presigned Upload API |

---

## 3. Interface & API Specifications

### 3.1 Network Endpoint Matrix

| Method | Endpoint Route | Auth Required | Request Payload / DTO | Response Payload / DTO | Target Latency (p95) |
|---|---|---|---|---|---|
| GET | `/health` | No | None | `{"status": "ok"}` | < 50 ms |
| POST | `/analyze-image` | No | Multipart Form: `image` (JPG/PNG <= 12MB) | JSON: `SpaceImageSession` (session_id, brightness, lighting, objects, masks) | < 2,000 ms |
| GET | `/masks/{session_id}/{filename}` | No | URL parameters | Binary image stream (PNG mask) | < 150 ms |
| GET | `/generated/sessions/{session_id}/workspace.webp` | No | URL parameters | Binary image stream (Optimized WebP workspace) | < 200 ms |
| GET | `/api/products` | No | Query params: `category`, `status` | Array of `ProductDetail` objects with primary assets | < 180 ms |
| POST | `/api/admin/assets/presigned-url` | Yes (Admin) | `{"fileName": string, "contentType": string, "assetType": string}` | `{"uploadUrl": string, "objectKey": string}` | < 250 ms |
| POST | `/api/visualization/snapshot` | Yes (Customer) | `{"session_id": string, "imageBlob": Blob, "configurations": [...]}` | `{"snapshot_id": string, "r2_key": string, "url": string}` | < 1,200 ms |
| POST | `/api/quotation/calculate` | Yes (Customer) | `{"snapshot_id": string, "measurements": [...]}` | `{"quotation_id": string, "quotation_number": string, "total": number}` | < 450 ms |
| POST | `/api/booking/generate-link` | Yes (Customer) | `{"quotation_id": string, "platform": "Messenger" | "Viber"}` | `{"signed_url": string, "token_hash": string, "deep_link": string}` | < 300 ms |
| POST | `/api/admin/staff/invite` | Yes (Owner) | `{"email": string, "role": string, "firstName": string, "lastName": string}` | `{"success": boolean, "profile_id": string}` | < 500 ms |

### 3.2 Detailed Data Transfer Contracts

**Contract 1: Backend Space Image Analysis (`POST /analyze-image`)**
- Request: Multipart form data with single field `image`. Allowed MIME types: `image/jpeg`, `image/png`. Max file size: 12,582,912 bytes (12 MB).
- Success Response (HTTP 200 OK):
  - `session_id`: UUIDv4 string identifying the temporary workspace session.
  - `image_url`: Relative path string to the normalized workspace WebP image.
  - `aspect_ratio`: Float representing width / height ratio.
  - `original_dimensions`: Object containing integer `width` and `height`.
  - `brightness`: Float between 0.0 (pitch black) and 1.0 (pure white).
  - `lighting`: Object containing `condition` (string: Daylight, Indoor, Low Light), `color_temperature` (string: Warm, Neutral, Cool), `tint_rgb` (array of 3 floats), and `recommended_shadow_opacity` (float: 0.1 to 0.7).
  - `detected_objects`: Array of objects containing `object_id` (string), `label` (string: chair, couch, potted plant, dining table), `confidence` (float: 0.0 to 1.0), `bounding_box` (array of 4 floats: x, y, width, height), and `mask_url` (string path to binary cutout mask).
- Error Response (HTTP 400 Bad Request):
  - `detail`: String error description (e.g., "Upload a JPG, JPEG, or PNG image." or "Upload an image smaller than 12 MB.").

**Contract 2: Signed Booking Reference Generation (`POST /api/booking/generate-link`)**
- Request Parameters:
  - `quotation_id`: UUIDv4 string referencing active `quotation_estimates(quotation_id)`.
  - `platform`: String enum value in `['Messenger', 'Viber']`.
- Success Response (HTTP 200 OK):
  - `link_id`: UUIDv4 string of newly inserted `signed_booking_links`.
  - `token_hash`: 64-character hexadecimal SHA-256 string.
  - `signed_url`: Fully qualified HTTPS URL including secure query token.
  - `deep_link`: Protocol scheme URL formatted for immediate client redirection (`https://m.me/glassfitph?ref=...` or `viber://chat?number=...`).
  - `expires_at`: ISO-8601 timestamp string (7 days from creation).
- Error Response (HTTP 401 Unauthorized / HTTP 422 Unprocessable):
  - `error`: Error code string (`ERR_AUTH_REQUIRED` or `ERR_INVALID_QUOTATION_STATE`).

---

## 4. Security Architecture & Identity Boundaries

**Authentication scheme:**
Supabase Auth utilizing standard JSON Web Tokens (JWT) and OpenID Connect with PKCE flow for Google OAuth. Browser clients maintain secure, HTTP-only, SameSite=Lax authentication cookies synchronized via Next.js server proxy middleware (`src/proxy.ts`).

**Authorization and isolation:**
Two-tier role-based access control (RBAC) enforced through PostgreSQL Row-Level Security (RLS) policies:
1. Customer Layer: Authenticated users can insert and read their own visualization snapshots, product configurations, quotations, and booking requests (`auth.uid() = profile_id`). Anonymous users possess read-only privileges to published catalog products and assets.
2. Administrative Layer: Privileged staff access `/admin` protected by a security definer function `public.is_admin(auth.uid())`. System roles are distinguished via `admin_roles`:
   - Owner: Unrestricted privileges including staff invitations, role assignments, system settings, and pricing formula management.
   - Manager: Catalog product authoring, 3D asset uploads, structural rule modifications, and quotation review.
   - Staff: Read-only catalog inspection, consultation booking triage, and customer status updates.

**Data protection posture:**
- In Transit: TLS 1.3 enforced across all web edge connections, browser-to-FastAPI calls, and database connections.
- At Rest: Database tables encrypted with AES-256 via Supabase storage engine; Cloudflare R2 bucket encrypts objects with AES-256 server-side encryption.
- Secrets Management: Zero credentials committed to version control. Production environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) injected securely at deployment runtime.
- Image Privacy & Sanitization: Uploaded space images stored in local FastAPI temporary directories are deleted automatically after a 120-minute time-to-live (`TEMP_SESSION_TTL_MINUTES`). Only client-confirmed final snapshots are transferred to permanent Cloudflare R2 storage.

---

## 5. Non-Functional Requirements & Resilience

| ID | Category | Requirement Target | Verification Method |
|---|---|---|---|
| SDD-NFR1 | Image Analysis Latency | p95 < 2,500 ms for complete CV analysis on 8-megapixel photo | Automated k6 load test against FastAPI `/analyze-image` |
| SDD-NFR2 | 3D Rendering Framerate | Stable >= 55 FPS during 3D model rotation and translation on mobile | Chrome DevTools Performance Profiler on mid-tier Android (Snapdragon 680) |
| SDD-NFR3 | Canvas Compositing Time | < 1,200 ms to composite and encode 1080p final snapshot to PNG | Client-side performance timing instrumentation |
| SDD-NFR4 | System Availability | 99.9% uptime excluding scheduled maintenance | External synthetic HTTP health probe on `/health` |
| SDD-NFR5 | Peak Concurrency | 150 concurrent active visualization sessions without memory overflow | Staging load harness simulating simultaneous image analysis and asset streaming |

| Subsystem Dependency | Failure Mode | Circuit Breaker Condition | Fallback Action |
|---|---|---|---|
| FastAPI CV Microservice | Process Crash or Network Timeout (> 5s) | 3 consecutive failures within 60 seconds | Fall back to client-side neutral lighting defaults (Daylight, 0.4 shadow opacity); bypass YOLOv8 masks while preserving full 3D canvas placement. |
| Cloudflare R2 Asset CDN | Network Egress Timeout / HTTP 5xx | 3 failed asset requests within 30 seconds | Display visual fallback placeholder mesh; present toast notifying user to check internet connectivity and retry. |
| Supabase Relational DB | Connection Pool Saturation | Transaction queue wait time > 1,000 ms | Return cached catalog read results from Next.js ISR/Data Cache; queue non-critical telemetry writes. |

---

## Self-Check

- [x] Core architectural pattern, runtime platform, and execution flow are documented
- [x] Every component has an assigned SDD-C# identifier that maps to an upstream PRD-F# feature
- [x] API endpoint matrix specifies methods, routes, payloads, and latency targets
- [x] Security architecture details authentication, authorization, and cryptographic isolation
- [x] Non-functional requirements specify objective quantitative thresholds
- [x] Dependency failure modes and circuit breaker behaviors are established
- [x] No flowcharts, decision trees, or box diagrams use code blocks with arrows or box-drawing characters
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
