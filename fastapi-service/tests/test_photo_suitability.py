"""FIX14 / QAD-TC3, QAD-TC4: space-photo admission decisions."""

from photo_suitability import assess_photo_suitability


def scene(**overrides):
    result = {"available": True, "method": "segformer_ade20k", "wall_coverage": 0.0,
              "floor_coverage": 0.0, "structural_coverage": 0.0, "opening_coverage": 0.0,
              "ceiling_coverage": 0.0, "building_coverage": 0.0,
              "exterior_context_coverage": 0.0}
    result.update(overrides)
    return result


def test_portrait_backdrop_is_rejected():
    person = {"label": "person", "confidence": 0.94, "bbox": [180, 100, 780, 900]}
    decision = assess_photo_suitability([person], {"mode": "yolo"},
                                         scene(wall_coverage=0.56), 944, 914)
    assert decision == {"status": "rejected", "reason": "dominant_person_no_space"}


def test_occupied_room_is_accepted():
    person = {"label": "person", "confidence": 0.9, "bbox": [100, 100, 700, 900]}
    assert assess_photo_suitability([person], {"mode": "yolo"},
                                    scene(wall_coverage=0.45, floor_coverage=0.2), 1000, 1000)["status"] == "accepted"


def test_close_opening_needs_no_floor():
    assert assess_photo_suitability([], {"mode": "yolo"},
                                    scene(opening_coverage=0.08), 1000, 1000)["status"] == "accepted"


def test_occupied_window_wall_with_small_floor_is_accepted():
    # FIX14 / QAD-TC4: the real window scene has building and wall labels,
    # while the narrow bottom strip of floor falls below the generic cutoff.
    evidence = scene(building_coverage=0.502, wall_coverage=0.291,
                     floor_coverage=0.043, opening_coverage=0.0)
    assert assess_photo_suitability([], {"mode": "yolo"}, evidence,
                                    2048, 1536)["status"] == "accepted"


def test_building_label_alone_does_not_accept_a_graphic():
    # The ViTk window requires three corroborating scene labels. A single
    # building prediction on artwork remains insufficient.
    evidence = scene(building_coverage=0.50, wall_coverage=0.29,
                     floor_coverage=0.0, opening_coverage=0.0)
    assert assess_photo_suitability([], {"mode": "yolo"}, evidence,
                                    2048, 1536)["status"] == "unverifiable"


def test_mock_or_depth_fallback_cannot_admit():
    assert assess_photo_suitability([], {"mode": "mock"},
                                    scene(structural_coverage=0.5), 1000, 1000)["status"] == "unverifiable"
    assert assess_photo_suitability([], {"mode": "yolo"},
                                    {"available": True, "method": "depth_plane_fitting"},
                                    1000, 1000)["status"] == "unverifiable"


def test_document_or_catalog_on_floor_is_not_accepted():
    # A floor or cabinet class alone does not prove there is a usable opening.
    for evidence in (scene(floor_coverage=0.72, structural_coverage=0.72),
                     scene(structural_coverage=0.42),
                     scene(wall_coverage=0.6)):
        assert assess_photo_suitability([], {"mode": "yolo"}, evidence,
                                        1000, 1000)["status"] == "unverifiable"


def test_close_wall_has_specific_retake_result():
    assert assess_photo_suitability([], {"mode": "yolo"},
                                    scene(wall_coverage=0.715, ceiling_coverage=0.191),
                                    1000, 1000, mean_pixel_intensity=106.64) == {
        "status": "too_close", "reason": "surface_too_close"}


def test_close_elevator_surface_with_false_opening_label_is_too_close():
    assert assess_photo_suitability([], {"mode": "yolo"},
                                    scene(wall_coverage=0.518, opening_coverage=0.399,
                                          opening_vertical_span=1.0, building_coverage=0.014),
                                    850, 2100, mean_pixel_intensity=137.82) == {
        "status": "too_close", "reason": "surface_too_close"}


