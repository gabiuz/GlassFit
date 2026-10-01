# Quality Assurance Document (QAD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.3 (Capstone Production Release)
**Owner:** Jedia Nicole I. Sagun (Quality Assurance Lead) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** October 1, 2026 (Added QAD-TC54 for rotation steppers and QAD-TC55 for neutral perspective-fit orientation)
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
| QAD-TC3 | PRD-F3 | Space image upload and client-side pre-flight validation | Visualization workspace open | 1. Attempt upload of a 13 MB file<br>2. Attempt upload of a .pdf file<br>3. Upload a valid 4 MB JPG image | Over-limit and invalid files trigger clear validation feedback; the valid image renders on the preview canvas immediately | P0 |
| QAD-TC4 | PRD-F4 | FastAPI computer vision image analysis execution | Valid space photo uploaded | 1. Dispatch photo to `/analyze-image`<br>2. Await response | Status 200 returned within 2,500ms; JSON provides brightness, lighting condition, and YOLOv8 object masks | P0 |
| QAD-TC5 | PRD-F5 | Parametric window structural rebuild on width change | Window model active in workspace | 1. Set width to 900mm<br>2. Increase width to 1,500mm (crossing threshold) | 3D model dynamically reconfigures from 2-pane/1-mullion structure to 3-pane/2-mullion assembly | P0 |
| QAD-TC6 | PRD-F6 | 3D overlay placement, translation, scaling, and rotation | Space photo loaded in canvas | 1. Add product overlay<br>2. Drag overlay across canvas<br>3. Adjust scale and yaw angle | Model translates synchronously with pointer; yaw rotation updates perspective cleanly; transform bounds remain constrained | P0 |
| QAD-TC7 | PRD-F7 | Environmental lighting matching and glass mode changes | Active product on workspace | 1. Toggle glass mode between Clear, Frosted, and Bronze<br>2. Adjust shadow opacity slider | Three.js material transparency and roughness update in real time; contact shadow renders beneath frame | P1 |
| QAD-TC8 | PRD-F8 | Object-aware foreground occlusion layering | Detected furniture in room photo | 1. Place window model behind sofa bounding area<br>2. Toggle foreground occlusion 'ON' | YOLOv8 sofa segmentation mask renders over the window frame, creating depth layering | P1 |
| QAD-TC9 | PRD-F9 | Canvas compositing and high-resolution snapshot generation | User confirms visual arrangement | 1. Click 'Generate Snapshot'<br>2. Verify canvas composite capture | Offscreen canvas blends background, model, shadows, and masks into a single PNG; uploads to Cloudflare R2 | P0 |
| QAD-TC10 | PRD-F10 | Real-world dimension confirmation and quotation calculation | Snapshot generated | 1. Open measurement modal<br>2. Enter 1,400mm width and 1,200mm height<br>3. Submit dimensions | Price estimate updates dynamically based on component rules and variation pricing; source marked 'Manual' | P0 |
| QAD-TC11 | PRD-F11 | Consultation reference PDF creation and download | Quotation calculated | 1. Click 'Download PDF Quotation'<br>2. Open generated PDF document | PDF contains the snapshot, customer details, configuration and quantity per product item, one final item price, a reconciling grand total, disclaimer, blank wet-signature lines, and digital customer and estimator names with dates, with no BOM component costs, rates, labor, margin, original price, or negotiation note | P1 |
| QAD-TC12 | PRD-F12 | Customer authentication and mobile number validation | Finalizing quotation | 1. Register with email and Philippine phone (+63)<br>2. Complete login flow | Profile created in `public.profiles`; session cookie set; user redirected to finalize booking | P0 |
| QAD-TC13 | PRD-F13 | Signed booking link generation and messaging handoff | Authenticated user with quote | 1. Select 'Send via Messenger'<br>2. Click action button | SHA-256 token link created in `signed_booking_links`; deep-link opens Facebook Messenger with consultation reference | P0 |
| QAD-TC14 | PRD-F14 | Role-based back-office security and catalog authoring | User logs into `/admin` | 1. Log in as Customer<br>2. Attempt admin access<br>3. Log in as Staff/Owner | Customer receives 403 Forbidden; Staff accesses catalog workbench and booking management | P0 |
| QAD-TC15 | PRD-F14, PRD-F19 | Central Raw Materials Master Catalog CRUD & Price Updates | Authenticated Owner/Manager in `/admin/materials` | 1. Navigate to `/admin/materials`<br>2. Create/update aluminum profile unit price<br>3. Toggle active status | Material rates update immediately; RLS prevents customer edits; active rates reflect in dependent BOM calculations | P0 |
| QAD-TC16 | PRD-F5, PRD-F14 | Admin Part Inspector Auto-Binding & Preset Duplication | Uploading `.glb` parts in Step 4 wizard | 1. Drop `*sill*.glb` and `*interlocker*.glb`<br>2. Verify auto-detected dimension drivers and span ratios<br>3. Test duplication from preset | Filenames auto-bind to physical raw materials, span ratios (1.0x, 0.5x, 0.33x), and removable keys; duplication creates draft in under 2 minutes | P0 |
| QAD-TC17 | PRD-F5, PRD-F10 | Hybrid Engineering Guardrails & Structural Waiver Modal | 2-panel window active in workspace | 1. Widen aperture width to W >= 2400mm<br>2. Verify Behavior B prompt modal<br>3. Select 'Switch to 3 Panels' or 'Acknowledge Waiver' | Switching to 3 panels updates 3D model, rail ratios, and stiles; acknowledging waiver persists `structural_waiver: true` to quote, PDF, and booking link | P0 |
| QAD-TC18 | PRD-F10 | Mathematical Parametric BOM Pricing & Scrap Accuracy | Dimension confirmation and calculation | 1. Execute calculation across Scenarios 1 to 4<br>2. Verify 1D framing, 2D glass, 12% aluminum scrap, 10% glass scrap, Option A labor floor, and 25% margin | Final calculated prices match benchmark scenarios down to exact centavo; frozen snapshot preserved in `pricing_details` JSONB | P0 |
| QAD-TC19 | PRD-F14 | Admin Setup Wizard Step Switching & Component Persistence | Configured product draft in `/admin/products/[id]/setup` | 1. Upload components in Step 4<br>2. Navigate to Step 5 (Parameters)<br>3. Return to Step 4 (Components) | Uploaded parts, dimension bindings, and 3D preview meshes persist seamlessly without component loss or page reload | P0 |
| QAD-TC27 | PRD-F15, PRD-F16 | Alpha-aware direct model selection in Product Variant comparison | Two or more complete placed overlays in Product Variant mode | 1. Select overlapping products from both side-by-side panels<br>2. Select a product from slider mode away from the divider<br>3. Select each product using the keyboard-accessible button group<br>4. Resize through mobile and desktop breakpoints<br>5. Enable reduced motion | Topmost visible product is selected without coordinate drift; both panels and selector buttons remain synchronized; saved left/right finishes remain unchanged; divider drag remains isolated; reduced motion removes decorative movement | P1 |
| QAD-TC28 | PRD-F6, PRD-F9, PRD-F15, PRD-F16 | Bounded 24-finish comparison rendering and persistence | One or more configured overlays with render recipes | 1. Open Product Variant comparison<br>2. Select uncached finishes rapidly<br>3. Refresh the route<br>4. Simulate storage pressure<br>5. Proceed to quotation | All 24 choices remain available; requested work is prioritized; panels retain their last ready image; metadata restores from session storage; binary storage stays bounded; only the committed output is composed | P0 |
| QAD-TC29 | PRD-F13, PRD-F14 | Admin booking reflection and relational query integrity | Authenticated customer quotation and authorized admin account | 1. Submit a Messenger or Viber booking<br>2. Navigate to `/admin` and `/admin/bookings`<br>3. Refresh both views<br>4. Update status<br>5. Simulate a relational query failure | Both admin views show the correct customer and deduplicated fixture summary; status persists; refresh retrieves current data; query failure displays an error, retains the last successful rows when available, and never appears as an empty success | P0 |
| QAD-TC30 | PRD-F10, PRD-F11, PRD-F14 | Canonical quotation and effective final price | Saved V1 quotation and authorized booking manager | 1. Compare customer, public, and admin document previews<br>2. Apply item price overrides<br>3. Print the quotation | Every customer document surface uses the persisted V1 configuration and effective item prices; the internal calculated snapshot remains immutable; item prices reconcile to the grand total; no negotiation metadata is disclosed | P0 |
| QAD-TC31 | PRD-F10, PRD-F11, PRD-F14 | Per-item negotiation contract | Canonical, migrated, and legacy quotations plus authorized and unauthorized users | 1. Exercise item edit, equal reset, zero confirmation, partial and final reset<br>2. Test proportional migration, audit metadata, aggregate overflow, stale updates, and RLS<br>3. Verify legacy fallback and customer/public reads | Canonical item overrides are deterministic, authorized, atomic, audit-preserving, conflict-safe, and sanitized; totals reconcile in centavos; legacy total editing remains available only to legacy quotations | P0 |
| QAD-TC41 | PRD-F10, PRD-F11, PRD-F14 | Single-Product Negotiation Parity & ISO Datetime Normalization | Single-product and multi-product quotations with varying datetime timezone offsets | 1. Validate offset-tolerant ISO datetime strings in booking action schemas<br>2. Map single-product quotation to per-item negotiation view<br>3. Verify optimistic concurrency timestamp equivalence<br>4. Test item price override on single fixture quotation | Single-product quotations render standard Edit Price buttons; offset-bearing PostgreSQL timestamps validate cleanly without Invalid ISO datetime errors; equivalent timestamps prevent false conflict rejections | P0 |
| QAD-TC46 | PRD-F10, PRD-F12, PRD-F13, PRD-F14 | Admin Booking Discard-to-Hard-Delete and Quotation Purge | User authenticated as Admin with manage_bookings permission and active consultation booking | 1. Click Discard button in /admin/bookings<br>2. Confirm modal displays warning and consequence note<br>3. Cancel deletion and verify record remains intact<br>4. Re-open and confirm hard deletion<br>5. Check customer /my-requests and public /q/[code] routes | Discard opens confirmation modal; deletion executes atomic hard-delete cascade across booking_requests, signed_booking_links, quotation_items, and quotation_estimates; inspector focuses adjacent booking; customer /my-requests removes quotation; /q/[code] returns 404 | P0 |
| QAD-TC47 | PRD-F14, PRD-F10, PRD-F12, PRD-F13 | Admin Data Management Export, GlassFit Business Intelligence CSV, Native Analytics Charts, and System Backup | User authenticated as Admin with Owner role and active booking/catalog records | 1. Trigger Booking Records CSV export<br>2. Inspect Business Intelligence Modal and native visual charts<br>3. Trigger Product Records CSV export<br>4. Download System Backup JSON snapshot<br>5. Verify non-Owner 403 Forbidden enforcement | Booking export produces GlassFit branded CSV with executive KPI summary; Product export produces catalog specifications CSV; Business Intelligence Modal displays responsive SVG charts; Backup compiles complete JSON snapshot, updates last_backup_at in system_preferences, and enforces Owner-only authorization | P0 |
| QAD-TC48 | PRD-F1, PRD-F6, PRD-F14 | Unified Cross-Browser Brand Theme Scrollbar System & Contrast Verification | Chrome/Edge, Firefox, Safari desktop/mobile viewports with scrollable content | 1. Verify root and nested scrollbar geometry and colors<br>2. Test light and dark mode transitions<br>3. Inspect hover and active drag tactile states<br>4. Confirm transparent corner intersections<br>5. Verify hidden scrollbar on GuideLine | Unified 8px/6px floating cyan pill renders across all browsers; track is transparent; light/dark themes adapt instantly; hover/active states provide tactile feedback; WCAG 2.1 AA contrast >= 3.0:1 is satisfied; gesture scrollbars remain hidden | P1 |
| QAD-TC50 | PRD-F3, PRD-F4, PRD-F7 | Multi-Format Space Image Ingestion for WebP and HEIC/HEIF | Approved static fixtures for JPG, PNG, WebP, HEIC, and HEIF; corrupt, animated, MIME-conflict, over-12-MB, and over-40-MP fixtures; Chrome, Firefox, and Safari 17 or later | 1. Run client validator unit tests<br>2. Run FastAPI resolver and decoder tests<br>3. Upload each valid format end to end<br>4. Verify native or fallback preview behavior<br>5. Verify orientation, EXIF extraction, workspace output, rejection cases, and container readiness | Valid static WebP and HEIC/HEIF inputs reach the existing CV pipeline and produce an upright `workspace.webp`; JPG and PNG remain unchanged; invalid, animated, conflicting, oversized, or unsupported inputs return deterministic actionable errors without a 500 response; missing HEIF decoder fails service readiness | P0 |
| QAD-TC51 | PRD-F14 | Admin Product Type and Status Filters | Authenticated administrator on `/admin/products` with Published and Draft products across at least two product types | 1. Select each available product type<br>2. Select Published and Draft<br>3. Combine both filters with search<br>4. Verify the result counter and no-match reset<br>5. Verify keyboard operation<br>6. Run filtered-row Edit, Duplicate, and Delete smoke checks | The first control filters only by `product_type`; the second filters only by normalized lifecycle status; all active criteria combine with logical AND; count, empty state, keyboard behavior, and row actions remain correct | P1 |
| QAD-TC52 | PRD-F6 | Mobile Visualization Workspace Viewport, Scroll Isolation, and Touch Ergonomics | Editable product in `/visualize/[productId]/workspace`; compact portrait and landscape viewports; iOS Safari and Android Chrome | 1. Enter compact editor from a pre-scrolled page<br>2. Drag the canvas and open the nested perspective picker<br>3. Close only the picker and verify the page remains locked<br>4. Open the reused configuration drawer and operate its inputs<br>5. Drag all four handles at center and boundaries<br>6. Rotate portrait and landscape<br>7. Tap Done and re-enter<br>8. Verify 320px through 430px layouts, keyboard focus, reduced motion, and desktop regression | Editor uses the available `100dvh` stage without clipping; document scroll and pull-to-refresh remain isolated until the final lock owner exits; exact page position returns; portrait remains usable; inspector controls remain internally scrollable; actions meet 44px targets; touch proxy appears 48px above contact; invalid quadrilaterals cannot commit; desktop behavior remains unchanged | P1 |
| QAD-TC53 | PRD-F10, PRD-F11 | Quotation Preview and Browser-Saved PDF Reliability | Canonical single-fixture and multi-fixture quotations, reconstructed legacy quotation, approved print-safe brand asset, and supported desktop browsers | 1. Verify canonical HTML content and pricing assertions<br>2. Compare customer, administrator, and download-route output<br>3. Export fixed single-fixture and multi-fixture cases through native Save as PDF<br>4. Inspect Page 1 content, card fragmentation, currency wrapping, signatures, terms, waiver, and glyph rendering<br>5. Repeat diagnostic export with native headers and footers enabled | Page 1 retains text and foreground graphics; multi-fixture headers do not leak Fixture 1 specifications; compact fixture cards retain their price; currency values do not split; pricing and customer-safe disclosure remain correct; application content contains no administrative URL; browser-generated header limitations are accurately disclosed | P1 |
| QAD-TC54 | PRD-F6 | Discrete yaw and pitch degree stepper controls | Editable product overlay with Placement controls open; desktop Chrome and Firefox; iOS Safari and Android Chrome at 320px and 375px viewport widths | 1. Increase and decrease yaw using the stepper buttons<br>2. Increase and decrease pitch using the stepper buttons<br>3. Exercise both angle boundaries<br>4. Verify slider and numerical readout synchronization<br>5. Operate controls by keyboard<br>6. Inspect each button's rendered hit area and the 320px layout | Each stepper changes its angle by exactly 1 degree, values stay within yaw [-180, 180] and pitch [-90, 90], boundary buttons disable correctly, sliders and readouts stay synchronized, keyboard activation works, each stepper button has a minimum 44px by 44px interactive footprint, and controls fit at 320px without horizontal overflow or clipping | P1 |
| QAD-TC55 | PRD-F6 | Neutral yaw and pitch after perspective-fit confirmation | Editable product overlay with non-zero yaw and pitch; perspective picker available | 1. Set yaw and pitch to non-zero values<br>2. Confirm a symmetric perspective fit<br>3. Verify both controls and the current configuration snapshot<br>4. Adjust yaw and pitch after the fit<br>5. Confirm a second asymmetric fit<br>6. Verify the fitted render state and configuration snapshot again | Every confirmed perspective fit sets yaw and pitch to 0 degrees, the visible controls and current configuration agree with that state, the fitted renderer receives zero orientation on its next render, and subsequent manual adjustments remain available until another fit or placement reset | P1 |

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

