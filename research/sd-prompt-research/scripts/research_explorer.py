#!/usr/bin/env python3
"""Build and serve the read-only Research Explorer index.

The companion service deliberately owns filesystem access. The browser receives
opaque artifact IDs and never supplies repository paths.
"""

from __future__ import annotations

import argparse
import hashlib
import http.cookies
import ipaddress
import json
import mimetypes
import os
import re
import secrets
import socket
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Mapping
from urllib.parse import unquote, urlsplit

import yaml
from jsonschema import Draft202012Validator

from claim_draft_pipeline import (
    PipelineError,
    _artifact_hash as pipeline_artifact_hash,
    canonical_assertion_bytes,
    validate_artifact,
)
from validate_research_claims import (
    UniqueKeyLoader,
    assertion_payload,
    content_hash,
    normalized_text_file_sha256_v1,
)


INDEX_SCHEMA_VERSION = "0.1.0"
FINGERPRINT_CONTRACT = "source_freshness_fingerprint_v1"
FINGERPRINT_ALGORITHM = "sha256_raw_bytes"
SESSION_COOKIE = "sdps_research_session"
SESSION_MAX_AGE = 3600
SNAPSHOT_HEADER = "X-Research-Index-Snapshot"
DEFAULT_DISCOVERY_ROOTS = (
    "experiments",
    "ledgers/run-index.yaml",
    "inbox/claim-drafts",
    "inbox/claim-draft-failures",
    "knowledge/assertions",
    "reports",
)
RESEARCH_HASH_KEYS = {
    "candidate_wrapper_artifact_hash_v1",
    "canonical_assertion_artifact_hash_v1",
    "assertion_content_v1_hash",
    "draft_input_identity_hash",
}
HASH_RE = re.compile(r"^[a-f0-9]{64}$")
SAFE_ENTITY_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,256}$")
RECEIPT_RESULTS = {"succeeded", "failed", "inconclusive", "not_applicable"}


class ResearchExplorerError(RuntimeError):
    """Structured implementation error used by the CLI and HTTP service."""

    def __init__(self, code: str, message: str, *, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


@dataclass(frozen=True)
class SecureReadResult:
    """A single-open, root-contained snapshot of a Research Artifact."""

    resolved_path: Path
    data: bytes
    byte_size: int
    fingerprint: dict[str, str]


def utc_now_text() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def canonical_json_bytes(value: Any) -> bytes:
    """Canonical bytes for internal, non-research snapshot identity only."""

    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def source_freshness_fingerprint(path: Path) -> dict[str, str]:
    """Return a byte-sensitive read-model fingerprint, never a Research Hash."""

    return source_freshness_fingerprint_bytes(path.read_bytes())


def source_freshness_fingerprint_bytes(data: bytes) -> dict[str, str]:
    """Fingerprint the exact bytes used by the read model or artifact response."""

    value = hashlib.sha256(data).hexdigest()
    return {
        "contract": FINGERPRINT_CONTRACT,
        "algorithm": FINGERPRINT_ALGORITHM,
        "value": value,
    }


def _file_identity(value: os.stat_result) -> tuple[int, int, int, int]:
    return (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def resolve_project_path(project_root: Path, stored_path: str, *, must_exist: bool = True) -> Path:
    """Resolve a project-relative path without permitting traversal or symlink escape."""

    if not isinstance(stored_path, str) or not stored_path:
        raise ResearchExplorerError("ARTIFACT_PATH_INVALID", "Artifact path must be non-empty")
    normalized = stored_path.replace("\\", "/")
    pure = PurePosixPath(normalized)
    if pure.is_absolute() or ".." in pure.parts or re.match(r"^[A-Za-z]:", normalized):
        raise ResearchExplorerError("ARTIFACT_PATH_INVALID", f"Unsafe artifact path: {stored_path}")
    root = project_root.resolve(strict=True)
    candidate = root.joinpath(*pure.parts)
    try:
        resolved = candidate.resolve(strict=must_exist)
    except FileNotFoundError as exc:
        raise ResearchExplorerError(
            "ARTIFACT_NOT_FOUND", f"Artifact does not exist: {stored_path}", status=404
        ) from exc
    if not _is_relative_to(resolved, root):
        raise ResearchExplorerError(
            "ARTIFACT_PATH_INVALID", f"Artifact resolves outside Research Project Root: {stored_path}"
        )
    return resolved


def secure_read_project_file(project_root: Path, stored_path: str) -> SecureReadResult:
    """Read one contained file once and derive size/fingerprint from those exact bytes."""

    resolved = resolve_project_path(project_root, stored_path)
    try:
        with resolved.open("rb") as stream:
            before = os.fstat(stream.fileno())
            data = stream.read()
            after = os.fstat(stream.fileno())
    except OSError as exc:
        raise ResearchExplorerError(
            "ARTIFACT_READ_FAILED", f"Artifact cannot be read: {stored_path}", status=409
        ) from exc
    if _file_identity(before) != _file_identity(after) or after.st_size != len(data):
        raise ResearchExplorerError(
            "ARTIFACT_CHANGED_DURING_READ", f"Artifact changed while being read: {stored_path}", status=409
        )
    try:
        post_resolved = resolve_project_path(project_root, stored_path)
        post_stat = post_resolved.stat()
    except (OSError, ResearchExplorerError) as exc:
        raise ResearchExplorerError(
            "ARTIFACT_CHANGED_DURING_READ", f"Artifact path changed while being read: {stored_path}", status=409
        ) from exc
    if post_resolved != resolved or _file_identity(post_stat) != _file_identity(after):
        raise ResearchExplorerError(
            "ARTIFACT_CHANGED_DURING_READ", f"Artifact identity changed while being read: {stored_path}", status=409
        )
    return SecureReadResult(
        resolved_path=resolved,
        data=data,
        byte_size=len(data),
        fingerprint=source_freshness_fingerprint_bytes(data),
    )


def validate_loopback_host(host: str) -> None:
    """Reject wildcard or non-loopback bind targets."""

    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)}
    except socket.gaierror as exc:
        raise ResearchExplorerError("BIND_HOST_INVALID", f"Cannot resolve bind host: {host}") from exc
    if not addresses or any(not ipaddress.ip_address(address).is_loopback for address in addresses):
        raise ResearchExplorerError("BIND_HOST_NOT_LOOPBACK", f"Bind host is not loopback-only: {host}")


