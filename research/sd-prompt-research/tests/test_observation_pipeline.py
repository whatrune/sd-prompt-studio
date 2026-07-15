from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_research_packet import uncertainty_rows  # noqa: E402
from create_reanalysis_candidate import apply_overrides  # noqa: E402
from finalize_observation import rubric_errors, schema_errors  # noqa: E402
from render_observation_md import render  # noqa: E402


def load_rubric() -> dict:
    return yaml.safe_load((ROOT / "templates" / "rubric-template.yaml").read_text(encoding="utf-8"))


def base_observation(rubric: dict) -> dict:
    axes = rubric["active_observation_axes"]
    panels = []
    for panel_id in range(1, 7):
        panels.append({
            "panel_id": panel_id,
            "axis_values": ["unclear" for _ in axes],
            "primary_morphology": "unclear",
            "secondary_morphologies": [],
            "evidence_notes": ["Relevant boundaries and load paths are visible but unclear."],
            "cross_domain_effects": [],
            "artifacts": ["none"],
            "confidence": "low",
            "contact_load": {
                "left_hand": "unclear",
                "right_hand": "unclear",
                "left_forearm": "unclear",
                "right_forearm": "unclear",
            },
        })
    return {
        "schema_version": "3.0",
        "run_id": "TEST-001",
        "blind_condition_label": rubric["blind_condition_label"],
        "panel_count": 6,
        "image_layout": "3x2",
        "active_axis_order": axes,
        "summary": {"overall_visible_pattern": [], "analysis_notes": []},
        "panels": panels,
        "leakage": [],
        "uncertain": [],
        "ontology_extension_candidates": [],
        "cross_condition_comparison": {
            "status": "not_performed",
            "reason": "Research comparison was not performed.",
            "observations": [],
        },
    }


def set_axis(data: dict, panel_id: int, axis: str, value: str) -> None:
    index = data["active_axis_order"].index(axis)
    data["panels"][panel_id - 1]["axis_values"][index] = value


class ObservationPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.rubric = load_rubric()
        self.data = base_observation(self.rubric)

    def errors(self, data: dict | None = None, rubric: dict | None = None) -> list[str]:
        errors, _ = rubric_errors(data or self.data, rubric or self.rubric)
        return errors

    def test_schema_version_and_axis_order_remain_v3_compatible(self) -> None:
        schema = json.loads((ROOT / "templates" / "observation-schema.json").read_text(encoding="utf-8"))
        self.assertEqual("3.0", schema["properties"]["schema_version"]["const"])
        self.assertEqual([], schema_errors(self.data, schema))
        self.assertEqual(self.rubric["active_observation_axes"], self.data["active_axis_order"])

    def test_new_rear_arm_support_value_is_allowed_with_visible_load_path(self) -> None:
        self.assertIn("rear_arm_support", self.rubric["axis_catalog"]["support_orientation"]["allowed_values"])
        set_axis(self.data, 1, "support_orientation", "rear_arm_support")
        self.data["panels"][0]["evidence_notes"] = [
            "A directly visible right hand load path supports the upper body from behind the torso."
        ]
        self.assertEqual([], self.errors())

    def test_elevated_hip_requires_visible_pelvis_gap_note(self) -> None:
        set_axis(self.data, 1, "hip_elevation", "low")
        self.data["panels"][0]["evidence_notes"] = ["The torso is visibly raised."]
        self.assertTrue(any("pelvis-to-surface gap" in error for error in self.errors()))

    def test_japanese_visible_pelvis_gap_note_is_accepted(self) -> None:
        set_axis(self.data, 1, "hip_elevation", "low")
        self.data["panels"][0]["evidence_notes"] = ["骨盤と床面の間に明確な隙間が見える。"]
        self.assertEqual([], self.errors())

    def test_head_and_shoulder_contact_require_direct_boundaries(self) -> None:
        set_axis(self.data, 1, "head_surface_contact", "floor")
        set_axis(self.data, 1, "shoulder_surface_contact", "both")
        self.data["panels"][0]["evidence_notes"] = ["The body state is visibly lying face up."]
        errors = self.errors()
        self.assertTrue(any("head contact boundary" in error for error in errors))
        self.assertTrue(any("shoulder contact boundary" in error for error in errors))

    def test_supporting_load_requires_visible_load_path(self) -> None:
        self.data["panels"][0]["contact_load"]["left_hand"] = "supporting"
        self.data["panels"][0]["evidence_notes"] = ["The left hand visibly touches the floor."]
        self.assertTrue(any("contact_load.left_hand" in error for error in self.errors()))

    def test_image_analyst_cannot_record_prompt_concept_leakage(self) -> None:
        self.data["leakage"] = [{
            "type": "reclined_arm_support",
            "panel_ids": [1],
            "strength": "medium",
            "observation": "A visible morphology was treated as leakage.",
        }]
        self.assertTrue(any("research-stage only" in error for error in self.errors()))

    def test_unclear_values_do_not_require_invented_direct_evidence(self) -> None:
        self.assertEqual([], self.errors())

    def test_historical_rubric_can_opt_out_of_new_policy(self) -> None:
        old_rubric = copy.deepcopy(self.rubric)
        old_rubric["rules"]["enforce_visible_evidence_policy"] = False
        set_axis(self.data, 1, "hip_elevation", "low")
        self.data["panels"][0]["evidence_notes"] = ["Torso is raised."]
        self.assertEqual([], self.errors(rubric=old_rubric))

    def test_markdown_separates_artifacts_leakage_and_morphology(self) -> None:
        self.data["panels"][0]["primary_morphology"] = "reclined_arm_support"
        output = render(self.data, self.rubric)
        self.assertIn("## Visual Artifacts\n\n- none observed", output)
        self.assertIn("## Prompt / Concept Leakage\n\n- not assessed", output)
        self.assertIn("## Observed Morphologies\n\n- reclined_arm_support", output)

    def test_packet_summary_keeps_four_observation_categories_separate(self) -> None:
        self.data["panels"][0]["primary_morphology"] = "reclined_arm_support"
        self.data["computed_aggregate"] = {
            "primary_morphology_counts": {"reclined_arm_support": 1, "lying_pose": 5},
            "secondary_morphology_counts": {},
        }
        rows = uncertainty_rows([{"dir": ROOT / "BRG-007-B", "observation": self.data}])
        self.assertEqual(
            [
                "Run", "Uncertain", "Visual Artifacts", "Prompt / Concept Leakage",
                "Primary Morphologies", "Secondary Morphologies",
            ],
            rows[0],
        )
        self.assertEqual("none observed", rows[1][2])
        self.assertEqual("not assessed", rows[1][3])
        self.assertEqual("lying_pose = 5 / 6\nreclined_arm_support = 1 / 6", rows[1][4])
        self.assertEqual("none observed", rows[1][5])

    def test_packet_summary_uses_separate_brg007_morphology_aggregates(self) -> None:
        expected = {
            "BRG-007-A": (
                "lying_arch = 3 / 6\nlying_pose = 3 / 6",
                "lying_arch = 3 / 6\nlying_pose = 3 / 6",
            ),
            "BRG-007-B": (
                "lying_arch = 1 / 6\nreclined_arm_support = 5 / 6",
                "reclined_arm_support = 1 / 6\nreclined_pose = 3 / 6\nseated_arch = 2 / 6",
            ),
            "BRG-007-C": (
                "lying_arch = 2 / 6\nlying_pose = 4 / 6",
                "lying_arch = 4 / 6\nlying_pose = 2 / 6",
            ),
        }
        runs = []
        for run_id in expected:
            run_dir = ROOT / "experiments" / "bridge" / run_id
            observation = json.loads((run_dir / "observation.json").read_text(encoding="utf-8"))
            runs.append({"dir": run_dir, "observation": observation})
        rows = uncertainty_rows(runs)
        self.assertEqual(4, len(rows))
        for row in rows[1:]:
            self.assertEqual(expected[row[0]], (row[4], row[5]))

    def test_reanalysis_overrides_preserve_axis_order_and_remove_stale_aggregate(self) -> None:
        self.data["computed_aggregate"] = {"axis_counts": {}}
        updated = apply_overrides(self.data, {
            "panels": {1: {"axis_values": {"hip_elevation": "unclear"}}},
            "leakage": [],
        })
        self.assertEqual(self.data["active_axis_order"], updated["active_axis_order"])
        self.assertNotIn("computed_aggregate", updated)
        index = updated["active_axis_order"].index("hip_elevation")
        self.assertEqual("unclear", updated["panels"][0]["axis_values"][index])


if __name__ == "__main__":
    unittest.main()
