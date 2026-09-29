# Implementation Specification: UI Polish Fixes for Fullscreen Picker Navbar Overlap and Toolbar Button Sizing (fix-UI-01)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** UI Polish Specification for Navbar Visibility, Toolbar Button Sizing, and Fullscreen Modal Layering  
**Version:** 1.0.0  
**Date:** September 17, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Completed  
**Upstream Specifications:** `docs/implementation/ms02.md`, `docs/implementation/ms03.md`, `docs/implementation/fix-ms04.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`

---

## 1. Problem Context & Motivation

Three UI polish issues degrade the usability and visual consistency of the visualization workspace when users interact with fullscreen picker modals and the on-canvas product toolbar.

### Issue 1: Navbar Overlaps the Fit to Opening (Perspective Plane) Picker

- **Observed Defect:** When the user clicks "Fit to Opening" and the `PerspectivePlanePicker` opens as a fullscreen modal (`fixed inset-0 z-50`), the site `Navbar` component renders on top of it. The navbar is positioned at `z-100 fixed`, which exceeds the picker's `z-50` stacking context. This obscures the top header card of the perspective picker (the title "Fit to Opening (Perspective Plane)" and the instruction banner), making the corner placement workflow confusing.
- **Root Cause:** The `Navbar` in `src/components/ui/Navbar.tsx` uses `z-100` (line 269), while the `PerspectivePlanePicker` container in `src/features/visualization/components/PerspectivePlanePicker.tsx` uses `z-50` (line 160). Because both are `fixed` positioned, the navbar always stacks above the picker regardless of DOM order.

### Issue 2: Fit to Opening Button is Oversized Relative to Other Toolbar Buttons

- **Observed Defect:** In the on-canvas floating toolbar (free placement mode), the "Fit to Opening" button is noticeably larger than the neighboring "Rotate", "Flip", "Reset", and "Remove" buttons. It uses a two-line stacked layout (icon above label with `flex-col`) and a teal/cyan background (`bg-[#07b6d3]`) that visually dominates the toolbar. The other buttons use the same `flex-col` layout but single-word labels, while "Fit to Opening" wraps to two words on a second line, creating an inconsistent height.
- **Root Cause:** The "Fit to Opening" button at line 2452-2459 of `ProductModelWorkspace.tsx` uses identical padding (`px-3.5 py-1.5`) and layout (`flex flex-col`) as the other toolbar buttons, but the label text "Fit to Opening" is significantly longer than "Rotate", "Flip", "Reset", or "Remove". The `flex-col` layout stacks the icon and multi-word label vertically, causing the button to grow wider and taller than its siblings. Additionally, its distinct cyan background (`bg-[#07b6d3]`) draws disproportionate attention compared to the dark `bg-[#0f1422]` used by the other action buttons.

### Issue 3: Navbar Overlaps the Manual Occlusion Point Picker

- **Observed Defect:** Identical to Issue 1 but affecting the `ManualOcclusionPointPicker` component. When the user opens the manual occlusion mask editor, the navbar appears above the picker's fullscreen overlay, blocking the header and instruction area.
- **Root Cause:** Same z-index mismatch: `ManualOcclusionPointPicker` at `z-50` (line 419) vs `Navbar` at `z-100`.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Relevance |
|---|---|---|
| PRD-F6 | Photo-Based Visualization Workspace | Ensures visualization modals (perspective picker, occlusion editor) are fully accessible without visual obstruction |
| PRD-F18 | Guided Camera Capture & Perspective Helper | Guarantees the perspective plane picker header and instructions are visible during 4-point corner placement |
| SDD-C5 | Photo-Based Visualization Canvas | Corrects z-index stacking hierarchy between navigation and visualization modals |
| DSD-UI6 | Visualization Workspace Viewport | Maintains visual consistency across all toolbar buttons within the product controls layer |
| DSD-UI1 | Global Navigation Bar | Defines navbar visibility behavior and its interaction with fullscreen modal overlays |
| BAN-UI-09 | No foreign UI styles or ad-hoc styling | All changes reuse existing Tailwind design tokens and established component patterns |
| BAN-PUNCT-01 | No em-dashes in documentation or comments | Enforces hyphens, colons, or parentheses exclusively |
| BAN-TYPE-05 | No `any` in TypeScript | Strict type safety across all modified files |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Layer | Component | Planned Modification |
|---|---|---|
| `src/components/shared/` | `NavbarVisibilityContext.tsx` (new) | Create a React context that allows child components to signal the `LayoutWrapper` to suppress navbar rendering when fullscreen picker modals are active. |
| `src/components/shared/` | `LayoutWrapper.tsx` | Wrap the layout tree in `NavbarVisibilityProvider` and conditionally hide the `Navbar` when `isNavbarHidden` is `true`. |
| `src/features/visualization/components/` | `ProductModelWorkspace.tsx` | 1. Consume `useNavbarVisibility()` and synchronize `setNavbarHidden` with `showPerspectivePicker` and `showOcclusionPointPicker` states.<br>2. Resize the "Fit to Opening" button: shorten label to "Fit", unify background color with sibling buttons (`bg-[#0f1422]`). |

