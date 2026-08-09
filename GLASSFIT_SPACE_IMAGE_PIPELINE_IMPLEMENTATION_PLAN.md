# GlassFit Space-Image Pipeline Implementation Plan

## 1. Purpose

This plan implements the real GlassFit space-image pipeline starting from the current frontend-only upload flow.

The goal is to preserve the already-tested MVP image-analysis behavior and accuracy while changing the architecture so it is suitable for the full GlassFit project and for low- to mid-range mobile devices.

The implementation must keep the successful MVP behavior as the baseline:

- backend image analysis through FastAPI;
- OpenCV/NumPy image statistics;
- YOLOv8 segmentation using the existing `yolov8s-seg.pt`;
- existing brightness / ambient-light analysis;
- existing scene/depth behavior where currently used;
- existing segmentation filtering and mask quality;
- temporary rather than permanent processing artifacts.

At this stage, the space image and image-analysis state are **not stored in Supabase**.

The pipeline is session-only until the customer later finalizes a visualization.

---

# 2. Current Project State

Currently implemented in the main GlassFit application:

- frontend;
- registration/login;
- Supabase-backed product catalog;
- `products` + `product_assets` catalog integration;
- Cloudflare R2 public product assets;
- product-details 2D preview;
- product-details interactive whole-product 3D preview.

For the space-image workflow, only the frontend upload/UI currently exists.

The following FastAPI files have already been copied from the validated MVP into the GlassFit repository:

```text
fastapi-service/
├── brightness.py
├── depth.py
├── main.py
├── requirements.txt
├── scene_detection.py
├── segmentation.py
└── yolov8s-seg.pt
```

These files are the starting point.

They should **not be rewritten from scratch**.

The first implementation rule is to preserve the algorithms, model weights, thresholds, and output behavior that already produced satisfactory results.

---

# 3. Final Pipeline

```text
USER SELECTS SPACE IMAGE
        ↓
FRONTEND GUARD RAILS
        ↓
Immediate local preview
        ↓
POST original image to FastAPI
        ↓
FASTAPI GUARD RAILS
        ↓
Decode / prepare image
        ↓
┌────────────────────────────────────────────┐
│ Preserve existing tested analysis path    │
│                                            │
│ brightness / lighting                     │
│ scene detection                           │
│ depth logic, if currently used            │
│ YOLOv8 segmentation                       │
└────────────────────────────────────────────┘
        ↓
Create optimized workspace image
        ↓
Return:
- workspace image URL
- workspace dimensions
- existing analysis values
- detected objects
- temporary mask URLs
- warnings
        ↓
BROWSER SESSION STATE
        ↓
Workspace image + analysis + masks
        ↓
Future Three.js / Canvas visualization
        ↓
Final visualization
        ↓
Permanent persistence only when customer proceeds
```

---

# 4. Core Architecture Rules

## 4.1 Heavy image work stays on FastAPI

The customer's device should not perform:

- YOLO inference;
- OpenCV analysis;
- depth estimation;
- scene detection;
- large-image normalization;
- mask generation.

These remain backend responsibilities.

The browser should receive already-prepared information and perform only the interaction that must happen locally.

## 4.2 FastAPI analysis remains session-only

Do not insert temporary data such as these into Supabase:

```text
brightness
ambient color
contrast
saturation
noise
sharpness
light direction
detected objects
segmentation masks
depth data
scene-detection data
local realism values
overlay realism settings
```

The FastAPI response is stored in frontend session state and passed directly to the visualization components.

Supabase remains for persistent GlassFit business records.

## 4.3 Do not permanently upload the original room image

During the active visualization session:

```text
original customer image
→ browser + temporary FastAPI processing only
```

The original customer room photo does not need a permanent Supabase or R2 record.

Later, when the customer finalizes the visualization:

```text
final composed visualization
→ permanent R2
→ visualization_snapshots
```

The original source photo can still remain temporary.

## 4.4 Preserve the current analysis algorithms

The first production integration should change the **orchestration around the existing analysis**, not the algorithms that were already tested.

In particular:

- keep `yolov8s-seg.pt`;
- keep the current YOLO confidence/IoU/image-size settings unless validation proves a change is needed;
- keep the current segmentation class filtering;
- keep current brightness/ambient calculations;
- keep existing depth and scene-detection behavior if they are part of the current successful result;
- keep current fallback behavior where applicable.

