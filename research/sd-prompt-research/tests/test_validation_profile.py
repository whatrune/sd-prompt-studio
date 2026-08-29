from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from select_validation_profile import (  # noqa: E402
    CONCEPT_GRAPH_CONTENT,
    EXPERIMENT_TEST_MODULES,
    FULL_RESEARCH,
    PRODUCTION_ADAPTER,
    RESEARCH_EXPERIMENT_ONLY,
    classify_paths,
    parse_nul_paths,
)


class ValidationProfileTests(unittest.TestCase):
    def test_experiment_only_selects_experiment_profile(self) -> None:
        selection = classify_paths(
            [
                "research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json",
                "research/sd-prompt-research/ledgers/run-index.yaml",
            ]
        )
        self.assertEqual(RESEARCH_EXPERIMENT_ONLY, selection.profile)
        self.assertTrue(selection.run_experiment_tests)
        self.assertTrue(selection.run_research_validators)
        self.assertFalse(selection.run_full_research)

    def test_concept_sources_and_dist_select_concept_profile(self) -> None:
        selection = classify_paths(
            [
                "research/sd-prompt-research/concepts/physical-concepts.json",
                "research/sd-prompt-research/dist/visual-concept-graph.json",
            ]
        )
        self.assertEqual(CONCEPT_GRAPH_CONTENT, selection.profile)
        self.assertTrue(selection.run_concept_tests)
        self.assertFalse(selection.run_experiment_tests)

    def test_closed_production_adapter_path_selects_production_profile(self) -> None:
        selection = classify_paths(["src/visualConceptProductionAdvisoryV1.ts"])
        self.assertEqual(PRODUCTION_ADAPTER, selection.profile)
        self.assertTrue(selection.run_production_adapter_tests)
        self.assertFalse(selection.run_research_validators)

    def test_validator_code_falls_back_to_full(self) -> None:
        selection = classify_paths(
            ["research/sd-prompt-research/scripts/validate_research_claims.py"]
        )
        self.assertEqual(FULL_RESEARCH, selection.profile)
        self.assertIn("research_validator_code", selection.fallback_reason)

    def test_workflow_and_selector_changes_fall_back_to_full(self) -> None:
        for path in (
            ".github/workflows/research-claims.yml",
            "research/sd-prompt-research/scripts/select_validation_profile.py",
            "research/sd-prompt-research/tests/test_validation_profile.py",
        ):
            with self.subTest(path=path):
                self.assertEqual(FULL_RESEARCH, classify_paths([path]).profile)

    def test_full_fallback_preserves_closed_production_adapter_checks(self) -> None:
        selection = classify_paths(
            [
                "src/visualConceptProductionAdvisoryV1.ts",
                ".github/workflows/research-claims.yml",
            ]
        )
        self.assertEqual(FULL_RESEARCH, selection.profile)
        self.assertTrue(selection.run_full_research)
        self.assertTrue(selection.run_production_adapter_tests)

    def test_schema_and_template_paths_fall_back_to_full(self) -> None:
        for path in (
            "research/sd-prompt-research/schemas/visual-concept-graph.schema.json",
            "research/sd-prompt-research/templates/observation-schema.json",
            "research/sd-prompt-research/knowledge/registries/observation-modules.yaml",
        ):
            with self.subTest(path=path):
                self.assertEqual(FULL_RESEARCH, classify_paths([path]).profile)

    def test_unknown_path_falls_back_to_full(self) -> None:
        selection = classify_paths(["research/sd-prompt-research/docs/new-contract.md"])
        self.assertEqual(FULL_RESEARCH, selection.profile)
        self.assertIn("unknown", selection.fallback_reason)

    def test_mixed_concept_and_experiment_uses_concept_profile_with_union_checks(self) -> None:
        selection = classify_paths(
            [
                "research/sd-prompt-research/concepts/physical-concepts.json",
                "research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json",
            ]
        )
        self.assertEqual(CONCEPT_GRAPH_CONTENT, selection.profile)
        self.assertTrue(selection.run_concept_tests)
        self.assertTrue(selection.run_experiment_tests)
        self.assertIn("tests.test_hair_observation", selection.commands[0])
        self.assertIn("tests.test_concept_graph", selection.commands[0])

    def test_malformed_paths_fail_to_full(self) -> None:
        for path in ("", "../escape.json", "/absolute.json", "a\\b.json", "a\x00b"):
            with self.subTest(path=path):
                selection = classify_paths([path])
                self.assertEqual(FULL_RESEARCH, selection.profile)
                self.assertEqual("malformed_changed_path", selection.fallback_reason)

    def test_scope_expansion_recomputes_profile(self) -> None:
        initial = classify_paths(
            ["research/sd-prompt-research/concepts/physical-concepts.json"]
        )
        expanded = classify_paths(
            [
                "research/sd-prompt-research/concepts/physical-concepts.json",
                "unclassified/new-owner.txt",
            ]
        )
        self.assertEqual(CONCEPT_GRAPH_CONTENT, initial.profile)
        self.assertEqual(FULL_RESEARCH, expanded.profile)

    def test_path_order_does_not_change_selection(self) -> None:
        paths = [
            "research/sd-prompt-research/concepts/physical-concepts.json",
            "research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json",
        ]
        self.assertEqual(classify_paths(paths), classify_paths(reversed(paths)))

    def test_nul_path_stream_is_exact_and_malformed_stream_falls_back(self) -> None:
        paths, error = parse_nul_paths(b"a.json\0b.json\0")
        self.assertEqual(["a.json", "b.json"], paths)
        self.assertIsNone(error)
        self.assertEqual(([], "malformed_nul_path_stream"), parse_nul_paths(b"a.json"))
        self.assertEqual(([], "malformed_utf8_path"), parse_nul_paths(b"\xff\0"))

    def test_duplicate_path_is_not_silently_collapsed(self) -> None:
        path = "research/sd-prompt-research/concepts/physical-concepts.json"
        selection = classify_paths([path, path])
        self.assertEqual(FULL_RESEARCH, selection.profile)
        self.assertEqual("duplicate_changed_path", selection.fallback_reason)

    def test_workflow_owns_the_closed_profiles_without_manual_selection(self) -> None:
        workflow = (
            ROOT.parents[1] / ".github" / "workflows" / "research-claims.yml"
        ).read_text(encoding="utf-8")
        self.assertNotIn("workflow_dispatch", workflow)
        self.assertIn("git diff --name-only -z --no-renames", workflow)
        self.assertIn("python -m unittest discover -s tests -v", workflow)
        self.assertIn("python scripts/build_concept_graph.py --check", workflow)
        self.assertIn("python scripts/research_explorer.py index --check", workflow)
        self.assertIn("python scripts/validate_research_claims.py", workflow)
        for module in EXPERIMENT_TEST_MODULES:
            with self.subTest(module=module):
                self.assertIn(module, workflow)


if __name__ == "__main__":
    unittest.main()