def _load_structured(path: Path, payload: bytes) -> tuple[Any | None, str | None]:
    try:
        if path.suffix.lower() == ".json":
            return json.loads(payload.decode("utf-8-sig")), None
        if path.suffix.lower() in {".yaml", ".yml"}:
            return yaml.load(payload.decode("utf-8-sig"), Loader=UniqueKeyLoader), None
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError, yaml.YAMLError) as exc:
        return None, str(exc)
    return None, None


def _artifact_type(path: Path, project_root: Path) -> str:
    relative = path.relative_to(project_root).as_posix()
    name = path.name.lower()
    if name == "manifest.yaml":
        return "run"
    if name.endswith("observation.json"):
        return "observation"
    if name == "pre-schema-draft.yaml":
        return "draft"
    if name == "human-resolution.yaml":
        return "human_resolution"
    if name == "claim-candidate.yaml":
        return "candidate"
    if "/generation-receipts/" in f"/{relative}" and path.suffix.lower() == ".json":
        return "receipt"
    if relative.startswith("knowledge/assertions/") and path.suffix.lower() in {".yaml", ".yml"}:
        return "canonical_assertion"
    if "validation" in name and path.suffix.lower() == ".json":
        return "validation_result"
    if relative.startswith("reports/"):
        return "report"
    if relative == "ledgers/run-index.yaml":
        return "run_index"
    return "research_artifact"


def _entity_id(artifact_type: str, data: Any) -> str | None:
    if not isinstance(data, Mapping):
        return None
    keys_by_type = {
        "run": ("run_id",),
        "observation": ("run_id",),
        "draft": ("draft_id",),
        "human_resolution": ("resolution_id",),
        "candidate": ("candidate_id",),
        "receipt": ("receipt_id",),
        "canonical_assertion": ("assertion_file_id",),
    }
    for key in keys_by_type.get(artifact_type, ()):
        value = data.get(key)
        if isinstance(value, str) and SAFE_ENTITY_ID_RE.fullmatch(value):
            return value
    return None


def _artifact_id(artifact_type: str, relative_path: str, data: Any) -> str:
    path_identity = hashlib.sha256(relative_path.encode("utf-8")).hexdigest()
    if artifact_type == "validation_result":
        context = "unknown"
        if isinstance(data, Mapping):
            candidate = data.get("validation_context") or data.get("context")
            if isinstance(candidate, str) and re.fullmatch(r"[a-z0-9_]+", candidate):
                context = candidate
        return f"validation.{context}.{path_identity}"
    return f"artifact.{artifact_type}.{path_identity}"