### 3.2 Out of Scope

| Layer | Rationale |
|---|---|
| `fastapi-service/` | No backend involvement; all changes are client-side UI/CSS |
| `supabase/migrations/` | No database schema changes |
| `src/lib/visualization/` | Rendering logic, model transformations, and perspective math are unchanged |
| `src/features/visualization/components/PerspectivePlanePicker.tsx` | No structural changes required; z-index fix is handled at the navbar level |
| `src/features/visualization/components/ManualOcclusionPointPicker.tsx` | No structural changes required; z-index fix is handled at the navbar level |
| `src/components/ui/Footer.tsx` | Footer is below the fold and does not interfere with fullscreen pickers |
| `src/components/ui/adminNavbar.tsx` | Admin navbar operates on separate routes and is not affected |

---

## 4. Technical Specification

### 4.1 Hiding Navbar During Fullscreen Picker Modals (Issues 1 and 3)

**Strategy: React Context for Navbar Visibility**

Create a lightweight context in `src/components/shared/` that allows child components to signal the `LayoutWrapper` to suppress navbar rendering. This avoids prop drilling from deeply nested visualization components up through the layout hierarchy.

**File:** `src/components/shared/NavbarVisibilityContext.tsx` (new)

```typescript
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface NavbarVisibilityContextValue {
  isNavbarHidden: boolean;
  setNavbarHidden: (hidden: boolean) => void;
}

const NavbarVisibilityContext = createContext<NavbarVisibilityContextValue>({
  isNavbarHidden: false,
  setNavbarHidden: () => {},
});

export function NavbarVisibilityProvider({ children }: { children: ReactNode }) {
  const [isNavbarHidden, setHidden] = useState(false);

  const stableSetNavbarHidden = useCallback((hidden: boolean) => {
    setHidden(hidden);
  }, []);

  return (
    <NavbarVisibilityContext value={{ isNavbarHidden, setNavbarHidden: stableSetNavbarHidden }}>
      {children}
    </NavbarVisibilityContext>
  );
}

export function useNavbarVisibility() {
  return useContext(NavbarVisibilityContext);
}
```

**File:** `src/components/shared/LayoutWrapper.tsx` (modify)

Wrap the existing layout tree in `NavbarVisibilityProvider` and conditionally hide the `Navbar` when `isNavbarHidden` is `true`:

```typescript
// Existing Navbar rendering (line 38-40):
<div className="flex justify-center">
  <Navbar />
</div>

// Modified to:
{!isNavbarHidden && (
  <div className="flex justify-center">
    <Navbar />
  </div>
)}
```

The `NavbarVisibilityProvider` wraps the entire `VisualizationSessionProvider` and its children, so the context is available to all visualization components without additional plumbing.

**File:** `src/features/visualization/components/ProductModelWorkspace.tsx` (modify)

Consume `useNavbarVisibility()` and synchronize it with the picker states:

```typescript
import { useNavbarVisibility } from "@/components/shared/NavbarVisibilityContext";

// Inside the component body:
const { setNavbarHidden } = useNavbarVisibility();

useEffect(() => {
  setNavbarHidden(showPerspectivePicker || showOcclusionPointPicker);
  return () => setNavbarHidden(false);
}, [showPerspectivePicker, showOcclusionPointPicker, setNavbarHidden]);
```

