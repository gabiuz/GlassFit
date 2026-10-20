# Quality Assurance Document (QAD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Date:** September 9, 2026
**Version:** 1.3 (Capstone Production Release)
**Owner:** Jedia Nicole I. Sagun (Quality Assurance Lead) & GlassFit Capstone Team (PUP CCIS)
**Status:** Locked
**Last reconciled:** October 19, 2026 (Added QAD-TC77 for the contract-preserving paper reference confirmation UI redesign)
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
| QAD-TC59 | PRD-F5, PRD-F6, PRD-F7, PRD-F8, PRD-F9, PRD-F10 | Cross-product workspace continuity | One room with two placed windows and one door, distinct configurations, and parametric and fixed models when available | 1. Edit same and different product overlays<br>2. Add and change products<br>3. Throttle definition and model loads<br>4. Fail and retry each load<br>5. Race selections and reset room<br>6. Refresh and navigate Back<br>7. Repeat on mobile with occlusion, perspective, snapshot, and quotation | Active definition, configuration, model, price, session, and URL agree at every successful switch; failed or stale requests preserve the prior scene; room, layers, canvas, WebGL context, and scroll position persist; owned model resources are released | P0 |
| QAD-TC60 | PRD-F3, PRD-F4, PRD-F6, PRD-F10 | Dual-Mode Space Ingestion and Fiducial Paper Calibration Intake | User on `/visualize/[productId]/upload` | 1. Verify Quick Preview default state<br>2. Select Precision Calibration mode<br>3. Inspect Philippine paper standard options (Short, A4, Long)<br>4. Select A4 and verify guidelines update<br>5. Drop image and inspect multipart dispatch | Dual-mode selector defaults to Quick Preview; Precision expands paper selector with Short Bond default; guidelines switch to fiducial wall placement; POST /analyze-image payload contains calibration_mode: 'paper_fiducial' and selected paper_standard; Quick Preview dispatches calibration_mode: 'standard' with no paper_standard | P0 |
| QAD-TC61 | PRD-F4, PRD-F3, PRD-F10 | Metric Scale & Planar Homography Fiducial Detection Engine | Image uploaded with calibration parameters to `/analyze-image` | 1. Upload standard image with calibration_mode='standard'<br>2. Upload A4 wall photo with calibration_mode='paper_fiducial' and paper_standard='a4'<br>3. Upload occluded/blank image<br>4. Benchmark execution latency | Standard mode skips paper detection returning status='not_requested'; visible A4 returns status='detected', confidence >= 0.70, 4 ordered corners, and metric scale within ±3%; low-contrast falls back to status='manual_pin_required' without 500; pipeline executes in under 45ms | P0 |
| QAD-TC62 | PRD-F6, PRD-F10, PRD-F3, PRD-F4, PRD-F5 | Interactive Fiducial Pin Fallback & Precision Dimension Grounding | Session initialized with paper calibration metadata or standard heuristics | 1. Inspect workspace HUD on calibrated session<br>2. Trigger manual pin fallback modal on status='manual_pin_required'<br>3. Drag 4 corner pins and confirm<br>4. Verify initial dimensions and perspective quad dimension calculations<br>5. Confirm measurement modal and inspect quotation item source | Auto-detected paper displays emerald HUD badge (±2-5% Precision); manual_pin_required opens FiducialPaperPickerModal before workspace; 4-corner pinning derives canonical scale; computeEstimatedDimensions grounds directly with 100% scale weighting; MeasurementConfirmationModal displays Calibrated Visual badge and persists dimension_source='calibrated_visual' | P0 |
| QAD-TC63 | PRD-F4, PRD-F3, PRD-F10 | Autonomous Multi-Standard Paper Fiducial Detection and Resilient Scale Engine | Image uploaded to `/analyze-image` under `auto_detect` or `paper_fiducial` mode | 1. Upload visible A4 photo under `calibration_mode='auto_detect'`<br>2. Upload Short Bond photo under `paper_standard='short'`<br>3. Upload photo with paper in landscape orientation<br>4. Upload low-contrast or blank image<br>5. Upload photo under `calibration_mode='standard'`<br>6. Benchmark execution latency | Auto-detect resolves A4 with status='detected', confidence >= 0.70, and accurate scale factor; Short Bond matches 1.2941 aspect ratio; landscape correctly swaps orientation dimensions; low-contrast returns status='manual_pin_required' with confidence=0.0 without 500 error; standard mode skips detection with status='not_requested'; latency remains under 45ms | P0 |
| QAD-TC64 | PRD-F6, PRD-F3, PRD-F10 | Session-Permanent Calibration State and Fallback Pinning Lifecycle | Space image uploaded under paper calibration mode or standard mode; multi-product workspace active | 1. Upload room photo with auto-detected paper<br>2. Upload photo with ambiguous paper (status='manual_pin_required') and pin corners<br>3. Verify HUD switches to Calibrated Scale and status commits to sessionStorage<br>4. Add second product (mode='add') and verify calibrated scale is inherited without re-opening modal<br>5. Navigate to /quotation and return<br>6. Click 'Adjust Marker' from workspace HUD and fine-tune corners | Auto-detected paper skips modal and shows emerald HUD badge; manual pin modal opens only on initial entry for ambiguous images; confirming or skipping permanently sets status to 'calibrated' or 'heuristic_fallback'; adding products or quotation round-trips retains scale without modal interruption; 'Adjust Marker' re-opens modal with preserved coordinates | P0 |
| QAD-TC65 | PRD-F5, PRD-F6, PRD-F10 | Grounded Real-World 3D Model Sizing and Quotation Parity | Calibrated room photo active in workspace stage; perspective fit and measurement modal open | 1. Place model into calibrated room photo<br>2. Confirm 4-point perspective fit on opening<br>3. Add second product to calibrated scene<br>4. Open Measurement Confirmation Modal<br>5. Confirm calibrated dimensions vs manual override<br>6. Verify quotation item pricing_details in Supabase | Initial dimensions ground directly to coplanar scale without template blending; perspective fit dimensions match opening pixel span multiplied by scale factor (±2% to 5% accuracy); newly added products inherit calibrated scale; modal renders emerald trust badge and Choice Cards; quotation items persist dimension_source='calibrated_visual' and calibration metadata | P0 |
| QAD-TC66 | PRD-F3, PRD-F4, PRD-F6 | Pre-Workspace Fiducial Paper Detection Confirmation and Interactive Refinement Gateway | Image uploaded with detected paper or paper calibration mode | 1. Upload photo with paper fiducial<br>2. Inspect PaperDetectionConfirmationModal<br>3. Adjust corner pins with 2.5x loupe<br>4. Change paper standard<br>5. Confirm or skip to heuristic fallback | Detected corners highlight with glowing emerald quad; single-tap approval locks status='verified_calibrated' and user_verified=true; 2.5x magnifier aids corner refinement; non-blocking fallback allows continuing with heuristics | P0 |
| QAD-TC67 | PRD-F5, PRD-F6, PRD-F10 | Grounded Model Dimensioning Accuracy, Aperture Fitting, and Workspace Dynamic Synchronization | Calibrated workspace with active 3D models and perspective quad controls | 1. Verify model initializes with verified scale dimensions<br>2. Inspect live floating bounding box badges and lock icon<br>3. Adjust perspective quad corners and check live mm edge readouts<br>4. Click Adjust Marker from HUD and confirm new scale<br>5. Add second fixture and check scale inheritance<br>6. Confirm quotation and inspect persisted source | Dimensions ground to verified scale without template blending; bounding box displays mm/cm badges with lock icon; quad edges show live millimeter readouts; marker re-adjustment hot-rescales active and placed fixtures with Three.js mesh re-extrusion; second product inherits verified scale; quotation items persist dimension_source='verified_calibrated_visual' | P0 |
| QAD-TC68 | PRD-F3, PRD-F4 | Reliable Automatic Paper Detection and Reference Selection | Uploaded space photo with reference or distractors | 1. Test shadow and low contrast<br>2. Test multiple rectangles and foreshortening<br>3. Confirm actual format and same-plane placement<br>4. Select, reject, or edit outline<br>5. Skip to approximate preview | Bounded workspace candidates with explicit ambiguity or abstention; no inferred physical format or automatic metric success; corrections replace old source and transforms; both aliases cleared on skip | P0 |
| QAD-TC73 | PRD-F3, PRD-F4, SDD-C2, SDD-C3 | Click-Guided Interactive Paper Localization and Seed Snap | Low-contrast or cluttered space photo | 1. Open confirmation modal<br>2. Tap inside paper sheet<br>3. Snapped corners enclose seed | System extracts paper boundary containing seed; 4 corner pins snap to sheet perimeter within 400ms; candidate_found outcome | P0 |
| QAD-TC74 | PRD-F4, PRD-F5, PRD-F6, SDD-C3 | Sub-Pixel Edge Snapping and Magnetic Loupe Alignment | Interactive paper confirmation modal | 1. Drag corner pin near edge<br>2. Loupe crosshair snaps to gradient peak<br>3. Inspect snapped corner error | Sub-pixel line intersection locates true corners with < 1.0px error; crosshair magnetically snaps within 6px; smooth drag release | P0 |
| QAD-TC75 | PRD-F4, PRD-F5, PRD-F6, PRD-F10 | Perspective Unwarping Aspect Ratio Matcher and Model Sizing | Angled space capture with physical fiducial | 1. Snap paper fiducial<br>2. Inspect recommended standard and ratio<br>3. Confirm standard and fit opening | System rectifies homography, computes unwarped ratio, auto-suggests canonical Philippine standard with >= 95% confidence; model dimensions match tape within +- 2.0% | P0 |
| QAD-TC76 | PRD-F3, PRD-F4, PRD-F5, PRD-F6, PRD-F10 | Empirical Real-World Accuracy Benchmark and Comparative Release Protocol | Physical evaluation dataset with steel tape ground truth | 1. Run MOD-AUTO, MOD-CLICK, MOD-MANUAL<br>2. Measure corner RMSE, per-axis errors, MTTC<br>3. Evaluate statistical release gates | MOD-CLICK achieves >= 92% coverage, corner RMSE <= 2.2px, median error <= 1.8%, MTTC < 6.0s (80%+ time reduction vs manual), 0 false promotions | P0 |

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

