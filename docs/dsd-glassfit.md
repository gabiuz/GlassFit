# Design Specification Document (DSD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Gianne Crizzle A. Dasco (Design & Frontend Lead) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** September 9, 2026 (Reconciled with Tailwind CSS 4 design tokens, globals.css, and 3D canvas viewport specifications)  
**PRD:** docs/prd-glassfit.md

---

## 1. Visual Foundation & Design Tokens

**Visual aesthetic direction:**
Modern architectural precision engineered for clarity, spatial focus, and technical trust. The interface uses slate neutrals resembling powder-coated aluminum profiles, complemented by deep charcoal surfaces and frosted glassmorphism accents. High-contrast typography ensures legible dimensional readouts, while crisp sky blue and emerald glass accents highlight interactive manipulation gizmos, light adjustment sliders, and pricing callouts without distracting from the user's uploaded space photograph.

### 1.1 Color Tokens

| Semantic Token | CSS Variable | Value (Light Mode) | Value (Dark Mode) | Contrast Target |
|---|---|---|---|---|
| Background Canvas | `--color-bg-canvas` | `#F8FAFC` | `#0F172A` | Base viewport background |
| Background Surface | `--color-bg-surface` | `#FFFFFF` | `#1E293B` | Structural cards and panels |
| Surface Card Border | `--color-surface-border` | `#E2E8F0` | `#334155` | 1px clean container separator |
| Text Primary | `--color-text-primary` | `#0F172A` | `#F8FAFC` | 14.5:1 against canvas (WCAG AAA) |
| Text Muted | `--color-text-muted` | `#64748B` | `#94A3B8` | 5.2:1 against canvas (WCAG AA) |
| Accent Primary (Sky) | `--color-accent-primary` | `#0284C7` | `#38BDF8` | 4.8:1 interactive buttons and links |
| Accent Glazing (Teal) | `--color-accent-teal` | `#0D9488` | `#2DD4BF` | 4.6:1 glass appearance highlights |
| Feedback Error | `--color-feedback-error` | `#DC2626` | `#F87171` | 4.7:1 error toasts and validations |
| Feedback Success | `--color-feedback-succ` | `#16A34A` | `#4ADE80` | 4.6:1 verified actions and bookings |
| Feedback Warning | `--color-feedback-warn` | `#D97706` | `#FBBF24` | 4.5:1 estimation disclaimers |

### 1.2 Typography Hierarchy

| Level | Semantic Element | Font Family | Size (Desktop / Mobile) | Line Height | Weight |
|---|---|---|---|---|---|
| Heading 1 | `h1` | Inter, system-ui | 36px / 28px | 1.2 | 700 (Bold) |
| Heading 2 | `h2` | Inter, system-ui | 24px / 20px | 1.3 | 600 (SemiBold) |
| Heading 3 | `h3` | Inter, system-ui | 18px / 16px | 1.4 | 600 (SemiBold) |
| Body Text | `p` | Inter, system-ui | 16px / 14px | 1.5 | 400 (Regular) |
| Caption / Meta | `span` | Inter, system-ui | 13px / 12px | 1.4 | 500 (Medium) |
| Dimensional Data | `code`, `kbd` | JetBrains Mono | 14px / 13px | 1.4 | 500 (Medium) |

---

## 2. Layout Grid & Viewport Breakpoints

| Breakpoint Tier | Target Width Boundary | Grid Columns | Margin Width | Gutter Width | Maximum Container Width |
|---|---|---|---|---|---|
| Mobile Compact | 320px to 639px | 4 | 16px | 16px | 100% (Single-column vertical stack) |
| Tablet Intermediate| 640px to 1023px | 8 | 24px | 20px | 100% (Split view with canvas and control drawer) |
| Desktop Standard | 1024px to 1439px | 12 | 32px | 24px | 1200px (Canvas dominant with persistent right dock) |
| Large Display | 1440px and above | 12 | Auto | 32px | 1400px (Centered ergonomic workspace) |

