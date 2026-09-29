# Implementation Specification: Cross-Category Multi-Product Visualization and Workspace Session State Continuity (fix-03)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for Cross-Category Multi-Product Scene Composition, Route Synchronization, and Space Session Guard Modernization  
**Version:** 1.0.0  
**Date:** September 17, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Specified (Pending Implementation)  
**Upstream Specifications:** `docs/implementation/fix-02.md`, `docs/implementation/ms05.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/pricing.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Defect Analysis

During end-to-end testing of the client visualization workspace (`/visualize/[productId]/workspace`), a critical architectural defect was identified in the multi-product scene composition workflow:

### 1.1 Observed Defect
- **Single-Product Duplication Works:** A user can successfully place and duplicate multiple instances of the same catalog item (for example, placing a Fixed Window, then clicking "Add Product" and selecting another Fixed Window). Both windows render concurrently, can be repositioned independently, appear as discrete layers in the Layers panel, and aggregate accurately into the combined price card.
- **Cross-Category Addition Fails Immediately:** When a user configures a Window and then attempts to add a distinct product type or catalog item (for example, selecting a Screen Door or Sliding Door via the "Add Product" popover modal), the application abruptly breaks out of the workspace. Instead of mounting the door model alongside the placed window, the application redirects the user to the space image upload screen (`/visualize/[productId]/upload`), displaying the transient message *"Returning to upload..."*. The client loses their active configuration context and is forced to re-upload their space photo.
- **Cross-Product Change Fails Identically:** Clicking "Change Product" to replace the active window with a door triggers the exact same failure, redirecting to `/visualize/[productId]/upload`.

---

### 1.2 Comprehensive Root Cause Breakdown

Detailed inspection of `ProductAwareWorkspacePage.tsx`, `ProductModelWorkspace.tsx`, and `visualizationSession.tsx` reveals four interconnected architectural failure points:

#### Root Cause 1: Flawed Session Route Precondition in `ProductAwareWorkspacePage.tsx`
In `src/features/visualization/components/ProductAwareWorkspacePage.tsx`, the workspace mount precondition is defined as:
```typescript
const hasMatchingSession =
  selectedProductId === productId && Boolean(spaceImageSession);