Do not optimize by changing inference resolution, thresholds, or algorithms until a before/after accuracy test is completed.

---

# 5. Critical Accuracy-Preservation Decision

The normalized workspace image must **not initially replace the image used by the tested analysis pipeline**.

For the first implementation:

```text
Original/oriented image
        ↓
Existing analysis functions
        ↓
Same analysis behavior as MVP
```

Separately:

```text
Original/oriented image
        ↓
Workspace normalization
        ↓
1920px-class browser image
```

This means image normalization reduces client load without silently changing the tested analysis accuracy.

Only after the new pipeline has been validated may individual analysis functions be tested against normalized input as an optimization.

---

# 6. Image Resolution Strategy

The system uses three conceptual image resolutions.

## 6.1 Original upload

Example:

```text
4032 × 3024
```

Used as the input received from the customer.

It is not kept as a full-resolution browser canvas.

## 6.2 Analysis resolution

The existing FastAPI modules continue to use the input resolution or their own existing internal processing resolution.

Do not change their tested behavior in the first pass.

For example, if YOLO currently performs inference at:

```text
YOLO_IMAGE_SIZE=1024
```

keep it.

## 6.3 Workspace resolution

The browser receives an optimized visualization image.

Initial rule:

```text
if longest edge <= 1920px:
    do not upscale

if longest edge > 1920px:
    resize proportionally so longest edge = 1920px
```

Examples:

```text
4032 × 3024
→
1920 × 1440
```

```text
4000 × 2250
→
1920 × 1080
```

```text
1600 × 1200
→
1600 × 1200
```

The 1920px value is the initial engineering target.

It must later be benchmarked against:

```text
1600
1920
2560
```

on at least one real mid-range mobile device.

---

# 7. Workspace Image Quality

Normalization must prioritize reducing memory rather than visibly reducing quality.

Recommended first implementation:

```text
Format: WebP
Longest edge: maximum 1920px
Quality: ~90
Resize filter: high-quality/Lanczos
Aspect ratio: preserved
Upscaling: never
```

The implementation should avoid:

- low-quality JPEG compression;
- arbitrary brightness changes;
- color correction that changes the scene;
- aggressive sharpening;
- aggressive denoising;
- artificial blur.

The workspace image must remain visually close to the original.

### Optional color-profile preservation

If the preparation library exposes an ICC profile, retain it when practical.

This is secondary to the first implementation but should not be deliberately stripped if it can be preserved safely.

---

# 8. Existing FastAPI File Strategy

## 8.1 `main.py`

Keep `main.py` as the application/orchestration layer.

Its responsibility should become:

```text
receive upload
→ validate upload
→ create temporary session
→ save/decode temporary image
→ call existing analysis modules
→ create workspace image
→ coordinate segmentation/masks
→ return unified response
→ delete original temporary upload when no longer needed
```

`main.py` should not absorb the algorithms from the other modules.

## 8.2 `brightness.py`

Preserve the current tested calculations.

The MVP version is responsible for values such as:

```text
mean pixel intensity
brightness category
mean RGB
ambient RGB
ambient hex
contrast
saturation
warmth
tint
temperature
sharpness
noise
estimated light direction
suggested model adjustments
```

Do not rewrite these formulas as part of the normalization work.

If the function names need to be wrapped or reorganized, preserve the actual calculations and output values.

## 8.3 `segmentation.py`

Preserve the existing YOLOv8 segmentation behavior.

Keep:

```text
yolov8s-seg.pt
```

as the initial model.

Preserve existing behavior for:

- confidence filtering;
- IoU filtering;
- relevant room-object filtering;
- minimum object area;
- duplicate filtering;
- maximum detected objects;
- mask generation.

Known MVP configuration values should remain unchanged unless the copied implementation already uses different tested values:

```text
YOLO_CONFIDENCE=0.35
YOLO_IOU=0.5
YOLO_IMAGE_SIZE=1024
MIN_OBJECT_AREA_RATIO=0.018
MAX_DETECTED_OBJECTS=5
YOLO_ALLOW_ALL_CLASSES=false
```

Before changing any of these, compare output against the baseline test set.

## 8.4 `depth.py`

The exact copied implementation must be inspected before modification.