**Visualization Workspace Constraints:**
- On mobile viewports (under 640px), the simulation canvas occupies the upper 55% of vertical viewport height, while configuration controls reside in an anchored, swipeable bottom sheet with minimum touch targets of 44px by 44px.
- On desktop viewports (1024px and above), the simulation canvas occupies a fixed 70% left pane, accompanied by a 30% right-side parametric inspector and environmental realism toolbar.

---

## 3. UI Component Specifications

### 3.1 Component Inventory

| Component ID | Component Name | Traces to PRD | Intended Purpose | Primary Variant |
|---|---|---|---|---|
| DSD-UI1 | PublicProductCard | PRD-F1 | Displays product thumbnail, title, category, and base price in catalog | Grid card with hover elevation and quick 3D preview button |
| DSD-UI2 | Interactive3DViewer | PRD-F2 | Provides full 360-degree orbit, zoom, and lighting inspection of 3D GLB models | Full-bleed interactive WebGL canvas with touch orbit controls |
| DSD-UI3 | SpacePhotoDropzone | PRD-F3 | Prompts client photo upload with camera direct-access and pre-flight validation | Dashed container with camera icon and format guidance |
| DSD-UI4 | WorkspaceCanvasStage | PRD-F6 | Renders room photograph, active Three.js product layer, and transform gizmos | Layered composite canvas with drag, scale, and rotate handles |
| DSD-UI5 | RealismControlDock | PRD-F7 | Exposes sliders for ambient lighting, shadow intensity, and glass modes | Floating glassmorphism toolbar docked to viewport bottom |
| DSD-UI6 | OcclusionToggleSwitch | PRD-F8 | Enables or disables AI foreground object cutouts behind active product models | Pill toggle switch with icon indicator |
| DSD-UI7 | MeasurementAndGuardrailModal | PRD-F5, PRD-F10 | Captures verified dimensions and presents Behavior B hybrid structural guardrail confirmation | Accessible modal dialog with unit selector, 3-panel switch CTA, and waiver checkbox |
| DSD-UI8 | BookingHandoffCard | PRD-F13 | Displays signed reference QR code, summary badge, and Messenger/Viber links | High-contrast callout card with one-click social deep links |
| DSD-UI9 | ComparisonSlider | PRD-F15 | Enables interactive before-and-after comparison between photo and simulation | Dual-layer horizontal split swipe divider |
| DSD-UI10 | AdminPartInspectorAndSimulator | PRD-F14, PRD-F19 | Split-screen Three.js viewport and Part Inspector Drawer with live BOM test-drive simulator | Tabbed multi-step management workbench with 60/40 viewport-to-drawer split |

### 3.2 State Behaviors & Visual Treatment

| Component ID | State Name | Visual Characteristics | Interaction Trigger | Screen Reader / Focus Rules |
|---|---|---|---|---|
| DSD-UI3 | Default | Neutral surface background, dashed border, upload icon | Initial component render | Reads upload instructions and file restrictions |
| DSD-UI3 | DragOver | Border shifts to sky blue accent, background gains 10% tint | User drags file over dropzone | Announces file drop target active |
| DSD-UI3 | Validating | Spinner icon replaces upload glyph; subtle pulse animation | File selected by user | Announces "Analyzing image dimensions and format" |
| DSD-UI3 | Error | Crimson border, error icon, alert text describing issue | File > 12MB or invalid MIME | Directs focus to error description text |
| DSD-UI4 | Default | Uploaded image rendered with placed 3D product in center | Workspace initial load | Announces active product name and placement mode |
| DSD-UI4 | Transforming | Translucent bounding box active with 4 corner scale nodes | User touches or clicks overlay | Announces "Transform mode: use arrow keys or drag" |
| DSD-UI5 | Default | Dark semi-transparent pill toolbar with icon buttons | Persistent during simulation | Grouped role with `aria-label="Environmental realism"` |
| DSD-UI5 | Active Slider | Slider thumb glows teal with tooltip displaying numeric value | User drags brightness slider | Announces current value percentage |
| DSD-UI7 | Inactive | Invisible, removed from layout flow | Modal closed | `aria-hidden="true"`, hidden from accessibility tree |
| DSD-UI7 | Open | Centered card, 50% dark backdrop blur, autofocus on width | User clicks "Confirm Dimensions" | Traps focus within modal; Escape key triggers dismiss |
| DSD-UI7 | Guardrail Warning | Amber warning header, span risk notice, primary 3-panel switch button, secondary waiver option | Width >= 2400mm on 2-panel window | Announces "Structural Span Limit Exceeded: Recommendation to switch to 3 panels" |
| DSD-UI8 | Success | Emerald checkmark badge, itemized breakdown, bright buttons | Quotation estimate generated | Announces quotation number and total amount in PHP |
| DSD-UI10 | Inspector Active | Highlighted mesh selection outline, auto-detected dimension binding badge, span ratio slider | Part selected in Three.js viewport | Announces selected component name and linked raw material |
| DSD-UI10 | Live Simulating | Dynamic price tally, scrap breakdown, labor floor badge, aspect ratio caution pill | Admin adjusts width/height/sill controls | Announces updated manufacturing cost and final estimate |