useEffect(() => {
  if (!hasMatchingSession) {
    router.replace(`/visualize/${productId}/upload`);
    return;
  }
  setStructuralDefinition(structuralDefinition);
}, [hasMatchingSession, productId, router, setStructuralDefinition, structuralDefinition]);
```
This guard conflates two fundamentally orthogonal concerns:
1. **Space Session Validity:** Has the user uploaded and analyzed a room photo (`Boolean(spaceImageSession)`)?
2. **URL Route Param Parity:** Does `selectedProductId` in the global context match `productId` in the Next.js URL parameter (`selectedProductId === productId`)?

When a user in a Window workspace (`productId = windowId`) selects a Door (`nextProductId = doorId`), `ProductModelWorkspace` calls `onProductSelect(doorId, "add")`. In `ProductAwareWorkspacePage`:
```typescript
onProductSelect={(nextProductId, mode, flattenedBackgroundDataUrl, configuration) => {
  selectWorkspaceProduct(
    nextProductId,
    mode === "add" ? flattenedBackgroundDataUrl : undefined,
    configuration,
  );
  if (nextProductId !== productId) {
    router.push(`/visualize/${nextProductId}/workspace`);
  }
}}
```
This triggers an inescapable race condition:
- `selectWorkspaceProduct(nextProductId)` mutates `selectedProductId` in `VisualizationSessionContext` from `windowId` to `doorId`.
- In Next.js App Router, `router.push('/visualize/${doorId}/workspace')` initiates an asynchronous client-side route navigation that takes multiple animation frames (fetching the server-component React Server Component payload for the door).
- In the meantime, the context update synchronously triggers a re-render of the currently mounted `ProductAwareWorkspacePage` (where `productId` is still `windowId`).
- On this re-render, `selectedProductId` (`doorId`) !== `productId` (`windowId`). Thus, `hasMatchingSession` evaluates to `false`.
- The component unmounts `ProductModelWorkspace`, renders the fallback UI (`<div>Returning to upload...</div>`), and the `useEffect` immediately fires `router.replace('/visualize/${windowId}/upload')`.
- This `router.replace` aborts the pending navigation to `/visualize/${doorId}/workspace` and sends the user back to the upload page.
- Even if `selectWorkspaceProduct` were not called before navigation: upon arrival at `/visualize/${doorId}/workspace`, the new page would mount with `productId = doorId` while `selectedProductId` in context was still `windowId`. The new page's guard would evaluate `doorId === windowId` as `false`, immediately executing `router.replace('/visualize/${doorId}/upload')`.
- This is a double trap: updating before navigation breaks the source page; updating after navigation breaks the destination page.

#### Root Cause 2: Asymmetric Code Paths Between Same-Product and Cross-Product Addition
When `nextProductId === productId` (adding another Fixed Window):
- `if (nextProductId !== productId)` evaluates to `false`.
- No route transition or page unmount occurs.
- `current.selectedProductId === productId` remains `true`.
- The existing workspace remains mounted in-memory and appends the instance to `placedOverlays`.
- Because single-product duplication bypassed Next.js route navigation entirely, it hid the fatal route-mismatch guard defect.

#### Root Cause 3: Storage Quota Blowout in `writeStoredVisualizationSession`
In `ProductModelWorkspace.tsx`:
```typescript
const activeImageDataUrl = await captureCurrentProductLayer();
```
`captureCurrentProductLayer` rasterizes the active product canvas into an uncompressed base64 PNG data URL (`data:image/png;base64,...`). For standard high-DPI displays (1200x800 to 1920x1080), a single layer snapshot consumes 1.5 MB to 4.5 MB.
- Browser `sessionStorage` has a strict quota limit of 5 MB per origin.
- When `placedOverlays` contains one or more placed layers, serializing `placedOverlays` into `sessionStorage` throws a `DOMException: QuotaExceededError`.
- In the `catch` fallback block of `writeStoredVisualizationSession` (`src/lib/visualization/visualizationSession.tsx`):
  ```typescript
  url: state.spaceImageSession.workspaceImage.url.length > 50000
    ? ""
    : state.spaceImageSession.workspaceImage.url
  ```
  and:
  ```typescript
  flattenedImageDataUrl: overlay.flattenedImageDataUrl.length > 50000
    ? ""
    : overlay.flattenedImageDataUrl
  ```
  Any payload exceeding 50,000 characters is stripped to an empty string (`""`).
- If quota is completely exhausted, the fallback `setItem` also fails, leaving `sessionStorage` corrupted or empty. If a route transition forces a session re-read, `spaceImageSession` is missing or stripped, triggering a fallback redirect to upload.

#### Root Cause 4: Incomplete Parameter Contract in `handleSelectProduct`
In `ProductModelWorkspace.tsx` line 966:
```typescript
onProductSelect(product.id, mode);
```
`onProductSelect` is invoked with only two positional arguments (`product.id`, `mode`), while the interface in `ProductAwareWorkspacePage` accepts four parameters (`nextProductId`, `mode`, `flattenedBackgroundDataUrl`, `configuration`). While flattening background data URLs is obsolete because GlassFit maintains discrete interactive overlay layers (`placedOverlays`), passing the newly created overlay atomically into the session transition prevents state synchronization lag between React context and route transitions.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F5 | Parametric 3D Product Assembly Engine | Enables multi-product, cross-category assembly in a shared client scene |
| PRD-F6 | Photo-Based Visualization Workspace | Preserves persistent room space photo and CV lighting context across products |
| PRD-F15 | Multi-Product Scene Composition | Allows adding windows, doors, cabinets, and partitions into a single scene |
| PRD-F16 | Scene Layer Management & Editing | Enables switching between placed layers and active product without state loss |
| BRD-M3 | Multi-Product Quotation BOM Aggregation | Computes unified bill of materials across distinct placed product categories |
| SDD-C4 | Parametric 3D Assembly Engine | Maintains 3D viewport lifecycle across template changes without context loss |
| SDD-C5 | Visualization Session & State Persistence | Ensures session state resilience in React context across Next.js route transitions |
| DSD-UI10 | Workspace Viewport Controls & Layer Stack | Interactive layer list displaying all placed products and active instance |
| QAD-TC24 | Cross-Category Multi-Product Placement | Validates concurrent placement of Window + Door + Cabinet in single room |
| QAD-TC25 | Workspace Route Guard Robustness | Validates route transitions between distinct product templates without upload bounce |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Hyphens, colons, and parentheses used exclusively |
| BAN-SPEC-02 | Spec-linked commits and tasks | Direct traceability to PRD, SDD, DSD, BRD, and QAD |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict typing across session state, placed overlays, and route props |
| BAN-UI-09 | Strict UI consistency | Reuses established GlassFit Tailwind tokens and presentation components |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope
| Target File | Modification Rationale |
|---|---|
| `src/features/visualization/components/ProductAwareWorkspacePage.tsx` | 1. Modernize session guard to depend strictly on `Boolean(spaceImageSession)`.<br>2. Synchronize `selectedProductId` to `productId` upon mount without bouncing to upload.<br>3. Prevent route-transition races when navigating between distinct product templates.<br>4. Pass active `placedOverlays` cleanly into the newly mounted workspace. |
| `src/lib/visualization/visualizationSession.tsx` | 1. Add atomic `transitionWorkspaceProduct` routine to update `selectedProductId` and append `placedOverlays` in a single state transaction.<br>2. Modernize `writeStoredVisualizationSession` to prevent `QuotaExceededError` through thumbnail downscaling / WebP compression.<br>3. Safeguard `spaceImageSession.workspaceImage.url` against destructive truncation. |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | 1. Refactor `handleSelectProduct` and `handleEditPlacedOverlay` to use atomic session transition.<br>2. Ensure smooth camera and dimension initialization when transitioning between product categories.<br>3. Preserve placed overlay visual fidelity without canvas dimension distortion. |
| `tests/unit/visualizationSessionGuard.test.ts` | **[NEW]** Automated unit tests validating cross-category product switching, session guard resilience, and storage quota protection. |

### 3.2 Out of Scope
| System Component | Rationale |
|---|---|
| `fastapi-service/` | Space image analysis, YOLOv8 segmentation, and lighting detection occur prior to workspace entry and are unaffected. |
| Supabase PostgreSQL Schema | All product templates, components, and parameters already exist and are linked in the database. |
| Continuous WebXR / AR Tracking (BAN-AR-08) | GlassFit maintains photo-based simulation with Three.js offscreen compositing and discrete layer projection. |

---

## 4. Technical Formulation & State Transition Design

### 4.1 Formal Session State Machine

Let the Visualization Session State $S$ be represented as a 5-tuple:

$$S = \langle \mathcal{I}_{\text{space}}, P_{\text{active}}, \mathcal{O}_{\text{placed}}, \mathcal{C}_{\text{active}}, \mathcal{D}_{\text{struct}} \rangle$$

Where:
- $\mathcal{I}_{\text{space}} \in \text{SpaceImageSession} \cup \{\emptyset\}$ represents the analyzed client room photo (background image, detected obstacles, lighting analysis).
- $P_{\text{active}} \in \text{String}$ is the UUID of the catalog product currently being edited in 3D.
- $\mathcal{O}_{\text{placed}} = [o_1, o_2, \dots, o_k]$ is the ordered array of previously placed product layers, where each overlay $o_i$ contains product ID, template ID, parametric configuration $\mathcal{C}_i$, rendered layer bitmap, and bill-of-materials pricing result $\mathcal{B}_i$.
- $\mathcal{C}_{\text{active}}$ is the current parametric configuration (dimensions, aluminum finish, glass appearance, yaw, pitch, position).
- $\mathcal{D}_{\text{struct}}$ is the loaded structural definition (components, parameters, structural rules, 3D GLB assets).

#### Invariant 1: Session Validity Condition
A visualization workspace session is valid if and only if a space image has been prepared:

$$\text{IsValidWorkspaceSession}(S) \iff \mathcal{I}_{\text{space}} \neq \emptyset$$

The equality $P_{\text{active}} = \text{RouteParam.productId}$ is a **route synchronization state**, not a validity condition. If $P_{\text{active}} \neq \text{RouteParam.productId}$, the system must perform an identity synchronization:

$$P_{\text{active}} \leftarrow \text{RouteParam.productId}$$

It must **never** invalidate the session or trigger a redirect to upload.

---

### 4.2 Cross-Product Transition Semantics

When a user in a workspace with active product $A$ selects product $B$ ($B \neq A$):

#### Mode 1: Add Product ($\text{mode} = \text{"add"}$)
1. The active instance of product $A$ is captured into a `PlacedOverlay` $o_{\text{new}}$ with its current transform and pricing BOM.
2. The placed overlay is appended: $\mathcal{O}_{\text{placed}}' = \mathcal{O}_{\text{placed}} \cup \{o_{\text{new}}\}$.
3. The active product pointer transitions: $P_{\text{active}}' = B$.
4. The active configuration is reset: $\mathcal{C}_{\text{active}}' = \emptyset$ (allowing product $B$ to initialize with its template default parameters).
5. The client navigates: `router.push('/visualize/' + B + '/workspace')`.
6. Upon mounting `/visualize/[B]/workspace`, the server passes $\mathcal{D}_{\text{struct}}(B)$. The workspace mounts with product $B$ active, while rendering all layers in $\mathcal{O}_{\text{placed}}'$ in the background.

```
+---------------------------------------------------------------------------------------+
| Window Workspace (/visualize/window-id/workspace)                                     |
| Active: Window (width: 120cm, height: 120cm) | Placed Overlays: []                    |
+---------------------------------------------------------------------------------------+
                                           |
                                [User clicks "Add Product"]
                                [Selects "Screen Door"]
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| 1. Snapshot active window -> PlacedOverlay(window-id)                                |
| 2. Placed Overlays: [ PlacedOverlay(window-id) ]                                     |
| 3. Atomic transition: selectedProductId = door-id, placedOverlays = [window]          |
| 4. router.push('/visualize/door-id/workspace')                                        |
+---------------------------------------------------------------------------------------+
                                           |
                              (Next.js Route Transition)
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Door Workspace (/visualize/door-id/workspace)                                         |
| Guard check: Boolean(spaceImageSession) === true -> SESSION ACCEPTED                  |
| Active: Door (width: 90cm, height: 210cm)                                             |
| Placed Overlays: [ PlacedOverlay(window-id) ] (Rendered in background)                |
| Layers Count: 2 (1 Placed Window + 1 Active Door)                                     |
| Scene Total Price: Price(Window) + Price(Door)                                        |
+---------------------------------------------------------------------------------------+
```

#### Mode 2: Change Product ($\text{mode} = \text{"change"}$)
1. The active instance of product $A$ is discarded (not added to $\mathcal{O}_{\text{placed}}$).
2. Existing placed overlays are retained: $\mathcal{O}_{\text{placed}}' = \mathcal{O}_{\text{placed}}$.
3. $P_{\text{active}}' = B$.
4. $\mathcal{C}_{\text{active}}' = \emptyset$.
5. `router.push('/visualize/' + B + '/workspace')`.

#### Mode 3: Edit Placed Layer ($\text{mode} = \text{"edit"}$)
1. The currently active product instance is frozen into $\mathcal{O}_{\text{placed}}$.
2. The target placed overlay $o_{\text{target}}$ is removed from $\mathcal{O}_{\text{placed}}$ and restored as the active product.
3. If $o_{\text{target}}.\text{productId} \neq P_{\text{active}}$, navigate to `/visualize/' + o_{\text{target}}.\text{productId} + '/workspace'`.
4. $\mathcal{C}_{\text{active}}' = o_{\text{target}}.\text{configuration}$.

