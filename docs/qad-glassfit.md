# Quality Assurance Document (QAD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Jedia Nicole I. Sagun (Quality Assurance Lead) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** September 9, 2026 (Reconciled with Vitest test suites, Playwright E2E suites, and ISO/IEC 25010 evaluation protocols)  
**PRD:** docs/prd-glassfit.md

---

## 1. Test Strategy & Distribution Matrix

| Test Layer | Target Boundary | Tool / Framework | Minimum Coverage Target | CI/CD Trigger Cadence |
|---|---|---|---|---|
| Unit Testing | Parametric rule calculations, image pre-flight validation, dimension formula calculators, pricing algorithms | Vitest / Jest | 85% statement coverage | Every pull request commit |
| Integration Testing| FastAPI image analysis routes, Supabase RLS policies, Cloudflare R2 presigned uploads, server actions | pytest / Playwright API / Supertest | 80% surface coverage | Pre-merge branch validation |
| End-to-End Testing | Complete critical customer journeys from catalog browsing to signed Messenger booking handoff | Playwright | 100% of Must-Have flows | Nightly automated runs and pre-release gate |
| Non-Functional Testing| CV inference latency, mobile WebGL framerate, WCAG accessibility, concurrent load | k6 / Chrome DevTools / Axe-core | 100% of critical paths | Prior to production release candidate sign-off |

---

## 2. Traceable Test Catalog

| Test ID | Traces to PRD | Test Scenario Description | Preconditions | Execution Steps | Expected Result | Severity |
|---|---|---|---|---|---|---|
| QAD-TC1 | PRD-F1 | Public catalog rendering and category filtering | Unauthenticated user on homepage | 1. Navigate to `/product`<br>2. Click category filter 'Window'<br>3. Verify displayed cards | Only products categorized under 'Window' are displayed; cards show image, name, and base price | P1 |
| QAD-TC2 | PRD-F2 | Interactive 3D model inspector orbit and inspection | Product detail page loaded | 1. Open product page<br>2. Drag on 3D canvas to orbit<br>3. Pinch or scroll to zoom | 3D GLB model rotates smoothly in 360 degrees; texture maps load without WebGL context loss | P1 |
| QAD-TC3 | PRD-F3 | Space image upload and client-side pre-flight validation | Visualization workspace open | 1. Attempt upload of 15MB file<br>2. Attempt upload of .pdf file<br>3. Upload valid 4MB JPG image | Over-limit and invalid files trigger clear validation toasts; valid image renders on preview canvas immediately | P0 |
| QAD-TC4 | PRD-F4 | FastAPI computer vision image analysis execution | Valid space photo uploaded | 1. Dispatch photo to `/analyze-image`<br>2. Await response | Status 200 returned within 2,500ms; JSON provides brightness, lighting condition, and YOLOv8 object masks | P0 |
| QAD-TC5 | PRD-F5 | Parametric window structural rebuild on width change | Window model active in workspace | 1. Set width to 900mm<br>2. Increase width to 1,500mm (crossing threshold) | 3D model dynamically reconfigures from 2-pane/1-mullion structure to 3-pane/2-mullion assembly | P0 |
| QAD-TC6 | PRD-F6 | 3D overlay placement, translation, scaling, and rotation | Space photo loaded in canvas | 1. Add product overlay<br>2. Drag overlay across canvas<br>3. Adjust scale and yaw angle | Model translates synchronously with pointer; yaw rotation updates perspective cleanly; transform bounds remain constrained | P0 |
| QAD-TC7 | PRD-F7 | Environmental lighting matching and glass mode changes | Active product on workspace | 1. Toggle glass mode between Clear, Frosted, and Bronze<br>2. Adjust shadow opacity slider | Three.js material transparency and roughness update in real time; contact shadow renders beneath frame | P1 |
| QAD-TC8 | PRD-F8 | Object-aware foreground occlusion layering | Detected furniture in room photo | 1. Place window model behind sofa bounding area<br>2. Toggle foreground occlusion 'ON' | YOLOv8 sofa segmentation mask renders over the window frame, creating depth layering | P1 |
| QAD-TC9 | PRD-F9 | Canvas compositing and high-resolution snapshot generation | User confirms visual arrangement | 1. Click 'Generate Snapshot'<br>2. Verify canvas composite capture | Offscreen canvas blends background, model, shadows, and masks into a single PNG; uploads to Cloudflare R2 | P0 |
| QAD-TC10 | PRD-F10 | Real-world dimension confirmation and quotation calculation | Snapshot generated | 1. Open measurement modal<br>2. Enter 1,400mm width and 1,200mm height<br>3. Submit dimensions | Price estimate updates dynamically based on component rules and variation pricing; source marked 'Manual' | P0 |
| QAD-TC11 | PRD-F11 | Consultation reference PDF creation and download | Quotation calculated | 1. Click 'Download PDF Quotation'<br>2. Open generated PDF document | PDF contains snapshot image, itemized cost breakdown, preliminary disclaimer, and customer details | P1 |
| QAD-TC12 | PRD-F12 | Customer authentication and mobile number validation | Finalizing quotation | 1. Register with email and Philippine phone (+63)<br>2. Complete login flow | Profile created in `public.profiles`; session cookie set; user redirected to finalize booking | P0 |
| QAD-TC13 | PRD-F13 | Signed booking link generation and messaging handoff | Authenticated user with quote | 1. Select 'Send via Messenger'<br>2. Click action button | SHA-256 token link created in `signed_booking_links`; deep-link opens Facebook Messenger with consultation reference | P0 |
| QAD-TC14 | PRD-F14 | Role-based back-office security and catalog authoring | User logs into `/admin` | 1. Log in as Customer<br>2. Attempt admin access<br>3. Log in as Staff/Owner | Customer receives 403 Forbidden; Staff accesses catalog workbench and booking management | P0 |
| QAD-TC15 | PRD-F14, PRD-F19 | Central Raw Materials Master Catalog CRUD & Price Updates | Authenticated Owner/Manager in `/admin/materials` | 1. Navigate to `/admin/materials`<br>2. Create/update aluminum profile unit price<br>3. Toggle active status | Material rates update immediately; RLS prevents customer edits; active rates reflect in dependent BOM calculations | P0 |
| QAD-TC16 | PRD-F5, PRD-F14 | Admin Part Inspector Auto-Binding & Preset Duplication | Uploading `.glb` parts in Step 4 wizard | 1. Drop `*sill*.glb` and `*interlocker*.glb`<br>2. Verify auto-detected dimension drivers and span ratios<br>3. Test duplication from preset | Filenames auto-bind to physical raw materials, span ratios (1.0x, 0.5x, 0.33x), and removable keys; duplication creates draft in under 2 minutes | P0 |
| QAD-TC17 | PRD-F5, PRD-F10 | Hybrid Engineering Guardrails & Structural Waiver Modal | 2-panel window active in workspace | 1. Widen aperture width to W >= 2400mm<br>2. Verify Behavior B prompt modal<br>3. Select 'Switch to 3 Panels' or 'Acknowledge Waiver' | Switching to 3 panels updates 3D model, rail ratios, and stiles; acknowledging waiver persists `structural_waiver: true` to quote, PDF, and booking link | P0 |
| QAD-TC18 | PRD-F10 | Mathematical Parametric BOM Pricing & Scrap Accuracy | Dimension confirmation and calculation | 1. Execute calculation across Scenarios 1 to 4<br>2. Verify 1D framing, 2D glass, 12% aluminum scrap, 10% glass scrap, Option A labor floor, and 25% margin | Final calculated prices match benchmark scenarios down to exact centavo; frozen snapshot preserved in `pricing_details` JSONB | P0 |
| QAD-TC19 | PRD-F14 | Admin Setup Wizard Step Switching & Component Persistence | Configured product draft in `/admin/products/[id]/setup` | 1. Upload components in Step 4<br>2. Navigate to Step 5 (Parameters)<br>3. Return to Step 4 (Components) | Uploaded parts, dimension bindings, and 3D preview meshes persist seamlessly without component loss or page reload | P0 |