## QAD-TC61: Metric Scale & Planar Homography Fiducial Detection Engine

MS46 automated coverage validates canonical Philippine paper standard lookup (Short, A4, Long), multi-scale adaptive edge detection and morphological closing, 4-vertex convexity and area ratio bounds, interior corner angle filtering (60 to 120 degrees), aspect ratio tolerance matching (upright and landscape within 15%), canonical corner ordering [TL, TR, BR, BL], Direct Linear Transform planar homography matrix computation, coplanar metric scale derivation (cm per pixel), confidence scoring, graceful fallback to manual_pin_required on low contrast or blank images, and sub-45ms execution budget on 1024x1024 inputs.

---

## QAD-TC62: Interactive Fiducial Pin Fallback and Precision Dimension Grounding

MS47 automated coverage validates client-side canonical corner sorting ([TL, TR, BR, BL]), physical scale derivation (cm per pixel) across upright and landscape Philippine paper standards (Short, A4, Long), direct coplanar dimension grounding in `computeEstimatedDimensions()` and `getScaleAwareInitialDimensions()` without heuristic height blending, boundary clamping and touch proxy interaction in `FiducialPaperPickerModal`, workspace HUD calibration indicators, measurement confirmation trust badges, and persistence of `dimension_source="calibrated_visual"` into quotation items.