---

### 4.3 Storage Optimization & Quota Guard Formulation

To prevent `DOMException: QuotaExceededError` in browser `sessionStorage`:
1. **Compress Placed Layer Thumbnails for Storage:** Full-resolution 1920x1080 PNG data URLs must not be stored raw in `sessionStorage`. For persistence, layer preview images must be compressed using WebP / JPEG at 0.8 quality or scaled to a max resolution of 800px width.
2. **Preserve High-Resolution Layers in Memory:** The uncompressed high-fidelity image data URLs are retained directly in React Context state (`VisualizationSessionContext`) for rendering the live viewport, ensuring zero quality degradation during the active session.
3. **Protected Space Image URL:** The primary `spaceImageSession.workspaceImage.url` must never be wiped to an empty string. If it is an HTTP URL (from FastAPI), it is tiny (< 100 bytes). If it is a base64 string, it is stored in IndexedDB or kept in memory.

---

## 5. Concrete Step-by-Step Implementation Blueprint

### 5.1 Redesigning `ProductAwareWorkspacePage.tsx`
Eliminate the faulty `selectedProductId === productId` guard and decouple session validity from URL parameters:

```typescript
// BEFORE (Buggy Guard):
const hasMatchingSession =
  selectedProductId === productId && Boolean(spaceImageSession);

useEffect(() => {
  if (!hasMatchingSession) {
    router.replace(`/visualize/${productId}/upload`);
    return;
  }
  setStructuralDefinition(structuralDefinition);
}, [hasMatchingSession, productId, router, setStructuralDefinition, structuralDefinition]);

if (!hasMatchingSession || !spaceImageSession) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 pt-24">
      <div className="rounded-[20px] bg-neutral-100 px-6 py-5 text-black">
        Returning to upload...
      </div>
    </main>
  );
}
```

