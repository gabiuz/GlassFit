# Implementation Specification: Homepage Hero Typography Refactor, Navbar Active State, and Contact Number Update (fix-ui3)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Implementation-ready UI refactoring specification for homepage hero section typography, navigation bar active state, and contact phone number synchronization  
**Version:** 1.2.0  
**Date:** October 1, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation  
**Figma Design Reference:** `https://www.figma.com/design/DsyYt5qsFnNJc3A6Npcgjg/CAPSTONE---Glass-and-Aluminum?node-id=113-304&m=dev` (Node ID: `113:304` - Hero Title)  
**Figma MCP Validation:** Read-only `get_design_context` and `get_metadata` completed October 1, 2026 against file key `DsyYt5qsFnNJc3A6Npcgjg`, node `113:304`  
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F1), `docs/sdd-glassfit.md` (SDD-C1), `docs/dsd-glassfit.md` (Sections 1, 2, and 4), `docs/qad-glassfit.md` (QAD-VG4)  
**Implementation State:** Not started  

---

## 1. Authorized Requirements

This specification outlines three distinct UI polish tasks:

### Requirement 1: Homepage Hero Section Refactor (Figma Node `113:304`)

Refactor the homepage hero section (`src/features/home/components/HeroSection.tsx`) to copy the exact text copy, typography hierarchies, colors, gradients, and component spacings from Figma node `113:304`:

1. **Subheadline (Node `58:973`):**
   - Exact text: `"See the Fit Before Installation"`
   - Typography: Font family `MADE Okine Sans PERSONAL USE`, style `Regular` (font weight 400), line height 1.4 (`leading-[1.4]`), letter spacing -0.532px (`tracking-[-0.532px]`).
   - Color: Gradient from `#097283` (from 6.931%) to `#45c9e3` (`bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] bg-clip-text text-transparent`).
   - Sizing: Target 28px (`text-[28px]`) on desktop, scaling smoothly on mobile and tablet (`text-lg sm:text-xl md:text-2xl xl:text-[28px]`).

2. **Main Headline H1 (Node `61:989`):**
   - Exact text:
     - Line 1: `THE SMARTER`
     - Line 2: `WAY TO FIT`
     - Line 3: `GLASS & ALUMINUM`
   - Typography: Font family `MADE Okine Sans PERSONAL USE`, style `Medium` (font weight 500), line height 1.2 (`leading-[1.2]`), letter spacing -1.615px (`tracking-[-1.615px]`), uppercase.
   - Colors:
     - Lines 1 and 2: Solid dark brand tone `#0f1422` (`text-[#0f1422]`).
     - Line 3: Linear gradient from `#097283` (from 6.931%) to `#45c9e3` (`bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] bg-clip-text text-transparent`).
   - Sizing: Desktop target and maximum 85px (`text-[85px]`), responsive across all breakpoints. The heading must not grow past 85px because 85px is the verified Figma value.

3. **Body Paragraph (Node `61:987`):**
   - Exact text: `"Preview custom fittings on your photo and get accurate estimates in minutes. Built for precise planning, instant quotes, and faster sign-offs."`
   - Typography: Font family `MADE Okine Sans PERSONAL USE`, style `Regular` (font weight 400), line height 1.4 (`leading-[1.4]`), letter spacing -0.456px (`tracking-[-0.456px]`), text color `#0f1422` (`text-[#0f1422]`).
   - Sizing: Figma target 24px (`text-[24px]`) at 1920px and above, scaling responsively on smaller viewports (`text-sm sm:text-base md:text-lg lg:text-xl 4xl:text-[24px]`).

4. **Action Buttons (Node `63:1363`):**
   - Container spacing: 30px gap (`gap-[30px]`, scaling down to `gap-3.5` on mobile).
   - Button 1 ("Start Visualizing"): Variant `lightGradWhiteText` (linear gradient from `#097283` to `#45c9e3`), padding `15px 20px` (`px-[20px] py-[15px]`), border radius 25px (`rounded-[25px]`), text 20px (`text-[20px]`), font weight 400, letter spacing -0.38px (`tracking-[-0.38px]`), right arrow icon.
   - Button 2 ("View Product Catalog"): Variant `blackBtnWhiteText` (background `#0f1422`), padding `15px 20px` (`px-[20px] py-[15px]`), border radius 25px (`rounded-[25px]`), text 20px (`text-[20px]`), font weight 400, letter spacing -0.38px (`tracking-[-0.38px]`).

