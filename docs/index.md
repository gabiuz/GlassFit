# Documentation Index & Traceability Hub (INDEX)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** October 21, 2026 (Implemented IMP-MS63 resilient HEIC ingestion, downscaled paper detection, and /snap-paper; QAD-TC78 verification)

---

## 1. Executive System Overview

**System description:**
GlassFit is a responsive, web-based photo-simulation and consultation-support platform tailored for customized glass and aluminum architectural fixtures (such as sliding windows, awning windows, glass doors, interior partitions, shower enclosures, and modular cabinets). Developed for small and medium-sized enterprises (SMEs) in the Philippines, the system eliminates the persistent customer "visualization gap" through an accessible, asynchronous photo-based simulation workflow. Users upload a smartphone photo of their room opening, interactively place and configure parametric 3D models with environmental realism (ambient lighting matching, contact shadows, glass view modes, and YOLOv8 foreground occlusion), confirm real-world dimensions for approximate budgetary estimates, and seamlessly transition the visual consultation reference to business staff via Facebook Messenger and Viber deep-links.

**Primary repository:** `https://github.com/gabiuz/GlassFit`

**Operational criticality:** Tier 1 (Production Critical - Commercial Client Intake and Capstone Deployment)

---

## 2. Master Document Registry

| Code | Specification Title | File Path | Status | Last Reconciled | Primary DRI |
|---|---|---|---|---|---|
| BRD | Business Requirements Document | `docs/brd-glassfit.md` | Locked | September 9, 2026 | Reynard John B. Rabanal |
| PRD | Product Requirements Document | `docs/prd-glassfit.md` | Locked | September 9, 2026 | Reynard John B. Rabanal |
| SDD | System Design Document | `docs/sdd-glassfit.md` | Locked | September 9, 2026 | Reynard John B. Rabanal |
| DSD | Design Specification Document | `docs/dsd-glassfit.md` | Locked | September 9, 2026 | Gianne Crizzle A. Dasco |
| ERD | Entity Relationship Document | `docs/erd-glassfit.md` | Locked | September 9, 2026 | Gabriel Nicolai D. Pelagio |
| QAD | Quality Assurance Document | `docs/qad-glassfit.md` | Locked | September 19, 2026 | Jedia Nicole I. Sagun |
| BUILD| Build & Deployment Runbook | `docs/build-glassfit.md` | Locked | September 9, 2026 | Reynard John B. Rabanal |
| PRICE| Parametric Fenestration Pricing Engine | `docs/pricing.md` | Active | September 9, 2026 | Reynard John B. Rabanal |
| MILE | Master Implementation Milestones | `docs/milestone.md` | Active | September 9, 2026 | Reynard John B. Rabanal |
| IMP-MS30 | Inclusive Names and Admin Email Change | `docs/implementation/ms30.md` | Implemented | September 30, 2026 | GlassFit Capstone Team |
| IMP-MS31 | Admin Booking Discard-to-Hard-Delete and Quotation Purge | `docs/implementation/ms31.md` | Implemented | September 30, 2026 | GlassFit Capstone Team |
| IMP-MS32 | Admin Data Management, Business Intelligence Exports, Native Analytics, and System Backup | `docs/implementation/ms32.md` | Implemented | September 30, 2026 | GlassFit Capstone Team |
| IMP-MS33 | Unified Cross-Browser GlassFit Brand Theme Scrollbar System | `docs/implementation/ms33.md` | Implemented | September 30, 2026 | GlassFit Capstone Team |
| IMP-MS35 | Multi-Format Space Image Ingestion for WebP and HEIC/HEIF | `docs/implementation/ms35.md` | Ready for Implementation | September 30, 2026 | GlassFit Capstone Team |
| IMP-MS36 | Admin Product Type and Status Filters | `docs/implementation/ms36.md` | Ready for Implementation | September 30, 2026 | GlassFit Capstone Team |
| IMP-MS37 | Mobile Visualization Workspace Viewport, Scroll Isolation, and Touch Ergonomics | `docs/implementation/ms37.md` | Ready for Implementation | October 1, 2026 | GlassFit Capstone Team |
| IMP-MS38 | Quotation Preview and Browser-Saved PDF Reliability | `docs/implementation/ms38.md` | Ready for Implementation | October 1, 2026 | GlassFit Capstone Team |
| IMP-MS39 | Discrete Yaw and Pitch Degree Stepper Controls | `docs/implementation/ms39.md` | Implemented | October 1, 2026 | GlassFit Capstone Team |
| IMP-MS40 | Reset Yaw and Pitch to Zero After Perspective Fit Placement | `docs/implementation/ms40.md` | Ready for Implementation | October 1, 2026 | GlassFit Capstone Team |
| IMP-MS42 | Context-Aware Obstruction Soft-Warning Tooltips | `docs/implementation/ms42.md` | Implemented | October 1, 2026 | GlassFit Capstone Team |
| IMP-MS43 | Unconstrained Dimension Parameters and Incremental Step-Loop Structural Rules | `docs/implementation/ms43.md` | Implemented | October 1, 2026 | GlassFit Capstone Team |
| IMP-MS44 | Seamless Cross-Product Switching in the Visualization Workspace | `docs/implementation/ms44.md` | Implemented, pending manual QA | October 2, 2026 | GlassFit Capstone Team |
| IMP-MS47 | Interactive Fiducial Pin Fallback and Precision Dimension Grounding | `docs/implementation/ms47.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS48 | Autonomous Multi-Standard Paper Fiducial Detection and Resilient Scale Engine | `docs/implementation/ms48.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS49 | Session-Permanent Calibration State and Fallback Pinning Lifecycle | `docs/implementation/ms49.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS53 | Reliable Automatic Paper Detection and Reference Selection | `docs/implementation/ms53.md` | Implemented, pending MS57 real-photo validation | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS54 | Perspective-Correct Metric Measurement and Coordinate Integrity | `docs/implementation/ms54.md` | Implemented, pending MS57 real-photo validation | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS50 | Grounded Real-World 3D Model Sizing and Quotation Parity | `docs/implementation/ms50.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS56 | Consistent Model Dimensions, Calibration Revisions, and Quotation Provenance | `docs/implementation/ms56.md` | Implemented, pending MS57 physical and browser validation | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS57 | Real-World Measurement Benchmark and Release Gates | `docs/implementation/ms57.md` | Tooling implemented; physical evidence and release acceptance pending | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS58 | Click-Guided Interactive Paper Localization and Seed-Constrained Selection | `docs/implementation/ms58.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS59 | Sub-Pixel Edge Snapping, Magnetic Loupe Alignment, and Corner Refinement | `docs/implementation/ms59.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS60 | Perspective Unwarping Aspect Ratio Matcher, Standard Auto-Suggestion, and Model Sizing Parity | `docs/implementation/ms60.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS61 | Empirical Real-World Accuracy Benchmark and Comparative Release Protocol | `docs/implementation/ms61.md` | Implemented | October 19, 2026 | GlassFit Capstone Team |
| IMP-MS62 | Separate Automatic Detection from Paper Reference Calibration | `docs/implementation/ms62.md` | Implemented; browser acceptance pending | October 21, 2026 | GlassFit Capstone Team |
| IMP-MS63 | Resilient HEIC Space Image Ingestion, Network-Tolerant Conversion, and Low-Latency Paper Detection Pipeline | `docs/implementation/ms63.md` | Implemented | October 21, 2026 | GlassFit Capstone Team |

---

## 3. End-to-End Traceability Matrix

| Business Metric (`BRD-M#`) | Product Feature (`PRD-F#`) | System Component (`SDD-C#`) | Data Entity (`ERD-E#`) | Test Case (`QAD-TC#`) | Status |
|---|---|---|---|---|---|
| BRD-M1, BRD-M5 | PRD-F3, PRD-F4, PRD-F5, PRD-F6, PRD-F10 | SDD-C2, SDD-C3, SDD-C4, SDD-C5 | No schema change; existing session state and immutable quotation snapshots retained | QAD-TC77.1 through QAD-TC77.12 | IMP-MS62 implemented; browser acceptance pending |
| BRD-M1, BRD-M4, BRD-M6 (Mobile Intake Resilience & Latency) | PRD-F3, PRD-F4, PRD-F10 | SDD-C2, SDD-C3 | N/A (Client Blob Buffering & Temporary Session Files) | QAD-TC78.1 through QAD-TC78.8 | Implemented |
| BRD-M1 (Compress Intake Duration) | PRD-F13 (Signed Booking Link & Messaging Handoff) | SDD-C8 (Signed Booking Link & Messaging Handoff) | ERD-E15 (signed_booking_links), ERD-E16 (booking_requests) | QAD-TC13 | Verified |
| BRD-M2 (Reduce Design Revisions) | PRD-F5 (Parametric 3D Assembly), PRD-F6 (Visualization Workspace) | SDD-C4 (Parametric 3D Assembly Engine), SDD-C5 (Visualization Canvas) | ERD-E4 (product_templates), ERD-E5 (product_parameters), ERD-E6 (product_components), ERD-E7 (structural_rules) | QAD-TC5, QAD-TC6, QAD-TC16, QAD-TC17 | Verified |
| BRD-M3 (Elevate Conversion to Ocular) | PRD-F9 (Compositing & Snapshot), PRD-F13 (Signed Booking Link) | SDD-C6 (Canvas Compositor), SDD-C8 (Signed Booking Link) | ERD-E10 (visualization_snapshots), ERD-E15 (signed_booking_links) | QAD-TC9, QAD-TC13 | Verified |
| BRD-M4 (Achieve High Usability) | PRD-F1 (Public Catalog), PRD-F2 (3D Inspector), PRD-F7 (Environmental Realism) | SDD-C1 (Public Catalog), SDD-C5 (Visualization Canvas) | ERD-E3 (products), ERD-E8 (product_assets), ERD-E9 (product_variations) | QAD-TC1, QAD-TC2, QAD-TC7 | Verified |
| BRD-M5 (Minimize Estimator Overhead) | PRD-F10 (Quotation Measurement Modal), PRD-F11 (Consultation PDF), PRD-F14 (Admin Catalog), PRD-F19 (Batch Pricing) | SDD-C7 (Quotation Engine & PDF Generator), SDD-C9 (Admin Portal) | ERD-E11 (product_configurations), ERD-E13 (quotation_estimates), ERD-E14 (quotation_items), ERD-E15 (signed_booking_links), ERD-E16 (booking_requests), ERD-E17 (raw_materials) | QAD-TC10, QAD-TC11, QAD-TC15, QAD-TC18, QAD-TC19, QAD-TC29 | Verified |
| BRD-M6 (Suppress On-Site Scrappage) | PRD-F3 (Space Image Upload), PRD-F4 (CV Image Analysis), PRD-F8 (Foreground Occlusion), PRD-F5 (Structural Guardrails) | SDD-C2 (Image Pre-Flight), SDD-C3 (CV Scene Analyzer), SDD-C4 (Parametric Builder), SDD-C5 (Visualization Canvas) | ERD-E6 (product_components), ERD-E7 (structural_rules), ERD-E10 (visualization_snapshots), ERD-E11 (product_configurations) | QAD-TC3, QAD-TC4, QAD-TC8, QAD-TC17 | Verified |
| BRD-M4 (Achieve High Usability) | PRD-F12 (Auth and Identity), PRD-F14 (Admin Portal) | SDD-C8, SDD-C9 | ERD-E2, ERD-E20 | QAD-TC12, QAD-TC14, QAD-TC45 | Implemented |
| BRD-M5 (Minimize Estimator Overhead) | PRD-F13, PRD-F14 (Booking & Admin Workbench) | SDD-C8, SDD-C9 (Signed Link & Admin Portal) | ERD-E13, ERD-E14, ERD-E15, ERD-E16 | QAD-TC46 | Implemented |
| BRD-M5 (Minimize Estimator Overhead) | PRD-F14 (Admin Data Management) | SDD-C9, SDD-C10 (Admin Workbench & Access Control) | ERD-E3, ERD-E13, ERD-E16, ERD-E18 | QAD-TC47 | Implemented |
| BRD-M4 (Achieve High Usability) | PRD-F1, PRD-F6, PRD-F14 (Brand UI Consistency & Themed Viewports) | SDD-C1, SDD-C5, SDD-C9 | N/A (Presentation Layer) | QAD-TC48 | Implemented |
| BRD-M4, BRD-M6 (Usability and Space Intake Reliability) | PRD-F3, PRD-F4, PRD-F7 | SDD-C2, SDD-C3 | N/A (Temporary Files) | QAD-TC3, QAD-TC4, QAD-TC50 | Ready for Implementation |
| BRD-M4 (Achieve High Usability) | PRD-F14 (Admin Product Catalog) | SDD-C9 (Admin Portal) | ERD-E3 (products) | QAD-TC51 | Ready for Implementation |
| BRD-M4 (Achieve High Usability) | PRD-F6 (Photo-Based Visualization Workspace) | SDD-C5 (Visualization Canvas) | N/A (Transient Presentation State) | QAD-TC52 | Ready for Implementation |
| BRD-M3, BRD-M5 (Quotation Reliability & PDF Integrity) | PRD-F10, PRD-F11 (Quotation Preview & Consultation PDF) | SDD-C7 (Quotation Engine & PDF Generator) | ERD-E13 (quotation_estimates), ERD-E14 (quotation_items) | QAD-TC53 | Ready for Implementation |
| BRD-M4 (Achieve High Usability) | PRD-F6 (Photo-Based Visualization Workspace) | SDD-C5 (Visualization Canvas) | N/A (Transient Presentation State) | QAD-TC54 | Implemented |
| BRD-M4 (Achieve High Usability) | PRD-F6 (Photo-Based Visualization Workspace) | SDD-C5 (Visualization Canvas) | N/A (Transient Presentation State) | QAD-TC55 | Ready for Implementation |
| BRD-M2, BRD-M4 (Parametric Scalability & Catalog Flexibility) | PRD-F5, PRD-F14 | SDD-C4, SDD-C9 | ERD-E4, ERD-E5, ERD-E6, ERD-E7 | QAD-TC58 | Implemented |
| BRD-M2, BRD-M4 (Cross-Product Workspace Continuity) | PRD-F6 | SDD-C4, SDD-C5, SDD-C6 | ERD-E4, ERD-E5, ERD-E6, ERD-E7 | QAD-TC59 | Implemented, pending manual QA |
| BRD-M1, BRD-M5, BRD-M6 (Precision Scale & Quotation Grounding) | PRD-F3, PRD-F4, PRD-F6, PRD-F10 | SDD-C2, SDD-C3, SDD-C5, SDD-C7 | ERD-E10, ERD-E14 | QAD-TC60, QAD-TC61, QAD-TC62, QAD-TC63, QAD-TC64 | Implemented |

