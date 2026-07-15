from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_research_packet import (  # noqa: E402
    FACE_COMPARE_FIELDS,
    OPTIONAL_MODULE_OBSERVATION_NOTE,
    face_compare_value,
    load_run,
    optional_module_aggregate_rows,
    optional_module_cross_condition_metric_rows,
    optional_module_metric_groups,
    optional_module_vertical_count_text,
)
from finalize_face_observation import (  # noqa: E402
    compute_aggregate,
    policy_errors,
    schema_errors,
    stored_aggregate_errors,
)


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

    def test_cross_domain_effect_selection_is_rejected_during_observation(self) -> None:
        self.data["face_observation"]["panels"][0]["eyelid_state"] = "open"
        self.data["cross_domain_effects"] = [{
            "panel_id": 1,
            "target_module": "face",
            "observed_effect": "eyelid_state:closed",
            "evidence_region": "eyelids",
            "confidence": "medium",
        }]
        errors = policy_errors(self.data, self.rubric, self.manifest)
        self.assertTrue(any("must remain empty" in error for error in errors))

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

    def test_stored_aggregate_must_exist_and_match_panels(self) -> None:
        self.assertTrue(any("required" in error for error in stored_aggregate_errors(self.data)))
        self.data["computed_aggregate"] = compute_aggregate(self.data)
        self.assertEqual([], stored_aggregate_errors(self.data))
        self.data["computed_aggregate"]["axis_counts"]["eyelid_state"] = {"open": 6}
        self.assertTrue(any("does not match" in error for error in stored_aggregate_errors(self.data)))

    def test_packet_ignores_unconfigured_face_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run_dir = root / "experiments" / "bridge" / "TEST-001"
            (run_dir / "preview").mkdir(parents=True)
            (run_dir / "manifest.yaml").write_text(
                yaml.safe_dump({"run_id": "TEST-001", "status": "OBSERVED", "outputs": {}}),
                encoding="utf-8",
            )
            (run_dir / "observation.json").write_text(
                json.dumps({"run_id": "TEST-001"}), encoding="utf-8"
            )
            (run_dir / "observation.md").write_text("observation", encoding="utf-8")
            (run_dir / "preview" / "TEST-001_preview.jpg").write_bytes(b"preview")
            face = base_face_observation()
            face["computed_aggregate"] = compute_aggregate(face)
            (run_dir / "face-observation.json").write_text(json.dumps(face), encoding="utf-8")

            self.assertIsNone(load_run(run_dir)["face_observation"])

    def test_packet_loads_configured_valid_face_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run_dir = root / "experiments" / "bridge" / "TEST-001"
            templates = root / "templates"
            (run_dir / "preview").mkdir(parents=True)
            templates.mkdir()
            (templates / "face-observation-schema.json").write_text(
                json.dumps(self.schema), encoding="utf-8"
            )
            (templates / "face-observation-rubric.yaml").write_text(
                yaml.safe_dump(self.rubric), encoding="utf-8"
            )
            manifest = {
                "run_id": "TEST-001",
                "status": "OBSERVED",
                "outputs": {
                    "face_observation_json": "face-observation.json",
                    "face_observation_schema": "templates/face-observation-schema.json",
                    "face_observation_rubric": "templates/face-observation-rubric.yaml",
                },
            }
            (run_dir / "manifest.yaml").write_text(
                yaml.safe_dump(manifest), encoding="utf-8"
            )
            (run_dir / "observation.json").write_text(
                json.dumps({"run_id": "TEST-001"}), encoding="utf-8"
            )
            (run_dir / "observation.md").write_text("observation", encoding="utf-8")
            (run_dir / "preview" / "TEST-001_preview.jpg").write_bytes(b"preview")
            face = base_face_observation()
            face["computed_aggregate"] = compute_aggregate(face)
            (run_dir / "face-observation.json").write_text(
                json.dumps(face), encoding="utf-8"
            )

            run = load_run(run_dir)
            self.assertIsNotNone(run["face_observation"])
            self.assertEqual([], stored_aggregate_errors(run["face_observation"]))

    def test_brg_008_manifests_keep_condition_labels(self) -> None:
        for suffix in ("A", "B", "C"):
            run_dir = ROOT / "experiments" / "bridge" / f"BRG-008-{suffix}"
            manifest = yaml.safe_load((run_dir / "manifest.yaml").read_text(encoding="utf-8"))
            observation = json.loads((run_dir / "observation.json").read_text(encoding="utf-8"))
            self.assertEqual(f"Condition {suffix}", manifest.get("condition"))
            self.assertEqual(manifest["condition"], observation["blind_condition_label"])

    def test_packet_rejects_configured_stale_face_aggregate(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run_dir = root / "experiments" / "bridge" / "TEST-001"
            templates = root / "templates"
            (run_dir / "preview").mkdir(parents=True)
            templates.mkdir()
            (templates / "face-observation-schema.json").write_text(
                json.dumps(self.schema), encoding="utf-8"
            )
            (templates / "face-observation-rubric.yaml").write_text(
                yaml.safe_dump(self.rubric), encoding="utf-8"
            )
            outputs = {
                "face_observation_json": "face-observation.json",
                "face_observation_schema": "templates/face-observation-schema.json",
                "face_observation_rubric": "templates/face-observation-rubric.yaml",
            }
            (run_dir / "manifest.yaml").write_text(
                yaml.safe_dump({"run_id": "TEST-001", "status": "OBSERVED", "outputs": outputs}),
                encoding="utf-8",
            )
            (run_dir / "observation.json").write_text(
                json.dumps({"run_id": "TEST-001"}), encoding="utf-8"
            )
            (run_dir / "observation.md").write_text("observation", encoding="utf-8")
            (run_dir / "preview" / "TEST-001_preview.jpg").write_bytes(b"preview")
            face = base_face_observation()
            face["computed_aggregate"] = compute_aggregate(face)
            face["computed_aggregate"]["axis_counts"]["eyelid_state"] = {"open": 6}
            (run_dir / "face-observation.json").write_text(json.dumps(face), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "does not match"):
                load_run(run_dir)

    def test_packet_face_counts_use_x_over_panel_count_format(self) -> None:
        payload = copy.deepcopy(self.data)
        payload["computed_aggregate"] = compute_aggregate(payload)
        rows = optional_module_aggregate_rows(payload, "face_observation")
        self.assertEqual(["Metric", "Counts"], rows[0])
        eyelid_row = next(row for row in rows if row[0] == "eyelid_state")
        self.assertEqual("unclear = 6 / 6", eyelid_row[1])
        self.assertEqual("unclear = 6 / 6", face_compare_value(payload, "eyelid_state"))

    def test_packet_face_cross_condition_uses_vertical_run_rows_for_all_metrics(self) -> None:
        payload = copy.deepcopy(self.data)
        payload["computed_aggregate"] = compute_aggregate(payload)
        runs = [
            {"dir": Path(f"BRG-008-{suffix}"), "face_observation": payload}
            for suffix in ("A", "B", "C")
        ]

        groups = optional_module_metric_groups(FACE_COMPARE_FIELDS)
        self.assertEqual(list(FACE_COMPARE_FIELDS), [field for group in groups for field in group])
        self.assertEqual(9, len(FACE_COMPARE_FIELDS))
        for field in FACE_COMPARE_FIELDS:
            rows = optional_module_cross_condition_metric_rows(runs, "face_observation", field)
            self.assertEqual(["Run", "Observed counts"], rows[0])
            self.assertEqual(["BRG-008-A", "BRG-008-B", "BRG-008-C"], [row[0] for row in rows[1:]])
            self.assertTrue(all("6 / 6" in row[1] for row in rows[1:]))

    def test_packet_face_vertical_counts_hide_zero_values(self) -> None:
        self.assertEqual(
            "open: 3 / 6",
            optional_module_vertical_count_text({"closed": 0, "open": 3}, 6),
        )
        self.assertEqual(
            "none observed",
            optional_module_vertical_count_text({"closed": 0}, 6),
        )

    def test_optional_module_header_keeps_observation_and_interpretation_separate(self) -> None:
        for label in (
            "This module contains visible-state observations only.",
            "Prompt effect", "Intent", "Emotion meaning", "Success / failure judgment",
            "Visible geometry", "Orientation", "State", "Visibility",
        ):
            self.assertIn(label, OPTIONAL_MODULE_OBSERVATION_NOTE)

    def test_policy_reports_invalid_panel_ids_without_crashing(self) -> None:
        self.data["face_observation"]["panels"][0]["panel_id"] = None
        errors = policy_errors(self.data, self.rubric, self.manifest)
        self.assertTrue(any("integer IDs 1..6" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