---

## 3. Non-Functional Verification Gates

| Gate ID | Quality Category | Evaluation Target | Verification Mechanism | Gate Action on Failure |
|---|---|---|---|---|
| QAD-VG1 | Security Scan | Zero High or Critical CVE vulnerabilities | `npm audit` and dependency scanner | Immediate build termination |
| QAD-VG2 | CV Inference Latency | Ingress p95 < 2,500ms on 8MP photo under 20 concurrent requests | Automated k6 load harness against FastAPI `/analyze-image` | Blocks release candidate promotion |
| QAD-VG3 | Mobile Framerate | Sustained framerate >= 55 FPS during 3D transform interactions | Chrome DevTools Performance profile on mobile emulation | Fails pull request performance check |
| QAD-VG4 | Web Accessibility | Zero WCAG 2.1 Level AA violations | Automated Axe-core scan on all public and workspace routes | Blocks production deployment |
| QAD-VG5 | Canvas Snapshot Integrity | Flattened composite generated in < 1,200ms with zero visual artifacts | Automated headless Chromium snapshot comparison | Rejects pull request |

---

## 4. Defect Classification & Release Governance

- P0 (Catastrophic Blocker): Total system unavailability, 3D WebGL failure to render on supported browsers, computer vision microservice crash, silent quotation price calculation errors, or authentication/RLS bypass. Deployment to staging or production is strictly prohibited.
- P1 (Critical Defect): Severe feature impairment where a core capability fails (such as failure to generate consultation PDF, failure to redirect to Messenger/Viber, or occlusion cutout distortion) with no automated fallback. Requires technical lead sign-off and immediate hotfix.
- P2 (Major Defect): Functional impairment with an active operational fallback (such as temporary unavailability of automated lighting analysis falling back to manual default lighting, or minor slider sensitivity issues). Remediation scheduled for subsequent sprint.
- P3 (Minor Defect): Superficial visual imperfection, spacing misalignment, or non-confusing cosmetic typo. Does not block deployment.

---

## Self-Check

- [x] Test distribution matrix defines tooling and coverage targets for all testing layers
- [x] Every test case has an assigned QAD-TC# identifier that maps to an upstream PRD-F# feature
- [x] Non-functional verification gates define automated pass/fail criteria
- [x] Defect severity definitions and release blocker policies are documented
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