---

## QAD-TC63: Autonomous Multi-Standard Paper Fiducial Detection and Resilient Scale Engine

MS48 automated coverage validates autonomous paper standard identification (Short Bond, A4, Long Bond) matching standard aspect ratios (1.2941, 1.4142, 1.5455) across upright and landscape orientations without requiring manual client standard selection, adaptive multi-scale edge detection under diverse ambient lighting conditions, robust fallback to `status="manual_pin_required"` on ambiguous or low-contrast captures, and sub-45ms execution latency on 1024x1024 input frames.

---

## QAD-TC64: Session-Permanent Calibration State and Fallback Pinning Lifecycle

MS49 automated coverage validates session mutation (`updateSessionCalibration`), preservation of `calibrationMeta` and `scaleEstimation` across `add`, `change`, and `edit` product transitions in `transitionSessionState()`, resilient JSON serialization and hydration across all storage quota fallback tiers (`writeStoredVisualizationSession`), suppression of the pinning modal on hydrated calibrated sessions, grounded initial dimensions calculation for newly added products, and non-intrusive on-demand adjustment via the workspace HUD.

---

## QAD-TC65: Grounded Real-World 3D Model Sizing and Quotation Parity

MS50 automated coverage validates direct coplanar scale application in `computeEstimatedDimensions()` with 100% mathematical weight (bypassing default height blending and depth correction), scale-aware initial sizing for added fixtures via `getScaleAwareInitialDimensions()`, perspective quadrilateral fit grounding, emerald trust indicators and choice cards in `MeasurementConfirmationModal`, and persistence of verified physical measurements into quotation line items (`pricing_details.dimension_source = "calibrated_visual"`).

---

## QAD-TC66: Pre-Workspace Fiducial Paper Detection Confirmation and Interactive Refinement Gateway

MS51 automated coverage validates upload pipeline interception via `PaperDetectionConfirmationModal` prior to workspace entry, visual confirmation of auto-detected paper boundaries with emerald perimeter overlays, single-tap approval locking `status="verified_calibrated"` and `user_verified=true`, live physical scale calculation across Philippine paper standards (Short Bond, A4, Long Bond), real-time corner refinement with 2.5x circular magnifier loupe and adaptive viewport boundary clamping, convexity guardrails preventing confirmation of self-intersecting quadrilaterals, non-blocking fallback to heuristic sizing (`status="heuristic_fallback"`), and suppression of redundant pinning prompts during workspace hydration.

---

## QAD-TC67: Grounded Model Dimensioning Accuracy, Aperture Fitting, and Workspace Dynamic Synchronization