---

MS53 traceability: BRD-M1, BRD-M5, BRD-M6 -> PRD-F3, PRD-F4 -> SDD-C2, SDD-C3 -> DSD-UI3 -> QAD-TC68. Localization, actual paper format, and placement evidence are separate contracts. Real-photo release validation remains pending in MS57.

MS57 traceability: BRD-M1, BRD-M5, BRD-M6 -> PRD-F3, PRD-F4, PRD-F5, PRD-F6, PRD-F10 -> SDD-C3, SDD-C4, SDD-C5, SDD-C7 -> QAD-TC72. Offline benchmark tooling exists; missing physical captures and manual browser evidence block release acceptance. No additional database entity or UI surface is introduced.

## 4. Subsystem Governance & DRI Registry

| Subsystem Domain | Primary DRI | Secondary Maintainer | Communication Channel |
|---|---|---|---|
| Architecture & Systems Engineering | Reynard John B. Rabanal | Gabriel Nicolai D. Pelagio | `#eng-architecture` |
| AI Inference & Computer Vision | Reynard John B. Rabanal | Gabriel Nicolai D. Pelagio | `#eng-ai-orchestration` |
| Database & Cloud Infrastructure | Gabriel Nicolai D. Pelagio | Reynard John B. Rabanal | `#eng-infra-data` |
| Frontend, UI/UX & Accessibility | Gianne Crizzle A. Dasco | Jedia Nicole I. Sagun | `#eng-frontend` |
| Quality Assurance & Evaluation | Jedia Nicole I. Sagun | Gianne Crizzle A. Dasco | `#eng-qa-testing` |
| Academic Compliance & Research | Capstone Team (PUP CCIS) | Research Review Panel | `#academic-capstone` |

