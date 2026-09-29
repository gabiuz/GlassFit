# GlassFit — Center Frame / Mullion Repeat Placement Fix

**Status:** Implementation Fix  
**Scope:** Admin product configuration + 3D renderer  
**Issue:** Duplicated center frame/mullion is created, but the new copy spawns near the outer frame instead of being evenly distributed inside the usable window opening.

---

# 1. Problem

Current quantity rules correctly create more than one copy of a component.

Example:

```text
IF Width is at least X
THEN Center Divider -> Number of Copies -> 2
```

However, quantity currently defines only **how many copies exist**. It does not define **where those copies should go**.

Observed result:

```text
CURRENT

+----------------------------------------+
|                 |                |  |  |
|                 |                |  |  |
+----------------------------------------+
                  ^                ^
               original         wrong duplicate
```

Expected result:

```text
EXPECTED

+----------------------------------------+
|           |              |             |
|           |              |             |
+----------------------------------------+
            ^              ^
         divider 1      divider 2
```

---

# 2. Root Cause

Two possible causes must be addressed.

## 2.1 Quantity has no repeat-placement rule

`Number of Copies = 2` tells GlassFit to create two instances, but not:

- whether they should repeat across width or height;
- how spacing is calculated;
- what inner bounds to use;
- where each clone should be anchored.

## 2.2 The GLB may retain its original export offset

A center frame exported from Blender may still contain the position it had inside the complete assembled product.

If GlassFit clones it and then adds a new offset, the result can become:

```text
original GLB position + repeat offset
```

That can push the duplicate toward the right or left frame.

The renderer must use a normalized local transform/anchor for repeatable components.

---

# 3. Required Behavior

Center dividers/mullions must be distributed evenly across the **usable inner opening**, not across total product width.

Required positions:

- 1 copy -> 50%
- 2 copies -> 33.33%, 66.67%
- 3 copies -> 25%, 50%, 75%
- N copies -> evenly divide the opening into `N + 1` sections

The placement must remain correct when the product width changes.

---

# 4. Positioning Formula

Let:

```text
innerLeft  = inside edge of the left frame
innerRight = inside edge of the right frame
innerWidth = innerRight - innerLeft
N          = number of mullions
```

Then:

```text
spacing = innerWidth / (N + 1)
```

For each copy:

```text
x(i) = innerLeft + spacing * i
```

where:

```text
i = 1 ... N
```

Example for `N = 2`:

```text
copy 1 = innerLeft + innerWidth / 3
copy 2 = innerLeft + innerWidth * 2 / 3
```

---

# 5. Use Inner Bounds, Not Total Width

Incorrect:

```text
| outer frame -------------------------------- outer frame |
```

Correct:

```text
|████|-------------------------------|████|
     ^                               ^
 innerLeft                        innerRight

           |              |
       mullion 1       mullion 2
```

This prevents center dividers from overlapping the outer frame.

---

# 6. Add Repeat Placement Behavior

Add a component property such as:

```text
repeat_placement
```

Recommended values:

```text
NONE
EVENLY_ACROSS_WIDTH
EVENLY_ACROSS_HEIGHT
KEEP_TOGETHER
CUSTOM
```

For a center divider:

```text
repeat_placement = EVENLY_ACROSS_WIDTH
```

User-facing label:

> **How should multiple copies be arranged?**

Options:

- Space Evenly Across Width
- Space Evenly Across Height
- Keep Together
- Custom Placement

For center mullions, automatically suggest:

> **Space Evenly Across Width**

---

# 7. Add Part Role

`Part Category = Frame` is not enough to tell GlassFit what a frame component actually does.

Add:

```text
part_role
```

Recommended values:

```text
LEFT_FRAME
RIGHT_FRAME
TOP_FRAME
BOTTOM_FRAME
SILL
CENTER_DIVIDER
RAIL
OTHER_FRAME
GLASS_PANE
PANEL
HARDWARE
GENERAL
```

Admin UI:

**Part Category**

> Frame

**Part Role**

> Center Divider / Mullion

Helper text:

> Choose what this frame part does in the actual product.

When:

```text
Part Category = Frame
Part Role = Center Divider / Mullion
```

GlassFit should auto-suggest:

```text
Repeat Placement = Space Evenly Across Width
```

---

# 8. User-Friendly Rule UI

Current:

```text
WHEN Width >= 1800
THEN Component Center Frame
Set Quantity = 2
```

Recommended:

## Automatic Behavior

**IF**

```text
Width | is at least | 1800 mm
```

**THEN**

```text
Center Divider | Number of Copies | 2
```

Plain-English preview:

> When the width reaches 1800 mm or more, use 2 center dividers. They will be spaced evenly across the window opening.

The owner should not need to enter X coordinates.

---

# 9. Transform Normalization

Recommended renderer sequence:

```text
Load GLB
    ↓
Read component geometry
    ↓
Normalize/compensate for exported assembly offset
    ↓
Establish stable local anchor
    ↓
Apply GlassFit-controlled dimensions
    ↓
Calculate current inner bounds
    ↓
Calculate repeat positions
    ↓
Place each clone
```

Do not use:

```text
original exported world position
+
repeat offset
```

as the final placement logic.

---

# 10. Anchor Strategy

For a vertical mullion, use a consistent anchor such as its local horizontal center.

Conceptually:

```text
targetX = innerLeft + spacing * i
clone.position.x = targetX - localAnchorOffsetX
```

If the GLB origin is already centered correctly:

```text
localAnchorOffsetX = 0
```

Otherwise normalize or compensate for the offset during loading/preparation.

---

# 11. Dynamic Recalculation

Repeat placement must be recalculated whenever any input changes the usable opening or quantity.

At minimum:

- Width
- Left frame thickness
- Right frame thickness
- Mullion quantity

Potentially:

- Panel count
- Frame profile
- Product configuration

Recommended order:

```text
parameter changes
    ↓
evaluate rules
    ↓
resolve quantities
    ↓
resolve outer frame geometry
    ↓
calculate inner bounds
    ↓
distribute repeated components
    ↓
resolve glass/panels
    ↓
render
```

Do not position mullions using stale frame dimensions.

---

# 12. Suggested Data Model Additions

Recommended fields:

| Field | Purpose |
|---|---|
| `part_category` | Frame, Glass, Panel, Hardware, General |
| `part_role` | Center Divider, Left Frame, Sill, etc. |
| `repeat_placement` | How multiple copies are distributed |
| `repeat_axis` | X, Y, or Z if required |
| `anchor_mode` | Which local point is used for placement |

Example center divider:

```text
part_category    = FRAME
part_role        = CENTER_DIVIDER
repeat_placement = EVENLY_ACROSS_WIDTH
repeat_axis      = X
anchor_mode      = CENTER
```

---

# 13. Backward Compatibility

Existing products should continue to work.

Default:

```text
repeat_placement = NONE
```

Only components with:

```text
quantity > 1
```

and a repeat placement should use the new distribution system.

If quantity is greater than 1 but no repeat placement is configured, show:

> **Multiple copies need a placement rule.** Choose how repeated copies of "Center Divider" should be arranged.

Do not silently hard-code an X position.

---

# 14. Validation Workspace

Before activation, the Admin testing workspace must allow the owner to:

1. Change width.
2. Change height.
3. Trigger quantity rules.
4. Inspect repeated components.
5. Verify no overlap with outer frames.
6. Test minimum/default/maximum parameter values.
7. Confirm the final 3D behavior.

Activation should be blocked when repeated components violate valid placement rules.

---

# 15. Acceptance Criteria

## AC-01 — One Divider

Given:

```text
quantity = 1
repeat placement = Space Evenly Across Width
```

When the product renders,

Then the divider is positioned at approximately 50% of the usable inner opening.

## AC-02 — Two Dividers

Given:

```text
quantity = 2
```

Then the divider positions are approximately:

```text
33.33%
66.67%
```

Neither overlaps an outer frame.

## AC-03 — Three Dividers

Given:

```text
quantity = 3
```

Then positions are approximately:

```text
25%
50%
75%
```

## AC-04 — Width Change

Given two center dividers,

When product width changes,