MS52 automated coverage validates pure coplanar scale application in `getVerifiedScaleInitialDimensions()` and `computeEstimatedDimensions()` (bypassing default window/door template heights and depth corrections), live floating bounding box physical dimension badges with lock icon and verified scale tags, real-time millimeter edge dimension callouts in `PerspectivePlanePicker`, hot dynamic rescaling of active and placed fixtures upon marker re-adjustment via `PaperDetectionConfirmationModal` without resetting finishes/materials or quotation state, multi-product scale inheritance for added fixtures (`mode: "add"`), manufacturing fabrication safety clamping ([30cm, 600cm] width and [30cm, 400cm] height), and quotation item payload persistence of `pricing_details.dimension_source = "verified_calibrated_visual"`, `paper_standard`, `calibration_scale_cm_per_px`, and `user_verified`.

---

## QAD-TC68: Reliable Automatic Paper Detection and Reference Selection

`npm run test:ms53` covers explicit automatic intake, malformed or legacy response rejection, format and placement declaration, candidate/manual source tracking, geometry replacement, transform invalidation, and clearing rejected references. From `fastapi-service`, run `python -m pytest tests/test_paper_calibration.py -q` for deterministic synthetic boundary evidence, ambiguity, foreshortening, crop abstention, nested-outline deduplication, unknown formats, and workspace-coordinate API checks. Prior QAD-TC61/QAD-TC63 expectations for image-aspect format inference and automatic metric success are superseded by MS53. Geometry confidence is unknown until independently evaluated, rather than a hardcoded manual-pin score.

Original diagnostic attachment files were unavailable during implementation. Real-photo cases QAD-TC68.1 and QAD-TC68.2, manual mobile review, threshold tuning/freezing, and holdout accuracy require MS57 validation. Synthetic test success is not a release accuracy claim.

---

## Self-Check

- [x] Test distribution matrix defines tooling and coverage targets for all testing layers
- [x] Every test case has an assigned QAD-TC# identifier that maps to an upstream PRD-F# feature
- [x] Non-functional verification gates define automated pass/fail criteria
- [x] Defect severity definitions and release blocker policies are documented
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes


## QAD-TC69: Perspective-Correct Metric Measurement and Coordinate Integrity

IMP-MS54 supersedes scalar-only accuracy expectations in QAD-TC61, QAD-TC62, QAD-TC65, and QAD-TC67. Existing intake, fallback, fabrication rules, and quotation regression coverage remain applicable.

| Case | Acceptance | Automated evidence |
|---|---|---|
| QAD-TC69.1 | Perspective synthetic width/height relative error at most 0.000001 | metricGeometry.test.ts known-plane fixtures |
| QAD-TC69.2 | Opening position has no scalar position bias | Multiple metric locations under one camera transform |
| QAD-TC69.3 | Resize, crop, rotation, letterbox, pan, zoom, DPR preserve coordinates | Composed synthetic transforms and normalized storage round trip |
| QAD-TC69.4 | Explicit landscape physical edge correspondence | Long-side mapping and orientation declaration rejection |
| QAD-TC69.5 | Degenerate, horizon, inconsistent edges, and severe sensitivity abstain | Typed rejection fixtures; out-of-range physical readings remain unclamped |
| QAD-TC69.6 | Automatic and manual review share geometry | Matrix parity, revision increment, session recalculation and invalidation |
| QAD-TC69.7 | Real angled photo passes independent width/height release gates or abstains | Pending annotated images and MS57 evaluation |

Provisional engineering gates: paper area at least 4 square workspace pixels, paper edges at least 1 pixel, normalized solver pivot tolerance 1e-10, denominator minimum relative magnitude 1e-8, opposite-edge disagreement at most 10%, angle absolute cosine at most 0.15, and independent maximum relative sensitivity at most 10% under signed one-coordinate 1-pixel perturbations of paper and opening corners. Sensitivity is a diagnostic, not a confidence interval. MS57 must derive localization uncertainty from annotations and freeze thresholds before holdout evaluation. No real-photo accuracy claim is established.


## QAD-TC70: Reference Plane Eligibility and Recovery

Traces to IMP-MS55, PRD-F3, PRD-F4, PRD-F6, PRD-F10, SDD-C3, SDD-C5, DSD-UI3, DSD-UI4, DSD-UI7. Automated suite: `npm run test:ms55`.