def _display_status(artifact_type: str, data: Any, parse_error: str | None) -> dict[str, str]:
    if parse_error:
        return {"value": "failed", "source": "parse_error"}
    if artifact_type == "receipt" and isinstance(data, Mapping):
        result = data.get("result")
        if result in RECEIPT_RESULTS:
            return {"value": str(result), "source": "receipt.result"}
    if artifact_type == "validation_result" and isinstance(data, Mapping):
        if data.get("infrastructure_error_count", 0) or data.get("infrastructure_errors"):
            return {"value": "infrastructure_error", "source": "validator"}
        if data.get("passed") is True and data.get("valid") is True:
            return {"value": "passed", "source": "validator"}
        return {"value": "failed", "source": "validator"}
    values = {
        "run": "available",
        "observation": "discovered",
        "draft": "generated",
        "human_resolution": "completed",
        "candidate": "created",
        "canonical_assertion": "available",
        "report": "available",
        "run_index": "available",
        "research_artifact": "available",
    }
    return {"value": values.get(artifact_type, "available"), "source": "artifact_presence"}


def _collect_research_hashes(value: Any, path: str = "$") -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    if isinstance(value, Mapping):
        for key in sorted(value):
            child = value[key]
            child_path = f"{path}.{key}"
            if key in RESEARCH_HASH_KEYS and isinstance(child, str) and HASH_RE.fullmatch(child):
                found.append({"name": key, "value": child, "source": child_path})
            found.extend(_collect_research_hashes(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(_collect_research_hashes(child, f"{path}[{index}]"))
    return found


def _collect_relationships(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, Mapping):
        return []
    relationships: list[dict[str, str]] = []
    related = value.get("related_artifact_ids")
    if isinstance(related, Mapping):
        for relation, target in sorted(related.items()):
            if isinstance(target, str) and target:
                relationships.append({"relation": str(relation), "target_entity_id": target})
    direct = {
        "source_draft_id": "source_draft",
        "resolution_id": "human_resolution",
        "candidate_id": "candidate",
    }
    for key, relation in direct.items():
        target = value.get(key)
        if isinstance(target, str) and target:
            relationships.append({"relation": relation, "target_entity_id": target})
    unique = {(item["relation"], item["target_entity_id"]): item for item in relationships}
    return [unique[key] for key in sorted(unique)]


def _iter_candidate_paths(project_root: Path, roots: Iterable[str]) -> tuple[list[Path], list[dict[str, str]]]:
    files: list[Path] = []
    diagnostics: list[dict[str, str]] = []
    root = project_root.resolve(strict=True)
    for stored_root in roots:
        candidate = root.joinpath(*PurePosixPath(stored_root).parts)
        if not candidate.exists():
            continue
        entries = [candidate] if candidate.is_file() else candidate.rglob("*")
        for entry in entries:
            if entry.is_symlink():
                try:
                    resolved = entry.resolve(strict=True)
                except FileNotFoundError:
                    diagnostics.append(
                        {"code": "ARTIFACT_SYMLINK_BROKEN", "path": entry.relative_to(root).as_posix()}
                    )
                    continue
                if not _is_relative_to(resolved, root):
                    diagnostics.append(
                        {"code": "ARTIFACT_PATH_OUTSIDE_ROOT", "path": entry.relative_to(root).as_posix()}
                    )
                    continue
            if not entry.is_file():
                continue
            try:
                resolved = entry.resolve(strict=True)
            except FileNotFoundError:
                continue
            if not _is_relative_to(resolved, root):
                diagnostics.append(
                    {"code": "ARTIFACT_PATH_OUTSIDE_ROOT", "path": entry.relative_to(root).as_posix()}
                )
                continue
            files.append(entry)
    unique = {path.relative_to(root).as_posix(): path for path in files}
    return [unique[key] for key in sorted(unique)], sorted(
        diagnostics, key=lambda item: (item["path"], item["code"])
    )


def _index_diagnostic(code: str, artifact: Mapping[str, Any]) -> dict[str, str]:
    source_path = str(artifact["source_path"])
    return {
        "code": code,
        "path": source_path,
        "artifact_id": str(artifact["artifact_id"]),
        "source_path": source_path,
    }


def _normalized_artifact_hash(value: Any, payload: bytes) -> str:
    return str(
        pipeline_artifact_hash("normalized_text_file_sha256_v1", value, payload)["value"]
    )


def _assertion_content_hash_from_candidate(
    canonical: Mapping[str, Any],
    canonical_source: str,
    parsed_by_path: Mapping[str, Any],
) -> str:
    evidence: dict[str, dict[str, Any]] = {}
    for source_path, document in sorted(parsed_by_path.items()):
        if source_path == canonical_source or not source_path.startswith("knowledge/assertions/"):
            continue
        if not isinstance(document, Mapping):
            continue
        for fact in document.get("evidence_refs", []):
            if not isinstance(fact, Mapping) or not isinstance(fact.get("evidence_ref_id"), str):
                raise ValueError("Canonical Evidence entry is invalid")
            evidence_id = str(fact["evidence_ref_id"])
            if evidence_id in evidence:
                raise ValueError(f"Duplicate Canonical Evidence ID: {evidence_id}")
            evidence[evidence_id] = dict(fact)
    for fact in canonical.get("evidence_refs", []):
        if not isinstance(fact, Mapping) or not isinstance(fact.get("evidence_ref_id"), str):
            raise ValueError("Candidate Evidence entry is invalid")
        evidence_id = str(fact["evidence_ref_id"])
        if evidence_id in evidence:
            raise ValueError(f"Duplicate Candidate Evidence ID: {evidence_id}")
        evidence[evidence_id] = dict(fact)
    assertions = canonical.get("assertions", [])
    if not isinstance(assertions, list) or len(assertions) != 1 or not isinstance(assertions[0], Mapping):
        raise ValueError("Candidate must contain exactly one Assertion")
    return content_hash(assertion_payload(assertions[0], evidence))


def _finalize_binding_is_valid(
    project_root: Path,
    receipt: Mapping[str, Any],
    by_entity: Mapping[str, list[dict[str, Any]]],
    artifacts_by_path: Mapping[str, dict[str, Any]],
    parsed_by_path: Mapping[str, Any],
) -> tuple[dict[str, Any], str] | tuple[None, str]:
    ids = receipt.get("related_artifact_ids")
    hashes = receipt.get("related_artifact_hashes")
    payload = receipt.get("payload")
    if not isinstance(ids, Mapping) or not isinstance(hashes, Mapping) or not isinstance(payload, Mapping):
        return None, "FINALIZE_BINDING_INVALID"
    candidate_id = ids.get("claim_candidate")
    assertion_id = ids.get("canonical_assertion")
    destination = payload.get("destination_path")
    identity = payload.get("candidate_identity")
    if not all(isinstance(item, str) and item for item in (candidate_id, assertion_id, destination)):
        return None, "FINALIZE_BINDING_INVALID"
    if not isinstance(identity, Mapping) or identity.get("status") != "available":
        return None, "FINALIZE_BINDING_INVALID"
    candidates = [item for item in by_entity.get(str(candidate_id), []) if item["artifact_type"] == "candidate"]
    if len(candidates) != 1:
        return None, "FINALIZE_BINDING_INVALID"
    candidate_artifact = candidates[0]
    wrapper = parsed_by_path.get(candidate_artifact["source_path"])
    if not isinstance(wrapper, Mapping):
        return None, "FINALIZE_BINDING_INVALID"
    try:
        validate_artifact(project_root, "observation-to-claim-candidate.schema.json", wrapper)
    except PipelineError:
        return None, "FINALIZE_BINDING_INVALID"

    identity_fields = (
        "candidate_id",
        "candidate_id_projection_version",
        "candidate_id_projection_hash",
        "candidate_schema_version",
        "generator_version",
    )
    if any(identity.get(field) != wrapper.get(field) for field in identity_fields):
        return None, "FINALIZE_BINDING_INVALID"
    if wrapper.get("candidate_id") != candidate_id:
        return None, "FINALIZE_BINDING_INVALID"
    canonical = wrapper.get("canonical_assertion")
    if not isinstance(canonical, Mapping):
        return None, "FINALIZE_BINDING_INVALID"
    assertions = canonical.get("assertions")
    if (
        not isinstance(assertions, list)
        or len(assertions) != 1
        or not isinstance(assertions[0], Mapping)
        or assertions[0].get("assertion_id") != assertion_id
    ):
        return None, "FINALIZE_BINDING_INVALID"

    claim_hash = hashes.get("claim_candidate")
    canonical_hash = hashes.get("canonical_assertion")
    if not all(
        isinstance(record, Mapping)
        and record.get("algorithm") == "normalized_text_file_sha256_v1"
        and isinstance(record.get("value"), str)
        and HASH_RE.fullmatch(str(record["value"]))
        for record in (claim_hash, canonical_hash)
    ):
        return None, "RECEIPT_HASH_MISMATCH"
    if (
        identity.get("candidate_wrapper_artifact_hash_v1") != claim_hash["value"]
        or identity.get("canonical_assertion_artifact_hash_v1") != canonical_hash["value"]
    ):
        return None, "RECEIPT_HASH_MISMATCH"

    try:
        candidate_read = secure_read_project_file(project_root, candidate_artifact["source_path"])
        canonical_payload = canonical_assertion_bytes(canonical)
        canonical_source = PurePosixPath(str(destination).replace("\\", "/")).as_posix()
        canonical_read = secure_read_project_file(project_root, canonical_source)
        canonical_document = parsed_by_path.get(canonical_source)
        validate_artifact(project_root, "research-claim-assertion.schema.json", canonical_document)
        actual_candidate_hash = _normalized_artifact_hash(wrapper, candidate_read.data)
        actual_canonical_hash = _normalized_artifact_hash(canonical, canonical_payload)
        actual_assertion_hash = _assertion_content_hash_from_candidate(
            canonical, canonical_source, parsed_by_path
        )
    except (PipelineError, ResearchExplorerError, TypeError, ValueError, KeyError):
        return None, "FINALIZE_BINDING_INVALID"
    if canonical_read.data != canonical_payload or canonical_document != canonical:
        return None, "FINALIZE_BINDING_INVALID"
    if (
        actual_candidate_hash != identity.get("candidate_wrapper_artifact_hash_v1")
        or actual_canonical_hash != identity.get("canonical_assertion_artifact_hash_v1")
        or actual_assertion_hash != identity.get("assertion_content_v1_hash")
    ):
        return None, "FINALIZE_BINDING_INVALID"
    if actual_candidate_hash != claim_hash["value"] or actual_canonical_hash != canonical_hash["value"]:
        return None, "FINALIZE_BINDING_INVALID"
    canonical_artifact = artifacts_by_path.get(canonical_source)
    if canonical_artifact is None:
        return None, "FINALIZE_BINDING_INVALID"
    return canonical_artifact, ""


def _apply_finalize_relationships(
    project_root: Path,
    artifacts: list[dict[str, Any]],
    parsed_by_path: Mapping[str, Any],
    valid_receipt_paths: set[str],
    diagnostics: list[dict[str, str]],
) -> None:
    by_entity: dict[str, list[dict[str, Any]]] = {}
    for artifact in artifacts:
        entity_id = artifact.get("entity_id")
        if isinstance(entity_id, str):
            by_entity.setdefault(entity_id, []).append(artifact)

    artifacts_by_path = {item["source_path"]: item for item in artifacts}
    for receipt in artifacts:
        if receipt["artifact_type"] != "receipt":
            continue
        if receipt["source_path"] not in valid_receipt_paths:
            continue
        data = parsed_by_path.get(receipt["source_path"])
        if not isinstance(data, Mapping):
            continue
        if data.get("receipt_type") != "finalize_attempt" or data.get("result") != "succeeded":
            continue
        canonical_artifact, error_code = _finalize_binding_is_valid(
            project_root, data, by_entity, artifacts_by_path, parsed_by_path
        )
        if canonical_artifact is None:
            diagnostics.append(_index_diagnostic(error_code, receipt))
            continue
        candidate_id = data["related_artifact_ids"]["claim_candidate"]
        assertion_id = data["related_artifact_ids"]["canonical_assertion"]
        for candidate in by_entity.get(candidate_id, []):
            candidate["display_status"] = {
                "value": "finalized",
                "source": "successful_finalize_receipt_and_hash_binding",
            }
            edge = {
                "relation": "finalized_as",
                "target_entity_id": assertion_id,
                "target_artifact_id": canonical_artifact["artifact_id"],
            }
            if edge not in candidate["relationships"]:
                candidate["relationships"].append(edge)
                candidate["relationships"].sort(
                    key=lambda item: (
                        item["relation"],
                        item["target_entity_id"],
                        item.get("target_artifact_id", ""),
                    )
                )


def build_research_index(
    project_root: Path,
    *,
    discovery_roots: Iterable[str] = DEFAULT_DISCOVERY_ROOTS,
) -> dict[str, Any]:
    root = project_root.resolve(strict=True)
    files, diagnostics = _iter_candidate_paths(root, discovery_roots)
    artifacts: list[dict[str, Any]] = []
    parsed_by_path: dict[str, Any] = {}
    valid_receipt_paths: set[str] = set()
    seen_ids: set[str] = set()

    for path in files:
        relative = path.relative_to(root).as_posix()
        try:
            secure_read = secure_read_project_file(root, relative)
        except ResearchExplorerError as exc:
            diagnostics.append({"code": exc.code, "path": relative})
            continue
        data, parse_error = _load_structured(path, secure_read.data)
        if data is not None:
            parsed_by_path[relative] = data
        artifact_type = _artifact_type(path, root)
        artifact_id = _artifact_id(artifact_type, relative, data)
        if artifact_id in seen_ids:
            raise ResearchExplorerError("ARTIFACT_ID_COLLISION", f"Duplicate artifact ID: {artifact_id}")
        seen_ids.add(artifact_id)
        entity_id = _entity_id(artifact_type, data)
        artifact: dict[str, Any] = {
            "artifact_id": artifact_id,
            "artifact_type": artifact_type,
            "source_path": relative,
            "display_name": entity_id or path.name,
            "media_type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            "byte_size": secure_read.byte_size,
            "display_status": _display_status(artifact_type, data, parse_error),
            "source_freshness_fingerprint": secure_read.fingerprint,
            "research_audit_hashes": _collect_research_hashes(data),
            "relationships": _collect_relationships(data),
        }
        if entity_id:
            artifact["entity_id"] = entity_id
        artifacts.append(artifact)
        if artifact_type == "receipt":
            try:
                if parse_error or not isinstance(data, Mapping):
                    raise PipelineError("ARTIFACT_SCHEMA_INVALID", parse_error or "Receipt root is invalid")
                validate_artifact(root, "observation-to-claim-receipt.schema.json", data)
                valid_receipt_paths.add(relative)
            except PipelineError:
                artifact["display_status"] = {"value": "failed", "source": "receipt_schema_invalid"}
                diagnostics.append(_index_diagnostic("RECEIPT_INVALID", artifact))
        elif parse_error:
            diagnostics.append({"code": "ARTIFACT_PARSE_FAILED", "path": relative})

    _apply_finalize_relationships(
        root, artifacts, parsed_by_path, valid_receipt_paths, diagnostics
    )
    artifacts.sort(key=lambda item: item["artifact_id"])
    snapshot_projection = [
        {
            "artifact_id": item["artifact_id"],
            "source_path": item["source_path"],
            "fingerprint": item["source_freshness_fingerprint"],
        }
        for item in artifacts
    ]
    snapshot_value = hashlib.sha256(canonical_json_bytes(snapshot_projection)).hexdigest()
    return {
        "schema_version": INDEX_SCHEMA_VERSION,
        "index_snapshot_id": f"snapshot.{snapshot_value}",
        "generated_at": utc_now_text(),
        "fingerprint_contract": FINGERPRINT_CONTRACT,
        "artifacts": artifacts,
        "diagnostics": sorted(diagnostics, key=lambda item: (item["path"], item["code"])),
    }


def validate_index(index: Mapping[str, Any], schema_path: Path) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(index), key=lambda item: list(item.path))
    if errors:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
            for error in errors
        )
        raise ResearchExplorerError("INDEX_SCHEMA_INVALID", details)


