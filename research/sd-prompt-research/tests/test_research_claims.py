from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_concept_graph import build_graph  # noqa: E402
from validate_research_claims import (  # noqa: E402
    ClaimValidator,
    KnowledgeData,
    UniqueKeyLoader,
    canonical_bytes,
    content_hash,
    empty_knowledge,
    graph_identity,
    index_documents,
    load_current_documents,
    load_schema,
    review_effective_status_at,
    semver_compare,
    yaml,
)


def current_graph() -> dict:
    graph, _ = build_graph(
        ROOT,
        ROOT / "concepts",
        ROOT / "schemas" / "visual-concept-graph.schema.json",
        "2026-01-01T00:00:00Z",
    )
    return graph


def make_validator(
    data: KnowledgeData | None = None,
    baseline: KnowledgeData | None = None,
    graph: dict | None = None,
    context: str = "current_state",
) -> ClaimValidator:
    now = datetime(2026, 7, 16, tzinfo=timezone.utc)
    return ClaimValidator(
        ROOT,
        REPO_ROOT,
        data or empty_knowledge(),
        baseline or empty_knowledge(),
        graph,
        graph,
        context,
        now,
        now,
        False,
        None,
        None,
        None,
    )


class ResearchClaimTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.graph = current_graph()

    def test_checked_in_knowledge_passes_all_json_schemas(self) -> None:
        schemas = {
            "assertion": load_schema(ROOT / "schemas" / "research-claim-assertion.schema.json"),
            "review": load_schema(ROOT / "schemas" / "research-claim-review.schema.json"),
            "approval": load_schema(ROOT / "schemas" / "research-promotion-approval.schema.json"),
        }
        issues = []
        data = index_documents(load_current_documents(ROOT / "knowledge"), schemas, issues)
        self.assertFalse([issue for issue in issues if issue.severity == "error"], issues)
        self.assertEqual(3, len(data.assertions))
        self.assertEqual(2, len(data.evidence))
        self.assertEqual({}, data.reviews)
        self.assertEqual({}, data.approvals)

    def test_schema_rejects_attach_application_without_locator(self) -> None:
        schema = load_schema(ROOT / "schemas" / "research-claim-assertion.schema.json")
        application = {
            "application_id": "application.assertion.example.topic.001.001",
            "assertion_id": "assertion.example.topic.001",
            "claim_review_ids": ["review.assertion.example.topic.001.001"],
            "promotion_approval_id": "promotion_approval.assertion.example.topic.001.001",
            "applied_promotion_plan": {
                "action": "attach_evidence",
                "target_id": "concept.example",
                "assertion_hash": "a" * 64,
            },
            "applied_assertion_hash": "a" * 64,
            "applied_promotion_hash": "b" * 64,
            "applied_content": {
                "content_kind": "evidence_ref",
                "collection": "concepts",
                "content_hash": "c" * 64,
                "hash_algorithm": "sha256",
                "hash_scope": "graph_content_v1",
            },
            "applied_graph_version": "0.2.0",
            "applied_at": "2026-07-15T20:00:00Z",
            "recorded_at": "2026-07-15T20:00:00Z",
            "supersedes_application_ids": [],
            "applied_target_id": "concept.example",
        }
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        errors = list(validator.evolve(schema=schema["$defs"]["application"]).iter_errors(application))
        self.assertTrue(errors)

    def test_yaml_loader_rejects_duplicate_keys(self) -> None:
        with self.assertRaises(yaml.constructor.ConstructorError):
            yaml.load("key: 1\nkey: 2\n", Loader=UniqueKeyLoader)

    def test_yaml_loader_keeps_timestamps_and_yaml11_booleans_as_strings(self) -> None:
        value = yaml.load(
            "timestamp: 2026-07-16T00:00:00Z\nyes_value: yes\ntrue_value: true\nscientific: 1e3\nleading_zero: 01\n",
            Loader=UniqueKeyLoader,
        )
        self.assertIsInstance(value["timestamp"], str)
        self.assertEqual("yes", value["yes_value"])
        self.assertIs(value["true_value"], True)
        self.assertEqual(1000.0, value["scientific"])
        self.assertEqual("01", value["leading_zero"])

    def test_rfc8785_vectors(self) -> None:
        vector_a = {"b": 1, "a": "é"}
        self.assertEqual(b'{"a":"\xc3\xa9","b":1}', canonical_bytes(vector_a))
        self.assertEqual(
            "aa58fba8483623bed37c1b02edfccbdd9a53123837c20bfa4cb4049993a2872e",
            content_hash(vector_a),
        )
        vector_b = {"evidence_ref_id": "evidence.example.metric.001", "count": 5, "total": 6}
        self.assertEqual(
            "ed157d50d4cb6a422a84930c1fc4714f8db1fd0dabf1f62fa5046a2be76c1089",
            content_hash(vector_b),
        )

    def test_graph_identity_excludes_metadata_and_indexes(self) -> None:
        changed = copy.deepcopy(self.graph)
        changed["schema_version"] = "9.9.9"
        changed["graph_version"] = "9.9.9"
        changed["generated_at"] = "2099-01-01T00:00:00Z"
        changed["source_files"] = ["moved.json"]
        changed["indexes"] = {"changed": True}
        self.assertEqual(content_hash(graph_identity(self.graph)), content_hash(graph_identity(changed)))

    def test_semver_comparison_obeys_prerelease_rules(self) -> None:
        self.assertGreater(semver_compare("0.3.0", "0.2.9"), 0)
        self.assertLess(semver_compare("0.3.0-alpha.1", "0.3.0"), 0)
        self.assertEqual(semver_compare("0.3.0+build.2", "0.3.0+build.1"), 0)

    def test_graph_content_change_requires_version_increment(self) -> None:
        baseline = copy.deepcopy(self.graph)
        candidate = copy.deepcopy(self.graph)
        candidate["concepts"][0]["label"] += " changed"
        validator = make_validator(graph=candidate)
        validator.baseline_candidate_graph = baseline
        validator.validate_graph_versions()
        self.assertIn("GRAPH_VERSION_NOT_INCREMENTED", {issue.code for issue in validator.issues})

    def test_version_change_without_content_is_rejected(self) -> None:
        baseline = copy.deepcopy(self.graph)
        candidate = copy.deepcopy(self.graph)
        candidate["graph_version"] = "0.3.0"
        validator = make_validator(graph=candidate)
        validator.baseline_candidate_graph = baseline
        validator.validate_graph_versions()
        self.assertIn("GRAPH_VERSION_CHANGED_WITHOUT_CONTENT", {issue.code for issue in validator.issues})

    def test_application_recheck_skips_graph_version_comparison(self) -> None:
        baseline = copy.deepcopy(self.graph)
        candidate = copy.deepcopy(self.graph)
        candidate["concepts"][0]["label"] += " changed"
        validator = make_validator(graph=candidate, context="application_recheck")
        validator.baseline_candidate_graph = baseline
        validator.validate_graph_versions()
        self.assertEqual([], validator.issues)

    def test_review_withdrawal_after_approval_does_not_change_earlier_state(self) -> None:
        review_id = "review.assertion.example.topic.001.001"
        withdrawal_id = "review.assertion.example.topic.001.002"
        assertion_hash = "a" * 64
        reviews = {
            review_id: {
                "review_id": review_id,
                "assertion_id": "assertion.example.topic.001",
                "record_type": "review",
                "decision": "approve",
                "recorded_at": "2026-07-16T00:00:00Z",
                "reviewed_assertion_hash": assertion_hash,
                "supersedes_review_ids": [],
            },
            withdrawal_id: {
                "review_id": withdrawal_id,
                "assertion_id": "assertion.example.topic.001",
                "record_type": "withdrawal",
                "recorded_at": "2026-07-16T02:00:00Z",
                "withdrawn_at": "2026-07-16T02:00:00Z",
                "supersedes_review_ids": [review_id],
            },
        }
        state_at_approval, _ = review_effective_status_at(
            review_id,
            datetime(2026, 7, 16, 1, tzinfo=timezone.utc),
            assertion_hash,
            reviews,
        )
        state_later, _ = review_effective_status_at(
            review_id,
            datetime(2026, 7, 16, 3, tzinfo=timezone.utc),
            assertion_hash,
            reviews,
        )
        self.assertEqual("active", state_at_approval)
        self.assertEqual("withdrawn", state_later)

    def test_alias_locator_resolves_exact_fragment(self) -> None:
        application = {
            "applied_promotion_plan": {"action": "add_alias"},
            "applied_target_id": "support.arm.rearward",
            "applied_content": {
                "content_kind": "alias",
                "collection": "concepts",
                "content_hash": content_hash("arm support"),
                "content_locator": {
                    "target_id": "support.arm.rearward",
                    "field_path": "/aliases",
                    "item_key": "arm support",
                },
            },
        }
        validator = make_validator(graph=self.graph)
        self.assertEqual("arm support", validator._resolve_application_fragment(application))

    def test_model_behavior_locator_uses_fragment_hash(self) -> None:
        concept = next(item for item in self.graph["concepts"] if item["concept_id"] == "support.arm.rearward")
        behavior = concept["model_behaviors"][0]
        behavior_hash = content_hash(behavior)
        application = {
            "applied_promotion_plan": {"action": "attach_model_behavior"},
            "applied_target_id": concept["concept_id"],
            "applied_content": {
                "content_kind": "model_behavior",
                "collection": "concepts",
                "content_hash": behavior_hash,
                "content_locator": {
                    "target_id": concept["concept_id"],
                    "field_path": "/model_behaviors",
                    "item_key": behavior_hash,
                },
            },
        }
        validator = make_validator(graph=self.graph)
        self.assertEqual(behavior, validator._resolve_application_fragment(application))

    def test_application_recheck_never_resolves_current_graph_content(self) -> None:
        validator = make_validator(graph=None, context="application_recheck")
        validator._validate_new_application_content({"application.missing"})
        self.assertEqual([], validator.issues)

    def test_append_only_detects_modified_deleted_and_backdated_records(self) -> None:
        assertion_id = "assertion.example.topic.001"
        first_id = "review.assertion.example.topic.001.001"
        deleted_id = "review.assertion.example.topic.001.002"
        new_id = "review.assertion.example.topic.001.003"
        base_record = {
            "review_id": first_id,
            "assertion_id": assertion_id,
            "record_type": "review",
            "decision": "approve",
            "recorded_at": "2026-07-16T02:00:00Z",
        }
        deleted_record = {**base_record, "review_id": deleted_id, "recorded_at": "2026-07-16T03:00:00Z"}
        changed_record = {**base_record, "decision": "reject"}
        new_record = {**base_record, "review_id": new_id, "recorded_at": "2026-07-16T01:00:00Z"}
        baseline = empty_knowledge()
        baseline.reviews = {first_id: base_record, deleted_id: deleted_record}
        baseline.review_files = {first_id: "baseline.yaml", deleted_id: "baseline.yaml"}
        current = empty_knowledge()
        current.reviews = {first_id: changed_record, new_id: new_record}
        current.review_files = {first_id: "current.yaml", new_id: "current.yaml"}
        validator = make_validator(current, baseline)
        validator.validate_append_only()
        codes = {issue.code for issue in validator.issues}
        self.assertIn("APPEND_ONLY_RECORD_MODIFIED", codes)
        self.assertIn("APPEND_ONLY_RECORD_DELETED", codes)
        self.assertIn("AUDIT_RECORD_BACKDATE", codes)

    def test_cli_check_does_not_modify_dist(self) -> None:
        dist = ROOT / "dist" / "visual-concept-graph.json"
        before = dist.read_bytes()
        process = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_research_claims.py"), "--format", "json"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        self.assertEqual(0, process.returncode, process.stdout.decode("utf-8", errors="replace"))
        self.assertEqual(before, dist.read_bytes())

    def test_missing_baseline_is_infrastructure_error(self) -> None:
        process = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "validate_research_claims.py"),
                "--format",
                "json",
                "--baseline-ref",
                "refs/heads/definitely-missing-claim-baseline",
            ],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        output = json.loads(process.stdout.decode("utf-8"))
        self.assertEqual(2, process.returncode)
        self.assertIsNone(output["valid"])
        self.assertEqual("BASELINE_UNAVAILABLE", output["infrastructure_errors"][0]["code"])


if __name__ == "__main__":
    unittest.main()
