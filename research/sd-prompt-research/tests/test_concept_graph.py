from __future__ import annotations

import copy
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "concepts"
SCHEMA = ROOT / "schemas" / "visual-concept-graph.schema.json"
sys.path.insert(0, str(ROOT / "scripts"))

from build_concept_graph import (  # noqa: E402
    GraphBuildError,
    build_graph,
    write_graph_atomic,
)


class ConceptGraphBuildTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.temp_root = Path(self.temporary.name)
        self.sources = self.temp_root / "concepts"
        shutil.copytree(SOURCES, self.sources)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def load_source(self, name: str) -> dict:
        return json.loads((self.sources / name).read_text(encoding="utf-8"))

    def save_source(self, name: str, value: dict) -> None:
        (self.sources / name).write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def build(self, generated_at: str = "2026-01-01T00:00:00Z") -> dict:
        graph, _ = build_graph(ROOT, self.sources, SCHEMA, generated_at)
        return graph

    def test_valid_module_sources_generate_schema_valid_dist(self) -> None:
        graph = self.build()
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        errors = list(
            Draft202012Validator(
                schema, format_checker=FormatChecker()
            ).iter_errors(graph)
        )
        self.assertEqual([], errors)
        self.assertIn("support.arm.rearward", graph["indexes"]["concepts_by_id"])
        self.assertIn(
            "pattern.pose.full_bridge", graph["indexes"]["target_patterns_by_id"]
        )
        self.assertIn(
            "context.baseline_casual_v1",
            graph["indexes"]["control_context_profiles_by_id"],
        )
        long_hair = next(
            item for item in graph["concepts"] if item["concept_id"] == "hair.long"
        )
        self.assertTrue(long_hair["hair_properties"]["visibility_effects"])
        self.assertTrue(
            all(
                effect["evidence_status"] == "unconfirmed"
                for effect in long_hair["hair_properties"]["visibility_effects"]
            )
        )

    def test_duplicate_concept_id_fails(self) -> None:
        source = self.load_source("physical-concepts.json")
        source["concepts"].append(copy.deepcopy(source["concepts"][0]))
        self.save_source("physical-concepts.json", source)
        with self.assertRaisesRegex(GraphBuildError, "duplicate concept ID"):
            self.build()

    def test_missing_relation_target_fails(self) -> None:
        source = self.load_source("relations.json")
        source["relations"][0]["target_concept_id"] = "concept.does_not_exist"
        self.save_source("relations.json", source)
        with self.assertRaisesRegex(GraphBuildError, "references missing IDs"):
            self.build()

    def test_missing_control_context_concept_fails(self) -> None:
        source = self.load_source("target-patterns.json")
        source["control_context_profiles"][0]["fixed_concept_ids"].append(
            "clothing.missing"
        )
        self.save_source("target-patterns.json", source)
        with self.assertRaisesRegex(GraphBuildError, "fixed_concept_ids"):
            self.build()

    def test_duplicate_alias_fails_case_insensitively(self) -> None:
        source = self.load_source("physical-concepts.json")
        source["concepts"][0]["aliases"].append("LYING")
        self.save_source("physical-concepts.json", source)
        with self.assertRaisesRegex(GraphBuildError, "duplicate alias"):
            self.build()

    def test_duplicate_target_pattern_id_fails(self) -> None:
        source = self.load_source("target-patterns.json")
        source["target_patterns"].append(copy.deepcopy(source["target_patterns"][0]))
        self.save_source("target-patterns.json", source)
        with self.assertRaisesRegex(GraphBuildError, "duplicate target_pattern ID"):
            self.build()

    def test_invalid_status_fails_schema_validation(self) -> None:
        source = self.load_source("physical-concepts.json")
        source["concepts"][0]["status"] = "maybe"
        self.save_source("physical-concepts.json", source)
        with self.assertRaisesRegex(GraphBuildError, "status"):
            self.build()

    def test_invalid_evidence_ref_format_fails(self) -> None:
        source = self.load_source("physical-concepts.json")
        concept = next(
            item for item in source["concepts"] if item.get("evidence_refs")
        )
        concept["evidence_refs"][0]["evidence_ref_id"] = "BRG-007 invalid"
        self.save_source("physical-concepts.json", source)
        with self.assertRaisesRegex(GraphBuildError, "evidence_ref_id"):
            self.build()

    def test_provisional_domain_effect_requires_evidence(self) -> None:
        source = self.load_source("target-patterns.json")
        risk = source["control_context_profiles"][0]["known_visibility_risks"][1]
        risk.pop("evidence_refs")
        self.save_source("target-patterns.json", source)
        with self.assertRaisesRegex(GraphBuildError, "evidence_refs"):
            self.build()

    def test_stable_sort_ignores_source_array_order(self) -> None:
        first = self.build()
        for path in self.sources.glob("*.json"):
            source = json.loads(path.read_text(encoding="utf-8"))
            for key in (
                "concepts",
                "relations",
                "target_patterns",
                "unmodeled_effects",
                "model_profiles",
                "intent_profiles",
                "control_context_profiles",
            ):
                if key in source:
                    source[key].reverse()
            path.write_text(
                json.dumps(source, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        second = self.build()
        self.assertEqual(first, second)

    def test_brg007_evidence_refs_are_references_to_existing_files(self) -> None:
        graph, warnings = build_graph(ROOT, SOURCES, SCHEMA, "2026-01-01T00:00:00Z")
        self.assertFalse(
            [warning for warning in warnings if "BRG-007" in warning], warnings
        )
        indexed_runs = graph["indexes"]["evidence_by_run_id"]
        self.assertEqual({"BRG-007-A", "BRG-007-B", "BRG-007-C"}, set(indexed_runs))
        for run_id in ("BRG-007-A", "BRG-007-B", "BRG-007-C"):
            path = ROOT / "experiments" / "bridge" / run_id / "observation.json"
            self.assertTrue(path.is_file(), run_id)

        def walk(value: object):
            if isinstance(value, dict):
                if "evidence_ref_id" in value:
                    yield value
                for child in value.values():
                    yield from walk(child)
            elif isinstance(value, list):
                for child in value:
                    yield from walk(child)

        for evidence in walk(graph):
            observation = json.loads(
                (ROOT / evidence["observation_path"]).read_text(encoding="utf-8")
            )
            metric_value = observation
            for segment in evidence["metric"].split("."):
                self.assertIn(segment, metric_value, evidence["evidence_ref_id"])
                metric_value = metric_value[segment]

    def test_observation_v3_and_existing_run_are_not_modified(self) -> None:
        observation_schema_path = ROOT / "templates" / "observation-schema.json"
        observation_path = ROOT / "experiments" / "bridge" / "BRG-007-B" / "observation.json"
        schema_before = observation_schema_path.read_bytes()
        observation_before = observation_path.read_bytes()
        graph = self.build()
        write_graph_atomic(graph, self.temp_root / "dist" / "graph.json")
        self.assertEqual(schema_before, observation_schema_path.read_bytes())
        self.assertEqual(observation_before, observation_path.read_bytes())
        observation_schema = json.loads(schema_before)
        self.assertEqual("3.0", observation_schema["properties"]["schema_version"]["const"])

    def test_dist_can_be_regenerated_after_direct_edit(self) -> None:
        output = self.temp_root / "dist" / "visual-concept-graph.json"
        graph = self.build()
        write_graph_atomic(graph, output)
        expected = output.read_bytes()
        output.write_text('{"manually_edited": true}\n', encoding="utf-8")
        write_graph_atomic(self.build(), output)
        self.assertEqual(expected, output.read_bytes())

    def test_brg007_b_mapping_keeps_observation_and_interpretation_layers(self) -> None:
        example = json.loads(
            (ROOT / "examples" / "bridge-intent-profile-example.json").read_text(
                encoding="utf-8"
            )
        )
        run = next(item for item in example["observed_runs"] if item["run_id"] == "BRG-007-B")
        mapping = run["concept_graph_mapping"]
        self.assertEqual("reclined", mapping["body_state"])
        self.assertEqual("face_up", mapping["body_orientation"])
        self.assertEqual("medium", mapping["configurations"]["torso_arch"])
        self.assertEqual("unclear", mapping["configurations"]["hip_elevation"])
        self.assertEqual("visible_observation", mapping["contacts"][0]["responsibility_layer"])
        self.assertEqual(
            "interpretation_candidate", mapping["relations"][0]["responsibility_layer"]
        )
        evaluation = mapping["target_evaluation"]["full_bridge"]
        self.assertEqual("not_matched", evaluation["status"])
        self.assertIn("pelvis_elevated", evaluation["missing_constraints"])
        self.assertIn("reclined_body_state", evaluation["conflicting_evidence"])


if __name__ == "__main__":
    unittest.main()
