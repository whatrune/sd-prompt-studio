from __future__ import annotations

import copy
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path, PurePosixPath

import yaml
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

    @staticmethod
    def walk_evidence(value: object):
        if isinstance(value, dict):
            if "evidence_ref_id" in value:
                yield value
            for child in value.values():
                yield from ConceptGraphBuildTests.walk_evidence(child)
        elif isinstance(value, list):
            for child in value:
                yield from ConceptGraphBuildTests.walk_evidence(child)

    def assert_evidence_contract(self, graph: dict, warnings: list[str]) -> None:
        self.assertEqual([], warnings)
        ledger = yaml.safe_load(
            (ROOT / "ledgers" / "run-index.yaml").read_text(encoding="utf-8")
        )
        runs = {item["run_id"]: item for item in ledger["runs"]}
        indexed_runs = graph["indexes"]["evidence_by_run_id"]
        required = {
            "evidence_ref_id",
            "run_id",
            "observation_path",
            "metric",
            "confidence",
            "storage",
        }
        seen: dict[str, dict] = {}

        for evidence in self.walk_evidence(graph):
            evidence_id = evidence["evidence_ref_id"]
            self.assertTrue(required.issubset(evidence), evidence_id)
            if evidence_id in seen:
                self.assertEqual(seen[evidence_id], evidence, evidence_id)
            else:
                seen[evidence_id] = evidence

            run_id = evidence["run_id"]
            self.assertIn(run_id, runs, evidence_id)
            self.assertIn(run_id, indexed_runs, evidence_id)
            self.assertEqual("local", evidence["storage"], evidence_id)

            relative = PurePosixPath(evidence["observation_path"])
            self.assertFalse(relative.is_absolute(), evidence_id)
            self.assertNotIn("..", relative.parts, evidence_id)
            observation_path = (ROOT / relative).resolve()
            run_root = (ROOT / runs[run_id]["path"]).resolve()
            self.assertTrue(observation_path.is_relative_to(run_root), evidence_id)
            self.assertTrue(observation_path.is_file(), evidence_id)

            observation = json.loads(observation_path.read_text(encoding="utf-8"))
            self.assertEqual(run_id, observation.get("run_id"), evidence_id)
            metric_value: object = observation
            for segment in evidence["metric"].split("."):
                self.assertIsInstance(metric_value, dict, evidence_id)
                self.assertIn(segment, metric_value, evidence_id)
                metric_value = metric_value[segment]

            if "count" in evidence or "total" in evidence:
                self.assertIn("count", evidence, evidence_id)
                self.assertIn("total", evidence, evidence_id)
                self.assertIs(type(evidence["count"]), int, evidence_id)
                self.assertIs(type(evidence["total"]), int, evidence_id)
                self.assertEqual(evidence["count"], metric_value, evidence_id)
                self.assertEqual(evidence["total"], observation["panel_count"], evidence_id)
                self.assertLessEqual(evidence["count"], evidence["total"], evidence_id)

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

    def test_evidence_index_validates_all_canonical_references(self) -> None:
        graph, warnings = build_graph(ROOT, SOURCES, SCHEMA, "2026-01-01T00:00:00Z")
        self.assert_evidence_contract(graph, warnings)
        indexed_runs = graph["indexes"]["evidence_by_run_id"]
        self.assertTrue(
            {"BRG-007-A", "BRG-007-B", "BRG-007-C"}.issubset(indexed_runs)
        )

    def test_valid_hair_evidence_refs_are_admitted_by_invariants(self) -> None:
        source = self.load_source("physical-concepts.json")
        long_hair = next(
            item for item in source["concepts"] if item["concept_id"] == "hair.long"
        )
        long_hair["evidence_refs"] = [
            {
                "evidence_ref_id": "evidence.hair001a.below_shoulder",
                "run_id": "HAIR-001-A",
                "observation_path": "experiments/hair/HAIR-001-A/hair-observation.json",
                "metric": "computed_aggregate.axis_counts.hair_length_extent.below_shoulder",
                "count": 0,
                "total": 6,
                "confidence": "high",
                "storage": "local",
            },
            {
                "evidence_ref_id": "evidence.hair001b.below_shoulder",
                "run_id": "HAIR-001-B",
                "observation_path": "experiments/hair/HAIR-001-B/hair-observation.json",
                "metric": "computed_aggregate.axis_counts.hair_length_extent.below_shoulder",
                "count": 6,
                "total": 6,
                "confidence": "high",
                "storage": "local",
            },
        ]
        self.save_source("physical-concepts.json", source)
        graph, warnings = build_graph(ROOT, self.sources, SCHEMA, "2026-01-01T00:00:00Z")
        self.assert_evidence_contract(graph, warnings)
        self.assertTrue(
            {"HAIR-001-A", "HAIR-001-B"}.issubset(
                graph["indexes"]["evidence_by_run_id"]
            )
        )

    def test_unknown_evidence_run_fails_contract_validation(self) -> None:
        source = self.load_source("physical-concepts.json")
        concept = next(item for item in source["concepts"] if item.get("evidence_refs"))
        concept["evidence_refs"][0]["run_id"] = "UNKNOWN-RUN"
        self.save_source("physical-concepts.json", source)
        graph, warnings = build_graph(ROOT, self.sources, SCHEMA, "2026-01-01T00:00:00Z")
        with self.assertRaisesRegex(AssertionError, "UNKNOWN-RUN"):
            self.assert_evidence_contract(graph, warnings)

    def test_duplicate_evidence_ref_id_with_different_content_fails(self) -> None:
        source = self.load_source("physical-concepts.json")
        owners = [item for item in source["concepts"] if item.get("evidence_refs")]
        duplicate = copy.deepcopy(owners[0]["evidence_refs"][0])
        duplicate["run_id"] = "BRG-007-B"
        owners[1]["evidence_refs"].append(duplicate)
        self.save_source("physical-concepts.json", source)
        with self.assertRaisesRegex(GraphBuildError, "reused with different content"):
            self.build()

    def test_malformed_evidence_reference_missing_total_fails(self) -> None:
        source = self.load_source("physical-concepts.json")
        concept = next(item for item in source["concepts"] if item.get("evidence_refs"))
        concept["evidence_refs"][0].pop("total")
        self.save_source("physical-concepts.json", source)
        with self.assertRaisesRegex(GraphBuildError, "total"):
            self.build()

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
