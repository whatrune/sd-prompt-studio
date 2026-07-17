from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "camera-visibility-metadata.schema.json"
REGIONS = (
    "head",
    "face",
    "hair",
    "neck",
    "shoulders",
    "arms",
    "hands",
    "torso",
    "hips",
    "legs",
    "knees",
    "feet",
)


def available_panel(panel_id: int = 1, *, coverage: str = "partial") -> dict:
    regions = {"hands": "partial"}
    if coverage == "complete":
        regions = {region: "visible" for region in REGIONS}
        regions["hands"] = "partial"
    return {
        "panel_id": panel_id,
        "visibility_status": "available",
        "source_image": f"panels/BRG-013-A_{panel_id:02d}.png",
        "camera": {
            "framing": "full_body",
            "angle": {"horizontal": "rear", "vertical": "eye_level"},
            "perspective": "normal",
        },
        "subject_occupancy": {
            "width_ratio": 0.64,
            "height_ratio": 0.88,
            "area_ratio": {"status": "available", "value": 0.37},
            "measurement_method": "manual_estimate",
        },
        "visibility_coverage": {"status": coverage},
        "visible_regions": regions,
        "occlusions": [{"region": "hands", "cause": "clothing"}],
    }


def valid_available() -> dict:
    return {
        "schema_version": "0.1.0",
        "run_id": "BRG-013-A",
        "visibility_status": "available",
        "panels": [available_panel(panel_id) for panel_id in range(1, 7)],
    }


class CameraVisibilityMetadataSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(cls.schema)
        cls.validator = Draft202012Validator(cls.schema)

    def assert_valid(self, value: dict) -> None:
        errors = sorted(self.validator.iter_errors(value), key=lambda item: list(item.path))
        self.assertEqual([], errors)

    def assert_invalid(self, value: dict) -> None:
        self.assertTrue(list(self.validator.iter_errors(value)))

    def mutate_panel(self, artifact: dict, panel_id: int = 1) -> dict:
        return artifact["panels"][panel_id - 1]

    def test_schema_is_valid_draft_2020_12(self) -> None:
        self.assertEqual(
            "https://json-schema.org/draft/2020-12/schema",
            self.schema["$schema"],
        )
        self.assertEqual("0.1.0", self.schema["x-contract-version"])

    def test_available_root_with_exactly_six_panels_is_valid(self) -> None:
        self.assert_valid(valid_available())

    def test_root_version_status_and_required_fields_are_fixed(self) -> None:
        artifact = valid_available()
        artifact["schema_version"] = "0.2.0"
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["visibility_status"] = "observed"
        self.assert_invalid(artifact)

        for field in ("schema_version", "run_id", "visibility_status"):
            with self.subTest(required_field=field):
                artifact = valid_available()
                artifact.pop(field)
                self.assert_invalid(artifact)

    def test_root_available_and_unavailable_branches_are_closed(self) -> None:
        artifact = valid_available()
        artifact["unavailable_reason"] = "invalid_run"
        self.assert_invalid(artifact)

        self.assert_valid(
            {
                "schema_version": "0.1.0",
                "run_id": "BRG-013-A",
                "visibility_status": "unavailable",
                "unavailable_reason": "source_artifact_missing",
            }
        )

        artifact = valid_available()
        artifact["visibility_status"] = "unavailable"
        artifact["unavailable_reason"] = "invalid_run"
        self.assert_invalid(artifact)

        artifact = {
            "schema_version": "0.1.0",
            "run_id": "BRG-013-A",
            "visibility_status": "unavailable",
        }
        self.assert_invalid(artifact)

    def test_root_and_panel_reason_enums_do_not_mix(self) -> None:
        root = {
            "schema_version": "0.1.0",
            "run_id": "BRG-013-A",
            "visibility_status": "unavailable",
            "unavailable_reason": "image_missing",
        }
        self.assert_invalid(root)

        artifact = valid_available()
        panel = self.mutate_panel(artifact)
        panel.clear()
        panel.update(
            {
                "panel_id": 1,
                "visibility_status": "unavailable",
                "source_image": "panels/BRG-013-A_01.png",
                "unavailable_reason": "source_artifact_missing",
            }
        )
        self.assert_invalid(artifact)

    def test_other_reason_requires_nonblank_detail_and_other_reasons_forbid_it(self) -> None:
        base = {
            "schema_version": "0.1.0",
            "run_id": "BRG-013-A",
            "visibility_status": "unavailable",
            "unavailable_reason": "other",
        }
        self.assert_invalid(base)
        for detail in ("", "   "):
            artifact = dict(base, unavailable_reason_detail=detail)
            self.assert_invalid(artifact)
        self.assert_valid(dict(base, unavailable_reason_detail="source could not be classified"))

        artifact = dict(base)
        artifact["unavailable_reason"] = "invalid_run"
        artifact["unavailable_reason_detail"] = "not allowed"
        self.assert_invalid(artifact)

    def test_panels_are_exactly_six_and_ids_are_lexically_bounded(self) -> None:
        for count in (5, 7):
            with self.subTest(count=count):
                artifact = valid_available()
                artifact["panels"] = [available_panel(i) for i in range(1, count + 1)]
                self.assert_invalid(artifact)

        for panel_id in (0, 7, "1"):
            with self.subTest(panel_id=panel_id):
                artifact = valid_available()
                self.mutate_panel(artifact)["panel_id"] = panel_id
                self.assert_invalid(artifact)

    def test_panel_available_and_unavailable_branches_are_closed(self) -> None:
        for field in (
            "camera",
            "subject_occupancy",
            "visibility_coverage",
            "visible_regions",
        ):
            with self.subTest(required_field=field):
                artifact = valid_available()
                self.mutate_panel(artifact).pop(field)
                self.assert_invalid(artifact)

        artifact = valid_available()
        panel = self.mutate_panel(artifact)
        panel.clear()
        panel.update(
            {
                "panel_id": 1,
                "visibility_status": "unavailable",
                "source_image": "panels/BRG-013-A_01.png",
                "unavailable_reason": "image_missing",
            }
        )
        self.assert_valid(artifact)

        for forbidden in (
            "camera",
            "subject_occupancy",
            "visibility_coverage",
            "visible_regions",
            "occlusions",
        ):
            with self.subTest(forbidden=forbidden):
                invalid = copy.deepcopy(artifact)
                invalid["panels"][0][forbidden] = available_panel()[forbidden]
                self.assert_invalid(invalid)

    def test_panel_reason_detail_contract(self) -> None:
        artifact = valid_available()
        panel = self.mutate_panel(artifact)
        panel.clear()
        panel.update(
            {
                "panel_id": 1,
                "visibility_status": "unavailable",
                "source_image": "panels/BRG-013-A_01.png",
                "unavailable_reason": "other",
                "unavailable_reason_detail": "primary subject could not be classified",
            }
        )
        self.assert_valid(artifact)

        panel["unavailable_reason_detail"] = " "
        self.assert_invalid(artifact)
        panel["unavailable_reason"] = "primary_subject_ambiguous"
        panel["unavailable_reason_detail"] = "not allowed"
        self.assert_invalid(artifact)

    def test_camera_nested_angle_and_complete_enums(self) -> None:
        for horizontal in (
            "front",
            "side",
            "three_quarter",
            "rear",
            "rear_three_quarter",
            "unknown",
        ):
            with self.subTest(horizontal=horizontal):
                artifact = valid_available()
                self.mutate_panel(artifact)["camera"]["angle"]["horizontal"] = horizontal
                self.assert_valid(artifact)

        artifact = valid_available()
        camera = self.mutate_panel(artifact)["camera"]
        camera["horizontal"] = camera.pop("angle")["horizontal"]
        camera["vertical"] = "eye_level"
        self.assert_invalid(artifact)

        for field in ("framing", "angle", "perspective"):
            with self.subTest(required_camera_field=field):
                artifact = valid_available()
                self.mutate_panel(artifact)["camera"].pop(field)
                self.assert_invalid(artifact)

    def test_subject_occupancy_requires_all_fields_and_ratio_ranges(self) -> None:
        for field in ("width_ratio", "height_ratio", "area_ratio", "measurement_method"):
            with self.subTest(required_field=field):
                artifact = valid_available()
                self.mutate_panel(artifact)["subject_occupancy"].pop(field)
                self.assert_invalid(artifact)

        for value in (0.0, 1.0):
            artifact = valid_available()
            self.mutate_panel(artifact)["subject_occupancy"]["width_ratio"] = value
            self.assert_valid(artifact)

        for value in (-0.01, 1.01, "0.5", None):
            with self.subTest(invalid_ratio=value):
                artifact = valid_available()
                self.mutate_panel(artifact)["subject_occupancy"]["height_ratio"] = value
                self.assert_invalid(artifact)

    def test_area_ratio_status_branches(self) -> None:
        valid_cases = (
            ("manual_estimate", {"status": "available", "value": 0.37}),
            ("manual_estimate", {"status": "unavailable"}),
            ("segmentation", {"status": "available", "value": 0.37}),
            ("segmentation", {"status": "unavailable"}),
            ("bounding_box", {"status": "unavailable"}),
        )
        for method, area_ratio in valid_cases:
            with self.subTest(method=method, area_ratio=area_ratio):
                artifact = valid_available()
                occupancy = self.mutate_panel(artifact)["subject_occupancy"]
                occupancy["measurement_method"] = method
                occupancy["area_ratio"] = area_ratio
                self.assert_valid(artifact)

        invalid_cases = (
            ("bounding_box", {"status": "available", "value": 0.37}),
            ("bounding_box", {"status": "unavailable", "value": 0.0}),
            ("manual_estimate", {"status": "available"}),
            ("manual_estimate", {"status": "unavailable", "value": 0.0}),
            ("manual_estimate", None),
            ("manual_estimate", {}),
            ("manual_estimate", {"status": "unavailable", "unexpected": True}),
        )
        for method, area_ratio in invalid_cases:
            with self.subTest(method=method, area_ratio=area_ratio):
                artifact = valid_available()
                occupancy = self.mutate_panel(artifact)["subject_occupancy"]
                occupancy["measurement_method"] = method
                occupancy["area_ratio"] = area_ratio
                self.assert_invalid(artifact)

    def test_coverage_complete_and_partial_region_counts(self) -> None:
        self.assert_valid(
            {
                **valid_available(),
                "panels": [available_panel(i, coverage="complete") for i in range(1, 7)],
            }
        )

        artifact = valid_available()
        panel = self.mutate_panel(artifact)
        panel["visibility_coverage"] = {"status": "complete"}
        self.assert_invalid(artifact)

        artifact = valid_available()
        self.mutate_panel(artifact)["visible_regions"] = {}
        self.assert_invalid(artifact)

        artifact = valid_available()
        panel = self.mutate_panel(artifact)
        panel["visible_regions"] = {region: "visible" for region in REGIONS}
        self.assert_invalid(artifact)

    def test_visible_region_names_and_states_are_closed(self) -> None:
        for state in ("visible", "partial", "unclear", "not_visible"):
            with self.subTest(state=state):
                artifact = valid_available()
                self.mutate_panel(artifact)["visible_regions"] = {"face": state}
                self.assert_valid(artifact)

        artifact = valid_available()
        self.mutate_panel(artifact)["visible_regions"] = {"elbows": "visible"}
        self.assert_invalid(artifact)

        artifact = valid_available()
        self.mutate_panel(artifact)["visible_regions"] = {"hands": "mostly_visible"}
        self.assert_invalid(artifact)

    def test_occlusion_duplicates_and_enums_are_structurally_closed(self) -> None:
        artifact = valid_available()
        panel = self.mutate_panel(artifact)
        panel["occlusions"] = [
            {"region": "hands", "cause": "clothing"},
            {"region": "hands", "cause": "hair"},
            {"region": "torso", "cause": "clothing"},
        ]
        self.assert_valid(artifact)

        panel["occlusions"].append({"region": "hands", "cause": "clothing"})
        self.assert_invalid(artifact)

        artifact = valid_available()
        self.mutate_panel(artifact)["occlusions"] = [
            {"region": "hands", "cause": "self_occlusion"}
        ]
        self.assert_valid(artifact)

    def test_source_image_rejects_unsafe_lexical_paths(self) -> None:
        artifact = valid_available()
        self.mutate_panel(artifact)["source_image"] = "panels/BRG-013-A_01.png"
        self.assert_valid(artifact)

        for path in (
            "/tmp/panel.png",
            "C:/images/panel.png",
            "C:images/panel.png",
            "//server/share/panel.png",
            "https://example.com/panel.png",
            "s3://bucket/panel.png",
            "file://server/panel.png",
            "data:image/png;base64,AAAA",
            "custom+scheme:value",
            "panels\\panel.png",
            "../panel.png",
            "panels/../panel.png",
        ):
            with self.subTest(path=path):
                artifact = valid_available()
                self.mutate_panel(artifact)["source_image"] = path
                self.assert_invalid(artifact)

    def test_unknown_root_and_nested_fields_are_rejected(self) -> None:
        artifact = valid_available()
        artifact["unexpected"] = True
        self.assert_invalid(artifact)

        artifact = valid_available()
        self.mutate_panel(artifact)["unexpected"] = True
        self.assert_invalid(artifact)

        artifact = valid_available()
        self.mutate_panel(artifact)["subject_occupancy"]["confidence"] = "high"
        self.assert_invalid(artifact)

    def test_run_id_lexical_form_is_enforced(self) -> None:
        for run_id in ("", " BRG-013-A", "/BRG-013-A", "BRG 013 A"):
            with self.subTest(run_id=run_id):
                artifact = valid_available()
                artifact["run_id"] = run_id
                self.assert_invalid(artifact)

    def test_semantic_rules_are_not_claimed_by_structural_schema(self) -> None:
        artifact = valid_available()
        panels = artifact["panels"]
        panels[0]["panel_id"] = 2
        panels[1]["panel_id"] = 1
        panels[0]["visible_regions"]["hands"] = "visible"
        panels[0]["occlusions"] = [{"region": "hands", "cause": "clothing"}]
        # Ordering, ID uniqueness, image existence, and cross-field image meaning
        # are future Semantic Validator responsibilities.
        self.assert_valid(artifact)


if __name__ == "__main__":
    unittest.main()