| Case | Scenario | Required result | Severity |
|---|---|---|---|
| QAD-TC70.1 | Perfect paper corners with handheld declaration | Block metric opening estimate | P0 |
| QAD-TC70.2 | Manually map handheld paper corners | Mismatch persists; no promotion | P0 |
| QAD-TC70.3 | Known format, reviewed correspondence, valid geometry, same-plane declaration | Estimate eligible only for explicitly assigned opening plane | P0 |
| QAD-TC70.4 | Person near wall-mounted sheet | Advisory evidence alone does not establish or reject placement | P1 |
| QAD-TC70.5 | Secondary product on another wall | No automatic reference inheritance; approximate fit remains available | P0 |
| QAD-TC70.6 | Manual tape recovery | Require both positive dimensions and acknowledgement; retain manual provenance | P0 |
| QAD-TC70.7 | Unsure placement or skip | Approximate preview without calibrated labels; preserve recovery declaration | P0 |

Additional automated cases cover unknown/malformed placement, curled and hidden boundaries, stale image identity, changed dimensions, and legacy session/comparison restoration. Manual browser/device transitions and real-photo mismatch validation remain MS57 release work.

## QAD-TC71: Measurement Revision, Model Parity, and Quotation Provenance (IMP-MS56)

Traceability: PRD-F5, PRD-F6, PRD-F10, PRD-F11; SDD-C4, SDD-C5, SDD-C7; ERD-E11, ERD-E13, ERD-E14. All cases are P0.

| Case | Scenario | Expected outcome |
|---|---|---|
| QAD-TC71.1 | Accept an eligible fitted opening | Evaluator, controls, mesh inputs, confirmation, and quotation share unrounded dimensions; existing edge display rounding is at most 0.5 mm |
| QAD-TC71.2 | Recalibrate multiple draft products | Matching photo planes update together; finishes, manual dimensions, and independently recorded unrelated planes persist |
| QAD-TC71.3 | Invalid geometry, stale revision, or reassigned plane | Remove photo acceptance; server rejects mismatched provenance in a new draft |
| QAD-TC71.4 | Add/change/edit product and hydrate session | Preserve image/reference contract and edited overlay identity; new product defaults do not inherit a measured opening |
| QAD-TC71.5 | Legacy, corrupted, or quota-truncated evidence | Revalidate or downgrade to approximate; existing quotation sources remain readable |
| QAD-TC71.6 | Fractional dimensions cross a structural threshold | Structural rules and quotation pricing consume the actual unrounded millimeter dimensions |
| QAD-TC71.7 | Recalibrate after quotation submission | Historical accepted dimensions, prices, and negotiated amounts remain unchanged |

Automated command: `npm run test:ms56`. Behavioral coverage is in `tests/unit/measurementProvenance.test.ts`; existing geometry, measurement confirmation, session, quotation document, PDF, and booking reflection regression suites also apply. Real-photo accuracy, browser interaction, and production acceptance remain pending MS57.

## QAD-TC72: Physical Measurement Benchmark and Release Evidence (IMP-MS57)

| Test ID | Acceptance boundary | Current evidence |
|---|---|---|
| QAD-TC72.1 | Supplied images have documented detection/recovery outcomes | Original private samples unavailable; skipped, physical metrics unscored |
| QAD-TC72.2 | Frontal/oblique accepted estimates pass both tape-measured axes | Error/statistics evaluator tested synthetically; physical tape records pending |
| QAD-TC72.3 | Held/unknown/adjacent-plane paper cannot promote a metric estimate | Automated production-eligibility coverage; real-photo/browser validation pending |
| QAD-TC72.4 | Dataset, precision, coverage, per-axis accuracy and safety pass together | Offline gates implemented; complete development and held-out sets pending |
| QAD-TC72.5 | Mobile/desktop/zoom/refresh/multiple-product mesh and quotation parity | Existing MS54-MS56 regressions apply; manual device and physical comparison pending |
| QAD-TC72.6 | Missing photos/tape remain skipped/unscored | Automated empty/missing evidence, uncertainty, split leakage and independent-axis tests |
| QAD-TC72.7 | Lint/types/build/service/regression evidence exists | Run commands below and reconcile blockers before release |

Commands: `npm run test:ms57`; `python -m unittest discover -s fastapi-service/tests -p test_ms57_probe.py`; private evaluation via `npm run benchmark:ms57 -- <mode> <manifest> <new-output> [evidence]`. See [operator instructions](../scripts/ms57/README.md) for all required fields, privacy handling, exit codes, development freezing and the single-use holdout cycle. Linear interpolation defines p50/p95. Matching uses independent per-capture localization uncertainty and allows cyclic/winding differences; this tolerance cannot override production geometry thresholds.

Release gates require at least 60 distinct photos, 10 openings, 3 devices, 15 unsafe captures, all paper standards, 20 held-out captures, and 5 held-out cases per principal stratum. Report overlapping strata separately. Missing eligible captures stay in coverage denominators; tape-free accepted measurements stay unscored. Automatic precision >=95%, localization coverage >=80%, metric coverage >=70%, every accepted axis <=5% relative error, median axis <=2%, and zero unsafe/no-paper metric promotions must pass together. External baseline, collection review, browser/model/quotation/PDF and service acceptance cannot be certified by the offline report.

