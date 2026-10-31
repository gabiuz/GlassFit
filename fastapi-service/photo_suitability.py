"""FIX14 / PRD-F3, PRD-F4: conservative space-photo admission decision."""

from typing import Literal, TypedDict


class SuitabilityDecision(TypedDict):
    status: Literal["accepted", "rejected", "too_close", "unverifiable"]
    reason: str


def assess_photo_suitability(
    objects: list[dict], segmentation: dict, scene: dict, width: int, height: int,
    mean_pixel_intensity: float | None = None,
) -> SuitabilityDecision:
    """Use independent scene and object evidence; never accept a depth fallback."""
    if segmentation.get("mode") != "yolo" or scene.get("method") != "segformer_ade20k" or not scene.get("available"):
        return {"status": "unverifiable", "reason": "classifier_unavailable"}

    area = max(width * height, 1)
    person_dominance = max(
        (
            max(0, obj["bbox"][2] - obj["bbox"][0])
            * max(0, obj["bbox"][3] - obj["bbox"][1]) / area
            for obj in objects
            if obj.get("label") == "person" and obj.get("confidence", 0) >= 0.5
            and isinstance(obj.get("bbox"), list) and len(obj["bbox"]) == 4
        ),
        default=0.0,
    )
    non_space_dominance = max(
        (
            max(0, obj["bbox"][2] - obj["bbox"][0])
            * max(0, obj["bbox"][3] - obj["bbox"][1]) / area
            for obj in objects
            if obj.get("label") in {"book", "television", "laptop", "cell phone"}
            and obj.get("confidence", 0) >= 0.55
            and isinstance(obj.get("bbox"), list) and len(obj["bbox"]) == 4
        ),
        default=0.0,
    )
    wall = scene.get("wall_coverage") or 0.0
    opening = scene.get("opening_coverage") or 0.0
    floor = scene.get("floor_coverage") or 0.0
    ceiling = scene.get("ceiling_coverage") or 0.0
    building = scene.get("building_coverage") or 0.0
    exterior_context = scene.get("exterior_context_coverage") or 0.0
    opening_vertical_span = scene.get("opening_vertical_span") or 0.0
    surface_too_close = (
        opening >= 0.30 and opening_vertical_span >= 0.95
        and floor < 0.02 and ceiling < 0.02
        and building < 0.08 and exterior_context < 0.05
    )
    architectural_evidence = (
        (opening >= 0.04 and not surface_too_close)
        or (wall >= 0.20 and floor >= 0.05)
        or (building >= 0.20 and exterior_context >= 0.08)
    )

    # FIX14: A very dark illustration can be split into invented wall and
    # ceiling regions. With no opening or floor, those labels are not enough
    # to establish a usable space in an underexposed image.
    if (mean_pixel_intensity is not None and mean_pixel_intensity < 25
            and opening < 0.04 and floor < 0.05 and building < 0.20):
        return {"status": "unverifiable", "reason": "underexposed_without_space_evidence"}

    # A large foreground person plus no independent architectural geometry is
    # positive evidence of a portrait, even if a plain backdrop is called wall.
    if person_dominance >= 0.28 and not architectural_evidence:
        return {"status": "rejected", "reason": "dominant_person_no_space"}
    if non_space_dominance >= 0.35 and not architectural_evidence:
        return {"status": "rejected", "reason": "dominant_non_space_object"}
    if surface_too_close:
        return {"status": "too_close", "reason": "surface_too_close"}
    if architectural_evidence:
        return {"status": "accepted", "reason": "architectural_evidence"}
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