@dataclass(frozen=True)
class CompanionState:
    project_root: Path
    frontend_dir: Path
    index: dict[str, Any]
    artifacts: dict[str, dict[str, Any]]
    session_token: str
    allowed_hosts: frozenset[str]
    allowed_origins: frozenset[str]


class ResearchExplorerHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], state: CompanionState) -> None:
        self.state = state
        super().__init__(address, ResearchExplorerHandler)


class ResearchExplorerHandler(BaseHTTPRequestHandler):
    server_version = "SDPromptStudioResearchExplorer/0.1"

    @property
    def state(self) -> CompanionState:
        return self.server.state  # type: ignore[attr-defined]

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        sys.stderr.write("research-explorer: " + (format % args) + "\n")

    def _send_json(self, status: int, payload: Mapping[str, Any]) -> None:
        data = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _reject(self, error: ResearchExplorerError) -> None:
        self._send_json(error.status, {"error": error.as_dict()})

    def _validate_host_and_origin(self) -> None:
        host = self.headers.get("Host", "").lower()
        if host not in self.state.allowed_hosts:
            raise ResearchExplorerError("HOST_NOT_ALLOWED", "Host header is not allowed", status=403)
        origin = self.headers.get("Origin")
        if origin and origin.rstrip("/").lower() not in self.state.allowed_origins:
            raise ResearchExplorerError("ORIGIN_NOT_ALLOWED", "Origin is not allowed", status=403)
        fetch_site = self.headers.get("Sec-Fetch-Site")
        if fetch_site and fetch_site not in {"same-origin", "none"}:
            raise ResearchExplorerError("ORIGIN_NOT_ALLOWED", "Cross-site requests are not allowed", status=403)

    def _require_session(self) -> None:
        cookie = http.cookies.SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except http.cookies.CookieError as exc:
            raise ResearchExplorerError("SESSION_REQUIRED", "Valid session cookie required", status=401) from exc
        morsel = cookie.get(SESSION_COOKIE)
        if morsel is None or not secrets.compare_digest(morsel.value, self.state.session_token):
            raise ResearchExplorerError("SESSION_REQUIRED", "Valid session cookie required", status=401)

    def _serve_frontend(self, request_path: str) -> None:
        relative = request_path.lstrip("/") or "index.html"
        if ".." in PurePosixPath(relative).parts:
            raise ResearchExplorerError("FRONTEND_PATH_INVALID", "Unsafe frontend path", status=404)
        frontend_root = self.state.frontend_dir.resolve(strict=True)
        candidate = frontend_root.joinpath(*PurePosixPath(relative).parts)
        try:
            resolved = candidate.resolve(strict=True)
        except FileNotFoundError:
            resolved = (frontend_root / "index.html").resolve(strict=True)
        if not _is_relative_to(resolved, frontend_root) or not resolved.is_file():
            raise ResearchExplorerError("FRONTEND_PATH_INVALID", "Frontend asset not found", status=404)
        data = resolved.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(resolved.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store" if resolved.name == "index.html" else "public, max-age=3600")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header(
            "Set-Cookie",
            f"{SESSION_COOKIE}={self.state.session_token}; HttpOnly; SameSite=Strict; "
            f"Path=/api/research; Max-Age={SESSION_MAX_AGE}",
        )
        self.end_headers()
        self.wfile.write(data)

    def _serve_index(self) -> None:
        self._send_json(HTTPStatus.OK, self.state.index)

    def _serve_artifact(self, artifact_id: str) -> None:
        requested_snapshot = self.headers.get(SNAPSHOT_HEADER)
        actual_snapshot = self.state.index["index_snapshot_id"]
        if requested_snapshot != actual_snapshot:
            raise ResearchExplorerError(
                "INDEX_SNAPSHOT_MISMATCH", "Current index snapshot must be supplied", status=409
            )
        artifact = self.state.artifacts.get(artifact_id)
        if artifact is None:
            raise ResearchExplorerError("ARTIFACT_NOT_FOUND", "Unknown artifact ID", status=404)
        try:
            secure_read = secure_read_project_file(self.state.project_root, artifact["source_path"])
        except ResearchExplorerError as exc:
            if exc.code == "ARTIFACT_CHANGED_DURING_READ":
                raise ResearchExplorerError(
                    "ARTIFACT_STALE", "Source changed during secure read", status=409
                ) from exc
            raise
        if (
            secure_read.fingerprint != artifact["source_freshness_fingerprint"]
            or secure_read.byte_size != artifact["byte_size"]
        ):
            raise ResearchExplorerError(
                "ARTIFACT_STALE", "Source Freshness Fingerprint changed", status=409
            )
        data = secure_read.data
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", artifact["media_type"])
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("ETag", f'"{secure_read.fingerprint["value"]}"')
        self.send_header("X-Research-Artifact-Id", artifact_id)
        self.send_header(SNAPSHOT_HEADER, actual_snapshot)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        try:
            self._validate_host_and_origin()
            request_path = unquote(urlsplit(self.path).path)
            if not request_path.startswith("/api/research"):
                self._serve_frontend(request_path)
                return
            self._require_session()
            if request_path == "/api/research/index":
                self._serve_index()
                return
            prefix = "/api/research/artifacts/"
            if request_path.startswith(prefix):
                artifact_id = request_path[len(prefix) :]
                if not artifact_id or "/" in artifact_id:
                    raise ResearchExplorerError("ARTIFACT_ID_INVALID", "Invalid artifact ID", status=404)
                self._serve_artifact(artifact_id)
                return
            raise ResearchExplorerError("API_ROUTE_NOT_FOUND", "Unknown Research API route", status=404)
        except ResearchExplorerError as exc:
            self._reject(exc)

    def _reject_mutation(self) -> None:
        try:
            self._validate_host_and_origin()
        except ResearchExplorerError as exc:
            self._reject(exc)
            return
        self._reject(
            ResearchExplorerError(
                "READ_ONLY_API", "Research Explorer API does not expose mutation endpoints", status=405
            )
        )

    do_POST = _reject_mutation  # type: ignore[assignment]
    do_PUT = _reject_mutation  # type: ignore[assignment]
    do_PATCH = _reject_mutation  # type: ignore[assignment]
    do_DELETE = _reject_mutation  # type: ignore[assignment]
    do_OPTIONS = _reject_mutation  # type: ignore[assignment]