## QAD-TC73: Click-Guided Interactive Paper Localization (IMP-MS58)

Traces to IMP-MS58, PRD-F3, PRD-F4, SDD-C2, SDD-C3, DSD-UI3, BRD-M1, BRD-M5, BRD-M6. Automated test commands: `pytest tests/test_paper_calibration.py` in `fastapi-service/` and `npm run test:ms58`.

| Test ID | Scenario | Preconditions | Execution Steps | Expected Outcome | Severity |
|---|---|---|---|---|---|
| QAD-TC73.1 | Seed point clicks inside paper in low-contrast image | Low-contrast room photo where full-auto detection abstained | 1. Open modal<br>2. Tap inside paper sheet<br>3. Inspect snapped pins | System extracts paper boundary containing seed point; 4 corner pins snap to sheet perimeter within 400ms | P0 |
| QAD-TC73.2 | Seed point clicks on background distractor | Image with bright window frame and dark paper | 1. Tap on window frame<br>2. Verify system response | System does not snap paper corners to the window frame; reports abstention or keeps existing reference | P0 |
| QAD-TC73.3 | Seed point inside candidate from Tier 1 proposal | Image has multiple candidate proposals | 1. Tap inside candidate B<br>2. Verify selected candidate | Candidate B is instantly selected without re-running full segmentation; latency < 100ms | P0 |
| QAD-TC73.4 | Snapped pins micro-adjustment | Click-guided snap placed pins with 2px offset | 1. Drag pin 2 with loupe<br>2. Confirm reference | Pin 2 updates smoothly; modified state transitions to candidate_selected_with_manual_refinement | P1 |
| QAD-TC73.5 | Boundary clamping and non-finite coordinate safety | Malformed client request | 1. Send seed_x = -0.5 or NaN<br>2. Inspect API response | Service safely clamps or returns 422 Unprocessable Entity without crashing | P0 |
| QAD-TC73.6 | Coordinate space parity across display zooms | Image displayed with letterboxing or mobile viewport zoom | 1. Click paper while zoomed<br>2. Inspect mapped workspace pixels | Display coordinate transforms accurately to canonical workspace image pixel; no letterbox offset drift | P0 |

## QAD-TC74: Sub-Pixel Edge Snapping, Magnetic Loupe Alignment, and Corner Refinement (IMP-MS59)

Traces to IMP-MS59, PRD-F4, PRD-F5, PRD-F6, SDD-C3, SDD-C5, DSD-UI3, DSD-UI4, BRD-M5, BRD-M6. Automated test commands: `pytest` in `fastapi-service/` and `npm run test:ms59`.

| Test ID | Scenario | Preconditions | Execution Steps | Expected Outcome | Severity |
|---|---|---|---|---|---|
| QAD-TC74.1 | Synthetic rounded corner paper image | Synthetic test image with 20px rounded corners on paper | 1. Run line intersection algorithm<br>2. Compare intersection vertices with ground truth polygon | Line intersection locates true sharp corners with < 1.0px error, ignoring corner fillet curvature | P0 |
| QAD-TC74.2 | Shadow gradient obscuring one corner | Paper corner in deep shadow with blurred boundary | 1. Trigger edge line fitting<br>2. Inspect computed intersection | Adjacent straight edges guide the intersection; corner is accurately located despite local shadow blur | P0 |
| QAD-TC74.3 | Mobile loupe magnetic edge snapping | User dragging corner pin on mobile screen | 1. Drag pin within 6px of paper edge<br>2. Observe loupe crosshair | Crosshair magnetically snaps to edge gradient peak; crosshair turns emerald; subtle haptic triggers | P1 |
| QAD-TC74.4 | Smooth magnetic snap release | User deliberately drags pin away from edge | 1. Drag pin 15px away from edge<br>2. Observe crosshair tracking | Snapping releases smoothly without jerky jumps or stuck coordinates; pin tracks finger freely | P1 |
| QAD-TC74.5 | Non-convex quad rejection | Severely distorted edge lines intersecting into bowtie polygon | 1. Process crossed line intersections<br>2. Verify validation check | System detects non-convex geometry, rejects refinement, and falls back to safe convex proposal | P0 |
| QAD-TC74.6 | Performance budget on mobile canvas | Snapping executed on low-power mobile device | 1. Drag pin continuously for 10 seconds<br>2. Measure frame rate | Canvas renders smoothly at >= 55 FPS; Sobel computation takes < 2ms per drag event | P1 |

## QAD-TC75: Perspective Unwarping Aspect Ratio Matcher, Standard Auto-Suggestion, and Model Sizing Parity (IMP-MS60)