Rule:

> If `depth.py` is already part of the result that produced satisfactory output, preserve its algorithm, model/configuration, thresholds, and input behavior.

Do not assume it should use the new 1920px workspace image.

If its current behavior expects the original decoded image, keep that input for the first integration.

If the file is currently unused, do not delete it until the call graph is confirmed.

## 8.5 `scene_detection.py`

The exact copied implementation must also be inspected before modification.

Rule:

> Preserve current scene-detection behavior if it contributes to the tested output.

Do not merge it into `brightness.py` or `main.py` merely for cleanup.

First integrate it exactly as the current MVP expects, then refactor only after output equivalence is verified.

## 8.6 `requirements.txt`

Preserve the current working dependency versions as much as possible.

Add only dependencies required for the new image-preparation boundary.

Recommended addition if not already present:

```text
Pillow
```

Pillow can be used for:

- reliable image decoding;
- EXIF orientation handling;
- high-quality workspace resizing;
- WebP output.

Do not update Ultralytics/OpenCV/Torch versions at the same time as this integration unless required.

Dependency upgrades and pipeline integration should be separate changes so accuracy regressions are easier to identify.

---

# 9. New FastAPI Module

Add:

```text
fastapi-service/image_preparation.py
```

Its scope should be limited to:

- validate decoded dimensions;
- apply EXIF orientation;
- create the workspace-resolution copy;
- preserve aspect ratio;
- prevent upscaling;
- write high-quality WebP;
- return workspace metadata.

Suggested interface:

```python
prepare_workspace_image(
    input_path,
    output_path,
    max_long_edge=1920,
    quality=90,
)
```

Suggested result:

```python
{
    "width": 1920,
    "height": 1440,
    "format": "webp",
}
```

Do **not** place brightness, segmentation, depth, or scene-detection algorithms in this module.

---

# 10. Recommended FastAPI Folder Structure

```text
fastapi-service/
├── brightness.py
├── depth.py
├── image_preparation.py      # NEW
├── main.py
├── requirements.txt
├── scene_detection.py
├── segmentation.py
├── yolov8s-seg.pt
└── generated/
    └── sessions/
        └── {session_id}/
            ├── workspace.webp
            └── masks/
                ├── obj_1.png
                ├── obj_2.png
                └── ...
```

The original upload may be written temporarily while analysis is running, but it should be deleted after analysis completes.

Example during processing:

```text
generated/uploads/{random-id}.jpg
```

After the response data and workspace image are ready:

```text
delete original temporary upload
```

Keep only the workspace image and masks for the active temporary session.

---

# 11. Temporary Session IDs

Each successful upload receives a random server-generated session ID.

Use:

```text
UUID v4
```

Example:

```text
46db0ed2-a215-4a9a-9374-1c43a6cde407
```

This ID is **not a Supabase database ID**.

It exists only for organizing temporary processing artifacts.

Example:

```text
generated/sessions/
└── 46db0ed2-a215-4a9a-9374-1c43a6cde407/
    ├── workspace.webp
    └── masks/
```

Do not derive this path from:

- customer email;
- customer name;
- profile ID;
- original filename.

---

# 12. Frontend Guard Rails

The frontend should perform fast checks before upload.

Initial accepted formats:

```text
image/jpeg
image/png
```

WebP input can be added after confirming it works with the existing analysis pipeline.

Initial maximum upload size:

```text
12 MB
```

This matches the already-tested MVP frontend behavior.

Hard failures:

- unsupported file type;
- file exceeds size limit;
- browser cannot decode the image;
- zero/invalid dimensions.

Possible future hard guard rail:

- extreme decoded pixel count that could create a decompression/memory problem.

Quality problems should generally produce warnings rather than hard failures.

Examples:

```text
image is very dark
image is very blurry
image is unusually low resolution
```

The user should normally be allowed to continue if analysis can still run.

---

# 13. Backend Guard Rails

FastAPI repeats validation even if the frontend already validated the file.

Backend checks:

```text
Content-Type
actual decode success
file-size limit
valid image width/height
reasonable decoded pixel count
```

Do not trust:

```text
filename extension
frontend validation alone
client-provided dimensions
```

The backend is the authoritative validation boundary.

---

# 14. API Endpoint

Preserve the MVP endpoint name initially:

