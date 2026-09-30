# Implementation Specification: Product Catalog Two-Column Mobile Grid (fix-ui2)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Implementation-ready UI refactoring specification for the public product catalog  
**Version:** 1.1.0  
**Date:** September 30, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation  
**Upstream Specifications:** `docs/prd-glassfit.md` (PRD-F1 and US-01), `docs/sdd-glassfit.md` (SDD-C1), `docs/dsd-glassfit.md` (DSD-UI1), `docs/qad-glassfit.md` (QAD-TC1 and QAD-VG4)  
**Implementation State:** Not started

---

## 1. Authorized Requirement

Refactor the public product catalog UI so compact mobile viewports display two product cards per row instead of one.

For this specification, "mobile" means the repository's `Mobile Compact` range from 320px through 639px. The existing responsive behavior at 640px and above remains unchanged:

| Viewport range | Required catalog columns |
|---|---:|
| 320px to 639px | 2 |
| 640px to 1023px | 2 |
| 1024px to 1279px | 3 |
| 1280px to 1439px | 2, alongside the desktop filter sidebar |
| 1440px and above | 3, alongside the desktop filter sidebar |

The DSD mobile layout table describes the page's major regions as a single vertical stack. This change is a nested component refinement: the search, filters, and catalog remain vertically stacked, while the product-card collection inside the catalog uses two columns.

---

## 2. Problem Statement

`ProductSectionContent` currently applies `grid-cols-1` as the base grid class. Consequently, `/product` renders one product card per row below the 640px `sm` breakpoint. Changing only that class would technically create two tracks, but the current accumulated horizontal padding, fixed image height, generous card spacing, and side-by-side action sizing would make the result cramped on 320px to 390px screens.

The implementation therefore needs one grid change and a limited set of mobile-only presentation adjustments. Product data, filtering behavior, route targets, button labels, pricing logic, and tablet or desktop presentation are not to change.

---

## 3. Traceability

| Traceability code | Requirement relationship |
|---|---|
| BRD-M4 | Improves mobile catalog scanability in support of the system usability target |
| PRD-F1 | Refines the required responsive public product catalog |
| US-01 | Preserves anonymous browsing, active-product rendering, and reactive category filtering |
| SDD-C1 | Changes only the presentation of the existing public catalog filter grid |
| DSD-UI1 | Retains the existing product-card content and visual language in a denser mobile variant |
| QAD-TC1 | Preserves catalog rendering and category-filter behavior |
| QAD-VG4 | Requires the public route to retain WCAG 2.1 Level AA conformance |

---

## 4. Scope

### 4.1 In Scope

| File | Required responsibility |
|---|---|
| `src/app/product/page.tsx` | Use the DSD mobile page margin of 16px so two cards have sufficient horizontal space |
| `src/features/product/components/ProductSection.tsx` | Make the base catalog grid two columns, reduce only the compact-mobile gutter, and remove duplicated compact-mobile horizontal padding |
| `src/features/product/components/ProductCard.tsx` | Make card media, spacing, text overflow, price content, and actions fit the narrower grid tracks without changing their meaning |

### 4.2 Out of Scope

- Product queries, data mapping, sorting, search, category filtering, and filter state
- Product detail, visualization, quotation, and admin workflows
- Database schema, migrations, RLS, FastAPI, and Cloudflare R2 behavior
- New components, new dependencies, new design tokens, and global CSS rules
- Button copy, navigation destinations, pricing copy, or product content
- A redesign of tablet or desktop cards

---

## 5. Implementation Contract

Class ordering may be normalized by the formatter, but the responsive behavior and values below are normative.

### 5.1 Page Container

**File:** `src/app/product/page.tsx`  
**Target:** the wrapper immediately below `HeroSection`

Change only the base horizontal padding from `px-6` to `px-4`, retaining all vertical and breakpoint-specific spacing:

```tsx
<div className="flex flex-col gap-6 xl:gap-14 px-4 sm:px-6 py-8 md:px-12 lg:px-24.25 lg:py-17.75">
```

This produces the DSD-specified 16px compact-mobile page margin. It does not alter padding at `sm`, `md`, or `lg`.

### 5.2 Catalog Section and Grid

**File:** `src/features/product/components/ProductSection.tsx`  
**Target:** the successful product-list branch in `ProductSectionContent`

Use the following section, content, and grid behavior:

```tsx
<section className="px-0 py-4 sm:p-4 md:p-6 lg:p-10 flex flex-col xl:flex-row gap-8 items-start w-full">
  {/* existing filter and content structure */}
  <div className="flex-1 flex flex-col w-full gap-4 sm:gap-8 xl:gap-4">
    {/* existing mobile filter bar and filter chips */}
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-6 w-full sm:w-fit mx-auto xl:mx-0">
      {/* existing ProductCard mapping */}
    </div>
  </div>
</section>
```

Normative details:

1. `grid-cols-2` is the requirement-bearing change.
2. `gap-3 sm:gap-6` uses a 12px compact-mobile catalog gutter and restores the existing 24px gutter at 640px.
3. `w-full sm:w-fit` makes both compact-mobile tracks share the available width. Existing shrink-to-fit behavior returns at 640px.
4. `px-0 py-4 sm:p-4` removes only the duplicated compact-mobile horizontal inset. It preserves the section's existing 16px vertical padding and restores its original full padding at 640px.
5. `gap-4 sm:gap-8 xl:gap-4` compacts the mobile distance between filter controls and results while preserving existing spacing from 640px upward.
6. Error and empty states remain functionally unchanged. Their existing centered presentation does not need a two-column grid.

Expected compact-mobile track widths are calculated from viewport width minus 32px page padding and one 12px gutter:

| Viewport | Available grid width | Approximate track width |
|---:|---:|---:|
| 320px | 288px | 138px |
| 360px | 328px | 158px |
| 375px | 343px | 165.5px |
| 390px | 358px | 173px |
| 430px | 398px | 193px |
| 639px | 607px | 297.5px, with each card still capped by its existing 273px maximum |

### 5.3 Product Card

**File:** `src/features/product/components/ProductCard.tsx`

#### A. Card and Responsive Image

Keep the existing card colors, radius, and shadow. Ensure the card fills a narrow grid track while retaining its existing maximum width:

```tsx
<div className="w-full max-w-68.25 rounded-[10px] bg-white/50 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] flex flex-col justify-between overflow-hidden group">
```

Use a 4:3 media area only below 640px, then restore the current 224px height:

```tsx
<div className="relative w-full aspect-[4/3] sm:aspect-auto sm:h-[224px] overflow-hidden bg-neutral-100">
  <Image
    src={activeSrc}
    alt={`${name} - Image ${currentImgIndex + 1}`}
    fill
    sizes="(max-width: 639px) calc((100vw - 44px) / 2), 273px"
    className="object-cover transition-all duration-300"
    unoptimized={isExternalImage}
  />
</div>
```

The `sizes` value is required because the image uses `fill` and its rendered width becomes responsive. The 44px subtraction represents 32px total page padding plus the 12px grid gutter. This follows the bundled Next.js 16 Image component guidance and prevents the browser from assuming a `100vw` image.

Do not change carousel state, navigation handlers, arrow behavior, pagination behavior, image source selection, or `unoptimized` handling.

#### B. Content Density and Overflow

Use compact-mobile padding and gaps, while restoring current values at 640px:

```tsx
<div className="flex flex-col p-2.5 sm:p-5 gap-2.5 sm:gap-7.5 flex-1 justify-between">
  <div className="flex flex-col gap-1.5 sm:gap-2.5 justify-start items-start w-full">
```

Apply two-line clamping to variable-length title and description content:

```tsx
<h2 className="w-full text-black text-base sm:text-xl font-semibold sm:font-normal leading-snug sm:leading-7 min-h-11 sm:min-h-14 line-clamp-2">
  {name}
</h2>

<div className="w-full">
  <p className="text-black text-sm font-normal leading-5 line-clamp-2">
    {description ?? ""}
  </p>
</div>
```

The mobile title remains 16px and body text remains 14px, matching the DSD typography hierarchy. Do not reduce primary product content to 10px, 11px, or 12px.

Keep the current category text at `text-xs`. Reduce only chip padding and gap below 640px:

```tsx
<div className="flex flex-wrap gap-1 sm:gap-1.25">
  {typeTags.map((tag) => (
    <div
      key={tag}
      className="max-w-full px-1.5 py-0.5 sm:px-2.5 sm:py-1.25 rounded-[20px] border border-[#C3C3C3]"
    >
      <span className="block max-w-full text-black text-xs break-words">{tag}</span>
    </div>
  ))}
</div>
```

#### C. Price Content

Preserve `formatPrice`, the peso value, the "Starting at" label, and the unavailable-price message. Only spacing and responsive presentation may change:

```tsx
<div className="flex flex-col gap-1.5 sm:gap-2.5 justify-start items-start mt-2 sm:mt-4 w-full">
```

The price value must use `text-base sm:text-xl` with `leading-tight sm:leading-7` and remain fully visible. The unavailable-price message and label remain `text-xs`; they may wrap naturally. Price values must not be truncated or line-clamped.

#### D. Actions

Stack actions below 640px and restore their existing row layout at 640px. Retain the exact visible labels "View Product" and "Visualize", their existing routes, colors, and icons.