Traces to IMP-MS60, PRD-F4, PRD-F5, PRD-F6, PRD-F10, SDD-C3, SDD-C4, SDD-C5, SDD-C7, DSD-UI4, DSD-UI7, BRD-M1, BRD-M5, BRD-M6.

| Test ID | Scenario | Preconditions | Execution Steps | Expected Outcome | Severity |
|---|---|---|---|---|---|
| QAD-TC75.1 | Angled capture with A4 paper | Capture taken at 30-degree yaw with physical A4 sheet | 1. Click paper to snap<br>2. Inspect recommended standard | System rectifies homography, computes unwarped ratio ~ 1.41, and auto-suggests A4 Standard with >= 95% confidence | P0 |
| QAD-TC75.2 | Landscape-placed Short Bond paper | Physical Short Bond sheet affixed horizontally | 1. Snap paper corners<br>2. Check orientation mapping | System detects landscape placement; assigns 279.4mm to horizontal axis and 215.9mm to vertical axis | P0 |
| QAD-TC75.3 | User swaps orientation manually | Ambiguous diagonal paper placement | 1. Click 'Swap Orientation'<br>2. Inspect dimension callout | Width and height callouts swap values cleanly; model mesh updates synchronously | P1 |
| QAD-TC75.4 | Real opening width and height accuracy | Opening measured with physical tape at 1500mm x 1200mm | 1. Snap paper fiducial<br>2. Fit opening corners<br>3. Inspect model dimensions | Model dimensions match tape measurement within +- 2.0% relative error (1470mm to 1530mm width) | P0 |
| QAD-TC75.5 | Standard change invalidation and update | User switches confirmed standard from Short to Long | 1. Change radio from Short to Long<br>2. Confirm | Model height updates proportionally by +18.2% (330.2 / 279.4); quotation recalculates atomically | P0 |
| QAD-TC75.6 | Quotation provenance persistence | Confirming quotation with click-guided planar measurement | 1. Proceed to quotation modal<br>2. Inspect saved snapshot | dimension_source is planar_paper_estimate; metadata records reference_source = "click_guided" and paper_standard | P0 |

## QAD-TC76: Empirical Real-World Accuracy Benchmark and Comparative Release Protocol (IMP-MS61)

Traces to IMP-MS61, PRD-F3, PRD-F4, PRD-F5, PRD-F6, PRD-F10, SDD-C2, SDD-C3, SDD-C4, SDD-C5, SDD-C7, BRD-M1, BRD-M5, BRD-M6. Automated test commands: `npm run test:ms61` and comparative benchmark runner via `npm run benchmark:ms61` or `python scripts/ms57/run_benchmark.py`.

| Test ID | Scenario | Preconditions | Execution Steps | Expected Outcome | Severity |
|---|---|---|---|---|---|
| QAD-TC76.1 | Full-Auto vs Click-Guided in Cluttered Room | Space photo with multiple rectangular wall fixtures | 1. Run MOD-AUTO<br>2. Run MOD-CLICK with seed inside paper | MOD-AUTO marks ambiguous or picks wrong panel; MOD-CLICK snaps sheet correctly with E_corner <= 2.0px | P0 |
| QAD-TC76.2 | Corner Localization RMSE Benchmark | 20 held-out development captures with annotated ground truth | 1. Run MOD-CLICK on all captures<br>2. Compute corner RMSE | Mean corner RMSE is <= 2.2 pixels at 1080p resolution | P0 |
| QAD-TC76.3 | Physical Opening Width and Height Error | 10 physical openings measured with steel tape | 1. Snap paper via click<br>2. Fit opening corners<br>3. Compute per-axis error | Median relative error across all openings is <= 1.8%; no axis exceeds 5.0% error | P0 |
| QAD-TC76.4 | Interaction Time Comparison | Simulated user study on 5 test participants | 1. Measure MTTC for manual 4-pin mapping<br>2. Measure MTTC for click-guided snap | Manual mapping averages 38 seconds; click-guided snap averages 4.5 seconds (88% time savings) | P1 |
| QAD-TC76.5 | Seed Point Jitter Invariance | Seed point tapped at center vs 30px off-center inside paper | 1. Dispatch seed at center<br>2. Dispatch seed near edge<br>3. Compare snapped corners | Snapped corners are mathematically identical (< 0.1px difference) due to edge line intersection | P0 |
| QAD-TC76.6 | Safe Abstention on Seed Click Outside Paper | User taps on empty blank wall or floor tile | 1. Dispatch seed on tile<br>2. Inspect outcome | Service returns not_found with reason code; zero false metric promotions | P0 |

## QAD-TC77: Contract-Preserving Paper Reference Confirmation UI Redesign (IMP-MS62)