5. **Door Asset Protection Constraint:**
   - The door graphic asset (`/glass_door.svg`) MUST NOT be resized, cropped, or scaled down. All existing width, height, and negative bottom offset classes (`xl:w-167.5 xl:h-236.5 xl:-bottom-22 2xl:w-192.5 2xl:h-272 2xl:-bottom-30 5xl:w-280! 5xl:h-395! 5xl:-bottom-44! right-0 z-30`) remain strictly intact.
   - The hero text layout container must adapt dynamically to available horizontal space so that zero text overlaps or collides with the door asset across all viewport widths.
   - At every viewport where the door is visible, the rendered text column right edge must be at least 20px left of the rendered door bounding box.

### Figma MCP Source-of-Truth Record

The implementation must use Figma MCP on the exact URL above before editing. The October 1, 2026 read-only inspection established this baseline:

| Figma Node | Verified Property | Verified Value |
|---|---|---|
| `113:304` | Text composition frame | 777px wide by 549px high |
| `58:973` | Subheadline | 28px, weight 400, line height 1.4, letter spacing -0.532px |
| `61:989` | H1 | 85px, weight 500, line height 1.2, letter spacing -1.615px, uppercase |
| `57:901` | First two H1 lines | 661px wide by 204px high |
| `58:906` | Gradient H1 line | 777px wide by 102px high, no wrapping |
| `61:987` | Body | 777px wide by 68px high, 24px, weight 400, line height 1.4, letter spacing -0.456px |
| `61:991` | Vertical content gap | 34px |
| `61:990` | Subheadline-to-H1 gap | 10px |
| `63:1363` | Button row | 486px wide by 58px high with a 30px gap |
| `1532:7606` | Primary button | 216px wide by 58px high; 17px by 16px visible arrow |
| `77:250` | Secondary button | 240px wide by 58px high |

Figma-generated absolute positioning is reference evidence only. Implementation must translate it into the repository's responsive Tailwind layout. The temporary Figma image URL must not be downloaded or used. Existing `/glass_door.svg`, `/right_arrow.svg`, shared `Button`, gradients, and color tokens remain the implementation assets.

### Requirement 2: Navbar Active Link State Polish (`src/components/ui/Navbar.tsx`)

1. **Active Text Weight:**
   - Make the active link text bold (`font-bold`, font weight 700) instead of the default normal weight.
   - Apply consistently across both desktop nav links and mobile nav drawer items.

2. **Underline Spacing:**
   - Increase vertical spacing between the active link text and the animated indicator underline bar beneath it.
   - Adjust the underline positioning from `-bottom-1` (-4px) to `-bottom-2.5` (-10px) to provide clear visual separation and eliminate cramped aesthetics.

### Requirement 3: Contact Phone Number Replacement (Header & Footer)

Replace the placeholder phone numbers across the header info utility bars and footer with the official contact number: **`0918-601-4737`**.

1. **Footer (`src/components/ui/Footer.tsx`):**
   - Replace `Contact Number: +639 6767 676` with `Contact Number: 0918-601-4737`.
2. **Homepage Hero Top Info Bar (`src/features/home/components/HeroSection.tsx`):**
   - Replace placeholder label `"+639 0676 676"` with `"0918-601-4737"`.
3. **Site-Wide Header Top Info Bars (Consistency Audit):**
   - Synchronize the phone number entry in shared background headers (`src/components/shared/BackgroundNavbar.tsx`) and related hero components (`src/features/product/components/HeroSection.tsx`, `src/features/visualization/components/HeroSection.tsx`, `src/features/profile/components/ProfileHero.tsx`, `src/features/terms/components/HeroSection.tsx`, `src/features/privacy/components/HeroSection.tsx`, `src/features/my-requests/components/MyRequestsPage.tsx`) to `"0918-601-4737"` so that no legacy placeholder `676` instances remain on any route.

---

## 2. Problem Statement & Root Cause Analysis

### Defect 1: Divergence from Approved Figma Typography and Copy

The current implementation of `HeroSection.tsx` uses obsolete copy and styling:
- Subheadline displays as a single green color (`text-green`) instead of the multi-stop brand gradient (`bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] bg-clip-text text-transparent`).
- Body text renders outdated placeholder prose: `"A smarter way to preview customized fittings using your actual space photo"` rather than Figma's approved copy: `"Preview custom fittings on your photo and get accurate estimates in minutes. Built for precise planning, instant quotes, and faster sign-offs."`