This ensures the navbar disappears when either picker opens and reappears when the picker closes or the component unmounts.

### 4.2 Resizing the Fit to Opening Button (Issue 2)

**File:** `src/features/visualization/components/ProductModelWorkspace.tsx` (modify)

**Current Button (lines 2452-2459):**

```tsx
<button
  type="button"
  onClick={() => setShowPerspectivePicker(true)}
  className="bg-[#07b6d3] hover:bg-[#069bb5] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
>
  <Maximize className="w-4 h-4 text-white" />
  <span className="text-[13px] font-normal tracking-[-0.266px]">Fit to Opening</span>
</button>
```

**Modified Button:**

Shorten the label from "Fit to Opening" to "Fit" and unify the background color with sibling buttons:

```tsx
<button
  type="button"
  onClick={() => setShowPerspectivePicker(true)}
  className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
>
  <Maximize className="w-4 h-4 text-white" />
  <span className="text-[13px] font-normal tracking-[-0.266px]">Fit</span>
</button>
```

Key changes:
1. **Background color** changed from `bg-[#07b6d3]` (cyan) to `bg-[#0f1422]` (dark, matching Rotate/Flip/Reset).
2. **Hover color** changed from `hover:bg-[#069bb5]` to `hover:bg-black` (matching sibling buttons).
3. **Label shortened** from "Fit to Opening" to "Fit" to match the single-word convention of the other buttons (Rotate, Flip, Reset, Remove). The `Maximize` icon already communicates the "fit to opening" semantic, and the full action name "Fit to Opening (Perspective Plane)" is displayed in the picker header when it opens.

---

## 5. Verification Criteria

1. Opening the "Fit to Opening" perspective picker fully hides the navbar; the picker's top header card and instruction banner are unobstructed.
2. Opening the manual occlusion point picker fully hides the navbar; the picker's top header card and instruction banner are unobstructed.
3. Closing either picker (via Cancel, Confirm Fit, Apply Mask, or Escape) restores the navbar to its normal fixed position.
4. Navigating away from the visualization page while a picker is open does not leave the navbar permanently hidden (cleanup effect fires on unmount).
5. The "Fit" button in the on-canvas toolbar matches the visual dimensions (width, height, padding) and styling (background, text, border-radius) of its sibling buttons (Rotate, Flip, Reset, Remove).
6. All five toolbar buttons render in a single, visually uniform horizontal strip without one button dominating the row.
7. `npm run lint` completes with zero lint errors.
8. `npx tsc --noEmit` completes with zero TypeScript errors (BAN-TYPE-05).
9. `npm run build` succeeds cleanly.
10. Zero em-dashes exist across all modified code comments and documentation (BAN-PUNCT-01).

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Context re-render propagation when toggling navbar visibility | Low | Low | `NavbarVisibilityProvider` state is a single boolean; only `LayoutWrapper` subscribes to it, limiting re-render scope. |
| User confusion from shortened "Fit" label | Low | Low | The `Maximize` icon provides strong visual affordance; the perspective picker header still displays the full "Fit to Opening (Perspective Plane)" title when opened. |
| Navbar state leak if visualization component unmounts unexpectedly | Low | Medium | The `useEffect` cleanup (`return () => setNavbarHidden(false)`) ensures the navbar is always restored on unmount. |

---

## Self-Check

- [x] Target file is `docs/implementation/fix-ui1.md`
- [x] Follows exact markdown structure and document conventions of `fix-ms02.md` and `fix-ms04.md`
- [x] Traceability codes map to PRD-F6, PRD-F18, SDD-C5, DSD-UI6, and DSD-UI1
- [x] Root causes for all three issues (navbar z-index overlap on perspective picker, oversized toolbar button, navbar z-index overlap on occlusion picker) are thoroughly analyzed
- [x] Technical specification details the React context approach for navbar hiding and the button resizing strategy
- [x] Hard bans enforced: zero em-dashes (BAN-PUNCT-01), zero `any` types (BAN-TYPE-05), zero ad-hoc styles (BAN-UI-09), and zero box diagrams (BAN-DIAG-03)
- [x] Status set to "Completed" after changes were applied and verified
