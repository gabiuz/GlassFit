"""FIX14, FIX16 / PRD-F3, PRD-F4: conservative space-photo admission decision."""

import math
from typing import Literal, TypedDict


class SuitabilityDecision(TypedDict):
    status: Literal["accepted", "rejected", "too_close", "unverifiable"]
    reason: str


def assess_photo_suitability(
    objects: list[dict], segmentation: dict, scene: dict, width: int, height: int,
    mean_pixel_intensity: float | None = None,
    independent_scene: dict | None = None,
    geometric_opening: bool = False,
) -> SuitabilityDecision:
    """Use independent scene and object evidence; never accept a depth fallback."""
    if segmentation.get("mode") != "yolo" or scene.get("method") != "segformer_ade20k" or not scene.get("available"):
        return {"status": "unverifiable", "reason": "classifier_unavailable"}

    for obj in objects:
        label = obj.get("label")
        threshold = 0.5 if label == "person" else 0.55
        if label not in {"person", "book", "television", "laptop", "cell phone"}:
            continue
        confidence = obj.get("confidence", 0)
        if not isinstance(confidence, (int, float)) or not math.isfinite(confidence):
            return {"status": "unverifiable", "reason": "independent_space_evidence_unavailable"}
        if confidence < threshold:
            continue
        box = obj.get("bbox")
        if (not isinstance(box, list) or len(box) != 4
                or any(not isinstance(value, (int, float)) or not math.isfinite(value)
                       for value in box)
                or box[0] >= box[2] or box[1] >= box[3]
                or box[0] < 0 or box[1] < 0
                or box[2] > width or box[3] > height):
            return {"status": "unverifiable", "reason": "independent_space_evidence_unavailable"}

    area = max(width * height, 1)

    def visible_dominance(box: list) -> float:
        left = max(0, min(width, box[0]))
        right = max(0, min(width, box[2]))
        top = max(0, min(height, box[1]))
        bottom = max(0, min(height, box[3]))
        return max(0, right - left) * max(0, bottom - top) / area

    person_dominance = max(
        (
            visible_dominance(obj["bbox"])
            for obj in objects
            if obj.get("label") == "person" and obj.get("confidence", 0) >= 0.5
            and isinstance(obj.get("bbox"), list) and len(obj["bbox"]) == 4
        ),
        default=0.0,
    )
    non_space_dominance = max(
        (
            visible_dominance(obj["bbox"])
            for obj in objects
            if obj.get("label") in {"book", "television", "laptop", "cell phone"}
            and obj.get("confidence", 0) >= 0.55
            and isinstance(obj.get("bbox"), list) and len(obj["bbox"]) == 4
        ),
        default=0.0,
    )
    dominant_subject = person_dominance >= 0.28 or non_space_dominance >= 0.35
    if dominant_subject and independent_scene is None:
        return {"status": "unverifiable", "reason": "independent_space_evidence_unavailable"}
    evidence = independent_scene if dominant_subject else scene
    wall = evidence.get("wall_coverage") or 0.0
    opening = evidence.get("opening_coverage") or 0.0
    floor = evidence.get("floor_coverage") or 0.0
    ceiling = evidence.get("ceiling_coverage") or 0.0
    building = evidence.get("building_coverage") or 0.0
    exterior_context = evidence.get("exterior_context_coverage") or 0.0
    opening_vertical_span = evidence.get("opening_vertical_span") or 0.0
    surface_too_close = (
        opening >= 0.30 and opening_vertical_span >= 0.95
        and floor < 0.02 and ceiling < 0.02
        and building < 0.08 and exterior_context < 0.05
    )
    architectural_evidence = (
        (opening >= 0.04 and not surface_too_close)
        or (wall >= 0.20 and floor >= 0.05)
        or (building >= 0.20 and exterior_context >= 0.08)
        or (building >= 0.30 and wall >= 0.15 and floor >= 0.025)
        or (not dominant_subject and building >= 0.80 and geometric_opening)
    )

    # FIX14: A very dark illustration can be split into invented wall and
    # ceiling regions. With no opening or floor, those labels are not enough
    # to establish a usable space in an underexposed image.
    if (mean_pixel_intensity is not None and mean_pixel_intensity < 25
            and opening < 0.04 and floor < 0.05 and building < 0.20):
        return {"status": "unverifiable", "reason": "underexposed_without_space_evidence"}

    # A large foreground person plus no independent architectural geometry is
    # positive evidence of a portrait, even if a plain backdrop is called wall.
    partial_room_context = wall >= 0.10 and floor >= 0.08 and wall + floor >= 0.20
    if person_dominance >= 0.28 and not architectural_evidence and not partial_room_context:
        return {"status": "rejected", "reason": "dominant_person_no_space"}
    if non_space_dominance >= 0.35 and not architectural_evidence and not partial_room_context:
        return {"status": "rejected", "reason": "dominant_non_space_object"}
    if surface_too_close:
        return {"status": "too_close", "reason": "surface_too_close"}
    if architectural_evidence:
        return {"status": "accepted", "reason": "architectural_evidence"}
    # FIX14-V3 / QAD-TC4: foreground clutter can hide most of a room and
    # prevent the opening label. Both visible surfaces still provide context.
    # Keep this weaker evidence AFTER subject rejection and too-close checks;
    # it must not exempt portraits or screen/catalog photos from those guards.
    if partial_room_context:
        return {"status": "accepted", "reason": "partial_room_context"}
    # A wall filling almost the entire frame can be a real installation
    # surface, but it lacks the surrounding room/opening needed for placement.
    # Require a successful semantic scene model and exclude known foreground
    # subjects before giving the specific retake guidance.
    if (wall >= 0.68 and floor < 0.05 and ceiling >= 0.08
            and opening < 0.04 and building < 0.08
            and mean_pixel_intensity is not None
            and 70 <= mean_pixel_intensity <= 160):
        return {"status": "too_close", "reason": "surface_too_close"}
    return {"status": "unverifiable", "reason": "insufficient_architectural_evidence"}
