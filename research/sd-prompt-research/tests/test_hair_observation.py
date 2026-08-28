from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from finalize_hair_observation import (  # noqa: E402
    HAIR_V1_AXES,
    compute_aggregate,
    policy_errors,
    schema_errors,
    stored_aggregate_errors,
)


def base_hair_observation() -> dict:
    values = [
        ("above_neck", "absent", "absent", "distinct"),
        ("neck_to_shoulder", "present", "absent", "distinct"),
        ("below_shoulder", "present", "present", "distinct"),
        ("waist_or_longer", "present", "present", "ambiguous_with_clothing"),
        ("unclear", "unclear", "unclear", "ambiguous_with_background"),
        ("not_visible", "not_visible", "not_visible", "not_visible"),
    ]
    panels = []
    for panel_id, row in enumerate(values, start=1):
        panels.append(
            {
                "panel_id": panel_id,
                "hair_length_extent": row[0],
                "neck_hair_overlap": row[1],
                "shoulder_hair_overlap": row[2],
                "hair_identity_clarity": row[3],
                "evidence_notes": [f"Panel {panel_id} visible hair evidence."],
                "confidence": "high" if panel_id < 5 else "low",
            }
        )
    return {
        "schema_version": "1.0",
        "run_id": "HAIR-TEST-A",
        "blind_condition_label": "Condition A",
        "panel_count": 6,
        "hair_observation": {
            "enabled": True,
            "active_axis_order": list(HAIR_V1_AXES),
            "panels": panels,
        },
    }


class HairObservationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads(
            (ROOT / "templates" / "hair-observation-schema.json").read_text(encoding="utf-8")
        )
        cls.rubric = yaml.safe_load(
            (ROOT / "templates" / "hair-observation-rubric.yaml").read_text(encoding="utf-8")
        )
        cls.manifest = {"run_id": "HAIR-TEST-A"}

    def setUp(self) -> None:
        self.data = base_hair_observation()

    def test_valid_hair_v1_finalizes_deterministically_with_all_cells(self) -> None:
        self.assertEqual([], schema_errors(self.data, self.schema))
        self.assertEqual([], policy_errors(self.data, self.rubric, self.manifest))
        first = compute_aggregate(self.data)
        second = compute_aggregate(copy.deepcopy(self.data))
        self.assertEqual(first, second)
        self.assertEqual(list(HAIR_V1_AXES), list(first["axis_counts"]))
        self.assertEqual(19, sum(len(counts) for counts in first["axis_counts"].values()))
        self.assertEqual(0, first["axis_counts"]["hair_identity_clarity"]["artifact"])
        for counts in first["axis_counts"].values():
            self.assertEqual(6, sum(counts.values()))

    def test_missing_axis_fails_closed(self) -> None:
        del self.data["hair_observation"]["panels"][0]["neck_hair_overlap"]
        self.assertTrue(schema_errors(self.data, self.schema))

    def test_extra_axis_fails_closed(self) -> None:
        self.data["hair_observation"]["panels"][0]["hand_near_head"] = "present"
        self.assertTrue(schema_errors(self.data, self.schema))

    def test_invalid_enum_fails_closed(self) -> None:
        self.data["hair_observation"]["panels"][0]["hair_length_extent"] = "very_long"
        self.assertTrue(schema_errors(self.data, self.schema))
        self.assertTrue(policy_errors(self.data, self.rubric, self.manifest))

    def test_duplicate_and_missing_panel_ids_fail_closed(self) -> None:
        self.data["hair_observation"]["panels"][5]["panel_id"] = 5
        errors = policy_errors(self.data, self.rubric, self.manifest)
        self.assertTrue(any("exactly integer IDs 1..6" in error for error in errors))

    def test_run_mismatch_fails_closed(self) -> None:
        errors = policy_errors(self.data, self.rubric, {"run_id": "HAIR-TEST-B"})
        self.assertTrue(any("run_id must match manifest" in error for error in errors))

    def test_aggregate_tampering_fails_closed(self) -> None:
        self.data["computed_aggregate"] = compute_aggregate(self.data)
        self.data["computed_aggregate"]["axis_counts"]["hair_length_extent"]["above_neck"] = 2
        self.assertEqual(
            ["computed_aggregate does not match the aggregate recomputed from panel data"],
            stored_aggregate_errors(self.data),
        )

    def test_cli_writes_then_revalidates_exact_aggregate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory) / "experiments" / "hair" / "HAIR-TEST-A"
            run_dir.mkdir(parents=True)
            observation_path = run_dir / "hair-observation.json"
            observation_path.write_text(json.dumps(self.data), encoding="utf-8")
            (run_dir / "manifest.yaml").write_text("run_id: HAIR-TEST-A\n", encoding="utf-8")
            command = [
                sys.executable,
                str(ROOT / "scripts" / "finalize_hair_observation.py"),
                "--run-dir", str(run_dir),
                "--rubric", str(ROOT / "templates" / "hair-observation-rubric.yaml"),
                "--schema", str(ROOT / "templates" / "hair-observation-schema.json"),
            ]
            first = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(0, first.returncode, first.stderr)
            stored = json.loads(observation_path.read_text(encoding="utf-8"))
            self.assertEqual(compute_aggregate(stored), stored["computed_aggregate"])
            second = subprocess.run([*command, "--no-write"], capture_output=True, text=True, check=False)
            self.assertEqual(0, second.returncode, second.stderr)


if __name__ == "__main__":
    unittest.main()