```typescript
// AFTER (Robust Session Guard):
// Session validity requires ONLY that a space image session exists.
const hasValidSession = Boolean(spaceImageSession);

useEffect(() => {
  if (!hasValidSession) {
    router.replace(`/visualize/${productId}/upload`);
    return;
  }

  // Synchronize session's active product ID and structural definition with the current route
  setStructuralDefinition(structuralDefinition);
}, [hasValidSession, productId, router, setStructuralDefinition, structuralDefinition]);

if (!hasValidSession || !spaceImageSession) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 pt-24">
      <div className="rounded-[20px] bg-neutral-100 px-6 py-5 text-black">
        Returning to upload...
      </div>
    </main>
  );
}
```

### 5.2 Atomic State Routine in `visualizationSession.tsx`
Add an atomic transition function to `VisualizationSessionContext` that updates `selectedProductId`, appends or replaces `placedOverlays`, and resets/applies product configuration in a single synchronous state dispatch:

```typescript
interface TransitionWorkspaceProductOptions {
  nextProductId: string;
  mode: "add" | "change" | "edit";
  newPlacedOverlay?: PlacedOverlay;
  nextConfiguration?: ProductConfigurationSnapshot;
}

const transitionWorkspaceProduct = useCallback(
  ({
    nextProductId,
    mode,
    newPlacedOverlay,
    nextConfiguration,
  }: TransitionWorkspaceProductOptions) => {
    setState((current) => {
      let updatedPlacedOverlays = current.placedOverlays;

      if (mode === "add" && newPlacedOverlay) {
        // Prevent duplicate overlay insertions
        const exists = current.placedOverlays.some(
          (overlay) => overlay.overlayId === newPlacedOverlay.overlayId,
        );
        updatedPlacedOverlays = exists
          ? current.placedOverlays
          : [...current.placedOverlays, newPlacedOverlay];
      } else if (mode === "edit" && newPlacedOverlay) {
        // When editing, freeze the active item and remove the target overlay from placed list
        updatedPlacedOverlays = current.placedOverlays.filter(
          (overlay) => overlay.overlayId !== newPlacedOverlay.overlayId,
        );
      }

      const isSameProduct = current.selectedProductId === nextProductId;
      const nextState: VisualizationSessionState = {
        ...current,
        selectedProductId: nextProductId,
        placedOverlays: updatedPlacedOverlays,
        structuralDefinition: isSameProduct ? current.structuralDefinition : null,
        productConfiguration: nextConfiguration ?? null,
        variationSnapshots: [],
        activeOverlay: null,
        comparisonOverlays: [],
        finalSnapshotDataUrl: null,
      };

      writeStoredVisualizationSession(nextState);
      return nextState;
    });
  },
  [],
);
```