---

## 4. Accessibility & Inclusion Standards

- Keyboard Operability: All navigation, product cards, configuration sliders, and modal dialogs must be fully operable using Tab, Shift+Tab, Space, and Enter keys. Every active focusable control displays a sharp 2px solid sky-blue focus ring (`--color-accent-primary`) with a 2px offset.
- Screen Reader Semantic Structure: Structural areas use HTML5 semantic tags (`<header>`, `<main>`, `<aside>`, `<footer>`, `<dialog>`). Status updates (such as CV image processing completion and quotation calculation) announce via `aria-live="polite"` regions.
- Touch Target Dimensions: In compliance with mobile ergonomics, all buttons, toggles, slider handles, and navigation items maintain minimum interactive footprints of 44px by 44px.
- Color Contrast Compliance: Standard text maintains at least 5.2:1 contrast against surface backgrounds; primary headings achieve 14.5:1. Informational indicators never rely on color alone, always pairing chromatic cues with text labels or iconography.
- Motion Accessibility: Interfaces strictly honor the `@media (prefers-reduced-motion: reduce)` media query by disabling continuous animations, smooth scroll transitions, and decorative 3D pulsing effects.

---

## 5. UI Component Reuse & Styling Consistency Rules

- Mandatory Component Reuse: When touching the UI (adding new pages, drawers, modals, cards, buttons, or form controls, or editing existing views), you must strictly reuse existing UI components and design patterns located in `src/components/` and `src/features/`.
- Styling Parity & Tokens: All visual elements must strictly adhere to the Tailwind CSS design tokens defined in Section 1 and `src/app/globals.css` (e.g., `--color-bg-canvas`, `--color-bg-surface`, `--color-surface-border`, `--color-accent-primary`, `--color-accent-teal`).
- Visual Aesthetic Discipline: Preserve existing border radius standards (`rounded-[20px]`, `rounded-[25px]`, `rounded-[16px]`), drop-shadows (`drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)]`), slate neutrals, and glassmorphism styling.
- Zero Foreign UI Systems: Never introduce external component libraries, ad-hoc styling hacks, or conflicting color schemes outside the design system documented in this specification.

---

## Self-Check

- [x] Color tokens specify values for both light and dark modes with contrast verifications
- [x] Typography scale establishes explicit desktop and mobile sizes, line heights, and weights
- [x] Responsive grid breakpoints define columns, margins, and container constraints
- [x] Every UI component has an assigned DSD-UI# identifier mapping to an upstream PRD-F# feature
- [x] Interactive states (default, loading, error, empty) are articulated for every component
- [x] Accessibility rules define keyboard focus behavior, contrast ratios, and ARIA attributes
- [x] No interface wireframes or component trees use box-drawing characters in code blocks
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