## QAD-TC45: Role-Aware Administrator Email Change

MS30 automated coverage validates canonical Unicode names, mononyms, field limits, the self-targeted admin action interface, hashed approval tokens, generated-column safety, ERD-E20 RLS, and Auth email synchronization. Manual smoke coverage verifies Staff request delivery, protected approval and rejection, cancellation, retry, concurrent decision behavior, and immediate Owner or Manager self-change.

---

## QAD-TC46: Admin Booking Discard-to-Hard-Delete Workflow and Bidirectional Quotation Purge

MS31 coverage validates the destructive confirmation guard (`DiscardBookingModal`), atomic database procedure (`public.hard_delete_booking_quotation`), server action permission enforcement (`manage_bookings`), Next.js route revalidation, Cloudflare R2 object key deletion, customer `/my-requests` consultation purge, and `/q/[code]` invalidation.

---

## QAD-TC47: Admin Data Management Export, Business Intelligence CSV, Native Analytics Charts, and System Backup

MS32 coverage validates authenticated streaming route handlers (`/api/admin/export/bookings`, `/api/admin/export/products`, `/api/admin/export/backup`), GlassFit-branded business intelligence CSV compilation with executive KPI blocks and UTF-8 BOM, the interactive Business Intelligence Modal with pure SVG charts (`StatusDonutChart`, `TrendAreaChart`, `ChannelBarChart`, `ProductDistributionChart`), the JSON system backup snapshot engine with SHA-256 integrity checksum, live database audit updates via `public.record_system_backup`, and Owner-only security gate enforcement.

