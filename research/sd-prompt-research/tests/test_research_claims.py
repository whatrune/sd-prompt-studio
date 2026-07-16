from __future__ import annotations

import copy
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_concept_graph import build_graph  # noqa: E402
from validate_research_claims import (  # noqa: E402
    ClaimValidator,
    InvalidTextEncodingError,
    KnowledgeData,
    UniqueKeyLoader,
    assertion_payload,
    canonical_bytes,
    content_hash,
    empty_knowledge,
    graph_identity,
    index_documents,
    load_current_documents,
    load_schema,
    normalized_text_file_sha256_v1,
    promotion_payload,
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


def checked_in_knowledge() -> KnowledgeData:
    schemas = {
        "assertion": load_schema(ROOT / "schemas" / "research-claim-assertion.schema.json"),
        "review": load_schema(ROOT / "schemas" / "research-claim-review.schema.json"),
        "approval": load_schema(ROOT / "schemas" / "research-promotion-approval.schema.json"),
    }
    issues = []
    data = index_documents(load_current_documents(ROOT / "knowledge"), schemas, issues)
    errors = [issue for issue in issues if issue.severity == "error"]
    if errors:
        raise AssertionError(errors)
    return data


def applied_knowledge() -> tuple[KnowledgeData, KnowledgeData, str, str, str]:
    data = checked_in_knowledge()
    assertion_id = "assertion.brg008.head_back.face_effect.001"
    assertion = copy.deepcopy(data.assertions[assertion_id])
    review_id = f"review.{assertion_id}.001"
    approval_id = f"promotion_approval.{assertion_id}.001"
    application_id = f"application.{assertion_id}.001"
    assertion["promotion"] = {
        "action": "attach_evidence",
        "status": "applied",
        "target_id": "orientation.head.extended_backward",
        "approval_ids": [approval_id],
        "applications": [],
    }
    assertion_hash = content_hash(assertion_payload(assertion, data.evidence))
    plan = promotion_payload(assertion, assertion_hash)
    assert plan is not None
    promotion_hash = content_hash(plan)
    review = {
        "review_id": review_id,
        "assertion_id": assertion_id,
        "record_type": "review",
        "decision": "approve",
        "reviewer": "test",
        "recorded_at": "2026-07-15T00:00:00Z",
        "reviewed_assertion_hash": assertion_hash,
        "hash_algorithm": "sha256",
        "review_scope": "assertion_content_v1",
        "supersedes_review_ids": [],
    }
    approval = {
        "approval_id": approval_id,
        "assertion_id": assertion_id,
        "record_type": "approval",
        "approved_by": "test",
        "approved_at": "2026-07-15T01:00:00Z",
        "recorded_at": "2026-07-15T01:00:00Z",
        "approved_assertion_hash": assertion_hash,
        "approved_promotion_hash": promotion_hash,
        "claim_review_ids": [review_id],
        "hash_algorithm": "sha256",
        "review_scope": "promotion_content_v1",
        "supersedes_approval_ids": [],
    }
    application = {
        "application_id": application_id,
        "assertion_id": assertion_id,
        "claim_review_ids": [review_id],
        "promotion_approval_id": approval_id,
        "applied_promotion_plan": plan,
        "applied_assertion_hash": assertion_hash,
        "applied_promotion_hash": promotion_hash,
        "applied_content": {
            "content_kind": "evidence_ref",
            "collection": "concepts",
            "content_hash": "c" * 64,
            "hash_algorithm": "sha256",
            "hash_scope": "graph_content_v1",
            "content_locator": {
                "target_id": "orientation.head.extended_backward",
                "field_path": "/evidence_refs",
                "item_key": "evidence.brg008b.gaze_direction.not_visible",
            },
        },
        "applied_graph_version": "0.1.0",
        "applied_at": "2026-07-15T02:00:00Z",
        "recorded_at": "2026-07-15T02:00:00Z",
        "supersedes_application_ids": [],
        "applied_target_id": "orientation.head.extended_backward",
    }
    assertion["promotion"]["applications"] = [application]
    data.assertions = {assertion_id: assertion}
    data.assertion_files = {assertion_id: "sd-prompt-research/knowledge/assertions/phrase-behaviors.yaml"}
    data.reviews = {review_id: review}
    data.review_files = {review_id: "claim-review.yaml"}
    data.approvals = {approval_id: approval}
    data.approval_files = {approval_id: "promotion-approval.yaml"}
    data.applications = {application_id: application}
    data.application_files = {application_id: "phrase-behaviors.yaml"}
    return data, copy.deepcopy(data), assertion_id, approval_id, application_id


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
        self.assertEqual(3, len(data.evidence))
        self.assertEqual({}, data.reviews)
        self.assertEqual({}, data.approvals)

    def test_text_file_hash_normalizes_lf_crlf_and_cr_bytes(self) -> None:
        variants = (
            b"registry:\n  enabled: true\n",
            b"registry:\r\n  enabled: true\r\n",
            b"registry:\r  enabled: true\r",
        )
        with tempfile.TemporaryDirectory() as directory:
            hashes = []
            for index, payload in enumerate(variants):
                path = Path(directory) / f"registry-{index}.yaml"
                path.write_bytes(payload)
                hashes.append(normalized_text_file_sha256_v1(path))
        self.assertEqual(1, len(set(hashes)))
        self.assertEqual(
            "c1caff7eccf1c5f127fcb8756306011655f74fd04c55217a8b06ea94fdff2fe7",
            hashes[0],
        )

    def test_text_file_hash_ignores_utf8_bom(self) -> None:
        payload = "registry:\n  label: 日本語\n".encode("utf-8")
        with tempfile.TemporaryDirectory() as directory:
            plain = Path(directory) / "plain.yaml"
            bom = Path(directory) / "bom.yaml"
            plain.write_bytes(payload)
            bom.write_bytes(b"\xef\xbb\xbf" + payload)
            self.assertEqual(
                normalized_text_file_sha256_v1(plain),
                normalized_text_file_sha256_v1(bom),
            )

    def test_checked_in_registry_text_hashes_match_fixed_values(self) -> None:
        self.assertEqual(
            "b1898afeb44a5813feb7d77ccc90a553bc5995dc58190313c28051de229336f9",
            normalized_text_file_sha256_v1(ROOT / "templates" / "rubric-template.yaml"),
        )
        self.assertEqual(
            "c3622d658ed197bf4cac937998b9935616cc7caee89729922305475d2e30bc2c",
            normalized_text_file_sha256_v1(ROOT / "templates" / "face-observation-rubric.yaml"),
        )

    def test_text_file_hash_rejects_invalid_utf8_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.yaml"
            path.write_bytes(b"registry: \xff\n")
            with self.assertRaises(InvalidTextEncodingError):
                normalized_text_file_sha256_v1(path)

    def test_axis_registry_invalid_utf8_is_structured_validation_error(self) -> None:
        data = checked_in_knowledge()
        validator = make_validator(data=data, graph=self.graph)
        with patch(
            "validate_research_claims.normalized_text_file_sha256_v1",
            side_effect=InvalidTextEncodingError("Text file is not valid UTF-8"),
        ):
            validator.validate_assertions()
        codes = [issue.code for issue in validator.issues]
        self.assertIn("TEXT_FILE_INVALID_UTF8", codes)
        self.assertNotIn("AXIS_REGISTRY_HASH_DRIFT", codes)

    def test_semantic_hashes_are_unchanged_by_registry_hash_migration(self) -> None:
        validator = make_validator(data=checked_in_knowledge(), graph=self.graph)
        validator.validate_assertions()
        self.assertEqual(
            {
                "assertion.brg007.arm_support.001": "4b851f18b997cc5d0b3df772de3769a9da42e26077e8fc44bc9b17297432b24c",
                "assertion.brg008.head_back.face_effect.001": "566c79236168674f333b2686bf8d34e5814e614d4032c1b188db141e4b154d4d",
                "assertion.brg008.head_tilted_back.face_effect.001": "c2399177ea23bdcb34f89b06879b8edf7a50aadceadb9c820658004ce03b4e6e",
            },
            validator.assertion_hashes,
        )
        self.assertEqual(
            {
                "assertion.brg008.head_back.face_effect.001": "dd83c66ec7761a434d952bc4c7d599bf5a349b53a436acb01ff038f50356bebb",
            },
            validator.promotion_hashes,
        )

    def test_brg008_phrase_assertions_use_condition_specific_evidence(self) -> None:
        data = checked_in_knowledge()
        head_back = data.assertions["assertion.brg008.head_back.face_effect.001"]
        tilted = data.assertions["assertion.brg008.head_tilted_back.face_effect.001"]
        self.assertEqual(
            ["evidence.brg008b.gaze_direction.not_visible"],
            head_back["observed_metrics"][0]["evidence_ref_ids"],
        )
        self.assertEqual(5, head_back["observed_metrics"][0]["count"])
        self.assertEqual(
            ["evidence.brg008b.gaze_direction.not_visible"],
            [binding["evidence_ref_id"] for binding in head_back["evidence_bindings"]],
        )
        self.assertEqual(
            ["evidence.brg008c.gaze_direction.not_visible"],
            tilted["observed_metrics"][0]["evidence_ref_ids"],
        )
        self.assertEqual(1, tilted["observed_metrics"][0]["count"])
        self.assertEqual(
            ["evidence.brg008c.gaze_direction.not_visible"],
            [binding["evidence_ref_id"] for binding in tilted["evidence_bindings"]],
        )

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

    def test_observed_metric_rejects_missing_evidence_id(self) -> None:
        data = checked_in_knowledge()
        assertion = data.assertions["assertion.brg007.arm_support.001"]
        assertion["observed_metrics"][0]["evidence_ref_ids"] = ["evidence.missing.metric"]
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_observed_metrics()
        self.assertIn("OBSERVED_METRIC_EVIDENCE_NOT_FOUND", {issue.code for issue in validator.issues})

    def test_observed_metric_rejects_metric_path_mismatch(self) -> None:
        data = checked_in_knowledge()
        evidence_id = "evidence.brg007b.primary_morphology.reclined_arm_support"
        data.evidence[evidence_id]["metric"] = "computed_aggregate.primary_morphology_counts.lying_pose"
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_observed_metrics()
        self.assertIn("OBSERVED_METRIC_PATH_MISMATCH", {issue.code for issue in validator.issues})

    def test_observed_metric_rejects_count_mismatch(self) -> None:
        data = checked_in_knowledge()
        data.assertions["assertion.brg007.arm_support.001"]["observed_metrics"][0]["count"] = 4
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_observed_metrics()
        self.assertIn("OBSERVED_METRIC_COUNT_MISMATCH", {issue.code for issue in validator.issues})

    def test_observed_metric_rejects_total_mismatch(self) -> None:
        data = checked_in_knowledge()
        data.assertions["assertion.brg007.arm_support.001"]["observed_metrics"][0]["total"] = 5
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_observed_metrics()
        self.assertIn("OBSERVED_METRIC_TOTAL_MISMATCH", {issue.code for issue in validator.issues})

    def test_observed_metric_accepts_multiple_evidence_sum(self) -> None:
        data = checked_in_knowledge()
        assertion_id = "assertion.brg007.arm_support.001"
        original_id = "evidence.brg007b.primary_morphology.reclined_arm_support"
        second_id = "evidence.brg007b.primary_morphology.reclined_arm_support_repeat"
        data.evidence[second_id] = {**copy.deepcopy(data.evidence[original_id]), "evidence_ref_id": second_id}
        data.evidence_files[second_id] = data.evidence_files[original_id]
        metric = data.assertions[assertion_id]["observed_metrics"][0]
        metric["evidence_ref_ids"] = [original_id, second_id]
        metric["count"] = 10
        metric["total"] = 12
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_observed_metrics()
        self.assertEqual([], validator.issues)

    def test_observed_metric_rejects_multiple_evidence_sum_mismatch(self) -> None:
        data = checked_in_knowledge()
        assertion_id = "assertion.brg007.arm_support.001"
        original_id = "evidence.brg007b.primary_morphology.reclined_arm_support"
        second_id = "evidence.brg007b.primary_morphology.reclined_arm_support_repeat"
        data.evidence[second_id] = {**copy.deepcopy(data.evidence[original_id]), "evidence_ref_id": second_id}
        data.evidence_files[second_id] = data.evidence_files[original_id]
        metric = data.assertions[assertion_id]["observed_metrics"][0]
        metric["evidence_ref_ids"] = [original_id, second_id]
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_observed_metrics()
        codes = {issue.code for issue in validator.issues}
        self.assertIn("OBSERVED_METRIC_COUNT_MISMATCH", codes)
        self.assertIn("OBSERVED_METRIC_TOTAL_MISMATCH", codes)

    def test_observed_metric_rejects_inconsistent_evidence_metrics(self) -> None:
        data = checked_in_knowledge()
        assertion_id = "assertion.brg007.arm_support.001"
        first_id = "evidence.brg007b.primary_morphology.reclined_arm_support"
        second_id = "evidence.brg008b.gaze_direction.not_visible"
        metric = data.assertions[assertion_id]["observed_metrics"][0]
        metric["evidence_ref_ids"] = [first_id, second_id]
        metric["count"] = data.evidence[first_id]["count"] + data.evidence[second_id]["count"]
        metric["total"] = data.evidence[first_id]["total"] + data.evidence[second_id]["total"]
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_observed_metrics()
        self.assertIn("OBSERVED_METRIC_EVIDENCE_INCONSISTENT", {issue.code for issue in validator.issues})

    def test_evidence_fact_still_matches_observation_json_value(self) -> None:
        data = checked_in_knowledge()
        evidence_id = "evidence.brg008c.gaze_direction.not_visible"
        evidence = data.evidence[evidence_id]
        evidence["count"] = 2
        validator = make_validator(data=data, graph=self.graph)
        validator._validate_evidence(evidence, data.evidence_files[evidence_id], "assertion.test.evidence.001")
        self.assertIn("EVIDENCE_METRIC_MISMATCH", {issue.code for issue in validator.issues})

    def test_registered_axis_must_exist_in_module_registry(self) -> None:
        data = checked_in_knowledge()
        assertion = data.assertions["assertion.brg008.head_back.face_effect.001"]
        assertion["causal_hypotheses"][0]["target_axis"]["registration_status"] = "registered"
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_assertions()
        self.assertIn("REGISTERED_AXIS_NOT_FOUND", {issue.code for issue in validator.issues})

    def test_proposed_axis_already_in_registry_warns(self) -> None:
        data = checked_in_knowledge()
        assertion = data.assertions["assertion.brg008.head_back.face_effect.001"]
        assertion["causal_hypotheses"][0]["target_axis"]["name"] = "gaze_direction"
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_assertions()
        issues = [issue for issue in validator.issues if issue.code == "PROPOSED_AXIS_ALREADY_REGISTERED"]
        self.assertEqual(1, len(issues))
        self.assertEqual("warning", issues[0].severity)

    def test_target_axis_requires_module_registry(self) -> None:
        data = checked_in_knowledge()
        assertion = data.assertions["assertion.brg008.head_back.face_effect.001"]
        assertion["causal_hypotheses"][0]["target_module"] = "hair"
        validator = make_validator(data=data, graph=self.graph)
        validator.validate_assertions()
        self.assertIn("AXIS_REGISTRY_MODULE_NOT_FOUND", {issue.code for issue in validator.issues})

    def test_assertion_content_v1_hash_scope_is_frozen(self) -> None:
        data = checked_in_knowledge()
        assertion_id = "assertion.brg008.head_back.face_effect.001"
        assertion = data.assertions[assertion_id]
        payload = assertion_payload(assertion, data.evidence)
        self.assertEqual(
            {
                "subject", "claim", "evidence_bindings", "resolved_evidence_facts",
                "reproduction", "scope", "generalization_status", "depends_on",
            },
            set(payload),
        )
        original_hash = content_hash(payload)
        for field, value in (
            ("status", "confirmed"),
            ("observed_metrics", []),
            ("interpretation_candidates", []),
            ("causal_hypotheses", []),
            ("supersedes", ["assertion.example.prior.001"]),
            ("notes", "changed outside assertion_content_v1"),
            ("created_by", {"agent": "other", "version": "other", "created_at": "2020-01-01T00:00:00Z"}),
            ("promotion", {"action": "no_promotion", "status": "not_nominated", "approval_ids": [], "applications": []}),
        ):
            changed = copy.deepcopy(assertion)
            changed[field] = value
            self.assertEqual(original_hash, content_hash(assertion_payload(changed, data.evidence)), field)
        included = copy.deepcopy(assertion)
        included["claim"]["statement"] += " changed"
        self.assertNotEqual(original_hash, content_hash(assertion_payload(included, data.evidence)))
        changed_evidence = copy.deepcopy(data.evidence)
        changed_evidence["evidence.brg008b.gaze_direction.not_visible"]["count"] = 4
        self.assertNotEqual(original_hash, content_hash(assertion_payload(assertion, changed_evidence)))
        documentation = (ROOT / "docs" / "research-claim-staging-layer.md").read_text(encoding="utf-8")
        self.assertIn("### `assertion_content_v1`", documentation)
        self.assertIn("- resolved Evidence Fact content, excluding storage location", documentation)
        self.assertIn("Excludes IDs, workflow status, Promotion state", documentation)

    def test_applied_promotion_uses_historical_receipt_after_assertion_change(self) -> None:
        data, baseline, assertion_id, _, _ = applied_knowledge()
        data.assertions[assertion_id]["claim"]["statement"] += " updated later"
        validator = make_validator(data=data, baseline=baseline, graph=self.graph)
        validator.validate_assertions()
        validator.validate_reviews_and_approvals()
        validator.validate_applications()
        self.assertFalse([issue for issue in validator.issues if issue.severity == "error"], validator.issues)
        self.assertIn("PROMOTION_REMEDIATION_REQUIRED", {issue.code for issue in validator.issues})

    def test_applied_promotion_requires_valid_unsuperseded_application(self) -> None:
        data, baseline, assertion_id, _, _ = applied_knowledge()
        data.assertions[assertion_id]["promotion"]["applications"] = []
        data.applications = {}
        data.application_files = {}
        validator = make_validator(data=data, baseline=baseline, graph=self.graph)
        validator.validate_assertions()
        validator.validate_reviews_and_approvals()
        validator.validate_applications()
        self.assertIn("PROMOTION_APPLIED_WITHOUT_APPLICATION", {issue.code for issue in validator.issues})

    def test_applied_promotion_rejects_invalid_unsuperseded_application(self) -> None:
        data, baseline, assertion_id, _, application_id = applied_knowledge()
        data.applications[application_id]["applied_promotion_hash"] = "f" * 64
        validator = make_validator(data=data, baseline=baseline, graph=self.graph)
        validator.validate_assertions()
        validator.validate_reviews_and_approvals()
        validator.validate_applications()
        codes = {issue.code for issue in validator.issues}
        self.assertIn("PROMOTION_PLAN_HASH_MISMATCH", codes)
        self.assertIn("PROMOTION_APPLIED_WITHOUT_APPLICATION", codes)

    def test_applied_promotion_withdrawal_after_application_is_warning(self) -> None:
        data, baseline, assertion_id, approval_id, _ = applied_knowledge()
        withdrawal_id = f"promotion_approval.{assertion_id}.002"
        data.approvals[withdrawal_id] = {
            "approval_id": withdrawal_id,
            "assertion_id": assertion_id,
            "record_type": "withdrawal",
            "withdrawn_at": "2026-07-15T03:00:00Z",
            "recorded_at": "2026-07-15T03:00:00Z",
            "supersedes_approval_ids": [approval_id],
        }
        data.approval_files[withdrawal_id] = "promotion-approval.yaml"
        validator = make_validator(data=data, baseline=baseline, graph=self.graph)
        validator.validate_assertions()
        validator.validate_reviews_and_approvals()
        validator.validate_applications()
        self.assertFalse([issue for issue in validator.issues if issue.severity == "error"], validator.issues)
        remediation = [issue for issue in validator.issues if issue.code == "PROMOTION_REMEDIATION_REQUIRED"]
        self.assertTrue(remediation)
        self.assertTrue(any("Approval is currently withdrawn" in issue.message for issue in remediation))

    def test_applied_review_withdrawal_after_application_is_warning(self) -> None:
        data, baseline, assertion_id, _, _ = applied_knowledge()
        review_id = next(iter(data.reviews))
        withdrawal_id = f"review.{assertion_id}.002"
        data.reviews[withdrawal_id] = {
            "review_id": withdrawal_id,
            "assertion_id": assertion_id,
            "record_type": "withdrawal",
            "withdrawn_at": "2026-07-15T03:00:00Z",
            "recorded_at": "2026-07-15T03:00:00Z",
            "supersedes_review_ids": [review_id],
        }
        data.review_files[withdrawal_id] = "claim-review.yaml"
        validator = make_validator(data=data, baseline=baseline, graph=self.graph)
        validator.validate_assertions()
        validator.validate_reviews_and_approvals()
        validator.validate_applications()
        self.assertFalse([issue for issue in validator.issues if issue.severity == "error"], validator.issues)
        remediation = [issue for issue in validator.issues if issue.code == "PROMOTION_REMEDIATION_REQUIRED"]
        self.assertTrue(any("is currently withdrawn" in issue.message for issue in remediation))

    def test_approved_promotion_still_requires_current_active_approval(self) -> None:
        data, baseline, assertion_id, approval_id, _ = applied_knowledge()
        data.assertions[assertion_id]["promotion"]["status"] = "approved"
        data.assertions[assertion_id]["promotion"]["applications"] = []
        data.applications = {}
        data.application_files = {}
        validator = make_validator(data=data, baseline=baseline, graph=self.graph)
        validator.validate_assertions()
        validator.validate_reviews_and_approvals()
        self.assertNotIn("PROMOTION_WITHOUT_ACTIVE_APPROVAL", {issue.code for issue in validator.issues})
        withdrawal_id = f"promotion_approval.{assertion_id}.002"
        data.approvals[withdrawal_id] = {
            "approval_id": withdrawal_id,
            "assertion_id": assertion_id,
            "record_type": "withdrawal",
            "withdrawn_at": "2026-07-15T03:00:00Z",
            "recorded_at": "2026-07-15T03:00:00Z",
            "supersedes_approval_ids": [approval_id],
        }
        data.approval_files[withdrawal_id] = "promotion-approval.yaml"
        withdrawn_validator = make_validator(data=data, baseline=baseline, graph=self.graph)
        withdrawn_validator.validate_assertions()
        withdrawn_validator.validate_reviews_and_approvals()
        self.assertIn("PROMOTION_WITHOUT_ACTIVE_APPROVAL", {issue.code for issue in withdrawn_validator.issues})

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
        environment = os.environ.copy()
        environment.pop("CLAIM_VALIDATION_BASELINE_SHA", None)
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
            env=environment,
        )
        output = json.loads(process.stdout.decode("utf-8"))
        self.assertEqual(2, process.returncode)
        self.assertIsNone(output["valid"])
        self.assertEqual("BASELINE_UNAVAILABLE", output["infrastructure_errors"][0]["code"])


if __name__ == "__main__":
    unittest.main()