### Defect 2: Text Sizing vs Door Asset Collision at Desktop Viewports

In commit `080c84c`, an ad-hoc fix was introduced to avoid text overlapping the door asset by capping container width to `xl:max-w-[480px]` and shrinking H1 text down to `xl:text-[38px] 2xl:text-[42px]`.
- At 1280px (`xl`), the door asset occupies the right 670px of the viewport (`right-0`, width 670px). Left padding is 108px (`lg:pl-27`). This leaves 502px of horizontal clearance.
- At 1440px (`2xl`), the door asset occupies 770px (`2xl:w-192.5`). Left padding is 108px. This leaves 562px of horizontal clearance.
- At 1920px (`4xl`), the door asset occupies 770px, and left padding is 144px (`4xl:pl-36`). This leaves 1006px of horizontal clearance.
- Setting a static 85px font size at 1280px without responsive container scaling would cause the headline ("GLASS & ALUMINUM" at 85px is ~750px wide) to collide with the door asset. Conversely, reducing the headline across all desktop sizes ignores the Figma target of 85px on wide displays.
- Resolution: Preserve the door dimensions unconditionally. Use the specified continuous desktop clamp and breakpoint-specific content caps so the headline reaches 85px at 1920px, never exceeds that Figma value, and can be verified against a 20px minimum clearance rule.

### Defect 3: Navbar Active Link State Lacks Contrast and Breathing Room

In `src/components/ui/Navbar.tsx`:
- Desktop navigation links use `isActive ? "text-green" : ""` without font-weight distinction.
- The underline indicator is anchored at `-bottom-1` (-4px), which places the line directly against the text descent line, producing visual crowding.
- Mobile navigation drawer links also omit weight contrast for the active page.

### Defect 4: Obsolete Contact Phone Number Placeholders

Both the top utility bar and footer render placeholder contact numbers containing `676`:
- `HeroSection.tsx` and top info bars render `+639 0676 676`.
- `Footer.tsx` renders `+639 6767 676`.
Both entries must be replaced with the confirmed business phone number `0918-601-4737`.

---

## 3. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Relevance to This Task |
|---|---|---|
| BRD-M4 | High System Usability & Spatial Confidence | Requires a clear, responsive public experience for mobile and desktop customers |
| PRD-F1 | Public Product Catalog & 2D Inspection | Provides the public discovery journey reached from the homepage hero and navbar |
| SDD-C1 | Public Catalog & 3D Inspector | Owns the public-facing catalog entry path and presentation boundary |
| DSD Sections 1, 2, and 4 | Visual tokens, responsive grid, and accessibility | Supplies the existing color, typography, breakpoint, responsiveness, and inclusion constraints without mislabeling `DSD-UI1`, which is `PublicProductCard` |
| QAD-VG4 | Accessibility & Visual Standards | Guarantees WCAG 2.1 Level AA color contrast and legible typographic scale |
| FIX-UI3-V1 through FIX-UI3-V6 | Plan-local verification cases | Cover hero fidelity, collision clearance, door invariance, navbar state, phone synchronization, and repository health without mislabeling `QAD-TC1`, which tests catalog filtering |
| BAN-UI-09 | No foreign or ad-hoc styling | Strictly reuses repository Tailwind tokens, colors, and button components |
| BAN-PUNCT-01 | No em-dashes | Enforces standard hyphens, colons, and parentheses across all documentation |
| BAN-TYPE-05 | No `any` in TypeScript | Preserves strict type safety across all modified components |

---

## 4. Architectural Scope & Boundaries

### 4.1 In Scope