---

## QAD-TC48: Unified Cross-Browser GlassFit Brand Theme Scrollbar System & Contrast Verification

MS33 coverage validates the global and nested scrollbar implementation across Chromium, Blink, Gecko, and WebKit rendering engines in `src/app/globals.css`. Verification checks the 8px root floating pill geometry (6px for `.custom-scrollbar`), rounded ends (`border-radius: 9999px`), 2px transparent inset margins (`background-clip: content-box`), dynamic light/dark mode color token adaptation (`--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-thumb-active`), WCAG 2.1 AA contrast compliance (>= 3.0:1 non-text contrast), transparent corner intersections, and preservation of hidden gesture scrollbars (`.scrollbar-none`, `.no-scrollbar` in `GuideLine.tsx`).

---

## QAD-TC50: Multi-Format Space Image Ingestion for WebP and HEIC/HEIF

MS35 automated coverage must validate MIME and extension reconciliation, browser-decodable image integrity, HEIC/HEIF server delegation, decoder readiness, decoded-format verification, early decoded-pixel limits, static single-frame enforcement, corrupt-image exception mapping, EXIF extraction, orientation correctness, and OpenCV-compatible normalization. Browser verification covers Chrome and Firefox fallback cards plus native HEIC rendering in Safari 17 or later. Test fixtures must be repository-owned or redistributable, contain no private client photos, and include deterministic expected dimensions and orientation.