---

## 5. Specification Reconciliation Log

| Revision Date | Target Document | Author | Nature of Revision | Pull Request Ref |
|---|---|---|---|---|
| October 26, 2026 | `docs/implementation/ms76.md`, `src/features/visualization/`, `src/lib/visualization/`, `src/lib/pricing/` | GlassFit Capstone Team | Implemented Customer Visualization Workspace Dynamic Accessory Swapping, Positional Matrix Alignment, Real-Time BOM Recalculation, and Itemized Quotation/PDF Handoff (QAD-TC91) | Pending |
| October 26, 2026 | `docs/implementation/ms75.md`, `src/features/admin/products/setup/` | GlassFit Capstone Team | Implemented Admin Part Inspector Swappable Accessory Binding and Position Configuration (QAD-TC90) | Pending |
| October 26, 2026 | `docs/implementation/ms74.md`, `src/features/admin/products/` | GlassFit Capstone Team | Implemented Admin Accessory Product Role and 5-Step Authoring Workflow (QAD-TC89) | Pending |
| October 26, 2026 | `docs/implementation/ms73.md`, `src/features/visualization/`, `src/lib/pricing/` | GlassFit Capstone Team | Implemented Customer Visualization Workspace Dynamic Grille Sizing, Real-Time Linear BOM Recalculation, and Itemized Quotation/PDF Handoff (QAD-TC88) | Pending |
| October 26, 2026 | `docs/implementation/ms72.md`, `src/features/admin/products/setup/`, `supabase/migrations/` | GlassFit Capstone Team | Implemented Admin Product Setup Wizard Center-Grille Part Inspector, GRILLE_LINEAR dimension binding, single-click material assignment, and Validation Workspace dynamic cut list preview (QAD-TC87) | Pending |
| October 26, 2026 | `docs/implementation/ms71.md`, `src/lib/pricing/` | GlassFit Capstone Team | Implemented Parametric Grille Linear-Meter Pricing Engine, Automated 3D Sub-Bar Geometry Analyzer, and Pattern Repetition Metric Engine (QAD-TC86) | Pending |
| October 21, 2026 | `docs/implementation/ms63.md`, `src/lib/imageApi.ts`, `fastapi-service/main.py`, `src/features/visualization/` | GlassFit Capstone Team | Implemented resilient HEIC space image ingestion, exponential backoff retry, early WebP downscaled paper detection, session-bound /snap-paper endpoint, local blob buffering, and registered QAD-TC78 | Pending |
| October 21, 2026 | MS62 implementation and tests | GlassFit Capstone Team | Implemented mode isolation, legacy restoration, and paper skip recovery; automated evidence in MS62 section 9, browser acceptance pending | Pending |
| October 21, 2026 | `docs/implementation/ms62.md`, PRD, SDD, DSD, QAD, milestones, and index | GlassFit Capstone Team | Specified paper-free Automatic Detection, exclusive paper-mode localization/review, request-authoritative mapping, legacy session policy, and QAD-TC77; documentation only | Pending |
| September 9, 2026 | `docs/brd-glassfit.md` | Reynard John B. Rabanal | Initial production baseline reconciling PUP CCIS Chapters 1-3 manuscript, SME fabricator economic data, and business metrics | PR #1 |
| September 9, 2026 | `docs/prd-glassfit.md` | Reynard John B. Rabanal | Comprehensive PRD baseline aligning 20 product features with active Next.js and FastAPI implementations | PR #2 |
| September 9, 2026 | `docs/sdd-glassfit.md` | Reynard John B. Rabanal | Authoritative architectural blueprint documenting Next.js 16, FastAPI CV service, Supabase, and R2 pipeline contracts | PR #3 |
| September 9, 2026 | `docs/dsd-glassfit.md` | Gianne Crizzle A. Dasco | Design specification detailing Tailwind CSS 4 tokens, typography, responsive breakpoints, and 10 core UI components | PR #4 |
| September 9, 2026 | `docs/erd-glassfit.md` | Gabriel Nicolai D. Pelagio | Entity relationship document reconciling all 16 Supabase relational tables, constraints, foreign keys, and indexes | PR #5 |
| September 9, 2026 | `docs/qad-glassfit.md` | Jedia Nicole I. Sagun | Quality assurance document detailing test distributions, the traceable test catalog, and release blocker governance | PR #6 |
| September 9, 2026 | `docs/build-glassfit.md`| Reynard John B. Rabanal | Operational runbook specifying toolchains, 12 environment variables, local bootstrap steps, and rollback protocols | PR #7 |
| September 9, 2026 | `docs/index.md` | Reynard John B. Rabanal | Initial master index registry and end-to-end traceability matrix reconciliation | PR #8 |
| September 9, 2026 | `docs/milestone.md` | Reynard John B. Rabanal | Master implementation roadmap integrating parametric BOM pricing, structural guardrails, and part inspector | PR #9 |
| September 9, 2026 | `docs/milestone.md` | Reynard John B. Rabanal | Specification of Milestone 10 for admin product setup wizard state persistence and smooth component lifecycle | PR #10 |
| September 19, 2026 | `docs/qad-glassfit.md` | Jedia Nicole I. Sagun | Added QAD-TC27 for alpha-aware Product Variant comparison model selection | Pending |
| September 24, 2026 | `docs/qad-glassfit.md`, `docs/index.md` | GlassFit Capstone Team | Added QAD-TC29 and IMP-MS15 traceability for admin booking reflection, relational query integrity, and route freshness | Pending |
| September 25, 2026 | `docs/erd-glassfit.md`, `docs/build-glassfit.md`, `docs/qad-glassfit.md`, `docs/index.md` | GlassFit Capstone Team | Added IMP-MS16 canonical quotation snapshots, negotiated-price auditability, deployment order, and QAD-TC30 | Pending |
| September 26, 2026 | `docs/implementation/ms17.md` and upstream PRD, SDD, DSD, ERD, QAD, milestone, build, and index specifications | GlassFit Capstone Team | Reconciled simplified customer price disclosure, canonical per-item negotiation, DSD-UI11, ERD-E13 JSON overrides, migration 007, and QAD-TC31 | Pending |
| September 29, 2026 | `docs/implementation/ms25.md`, `docs/qad-glassfit.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled single-product quotation negotiation parity, offset-tolerant ISO datetime validation, optimistic concurrency normalization, and QAD-TC41 | Pending |
| September 30, 2026 | `docs/implementation/ms31.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled admin booking Discard hard deletion, cascading foreign keys, R2 asset purge, and QAD-TC46 | Pending |
| September 30, 2026 | `docs/implementation/ms32.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled admin data management CSV exports, executive KPI summaries, native SVG/Tailwind analytics charts, system backup engine, migration 014, and QAD-TC47 | Pending |
| September 30, 2026 | `docs/implementation/ms33.md`, `src/app/globals.css`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled unified cross-browser GlassFit brand theme scrollbar system, W3C standard properties, WebKit pseudo-elements, DSD-UI13 tokens, and QAD-TC48 | Pending |
| September 30, 2026 | `docs/implementation/ms35.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled static WebP and HEIC/HEIF upload requirements, browser-safe previews, server decoding and normalization, dependency readiness, and QAD-TC50 | Pending |
| September 30, 2026 | `docs/implementation/ms36.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled admin product type and lifecycle status filter requirements, ERD-E3 field mapping, DSD-UI14 behavior, and QAD-TC51 | Pending |
| October 1, 2026 | `docs/implementation/ms37.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled compact mobile visualization workspace layout, nested-safe scroll isolation, advisory orientation guidance, DSD-UI15 touch ergonomics, and QAD-TC52 | Pending |
| October 1, 2026 | `docs/implementation/ms38.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Reconciled quotation preview and browser-saved PDF reliability, DSD-UI16, and QAD-TC53 | Pending |
| October 1, 2026 | `docs/implementation/ms39.md`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Registered discrete yaw and pitch stepper controls, reconciled 44px minimum touch targets and narrow-width stacking with DSD-UI15/IMP-MS37, and extended QAD-TC54 verification | Pending |
| October 1, 2026 | `docs/implementation/ms40.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Added the PRD-F6 neutral orientation requirement for perspective-fit confirmation, SDD-C5 state behavior, QAD-TC55, and sequential MS39/MS40 traceability | Pending |
| October 1, 2026 | `docs/implementation/ms43.md`, `docs/index.md`, `src/lib/visualization/structuralResolver.ts`, `src/features/admin/products/setup/ParametersAndRulesSection.tsx`, `src/features/admin/products/setup/ValidationWorkspaceSection.tsx` | GlassFit Capstone Team | Implemented unconstrained width/height dimension parameters, incremental step-loop structural rules ("FOR EVERY ... ADD ..."), and QAD-TC58 verification | Pending |
| October 2, 2026 | `docs/implementation/ms44.md`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Implemented staged cross-product workspace switching and registered QAD-TC59; browser acceptance remains pending | Pending |
| October 19, 2026 | `docs/implementation/ms47.md`, `docs/qad-glassfit.md`, `docs/index.md`, `package.json` | GlassFit Capstone Team | Implemented interactive fiducial pin fallback modal, direct coplanar scale dimension grounding, workspace HUD calibrated badge, and QAD-TC62 verification | Pending |
| October 19, 2026 | `docs/implementation/ms48.md`, `fastapi-service/paper_calibration.py`, `fastapi-service/main.py`, `docs/qad-glassfit.md`, `docs/index.md` | GlassFit Capstone Team | Implemented autonomous multi-standard paper fiducial detection, adaptive multi-scale edge closing, orientation normalization, and QAD-TC63 verification | Pending |
| October 19, 2026 | `docs/implementation/ms49.md`, `src/lib/visualization/visualizationSession.tsx`, `src/features/visualization/components/ProductModelWorkspace.tsx`, `docs/qad-glassfit.md`, `docs/index.md` | GlassFit Capstone Team | Implemented session-permanent calibration state persistence, cross-product transition preservation, non-intrusive fallback lifecycle, and QAD-TC64 verification | Pending |
| October 19, 2026 | `docs/implementation/ms50.md`, `src/lib/visualization/scaleEstimation.ts`, `src/features/visualization/components/MeasurementConfirmationModal.tsx`, `src/features/visualization/components/ProductModelWorkspace.tsx`, `src/lib/pricing/quotationDocument.ts`, `src/lib/booking/bookingActions.ts`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Implemented direct coplanar scale dimension grounding, scale-aware initial sizing for added products, perspective quadrilateral fit synchronization, quotation trust badge choice cards, verified physical measurement persistence, and QAD-TC65 verification | Pending |
| October 19, 2026 | `docs/implementation/ms51.md`, `src/features/visualization/components/PaperDetectionConfirmationModal.tsx`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Implemented pre-workspace fiducial paper detection confirmation gateway, interactive 2.5x loupe refinement, convexity validation, non-blocking heuristic fallback, and QAD-TC66 verification | Pending |
| October 19, 2026 | `docs/implementation/ms52.md`, `src/lib/visualization/scaleEstimation.ts`, `src/features/visualization/components/ProductModelWorkspace.tsx`, `src/features/visualization/components/PerspectivePlanePicker.tsx`, `src/features/visualization/components/MeasurementConfirmationModal.tsx`, `src/lib/visualization/visualizationSession.tsx`, `tests/unit/groundedModelDimensionAccuracy.test.ts`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Implemented grounded model dimensioning accuracy, real-time bounding box badges, perspective plane millimeter edge readouts, in-workspace marker re-adjustment hot-rescaling, quotation audit parity, and QAD-TC67 verification | Pending |
| October 19, 2026 | `docs/implementation/ms58.md`, `fastapi-service/paper_calibration.py`, `fastapi-service/main.py`, `src/lib/imageApi.ts`, `src/lib/visualization/paperReference.ts`, `src/features/visualization/components/PaperDetectionConfirmationModal.tsx`, `src/features/visualization/components/FiducialPaperPickerModal.tsx`, `docs/qad-glassfit.md`, `docs/milestone.md`, `docs/index.md` | GlassFit Capstone Team | Implemented click-guided interactive paper localization, seed-constrained candidate selection, Tier 1/Tier 2 local adaptive ROI segmentation, tap-to-snap UI feedback, and QAD-TC73 verification | Pending |

