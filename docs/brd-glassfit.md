# Business Requirements Document (BRD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** September 9, 2026 (Reconciled with PUP CCIS Manuscript Chapters 1-3 and SME Fabricator Field Studies)  
**IDEA:** N/A (Academic Capstone Research Charter, CCIS-PUP Manila)

---

## 1. Commercial Context & Problem Definition

**Executive problem statement:**
Small and medium-sized enterprises (SMEs) in the Philippine glass and aluminum fabrication industry face severe operational inefficiencies and commercial revenue leakage during customer consultations. Customized products (such as sliding windows, awning windows, swing doors, interior partitions, shower enclosures, and modular cabinets) require customer alignment on physical dimensions, aluminum profile sections, and glass tint specifications. Because prospective buyers lack technical spatial literacy, businesses rely on 2D printed brochures, static portfolio images, hand-drawn paper sketches, and fragmented conversational threads over Facebook Messenger and Viber. This communication disconnect creates a severe "visualization gap": customers struggle to imagine how a customized fixture will fit within their actual living or commercial space. Consequently, fabricators experience protracted inquiry cycles (averaging 4 to 7 days of back-and-forth messaging), high inquiry drop-off rates (exceeding 70%), repeated design re-evaluations, and costly on-site fabrication rework resulting from mismatched expectations.

**Strategic justification:**
Deploying an accessible, web-based photo-simulation and consultation platform enables SME fabricators to modernize customer intake without capital-intensive infrastructure or specialized mobile applications. By allowing clients to upload a smartphone photograph of their actual room opening, interactively place parametric 3D models of glass and aluminum fixtures, adjust environmental lighting and realistic material finishes, and confirm rough opening dimensions, GlassFit establishes immediate visual consensus. Transitioning from abstract explanations to concrete visual references accelerates client commitment, reduces preliminary estimation overhead by more than 50%, and filters out non-serious inquiries through verified booking references linked directly to social media messaging channels.

**Target operational environment:**
Micro, small, and medium-scale glass and aluminum fabrication businesses, architectural glazing contractors, residential interior remodeling shops, and retail homeowners across Metro Manila and surrounding Philippine urban centers. Consultations operate over standard web browsers on consumer Android and iOS smartphones, tablets, and desktop workstations, connecting seamlessly to business operations on Facebook Messenger and Viber.

---

## 2. Business Objectives & Quantifiable Metrics

| ID | Strategic Objective | Baseline Metric | Target Metric (90 Days) | Measurement Method |
|---|---|---|---|---|
| BRD-M1 | Compress Consultation Intake Cycle | 4 to 7 business days from initial inquiry to design consensus | Less than or equal to 24 to 48 hours for signed visual reference | Timestamp delta between customer inquiry and generation of signed booking link |
| BRD-M2 | Reduce Preliminary Design Revisions | 45% of incoming inquiries require 3 or more design iterations | Less than 15% of inquiries require more than 1 design modification | Proportion of customer consultations undergoing layout reconfiguration prior to site inspection |
| BRD-M3 | Elevate Consultation to Ocular Conversion | 18% to 22% conversion from preliminary chat to scheduled site visit | Greater than or equal to 45% conversion for signed GlassFit booking links | Ratio of scheduled on-site ocular visits against total generated signed booking requests |
| BRD-M4 | Achieve High System Usability & Spatial Confidence | 2.1 / 5.0 perceived clarity on traditional 2D paper and photo brochures | Greater than or equal to 4.2 / 5.0 across all ISO/IEC 25010 usability criteria | Post-consultation customer usability evaluation survey administered during capstone validation |
| BRD-M5 | Minimize Estimator Preliminary Drafting Overhead | 60 to 90 minutes per customized quote calculation and sketch | Less than 15 minutes per quote utilizing standardized visual snapshot packet | Time-motion tracking of shop estimators preparing initial cost breakdowns |
| BRD-M6 | Suppress On-Site Misalignment & Fabrication Scrappage | 12% installation discrepancy or customer dispute over finished appearance | Less than 3% dispute or remanufacturing rate on verified installations | Audit of completed shop job orders and warranty claims post-installation |

---

## 3. Financial Modeling & ROI Expectations

**Capital budget allocation:**
PHP 120,000 (Allocated academic capstone research grant and SME pilot equipment fund covering baseline compute, training asset acquisition, domain registration, and testing hardware).

**Operational expenditure ceiling:**
PHP 3,500 per month (Allocated across Cloudflare R2 object storage, Supabase Pro database tier, containerized FastAPI CV inference hosting, and domain management).

| Financial Dimension | Current Annual Baseline (Per SME Shop) | Projected Annual Target (With GlassFit) | Net Economic Delta |
|---|---|---|---|
| Direct Labor and Estimation Overhead | PHP 216,000 (360 hours per annum spent on redundant manual sketches and messaging) | PHP 72,000 (Standardized automated visual snapshots and parameter summaries) | + PHP 144,000 in saved estimator and draftsman labor |
| Material Scrap and Re-glazing Rework | PHP 95,000 (Scrapped aluminum extrusions, mis-cut glass panes, re-powdercoating) | PHP 20,000 (Drastic reduction in customer appearance disputes and re-cuts) | + PHP 75,000 in avoided material waste |
| Unconverted Lead Acquisition Loss | PHP 150,000 (Lost sales opportunities caused by delayed quotes and buyer drop-off) | PHP 60,000 (High-conversion interactive booking links retained via Messenger) | + PHP 90,000 in recovered gross revenue margins |
| Total Net Economic Benefit | PHP 461,000 Annual Cost / Loss | PHP 152,000 Annual Cost / Loss | + PHP 309,000 Net Annual Savings per SME Fabricator |

---

## 4. Stakeholder Matrix & Governance Authority