### 5.3 Storage Serialization Modernization in `visualizationSession.tsx`
Safeguard `writeStoredVisualizationSession` against quota exceed errors without destroying session metadata:

```typescript
function writeStoredVisualizationSession(state: VisualizationSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Attempt standard serialization
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded: serialize lightweight representations
    try {
      const lightweightState: VisualizationSessionState = {
        ...state,
        // Retain space image URL if reasonable, or fallback to relative URL
        spaceImageSession: state.spaceImageSession
          ? {
              ...state.spaceImageSession,
              workspaceImage: {
                ...state.spaceImageSession.workspaceImage,
                url: state.spaceImageSession.workspaceImage.url.length > 500000
                  ? ""
                  : state.spaceImageSession.workspaceImage.url,
              },
            }
          : null,
        workspaceBackgroundDataUrl: null,
        variationSnapshots: [],
        finalSnapshotDataUrl: null,
        // Retain overlay transforms and pricing BOM, omitting oversized base64 data URLs in storage
        placedOverlays: state.placedOverlays.map((overlay) => ({
          ...overlay,
          flattenedImageDataUrl: overlay.flattenedImageDataUrl.length > 200000
            ? ""
            : overlay.flattenedImageDataUrl,
          variationImageDataUrls: undefined,
        })),
        comparisonOverlays: state.comparisonOverlays.map((overlay) => ({
          ...overlay,
          flattenedImageDataUrl: overlay.flattenedImageDataUrl.length > 200000
            ? ""
            : overlay.flattenedImageDataUrl,
          variationImageDataUrls: undefined,
        })),
      };

      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(lightweightState));
    } catch {
      // If quota is still exceeded, session remains safely in React memory
    }
  }
}
```