| Directory / File | Architectural Layer | Planned Modification |
|---|---|---|
| `src/features/home/components/HeroSection.tsx` | Presentation (Home Feature) | 1. Update subheadline copy, typography (28px target), and brand gradient.<br>2. Update H1 copy, casing, line breaks, colors, and responsive scaling up to 85px.<br>3. Update body text copy and 24px responsive scale.<br>4. Update button container gap to 30px.<br>5. Structure content container width so text never overlaps the door asset without resizing the door.<br>6. Update top bar phone number from placeholder `+639 0676 676` to `0918-601-4737`. |
| `src/app/layout.tsx` | Next.js Root Layout / Typography | Expose the existing MADE Okine local font through a CSS variable so the homepage hero can explicitly select the verified Figma font without changing the font used by the rest of the application. |
| `src/components/ui/Navbar.tsx` | Presentation (Shared Shell) | 1. Update active desktop nav link text to `font-bold`.<br>2. Increase underline spacing from `-bottom-1` to `-bottom-2.5`.<br>3. Update active mobile nav link text to `font-bold`. |
| `src/components/ui/Footer.tsx` | Presentation (Shared Shell) | Update contact phone number display from placeholder `+639 6767 676` to `0918-601-4737`. |
| `src/components/shared/BackgroundNavbar.tsx` and related hero headers | Presentation (Shared Shell & Features) | Update phone label in `navbarIcons` array to `0918-601-4737` for site-wide consistency. |

### 4.2 Out of Scope

| Component / Layer | Rationale |
|---|---|
| `/public/glass_door.svg` and door CSS sizing | Explicit user constraint: do not resize the door asset (`xl:w-167.5`, `2xl:w-192.5`, `5xl:w-280!`). |
| New Figma-exported raster or vector assets | The request concerns hero text and sizing. Existing repository door and arrow assets remain canonical. |
| `/public/hero_video.mp4` and hero background | Video background and white overlay remain untouched. |
| Other homepage sections (`DetailSection`, `ExploreSection`, etc.) | No modifications required outside hero section, navbar, and footer. |
| Backend services (`fastapi-service/`, Supabase) | Strictly front-end UI presentation refactoring. |

---

## 5. Technical Implementation Contract

### 5.1 Hero Section Specification (`src/features/home/components/HeroSection.tsx`)

#### A. Geometry & Collision Avoidance Formula

To ensure zero collision between text and the door asset without resizing the door, the text container width is governed by the door's physical footprint:

| Viewport Range | Door Status | Door Width Footprint | Left Margin / Padding | Available Text Clearance | H1 Headline Font Size | H1 Line Height |
|---|---|---|---|---|---|---|
| Mobile (<640px) | Hidden | 0px | 24px (`px-6`) | 100% of container | `text-[28px] xs:text-[32px] sm:text-4xl` | `leading-[1.15]` |
| Tablet (640px to 1023px) | Hidden | 0px | 64px (`md:pl-16`) | 100% of container | `md:text-5xl lg:text-6xl` | `leading-[1.15]` |
| Laptop (1024px to 1279px) | Hidden | 0px | 108px (`lg:pl-27`) | 100% of container | `lg:text-[64px]` | `leading-[1.15]` |
| Standard Desktop (1280px to 1439px) | Visible | 670px (`xl:w-167.5`) | 108px (`lg:pl-27`) | 502px geometric clearance; cap content at 480px to retain at least 22px | Fluid desktop scale begins at 46px | `leading-[1.2]` |
| Large Desktop (1440px to 1679px) | Visible | 770px (`2xl:w-192.5`) | 108px (`lg:pl-27`) | 562px geometric clearance; cap content at 540px to retain at least 22px | Fluid scale is approximately 56px at 1440px | `leading-[1.2]` |
| Extra Large (1680px to 1919px) | Visible | 770px (`2xl:w-192.5`) | 108px (`lg:pl-27`) | 802px geometric clearance; cap content at 700px | Fluid scale is approximately 70px at 1680px | `leading-[1.2]` |
| Full HD (1920px to 2399px) | Visible | 770px | 144px (`4xl:pl-36`) | 1006px geometric clearance; cap content at the Figma width of 777px | 85px, capped at the Figma target | `leading-[1.2]` |
| QHD and Beyond (2400px+) | Visible | 1120px (`5xl:w-280!`) | 192px (`5xl:pl-48!`) | At least 1088px geometric clearance at 2400px; retain the 777px Figma content cap | 85px, no additional scaling | `leading-[1.2]` |

Desktop H1 scaling must use one continuous rule from 1280px through 1920px: `xl:text-[clamp(46px,calc(6.09375vw-32px),85px)]`. This avoids unnecessary type jumps at the intermediate custom breakpoints while preserving the exact 85px Figma maximum. The content caps are `xl:max-w-[480px] 2xl:max-w-[540px] 3xl:max-w-[700px] 4xl:max-w-[777px]` and remain 777px at `5xl` and above.

#### B. Font Binding Contract