---

## Self-Check

- [x] Master document registry accounts for every specification file in `docs/`
- [x] Document statuses and reconciliation timestamps reflect repository state
- [x] Traceability matrix contains no orphaned business metrics or missing test cases
- [x] Subsystem domains have assigned primary and secondary DRIs
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes

MS54 traceability: BRD-M5, BRD-M6 -> PRD-F4, PRD-F5, PRD-F6, PRD-F10 -> SDD-C3, SDD-C4, SDD-C5 -> DSD-UI4 -> QAD-TC69. Metric geometry is versioned in session/configuration JSON; no database schema change. Real-photo release validation remains pending in MS57.


MS55 traceability: BRD-M5, BRD-M6 -> PRD-F3, PRD-F4, PRD-F6, PRD-F10 -> SDD-C3, SDD-C5 -> DSD-UI3, DSD-UI4, DSD-UI7 -> QAD-TC70. Implemented versioned user placement declarations, per-opening plane assignment, recovery choices, and domain eligibility gates. Real-photo release validation remains MS57.

MS56 traceability: IMP-MS56 / BRD-M2, BRD-M5, BRD-M6 -> PRD-F5, PRD-F6, PRD-F10, PRD-F11 -> SDD-C4, SDD-C5, SDD-C7 -> DSD-UI4, DSD-UI7 -> ERD-E11, ERD-E13, ERD-E14 -> QAD-TC71. Implemented on October 19, 2026; MS57 physical validation and browser acceptance remain pending. See [MS56](implementation/ms56.md).