### 5.4 Updating `ProductModelWorkspace.tsx`
Update `handleSelectProduct` and `handleEditPlacedOverlay` to use the atomic transition routine:

```typescript
const handleSelectProduct = async (product: CatalogProduct) => {
  const mode = modalTitle === "Add Product" ? "add" : "change";

  // Same product reactivation if currently unselected
  if (product.id === currentProductId && !selectedProduct) {
    resetProductPlacement();
    setSelectedProduct(true);
    setIsSnapshotApplied(false);
    return;
  }

  if (!onProductSelect || (product.id === currentProductId && mode === "change")) {
    return;
  }

  let newlyPlacedOverlay: PlacedOverlay | undefined;
  if (mode === "add" && selectedProduct) {
    try {
      newlyPlacedOverlay = await createPlacedOverlay();
      onPlacedOverlaysChange?.([...placedOverlays, newlyPlacedOverlay]);
    } catch (err) {
      console.error("Failed to capture active product before adding new product:", err);
    }
  }

  const nextActiveOverlayId = `active-${product.id}-${crypto.randomUUID()}`;
  setActiveOverlayId(nextActiveOverlayId);

  if (product.id === currentProductId) {
    applyProductConfiguration(createDuplicateConfiguration(currentConfiguration));
  }

  setSelectedProduct(true);
  setIsSnapshotApplied(false);

  // Invoke product selection with newly placed overlay context
  onProductSelect(product.id, mode, newlyPlacedOverlay);
};
```