| Stakeholder Role | Department / Division | Project Accountability | Sign-Off Authority |
|---|---|---|---|
| Lead Systems Architect | Engineering / PUP CCIS Capstone Team | Accountable for end-to-end technical delivery, database schemas, and AI pipeline | Yes (Technical Lead Sign-off: Reynard John B. Rabanal) |
| Research & Capstone Review Panel | College of Computer and Information Sciences, PUP Sta. Mesa | Evaluates academic compliance, methodological rigor, and ISO/IEC 25010 standards | Yes (Academic Defense Approval) |
| Fabrication SME Partner (Shop Owner) | Commercial Fabricator Partner (Glass & Aluminum Shop Owner) | Validates catalog accuracy, pricing formulas, fabrication logic, and operational usability | Yes (Commercial Pilot Acceptance) |
| Shop Project Estimator / Staff | Operations & Sales Intake | Validates consultation workflow, dimension input modal, and Messenger / Viber handoff | Yes (Operational Sign-off) |
| End-User Client Representative | Residential Property Owners & Commercial Tenant Remodelers | Participates in user testing, visual clarity assessment, and simulation fidelity reviews | No (Advisory and Evaluation Role) |
| Ethics & Research Compliance Committee | PUP Institutional Review Board | Oversees data ethics, survey instrument fairness, and participant privacy protections | Yes (Ethical Clearance Veto) |

---

## 5. Regulatory, Compliance & Governance Guardrails

- **Data protection and privacy:** Strict compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173). User space photographs, contact numbers, and session metadata must be treated as personal data. Client room photographs stored in Cloudflare R2 must not be publicly indexable. Customer phone numbers (+63 format) must be collected only upon explicit consent for quotation handoff.
- **Consumer protection and commercial transparency:** Compliance with the Consumer Act of the Philippines (Republic Act No. 7394). Every generated quotation and PDF consultation sheet must display an explicit legal disclaimer: "Preliminary budgetary estimate based on user-provided approximate measurements and photo-simulation. Subject to mandatory physical on-site verification, structural ocular survey, and final commercial contract by the fabricator."
- **Fair competition and intellectual property:** Protection of proprietary shop pricing rules, markup formulas, and CAD profile dimensions. Access to administrative pricing matrices, structural rules, and customer contact data must be strictly isolated behind Role-Based Access Control (RBAC).

---

## 6. Business Scope Boundaries

**In scope for this business phase:**
- Public access product catalog displaying fixed and parametric glass and aluminum architectural models.
- Upload of user room photos with client-side validation and backend computer vision analysis (lighting, color temperature, and object segmentation).
- Interactive 3D placement workspace with translation, scaling, yaw/pitch rotation, glass appearance modes, and depth occlusion.
- Dedicated dimension confirmation modal capturing real-world width, height, and depth for accurate budget estimation.
- Server-side generation of itemized consultation quotation sheets and downloadable PDF summaries.
- Token-hashed signed booking links enabling frictionless consultation handoff directly to shop staff via Facebook Messenger and Viber.
- Administrative back-office for shop owners and staff to manage product catalogs, 3D assets, structural parameters, and quotation intake.

**Explicitly out of scope (deferred to future commercial releases):**
- Continuous real-time AR SLAM camera tracking (excluded due to mobile thermal throttling, sensor drift, and poor support on budget devices).
- Integrated end-to-end digital payment gateway and point-of-sale credit processing.
- Full manufacturing Enterprise Resource Planning (ERP), factory floor CNC cutting-machine integration, and raw aluminum extrusion inventory tracking.
- In-app live chat and video calling (intentionally deferred in favor of existing social messaging channels Messenger and Viber).
- Structural engineering load, wind-shear, and seismic building code certification analysis.

---

## 7. Business Risks & Mitigation Strategy

| ID | Risk Description | Probability | Impact | Mitigation Strategy | Owner |
|---|---|---|---|---|---|
| BRD-R1 | Customer Misinterprets Simulated Budget as Legally Binding Price | High | High | Display non-dismissible disclaimer banners on canvas, estimation modals, and generated PDFs stating that estimates are subject to mandatory on-site ocular verification. | Lead Architect |
| BRD-R2 | User Uploads Low-Quality or Highly Oblique Room Photographs | High | Medium | Implement automated client-side pre-flight checks (detecting minimum resolution, aspect ratio, blur) and visual guidance overlays for straight-on alignment. | Frontend Lead |
| BRD-R3 | Shop Staff Hesitate to Adopt Digital Intake Workflow | Medium | High | Keep administrative interfaces intuitive, provide single-click Messenger/Viber deep-linking, and conduct hands-on training sessions with shop estimators. | Operational Lead |
| BRD-R4 | Cloud Storage and Computer Vision Compute Cost Exceeds Budget | Medium | Medium | Offload 3D rendering to client WebGL, enforce strict 12 MB upload limits, compress space images to WebP, and execute automatic 120-minute session cleanup for temporary masks. | Backend Lead |
| BRD-R5 | Inaccurate Measurements Provided by Non-Technical Homeowners | High | Medium | Decouple canvas visual placement from the quotation dimension modal; mandate explicit measurement source labels ("Estimated" vs "Manual") in job records. | Product Owner |

---

## Self-Check

- [x] Commercial problem statement focuses strictly on business pain without referencing software architecture
- [x] Every business objective has an assigned BRD-M# code with baseline and target numerical thresholds
- [x] Financial expenditure and return on investment parameters are modeled
- [x] Stakeholder matrix explicitly designates approval and veto authority
- [x] Compliance, statutory, and legal boundaries are documented
- [x] Out of scope items explicitly prevent organizational scope creep
- [x] This document contains no technical system architecture (deferred to SDD)
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