MS58 traceability: BRD-M1, BRD-M5, BRD-M6 -> PRD-F3, PRD-F4 -> SDD-C2, SDD-C3 -> DSD-UI3 -> QAD-TC73. Single-click paper seed localization constrains candidate selection and extracts localized paper boundaries on tap; integrates with confirmation gateway and manual loupe fallbacks. See [MS58](implementation/ms58.md).
 
MS63 traceability: BRD-M1, BRD-M4, BRD-M6 -> PRD-F3, PRD-F4, PRD-F10 -> SDD-C2, SDD-C3 -> QAD-TC78.1 through QAD-TC78.8. Implemented client-side exponential backoff retry across network drops, early WebP downscaled paper detection, session-bound /snap-paper endpoint, and local blob URL buffering. See [MS63](implementation/ms63.md).

MS71 traceability: IMP-MS71 / BRD-M2, BRD-M3, BRD-M5 -> PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F11, PRD-F14 -> SDD-C4, SDD-C7, SDD-C9 -> DSD-UI4, DSD-UI7, DSD-UI10 -> ERD-E6, ERD-E13, ERD-E14, ERD-E17 -> QAD-TC86.1 through QAD-TC86.10. Implemented on October 26, 2026. Parametric linear-meter security grille pricing engine, automated 3D sub-bar geometry analyzer, and dynamic pattern repetition metric engine. See [MS71](implementation/ms71.md).