Then both dividers are recalculated and remain evenly distributed.

No divider retains a stale absolute X position.

## AC-05 — Export Offset

Given a center-frame GLB with an original export translation,

When it is repeated,

Then GlassFit normalizes/compensates for that transform and uses GlassFit-calculated placement.

## AC-06 — Quantity Rule Threshold

Given:

```text
Width < 1800 mm -> 1 divider
Width >= 1800 mm -> 2 dividers
```

When width crosses 1800 mm,

Then both resulting divider positions are recalculated.

The original divider must not simply remain at the old center while only the duplicate moves.

## AC-07 — Save/Reload

When the product is saved and reopened,

Then the repeat-placement configuration produces the same geometry.

## AC-08 — Pre-Activation Test

When Admin tests minimum/default/maximum width,

Then all repeated center dividers remain valid before activation is allowed.

---

# 16. Required Test Cases

| Test | Quantity | Width | Expected |
|---|---:|---:|---|
| Default | 1 | Default | Centered |
| Two mullions | 2 | Default | 1/3 and 2/3 |
| Three mullions | 3 | Default | 1/4, 1/2, 3/4 |
| Narrow width | 2 | Minimum | Even spacing; no overlap |
| Wide width | 2 | Maximum | Even spacing |
| Threshold | 1 -> 2 | Rule boundary | Recalculate all copies |
| Save/reload | 2 | Any | Same placement |
| GLB export offset | 2 | Any | No accumulated offset |
| Missing repeat rule | 2 | Any | Admin warning |
| Frame thickness change | 2 | Any | Updated inner bounds |

---

# 17. Implementation Milestones

## Milestone 1 — Reproduce and Inspect

- Reproduce the current duplicate-near-frame bug.
- Log the original GLB transform.
- Log the generated clone transforms.
- Confirm whether the source GLB contains an X translation.

**Exit:** Exact root cause confirmed.

## Milestone 2 — Add Repeat Placement Contract

- Add `part_role`.
- Add `repeat_placement`.
- Add `repeat_axis` if required.
- Default existing products to `NONE`.

**Exit:** Component data can represent repeat behavior.

## Milestone 3 — Normalize Component Transform

- Establish stable local anchor.
- Remove/compensate for unwanted exported assembly offsets.
- Verify a single copy still renders correctly.

**Exit:** GlassFit fully controls procedural clone position.

## Milestone 4 — Implement Even Distribution

Implement:

```text
spacing = innerWidth / (quantity + 1)
```

Place all copies from `1..quantity`.

**Exit:** 1, 2, and 3 center dividers render correctly.

## Milestone 5 — Connect Rule Engine

- Recalculate after quantity changes.
- Recalculate after width/frame-bound changes.
- Ensure current inner bounds are used.

**Exit:** Dynamic resizing works.

## Milestone 6 — Admin UX

Add:

- Part Role
- How should multiple copies be arranged?
- Friendly option labels
- Auto-suggestion for Center Divider / Mullion

**Exit:** Non-technical owner can configure repeated placement without coordinates.

## Milestone 7 — Validation Workspace

- Test min/default/max dimensions.
- Detect overlaps.
- Detect missing repeat behavior.
- Block activation when invalid.

**Exit:** Product can be safely validated before activation.

---

# 18. Definition of Done

The fix is complete when:

- Duplicated center frames no longer spawn near the outer edge.
- Quantity determines how many copies exist.
- Repeat Placement determines where copies go.
- Center dividers use current inner opening bounds.
- 1 divider centers correctly.
- 2 dividers use one-third/two-thirds spacing.
- 3 dividers use quarter spacing.
- Width changes redistribute all copies dynamically.
- GLB export offsets do not corrupt clone placement.
- Save/reload preserves behavior.
- Admin configuration is understandable to non-technical owners.
- Validation catches invalid repeated-component placement before activation.
- Existing non-repeatable components continue working.

---

# 19. Final Rule

> **Quantity determines how many copies exist. Placement Behavior determines where those copies go.**

Do not fix this with hard-coded X positions.

Repeated component positions must always be derived from the product's current usable geometry so the model remains correct when dimensions change.
