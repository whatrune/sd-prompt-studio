from __future__ import annotations

import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "camera-visibility-metadata.schema.json"


def valid_available() -> dict:
    return {
        "schema_version": "0.1.0",
        "run_id": "BRG-013-A",
        "visibility_status": "available",
        "camera": {
            "framing": "full_body",
            "angle": {"horizontal": "side", "vertical": "eye_level"},
            "perspective": "unknown",
        },
        "subject_occupancy": {
            "width_ratio": 0.64,
            "height_ratio": 0.88,
            "area_ratio": 0.37,
        },
        "visible_regions": {
            "hands": "partial",
            "feet": "visible",
            "knees": "unclear",
        },
        "occlusions": [{"region": "hands", "cause": "clothing"}],
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

    def test_schema_is_valid_draft_2020_12(self) -> None:
        self.assertEqual(
            "https://json-schema.org/draft/2020-12/schema",
            self.schema["$schema"],
        )
        self.assertEqual("0.1.0", self.schema["x-contract-version"])

    def test_available_artifact_is_valid(self) -> None:
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

    def test_unavailable_artifact_is_valid(self) -> None:
        self.assert_valid(
            {
                "schema_version": "0.1.0",
                "run_id": "BRG-013-A",
                "visibility_status": "unavailable",
                "unavailable_reason": "Primary subject could not be identified.",
            }
        )

    def test_available_requires_metadata_and_forbids_reason(self) -> None:
        for field in ("camera", "subject_occupancy", "visible_regions"):
            with self.subTest(field=field):
                artifact = valid_available()
                artifact.pop(field)
                self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["unavailable_reason"] = "not allowed"
        self.assert_invalid(artifact)

    def test_unavailable_requires_nonempty_reason_and_forbids_metadata(self) -> None:
        artifact = {
            "schema_version": "0.1.0",
            "run_id": "BRG-013-A",
            "visibility_status": "unavailable",
        }
        self.assert_invalid(artifact)

        artifact["unavailable_reason"] = ""
        self.assert_invalid(artifact)

        for field in ("camera", "subject_occupancy", "visible_regions", "occlusions"):
            with self.subTest(field=field):
                invalid = dict(artifact)
                invalid["unavailable_reason"] = "not recorded"
                invalid[field] = valid_available()[field]
                self.assert_invalid(invalid)

    def test_unknown_root_and_nested_fields_are_rejected(self) -> None:
        artifact = valid_available()
        artifact["unexpected"] = True
        self.assert_invalid(artifact)

        nested_cases = [
            ("camera", "fixed"),
            ("subject_occupancy", "measurement_confidence"),
            ("visible_regions", "foot_contact_confidence"),
        ]
        for parent, field in nested_cases:
            with self.subTest(parent=parent, field=field):
                artifact = valid_available()
                artifact[parent][field] = "low"
                self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["camera"]["angle"]["roll"] = "level"
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["occlusions"][0]["confidence"] = "low"
        self.assert_invalid(artifact)

    def test_camera_fields_and_enums_are_closed(self) -> None:
        mutations = [("framing", "medium_shot"), ("perspective", "fisheye")]
        for field, value in mutations:
            with self.subTest(field=field):
                artifact = valid_available()
                artifact["camera"][field] = value
                self.assert_invalid(artifact)

        for field, value in (("horizontal", "rear"), ("vertical", "dutch_angle")):
            with self.subTest(field=field):
                artifact = valid_available()
                artifact["camera"]["angle"][field] = value
                self.assert_invalid(artifact)

        for field in ("framing", "angle", "perspective"):
            with self.subTest(required_field=field):
                artifact = valid_available()
                artifact["camera"].pop(field)
                self.assert_invalid(artifact)

        for field in ("horizontal", "vertical"):
            with self.subTest(required_angle_field=field):
                artifact = valid_available()
                artifact["camera"]["angle"].pop(field)
                self.assert_invalid(artifact)

    def test_ratios_accept_boundaries_and_reject_out_of_range_or_wrong_type(self) -> None:
        for value in (0.0, 1.0):
            with self.subTest(valid_boundary=value):
                artifact = valid_available()
                artifact["subject_occupancy"]["area_ratio"] = value
                self.assert_valid(artifact)

        for value in (-0.01, 1.01, "0.5", None):
            with self.subTest(invalid_ratio=value):
                artifact = valid_available()
                artifact["subject_occupancy"]["width_ratio"] = value
                self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["subject_occupancy"].pop("height_ratio")
        self.assert_invalid(artifact)

    def test_visible_regions_require_registered_nonempty_valid_states(self) -> None:
        artifact = valid_available()
        artifact["visible_regions"] = {}
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["visible_regions"]["elbows"] = "visible"
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["visible_regions"]["hands"] = "mostly_visible"
        self.assert_invalid(artifact)

        for state in ("visible", "partial", "unclear", "not_visible"):
            with self.subTest(state=state):
                artifact = valid_available()
                artifact["visible_regions"] = {"face": state}
                self.assert_valid(artifact)

    def test_occlusion_shape_region_and_cause_are_closed(self) -> None:
        artifact = valid_available()
        artifact["occlusions"] = []
        self.assert_valid(artifact)

        artifact = valid_available()
        artifact["occlusions"][0]["region"] = "elbows"
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["occlusions"][0]["cause"] = "pose"
        self.assert_invalid(artifact)

        for field in ("region", "cause"):
            with self.subTest(required_field=field):
                artifact = valid_available()
                artifact["occlusions"][0].pop(field)
                self.assert_invalid(artifact)

    def test_run_id_lexical_form_is_enforced(self) -> None:
        for run_id in ("", " BRG-013-A", "/BRG-013-A", "BRG 013 A"):
            with self.subTest(run_id=run_id):
                artifact = valid_available()
                artifact["run_id"] = run_id
                self.assert_invalid(artifact)

    def test_schema_does_not_claim_semantic_validation(self) -> None:
        artifact = valid_available()
        artifact["visible_regions"]["hands"] = "visible"
        artifact["occlusions"] = [{"region": "hands", "cause": "clothing"}]
        # Cross-field consistency is a documented future Semantic Validator
        # responsibility, not Structural Schema behavior in PR82.
        self.assert_valid(artifact)


if __name__ == "__main__":
    unittest.main()