`src/app/layout.tsx` currently places both the MADE Okine generated class and the Inter generated class on `<html>`, with Inter listed last. The implementation must not assume MADE Okine wins that cascade. Add `variable: "--font-made-okine"` to the existing MADE Okine `localFont` definition, place `myFont.variable` on `<html>`, and explicitly apply `font-[family-name:var(--font-made-okine)]` to the hero content container. Keep `inter.className` and all non-hero typography behavior unchanged.

#### C. Component Markup Blueprint

```tsx
// Top info bar icons data:
const navbarIcons = [
  {
    key: "location",
    src: "/navbar_icons/location.svg",
    label: "Bicutan, Parañaque",
  },
  {
    key: "phone",
    src: "/navbar_icons/phone.svg",
    label: "0918-601-4737",
  },
  {
    key: "clock",
    src: "/navbar_icons/clock.svg",
    label: "Monday - Friday, 6:00AM - 7:00PM",
  },
];
```

```tsx
<div className="relative z-10">
  <div className="px-6 pt-32 pb-12 flex justify-start items-start md:pl-16 md:pt-48 lg:pl-27 lg:pt-57 lg:pb-0 4xl:pl-36 4xl:pt-64 5xl:pl-48! 5xl:pt-72!">
    <div className="flex w-full max-w-full flex-col gap-6 font-[family-name:var(--font-made-okine)] xl:max-w-[480px] xl:gap-7 2xl:max-w-[540px] 3xl:max-w-[700px] 4xl:max-w-[777px] 4xl:gap-[34px]">
      
      {/* Subheadline and Main Title */}
      <div className="flex flex-col gap-2 4xl:gap-[10px]">
        {/* Figma Node 58:973 */}
        <p className="bg-clip-text bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] text-transparent text-lg sm:text-xl md:text-2xl xl:text-[28px] font-normal leading-[1.4] tracking-[-0.532px]">
          See the Fit Before Installation
        </p>
        
        {/* Figma Node 61:989 */}
        <h1 className="text-[28px] xs:text-[32px] sm:text-4xl md:text-5xl lg:text-[64px] xl:text-[clamp(46px,calc(6.09375vw-32px),85px)] text-[#0f1422] font-medium uppercase leading-[1.2] tracking-[-1.615px]">
          The Smarter
          <br />
          Way to Fit
          <br />
          <span className="whitespace-nowrap bg-clip-text bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] text-transparent">
            Glass &amp; Aluminum
          </span>
        </h1>
      </div>

      {/* Body Paragraph - Figma Node 61:987 */}
      <div>
        <p className="w-full text-[#0f1422] text-sm sm:text-base md:text-lg lg:text-xl 4xl:text-[24px] font-normal leading-[1.4] tracking-[-0.456px]">
          Preview custom fittings on your photo and get accurate estimates in minutes. Built for precise planning, instant quotes, and faster sign-offs.
        </p>
      </div>

      {/* Buttons Container - Figma Node 63:1363 */}
      <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-5 4xl:gap-[30px] items-stretch sm:items-center">
        <Link href="/visualization" className="w-full sm:w-auto">
          <Button
            variant="lightGradWhiteText"
            value="Start Visualizing"
            leftIcon={null}
            rightIcon={
              <Image
                src="/right_arrow.svg"
                width={17}
                height={16}
                alt=""
                className="w-[17px] h-[16px] 4xl:w-5 4xl:h-5"
              />
            }
            className="w-full sm:w-auto justify-center rounded-[25px]! px-[20px]! py-[15px]! text-[18px]! xl:text-[20px]! tracking-[-0.38px]"
          />
        </Link>
        <Link href="/product" className="w-full sm:w-auto">
          <Button
            variant="blackBtnWhiteText"
            value="View Product Catalog"
            leftIcon={null}
            rightIcon={null}
            className="w-full sm:w-auto justify-center rounded-[25px]! px-[20px]! py-[15px]! text-[18px]! xl:text-[20px]! tracking-[-0.38px]"
          />
        </Link>
      </div>

    </div>
  </div>
</div>
```

---

### 5.2 Navbar Active State Specification (`src/components/ui/Navbar.tsx`)

#### A. Desktop Navigation Links

