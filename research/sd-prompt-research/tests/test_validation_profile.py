from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from select_validation_profile import (  # noqa: E402
    CLAIMS_CHECK_COMMAND,
    CONCEPT_GRAPH_CONTENT,
    CONCEPT_TEST_MODULES,
    EXPLORER_CHECK_COMMAND,
    EXPERIMENT_TEST_MODULES,
    FULL_RESEARCH,
    FULL_TEST_COMMAND,
    GRAPH_CHECK_COMMAND,
    PRODUCTION_ADAPTER,
    PRODUCTION_CHECK_COMMAND,
    PRODUCTION_TEST_COMMAND,
    RESEARCH_EXPERIMENT_ONLY,
    classify_paths,
    forced_full_selection,
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

    def test_forced_default_branch_full_runs_production_adapter_checks(self) -> None:
        selection = forced_full_selection("default_branch_regression")
        self.assertEqual(FULL_RESEARCH, selection.profile)
        self.assertTrue(selection.run_full_research)
        self.assertTrue(selection.run_production_adapter_tests)
        self.assertIn(PRODUCTION_TEST_COMMAND, selection.commands)
        self.assertIn(PRODUCTION_CHECK_COMMAND, selection.commands)

    def test_forced_scheduled_full_runs_production_adapter_checks(self) -> None:
        selection = forced_full_selection("scheduled_periodic_regression")
        self.assertEqual(FULL_RESEARCH, selection.profile)
        self.assertTrue(selection.run_full_research)
        self.assertTrue(selection.run_production_adapter_tests)
        self.assertIn(PRODUCTION_TEST_COMMAND, selection.commands)
        self.assertIn(PRODUCTION_CHECK_COMMAND, selection.commands)

    def test_full_research_is_a_strict_superset_of_bounded_profile_checks(self) -> None:
        full = forced_full_selection("scheduled_periodic_regression")
        self.assertIn(FULL_TEST_COMMAND, full.commands)
        for command in (
            GRAPH_CHECK_COMMAND,
            EXPLORER_CHECK_COMMAND,
            CLAIMS_CHECK_COMMAND,
            PRODUCTION_TEST_COMMAND,
            PRODUCTION_CHECK_COMMAND,
        ):
            with self.subTest(command=command):
                self.assertIn(command, full.commands)
        discovered_modules = {
            f"tests.{path.stem}" for path in (ROOT / "tests").glob("test_*.py")
        }
        self.assertTrue(set(EXPERIMENT_TEST_MODULES).issubset(discovered_modules))
        self.assertTrue(set(CONCEPT_TEST_MODULES).issubset(discovered_modules))

    def test_unrelated_bounded_profiles_do_not_gain_production_checks(self) -> None:
        for path in (
            "research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json",
            "research/sd-prompt-research/concepts/physical-concepts.json",
        ):
            with self.subTest(path=path):
                selection = classify_paths([path])
                self.assertFalse(selection.run_production_adapter_tests)
                self.assertNotIn(PRODUCTION_TEST_COMMAND, selection.commands)
                self.assertNotIn(PRODUCTION_CHECK_COMMAND, selection.commands)

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
        self.assertIn("default_branch_regression", workflow)
        self.assertIn("scheduled_periodic_regression", workflow)
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