def test_dominant_catalog_object_is_non_space():
    catalog = {"label": "book", "confidence": 0.8, "bbox": [40, 30, 920, 930]}
    assert assess_photo_suitability([catalog], {"mode": "yolo"},
                                    scene(wall_coverage=0.86), 1000, 1000) == {
        "status": "rejected", "reason": "dominant_non_space_object"}


def test_dark_artwork_wall_and_ceiling_labels_are_not_sufficient():
    decision = assess_photo_suitability([], {"mode": "yolo"},
                                        scene(wall_coverage=0.357, ceiling_coverage=0.045),
                                        640, 640, mean_pixel_intensity=15.72)
    assert decision == {"status": "unverifiable", "reason": "underexposed_without_space_evidence"}


def test_graphics_with_wall_and_ceiling_labels_are_not_accepted():
    # Graphic layouts and album artwork can produce both labels without a room.
    for wall, ceiling in ((0.773, 0.181), (0.369, 0.058)):
        result = assess_photo_suitability([], {"mode": "yolo"},
                                          scene(wall_coverage=wall, ceiling_coverage=ceiling),
                                          640, 640, mean_pixel_intensity=45)
        assert result["status"] == "unverifiable"


def test_cluttered_room_with_partial_wall_and_floor_is_accepted():
    # FIX14-V3 / QAD-TC4: derived features from the consented upload regression.
    # Clothing occludes the opening; the small laptop is foreground context.
    evidence = scene(wall_coverage=0.119, floor_coverage=0.097)
    laptop = {"label": "laptop", "confidence": 0.938,
              "bbox": [1169, 1497, 1534, 2047]}
    assert assess_photo_suitability([laptop], {"mode": "yolo"}, evidence,
                                    1536, 2048, 67.02) == {
        "status": "accepted", "reason": "partial_room_context"}


def test_partial_room_evidence_does_not_admit_dominant_portraits_or_screens():
    evidence = scene(wall_coverage=0.119, floor_coverage=0.097)
    for label, reason in (("person", "dominant_person_no_space"),
                          ("laptop", "dominant_non_space_object"),
                          ("book", "dominant_non_space_object")):
        subject = {"label": label, "confidence": 0.95,
                   "bbox": [0, 0, 900, 900]}
        assert assess_photo_suitability([subject], {"mode": "yolo"}, evidence,
                                        1000, 1000, 67.02) == {
            "status": "rejected", "reason": reason}


def test_partial_room_requires_both_surfaces_and_minimum_combined_coverage():
    for wall, floor in ((0.099, 0.2), (0.119, 0.079), (0.11, 0.08), (0, 0.9)):
        assert assess_photo_suitability([], {"mode": "yolo"},
                                        scene(wall_coverage=wall, floor_coverage=floor),
                                        1000, 1000, 67.02)["status"] == "unverifiable"
    for wall, floor in ((0.10, 0.10), (0.12, 0.08)):
        assert assess_photo_suitability([], {"mode": "yolo"},
                                        scene(wall_coverage=wall, floor_coverage=floor),
                                        1000, 1000, 67.02)["status"] == "accepted"


def test_partial_room_evidence_cannot_replace_unavailable_models():
    evidence = scene(wall_coverage=0.119, floor_coverage=0.097)
    assert assess_photo_suitability([], {"mode": "mock"}, evidence,
                                    1000, 1000, 67.02) == {
        "status": "unverifiable", "reason": "classifier_unavailable"}


def test_partial_room_rejects_subjects_at_exact_dominance_limits():
    evidence = scene(wall_coverage=0.119, floor_coverage=0.097)
    for label, box in (("person", [0, 0, 400, 700]),
                       ("laptop", [0, 0, 500, 700]),
                       ("book", [0, 0, 500, 700])):
        subject = {"label": label, "confidence": 0.95, "bbox": box}
        assert assess_photo_suitability([subject], {"mode": "yolo"}, evidence,
                                        1000, 1000, 67.02)["status"] == "rejected"