```tsx
<motion.span
  key={label}
  initial="rest"
  animate={isActive ? "active" : "rest"}
  whileHover="hover"
  className="relative inline-flex items-center shrink-0"
>
  <Link
    href={href}
    className={`text-base xl:text-lg leading-4 whitespace-nowrap navbar-link flex hover:text-green transition-colors ${
      isActive ? "text-green font-bold" : "text-[#0f1422] font-normal"
    }`}
    aria-current={isActive ? "page" : undefined}
  >
    {label}
  </Link>
  <motion.span
    className="pointer-events-none absolute left-1/2 -bottom-2.5 h-0.5 -translate-x-1/2 rounded-full"
    variants={{
      rest: { width: "12px", backgroundColor: "var(--color-black)" },
      hover: { width: "100%", backgroundColor: "var(--color-green)" },
      active: { width: "100%", backgroundColor: "var(--color-green)" },
    }}
    transition={{ duration: 0.25, ease: "easeOut" }}
  />
</motion.span>
```

Key changes:
1. `isActive ? "text-green font-bold" : "text-[#0f1422] font-normal"` adds explicit bold font weight (weight 700) to the active link text.
2. Animated underline indicator `className` is adjusted from `-bottom-1` (-4px) to `-bottom-2.5` (-10px). This introduces 6px of additional vertical breathing room between text descenders and the active bar.

#### B. Mobile Navigation Drawer Links

```tsx
<Link
  key={label}
  href={href}
  onClick={() => setIsOpen(false)}
  className={`text-lg py-1 transition-colors ${
    isActive ? "text-green font-bold" : "text-black hover:text-green font-normal"
  }`}
  aria-current={isActive ? "page" : undefined}
>
  {label}
</Link>
```

Key changes:
1. `isActive ? "text-green font-bold" : "text-black hover:text-green font-normal"` ensures active state text is bold in the mobile menu.

---

### 5.3 Contact Number Specification (`Footer.tsx` & Shared Headers)

#### A. Footer (`src/components/ui/Footer.tsx`)

```tsx
<div className="text-[#3a3a3a] text-lg font-normal leading-7">
  <p className="hidden md:block">Bicutan, Paranaque</p>
  <br className="hidden md:block" />
  <div>
    <p className="">Contact Number: 0918-601-4737</p>
    <p className="">Email: glassfit@gmail.com</p>
  </div>
</div>
```

#### B. Shared Background Headers (`src/components/shared/BackgroundNavbar.tsx`) & Feature Heroes

Update the phone entry in `navbarIcons` from `+639 0676 676` to `0918-601-4737`:

```tsx
const navbarIcons = [
  {
    key: "location",
    src: "/navbar_icons/location.svg",
    label: "Bicutan, Parañaque",
  },
  {
    key: "phone",
    src: "/navbar_icons/phone.svg",
    label: "0918-601-4737",
  },
  {
    key: "clock",
    src: "/navbar_icons/clock.svg",
    label: "Monday - Friday, 6:00AM - 7:00PM",
  },
];
```

Files targeted for consistency:
- `src/components/shared/BackgroundNavbar.tsx`
- `src/features/home/components/HeroSection.tsx`
- `src/features/product/components/HeroSection.tsx`
- `src/features/visualization/components/HeroSection.tsx`
- `src/features/profile/components/ProfileHero.tsx`
- `src/features/terms/components/HeroSection.tsx`
- `src/features/privacy/components/HeroSection.tsx`
- `src/features/my-requests/components/MyRequestsPage.tsx`

### 5.4 Implementation Sequence

1. Read `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` before changing `next/font/local`; use the documented CSS-variable method.
2. Revalidate Figma node `113:304` with `get_design_context` and `get_metadata`, including its screenshot. Stop and reconcile this document if the source changed.
3. Expose the existing MADE Okine font as `--font-made-okine` in `src/app/layout.tsx` without changing the rest of the application's effective Inter typography.
4. Refactor only the hero content block in `src/features/home/components/HeroSection.tsx`. Preserve the video, overlay, white floor shape, door JSX, door classes, intrinsic dimensions, positioning, and stacking order byte-for-byte.
5. Apply the active desktop and mobile nav weight changes and desktop underline offset in `src/components/ui/Navbar.tsx`. Preserve route matching, animation variants, and `aria-current` behavior.
6. Replace the phone placeholders in the exact eight header or hero files listed above and in `src/components/ui/Footer.tsx`.
7. Run the source scans, Figma fidelity checks, viewport matrix, navbar checks, contact checks, accessibility gate, lint, typecheck, tests, and production build in Section 6.
8. Review the final diff to confirm no application behavior, backend code, dependency, asset, or door sizing change entered scope.