```tsx
<div className="flex flex-col sm:flex-row gap-2 w-full">
  <Link href={`/product-details/${product.id}`} className="w-full sm:flex-1">
    <Button
      leftIcon={null}
      rightIcon={null}
      variant="greenBtnWhiteText"
      value="View Product"
      className="min-h-11 sm:min-h-0 whitespace-nowrap text-sm! w-full justify-center"
      style={{
        gap: "8px",
        borderRadius: "10px",
        padding: "5px 10px",
        width: "100%",
        justifyContent: "center",
      }}
    />
  </Link>
  <Link href={`/visualize/${product.id}/upload`} className="w-full sm:flex-1">
    <Button
      leftIcon={null}
      rightIcon={
        <Image
          src="/right_arrow.svg"
          width={10}
          height={7.5}
          alt="right arrow"
        />
      }
      variant="blackBtnWhiteText"
      value="Visualize"
      className="min-h-11 sm:min-h-0 whitespace-nowrap text-sm! w-full justify-center"
      style={{
        gap: "8px",
        borderRadius: "10px",
        padding: "5px 10px",
        width: "100%",
        justifyContent: "center",
      }}
    />
  </Link>
</div>
```

Both compact-mobile controls must have a minimum 44px target height. No copy shortening is authorized.

---

## 6. Acceptance Criteria

### 6.1 Required Behavior

1. At every tested width from 320px through 639px, the computed catalog grid has exactly two columns.
2. At 640px, 768px, 1024px, 1280px, and 1440px, column counts match the matrix in Section 1.
3. The page has no horizontal overflow at any tested width. Verify `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
4. Each compact-mobile card remains within its grid track. Images, tags, descriptions, prices, and actions do not clip or overlap.
5. Product names and descriptions render no more than two visible lines. Price values remain complete and readable.
6. "View Product" navigates to `/product-details/[id]`, and "Visualize" navigates to `/visualize/[id]/upload`.
7. Both action labels remain unchanged and both compact-mobile action targets are at least 44px high.
8. Search and category filtering retain the two-column result layout, including odd result counts.
9. Zero-result, no-active-product, and fetch-error states remain readable and centered without horizontal overflow.
10. Tablet and desktop typography, card maximum width, image height, button row layout, filter sidebar behavior, and 24px grid gap remain unchanged.

### 6.2 Manual Viewport Matrix

Verify with actual browser responsive mode at 320px, 360px, 375px, 390px, 430px, 639px, 640px, 768px, 1024px, 1280px, and 1440px. At minimum, use one product with a long name, one long description, a large formatted price, a multiword type, and multiple carousel images.

At each width, record:

- Computed grid column count
- Absence of horizontal overflow
- Card and row alignment
- Complete price rendering
- Button target size and successful navigation
- Search and filter result behavior

### 6.3 Repository Verification

After implementation, execute:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Because no backend behavior changes, the FastAPI service does not need modification. If the full project release gate is being run, also verify `GET http://localhost:8000/health` returns `{"status":"ok"}` as required by the repository lifecycle protocol.

No new test dependency may be added. If the existing repository later provides a browser test harness, encode the column-count and horizontal-overflow checks there. Until then, the viewport matrix is a required manual QAD-TC1 and QAD-VG4 extension for this change.

---

## 7. Risks and Controls

| Risk | Control |
|---|---|
| Narrow 320px tracks cause clipping | Test 320px explicitly; use full-width tracks, compact internal padding, wrapping tags, clamped prose, and stacked actions |
| Responsive images download oversized assets | Add the required `sizes` hint to the existing `fill` image |
| Mobile typography becomes unreadably small | Keep title at 16px, body at 14px, and metadata at 12px in accordance with DSD typography |
| Requirement expands into unrelated redesign | Limit changes to three named files and preserve copy, data, routes, behavior, and design tokens |
| Desktop layout regresses | Restore current values at existing breakpoints and verify every boundary in the viewport matrix |
| Visual checks pass while content cases fail | Test long names, descriptions, prices, multiword types, multiple images, odd counts, and empty or error states |

---

## 8. Readiness Decision

This specification is ready for implementation when used as written. It has:

- An explicit viewport definition and column matrix
- Exact target files and responsive class behavior
- DSD-aligned mobile spacing and typography
- Preserved product copy, routes, data behavior, and desktop behavior
- Next.js 16 responsive image requirements
- Measurable functional, responsive, overflow, and accessibility acceptance criteria
- Required repository verification commands

No application code has been changed by this specification revision.

---

## Self-Check

- [x] Requirement maps to BRD-M4, PRD-F1, US-01, SDD-C1, DSD-UI1, QAD-TC1, and QAD-VG4
- [x] Scope is limited to the public catalog presentation layer
- [x] Mobile is defined as 320px through 639px
- [x] Two columns are required and testable throughout that range
- [x] Existing tablet and desktop behavior is preserved
- [x] Existing copy, routes, data, filtering, and pricing behavior are preserved
- [x] No dependency, schema, API, or backend change is proposed
- [x] No `any`, raw SQL, secrets, foreign UI library, box diagram, or em dash is introduced
- [x] Status is `Ready for Implementation`
- [x] Implementation remains intentionally not started
