from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = ROOT.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from select_validation_profile import (  # noqa: E402
    APPLICATION, CATALOG_PATH, CONCEPT_GRAPH, DOCUMENTATION, FULL_RESEARCH,
    PLATFORM, PRODUCTION_ADVISORY, PROMPT_DATA, RESEARCH_EXPERIMENT,
    CONCEPT_TEST_MODULES, EXPERIMENT_TEST_MODULES, classify_paths,
    forced_full_selection, load_catalog, parse_nul_paths,
)

PR_456_PATHS = (
    "data/visual-concept-prompt-tag-bindings-v1.json",
    "scripts/promote-visual-concept-production-advisory-v1.mjs",
    "scripts/test-visual-concept-production-advisory-v1.mjs",
    "scripts/test-visual-concept-read-only-advisory-v1.mjs",
    "scripts/test-visual-concept-read-only-entry-adapter-v1.mjs",
    "scripts/test-visual-concept-read-only-inspection-v1.mjs",
    "src/data/visual-concept-production-advisory-v1.json",
    "src/visualConceptProductionAdvisoryV1.ts",
)


class ValidationProfileTests(unittest.TestCase):
    def assert_profile(self, expected: str, paths: list[str] | tuple[str, ...]) -> None:
        self.assertEqual(expected, classify_paths(paths).profile)

    def test_hair_experiment_paths_select_research_experiment(self) -> None:
        self.assert_profile(RESEARCH_EXPERIMENT, [
            "research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json",
            "research/sd-prompt-research/ledgers/run-index.yaml",
        ])

    def test_hair_long_graph_paths_select_concept_graph(self) -> None:
        self.assert_profile(CONCEPT_GRAPH, [
            "research/sd-prompt-research/concepts/physical-concepts.json",
            "research/sd-prompt-research/dist/visual-concept-graph.json",
        ])

    def test_graph_validator_and_schema_changes_force_full(self) -> None:
        for path in (
            "research/sd-prompt-research/scripts/build_concept_graph.py",
            "research/sd-prompt-research/schemas/visual-concept-graph.schema.json",
            "research/sd-prompt-research/tests/test_concept_graph.py",
        ):
            with self.subTest(path=path):
                self.assert_profile(FULL_RESEARCH, [path])

    def test_pr_456_production_advisory_scope_is_bounded(self) -> None:
        selection = classify_paths(PR_456_PATHS)
        self.assertEqual(PRODUCTION_ADVISORY, selection.profile)
        self.assertEqual("", selection.fallback_reason)
        self.assertEqual(("production_advisory",), selection.bundles)

    def test_prompt_data_runtime_platform_and_docs_classes(self) -> None:
        cases = (
            (PROMPT_DATA, "data/prompt-tags.json"),
            (APPLICATION, "src/compiler/promptCompiler.ts"),
            (PLATFORM, "scripts/some-platform-contract.mjs"),
            (DOCUMENTATION, "docs/product/guide.md"),
        )
        for expected, path in cases:
            with self.subTest(path=path):
                self.assert_profile(expected, [path])

    def test_control_plane_catalog_workflow_and_classifier_force_full(self) -> None:
        for path in (
            ".github/workflows/research-claims.yml",
            "data/validation-path-ownership-v1.json",
            "research/sd-prompt-research/scripts/select_validation_profile.py",
            "scripts/protected-transition-merge-operator-preflight-v1.mjs",
            "scripts/validate-dictionaries.mjs",
        ):
            with self.subTest(path=path):
                self.assert_profile(FULL_RESEARCH, [path])

    def test_mixed_or_unknown_paths_force_full_without_union(self) -> None:
        mixed = classify_paths([
            "research/sd-prompt-research/concepts/physical-concepts.json",
            "research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json",
        ])
        self.assertEqual(FULL_RESEARCH, mixed.profile)
        self.assertEqual("mixed_ownership_classes", mixed.fallback_reason)
        unknown = classify_paths(["unowned/new-surface.bin"])
        self.assertEqual(FULL_RESEARCH, unknown.profile)
        self.assertTrue(unknown.fallback_reason.startswith("unknown_path:"))

    def test_empty_duplicate_and_malformed_paths_force_full(self) -> None:
        self.assertEqual("empty_changed_path_set", classify_paths([]).fallback_reason)
        path = "docs/product/guide.md"
        self.assertEqual("duplicate_changed_path", classify_paths([path, path]).fallback_reason)
        for malformed in ("", "../escape", "/absolute", "a\\b", "a\x00b", "a//b", "a/", "a" * 513):
            with self.subTest(path=malformed):
                self.assertEqual("malformed_changed_path", classify_paths([malformed]).fallback_reason)

    def test_deletion_and_rename_are_classified_from_exact_path_records(self) -> None:
        deleted = "research/sd-prompt-research/experiments/hair/HAIR-001-A/old.json"
        added = "research/sd-prompt-research/experiments/hair/HAIR-001-A/new.json"
        self.assert_profile(RESEARCH_EXPERIMENT, [deleted])
        self.assert_profile(RESEARCH_EXPERIMENT, [deleted, added])

    def test_nul_path_stream_preserves_rename_as_two_records(self) -> None:
        paths, error = parse_nul_paths(b"old.json\0new.json\0")
        self.assertEqual(["old.json", "new.json"], paths)
        self.assertIsNone(error)
        self.assertEqual(([], "malformed_nul_path_stream"), parse_nul_paths(b"old.json"))
        self.assertEqual(([], "malformed_utf8_path"), parse_nul_paths(b"\xff\0"))

    def test_forced_full_is_strict_superset_of_every_bounded_bundle(self) -> None:
        full = forced_full_selection("scheduled_periodic_regression")
        all_bounded = set()
        for path in (
            "research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json",
            "research/sd-prompt-research/concepts/physical-concepts.json",
            "data/visual-concept-prompt-tag-bindings-v1.json",
            "data/prompt-tags.json", "src/main.tsx",
            "scripts/ordinary-platform-check.mjs", "docs/product/guide.md",
        ):
            all_bounded.update(classify_paths([path]).bundles)
        self.assertEqual(FULL_RESEARCH, full.profile)
        non_research_focused = all_bounded - {"research_experiment", "concept_graph"}
        self.assertTrue(non_research_focused < set(full.bundles))
        self.assertTrue({"full_research", "application", "platform"}.issubset(full.bundles))
        discovered = {f"tests.{path.stem}" for path in (ROOT / "tests").glob("test_*.py")}
        self.assertTrue(set(EXPERIMENT_TEST_MODULES).issubset(discovered))
        self.assertTrue(set(CONCEPT_TEST_MODULES).issubset(discovered))

    def test_catalog_parser_rejects_unknown_schema(self) -> None:
        value = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        value["unexpected"] = True
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "validation_catalog_invalid"):
                load_catalog(path)

    def test_workflow_is_universal_and_uses_exact_nul_diff(self) -> None:
        workflow = (REPOSITORY_ROOT / ".github/workflows/research-claims.yml").read_text(encoding="utf-8")
        self.assertIn("pull_request:", workflow)
        self.assertNotIn("pull_request:\n    paths:", workflow)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("git diff --name-only -z --no-renames", workflow)
        self.assertIn("explicit_full_regression", workflow)
        self.assertIn("pnpm test", workflow)
        self.assertIn("pnpm run build", workflow)


if __name__ == "__main__":
    unittest.main()