---

## QAD-TC51: Admin Product Type and Status Filters

MS36 automated coverage validates unique product type derivation, canonical ordering of present types, unknown-value fallback ordering, empty input, search-only filtering, type-only filtering, status-only filtering, combined filtering, query normalization, and input immutability. Manual browser coverage validates default and selected labels, accurate row counts, separate empty-catalog and no-match states, Reset filters, keyboard operation, responsive wrapping, and correct Edit, Duplicate, and Delete targets while filters are active.

---

## QAD-TC52: Mobile Visualization Workspace Optimization

MS37 coverage validates compact viewport classification, dynamic viewport and safe-area layout, nested document scroll ownership, exact exit restoration, advisory orientation behavior, responsive HUD reachability, 44px minimum targets, touch-only proxy geometry, quadrilateral validity, and desktop regression safety. Automated coverage is limited to pure geometry, classification, and source contracts because the repository has no DOM test environment dependency. iOS Safari and Android Chrome checks are mandatory for fixed-body scroll behavior, pull-to-refresh suppression, pointer capture, focus restoration, and mobile browser toolbar changes.

---

## QAD-TC53: Quotation Preview and Browser-Saved PDF Reliability

MS38 automated coverage validates canonical single-fixture and multi-fixture specification placement, effective item-price and grand-total reconciliation, customer-safe disclosure, compact-card fragmentation rules, long-string wrapping, non-breaking currency, print-safe asset structure, terms, signatures, waivers, legacy rendering, and surface parity. Manual coverage is mandatory because generated HTML assertions cannot prove native browser PDF output. The release record must identify browser version, operating system, print settings, and PDF viewer for Firefox and Chromium on macOS, Chromium on Windows, and Safari on macOS.

---

## Self-Check

- [x] Test distribution matrix defines tooling and coverage targets for all testing layers
- [x] Every test case has an assigned QAD-TC# identifier that maps to an upstream PRD-F# feature
- [x] Non-functional verification gates define automated pass/fail criteria
- [x] Defect severity definitions and release blocker policies are documented
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