Traces to IMP-MS62, PRD-F3, PRD-F4, PRD-F5, PRD-F6, SDD-C2, SDD-C3, SDD-C5, DSD-UI3, DSD-UI4, DSD-UI7, BRD-M1, BRD-M4, BRD-M5, BRD-M6. This case is additive to QAD-TC68 through QAD-TC76. It does not relax their format, edge-correspondence, plane-eligibility, geometry, or benchmark requirements.

| Test ID | Scenario | Preconditions | Execution Steps | Expected Outcome | Severity |
|---|---|---|---|---|---|
| QAD-TC77.1 | Checkbox-free explicit declarations | Valid detected quadrilateral, no prior paper reference declaration | 1. Open confirmation modal<br>2. Inspect controls<br>3. Select actual paper standard, physical edge correspondence, and Flat placement<br>4. Confirm | No checkbox or radio input renders. Confirm is disabled until all three explicit declarations and existing boundary and geometry guards are satisfied. Confirmed result retains `paperStandardConfirmed`, `samePlaneConfirmed`, `firstEdge`, and `orientationConfirmed`. | P0 |
| QAD-TC77.2 | Neutral candidate selector | Multiple valid, non-cropped candidates with distinct scores | 1. Open modal<br>2. Inspect candidate list and SVG<br>3. Hover, focus, and select an inactive candidate<br>4. Open overflow | Candidates are ordered by score descending then ID ascending. Labels say Boundary evidence, not Match or Confidence. Three candidates are initially visible plus any selected candidate. Inactive SVG outlines are white, 25% opacity, and 1.2px dashed, increasing to 55% on interaction. | P1 |
| QAD-TC77.3 | Suggested orientation remains unconfirmed | High-confidence recommended first edge | 1. Open modal<br>2. Observe recommendation<br>3. Attempt confirm<br>4. Explicitly select Short or Long correspondence<br>5. Confirm after remaining declarations | Recommendation is visible but does not set orientation confirmation. Explicit selector activation records the chosen edge and correct physical dimensions. | P0 |
| QAD-TC77.4 | Discrete snap pulse and reduced motion | Manual corner mapping with a transition from unsnapped to snapped | 1. Drag a corner near an edge<br>2. Observe free tracking and snap settlement<br>3. Repeat with reduced motion enabled | Free drag does not lag behind pointer input. One 200ms emerald snap pulse appears after acquisition only. Motion is suppressed under reduced-motion preference. | P1 |
| QAD-TC77.5 | Placement remains explicit despite good edge fit | Green, yellow, and muted edge-fit fixtures | 1. Open each fixture<br>2. Inspect placement state<br>3. Select Held, Unsure, and Corners obscured or paper curled paths | Green quality does not declare Flat placement. Yellow and muted quality expand guidance only. Non-flat, uncertain, obscured, or curled outcomes remain ineligible for metric promotion and expose Retake and Skip recovery. | P0 |
| QAD-TC77.6 | Mathematical and benchmark preservation | QAD-TC76 held-out fixture manifest and reviewed declarations | 1. Run existing MS53 through MS61 test commands<br>2. Run `npm run benchmark:ms61`<br>3. Compare geometry and eligibility outputs to the unchanged baseline | No calibration math, eligibility outcome, geometry, provenance, or QAD-TC76 release threshold changes. MS62 introduces no new physical-accuracy or MTTC claim. | P0 |

### Comparative Empirical Release Gates (IMP-MS61)

| Release Gate Metric | Full-Automatic Target | Click-Guided Target (MS58-MS60) | Manual Pinning Target | Pass Criteria / Rationale |
|---|---|---|---|---|
| Localization Coverage (C_loc) | >= 75.0% | >= 92.0% | 100.0% (user forced) | Click guidance must eliminate distractor abstentions in cluttered scenes. |
| Corner Localization RMSE (E_corner) | <= 4.5 px | <= 2.2 px | <= 3.5 px (touch drift) | Sub-pixel edge intersection (MS59) must outperform human finger touch precision. |
| Median Relative Error (E_rel, med) | <= 2.5% | <= 1.8% | <= 2.2% | Click-guided mode must achieve typical aperture sizing accuracy under 2.0%. |
| 95th Percentile Relative Error (E_rel, p95) | <= 5.5% | <= 3.8% | <= 4.5% | Ensures extreme outlier errors remain bounded below 4.0%. |
| Maximum Relative Error (E_rel, max) | <= 7.0% | <= 5.0% | <= 6.0% | No accepted planar measurement deviates by more than 5.0% on width or height. |
| Mean Time to Confirmation (MTTC) | < 3.0 s | < 6.0 s | > 35.0 s | 1 tap delivers full manual accuracy with an 80%+ reduction in interaction time. |
| Coplanar Safety (MS55 Invariant) | 0 false promotions | 0 false promotions | 0 false promotions | Non-coplanar or handheld paper must never be promoted to trusted metric status. |

