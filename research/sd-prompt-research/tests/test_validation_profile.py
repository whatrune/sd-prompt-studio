from __future__ import annotations

import json
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = ROOT.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from select_validation_profile import (  # noqa: E402
    APPLICATION, CATALOG_PATH, CONCEPT_GRAPH, DOCUMENTATION, FULL_RESEARCH,
    PLATFORM, PRODUCTION_ADVISORY, PROMPT_DATA, RESEARCH_EXPERIMENT,
    CONCEPT_TEST_MODULES, EXPERIMENT_TEST_MODULES, classify_paths,
    forced_full_selection, load_catalog, main, parse_nul_paths,
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

        documentation = classify_paths(["docs/product/guide.md"])
        self.assertFalse(documentation.runtime_deployable)
        self.assertEqual(("documentation",), documentation.bundles)
        self.assertEqual(("node scripts/test-role-execution-contracts.mjs",), documentation.commands)

        platform = classify_paths(["scripts/some-platform-contract.mjs"])
        self.assertTrue(platform.runtime_deployable)
        self.assertEqual(("platform", "documentation"), platform.bundles)

    def test_control_plane_catalog_workflow_and_classifier_force_full(self) -> None:
        for path in (
            ".github/workflows/research-claims.yml",
            "data/validation-path-ownership-v1.json",
            "research/sd-prompt-research/requirements.lock.txt",
            "research/sd-prompt-research/scripts/select_validation_profile.py",
            "scripts/acquire-python-validation-environment-v1.ps1",
            "scripts/protected-transition-merge-operator-preflight-v1.mjs",
            "scripts/run-local-full-validation-v1.ps1",
            "scripts/test-python-validation-environment-v1.ps1",
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

    def test_cli_path_transport_errors_run_cache_matrix_fail_closed(self) -> None:
        for payload, expected_reason in (
            (b"missing-terminator", "malformed_nul_path_stream"),
            (b"\xff\0", "malformed_utf8_path"),
        ):
            with self.subTest(expected_reason=expected_reason), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "paths.zlist"
                path.write_bytes(payload)
                output = io.StringIO()
                with redirect_stdout(output):
                    self.assertEqual(0, main(["--paths-file", str(path), "--format", "json"]))
                result = json.loads(output.getvalue())
                self.assertEqual(FULL_RESEARCH, result["profile"])
                self.assertEqual(expected_reason, result["fallback_reason"])
                self.assertTrue(result["run_python_cache_matrix"])

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

    def test_python_cache_matrix_runs_only_for_owners_or_periodic_full(self) -> None:
        catalog = load_catalog()
        for path in catalog.python_cache_matrix_exact:
            with self.subTest(path=path):
                selection = classify_paths([path])
                self.assertEqual(FULL_RESEARCH, selection.profile)
                self.assertTrue(selection.run_python_cache_matrix)

        ordinary_full = classify_paths(["unowned/new-surface.bin"])
        self.assertEqual(FULL_RESEARCH, ordinary_full.profile)
        self.assertFalse(ordinary_full.run_python_cache_matrix)
        mixed_full = classify_paths([
            "docs/product/guide.md",
            "src/main.tsx",
        ])
        self.assertEqual(FULL_RESEARCH, mixed_full.profile)
        self.assertFalse(mixed_full.run_python_cache_matrix)

        for reason in (
            "default_branch_regression",
            "explicit_full_regression",
            "scheduled_periodic_regression",
        ):
            with self.subTest(reason=reason):
                self.assertTrue(forced_full_selection(reason).run_python_cache_matrix)
        self.assertFalse(forced_full_selection("bounded_diagnostic").run_python_cache_matrix)
        self.assertTrue(forced_full_selection("INVALID").run_python_cache_matrix)

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
        self.assertIn("actions/cache@v4", workflow)
        self.assertIn("requirements.lock.txt", workflow)
        self.assertIn("acquire-python-validation-environment-v1.ps1", workflow)
        self.assertIn("test-python-validation-environment-v1.ps1", workflow)
        self.assertIn("steps.profile.outputs.run_python_cache_matrix == 'true'", workflow)
        self.assertNotIn("steps.profile.outputs.run_full_research == 'true'\n        shell: pwsh", workflow)
        self.assertIn("python_executable", workflow)
        self.assertIn('"$VALIDATION_PYTHON" -B -E -s', workflow)
        self.assertNotIn("python -m pip install -r research/sd-prompt-research/requirements.txt", workflow)
        self.assertIn("pnpm test", workflow)
        self.assertIn("pnpm run build", workflow)

    def test_preview_consumes_canonical_profile_without_path_taxonomy(self) -> None:
        workflow = (REPOSITORY_ROOT / ".github/workflows/preview.yml").read_text(encoding="utf-8")
        self.assertIn("select_validation_profile.py", workflow)
        self.assertIn("git diff --name-only -z --no-renames", workflow)
        self.assertIn('git show "$EXACT_BASE_SHA:research/sd-prompt-research/scripts/select_validation_profile.py"', workflow)
        self.assertIn('git show "$EXACT_BASE_SHA:data/validation-path-ownership-v1.json"', workflow)
        self.assertIn('python "$trusted_selector"', workflow)
        self.assertNotIn('python "$selector"', workflow)
        self.assertNotIn("all_markdown", workflow)
        self.assertNotIn("docs_only", workflow)
        self.assertNotIn("*.md", workflow)
        self.assertNotIn("test-role-execution-contracts.mjs", workflow)
        self.assertGreaterEqual(workflow.count("steps.profile.outputs.runtime_deployable == 'true'"), 6)
        self.assertIn("pnpm install --frozen-lockfile", workflow)

    def test_validate_owns_documentation_contracts(self) -> None:
        workflow = (REPOSITORY_ROOT / ".github/workflows/research-claims.yml").read_text(encoding="utf-8")
        self.assertIn("steps.profile.outputs.run_documentation == 'true'", workflow)
        self.assertEqual(1, workflow.count("node scripts/test-role-execution-contracts.mjs"))


if __name__ == "__main__":
    unittest.main()