def create_companion_server(
    project_root: Path,
    frontend_dir: Path,
    *,
    host: str = "127.0.0.1",
    port: int = 0,
    session_token: str | None = None,
) -> ResearchExplorerHTTPServer:
    validate_loopback_host(host)
    frontend = frontend_dir.resolve(strict=True)
    if not (frontend / "index.html").is_file():
        raise ResearchExplorerError("FRONTEND_NOT_BUILT", f"Missing frontend index: {frontend / 'index.html'}")
    project = project_root.resolve(strict=True)
    index = build_research_index(project)
    schema_path = project / "schemas" / "research-explorer-index.schema.json"
    validate_index(index, schema_path)

    placeholder = CompanionState(
        project_root=project,
        frontend_dir=frontend,
        index=index,
        artifacts={item["artifact_id"]: item for item in index["artifacts"]},
        session_token=session_token or secrets.token_urlsafe(32),
        allowed_hosts=frozenset(),
        allowed_origins=frozenset(),
    )
    server = ResearchExplorerHTTPServer((host, port), placeholder)
    actual_port = server.server_address[1]
    host_values = {
        f"127.0.0.1:{actual_port}",
        f"localhost:{actual_port}",
        f"[::1]:{actual_port}",
    }
    origin_values = {f"http://{value}" for value in host_values}
    server.state = CompanionState(
        **{
            **placeholder.__dict__,
            "allowed_hosts": frozenset(value.lower() for value in host_values),
            "allowed_origins": frozenset(value.lower() for value in origin_values),
        }
    )
    return server


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Research Project Root (default: research/sd-prompt-research)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    index_parser = subparsers.add_parser("index", help="Build and validate the Derived Index")
    index_parser.add_argument("--output", type=Path, help="Optional output path; stdout otherwise")
    index_parser.add_argument("--check", action="store_true", help="Validate without writing JSON")
    serve_parser = subparsers.add_parser("serve", help="Serve frontend and read-only Research API")
    serve_parser.add_argument("--frontend-dir", type=Path, required=True)
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=8765)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    project_root = args.project_root.resolve(strict=True)
    try:
        if args.command == "index":
            index = build_research_index(project_root)
            validate_index(index, project_root / "schemas" / "research-explorer-index.schema.json")
            if args.check:
                print(
                    json.dumps(
                        {
                            "valid": True,
                            "index_snapshot_id": index["index_snapshot_id"],
                            "artifact_count": len(index["artifacts"]),
                            "diagnostic_count": len(index["diagnostics"]),
                        },
                        sort_keys=True,
                    )
                )
                return 0
            payload = json.dumps(index, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(payload, encoding="utf-8", newline="\n")
            else:
                sys.stdout.write(payload)
            return 0
        server = create_companion_server(
            project_root,
            args.frontend_dir,
            host=args.host,
            port=args.port,
        )
        host, port = server.server_address[:2]
        print(f"Research Explorer available at http://{host}:{port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
        return 0
    except ResearchExplorerError as exc:
        print(json.dumps({"error": exc.as_dict()}, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
