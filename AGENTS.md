<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Agent Playbook (AGENTS.md)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Master Autonomous Agent Instruction & Architectural Contract  
**Version:** 1.0.0 (Capstone Production Release)  
**Date:** September 9, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Active  
**Enforcement:** Mandatory for all AI and LLM code-generation agents  

---

## 1. Primary Operating Directives

You are an autonomous senior software engineering agent working within the GlassFit codebase. Your mission is to build, refactor, and maintain production-grade systems while preventing architectural drift, undocumented interface mutations, and regressions across the Next.js 16 frontend, Three.js 3D visualization engine, FastAPI CV microservice, and Supabase PostgreSQL persistence layer.

Every code change must be treated as an immutable transaction against project specifications:
1. Specification Precedence: Do not write code without an upstream requirement. Features map to PRD-F#, business metrics map to BRD-M#, system components map to SDD-C#, UI components map to DSD-UI#, database entities map to ERD-E#, and tests map to QAD-TC#.
2. Deterministic Outputs: Prefer deterministic logic, schema enforcement, and explicit error handling over heuristic fallbacks.
3. Zero Hallucinated Dependencies: Never introduce new third-party libraries or external dependencies unless explicitly specified in docs/sdd-glassfit.md, package.json, or fastapi-service/requirements.txt, or approved by human maintainers.
4. UI Component and Style Consistency: When touching the UI (adding new screens or editing existing components), you must strictly reuse and adhere to the current UI components, layouts, design tokens, and visual styling established in this repository (such as Tailwind CSS tokens in globals.css, shared components in src/components/, and existing patterns in src/features/). Never introduce arbitrary ad-hoc styles, conflicting color palettes, or unapproved external UI libraries.

---

## 2. Hard Bans & Quality Constraints

| Ban Identifier | Restricted Pattern | Enforcement Rationale | Mandated Alternative |
|---|---|---|---|
| BAN-PUNCT-01 | Em-dashes in documentation | Breaks consistency with voice guidelines and text formatting | Use standard hyphens, colons, or parentheses |
| BAN-SPEC-02 | Writing code with no spec link | Causes requirement leakage and zombie components | Trace commit back to PRD-F#, SDD-C#, ERD-E#, or QAD-TC# ID |
| BAN-DIAG-03 | Box diagrams or trees in code blocks | Unparseable for agent automated diffs | Use standard Markdown tables and ordered prose |
| BAN-AUTH-04 | Hardcoded API tokens or secrets | Security risk; credential leakage | Inject via environment variables (BLD-ENV1 through BLD-ENV12) |
| BAN-TYPE-05 | Using any in TypeScript files | Degrades type safety across API contracts | Use explicit schemas, generics, interfaces, or unknown |
| BAN-MIGR-06 | Manual DB mutations or raw DDL in code | Breaks local vs production state parity | Write reversible migration files in supabase/migrations/ |
| BAN-RLS-07 | Bypassing Supabase RLS on client calls | Violates tenant isolation and user data privacy (auth.uid() = profile_id) | Use authenticated Supabase client for user operations; restrict SUPABASE_SERVICE_ROLE_KEY to server actions |
| BAN-AR-08 | Continuous WebXR or AR camera tracking | Incompatible with system thesis; causes thermal throttling and drift | Use asynchronous photo-based simulation with Three.js offscreen compositing and YOLOv8 segmentation |
| BAN-UI-09 | Introducing foreign UI styles or ad-hoc styling | Fragments the user interface and breaks design consistency | Strictly reuse existing repository components and established UI styling patterns |

---

## 3. System Architecture Boundaries

| Directory Path | Architectural Layer | Permitted Operations | Restricted Operations |
|---|---|---|---|
| docs/ | Specification & Governance | Editing markdown specs, reconciling tables | Adding executable application code |
| src/app/ | Next.js 16 App Router (Ingress) | Routing, server actions, page layouts, route handlers | Direct raw SQL; bypassing service adapters; exposing server secrets to client |
| src/components/ | Presentation Layer (DSD) | Reusable UI components, design tokens (Tailwind CSS 4), layout shells | Direct database calls; server-only secret access; quotation pricing logic |
| src/features/ | Feature Workspaces | Domain-specific UI workflows (visualization, quotation, booking, admin, catalog) | Global state pollution; cross-feature circular imports |
| src/lib/ | Domain Services & Adapters | Supabase client/server adapters, Three.js visualization engine, Cloudflare R2 S3 adapter, FastAPI CV client | Client-side React hooks in pure utilities; direct DOM manipulation |
| fastapi-service/ | Computer Vision Microservice | Python 3.11, OpenCV image normalization, YOLOv8s-seg segmentation, luminance analysis | Next.js frontend code; direct Supabase database writes |
| supabase/migrations/ | Relational Persistence & Schema | PostgreSQL 16 DDL migrations, RLS policies, trigger functions, seed data | Runtime application code; unversioned schema modifications |
| public/ | Static Asset Distribution | Static icons, logos, public fonts, and favicons | Storing private client room photos or dynamic visualization snapshots |

---

## 4. Agent Lifecycle Protocols

1. Planning: Read docs/index.md and upstream specification documents (docs/brd-glassfit.md, docs/prd-glassfit.md, docs/sdd-glassfit.md, docs/dsd-glassfit.md, docs/erd-glassfit.md, docs/qad-glassfit.md, docs/build-glassfit.md). Ensure scope boundaries and traceability mapping (PRD-F#, SDD-C#, ERD-E#, QAD-TC#) are respected.
2. Implementation: Keep diffs focused, maintain separation of concerns across Next.js, Three.js, FastAPI, and Supabase. Enforce schema validation (TypeScript interfaces, Zod schemas, and Pydantic models). Never use em-dashes in code comments or documentation.
3. Verification:
   - Frontend Lint: Execute `npm run lint`
   - Static Typecheck: Execute `npx tsc --noEmit`
   - Production Build: Execute `npm run build`
   - CV Microservice Health: Verify `GET http://localhost:8000/health` returns `{"status": "ok"}`
   - Quality Assurance: Validate changes against traceable test catalog in `docs/qad-glassfit.md`

---

## Self-Check

- [x] Document metadata aligns with GlassFit master documentation index (docs/index.md)
- [x] Primary operating directives map to all 7 core specifications (BRD, PRD, SDD, DSD, ERD, QAD, BUILD)
- [x] Hard bans enforce zero em-dashes, spec traceability, type safety, and security policies
- [x] System architecture boundaries reflect actual GlassFit directory structure (src/, fastapi-service/, supabase/)
- [x] Agent lifecycle protocols define concrete build, lint, typecheck, and health commands
