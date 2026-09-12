# Documentation Index & Traceability Hub (INDEX)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** September 9, 2026 (Reconciled across all 7 GlassFit specification documents and active codebase)

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
| QAD | Quality Assurance Document | `docs/qad-glassfit.md` | Locked | September 9, 2026 | Jedia Nicole I. Sagun |
| BUILD| Build & Deployment Runbook | `docs/build-glassfit.md` | Locked | September 9, 2026 | Reynard John B. Rabanal |
| PRICE| Parametric Fenestration Pricing Engine | `docs/pricing.md` | Active | September 9, 2026 | Reynard John B. Rabanal |
| MILE | Master Implementation Milestones | `docs/milestone.md` | Active | September 9, 2026 | Reynard John B. Rabanal |

---

## 3. End-to-End Traceability Matrix

| Business Metric (`BRD-M#`) | Product Feature (`PRD-F#`) | System Component (`SDD-C#`) | Data Entity (`ERD-E#`) | Test Case (`QAD-TC#`) | Status |
|---|---|---|---|---|---|
| BRD-M1 (Compress Intake Duration) | PRD-F13 (Signed Booking Link & Messaging Handoff) | SDD-C8 (Signed Booking Link & Messaging Handoff) | ERD-E15 (signed_booking_links), ERD-E16 (booking_requests) | QAD-TC13 | Verified |
| BRD-M2 (Reduce Design Revisions) | PRD-F5 (Parametric 3D Assembly), PRD-F6 (Visualization Workspace) | SDD-C4 (Parametric 3D Assembly Engine), SDD-C5 (Visualization Canvas) | ERD-E4 (product_templates), ERD-E5 (product_parameters), ERD-E6 (product_components), ERD-E7 (structural_rules) | QAD-TC5, QAD-TC6, QAD-TC16, QAD-TC17 | Verified |
| BRD-M3 (Elevate Conversion to Ocular) | PRD-F9 (Compositing & Snapshot), PRD-F13 (Signed Booking Link) | SDD-C6 (Canvas Compositor), SDD-C8 (Signed Booking Link) | ERD-E10 (visualization_snapshots), ERD-E15 (signed_booking_links) | QAD-TC9, QAD-TC13 | Verified |
| BRD-M4 (Achieve High Usability) | PRD-F1 (Public Catalog), PRD-F2 (3D Inspector), PRD-F7 (Environmental Realism) | SDD-C1 (Public Catalog), SDD-C5 (Visualization Canvas) | ERD-E3 (products), ERD-E8 (product_assets), ERD-E9 (product_variations) | QAD-TC1, QAD-TC2, QAD-TC7 | Verified |
| BRD-M5 (Minimize Estimator Overhead) | PRD-F10 (Quotation Measurement Modal), PRD-F11 (Consultation PDF), PRD-F14 (Admin Catalog), PRD-F19 (Batch Pricing) | SDD-C7 (Quotation Engine & PDF Generator), SDD-C9 (Admin Portal) | ERD-E11 (product_configurations), ERD-E13 (quotation_estimates), ERD-E14 (quotation_items), ERD-E17 (raw_materials) | QAD-TC10, QAD-TC11, QAD-TC15, QAD-TC18, QAD-TC19, QAD-TC20, QAD-TC21 | Verified |
| BRD-M6 (Suppress On-Site Scrappage) | PRD-F3 (Space Image Upload), PRD-F4 (CV Image Analysis), PRD-F8 (Foreground Occlusion), PRD-F5 (Structural Guardrails) | SDD-C2 (Image Pre-Flight), SDD-C3 (CV Scene Analyzer), SDD-C4 (Parametric Builder), SDD-C5 (Visualization Canvas) | ERD-E6 (product_components), ERD-E7 (structural_rules), ERD-E10 (visualization_snapshots), ERD-E11 (product_configurations) | QAD-TC3, QAD-TC4, QAD-TC8, QAD-TC17 | Verified |

---

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
| September 9, 2026 | `docs/brd-glassfit.md` | Reynard John B. Rabanal | Initial production baseline reconciling PUP CCIS Chapters 1-3 manuscript, SME fabricator economic data, and business metrics | PR #1 |
| September 9, 2026 | `docs/prd-glassfit.md` | Reynard John B. Rabanal | Comprehensive PRD baseline aligning 20 product features with active Next.js and FastAPI implementations | PR #2 |
| September 9, 2026 | `docs/sdd-glassfit.md` | Reynard John B. Rabanal | Authoritative architectural blueprint documenting Next.js 16, FastAPI CV service, Supabase, and R2 pipeline contracts | PR #3 |
| September 9, 2026 | `docs/dsd-glassfit.md` | Gianne Crizzle A. Dasco | Design specification detailing Tailwind CSS 4 tokens, typography, responsive breakpoints, and 10 core UI components | PR #4 |
| September 9, 2026 | `docs/erd-glassfit.md` | Gabriel Nicolai D. Pelagio | Entity relationship document reconciling all 16 Supabase relational tables, constraints, foreign keys, and indexes | PR #5 |
| September 9, 2026 | `docs/qad-glassfit.md` | Jedia Nicole I. Sagun | Quality assurance document detailing test distributions, 14 traceable test cases, and release blocker governance | PR #6 |
| September 9, 2026 | `docs/build-glassfit.md`| Reynard John B. Rabanal | Operational runbook specifying toolchains, 12 environment variables, local bootstrap steps, and rollback protocols | PR #7 |
| September 9, 2026 | `docs/index.md` | Reynard John B. Rabanal | Initial master index registry and end-to-end traceability matrix reconciliation | PR #8 |
| September 9, 2026 | `docs/milestone.md` | Reynard John B. Rabanal | Master implementation roadmap integrating parametric BOM pricing, structural guardrails, and part inspector | PR #9 |
| September 9, 2026 | `docs/milestone.md` | Reynard John B. Rabanal | Specification of Milestone 10 for admin product setup wizard state persistence and smooth component lifecycle | PR #10 |
| September 9, 2026 | `docs/milestone.md` | Reynard John B. Rabanal | Specification of Milestone 11 for full codebase automated test suite consolidation and domain unit test coverage | PR #11 |

---

## Self-Check

- [x] Master document registry accounts for every specification file in `docs/`
- [x] Document statuses and reconciliation timestamps reflect repository state
- [x] Traceability matrix contains no orphaned business metrics or missing test cases
- [x] Subsystem domains have assigned primary and secondary DRIs
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
