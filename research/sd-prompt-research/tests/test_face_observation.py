from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_research_packet import face_aggregate_rows, face_compare_value  # noqa: E402
from finalize_face_observation import compute_aggregate, policy_errors, schema_errors  # noqa: E402


def base_face_observation() -> dict:
    axes = [
        "neck_extension", "chin_elevation", "face_orientation", "face_visibility",
        "gaze_direction", "eyelid_state", "mouth_state", "facial_foreshortening",
        "facial_distortion",
    ]
    panel = {
        "neck_extension": "unclear",
        "chin_elevation": "unclear",
        "face_orientation": "unclear",
        "face_visibility": "partial",
        "gaze_direction": "unclear",
        "eyelid_state": "unclear",
        "mouth_state": "unclear",
        "facial_foreshortening": "unclear",
        "facial_distortion": "none",
        "evidence_notes": ["Visible face geometry is partial; uncertain fields are not inferred."],
        "confidence": "low",
    }
    return {
        "schema_version": "1.0",
        "run_id": "TEST-001",
        "blind_condition_label": "Condition A",
        "panel_count": 6,
        "face_observation": {
            "enabled": True,
            "active_axis_order": axes,
            "panels": [{"panel_id": panel_id, **panel} for panel_id in range(1, 7)],
        },
        "cross_domain_effects": [],
    }


class FaceObservationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads((ROOT / "templates" / "face-observation-schema.json").read_text(encoding="utf-8"))
        cls.rubric = yaml.safe_load((ROOT / "templates" / "face-observation-rubric.yaml").read_text(encoding="utf-8"))
        cls.manifest = {"run_id": "TEST-001"}

    def setUp(self) -> None:
        self.data = base_face_observation()

    def test_optional_face_payload_passes_schema_and_policy(self) -> None:
        self.assertEqual([], schema_errors(self.data, self.schema))
        self.assertEqual([], policy_errors(self.data, self.rubric, self.manifest))

    def test_pose_schema_v3_remains_unchanged_and_does_not_require_face(self) -> None:
        pose_schema = json.loads((ROOT / "templates" / "observation-schema.json").read_text(encoding="utf-8"))
        self.assertEqual("3.0", pose_schema["properties"]["schema_version"]["const"])
        self.assertNotIn("face_observation", pose_schema["required"])
        self.assertNotIn("face_observation", pose_schema["properties"])

    def test_cross_domain_effect_must_match_visible_panel_value(self) -> None:
        self.data["face_observation"]["panels"][0]["eyelid_state"] = "open"
        self.data["cross_domain_effects"] = [{
            "panel_id": 1,
            "target_module": "face",
            "observed_effect": "eyelid_state:closed",
            "evidence_region": "eyelids",
            "confidence": "medium",
        }]
        errors = policy_errors(self.data, self.rubric, self.manifest)
        self.assertTrue(any("does not match panel value" in error for error in errors))

    def test_source_concept_is_rejected_by_schema(self) -> None:
        self.data["cross_domain_effects"] = [{
            "panel_id": 1,
            "target_module": "face",
            "observed_effect": "eyelid_state:unclear",
            "evidence_region": "eyelids",
            "confidence": "low",
            "source_concept": "head_neck_orientation",
        }]
        self.assertTrue(any("Additional properties" in error for error in schema_errors(self.data, self.schema)))

    def test_emotion_meaning_is_rejected_from_evidence_notes(self) -> None:
        self.data["face_observation"]["panels"][0]["evidence_notes"] = ["The visible expression looks happy."]
        errors = policy_errors(self.data, self.rubric, self.manifest)
        self.assertTrue(any("emotion meaning" in error for error in errors))

    def test_aggregate_counts_each_face_axis_without_phrase_interpretation(self) -> None:
        self.data["face_observation"]["panels"][0]["eyelid_state"] = "open"
        self.data["face_observation"]["panels"][1]["eyelid_state"] = "closed"
        aggregate = compute_aggregate(self.data)
        self.assertEqual({"closed": 1, "open": 1, "unclear": 4}, aggregate["axis_counts"]["eyelid_state"])
        self.assertNotIn("source_phrase", aggregate)

    def test_packet_face_counts_use_x_over_panel_count_format(self) -> None:
        payload = copy.deepcopy(self.data)
        payload["computed_aggregate"] = compute_aggregate(payload)
        rows = face_aggregate_rows(payload)
        eyelid_row = next(row for row in rows if row[0] == "eyelid_state")
        self.assertEqual("unclear = 6 / 6", eyelid_row[1])
        self.assertEqual("unclear = 6 / 6", face_compare_value(payload, "eyelid_state"))


if __name__ == "__main__":
    unittest.main()