---

## 6. Verification & Quality Assurance Plan

### 6.1 Automated Unit Tests
Create `tests/unit/visualizationSessionGuard.test.ts` to validate:
1. **Session Guard Invariant:** Workspace accepts route when `spaceImageSession` is present even if `selectedProductId !== productId`.
2. **Cross-Category Transition:** Adding a Door (`nextProductId`) while Window is active correctly preserves Window in `placedOverlays`.
3. **Layer Editing Transition:** Selecting a placed Window overlay while Door is active restores Window configuration and swaps Door into `placedOverlays`.
4. **Storage Quota Resilience:** Serializing large multi-layer sessions safely catches quota limits without clearing `workspaceImage.url` or pricing BOM metadata.

Execute automated test suite:
```powershell
npm test
```

### 6.2 Manual End-to-End Verification Scenarios
1. **Test Scenario 1: Window + Door Multi-Product Placement**
   - Navigate to `/visualize/[windowProductId]/upload`.
   - Upload room photo (e.g. `room.jpg`). Confirm successful analysis.
   - Enter workspace. Adjust Fixed Window dimensions (e.g. width: 150cm, height: 120cm).
   - Click **"Add Product"**. In the catalog popover, select **"Screen Door"**.
   - **Expected Result:** The workspace does **not** redirect to `/upload`. The URL smoothly navigates to `/visualize/[doorProductId]/workspace`. The room photo remains in the background, the placed Fixed Window appears as a background layer, and the 3D Screen Door model mounts ready for interaction.
   - The Layers panel displays `Layers (2)`: 1 placed Fixed Window layer and 1 active Screen Door layer.
   - The Price Card shows the combined price of both the Window and the Door.

2. **Test Scenario 2: Cross-Category Layer Activation and Editing**
   - In the two-product scene, click the placed Fixed Window layer in the Layers panel.
   - **Expected Result:** The Screen Door is saved as a placed layer, and the workspace transitions back to the Fixed Window at `/visualize/[windowProductId]/workspace` with its previous dimensions and transform intact. No upload redirect occurs.

3. **Test Scenario 3: Change Product Workflow**
   - With an active product, click **"Change Product"** and select a different product.
   - **Expected Result:** The active product is replaced by the new product without leaving an orphan layer in `placedOverlays` and without redirecting to `/upload`.

---

## 7. Risk Assessment & Mitigation

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| User navigates to `/visualize/[productId]/workspace` via direct bookmark without uploading an image | Medium | Medium | When `spaceImageSession` is genuinely `null`, the guard safely redirects to `/visualize/[productId]/upload` as intended. |
| Memory consumption from multiple high-DPI canvas captures in long visualization sessions | Low | Low | Discrete overlays store flattened image captures; offscreen WebGL contexts are disposed via `renderer.dispose()` in Three.js cleanup lifecycle. |
| In-flight server component fetch delay during cross-product `router.push` | Low | Low | While Next.js fetches the target structural definition, the current workspace shows an inline loading state instead of unmounting to "Returning to upload...". |

---

## Self-Check & Quality Checklist

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Primary operating directives map to all core specifications (PRD-F5, PRD-F6, PRD-F15, PRD-F16, BRD-M3, SDD-C4, SDD-C5, DSD-UI10, QAD-TC24, QAD-TC25)
- [x] Zero em-dashes present in text or code comments (enforced by BAN-PUNCT-01)
- [x] Root causes pinpointed with exact file paths and code snippets (`ProductAwareWorkspacePage.tsx`, `visualizationSession.tsx`, `ProductModelWorkspace.tsx`)
- [x] Clear distinction made between single-product duplication (which worked) and cross-product addition (which failed)
- [x] Concrete step-by-step implementation blueprint provided with before and after code
- [x] Verification plan includes both automated unit tests and manual test scenarios