```text
POST /analyze-image
```

This reduces integration risk.

Input:

```text
multipart/form-data

image=<uploaded file>
```

Do not change to R2/object-key based analysis in this stage.

The browser sends the image directly to FastAPI as it did in the MVP.

---

# 15. Target API Response

The current tested response fields should remain available.

Extend the response rather than replacing it.

Target conceptual response:

```json
{
  "session_id": "46db0ed2-a215-4a9a-9374-1c43a6cde407",
  "workspace_image": {
    "url": "/generated/sessions/46db0ed2-a215-4a9a-9374-1c43a6cde407/workspace.webp",
    "width": 1920,
    "height": 1440
  },
  "brightness": {
    "mean_pixel_intensity": 116.43,
    "category": "normal"
  },
  "lighting": {
    "mean_rgb": [120, 118, 116],
    "ambient_rgb": [135, 132, 132],
    "ambient_hex": "#878484",
    "contrast": 1.034,
    "saturation": 0.273,
    "warmth": 0.04,
    "tint": -0.02,
    "temperature": "neutral",
    "sharpness": 1.2,
    "noise": 0.33,
    "light_direction": {
      "x": -0.12,
      "y": 0.28
    },
    "suggested": {
      "brightness": 0.882,
      "contrast": 0.987,
      "saturation": 0.97,
      "color_mix": 0.169,
      "blur_px": 0,
      "grain": 0.18,
      "shadow_opacity": 0.279
    }
  },
  "objects": [
    {
      "id": "obj_1",
      "label": "chair",
      "confidence": 0.87,
      "bbox": [100, 160, 300, 420],
      "mask_url": "/generated/sessions/46db0ed2-a215-4a9a-9374-1c43a6cde407/masks/obj_1.png"
    }
  ],
  "segmentation": {
    "mode": "yolo",
    "model": "yolov8s-seg.pt"
  },
  "warnings": []
}
```

If the copied `depth.py` or `scene_detection.py` currently exposes response data, retain those fields using their current shape.

Do not invent a new depth/scene response shape until the existing code is inspected.

---

# 16. Coordinate-System Rule

The visualization workspace, masks, object bounding boxes, and later overlay coordinates must ultimately use one consistent workspace coordinate system.

Target:

```text
workspace image:
1920 × 1440

workspace masks:
1920 × 1440

canvas coordinate space:
1920 × 1440
```

If segmentation runs at another resolution, the backend must map:

```text
bounding boxes
mask dimensions
```

to the returned workspace-image dimensions.

This is required so object-aware layering remains aligned after normalization.

---

# 17. Important Accuracy Rule for Masks

Do not simply resize binary masks using a smoothing interpolation.

When converting masks to workspace resolution, use an interpolation method appropriate for masks, such as nearest-neighbor for binary labels, unless the current implementation already uses a tested alternative.

The displayed cutout boundary must remain aligned with the workspace image.

Mask conversion is considered correct only if the object edge still overlays the same real-world object after workspace normalization.

---

# 18. Temporary File Serving

FastAPI should expose the session workspace image and masks temporarily.

Recommended URL structure:

```text
/generated/sessions/{session_id}/workspace.webp

/generated/sessions/{session_id}/masks/{mask_file}.png
```

The existing MVP mask static-file behavior may be extended rather than replaced.

The frontend API helper should normalize relative FastAPI URLs to absolute URLs using:

```text
NEXT_PUBLIC_IMAGE_API_URL
```

Example:

```env
NEXT_PUBLIC_IMAGE_API_URL=http://localhost:8000
```

---

# 19. Temporary Cleanup

Temporary files must not remain indefinitely.

For the first local implementation, use a configurable session TTL.

Recommended starting value:

```text
TEMP_SESSION_TTL_MINUTES=120
```

Cleanup strategy:

```text
on FastAPI startup
and/or
when a new upload begins
    ↓
scan generated/sessions
    ↓
remove session directories older than TTL
```

This is sufficient for the first deployment stage.

Do not introduce a database cleanup table.

If GlassFit later runs multiple FastAPI instances and needs shared temporary storage, private R2 can replace the local session directory without changing the frontend concept.

---

# 20. Frontend Integration

The frontend upload flow should become:

```text
select File
        ↓
frontend guard rails
        ↓
create immediate local ObjectURL preview
        ↓
POST File to /analyze-image
        ↓
show analyzing state
        ↓
receive FastAPI result
        ↓
switch visualization background to workspace_image.url
        ↓
store analysis JSON in session state
        ↓
continue to visualization
```

Do not store the image as Base64.

Use:

```text
URL.createObjectURL(file)
```

for immediate local preview.

Release it later using:

```text
URL.revokeObjectURL(...)
```

when no longer needed.

---

# 21. Frontend Session State

Suggested conceptual state:

```ts
type SpaceImageSession = {
  sessionId: string;
  originalFileName: string;

  workspaceImage: {
    url: string;
    width: number;
    height: number;
  };

  brightness: BrightnessAnalysis;
  lighting: LightingAnalysis;
  objects: DetectedObject[];

  segmentation: {
    mode: string;
    model: string | null;
  };

  warnings: string[];
};
```

If the existing API returns depth or scene data, extend this type using the existing shapes.

Do not store this object in Supabase.

---

# 22. Frontend API Helper

Reuse or create:

```text
src/lib/imageApi.ts
```

Responsibilities:

- frontend accepted MIME types;
- 12 MB validation;
- POST `multipart/form-data`;
- API base URL;
- normalize workspace-image URL;
- normalize mask URLs;
- map backend errors into user-friendly messages.

Do not put visualization logic inside the API helper.

---

# 23. Error and Fallback Behavior

The space-image pipeline should not make the entire visualization unusable when one optional analysis feature fails.

## Hard failure

Stop the flow if:

- image cannot be decoded;
- unsupported content;
- upload is invalid;
- FastAPI cannot prepare a usable workspace image.

## Soft failure

Continue with warnings if possible when:

- segmentation fails;
- no useful objects are detected;
- depth estimation fails;
- scene detection fails;
- a generated mask is unavailable.

The user should still be able to perform manual product placement using:

```text
move
resize
rotate
yaw
pitch
```

This preserves the MVP fallback philosophy.

---

# 24. Performance Rules

The implementation must enforce the following principles.

### Browser

```text
one workspace-quality background image
no full-resolution 4000px canvas
no Base64 copies of the room photo
no client-side YOLO
no client-side OpenCV analysis
no Supabase analysis polling
```

### Future Three.js integration

```text
one live editable Three.js product at a time
placed products become cached transparent layers
cap renderer pixel ratio on mobile
avoid multiple simultaneous WebGL renderers
```

### Realism

```text
global analysis calculated once by FastAPI
position-based calculations debounced
heavy Auto Realism not recalculated every drag frame
```

---

# 25. Preserve the One-Live-Overlay Architecture

When structural products are integrated later, this image pipeline must feed the same efficient rendering architecture:

```text
workspace image
        ↓
active product
        ↓
ONE live Three.js renderer
        ↓
Apply
        ↓
cached transparent overlay
        ↓
next product becomes live
```

Do not reintroduce one WebGL renderer per product.

---

# 26. Phase 0 — Baseline the Existing FastAPI Accuracy

This phase happens **before modifying the copied FastAPI algorithms**.

## 26.1 Select baseline images

Use several images that previously gave satisfactory results.

Recommended minimum:

```text
5–10 test room images
```

Include variation in:

- bright room;
- dim room;
- warm lighting;
- cool lighting;
- furniture/occluding objects;
- windows/openings;
- different image sizes.

## 26.2 Save baseline outputs

For each image, save:

```text
brightness JSON
lighting JSON
depth output, if used
scene-detection output, if used
detected object labels
confidence values
bounding boxes
segmentation masks
warnings
```

Also save screenshots of the current mask/analysis result if useful.

These become the regression reference.

## 26.3 Freeze model/configuration

Record:

```text
Python version
FastAPI version
OpenCV version
Ultralytics version
Torch version
YOLO model filename
YOLO confidence
YOLO IoU
YOLO inference size
segmentation filtering values
any depth-model/config values
any scene-detection thresholds
```

Do not upgrade these during the first pipeline integration.

---

# 27. Phase 1 — Audit Existing FastAPI Modules

Before coding new orchestration, inspect:

```text
main.py
brightness.py
depth.py
scene_detection.py
segmentation.py
```

Document:

```text
which functions main.py calls
in what order
which input each function receives
which outputs are returned
which temporary files each module creates
which environment variables control behavior
```

Special attention:

```text
depth.py
scene_detection.py
```

These are present in the current repository but are not assumed to match the older MVP documentation exactly.

Their current code is the source of truth for the real implementation.

---

# 28. Phase 2 — Add Workspace Image Preparation

Add:

```text
image_preparation.py
```

Implement only:

```text
orientation handling
workspace resizing
workspace WebP encoding
workspace metadata
```

Do not change the existing analysis code.

Acceptance check:

- original analysis output remains identical or within harmless numerical serialization differences;
- workspace image visually matches the original;
- no visible pixelation at normal workspace zoom;
- aspect ratio remains correct.

---

# 29. Phase 3 — Extend `main.py`

Update `/analyze-image` orchestration:

```text
1. Receive image
2. Validate content type / file size
3. Save temporary original
4. Decode safely
5. Generate session UUID
6. Run existing analysis functions
7. Create workspace image
8. Generate/map masks to workspace dimensions
9. Build unified response
10. Delete original upload
11. Keep workspace + masks temporarily
```

Do not change analysis formulas in this phase.

---

# 30. Phase 4 — Connect Frontend Upload to FastAPI

Replace the frontend-only transition after image selection.

Before:

```text
select image
→ local preview
→ frontend-only visualization
```

After:

```text
select image
→ local preview
→ FastAPI analysis
→ prepared workspace image
→ analysis session state
→ visualization workspace
```

Add states for:

```text
idle
validating
analyzing
ready
error
```

The user should receive clear progress feedback while YOLO is running.

---

# 31. Phase 5 — Wire Analysis into Visualization State

Once the API flow is stable, expose the analysis to future visualization components.

Examples:

```text
lighting
→ Three.js renderer

suggested realism values
→ Canvas realism defaults

detected objects + masks
→ Object-aware layering

depth / scene information
→ only the features that already use them
```

Do not query Supabase for these values.

Pass them through the active visualization session.

---

# 32. Phase 6 — Mobile Performance Validation

Test on:

```text
desktop
mobile browser
at least one mid-range mobile device
```

Test images:

```text
~1–3 MP
~8–12 MP
large phone image
```

Measure:

- upload time;
- FastAPI analysis time;
- workspace-image transfer size;
- browser responsiveness;
- canvas responsiveness;
- memory-related crashes/reloads;
- visual quality.

Compare workspace limits:

```text
1600px
1920px
2560px
```

Select the highest value that remains smooth on the target mid-range device.

Do not increase resolution solely because desktop performs well.

---

# 33. Accuracy Regression Checks

A change must not be accepted simply because the API still runs.

Compare the new pipeline with the baseline.

## Brightness / lighting

Check:

- same brightness category;
- mean intensity remains equivalent;
- ambient color remains equivalent;
- temperature remains equivalent;
- light direction remains equivalent;
- suggested realism values remain equivalent.

## Segmentation

Check:

- important object labels remain detected;
- no unexpected major loss in confidence;
- boxes still align;
- mask boundaries remain visually comparable;
- workspace-resized masks still align after normalization.

## Depth

If depth output is used:

- compare the same test images before/after;
- preserve current spatial ordering/quality;
- do not accept a faster implementation that visibly worsens the result.

## Scene detection

If scene-detection output is used:

- compare the same classification/geometry/result before/after;
- keep existing thresholds unless there is evidence they need revision.

---

# 34. Quality Acceptance Criteria

The workspace image is acceptable when:

1. It does not look obviously pixelated at normal visualization scale.
2. It remains visually close to the original uploaded photo.
3. Fine room edges remain usable for placement.
4. Window/opening edges remain clear enough for fitting.
5. Furniture boundaries remain clear enough for occlusion.
6. Colors remain visually consistent.
7. The image is not visibly over-compressed.
8. Orientation is correct.
9. Aspect ratio is unchanged.

---

# 35. Functional Acceptance Criteria

This pipeline stage is complete when:

1. A user can select a valid room image in the frontend.
2. Frontend guard rails reject invalid uploads.
3. The frontend immediately shows a local preview.
4. The original file is posted to FastAPI.
5. FastAPI independently validates the upload.
6. Existing tested analysis still runs.
7. Existing YOLOv8 segmentation still runs using `yolov8s-seg.pt`.
8. A workspace image is generated with a maximum initial long edge of 1920px.
9. The workspace image does not upscale smaller uploads.
10. The workspace image is returned to the frontend through a temporary URL.
11. Object masks align with the workspace image.
12. Analysis JSON is held in browser session state.
13. No temporary analysis rows are written to Supabase.
14. No original room image is permanently uploaded to R2.
15. Original temporary backend uploads are deleted after analysis.
16. Workspace images and masks expire through temporary cleanup.
17. Segmentation failure does not prevent manual visualization.
18. Current analysis accuracy is not visibly degraded.
19. Mid-range mobile testing shows the workspace image remains practical.
20. The pipeline is ready to feed the future Three.js/Canvas visualization workspace.

---

# 36. Definition of Done for This Implementation Stage

The stage is done when this works end-to-end:

```text
User uploads room image
        ↓
Frontend validates
        ↓
FastAPI validates
        ↓
Existing tested analysis runs
        ↓
FastAPI creates quality-preserving workspace image
        ↓
FastAPI returns analysis + workspace image + masks
        ↓
Frontend loads optimized workspace image
        ↓
Frontend keeps analysis in session state
        ↓
User is ready to begin product visualization
```

No structural Window implementation is required to complete this stage.

The structural product pipeline should begin **after** this space-image pipeline is stable.

---

# 37. Files Expected to Change

## FastAPI

Existing:

```text
fastapi-service/main.py
fastapi-service/requirements.txt
```

Possibly small integration-only changes:

```text
fastapi-service/brightness.py
fastapi-service/depth.py
fastapi-service/scene_detection.py
fastapi-service/segmentation.py
```

These should not receive algorithm changes unless necessary.

New:

```text
fastapi-service/image_preparation.py
fastapi-service/generated/sessions/
```

## Frontend

Likely areas:

```text
space-image upload component
image API client/helper
shared image-analysis TypeScript types
visualization session state
```

Exact frontend filenames should follow the current GlassFit repository rather than blindly copying the MVP file structure.

---

# 38. Local Development Validation

FastAPI:

```powershell
cd fastapi-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend environment:

```env
NEXT_PUBLIC_IMAGE_API_URL=http://localhost:8000
```

Backend health:

```text
http://127.0.0.1:8000/health
```

Suggested Python compile validation after changes:

```powershell
python -m py_compile main.py brightness.py depth.py scene_detection.py segmentation.py image_preparation.py
```

Frontend validation after integration:

```powershell
npm run lint
npm run build
```

---

# 39. First Implementation Order

Follow this exact order to minimize regressions:

```text
1. Run copied FastAPI unchanged
2. Verify current /health
3. Verify current /analyze-image with known test image
4. Save baseline output
5. Inspect depth.py and scene_detection.py call flow
6. Add Pillow only if needed for image preparation
7. Add image_preparation.py
8. Generate workspace image without changing analysis inputs
9. Extend main.py response with workspace_image + session_id
10. Map masks to workspace dimensions
11. Verify baseline analysis remains equivalent
12. Add temporary session cleanup
13. Connect frontend image API
14. Keep immediate local preview
15. Switch visualization background to FastAPI workspace image when ready
16. Store analysis in frontend session state
17. Test error/fallback behavior
18. Test multiple real room photos
19. Test 1920px quality visually
20. Test on a mid-range mobile device
21. Only after this is stable, proceed to structural Window integration
```

---

# 40. Non-Goals for This Stage

Do not implement these yet:

```text
Supabase temporary image-analysis tables
R2 temporary room-image uploads
permanent original room-image storage
final visualization persistence
quotation generation
structural Window database integration
parametric product assembly
admin-side image upload management
resumable visualization sessions
multiple live Three.js renderers
client-side YOLO
client-side OpenCV
```

These are separate implementation stages.

---

# 41. Guiding Principle

The integration should preserve the successful MVP accuracy while changing only what is required for the real GlassFit architecture.

The guiding rule is:

> **Analyze with the proven backend pipeline, prepare a lighter workspace image for the browser, keep temporary analysis in session state, and persist only the final business artifacts later.**

This keeps the system aligned with the GlassFit goal of providing a realistic photo-based visualization experience while remaining practical on low- to mid-range devices.
