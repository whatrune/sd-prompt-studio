#!/usr/bin/env python3
"""Validate the Research Claim Staging Layer v3.9.31 Freeze contract."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

import rfc8785
import yaml
from jsonschema import Draft202012Validator, FormatChecker

from build_concept_graph import GraphBuildError, build_graph, write_graph_atomic


SCHEMA_VERSION = "0.1.0"
GRAPH_CONTEXTS = {"current_state", "application_create", "write_finalize"}
AUDIT_KINDS = {"review", "review_withdrawal", "approval", "approval_withdrawal", "application"}
HASH_RE = re.compile(r"^[a-f0-9]{64}$")
NUMBER_SEGMENT_RE = re.compile(r"^(?:0|[1-9][0-9]*)$")
SEMVER_RE = re.compile(
    r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)


class UniqueKeyLoader(yaml.SafeLoader):
    """Safe YAML loader with JSON-like scalar semantics and duplicate rejection."""


UniqueKeyLoader.yaml_implicit_resolvers = copy.deepcopy(
    yaml.SafeLoader.yaml_implicit_resolvers
)
for first, resolvers in list(UniqueKeyLoader.yaml_implicit_resolvers.items()):
    UniqueKeyLoader.yaml_implicit_resolvers[first] = [
        item
        for item in resolvers
        if item[0]
        not in {
            "tag:yaml.org,2002:bool",
            "tag:yaml.org,2002:timestamp",
            "tag:yaml.org,2002:int",
            "tag:yaml.org,2002:float",
        }
    ]
UniqueKeyLoader.add_implicit_resolver(
    "tag:yaml.org,2002:bool", re.compile(r"^(?:true|false)$"), list("tf")
)
UniqueKeyLoader.add_implicit_resolver(
    "tag:yaml.org,2002:int", re.compile(r"^-?(?:0|[1-9][0-9]*)$"), list("-0123456789")
)
UniqueKeyLoader.add_implicit_resolver(
    "tag:yaml.org,2002:float",
    re.compile(
        r"^-?(?:(?:0|[1-9][0-9]*)\.[0-9]+(?:[eE][+-]?[0-9]+)?|"
        r"(?:0|[1-9][0-9]*)[eE][+-]?[0-9]+)$"
    ),
    list("-0123456789"),
)


def _construct_mapping(loader: UniqueKeyLoader, node: yaml.MappingNode, deep: bool = False) -> dict:
    mapping: dict[Any, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"duplicate key: {key!r}",
                key_node.start_mark,
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping
)


@dataclass
class Issue:
    code: str
    severity: str
    file: str
    path: str
    message: str
    assertion_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {key: value for key, value in asdict(self).items() if value is not None}


class InfrastructureFailure(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class InvalidTextEncodingError(ValueError):
    """Raised when a Text File Hash input is not valid UTF-8."""


@dataclass
class KnowledgeData:
    assertions: dict[str, dict[str, Any]]
    assertion_files: dict[str, str]
    evidence: dict[str, dict[str, Any]]
    evidence_files: dict[str, str]
    reviews: dict[str, dict[str, Any]]
    review_files: dict[str, str]
    approvals: dict[str, dict[str, Any]]
    approval_files: dict[str, str]
    applications: dict[str, dict[str, Any]]
    application_files: dict[str, str]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_instant(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("timestamp must remain a YAML string")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    return parsed.astimezone(timezone.utc)


def canonical_bytes(value: Any) -> bytes:
    return rfc8785.dumps(value)


def content_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def raw_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalized_text_file_sha256_v1(path: Path) -> str:
    """Hash UTF-8 text after BOM removal and newline normalization.

    This function is intentionally separate from RFC 8785 JCS-based semantic
    hashes and from raw file hashing. It normalizes only a leading UTF-8 BOM
    and CRLF/CR line endings; all other text representation remains intact.
    """
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise InvalidTextEncodingError(
            f"Text file is not valid UTF-8: {path.as_posix()}"
        ) from exc
    if text.startswith("\ufeff"):
        text = text[1:]
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def yaml_load(text: str, source: str) -> dict[str, Any]:
    try:
        value = yaml.load(text, Loader=UniqueKeyLoader)
    except yaml.YAMLError as exc:
        raise ValueError(f"{source}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{source}: YAML root must be an object")
    return value


def json_path(parts: Iterable[Any]) -> str:
    path = "$"
    for part in parts:
        path += f"[{part}]" if isinstance(part, int) else f".{part}"
    return path


def add_issue(
    issues: list[Issue],
    code: str,
    severity: str,
    file: str,
    path: str,
    message: str,
    assertion_id: str | None = None,
) -> None:
    issues.append(Issue(code, severity, file, path, message, assertion_id))


def load_schema(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_schema(
    value: dict[str, Any],
    schema: dict[str, Any],
    file: str,
    issues: list[Issue],
    infrastructure: bool = False,
) -> None:
    errors = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(value),
        key=lambda error: list(error.absolute_path),
    )
    if errors and infrastructure:
        first = errors[0]
        raise InfrastructureFailure(
            "BASELINE_INVALID", f"{file} {json_path(first.absolute_path)}: {first.message}"
        )
    for error in errors:
        add_issue(
            issues,
            "SCHEMA_VALIDATION_ERROR",
            "error",
            file,
            json_path(error.absolute_path),
            error.message,
        )


def empty_knowledge() -> KnowledgeData:
    return KnowledgeData({}, {}, {}, {}, {}, {}, {}, {}, {}, {})


def _insert_unique(
    index: dict[str, dict[str, Any]],
    files: dict[str, str],
    item_id: str,
    item: dict[str, Any],
    file: str,
    duplicate_code: str,
    issues: list[Issue],
    infrastructure: bool,
) -> None:
    if item_id in index:
        if infrastructure:
            raise InfrastructureFailure(
                "BASELINE_INVALID", f"duplicate ID {item_id!r} in {file} and {files[item_id]}"
            )
        add_issue(
            issues,
            duplicate_code,
            "error",
            file,
            "$",
            f"duplicate ID {item_id!r}; first defined in {files[item_id]}",
        )
        return
    index[item_id] = item
    files[item_id] = file


def index_documents(
    documents: Mapping[str, dict[str, Any]],
    schemas: Mapping[str, dict[str, Any]],
    issues: list[Issue],
    infrastructure: bool = False,
) -> KnowledgeData:
    data = empty_knowledge()
    for file, root in sorted(documents.items()):
        if "assertions" in root:
            validate_schema(root, schemas["assertion"], file, issues, infrastructure)
            for evidence in root.get("evidence_refs", []):
                evidence_id = evidence.get("evidence_ref_id", "")
                _insert_unique(
                    data.evidence, data.evidence_files, evidence_id, evidence, file,
                    "DUPLICATE_EVIDENCE_ID", issues, infrastructure,
                )
            for assertion in root.get("assertions", []):
                assertion_id = assertion.get("assertion_id", "")
                _insert_unique(
                    data.assertions, data.assertion_files, assertion_id, assertion, file,
                    "DUPLICATE_ASSERTION_ID", issues, infrastructure,
                )
                for application in assertion.get("promotion", {}).get("applications", []):
                    application_id = application.get("application_id", "")
                    _insert_unique(
                        data.applications, data.application_files, application_id,
                        application, file, "DUPLICATE_APPLICATION_ID", issues, infrastructure,
                    )
        elif "reviews" in root:
            validate_schema(root, schemas["review"], file, issues, infrastructure)
            for record in root.get("reviews", []):
                record_id = record.get("review_id", "")
                _insert_unique(
                    data.reviews, data.review_files, record_id, record, file,
                    "DUPLICATE_AUDIT_RECORD_ID", issues, infrastructure,
                )
        elif "approvals" in root:
            validate_schema(root, schemas["approval"], file, issues, infrastructure)
            for record in root.get("approvals", []):
                record_id = record.get("approval_id", "")
                _insert_unique(
                    data.approvals, data.approval_files, record_id, record, file,
                    "DUPLICATE_AUDIT_RECORD_ID", issues, infrastructure,
                )
        elif infrastructure:
            raise InfrastructureFailure("BASELINE_INVALID", f"unrecognized YAML root: {file}")
        else:
            add_issue(issues, "UNKNOWN_KNOWLEDGE_ROOT", "error", file, "$", "unrecognized YAML root")
    return data


def load_current_documents(knowledge_root: Path) -> dict[str, dict[str, Any]]:
    documents: dict[str, dict[str, Any]] = {}
    if not knowledge_root.exists():
        return documents
    for path in sorted([*knowledge_root.rglob("*.yaml"), *knowledge_root.rglob("*.yml")]):
        relative = path.relative_to(knowledge_root.parent.parent).as_posix()
        documents[relative] = yaml_load(path.read_text(encoding="utf-8"), relative)
    return documents


def run_git(repo_root: Path, *args: str) -> str:
    process = subprocess.run(
        ["git", *args], cwd=repo_root, text=True, encoding="utf-8",
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if process.returncode:
        raise InfrastructureFailure(
            "BASELINE_UNAVAILABLE", process.stderr.strip() or f"git {' '.join(args)} failed"
        )
    return process.stdout


def resolve_baseline(repo_root: Path, baseline_ref: str) -> tuple[str, str]:
    commit = run_git(repo_root, "rev-parse", f"{baseline_ref}^{{commit}}").strip()
    tree = run_git(repo_root, "rev-parse", f"{commit}^{{tree}}").strip()
    return commit, tree


def git_documents(repo_root: Path, commit: str, prefix: str) -> dict[str, dict[str, Any]]:
    listing = run_git(repo_root, "ls-tree", "-r", "--name-only", commit, "--", prefix)
    documents: dict[str, dict[str, Any]] = {}
    for path in sorted(line.strip() for line in listing.splitlines() if line.strip()):
        if not path.endswith((".yaml", ".yml")):
            continue
        documents[path] = yaml_load(run_git(repo_root, "show", f"{commit}:{path}"), path)
    return documents


def baseline_graph(
    repo_root: Path,
    project_root: Path,
    commit: str,
    graph_schema: Path,
) -> dict[str, Any]:
    prefix = project_root.relative_to(repo_root).as_posix() + "/concepts"
    listing = run_git(repo_root, "ls-tree", "-r", "--name-only", commit, "--", prefix)
    source_paths = [line.strip() for line in listing.splitlines() if line.strip().endswith(".json")]
    if not source_paths:
        raise InfrastructureFailure("BASELINE_INVALID", "baseline contains no Concept Source files")
    with tempfile.TemporaryDirectory() as temporary:
        source_dir = Path(temporary) / "concepts"
        source_dir.mkdir()
        for source_path in source_paths:
            (source_dir / Path(source_path).name).write_text(
                run_git(repo_root, "show", f"{commit}:{source_path}"), encoding="utf-8"
            )
        try:
            graph, _ = build_graph(
                project_root, source_dir, graph_schema, generated_at="2000-01-01T00:00:00Z"
            )
        except (GraphBuildError, ValueError) as exc:
            raise InfrastructureFailure("BASELINE_INVALID", f"baseline graph invalid: {exc}") from exc
    return graph


def graph_identity(graph: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: graph.get(key, [])
        for key in ("concepts", "relations", "target_patterns", "unmodeled_effects", "model_profiles")
    }


def semver_compare(left: str, right: str) -> int:
    def parse(value: str) -> tuple[tuple[int, int, int], list[str] | None]:
        match = SEMVER_RE.fullmatch(value)
        if not match:
            raise ValueError(f"invalid SemVer: {value!r}")
        prerelease = match.group(4).split(".") if match.group(4) else None
        return (int(match.group(1)), int(match.group(2)), int(match.group(3))), prerelease

    left_core, left_pre = parse(left)
    right_core, right_pre = parse(right)
    if left_core != right_core:
        return (left_core > right_core) - (left_core < right_core)
    if left_pre is None or right_pre is None:
        return (left_pre is None) - (right_pre is None)
    for a, b in zip(left_pre, right_pre):
        if a == b:
            continue
        a_numeric, b_numeric = a.isdigit(), b.isdigit()
        if a_numeric and b_numeric:
            return (int(a) > int(b)) - (int(a) < int(b))
        if a_numeric != b_numeric:
            return -1 if a_numeric else 1
        return (a > b) - (a < b)
    return (len(left_pre) > len(right_pre)) - (len(left_pre) < len(right_pre))


def dotted_get(value: Any, path: str) -> Any:
    current = value
    for segment in path.split("."):
        if not isinstance(current, dict) or segment not in current:
            raise KeyError(path)
        current = current[segment]
    return current


def evidence_hash_value(evidence: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: evidence[key]
        for key in (
            "evidence_ref_id", "observation_module", "metric", "denominator_path",
            "count", "total", "measurement_coverage", "notes",
        )
        if key in evidence
    }


def assertion_payload(assertion: Mapping[str, Any], evidence: Mapping[str, dict[str, Any]]) -> dict[str, Any]:
    bindings = sorted(
        copy.deepcopy(assertion.get("evidence_bindings", [])),
        key=lambda item: (item["evidence_ref_id"], item["applies_to"], item["evidence_role"]),
    )
    evidence_ids = sorted({item["evidence_ref_id"] for item in bindings})
    return {
        "subject": assertion["subject"],
        "claim": assertion["claim"],
        "evidence_bindings": bindings,
        "resolved_evidence_facts": [evidence_hash_value(evidence[item]) for item in evidence_ids],
        "reproduction": assertion["reproduction"],
        "scope": assertion["scope"],
        "generalization_status": assertion["generalization_status"],
        "depends_on": sorted(assertion.get("depends_on", [])),
    }


def promotion_payload(assertion: Mapping[str, Any], assertion_hash: str) -> dict[str, Any] | None:
    promotion = assertion["promotion"]
    action = promotion["action"]
    if action in {"retain_unmodeled", "no_promotion"}:
        return None
    payload = {"action": action, "assertion_hash": assertion_hash}
    if action.startswith("create_"):
        if "proposed_id" not in promotion:
            return None
        payload["proposed_id"] = promotion["proposed_id"]
    else:
        payload["target_id"] = promotion["target_id"]
    return payload


def check_cycles(
    adjacency: Mapping[str, list[str]],
    code: str,
    files: Mapping[str, str],
    issues: list[Issue],
) -> None:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str) -> None:
        if node in visiting:
            add_issue(issues, code, "error", files.get(node, ""), "$", f"cycle includes {node}")
            return
        if node in visited:
            return
        visiting.add(node)
        for target in adjacency.get(node, []):
            visit(target)
        visiting.remove(node)
        visited.add(node)

    for node in adjacency:
        visit(node)


def record_time(record: Mapping[str, Any]) -> datetime:
    return parse_instant(record["recorded_at"])


def review_effective_status_at(
    review_id: str,
    evaluated_at: datetime,
    assertion_hash: str,
    reviews: Mapping[str, dict[str, Any]],
) -> tuple[str, list[str]]:
    record = reviews[review_id]
    reasons: list[str] = []
    for candidate in reviews.values():
        if record_time(candidate) > evaluated_at:
            continue
        targets = candidate.get("supersedes_review_ids", [])
        if review_id not in targets:
            continue
        reasons.append("withdrawn" if candidate.get("record_type") == "withdrawal" else "superseded")
    if record.get("reviewed_assertion_hash") != assertion_hash:
        reasons.append("historical_assertion_hash")
    for status in ("withdrawn", "superseded", "historical_hash"):
        if status == "historical_hash" and any(item.startswith("historical_") for item in reasons):
            return status, reasons
        if status in reasons:
            return status, reasons
    return "active", reasons


def approval_effective_status_at(
    approval_id: str,
    evaluated_at: datetime,
    assertion_hash: str,
    promotion_hash: str,
    approvals: Mapping[str, dict[str, Any]],
) -> tuple[str, list[str]]:
    record = approvals[approval_id]
    reasons: list[str] = []
    for candidate in approvals.values():
        if record_time(candidate) > evaluated_at:
            continue
        targets = candidate.get("supersedes_approval_ids", [])
        if approval_id not in targets:
            continue
        reasons.append("withdrawn" if candidate.get("record_type") == "withdrawal" else "superseded")
    if record.get("approved_assertion_hash") != assertion_hash:
        reasons.append("historical_assertion_hash")
    if record.get("approved_promotion_hash") != promotion_hash:
        reasons.append("historical_promotion_hash")
    for status in ("withdrawn", "superseded", "historical_hash"):
        if status == "historical_hash" and any(item.startswith("historical_") for item in reasons):
            return status, reasons
        if status in reasons:
            return status, reasons
    return "active", reasons


def audit_records(data: KnowledgeData) -> dict[str, tuple[str, str, dict[str, Any]]]:
    result: dict[str, tuple[str, str, dict[str, Any]]] = {}
    for record_id, record in data.reviews.items():
        kind = "review" if record.get("record_type") == "review" else "review_withdrawal"
        result[record_id] = (kind, data.review_files[record_id], record)
    for record_id, record in data.approvals.items():
        kind = "approval" if record.get("record_type") == "approval" else "approval_withdrawal"
        result[record_id] = (kind, data.approval_files[record_id], record)
    for record_id, record in data.applications.items():
        result[record_id] = ("application", data.application_files[record_id], record)
    return result


class ClaimValidator:
    def __init__(
        self,
        project_root: Path,
        repo_root: Path,
        data: KnowledgeData,
        baseline: KnowledgeData,
        candidate_graph: dict[str, Any] | None,
        baseline_candidate_graph: dict[str, Any] | None,
        validation_context: str,
        validation_run_at: datetime,
        evaluated_at: datetime,
        strict: bool,
        assertion_id: str | None,
        approval_id: str | None,
        application_id: str | None,
    ) -> None:
        self.project_root = project_root
        self.repo_root = repo_root
        self.data = data
        self.baseline = baseline
        self.candidate_graph = candidate_graph
        self.baseline_candidate_graph = baseline_candidate_graph
        self.context = validation_context
        self.validation_run_at = validation_run_at
        self.evaluated_at = evaluated_at
        self.strict = strict
        self.assertion_id = assertion_id
        self.approval_id = approval_id
        self.application_id = application_id
        self.issues: list[Issue] = []
        self.assertion_hashes: dict[str, str] = {}
        self.promotion_hashes: dict[str, str] = {}
        self.review_states: dict[str, dict[str, Any]] = {}
        self.approval_states: dict[str, dict[str, Any]] = {}

    def issue(
        self, code: str, message: str, file: str = "", path: str = "$",
        assertion_id: str | None = None, severity: str = "error",
    ) -> None:
        add_issue(self.issues, code, severity, file, path, message, assertion_id)

    def validate(self) -> None:
        self.validate_future_timestamps()
        self.validate_graph_versions()
        self.validate_assertions()
        self.validate_evidence_facts()
        self.validate_observed_metrics()
        self.validate_references()
        self.validate_reviews_and_approvals()
        self.validate_applications()
        self.validate_append_only()

    def validate_future_timestamps(self) -> None:
        entries: list[tuple[str, str, str, str | None]] = []
        for assertion_id, assertion in self.data.assertions.items():
            entries.append((self.data.assertion_files[assertion_id], "$.created_by.created_at", assertion["created_by"]["created_at"], assertion_id))
        for record_id, record in self.data.reviews.items():
            entries.append((self.data.review_files[record_id], "$.recorded_at", record["recorded_at"], record.get("assertion_id")))
            if "withdrawn_at" in record:
                entries.append((self.data.review_files[record_id], "$.withdrawn_at", record["withdrawn_at"], record.get("assertion_id")))
        for record_id, record in self.data.approvals.items():
            entries.append((self.data.approval_files[record_id], "$.recorded_at", record["recorded_at"], record.get("assertion_id")))
            for field in ("approved_at", "withdrawn_at"):
                if field in record:
                    entries.append((self.data.approval_files[record_id], f"$.{field}", record[field], record.get("assertion_id")))
        for application_id, application in self.data.applications.items():
            file = self.data.application_files[application_id]
            for field in ("applied_at", "recorded_at"):
                entries.append((file, f"$.{field}", application[field], application.get("assertion_id")))
        for file, path, value, assertion_id in entries:
            try:
                instant = parse_instant(value)
            except (TypeError, ValueError) as exc:
                self.issue("INVALID_TIMESTAMP", str(exc), file, path, assertion_id)
                continue
            if instant > self.validation_run_at:
                self.issue("FUTURE_DATED_TIMESTAMP", "timestamp is later than validation_run_at", file, path, assertion_id)

    def validate_graph_versions(self) -> None:
        if self.context not in GRAPH_CONTEXTS or not self.candidate_graph or not self.baseline_candidate_graph:
            return
        baseline_identity = content_hash(graph_identity(self.baseline_candidate_graph))
        candidate_identity = content_hash(graph_identity(self.candidate_graph))
        baseline_version = self.baseline_candidate_graph["graph_version"]
        candidate_version = self.candidate_graph["graph_version"]
        try:
            comparison = semver_compare(candidate_version, baseline_version)
        except ValueError as exc:
            self.issue("GRAPH_VERSION_INVALID", str(exc), "concepts", "$.graph_version")
            return
        if baseline_identity != candidate_identity and comparison <= 0:
            self.issue(
                "GRAPH_VERSION_NOT_INCREMENTED",
                f"Graph content changed but version {candidate_version!r} is not greater than {baseline_version!r}",
                "concepts", "$.graph_version",
            )
        if baseline_identity == candidate_identity and comparison != 0:
            self.issue(
                "GRAPH_VERSION_CHANGED_WITHOUT_CONTENT",
                f"Graph content is unchanged but version changed from {baseline_version!r} to {candidate_version!r}",
                "concepts", "$.graph_version",
            )

    def validate_assertions(self) -> None:
        concept_index: dict[str, dict[str, Any]] = {}
        if self.candidate_graph:
            concept_index = {item["concept_id"]: item for item in self.candidate_graph["concepts"]}
        for assertion_id, assertion in self.data.assertions.items():
            file = self.data.assertion_files[assertion_id]
            try:
                digest = content_hash(assertion_payload(assertion, self.data.evidence))
            except KeyError as exc:
                self.issue("EVIDENCE_REFERENCE_NOT_FOUND", f"missing evidence {exc.args[0]!r}", file, "$.evidence_bindings", assertion_id)
                continue
            self.assertion_hashes[assertion_id] = digest
            promotion = promotion_payload(assertion, digest)
            if promotion is not None:
                self.promotion_hashes[assertion_id] = content_hash(promotion)
            self._validate_assertion_semantics(assertion_id, assertion, file, concept_index)

    def _validate_assertion_semantics(
        self, assertion_id: str, assertion: dict[str, Any], file: str,
        concept_index: Mapping[str, dict[str, Any]],
    ) -> None:
        reproduction = assertion["reproduction"]
        for count_field, ids_field in (
            ("condition_count", "condition_ids"), ("run_count", "run_ids"),
            ("independent_experiment_count", "experiment_group_ids"),
            ("model_count", "model_ids"), ("context_count", "context_ids"),
        ):
            if reproduction[count_field] != len(reproduction[ids_field]):
                self.issue("REPRODUCTION_COUNT_MISMATCH", f"{count_field} does not match {ids_field}", file, f"$.reproduction.{count_field}", assertion_id)
        scope = assertion["scope"]
        if scope["model_scope"] == "single_model" and reproduction["model_count"] != 1:
            self.issue("MODEL_SCOPE_MISMATCH", "single_model requires model_count == 1", file, "$.scope.model_scope", assertion_id)
        if scope["model_scope"] == "multi_model" and reproduction["model_count"] < 2:
            self.issue("MODEL_SCOPE_MISMATCH", "multi_model requires model_count >= 2", file, "$.scope.model_scope", assertion_id)
        if scope["context_scope"] == "single_context" and reproduction["context_count"] != 1:
            self.issue("CONTEXT_SCOPE_MISMATCH", "single_context requires context_count == 1", file, "$.scope.context_scope", assertion_id)
        if scope["context_scope"] == "multi_context" and reproduction["context_count"] < 2:
            self.issue("CONTEXT_SCOPE_MISMATCH", "multi_context requires context_count >= 2", file, "$.scope.context_scope", assertion_id)
        general = scope["generalization_scope"] == "general"
        tested = assertion["generalization_status"]
        untested = not tested["model_dependency_tested"] or not tested["context_dependency_tested"]
        if general and untested and assertion["status"] in {"draft", "provisional"}:
            self.issue("GENERALIZATION_UNTESTED", "general scope is not dependency-tested", file, "$.scope.generalization_scope", assertion_id, "warning")
        if general and untested and assertion["status"] == "confirmed":
            self.issue("GENERALIZATION_UNTESTED", "confirmed general claim must be dependency-tested", file, "$.scope.generalization_scope", assertion_id)
        concept_ids: list[tuple[str, str]] = []
        if assertion["subject"]["kind"] == "concept_ref":
            concept_ids.append((assertion["subject"]["concept_id"], "$.subject.concept_id"))
        for index, hypothesis in enumerate(assertion["causal_hypotheses"]):
            concept_ids.append((hypothesis["source"], f"$.causal_hypotheses[{index}].source"))
            if "target_concept_id" in hypothesis:
                concept_ids.append((hypothesis["target_concept_id"], f"$.causal_hypotheses[{index}].target_concept_id"))
        promotion = assertion["promotion"]
        if "target_id" in promotion:
            concept_ids.append((promotion["target_id"], "$.promotion.target_id"))
        if self.candidate_graph is not None:
            for concept_id, path in concept_ids:
                concept = concept_index.get(concept_id)
                if concept is None:
                    self.issue("CONCEPT_REFERENCE_NOT_FOUND", f"Concept {concept_id!r} does not exist", file, path, assertion_id)
                elif concept.get("status") == "rejected":
                    self.issue("CONCEPT_REFERENCE_REJECTED", f"Concept {concept_id!r} is rejected", file, path, assertion_id)
                elif concept.get("status") in {"provisional", "deprecated"}:
                    self.issue("CONCEPT_REFERENCE_NONFINAL", f"Concept {concept_id!r} is {concept['status']}", file, path, assertion_id, "warning")
        registry_refs = next(
            (root.get("axis_registry_refs", {}) for path, root in load_current_documents(self.project_root / "knowledge").items() if path == file),
            {},
        )
        registry_axes: dict[str, set[str]] = {}
        registry_axis_fields = {
            "pose": "active_observation_axes",
            "face": "active_face_axes",
        }
        for module, registry in registry_refs.items():
            path = self.repo_root / registry["path"]
            if not path.is_file():
                self.issue("AXIS_REGISTRY_NOT_FOUND", f"Axis registry for {module} does not exist", file, f"$.axis_registry_refs.{module}.path", assertion_id)
                continue
            try:
                registry_sha256 = normalized_text_file_sha256_v1(path)
            except InvalidTextEncodingError as exc:
                self.issue(
                    "TEXT_FILE_INVALID_UTF8",
                    str(exc),
                    file,
                    f"$.axis_registry_refs.{module}.path",
                    assertion_id,
                )
                continue
            if registry_sha256 != registry["sha256"]:
                self.issue("AXIS_REGISTRY_HASH_DRIFT", f"Axis registry for {module} changed", file, f"$.axis_registry_refs.{module}.sha256", assertion_id, "warning")
            axis_field = registry_axis_fields.get(module)
            if axis_field is None:
                continue
            try:
                registry_data = yaml_load(path.read_text(encoding="utf-8"), registry["path"])
            except (OSError, ValueError) as exc:
                self.issue("AXIS_REGISTRY_INVALID", str(exc), file, f"$.axis_registry_refs.{module}.path", assertion_id)
                continue
            active_axes = registry_data.get(axis_field)
            if not isinstance(active_axes, list) or not all(isinstance(axis, str) for axis in active_axes):
                self.issue("AXIS_REGISTRY_INVALID", f"{axis_field} must be an array of strings", file, f"$.axis_registry_refs.{module}.path", assertion_id)
                continue
            registry_axes[module] = set(active_axes)
        for index, hypothesis in enumerate(assertion["causal_hypotheses"]):
            target_axis = hypothesis.get("target_axis")
            if target_axis is None:
                continue
            module = hypothesis["target_module"]
            path = f"$.causal_hypotheses[{index}].target_axis"
            if module not in registry_refs or module not in registry_axis_fields:
                self.issue(
                    "AXIS_REGISTRY_MODULE_NOT_FOUND",
                    f"No Axis Registry is configured for target module {module!r}",
                    file,
                    path,
                    assertion_id,
                )
                continue
            if module not in registry_axes:
                continue
            axis_name = target_axis["name"]
            registered = axis_name in registry_axes[module]
            if target_axis["registration_status"] == "registered" and not registered:
                self.issue(
                    "REGISTERED_AXIS_NOT_FOUND",
                    f"Axis {axis_name!r} is not active in the {module} registry",
                    file,
                    f"{path}.name",
                    assertion_id,
                )
            if target_axis["registration_status"] == "proposed" and registered:
                self.issue(
                    "PROPOSED_AXIS_ALREADY_REGISTERED",
                    f"Proposed axis {axis_name!r} is already active in the {module} registry",
                    file,
                    f"{path}.registration_status",
                    assertion_id,
                    "warning",
                )

    def validate_evidence_facts(self) -> None:
        for evidence_id, evidence in self.data.evidence.items():
            self._validate_evidence(evidence, self.data.evidence_files[evidence_id], None)

    def _validate_evidence(
        self,
        evidence: dict[str, Any],
        file: str,
        assertion_id: str | None,
    ) -> None:
        observation_path = self.repo_root / evidence["observation_path"]
        if not observation_path.is_file():
            self.issue("EVIDENCE_PATH_NOT_FOUND", f"Observation file does not exist: {evidence['observation_path']}", file, "$.evidence_refs", assertion_id)
            return
        try:
            observation = json.loads(observation_path.read_text(encoding="utf-8"))
            measured = dotted_get(observation, evidence["metric"])
            denominator = dotted_get(observation, evidence["denominator_path"])
        except (OSError, json.JSONDecodeError, KeyError) as exc:
            self.issue("EVIDENCE_PATH_INVALID", str(exc), file, "$.evidence_refs", assertion_id)
            return
        if measured != evidence["count"]:
            self.issue("EVIDENCE_METRIC_MISMATCH", f"stored count {evidence['count']} != observed {measured}", file, "$.evidence_refs", assertion_id)
        if denominator != evidence["total"]:
            self.issue("EVIDENCE_DENOMINATOR_MISMATCH", f"stored total {evidence['total']} != observed {denominator}", file, "$.evidence_refs", assertion_id)
        level = evidence["measurement_coverage"]["level"]
        panel_count = observation.get("panel_count")
        if level == "full" and panel_count is not None and evidence["total"] != panel_count:
            self.issue("EVIDENCE_COVERAGE_MISMATCH", "full coverage requires total == panel_count", file, "$.evidence_refs", assertion_id)
        if level in {"partial", "limited"} and panel_count is not None and evidence["total"] > panel_count:
            self.issue("EVIDENCE_COVERAGE_MISMATCH", "partial coverage total cannot exceed panel_count", file, "$.evidence_refs", assertion_id)

    def validate_observed_metrics(self) -> None:
        """Validate observation summaries independently from Evidence Bindings."""
        for assertion_id, assertion in self.data.assertions.items():
            file = self.data.assertion_files[assertion_id]
            for metric_index, observed_metric in enumerate(assertion["observed_metrics"]):
                metric_path = f"$.observed_metrics[{metric_index}]"
                evidence_facts: list[dict[str, Any]] = []
                for evidence_index, evidence_id in enumerate(observed_metric["evidence_ref_ids"]):
                    evidence = self.data.evidence.get(evidence_id)
                    if evidence is None:
                        self.issue(
                            "OBSERVED_METRIC_EVIDENCE_NOT_FOUND",
                            f"Evidence {evidence_id!r} does not exist",
                            file,
                            f"{metric_path}.evidence_ref_ids[{evidence_index}]",
                            assertion_id,
                        )
                        continue
                    evidence_facts.append(evidence)
                    if evidence["metric"] != observed_metric["metric"]:
                        self.issue(
                            "OBSERVED_METRIC_PATH_MISMATCH",
                            f"Evidence {evidence_id!r} metric {evidence['metric']!r} does not match {observed_metric['metric']!r}",
                            file,
                            f"{metric_path}.metric",
                            assertion_id,
                        )
                if not evidence_facts:
                    continue
                evidence_metrics = {evidence["metric"] for evidence in evidence_facts}
                if len(evidence_metrics) > 1:
                    self.issue(
                        "OBSERVED_METRIC_EVIDENCE_INCONSISTENT",
                        f"Evidence Facts use different metrics: {sorted(evidence_metrics)}",
                        file,
                        f"{metric_path}.evidence_ref_ids",
                        assertion_id,
                    )
                expected_count = sum(evidence["count"] for evidence in evidence_facts)
                expected_total = sum(evidence["total"] for evidence in evidence_facts)
                if observed_metric["count"] != expected_count:
                    self.issue(
                        "OBSERVED_METRIC_COUNT_MISMATCH",
                        f"stored count {observed_metric['count']} != Evidence Fact count sum {expected_count}",
                        file,
                        f"{metric_path}.count",
                        assertion_id,
                    )
                if observed_metric["total"] != expected_total:
                    self.issue(
                        "OBSERVED_METRIC_TOTAL_MISMATCH",
                        f"stored total {observed_metric['total']} != Evidence Fact total {expected_total}",
                        file,
                        f"{metric_path}.total",
                        assertion_id,
                    )

    def validate_references(self) -> None:
        assertion_adjacency: dict[str, list[str]] = {}
        supersedes_adjacency: dict[str, list[str]] = {}
        for assertion_id, assertion in self.data.assertions.items():
            file = self.data.assertion_files[assertion_id]
            valid_targets = {assertion_id}
            valid_targets.update(item["interpretation_candidate_id"] for item in assertion["interpretation_candidates"])
            valid_targets.update(item["causal_hypothesis_id"] for item in assertion["causal_hypotheses"])
            for index, binding in enumerate(assertion["evidence_bindings"]):
                if binding["evidence_ref_id"] not in self.data.evidence:
                    self.issue("EVIDENCE_REFERENCE_NOT_FOUND", f"Evidence {binding['evidence_ref_id']!r} does not exist", file, f"$.evidence_bindings[{index}].evidence_ref_id", assertion_id)
                if binding["applies_to"] not in valid_targets:
                    self.issue("BINDING_TARGET_NOT_FOUND", f"Binding target {binding['applies_to']!r} is not local to assertion", file, f"$.evidence_bindings[{index}].applies_to", assertion_id)
            for field, adjacency in (("depends_on", assertion_adjacency), ("supersedes", supersedes_adjacency)):
                adjacency[assertion_id] = list(assertion[field])
                for target in assertion[field]:
                    if target not in self.data.assertions:
                        self.issue("ASSERTION_REFERENCE_NOT_FOUND", f"Assertion {target!r} does not exist", file, f"$.{field}", assertion_id)
                    if target == assertion_id:
                        self.issue("ASSERTION_SELF_REFERENCE", f"{field} cannot reference itself", file, f"$.{field}", assertion_id)
            if assertion["status"] == "superseded" and not any(assertion_id in other["supersedes"] for other in self.data.assertions.values()):
                self.issue("SUPERSEDED_ASSERTION_WITHOUT_SUCCESSOR", "superseded assertion has no successor reference", file, "$.status", assertion_id)
        check_cycles(assertion_adjacency, "ASSERTION_DEPENDENCY_CYCLE", self.data.assertion_files, self.issues)
        check_cycles(supersedes_adjacency, "ASSERTION_SUPERSEDES_CYCLE", self.data.assertion_files, self.issues)

    def validate_reviews_and_approvals(self) -> None:
        self._validate_audit_root(
            self.data.reviews, self.data.review_files, "review_id", "supersedes_review_ids", "review"
        )
        self._validate_audit_root(
            self.data.approvals, self.data.approval_files, "approval_id", "supersedes_approval_ids", "approval"
        )
        for assertion_id, assertion in self.data.assertions.items():
            assertion_hash = self.assertion_hashes.get(assertion_id)
            if not assertion_hash:
                continue
            for review_id, review in self.data.reviews.items():
                if review.get("record_type") != "review" or review.get("assertion_id") != assertion_id:
                    continue
                if record_time(review) > self.evaluated_at:
                    continue
                state, reasons = review_effective_status_at(
                    review_id, self.evaluated_at, assertion_hash, self.data.reviews
                )
                self.review_states[review_id] = {"effective_status": state, "status_reasons": reasons}
            promotion_hash = self.promotion_hashes.get(assertion_id)
            if promotion_hash:
                for approval_id, approval in self.data.approvals.items():
                    if approval.get("record_type") != "approval" or approval.get("assertion_id") != assertion_id:
                        continue
                    self._validate_approval_chain(
                        approval_id, approval, assertion_id, assertion_hash, promotion_hash
                    )
                    if record_time(approval) > self.evaluated_at:
                        continue
                    state, reasons = approval_effective_status_at(
                        approval_id, self.evaluated_at, assertion_hash, promotion_hash, self.data.approvals
                    )
                    self.approval_states[approval_id] = {"effective_status": state, "status_reasons": reasons}
            if assertion["status"] == "confirmed":
                active = [
                    review for review_id, review in self.data.reviews.items()
                    if review.get("assertion_id") == assertion_id
                    and review.get("record_type") == "review"
                    and self.review_states.get(review_id, {}).get("effective_status") == "active"
                ]
                if not any(review["decision"] == "approve" for review in active):
                    self.issue("CONFIRMED_WITHOUT_APPROVAL", "confirmed assertion needs an active approve review", self.data.assertion_files[assertion_id], "$.status", assertion_id)
                if any(review["decision"] in {"reject", "needs_evidence"} for review in active):
                    self.issue("CONFIRMED_WITH_BLOCKING_REVIEW", "confirmed assertion has an active blocking review", self.data.assertion_files[assertion_id], "$.status", assertion_id)
            for approval_id in assertion["promotion"].get("approval_ids", []):
                approval = self.data.approvals.get(approval_id)
                if not approval:
                    self.issue("APPROVAL_REFERENCE_NOT_FOUND", f"Approval {approval_id!r} does not exist", self.data.assertion_files[assertion_id], "$.promotion.approval_ids", assertion_id)
                elif approval.get("record_type") != "approval" or approval.get("assertion_id") != assertion_id:
                    self.issue("APPROVAL_REFERENCE_INVALID", f"Approval {approval_id!r} is not an approval for this assertion", self.data.assertion_files[assertion_id], "$.promotion.approval_ids", assertion_id)
            if assertion["promotion"]["status"] == "approved":
                active_approval_ids = {
                    approval_id
                    for approval_id in assertion["promotion"].get("approval_ids", [])
                    if self.approval_states.get(approval_id, {}).get("effective_status") == "active"
                }
                if not active_approval_ids:
                    self.issue(
                        "PROMOTION_WITHOUT_ACTIVE_APPROVAL",
                        "Promotion status 'approved' requires an active current-hash Approval",
                        self.data.assertion_files[assertion_id], "$.promotion.status", assertion_id,
                    )
            for application in assertion["promotion"].get("applications", []):
                if application["promotion_approval_id"] not in assertion["promotion"].get("approval_ids", []):
                    if assertion["promotion"]["status"] == "applied":
                        self.issue(
                            "PROMOTION_REMEDIATION_REQUIRED",
                            "Historical Application Approval is no longer declared by the current Promotion state",
                            self.data.assertion_files[assertion_id], "$.promotion.applications", assertion_id,
                            "warning",
                        )
                    else:
                        self.issue(
                            "APPLICATION_APPROVAL_NOT_DECLARED",
                            "Application promotion_approval_id must appear in promotion.approval_ids",
                            self.data.assertion_files[assertion_id], "$.promotion.applications", assertion_id,
                        )

    def _validate_approval_chain(
        self,
        approval_id: str,
        approval: dict[str, Any],
        assertion_id: str,
        current_assertion_hash: str,
        current_promotion_hash: str,
    ) -> None:
        file = self.data.approval_files[approval_id]
        try:
            approved_at = parse_instant(approval["approved_at"])
            recorded_at = parse_instant(approval["recorded_at"])
        except ValueError:
            return
        if approved_at > recorded_at:
            self.issue(
                "APPROVAL_TIMESTAMP_ORDER", "approved_at must be <= recorded_at",
                file, "$.approved_at", assertion_id,
            )
        for review_id in approval["claim_review_ids"]:
            review = self.data.reviews.get(review_id)
            if not review or review.get("record_type") != "review":
                self.issue(
                    "APPROVAL_REVIEW_NOT_FOUND", f"Review {review_id!r} is missing or a withdrawal",
                    file, "$.claim_review_ids", assertion_id,
                )
                continue
            if review.get("decision") != "approve":
                self.issue(
                    "APPROVAL_REVIEW_NOT_APPROVE", f"Review {review_id!r} is not approve",
                    file, "$.claim_review_ids", assertion_id,
                )
            if review.get("assertion_id") != assertion_id:
                self.issue(
                    "APPROVAL_REVIEW_ASSERTION_MISMATCH", f"Review {review_id!r} belongs to another assertion",
                    file, "$.claim_review_ids", assertion_id,
                )
            if review.get("reviewed_assertion_hash") != approval["approved_assertion_hash"]:
                self.issue(
                    "ASSERTION_HASH_MISMATCH", f"Review {review_id!r} hash differs from Approval",
                    file, "$.claim_review_ids", assertion_id,
                )
            if record_time(review) > approved_at:
                self.issue(
                    "APPROVAL_TIMESTAMP_ORDER", f"Review {review_id!r} was recorded after approved_at",
                    file, "$.claim_review_ids", assertion_id,
                )
            state, _ = review_effective_status_at(
                review_id, approved_at, approval["approved_assertion_hash"], self.data.reviews
            )
            if state != "active":
                self.issue(
                    "APPROVAL_REVIEW_NOT_ACTIVE", f"Review {review_id!r} was {state} at approval time",
                    file, "$.claim_review_ids", assertion_id,
                )
        if self.context == "promotion_approve" and approval_id == self.approval_id:
            if approval["approved_assertion_hash"] != current_assertion_hash:
                self.issue(
                    "ASSERTION_HASH_MISMATCH", "Candidate Approval does not match current Assertion hash",
                    file, "$.approved_assertion_hash", assertion_id,
                )
            if approval["approved_promotion_hash"] != current_promotion_hash:
                self.issue(
                    "PROMOTION_PLAN_HASH_MISMATCH", "Candidate Approval does not match current Promotion hash",
                    file, "$.approved_promotion_hash", assertion_id,
                )

    def _validate_audit_root(
        self, records: Mapping[str, dict[str, Any]], files: Mapping[str, str],
        id_field: str, supersedes_field: str, base_type: str,
    ) -> None:
        adjacency: dict[str, list[str]] = {}
        for record_id, record in records.items():
            adjacency[record_id] = list(record.get(supersedes_field, []))
            if record.get("record_type") == "withdrawal":
                try:
                    if parse_instant(record["withdrawn_at"]) != record_time(record):
                        self.issue("WITHDRAWAL_TIMESTAMP_MISMATCH", "withdrawn_at must equal recorded_at", files[record_id], "$.withdrawn_at", record.get("assertion_id"))
                except ValueError:
                    pass
            for target_id in record.get(supersedes_field, []):
                target = records.get(target_id)
                if not target:
                    self.issue("AUDIT_REFERENCE_NOT_FOUND", f"Referenced record {target_id!r} does not exist", files[record_id], f"$.{supersedes_field}", record.get("assertion_id"))
                    continue
                if target_id == record_id:
                    self.issue("AUDIT_SELF_REFERENCE", "record cannot supersede itself", files[record_id], f"$.{supersedes_field}", record.get("assertion_id"))
                if target.get("record_type") != base_type:
                    self.issue("AUDIT_REFERENCE_TYPE_MISMATCH", f"{supersedes_field} must reference {base_type} records", files[record_id], f"$.{supersedes_field}", record.get("assertion_id"))
                if target.get("assertion_id") != record.get("assertion_id"):
                    self.issue("AUDIT_ASSERTION_MISMATCH", "supersedes reference crosses assertions", files[record_id], f"$.{supersedes_field}", record.get("assertion_id"))
                try:
                    if record_time(record) <= record_time(target):
                        self.issue("AUDIT_TIMESTAMP_ORDER", "superseding record must be later than target", files[record_id], "$.recorded_at", record.get("assertion_id"))
                except ValueError:
                    pass
        check_cycles(adjacency, "AUDIT_REFERENCE_CYCLE", files, self.issues)

    def validate_applications(self) -> None:
        baseline_ids = set(self.baseline.applications)
        new_ids = set(self.data.applications) - baseline_ids
        adjacency: dict[str, list[str]] = {}
        active_by_assertion: dict[str, set[str]] = {}
        superseded_ids = {
            target
            for application in self.data.applications.values()
            for target in application.get("supersedes_application_ids", [])
        }
        for application_id, application in self.data.applications.items():
            assertion_id = application["assertion_id"]
            file = self.data.application_files[application_id]
            issue_start = len(self.issues)
            expected_prefix = f"application.{assertion_id}."
            if not application_id.startswith(expected_prefix):
                self.issue("APPLICATION_ASSERTION_ID_MISMATCH", "application_id does not embed assertion_id", file, "$.application_id", assertion_id)
            if assertion_id not in self.data.assertions:
                self.issue("APPLICATION_ASSERTION_NOT_FOUND", f"Assertion {assertion_id!r} does not exist", file, "$.assertion_id", assertion_id)
                continue
            adjacency[application_id] = list(application["supersedes_application_ids"])
            for target_id in application["supersedes_application_ids"]:
                target = self.data.applications.get(target_id)
                if not target:
                    self.issue("APPLICATION_REFERENCE_NOT_FOUND", f"Application {target_id!r} does not exist", file, "$.supersedes_application_ids", assertion_id)
                    continue
                if target_id == application_id:
                    self.issue("APPLICATION_SELF_REFERENCE", "Application cannot supersede itself", file, "$.supersedes_application_ids", assertion_id)
                if target["assertion_id"] != assertion_id:
                    self.issue("APPLICATION_ASSERTION_MISMATCH", "Application supersedes another assertion", file, "$.supersedes_application_ids", assertion_id)
                if parse_instant(application["applied_at"]) <= parse_instant(target["applied_at"]):
                    self.issue("APPLICATION_TIMESTAMP_ORDER", "superseding Application must be applied later", file, "$.applied_at", assertion_id)
            self._validate_application_chain(application_id, application, file)
            chain_valid = not any(
                issue.severity == "error" for issue in self.issues[issue_start:]
            )
            if application_id not in superseded_ids and chain_valid:
                active_by_assertion.setdefault(assertion_id, set()).add(application_id)
        check_cycles(adjacency, "APPLICATION_REFERENCE_CYCLE", self.data.application_files, self.issues)
        for assertion_id, active_ids in active_by_assertion.items():
            if len(active_ids) > 1:
                self.issue("MULTIPLE_ACTIVE_APPLICATIONS", f"multiple active Applications: {sorted(active_ids)}", self.data.assertion_files.get(assertion_id, ""), "$.promotion.applications", assertion_id)
        for assertion_id, assertion in self.data.assertions.items():
            if assertion["promotion"]["status"] != "applied":
                continue
            active_ids = active_by_assertion.get(assertion_id, set())
            if not active_ids:
                self.issue(
                    "PROMOTION_APPLIED_WITHOUT_APPLICATION",
                    "Promotion status 'applied' requires a valid unsuperseded Application Receipt",
                    self.data.assertion_files[assertion_id],
                    "$.promotion.status",
                    assertion_id,
                )
                continue
            if len(active_ids) == 1:
                application_id = next(iter(active_ids))
                self._validate_applied_promotion_remediation(
                    assertion_id, assertion, self.data.applications[application_id]
                )
        self._validate_new_application_content(new_ids)

    def _validate_applied_promotion_remediation(
        self,
        assertion_id: str,
        assertion: dict[str, Any],
        application: dict[str, Any],
    ) -> None:
        reasons: list[str] = []
        current_assertion_hash = self.assertion_hashes.get(assertion_id)
        current_promotion_hash = self.promotion_hashes.get(assertion_id)
        if current_assertion_hash != application["applied_assertion_hash"]:
            reasons.append("current Assertion hash differs from the applied receipt")
        if current_promotion_hash != application["applied_promotion_hash"]:
            reasons.append("current Promotion hash differs from the applied receipt")
        approval = self.data.approvals.get(application["promotion_approval_id"])
        if approval and approval.get("record_type") == "approval":
            approval_state, _ = approval_effective_status_at(
                approval["approval_id"],
                self.evaluated_at,
                application["applied_assertion_hash"],
                application["applied_promotion_hash"],
                self.data.approvals,
            )
            if approval_state != "active":
                reasons.append(f"Approval is currently {approval_state}")
        for review_id in application["claim_review_ids"]:
            review = self.data.reviews.get(review_id)
            if not review or review.get("record_type") != "review":
                continue
            review_state, _ = review_effective_status_at(
                review_id,
                self.evaluated_at,
                application["applied_assertion_hash"],
                self.data.reviews,
            )
            if review_state != "active":
                reasons.append(f"Review {review_id!r} is currently {review_state}")
        if reasons:
            self.issue(
                "PROMOTION_REMEDIATION_REQUIRED",
                "; ".join(reasons),
                self.data.assertion_files[assertion_id],
                "$.promotion.status",
                assertion_id,
                "warning",
            )

    def _validate_application_chain(self, application_id: str, application: dict[str, Any], file: str) -> None:
        assertion_id = application["assertion_id"]
        action = application["applied_promotion_plan"]["action"]
        content = application["applied_content"]
        action_mapping = {
            "create_concept": ("concept", "concepts", None),
            "create_relation": ("relation", "relations", None),
            "create_target_pattern": ("target_pattern", "target_patterns", None),
            "add_alias": ("alias", "concepts", "/aliases"),
            "attach_model_behavior": ("model_behavior", "concepts", "/model_behaviors"),
            "attach_evidence": ("evidence_ref", "concepts", "/evidence_refs"),
        }
        expected_kind, expected_collection, expected_path = action_mapping[action]
        if content["content_kind"] != expected_kind or content["collection"] != expected_collection:
            self.issue(
                "APPLICATION_CONTENT_KIND_MISMATCH",
                "Application action does not match content_kind/collection",
                file, "$.applied_content", assertion_id,
            )
        if expected_path is not None:
            locator = content["content_locator"]
            if locator["field_path"] != expected_path:
                self.issue(
                    "APPLICATION_CONTENT_PATH_MISMATCH",
                    f"{action} requires field_path {expected_path!r}",
                    file, "$.applied_content.content_locator.field_path", assertion_id,
                )
            if action == "add_alias" and content_hash(locator["item_key"]) != content["content_hash"]:
                self.issue(
                    "APPLICATION_CONTENT_ITEM_KEY_MISMATCH",
                    "Alias item_key JSON String hash must equal content_hash",
                    file, "$.applied_content.content_locator.item_key", assertion_id,
                )
            if action == "attach_model_behavior":
                if not HASH_RE.fullmatch(locator["item_key"]) or locator["item_key"] != content["content_hash"]:
                    self.issue(
                        "APPLICATION_CONTENT_ITEM_KEY_MISMATCH",
                        "Model Behavior item_key must be the 64-character fragment hash",
                        file, "$.applied_content.content_locator.item_key", assertion_id,
                    )
        plan_hash = content_hash(application["applied_promotion_plan"])
        if plan_hash != application["applied_promotion_hash"]:
            self.issue("PROMOTION_PLAN_HASH_MISMATCH", "applied_promotion_plan hash does not match receipt", file, "$.applied_promotion_hash", assertion_id)
        plan_assertion_hash = application["applied_promotion_plan"]["assertion_hash"]
        if plan_assertion_hash != application["applied_assertion_hash"]:
            self.issue("ASSERTION_HASH_MISMATCH", "Promotion Plan assertion_hash does not match receipt", file, "$.applied_assertion_hash", assertion_id)
        approval = self.data.approvals.get(application["promotion_approval_id"])
        if not approval or approval.get("record_type") != "approval":
            self.issue("APPROVAL_REFERENCE_NOT_FOUND", "Application references a missing/non-approval record", file, "$.promotion_approval_id", assertion_id)
            return
        if approval["assertion_id"] != assertion_id:
            self.issue("APPROVAL_ASSERTION_MISMATCH", "Approval belongs to another assertion", file, "$.promotion_approval_id", assertion_id)
        if approval["approved_assertion_hash"] != application["applied_assertion_hash"]:
            self.issue("ASSERTION_HASH_MISMATCH", "Approval assertion hash does not match Application", file, "$.applied_assertion_hash", assertion_id)
        if approval["approved_promotion_hash"] != application["applied_promotion_hash"]:
            self.issue("PROMOTION_PLAN_HASH_MISMATCH", "Approval promotion hash does not match Application", file, "$.applied_promotion_hash", assertion_id)
        if set(approval["claim_review_ids"]) != set(application["claim_review_ids"]):
            self.issue("APPLICATION_REVIEW_SET_MISMATCH", "Application and Approval review ID sets differ", file, "$.claim_review_ids", assertion_id)
        applied_at = parse_instant(application["applied_at"])
        recorded_at = parse_instant(application["recorded_at"])
        if applied_at > recorded_at:
            self.issue("APPLICATION_TIMESTAMP_ORDER", "applied_at must be <= recorded_at", file, "$.recorded_at", assertion_id)
        if parse_instant(approval["recorded_at"]) > applied_at:
            self.issue("APPLICATION_TIMESTAMP_ORDER", "Approval must be recorded no later than Application", file, "$.applied_at", assertion_id)
        approval_state, _ = approval_effective_status_at(
            approval["approval_id"], applied_at, application["applied_assertion_hash"],
            application["applied_promotion_hash"], self.data.approvals,
        )
        if approval_state != "active":
            self.issue("APPLICATION_APPROVAL_NOT_ACTIVE", f"Approval was {approval_state} at application time", file, "$.promotion_approval_id", assertion_id)
        for review_id in application["claim_review_ids"]:
            review = self.data.reviews.get(review_id)
            if not review or review.get("record_type") != "review" or review.get("decision") != "approve":
                self.issue("APPLICATION_REVIEW_INVALID", f"Review {review_id!r} is missing or not approve", file, "$.claim_review_ids", assertion_id)
                continue
            if review["assertion_id"] != assertion_id or review["reviewed_assertion_hash"] != application["applied_assertion_hash"]:
                self.issue("APPLICATION_REVIEW_INVALID", f"Review {review_id!r} assertion/hash mismatch", file, "$.claim_review_ids", assertion_id)
            review_state, _ = review_effective_status_at(
                review_id, parse_instant(approval["approved_at"]), approval["approved_assertion_hash"], self.data.reviews
            )
            if review_state != "active":
                self.issue("APPLICATION_REVIEW_NOT_ACTIVE", f"Review {review_id!r} was {review_state} at approval time", file, "$.claim_review_ids", assertion_id)
            if parse_instant(review["recorded_at"]) > parse_instant(approval["approved_at"]):
                self.issue("APPROVAL_TIMESTAMP_ORDER", "Review must be recorded no later than approved_at", file, "$.claim_review_ids", assertion_id)
        if parse_instant(approval["approved_at"]) > parse_instant(approval["recorded_at"]):
            self.issue("APPROVAL_TIMESTAMP_ORDER", "approved_at must be <= recorded_at", self.data.approval_files[approval["approval_id"]], "$.approved_at", assertion_id)
        plan = application["applied_promotion_plan"]
        if "created_id" in application:
            if application["created_id"] != plan.get("proposed_id"):
                self.issue("APPLICATION_CREATED_ID_MISMATCH", "created_id must equal proposed_id", file, "$.created_id", assertion_id)
        else:
            targets = {application["applied_target_id"], plan.get("target_id"), application["applied_content"]["content_locator"]["target_id"]}
            if len(targets) != 1:
                self.issue("APPLICATION_CONTENT_TARGET_ID_MISMATCH", "Attach target IDs must match", file, "$.applied_target_id", assertion_id)

    def _validate_new_application_content(self, new_ids: set[str]) -> None:
        if self.context == "application_recheck" or not self.candidate_graph:
            return
        locators: dict[tuple[str, str, str, str], str] = {}
        created_ids = {
            application["created_id"]
            for application_id, application in self.data.applications.items()
            if application_id in new_ids and "created_id" in application
        }
        for application_id in sorted(new_ids):
            application = self.data.applications[application_id]
            assertion_id = application["assertion_id"]
            file = self.data.application_files[application_id]
            if "applied_target_id" in application and application["applied_target_id"] in created_ids:
                self.issue("CREATE_ATTACH_TARGET_COLLISION_IN_CHANGE", "Attach targets an object created in the same change", file, "$.applied_target_id", assertion_id)
            if "content_locator" in application["applied_content"]:
                locator = application["applied_content"]["content_locator"]
                key = (application["applied_content"]["collection"], locator["target_id"], locator["field_path"], locator["item_key"])
                if key in locators:
                    self.issue("DUPLICATE_APPLICATION_LOCATOR_IN_CHANGE", f"Locator duplicates {locators[key]}", file, "$.applied_content.content_locator", assertion_id)
                locators[key] = application_id
            try:
                fragment = self._resolve_application_fragment(application)
            except ValueError as exc:
                self.issue("APPLICATION_CONTENT_TARGET_NOT_FOUND", str(exc), file, "$.applied_content.content_locator", assertion_id)
                continue
            digest = content_hash(fragment)
            if digest != application["applied_content"]["content_hash"]:
                self.issue("APPLICATION_CONTENT_HASH_MISMATCH", "resolved content fragment hash does not match receipt", file, "$.applied_content.content_hash", assertion_id)
            if application["applied_promotion_plan"]["action"] == "attach_model_behavior":
                locator = application["applied_content"]["content_locator"]
                if locator["item_key"] != application["applied_content"]["content_hash"]:
                    self.issue("APPLICATION_CONTENT_ITEM_KEY_MISMATCH", "model behavior item_key must equal content_hash", file, "$.applied_content.content_locator.item_key", assertion_id)
            if self.context == "application_create" and application["applied_graph_version"] != self.candidate_graph["graph_version"]:
                self.issue("GRAPH_VERSION_MISMATCH", "Application graph version differs from Candidate Graph", file, "$.applied_graph_version", assertion_id)

    def _resolve_application_fragment(self, application: dict[str, Any]) -> Any:
        action = application["applied_promotion_plan"]["action"]
        content = application["applied_content"]
        mapping = {
            "create_concept": ("concepts", "concept", "concept_id"),
            "create_relation": ("relations", "relation", "relation_id"),
            "create_target_pattern": ("target_patterns", "target_pattern", "target_pattern_id"),
            "add_alias": ("concepts", "alias", None),
            "attach_model_behavior": ("concepts", "model_behavior", None),
            "attach_evidence": ("concepts", "evidence_ref", None),
        }
        expected_collection, expected_kind, object_id_field = mapping[action]
        if content["collection"] != expected_collection or content["content_kind"] != expected_kind:
            raise ValueError("Action does not match content_kind/collection")
        if action.startswith("create_"):
            matches = [item for item in self.candidate_graph[expected_collection] if item.get(object_id_field) == application["created_id"]]
            if len(matches) != 1:
                raise ValueError(f"created object {application['created_id']!r} does not resolve uniquely")
            if matches[0][object_id_field] != application["applied_promotion_plan"]["proposed_id"]:
                raise ValueError("created object ID differs from Promotion Plan")
            return matches[0]
        locator = content["content_locator"]
        concepts = [item for item in self.candidate_graph["concepts"] if item["concept_id"] == locator["target_id"]]
        if len(concepts) != 1:
            raise ValueError(f"target concept {locator['target_id']!r} does not resolve uniquely")
        current: Any = concepts[0]
        for raw_segment in locator["field_path"].split("/")[1:]:
            segment = raw_segment.replace("~1", "/").replace("~0", "~")
            if NUMBER_SEGMENT_RE.fullmatch(segment):
                raise ValueError("array indexes are forbidden in field_path")
            if not isinstance(current, dict) or segment not in current:
                raise ValueError(f"field_path {locator['field_path']!r} does not resolve")
            current = current[segment]
        if not isinstance(current, list):
            raise ValueError("field_path must resolve to an array")
        if action == "add_alias":
            matches = [item for item in current if item == locator["item_key"]]
        elif action == "attach_evidence":
            matches = [item for item in current if isinstance(item, dict) and item.get("evidence_ref_id") == locator["item_key"]]
        else:
            matches = [item for item in current if content_hash(item) == locator["item_key"]]
        if len(matches) == 0:
            raise ValueError("content locator matched no fragments")
        if len(matches) > 1:
            raise ValueError("AMBIGUOUS_CONTENT_TARGET")
        return matches[0]

    def validate_append_only(self) -> None:
        baseline_records = audit_records(self.baseline)
        current_records = audit_records(self.data)
        baseline_max: dict[str, datetime] = {}
        for _, _, record in baseline_records.values():
            assertion_id = record["assertion_id"]
            baseline_max[assertion_id] = max(baseline_max.get(assertion_id, datetime.min.replace(tzinfo=timezone.utc)), record_time(record))
        for record_id, (_, file, baseline_record) in baseline_records.items():
            current = current_records.get(record_id)
            if not current:
                self.issue("APPEND_ONLY_RECORD_DELETED", f"Audit record {record_id!r} was deleted", file, "$", baseline_record.get("assertion_id"))
                continue
            if content_hash(baseline_record) != content_hash(current[2]):
                self.issue("APPEND_ONLY_RECORD_MODIFIED", f"Audit record {record_id!r} was modified", current[1], "$", current[2].get("assertion_id"))
        for record_id, (_, file, record) in current_records.items():
            if record_id in baseline_records:
                continue
            floor = baseline_max.get(record["assertion_id"])
            if floor and record_time(record) < floor:
                self.issue("AUDIT_RECORD_BACKDATE", f"New record predates baseline maximum {format_utc(floor)}", file, "$.recorded_at", record.get("assertion_id"))


def parser(default_root: Path) -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--root", type=Path, default=default_root)
    result.add_argument("--knowledge-root", type=Path)
    result.add_argument("--baseline-ref", default=os.environ.get("CLAIM_VALIDATION_BASELINE_SHA", "origin/main"))
    result.add_argument("--validation-context", choices=["current_state", "promotion_approve", "application_create", "application_recheck", "write_finalize"], default="current_state")
    result.add_argument("--evaluated-at")
    result.add_argument("--assertion-id")
    result.add_argument("--approval-id")
    result.add_argument("--application-id")
    result.add_argument("--strict", action="store_true")
    result.add_argument("--format", choices=["text", "json"], default="text")
    result.add_argument("--write-dist", action="store_true")
    return result


def main(argv: list[str] | None = None) -> int:
    default_root = Path(__file__).resolve().parents[1]
    args = parser(default_root).parse_args(argv)
    project_root = args.root.resolve()
    repo_root = project_root.parents[1]
    validation_run_at = utc_now()
    evaluated_at = parse_instant(args.evaluated_at) if args.evaluated_at else validation_run_at
    baseline_ref: str | None = None
    baseline_tree: str | None = None
    infrastructure_errors: list[dict[str, Any]] = []
    issues: list[Issue] = []
    validator: ClaimValidator | None = None
    try:
        expected_ci_ref = os.environ.get("CLAIM_VALIDATION_BASELINE_SHA")
        if expected_ci_ref and args.baseline_ref != expected_ci_ref:
            raise InfrastructureFailure("BASELINE_REF_MISMATCH", "baseline_ref differs from CI-provided immutable SHA")
        baseline_ref, baseline_tree = resolve_baseline(repo_root, args.baseline_ref)
        schemas = {
            "assertion": load_schema(project_root / "schemas" / "research-claim-assertion.schema.json"),
            "review": load_schema(project_root / "schemas" / "research-claim-review.schema.json"),
            "approval": load_schema(project_root / "schemas" / "research-promotion-approval.schema.json"),
        }
        knowledge_root = (args.knowledge_root or project_root / "knowledge").resolve()
        documents = load_current_documents(knowledge_root)
        data = index_documents(documents, schemas, issues)
        baseline_prefix = (project_root / "knowledge").relative_to(repo_root).as_posix()
        baseline_documents = git_documents(repo_root, baseline_ref, baseline_prefix)
        baseline = index_documents(baseline_documents, schemas, [], infrastructure=True)
        candidate_graph: dict[str, Any] | None = None
        baseline_candidate: dict[str, Any] | None = None
        if args.validation_context in GRAPH_CONTEXTS:
            try:
                candidate_graph, warnings = build_graph(
                    project_root, project_root / "concepts",
                    project_root / "schemas" / "visual-concept-graph.schema.json",
                    generated_at=format_utc(validation_run_at),
                )
            except (GraphBuildError, ValueError) as exc:
                raise InfrastructureFailure("GRAPH_BUILD_FAILED", str(exc)) from exc
            for warning in warnings:
                add_issue(issues, "GRAPH_BUILD_WARNING", "warning", "concepts", "$", warning)
            baseline_candidate = baseline_graph(
                repo_root, project_root, baseline_ref,
                project_root / "schemas" / "visual-concept-graph.schema.json",
            )
        if args.validation_context in {"promotion_approve", "application_create", "application_recheck"} and not args.assertion_id:
            add_issue(issues, "ASSERTION_ID_REQUIRED", "error", "", "$", f"--assertion-id is required for {args.validation_context}")
        if args.validation_context == "promotion_approve" and not args.approval_id:
            add_issue(issues, "APPROVAL_ID_REQUIRED", "error", "", "$", "--approval-id is required for promotion_approve")
        if args.validation_context in {"application_create", "application_recheck"} and not args.application_id:
            add_issue(issues, "APPLICATION_ID_REQUIRED", "error", "", "$", f"--application-id is required for {args.validation_context}")
        if args.assertion_id and args.assertion_id not in data.assertions:
            add_issue(issues, "ASSERTION_REFERENCE_NOT_FOUND", "error", "", "$", f"Assertion {args.assertion_id!r} does not exist")
        if args.validation_context == "promotion_approve" and args.approval_id:
            approval = data.approvals.get(args.approval_id)
            if not approval or approval.get("record_type") != "approval":
                add_issue(issues, "APPROVAL_REFERENCE_NOT_FOUND", "error", "", "$", f"Approval {args.approval_id!r} does not exist")
            else:
                evaluated_at = parse_instant(approval["recorded_at"])
                if args.assertion_id and approval["assertion_id"] != args.assertion_id:
                    add_issue(issues, "APPROVAL_ASSERTION_MISMATCH", "error", "", "$", "Selected Approval belongs to another assertion")
        if args.validation_context in {"application_create", "application_recheck"} and args.application_id:
            application = data.applications.get(args.application_id)
            if not application:
                add_issue(issues, "APPLICATION_REFERENCE_NOT_FOUND", "error", "", "$", f"Application {args.application_id!r} does not exist")
            else:
                evaluated_at = parse_instant(application["applied_at"])
                if args.assertion_id and application["assertion_id"] != args.assertion_id:
                    add_issue(issues, "APPLICATION_ASSERTION_MISMATCH", "error", "", "$", "Selected Application belongs to another assertion")
                if args.validation_context == "application_create" and args.application_id in baseline.applications:
                    add_issue(issues, "APPLICATION_NOT_NEW", "error", "", "$", "application_create requires an Application absent from the baseline")
        validator = ClaimValidator(
            project_root, repo_root, data, baseline, candidate_graph, baseline_candidate,
            args.validation_context, validation_run_at, evaluated_at, args.strict,
            args.assertion_id, args.approval_id, args.application_id,
        )
        validator.issues.extend(issues)
        validator.validate()
        issues = validator.issues
        if args.write_dist and args.validation_context != "write_finalize":
            add_issue(issues, "WRITE_MODE_CONTEXT_REQUIRED", "error", "", "$", "--write-dist requires --validation-context write_finalize")
        errors = [issue for issue in issues if issue.severity == "error"]
        warnings = [issue for issue in issues if issue.severity == "warning"]
        if args.strict and warnings:
            errors = [*errors, *warnings]
        if args.write_dist and not errors and candidate_graph is not None:
            write_graph_atomic(candidate_graph, project_root / "dist" / "visual-concept-graph.json")
        exit_code = 1 if errors else 0
        output = {
            "output_schema_version": SCHEMA_VERSION,
            "mode": "write" if args.write_dist else "check",
            "validation_context": args.validation_context,
            "validation_run_at": format_utc(validation_run_at),
            "evaluated_at": format_utc(evaluated_at),
            "baseline_ref": baseline_ref,
            "baseline_tree": baseline_tree,
            "valid": not [issue for issue in issues if issue.severity == "error"],
            "validation_completed": True,
            "passed": exit_code == 0,
            "exit_code": exit_code,
            "error_count": len([issue for issue in issues if issue.severity == "error"]),
            "warning_count": len(warnings),
            "infrastructure_error_count": 0,
            "errors": [issue.to_dict() for issue in issues if issue.severity == "error"],
            "warnings": [issue.to_dict() for issue in warnings],
            "infrastructure_errors": [],
            "review_states": validator.review_states if validator else {},
            "approval_states": validator.approval_states if validator else {},
            "assertion_hashes": validator.assertion_hashes if validator else {},
            "promotion_hashes": validator.promotion_hashes if validator else {},
        }
    except (InfrastructureFailure, OSError, ValueError, json.JSONDecodeError) as exc:
        code = exc.code if isinstance(exc, InfrastructureFailure) else "VALIDATOR_INFRASTRUCTURE_ERROR"
        infrastructure_errors.append({"code": code, "severity": "infrastructure", "message": str(exc)})
        output = {
            "output_schema_version": SCHEMA_VERSION,
            "mode": "write" if args.write_dist else "check",
            "validation_context": args.validation_context,
            "validation_run_at": format_utc(validation_run_at),
            "evaluated_at": format_utc(evaluated_at),
            "baseline_ref": baseline_ref,
            "baseline_tree": baseline_tree,
            "valid": None,
            "validation_completed": False,
            "passed": False,
            "exit_code": 2,
            "error_count": 0,
            "warning_count": 0,
            "infrastructure_error_count": len(infrastructure_errors),
            "errors": [],
            "warnings": [],
            "infrastructure_errors": infrastructure_errors,
            "review_states": {},
            "approval_states": {},
            "assertion_hashes": {},
            "promotion_hashes": {},
        }
    if args.format == "json":
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        for item in [*output["errors"], *output["warnings"], *output["infrastructure_errors"]]:
            location = f" {item.get('file', '')}{item.get('path', '')}".rstrip()
            print(f"{item['severity']}: {item['code']}{location}: {item['message']}")
        print(
            f"Research Claim validation {'passed' if output['passed'] else 'failed'}: "
            f"{output['error_count']} errors, {output['warning_count']} warnings"
        )
    return int(output["exit_code"])


if __name__ == "__main__":
    raise SystemExit(main())