---

## 6. Acceptance & Verification Matrix

### 6.1 Viewport Verification Criteria

| Target Breakpoint | Viewport Width | Door Asset Visibility | Expected Text Clearance | Expected Heading Size | Verification Goal |
|---|---|---|---|---|---|
| Mobile Compact | 375px | Hidden | 100% (minus 48px padding) | 28px - 32px | Clean vertical stack, no horizontal scrolling (`scrollWidth <= clientWidth`). |
| Mobile Landscape | 480px | Hidden | 100% (minus 48px padding) | 32px | Subheadline and title wrap naturally. |
| Small Tablet | 640px | Hidden | 100% (minus 48px padding) | 36px | Buttons align in row layout or stack cleanly. |
| Tablet Portrait | 768px | Hidden | 100% (minus 128px padding) | 48px | Subheadline gradient renders crisply. |
| Laptop / Tablet Land. | 1024px | Hidden | 100% (minus 216px padding) | 64px | Title spans 3 lines without crowding. |
| Standard Desktop | 1280px | Visible (670px width) | 480px content cap | 46px | Content right edge is at least 20px before the door boundary. |
| Intermediate Desktop | 1320px and 1366px | Visible (670px width) | 480px content cap | Fluid clamp result | Explicit regression widths for the original collision risk. |
| Large Desktop | 1440px | Visible (770px width) | 540px content cap | Approximately 56px | Content right edge is at least 20px before the door boundary. |
| Extra Large Desktop | 1680px | Visible (770px width) | 700px content cap | Approximately 70px | Heading expands continuously toward target scale. |
| Full HD / 1080p | 1920px | Visible (770px width) | 777px Figma content width | 85px | Matches node `113:304`: 85px H1, 28px subheadline, 24px body, 34px vertical gap, and 30px button gap. |
| QHD / 2K | 2560px | Visible (1120px width) | 777px Figma content width | 85px | Preserves the Figma maximum and door clearance without ultra-wide type inflation. |

At every visible-door viewport, record `contentRect.right`, `doorRect.left`, and `doorRect.width` from the rendered DOM. Pass only when `contentRect.right <= doorRect.left - 20`. Door width must remain 670px at `xl`, 770px at `2xl` through `4xl`, and 1120px at `5xl` and above. Also verify that the door class string, intrinsic `width={2000}`, intrinsic `height={1125}`, `right-0`, and negative bottom offsets are unchanged in the diff.

### 6.2 Navbar Visual Polish Criteria

1. On navigating to `/` (Home), `/product` (Product Catalog), or `/visualization` (Workspace), the matching desktop nav link renders in bold weight (`font-bold`, weight 700) with green text color (`text-green`).
2. Inactive desktop nav links render with normal font weight (`font-normal`, weight 400).
3. The desktop animated underline indicator rests at `-bottom-2.5` (-10px), providing distinct vertical clearance below the text baseline without overlapping subsequent page elements.
4. On mobile viewports (<1024px), opening the drawer menu shows the active page label in bold green text.
5. Inactive mobile drawer links remain normal weight (`font-normal`).

### 6.3 Contact Number Criteria

1. `Footer.tsx` displays `Contact Number: 0918-601-4737` on all rendered pages.
2. Top header utility bar displays `0918-601-4737` alongside the phone icon across all pages containing the header info bar.
3. No instances of placeholder strings `0676` or `6767` remain in UI presentation files.

### 6.4 Figma Fidelity and Asset Verification

1. Re-run Figma MCP `get_design_context` and `get_metadata` for file key `DsyYt5qsFnNJc3A6Npcgjg`, node `113:304`, immediately before implementation.
2. Compare the returned copy and measurements with the source-of-truth table in this document. If the Figma node changed, update and re-approve this plan before coding instead of silently mixing revisions.
3. At 1920px, verify computed font family resolves to MADE Okine, H1 is 85px/1.2/500, subheadline is 28px/1.4/400, body is 24px/1.4/400, content width is 777px, title gap is 10px, main vertical gap is 34px, and button gap is 30px.
4. Verify `/glass_door.svg` and `/right_arrow.svg` are the only existing visual assets used for the in-scope hero elements. No temporary Figma asset URL may remain in source.

### 6.5 Verification Case Mapping

