from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "image-observation-evidence-rule.schema.json"


def valid_rule(*, branch: str = "all_of") -> dict:
    return {
        "rule_id": "evidence_rule.fixture.left_hand_surface_contact",
        "axis_ref": {
            "observation_module": "pose",
            "axis_name": "left_hand_surface_contact",
        },
        "rubric_ref": {
            "rubric_path": "templates/rubric-template.yaml",
            "rubric_hash_contract": "normalized_text_file_sha256_v1",
            "rubric_sha256": "0" * 64,
        },
        "visibility_prerequisite": {
            branch: [{"region": "hands", "allowed_states": ["visible", "partial"]}]
        },
        "observation_values_requiring_prerequisite": ["floor", "wall", "object"],
        "insufficient_visibility_policy": {
            "allowed_fallback_values": ["unclear", "not_visible"]
        },
    }


def valid_rule_set(*, branch: str = "all_of") -> dict:
    return {
        "schema_version": "0.1.0",
        "rule_set_id": "evidence-rule-fixture",
        "target_contracts": {
            "observation_module": "pose",
            "observation_schema_version": "3.0",
            "camera_visibility_metadata_schema_version": "0.1.0",
        },
        "rules": [valid_rule(branch=branch)],
    }


class ImageObservationEvidenceRuleSchemaTests(unittest.TestCase):
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

    def test_non_normative_fixture_and_both_branches_are_valid(self) -> None:
        self.assert_valid(valid_rule_set(branch="all_of"))
        self.assert_valid(valid_rule_set(branch="any_of"))

    def test_root_and_target_contracts_are_closed_and_fixed(self) -> None:
        for field, value in (
            ("schema_version", "0.2.0"),
            ("observation_module", "face"),
            ("observation_schema_version", "4.0"),
            ("camera_visibility_metadata_schema_version", "0.2.0"),
        ):
            with self.subTest(field=field):
                artifact = valid_rule_set()
                target = artifact if field == "schema_version" else artifact["target_contracts"]
                target[field] = value
                self.assert_invalid(artifact)

        for target in ("root", "target_contracts"):
            artifact = valid_rule_set()
            container = artifact if target == "root" else artifact["target_contracts"]
            container["unexpected"] = True
            self.assert_invalid(artifact)

    def test_required_fields_are_enforced(self) -> None:
        for field in ("schema_version", "rule_set_id", "target_contracts", "rules"):
            with self.subTest(root_field=field):
                artifact = valid_rule_set()
                artifact.pop(field)
                self.assert_invalid(artifact)

        for field in (
            "rule_id",
            "axis_ref",
            "rubric_ref",
            "visibility_prerequisite",
            "observation_values_requiring_prerequisite",
            "insufficient_visibility_policy",
        ):
            with self.subTest(rule_field=field):
                artifact = valid_rule_set()
                artifact["rules"][0].pop(field)
                self.assert_invalid(artifact)

    def test_pose_module_and_identifier_patterns_are_enforced(self) -> None:
        artifact = valid_rule_set()
        artifact["rules"][0]["axis_ref"]["observation_module"] = "face"
        self.assert_invalid(artifact)

        for key, value in (
            ("rule_set_id", "Invalid Rule Set"),
            ("rule_id", "rule.invalid"),
            ("axis_name", "Left Hand Contact"),
        ):
            with self.subTest(key=key):
                artifact = valid_rule_set()
                if key == "rule_set_id":
                    artifact[key] = value
                elif key == "rule_id":
                    artifact["rules"][0][key] = value
                else:
                    artifact["rules"][0]["axis_ref"][key] = value
                self.assert_invalid(artifact)

    def test_visibility_prerequisite_requires_exactly_one_nonempty_branch(self) -> None:
        artifact = valid_rule_set()
        prerequisite = artifact["rules"][0]["visibility_prerequisite"]
        prerequisite["any_of"] = copy.deepcopy(prerequisite["all_of"])
        self.assert_invalid(artifact)

        artifact = valid_rule_set()
        artifact["rules"][0]["visibility_prerequisite"] = {}
        self.assert_invalid(artifact)

        for branch in ("all_of", "any_of"):
            with self.subTest(branch=branch):
                artifact = valid_rule_set(branch=branch)
                artifact["rules"][0]["visibility_prerequisite"][branch] = []
                self.assert_invalid(artifact)

    def test_arrays_reject_exact_duplicates_and_empty_values(self) -> None:
        artifact = valid_rule_set()
        conditions = artifact["rules"][0]["visibility_prerequisite"]["all_of"]
        conditions.append(copy.deepcopy(conditions[0]))
        self.assert_invalid(artifact)

        artifact = valid_rule_set()
        states = artifact["rules"][0]["visibility_prerequisite"]["all_of"][0][
            "allowed_states"
        ]
        states.append("visible")
        self.assert_invalid(artifact)

        for field_path in ("observation", "fallback"):
            artifact = valid_rule_set()
            rule = artifact["rules"][0]
            values = (
                rule["observation_values_requiring_prerequisite"]
                if field_path == "observation"
                else rule["insufficient_visibility_policy"]["allowed_fallback_values"]
            )
            values.append(values[0])
            self.assert_invalid(artifact)

        artifact = valid_rule_set()
        artifact["rules"].append(copy.deepcopy(artifact["rules"][0]))
        self.assert_invalid(artifact)

    def test_region_state_and_value_vocabularies_are_closed(self) -> None:
        for region in (
            "head", "face", "hair", "neck", "shoulders", "arms",
            "hands", "torso", "hips", "legs", "knees", "feet",
        ):
            with self.subTest(region=region):
                artifact = valid_rule_set()
                condition = artifact["rules"][0]["visibility_prerequisite"]["all_of"][0]
                condition["region"] = region
                self.assert_valid(artifact)

        for state in ("visible", "partial", "unclear", "not_visible"):
            with self.subTest(state=state):
                artifact = valid_rule_set()
                condition = artifact["rules"][0]["visibility_prerequisite"]["all_of"][0]
                condition["allowed_states"] = [state]
                self.assert_valid(artifact)

        artifact = valid_rule_set()
        artifact["rules"][0]["visibility_prerequisite"]["all_of"][0]["region"] = "elbows"
        self.assert_invalid(artifact)

        artifact = valid_rule_set()
        artifact["rules"][0]["observation_values_requiring_prerequisite"] = ["Not Valid"]
        self.assert_invalid(artifact)

    def test_rubric_reference_hash_contract_and_format_are_fixed(self) -> None:
        for contract in ("jcs_sha256_v1", "normalized_text_file_sha256_v2"):
            artifact = valid_rule_set()
            artifact["rules"][0]["rubric_ref"]["rubric_hash_contract"] = contract
            self.assert_invalid(artifact)

        for value in ("A" * 64, "0" * 63, "0" * 65, "g" * 64):
            with self.subTest(hash_value=value):
                artifact = valid_rule_set()
                artifact["rules"][0]["rubric_ref"]["rubric_sha256"] = value
                self.assert_invalid(artifact)

    def test_rubric_path_rejects_unsafe_lexical_forms(self) -> None:
        self.assert_valid(valid_rule_set())
        for path in (
            "",
            "/tmp/rubric.yaml",
            "C:/rubric.yaml",
            "C:rubric.yaml",
            "//server/share/rubric.yaml",
            "https://example.com/rubric.yaml",
            "s3://bucket/rubric.yaml",
            "file://server/rubric.yaml",
            "templates\\rubric.yaml",
            "../rubric.yaml",
            "templates/../rubric.yaml",
            "templates/rubric\r.yaml",
            "templates/rubric\n.yaml",
        ):
            with self.subTest(path=path):
                artifact = valid_rule_set()
                artifact["rules"][0]["rubric_ref"]["rubric_path"] = path
                self.assert_invalid(artifact)

    def test_unknown_nested_fields_are_rejected(self) -> None:
        paths = (
            ("rule",),
            ("axis_ref",),
            ("rubric_ref",),
            ("visibility_prerequisite",),
            ("condition",),
            ("insufficient_visibility_policy",),
        )
        for (path,) in paths:
            with self.subTest(path=path):
                artifact = valid_rule_set()
                rule = artifact["rules"][0]
                if path == "rule":
                    container = rule
                elif path == "condition":
                    container = rule["visibility_prerequisite"]["all_of"][0]
                else:
                    container = rule[path]
                container["unexpected"] = True
                self.assert_invalid(artifact)

    def test_semantic_only_conditions_are_structurally_accepted(self) -> None:
        artifact = valid_rule_set()
        duplicate_id = copy.deepcopy(artifact["rules"][0])
        duplicate_id["axis_ref"]["axis_name"] = "right_hand_surface_contact"
        artifact["rules"].append(duplicate_id)
        artifact["rules"][0]["insufficient_visibility_policy"][
            "allowed_fallback_values"
        ] = ["floor"]
        # rule_id uniqueness, cross-array overlap, rubric membership, and Rule
        # conflicts are future Semantic Validator responsibilities.
        self.assert_valid(artifact)


if __name__ == "__main__":
    unittest.main()