| Case | Requirement | Pass Condition |
|---|---|---|
| FIX-UI3-V1 | Figma hero fidelity | Copy, font, sizes, line heights, letter spacing, colors, gradients, widths, and target gaps match the validated node at 1920px. |
| FIX-UI3-V2 | Responsive collision avoidance | All viewport rows above pass with no horizontal overflow and at least 20px text-to-door clearance when the door is visible. |
| FIX-UI3-V3 | Door invariance | Door source, intrinsic dimensions, responsive width and height classes, right anchor, and negative bottom offsets are unchanged. |
| FIX-UI3-V4 | Navbar active state | Desktop and mobile active links are bold; desktop underline is positioned at `-bottom-2.5`; `aria-current="page"` remains correct. |
| FIX-UI3-V5 | Phone synchronization | Every enumerated header utility bar and the footer show `0918-601-4737`; source scan finds no `+639 0676 676` or `+639 6767 676` in `src/`. |
| FIX-UI3-V6 | Regression health | Lint, typecheck, tests, production build, and the applicable accessibility scan pass. |

### 6.6 Repository Health Verification

Upon future execution, run the following automated suite:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Run the existing Axe-based QAD-VG4 accessibility check if its project harness is available. The FastAPI service is untouched, so its health probe is a release smoke check rather than a code-change diagnostic: when the full stack is running, verify `GET http://localhost:8000/health` returns `{"status":"ok"}`.

---

## 7. Risk Assessment & Mitigations

| Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| Text collision on intermediate browser widths (e.g., 1320px to 1400px) | Medium | Medium | Use 480px and 540px content caps, the continuous font clamp, and measured DOMRect clearance at 1280px, 1320px, 1366px, and 1440px. |
| Local font cascade resolves to Inter instead of MADE Okine in the hero | Medium | Medium | Use the documented `next/font/local` CSS-variable method and verify the computed hero font family at 1920px. |
| Bold font weight causes navbar layout shift on route change | Low | Low | Preserve `shrink-0` and `whitespace-nowrap`, then inspect the three route states at desktop widths. |
| Door graphic repositioning on ultra-wide screens | Low | Low | Retain existing Tailwind classes for the door asset without modification (`xl:w-167.5`, `2xl:w-192.5`, `5xl:w-280!`). |
| Inconsistent phone numbers across different pages | Low | Low | Target all top utility bars (`BackgroundNavbar.tsx` and all feature hero files) alongside `Footer.tsx`. |

---

## 8. Readiness Decision

This specification is complete and ready for execution. It provides:
- Exact text copy and typographic values extracted directly from Figma node `113:304`.
- Strict preservation of the door asset dimensions without resizing.
- Measurable layout constraints and an explicit viewport protocol for proving at least 20px of clearance without resizing the door asset.
- Clear font-weight and vertical spacing rules for active navbar link indicators.
- Synchronized contact phone number replacement (`0918-601-4737`) across header and footer.
- Complete traceability and testable verification criteria.

No code modifications have been applied. Implementation remains pending user confirmation.

---

## Self-Check

- [x] Target file is `docs/implementation/fix-ui3.md`
- [x] Follows conventions established in `docs/implementation/fix-ui1.md` and `docs/implementation/fix-ui2.md`
- [x] Traceability maps to BRD-M4, PRD-F1, SDD-C1, DSD Sections 1, 2, and 4, QAD-VG4, and plan-local FIX-UI3 verification cases without mislabeling DSD-UI1 or QAD-TC1
- [x] Figma design reference is included with URL: `https://www.figma.com/design/DsyYt5qsFnNJc3A6Npcgjg/CAPSTONE---Glass-and-Aluminum?node-id=113-304&m=dev`
- [x] Figma MCP design context and metadata validate exact copy, 777px content width, typography, 34px and 10px vertical gaps, 30px button gap, and button geometry
- [x] Door asset resizing is explicitly prohibited and preserved
- [x] Responsive layout strategy defines a continuous type clamp, breakpoint content caps, and a DOMRect-based 20px clearance test
- [x] Active navbar state bold font weight and increased underline gap are fully specified
- [x] Header and footer phone number replacement from placeholder 676 to `0918-601-4737` is fully specified
- [x] Hard bans enforced: zero em-dashes (BAN-PUNCT-01), zero `any` (BAN-TYPE-05), zero foreign styles (BAN-UI-09), zero box diagrams (BAN-DIAG-03)
- [x] Status set to `Ready for Implementation`
- [x] No application code was modified; implementation was not executed
