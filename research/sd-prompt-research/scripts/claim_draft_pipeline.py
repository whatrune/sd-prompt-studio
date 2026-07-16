#!/usr/bin/env python3
"""Observation-to-Claim Draft Pipeline core implementation.

The module deliberately keeps observation extraction, human research decisions,
and canonical integration as separate stages.  It does not generate research
conclusions or infer a Claim subject.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Mapping, Sequence

import rfc8785
import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from finalize_face_observation import compute_aggregate as compute_face_aggregate
from finalize_observation import compute_aggregate as compute_pose_aggregate
from validate_research_claims import (
    InvalidTextEncodingError,
    assertion_payload,
    content_hash,
    normalized_text_file_sha256_v1,
    yaml_load,
)


DRAFT_SCHEMA_VERSION = "0.1.0"
GENERATION_REPORT_SCHEMA_VERSION = "0.1.0"
HUMAN_RESOLUTION_SCHEMA_VERSION = "0.1.0"
CANDIDATE_SCHEMA_VERSION = "0.1.0"
RECEIPT_SCHEMA_VERSION = "0.1.0"
GENERATOR_CONTRACT = "observation_to_claim_draft_v1"
GENERATOR_VERSION = "0.1.0"
TEMPLATE_VERSION = "0.1.0"
EVIDENCE_ID_CONTRACT = "evidence_id_v1"
CANDIDATE_ID_PROJECTION_VERSION = "candidate_id_projection_v1"
OBSERVATION_VALIDATOR_VERSION = "observation-schema-v3.0+face-v1.0"
AGGREGATE_PROFILE_VERSION = "stored-computed-aggregate-v1"
METRIC_EXTRACTION_PROFILE_VERSION = "computed-aggregate-leaves-v1"

SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
UUID7_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
ASSERTION_ID_RE = re.compile(
    r"^assertion(?:\.[a-z0-9]+(?:_[a-z0-9]+)*){2,}\.[0-9]{3,}$"
)
METRIC_PATH_RE = re.compile(r"^[a-z0-9_]+(?:\.[a-z0-9_]+)*$")
SNAKE_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")
SEMVER_RE = re.compile(
    r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)

MODULE_REGISTRY_RELATIVE = Path("knowledge/registries/observation-modules.yaml")
MODULE_REGISTRY_SCHEMA_RELATIVE = Path("schemas/observation-module-registry.schema.json")
CLAIM_SCHEMA_RELATIVE = Path("schemas/research-claim-assertion.schema.json")
POSE_SCHEMA_RELATIVE = Path("templates/observation-schema.json")
FACE_SCHEMA_RELATIVE = Path("templates/face-observation-schema.json")
POSE_REGISTRY_RELATIVE = Path("templates/rubric-template.yaml")
FACE_REGISTRY_RELATIVE = Path("templates/face-observation-rubric.yaml")


class PipelineError(RuntimeError):
    """A structured pipeline failure with a stable diagnostic code."""

    def __init__(self, code: str, message: str, path: str = "$") -> None:
        super().__init__(message)
        self.code = code
        self.path = path

    def diagnostic(self, severity: str = "error") -> dict[str, str]:
        return {
            "severity": severity,
            "code": self.code,
            "path": self.path,
            "message": str(self),
        }


@dataclass(frozen=True)
class GenerationResult:
    draft_id: str
    draft_dir: Path
    draft: dict[str, Any]
    report: dict[str, Any]
    receipt: dict[str, Any]
    idempotent: bool


@dataclass(frozen=True)
class CandidateResult:
    candidate_id: str
    candidate_dir: Path
    candidate_path: Path
    wrapper: dict[str, Any]
    receipt: dict[str, Any]
    idempotent: bool


@dataclass(frozen=True)
class FinalizeResult:
    destination: Path
    receipt: dict[str, Any]


@dataclass(frozen=True)
class CompatibilityResult:
    classification: str
    receipt: dict[str, Any]


@dataclass(frozen=True)
class VerifiedCandidate:
    candidate_dir: Path
    wrapper: dict[str, Any]
    wrapper_payload: bytes
    canonical_payload: bytes
    hash_binding: dict[str, str]
    draft: dict[str, Any]
    resolution: dict[str, Any]
    candidate_receipt: dict[str, Any]


def canonical_bytes(value: Any) -> bytes:
    return rfc8785.dumps(value)


def semantic_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def raw_bytes_sha256_v1(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


class _NoAliasSafeDumper(yaml.SafeDumper):
    def ignore_aliases(self, data: Any) -> bool:
        return True


class _CanonicalAssertionDumper(_NoAliasSafeDumper):
    pass


CANONICAL_ASSERTION_ROOT_KEY_ORDER = (
    "schema_version",
    "assertion_file_id",
    "claim_family",
    "path_base",
    "metric_path_syntax",
    "axis_registry_refs",
    "evidence_refs",
    "assertions",
)


def _represent_canonical_string(dumper: yaml.SafeDumper, value: str) -> yaml.ScalarNode:
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style='"')


_CanonicalAssertionDumper.add_representer(str, _represent_canonical_string)


def yaml_bytes(value: Any) -> bytes:
    return yaml.dump(
        value,
        Dumper=_NoAliasSafeDumper,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    ).encode("utf-8")


def canonical_assertion_bytes(value: Mapping[str, Any]) -> bytes:
    """Serialize a Canonical Assertion with the frozen YAML artifact profile."""
    if set(value) != set(CANONICAL_ASSERTION_ROOT_KEY_ORDER):
        raise PipelineError(
            "CANONICAL_ASSERTION_SERIALIZATION_FAILED",
            "Canonical Assertion root fields do not match the fixed serialization profile",
        )
    ordered = {key: value[key] for key in CANONICAL_ASSERTION_ROOT_KEY_ORDER}
    payload = yaml.dump(
        ordered,
        Dumper=_CanonicalAssertionDumper,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        indent=2,
        width=4096,
        line_break="\n",
    ).encode("utf-8")
    if payload.startswith(b"\xef\xbb\xbf") or b"\r" in payload or not payload.endswith(b"\n"):
        raise PipelineError("CANONICAL_ASSERTION_SERIALIZATION_FAILED", "Canonical YAML profile invariant failed")
    if b"&id" in payload or b"*id" in payload:
        raise PipelineError("CANONICAL_ASSERTION_SERIALIZATION_FAILED", "YAML anchors or aliases are forbidden")
    return payload


def utc_now_text() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def uuid7_text() -> str:
    """Return an RFC 9562 UUIDv7 without depending on Python 3.14."""
    timestamp_ms = int(time.time() * 1000) & ((1 << 48) - 1)
    random_bits = int.from_bytes(os.urandom(10), "big")
    value = timestamp_ms << 80
    value |= 0x7 << 76
    value |= (random_bits >> 68) << 64
    value |= 0b10 << 62
    value |= random_bits & ((1 << 62) - 1)
    return str(uuid.UUID(int=value))


def _schema_errors(value: Any, schema: Mapping[str, Any]) -> list[str]:
    errors = Draft202012Validator(schema).iter_errors(value)
    return [
        f"{'.'.join(str(part) for part in error.absolute_path) or '<root>'}: {error.message}"
        for error in sorted(errors, key=lambda item: list(item.absolute_path))
    ]


def validate_artifact(project_root: Path, schema_filename: str, value: Any) -> None:
    schemas: dict[str, dict[str, Any]] = {}
    registry = Registry()
    for path in sorted((project_root / "schemas").glob("*.json")):
        schema = _load_json(path)
        if "$id" in schema:
            registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
        schemas[path.name] = schema
    schema = schemas[schema_filename]
    errors = Draft202012Validator(schema, registry=registry).iter_errors(value)
    formatted = [
        f"{'.'.join(str(part) for part in error.absolute_path) or '<root>'}: {error.message}"
        for error in sorted(errors, key=lambda item: list(item.absolute_path))
    ]
    if formatted:
        raise PipelineError("ARTIFACT_SCHEMA_INVALID", "; ".join(formatted), schema_filename)


def _native_path(path: Path) -> str:
    resolved = str(path.resolve())
    return "\\\\?\\" + resolved if os.name == "nt" and not resolved.startswith("\\\\?\\") else resolved


def _read_bytes(path: Path) -> bytes:
    with open(_native_path(path), "rb") as stream:
        return stream.read()


def _read_text(path: Path, encoding: str = "utf-8-sig") -> str:
    return _read_bytes(path).decode(encoding)


def _json_files(directory: Path) -> list[Path]:
    try:
        with os.scandir(_native_path(directory)) as entries:
            return sorted(
                (Path(entry.path) for entry in entries if entry.is_file() and entry.name.endswith(".json")),
                key=lambda item: item.name,
            )
    except FileNotFoundError:
        return []


def _load_json(path: Path) -> dict[str, Any]:
    try:
        raw = _read_bytes(path)
    except OSError as exc:
        raise PipelineError("SOURCE_NOT_FOUND", f"Cannot read source: {path}", str(path)) from exc
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise PipelineError("SOURCE_INVALID_UTF8", f"Source is not valid UTF-8: {path}", str(path)) from exc
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise PipelineError("SOURCE_JSON_INVALID", f"Invalid JSON in {path}: {exc}", str(path)) from exc
    if not isinstance(value, dict):
        raise PipelineError("SOURCE_JSON_INVALID", f"JSON root must be an object: {path}", str(path))
    return value


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        text = _read_text(path)
    except UnicodeDecodeError as exc:
        raise PipelineError("TEXT_FILE_INVALID_UTF8", f"Text file is not valid UTF-8: {path}", str(path)) from exc
    except OSError as exc:
        raise PipelineError("SOURCE_NOT_FOUND", f"Cannot read source: {path}", str(path)) from exc
    try:
        return yaml_load(text, str(path))
    except ValueError as exc:
        raise PipelineError("SOURCE_YAML_INVALID", str(exc), str(path)) from exc


def _repository_root(project_root: Path) -> Path:
    return project_root.resolve().parents[1]


def _logical_path(project_root: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(_repository_root(project_root)).as_posix()
    except ValueError as exc:
        raise PipelineError("SOURCE_PATH_INVALID", f"Source is outside the repository: {path}", str(path)) from exc


def _safe_project_path(project_root: Path, relative: Path) -> Path:
    if relative.is_absolute() or ".." in relative.parts:
        raise PipelineError("SOURCE_PATH_INVALID", f"Unsafe Research Project path: {relative}")
    resolved = (project_root / relative).resolve()
    try:
        resolved.relative_to(project_root.resolve())
    except ValueError as exc:
        raise PipelineError("SOURCE_PATH_INVALID", f"Path escapes Research Project Root: {relative}") from exc
    return resolved


def _source_record(
    project_root: Path,
    path: Path,
    *,
    source_role: str,
    module: str,
    run_id: str,
    structured: str,
) -> dict[str, Any]:
    if structured == "json":
        data = _load_json(path)
        algorithm = "jcs_sha256_v1"
        value = semantic_hash(data)
    elif structured == "text":
        try:
            value = normalized_text_file_sha256_v1(path)
        except InvalidTextEncodingError as exc:
            raise PipelineError("TEXT_FILE_INVALID_UTF8", str(exc), str(path)) from exc
        algorithm = "normalized_text_file_sha256_v1"
    else:
        raise ValueError(structured)
    return {
        "source_role": source_role,
        "logical_path": _logical_path(project_root, path),
        "hash_algorithm": algorithm,
        "hash_value": value,
        "parse_status": "succeeded",
        "module": module,
        "run_id": run_id,
    }


def _normalize_run_id(value: str) -> str:
    result = re.sub(r"[^a-z0-9]+", "_", value.lower())
    result = re.sub(r"_+", "_", result).strip("_")
    if not result or len(result) > 64 or not result.isascii():
        raise PipelineError("RUN_ID_INVALID", f"Run ID cannot be normalized safely: {value!r}")
    return result


def _metric_slug(value: str) -> str:
    if not METRIC_PATH_RE.fullmatch(value):
        raise PipelineError("INVALID_METRIC_PATH", f"Invalid dotted metric path: {value!r}")
    result = re.sub(r"_+", "_", value.lower().replace(".", "_")).strip("_")
    if not result or len(result) > 96:
        raise PipelineError("INVALID_METRIC_PATH", f"Metric slug is empty or too long: {value!r}")
    return result


def _normalize_dot_segment(value: str) -> str:
    result = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    result = re.sub(r"_+", "_", result)
    return result or "unknown"


def _experiment_group_id(run_id: str) -> str:
    return re.sub(r"-[A-Z]$", "", run_id, flags=re.IGNORECASE)


def _model_id(manifest: Mapping[str, Any]) -> str:
    checkpoint = str((manifest.get("model") or {}).get("checkpoint") or "unknown")
    return f"model.{_normalize_dot_segment(checkpoint)}"


def _context_id(manifest: Mapping[str, Any], run_id: str) -> str:
    domain = _normalize_dot_segment(str(manifest.get("domain") or "unknown"))
    group = _normalize_dot_segment(_experiment_group_id(run_id))
    return f"context.{domain}.{group}"


def _module_projection(module: Mapping[str, Any]) -> tuple[str, str, str]:
    semantic = {
        "slug": module["slug"],
        "semantic_contract": {
            "definition": module["semantic_contract"]["definition"],
            "scope": sorted(module["semantic_contract"]["scope"]),
            "metric_namespaces": sorted(module["semantic_contract"]["metric_namespaces"]),
        },
    }
    semantic_hash_value = semantic_hash(semantic)
    major = str(module["semantic_contract_version"]).split(".", 1)[0]
    hard = {
        "canonical_module_slug": module["slug"],
        "semantic_contract_version_major": int(major),
        "evidence_id_contract": module["evidence_id_contract"],
    }
    fingerprint = {
        "canonical_module_slug": module["slug"],
        "semantic_contract_version": module["semantic_contract_version"],
        "semantic_contract_hash": semantic_hash_value,
        "evidence_id_contract": module["evidence_id_contract"],
        "status": module["status"],
    }
    return semantic_hash_value, semantic_hash(hard), semantic_hash(fingerprint)


def load_module_registry(project_root: Path) -> tuple[dict[str, Any], dict[str, dict[str, Any]], str]:
    registry_path = _safe_project_path(project_root, MODULE_REGISTRY_RELATIVE)
    schema_path = _safe_project_path(project_root, MODULE_REGISTRY_SCHEMA_RELATIVE)
    registry = _load_yaml(registry_path)
    schema = _load_json(schema_path)
    errors = _schema_errors(registry, schema)
    if errors:
        raise PipelineError("REGISTRY_SCHEMA_VERSION_MISMATCH", "; ".join(errors), str(registry_path))

    canonical: dict[str, dict[str, Any]] = {}
    aliases: dict[str, str] = {}
    for module in registry["modules"]:
        slug = module["slug"]
        if slug in canonical or slug in aliases:
            raise PipelineError("MODULE_SLUG_NOT_REGISTERED", f"Duplicate Module slug: {slug}")
        canonical[slug] = module
        for alias in module["aliases"]:
            if alias in canonical or alias in aliases:
                raise PipelineError("MODULE_SLUG_NOT_REGISTERED", f"Duplicate Module alias: {alias}")
            aliases[alias] = slug
    required = {"pose", "face", "hair", "clothing", "camera", "object", "other"}
    if not required.issubset(canonical):
        missing = sorted(required - set(canonical))
        raise PipelineError("MODULE_SLUG_NOT_REGISTERED", f"Registry is missing initial canonical Modules: {missing}")

    projection = copy.deepcopy(registry)
    projection["modules"] = sorted(projection["modules"], key=lambda item: item["slug"])
    for module in projection["modules"]:
        module["aliases"] = sorted(module["aliases"])
        module["semantic_contract"]["scope"] = sorted(module["semantic_contract"]["scope"])
        module["semantic_contract"]["metric_namespaces"] = sorted(
            module["semantic_contract"]["metric_namespaces"]
        )
    return registry, canonical, semantic_hash(projection)


def _resolve_module(name: str, modules: Mapping[str, Mapping[str, Any]]) -> str:
    if name in modules:
        module = modules[name]
    else:
        found = [item for item in modules.values() if name in item["aliases"]]
        if not found:
            raise PipelineError("MODULE_SLUG_NOT_REGISTERED", f"Module is not registered: {name}")
        module = found[0]
    if module["status"] == "deprecated":
        raise PipelineError("MODULE_SLUG_DEPRECATED", f"Module is deprecated: {module['slug']}")
    if module["slug"] not in {"pose", "face", "hair", "clothing", "camera", "object", "other"}:
        raise PipelineError("MODULE_NOT_SUPPORTED_BY_CLAIM_SCHEMA", f"Unsupported Claim Module: {module['slug']}")
    return str(module["slug"])


def _walk_counts(value: Mapping[str, Any], prefix: tuple[str, ...] = ()) -> Iterable[tuple[tuple[str, ...], int]]:
    for key in sorted(value):
        child = value[key]
        path = (*prefix, str(key))
        if isinstance(child, bool):
            continue
        if isinstance(child, int):
            yield path, child
        elif isinstance(child, Mapping):
            yield from _walk_counts(child, path)


def _metric_contract(
    module: str,
    metric_parts: Sequence[str],
    observed_value: str,
    rubric: Mapping[str, Any],
) -> dict[str, Any]:
    definition = "Mechanically extracted stored aggregate count."
    allowed_values: list[str]
    if len(metric_parts) >= 4 and metric_parts[1] == "axis_counts":
        axis = metric_parts[2]
        entry = (rubric.get("axis_catalog") or {}).get(axis) or {}
        definition = str(entry.get("definition") or entry.get("label") or definition)
        allowed_values = sorted(str(item) for item in entry.get("allowed_values") or [observed_value])
    elif metric_parts[1] == "primary_morphology_counts":
        allowed_values = sorted(str(item) for item in (rubric.get("morphology_candidates") or {}).get("primary", [observed_value]))
    elif metric_parts[1] == "secondary_morphology_counts":
        allowed_values = sorted(str(item) for item in (rubric.get("morphology_candidates") or {}).get("secondary", [observed_value]))
    elif metric_parts[1] == "artifact_counts":
        allowed_values = sorted(str(item) for item in rubric.get("artifact_checks") or [observed_value])
    else:
        allowed_values = [observed_value]
    return {
        "registry_role": f"{module}_axis_registry",
        "canonical_module_slug": module,
        "metric": ".".join(metric_parts),
        "metric_path_contract": "dotted_object_path_v1",
        "definition": definition,
        "allowed_values": allowed_values,
        "denominator_contract": {"path": "panel_count"},
        "visibility_contract": {"status": "not_applicable"},
    }


def _axis_registry_for_module(project_root: Path, module: str) -> Path:
    if module == "pose":
        return _safe_project_path(project_root, POSE_REGISTRY_RELATIVE)
    if module == "face":
        return _safe_project_path(project_root, FACE_REGISTRY_RELATIVE)
    raise PipelineError("MODULE_NOT_SUPPORTED_BY_CLAIM_SCHEMA", f"No Axis Registry is implemented for Module: {module}")


def _validate_observation(
    project_root: Path,
    path: Path,
    module: str,
) -> tuple[dict[str, Any], dict[str, Any], Path, dict[str, Any]]:
    if module not in {"pose", "face"}:
        raise PipelineError(
            "MODULE_NOT_SUPPORTED_BY_CLAIM_SCHEMA",
            f"Observation validation is not implemented for Module: {module}",
        )
    data = _load_json(path)
    schema_path = _safe_project_path(project_root, POSE_SCHEMA_RELATIVE if module == "pose" else FACE_SCHEMA_RELATIVE)
    schema = _load_json(schema_path)
    errors = _schema_errors(data, schema)
    if errors:
        raise PipelineError("OBSERVATION_SCHEMA_INVALID", "; ".join(errors), str(path))
    aggregate = data.get("computed_aggregate")
    if not isinstance(aggregate, dict):
        raise PipelineError("AGGREGATE_UNAVAILABLE", "computed_aggregate is required", str(path))

    if module == "pose":
        source_rubric = path.parent / "source" / "rubric.yaml"
        rubric_path = source_rubric if source_rubric.exists() else _axis_registry_for_module(project_root, module)
        rubric = _load_yaml(rubric_path)
        expected = compute_pose_aggregate(data)
    elif module == "face":
        rubric_path = _axis_registry_for_module(project_root, module)
        rubric = _load_yaml(rubric_path)
        expected = compute_face_aggregate(data)
    else:
        raise PipelineError("MODULE_NOT_SUPPORTED_BY_CLAIM_SCHEMA", f"Observation validation is not implemented for Module: {module}")
    if aggregate != expected:
        raise PipelineError("AGGREGATE_INCONSISTENT", f"Stored computed_aggregate does not match panel data: {path}", str(path))
    return data, aggregate, rubric_path, rubric


def _observation_source(
    project_root: Path,
    path: Path,
    module: str,
    module_entry: Mapping[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    data, aggregate, rubric_path, rubric = _validate_observation(project_root, path, module)
    run_id = str(data["run_id"])
    panel_count = int(data["panel_count"])
    observation_hash = semantic_hash(data)
    normalized_run_id = _normalize_run_id(run_id)
    source_prefix = observation_hash[:16]
    logical_path = _logical_path(project_root, path)
    extracted: list[dict[str, Any]] = []
    staged: list[dict[str, Any]] = []
    slug_paths: dict[str, str] = {}

    for aggregate_parts, count in _walk_counts(aggregate):
        metric_parts = ("computed_aggregate", *aggregate_parts)
        metric = ".".join(metric_parts)
        slug = _metric_slug(metric)
        previous = slug_paths.setdefault(slug, metric)
        if previous != metric:
            raise PipelineError("METRIC_SLUG_COLLISION", f"Metrics {previous!r} and {metric!r} normalize to {slug!r}")
        observed_value = aggregate_parts[-1]
        evidence_id = f"evidence.{normalized_run_id}.{module}.{slug}.{source_prefix}"
        id_projection = {
            "normalized_run_id": normalized_run_id,
            "canonical_module_slug": module,
            "metric_slug": slug,
            "source_hash_prefix": source_prefix,
        }
        id_projection_hash = semantic_hash(id_projection)
        coverage = "full"
        fact = {
            "evidence_ref_id": evidence_id,
            "observation_module": module,
            "observation_path": logical_path,
            "metric": metric,
            "denominator_path": "panel_count",
            "count": count,
            "total": panel_count,
            "storage": "local",
            "measurement_coverage": {"level": coverage},
        }
        content_projection = {
            "observation_module": module,
            "observation_content_hash": observation_hash,
            "metric": metric,
            "denominator_path": "panel_count",
            "count": count,
            "total": panel_count,
            "measurement_coverage": {"level": coverage},
        }
        staged.append(
            {
                "evidence_candidate_id": f"candidate.{evidence_id}",
                "evidence_id": evidence_id,
                "evidence_id_contract_version": EVIDENCE_ID_CONTRACT,
                "evidence_id_projection": id_projection,
                "evidence_id_projection_hash": id_projection_hash,
                "observation_content_hash": observation_hash,
                "evidence_content_hash": semantic_hash(content_projection),
                "canonical_fact": fact,
            }
        )
        extracted.append(
            {
                "module": module,
                "metric_path": metric,
                "observed_value": str(observed_value),
                "count": count,
                "total": panel_count,
                "evidence_candidate_id": f"candidate.{evidence_id}",
            }
        )

    manifest_path = path.parent / "manifest.yaml"
    manifest = _load_yaml(manifest_path) if manifest_path.exists() else {}
    run_metadata = {
        "run_id": run_id,
        "condition_id": run_id,
        "panel_count": panel_count,
        "experiment_group_id": _experiment_group_id(run_id),
        "model_id": _model_id(manifest),
        "context_id": _context_id(manifest, run_id),
    }
    source_files = [
        _source_record(project_root, path, source_role="observation" if module == "pose" else "optional_module_observation", module=module, run_id=run_id, structured="json"),
        _source_record(project_root, rubric_path, source_role="rubric", module=module, run_id=run_id, structured="text"),
    ]
    if manifest_path.exists():
        source_files.append(
            _source_record(project_root, manifest_path, source_role="manifest", module=module, run_id=run_id, structured="text")
        )
    _, hard_hash, fingerprint_hash = _module_projection(module_entry)
    module_compatibility = {
        "canonical_module_slug": module,
        "semantic_contract_version": module_entry["semantic_contract_version"],
        "evidence_id_contract": module_entry["evidence_id_contract"],
        "module_hard_compatibility_hash": hard_hash,
        "module_change_fingerprint_hash": fingerprint_hash,
        "status_at_generation": module_entry["status"],
    }
    metric_compatibility: dict[tuple[str, str, str], dict[str, Any]] = {}
    for metric in extracted:
        parts = tuple(metric["metric_path"].split("."))
        projection = _metric_contract(module, parts, metric["observed_value"], rubric)
        key = (module, projection["registry_role"], projection["metric"])
        entry = {
            "module": module,
            "registry_role": projection["registry_role"],
            "metric": projection["metric"],
            "compatibility_projection_version": "metric_compatibility_v1",
            "compatibility_hash": semantic_hash(projection),
        }
        previous_entry = metric_compatibility.setdefault(key, entry)
        if previous_entry != entry:
            raise PipelineError("DUPLICATE_METRIC_COMPATIBILITY_ENTRY", f"Conflicting metric compatibility entry: {key}")
    return (
        {
            "data": data,
            "run_metadata": run_metadata,
            "source_files": source_files,
            "module_compatibility": module_compatibility,
            "metric_compatibility": list(metric_compatibility.values()),
        },
        extracted,
        staged,
        manifest,
    )


def _generation_human_decisions(evidence_candidate_ids: Sequence[str]) -> list[dict[str, Any]]:
    return [
        {"decision_key": "selected_assertion_id", "reason_code": "HUMAN_RESEARCH_DECISION_REQUIRED", "candidate_ids": []},
        {"decision_key": "selected_claim_family", "reason_code": "HUMAN_RESEARCH_DECISION_REQUIRED", "candidate_ids": []},
        {"decision_key": "selected_subject", "reason_code": "HUMAN_RESEARCH_DECISION_REQUIRED", "candidate_ids": []},
        {"decision_key": "selected_claim_statement", "reason_code": "HUMAN_RESEARCH_DECISION_REQUIRED", "candidate_ids": []},
        {
            "decision_key": "selected_evidence_bindings",
            "reason_code": "HUMAN_RESEARCH_DECISION_REQUIRED",
            "candidate_ids": sorted(evidence_candidate_ids),
        },
        {"decision_key": "selected_scope", "reason_code": "HUMAN_RESEARCH_DECISION_REQUIRED", "candidate_ids": []},
        {"decision_key": "selected_generalization_status", "reason_code": "HUMAN_RESEARCH_DECISION_REQUIRED", "candidate_ids": []},
    ]


def _sort_report(report: dict[str, Any]) -> dict[str, Any]:
    report["sources"]["source_files"].sort(
        key=lambda item: (item["source_role"], item["module"], item["run_id"], item["logical_path"])
    )
    report["metric_extraction"]["metrics"].sort(
        key=lambda item: (item["module"], item["metric_path"], item["observed_value"], item["evidence_candidate_id"])
    )
    report["unresolved_fields"].sort(key=lambda item: (item["field_path"], item["reason_code"]))
    for item in report["human_decision_required"]:
        item["candidate_ids"] = sorted(set(item["candidate_ids"]))
    report["human_decision_required"].sort(key=lambda item: (item["decision_key"], item["reason_code"]))
    report["diagnostics"].sort(key=lambda item: (item["severity"], item["code"], item["path"], item["message"]))
    return report


def _write_create_or_same(path: Path, payload: bytes, collision_code: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    native_path = _native_path(path)
    try:
        descriptor = os.open(native_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        if _read_bytes(path) == payload:
            return True
        raise PipelineError(collision_code, f"Immutable artifact already exists with different content: {path}", str(path))
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        try:
            os.unlink(native_path)
        except FileNotFoundError:
            pass
        raise
    return False


def _receipt_step(status: str, code: str) -> dict[str, str]:
    return {"step_status": status, "result_code": code}


def _artifact_hash(algorithm: str, value: Any, payload: bytes | None = None) -> dict[str, str]:
    if algorithm == "jcs_sha256_v1":
        digest = semantic_hash(value)
    elif algorithm == "normalized_text_file_sha256_v1":
        if payload is None:
            raise ValueError("payload is required")
        text = payload.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    elif algorithm == "raw_bytes_sha256_v1":
        if payload is None:
            raise ValueError("payload is required")
        digest = raw_bytes_sha256_v1(payload)
    else:
        raise ValueError(algorithm)
    return {"algorithm": algorithm, "value": digest}


def _generation_receipt(
    draft: Mapping[str, Any],
    report: Mapping[str, Any],
    draft_payload: bytes,
    report_payload: bytes,
) -> dict[str, Any]:
    return {
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "receipt_id": uuid7_text(),
        "receipt_type": "generation",
        "recorded_at": utc_now_text(),
        "result": "succeeded",
        "related_artifact_ids": {
            "pre_schema_draft": draft["draft_id"],
            "generation_report": draft["draft_id"],
        },
        "related_artifact_hashes": {
            "pre_schema_draft": _artifact_hash("normalized_text_file_sha256_v1", draft, draft_payload),
            "generation_report": _artifact_hash("jcs_sha256_v1", report, report_payload),
        },
        "payload": {
            "source_validation": _receipt_step("succeeded", "SUCCEEDED"),
            "identity_construction": _receipt_step("succeeded", "SUCCEEDED"),
            "report_persistence": _receipt_step("succeeded", "SUCCEEDED"),
            "diagnostics": [],
        },
    }


def generate_draft(
    project_root: Path,
    observations: Sequence[tuple[Path, str]],
    *,
    output_root: Path | None = None,
) -> GenerationResult:
    project_root = project_root.resolve()
    output_root = (output_root or project_root / "inbox" / "claim-drafts").resolve()
    registry, modules, registry_hash = load_module_registry(project_root)
    if not observations:
        raise PipelineError("OBSERVATION_REQUIRED", "At least one pose Observation is required")

    sources: list[dict[str, Any]] = []
    metrics: list[dict[str, Any]] = []
    staged: list[dict[str, Any]] = []
    module_compatibility: dict[str, dict[str, Any]] = {}
    metric_compatibility: dict[tuple[str, str, str], dict[str, Any]] = {}
    run_metadata: list[dict[str, Any]] = []
    seen_source: set[tuple[str, str]] = set()
    has_pose = False

    for source_path, requested_module in observations:
        module = _resolve_module(requested_module, modules)
        if module == "pose":
            has_pose = True
        loaded, extracted, evidence, _manifest = _observation_source(
            project_root, source_path.resolve(), module, modules[module]
        )
        source_key = (loaded["run_metadata"]["run_id"], module)
        if source_key in seen_source:
            raise PipelineError("DUPLICATE_OBSERVATION_SOURCE", f"Duplicate Run/Module source: {source_key}")
        seen_source.add(source_key)
        sources.extend(loaded["source_files"])
        metrics.extend(extracted)
        staged.extend(evidence)
        run_metadata.append(loaded["run_metadata"])
        module_compatibility[module] = loaded["module_compatibility"]
        for entry in loaded["metric_compatibility"]:
            key = (entry["module"], entry["registry_role"], entry["metric"])
            previous = metric_compatibility.setdefault(key, entry)
            if previous != entry:
                raise PipelineError("DUPLICATE_METRIC_COMPATIBILITY_ENTRY", f"Conflicting entry: {key}")
    if not has_pose:
        raise PipelineError("OBSERVATION_REQUIRED", "The core pose observation.json is required")

    canonical_evidence = _canonical_evidence(project_root)
    for staged_entry in staged:
        existing = canonical_evidence.get(staged_entry["evidence_id"])
        if existing is None:
            continue
        _verify_existing_evidence_content(project_root, existing, staged_entry)

    registry_path = _safe_project_path(project_root, MODULE_REGISTRY_RELATIVE)
    sources.append(
        _source_record(
            project_root,
            registry_path,
            source_role="module_registry",
            module="not_applicable",
            run_id="not_applicable",
            structured="text",
        )
    )
    source_collection = sorted(
        sources,
        key=lambda item: (item["source_role"], item["module"], item["run_id"], item["logical_path"]),
    )
    used_modules = sorted(module_compatibility.values(), key=lambda item: item["canonical_module_slug"])
    used_metrics = sorted(metric_compatibility.values(), key=lambda item: (item["module"], item["registry_role"], item["metric"]))
    runs = sorted(run_metadata, key=lambda item: item["run_id"])
    identity_projection = {
        "source_files": source_collection,
        "observation_validator_version": OBSERVATION_VALIDATOR_VERSION,
        "aggregate_consistency_profile_version": AGGREGATE_PROFILE_VERSION,
        "metric_extraction_profile_version": METRIC_EXTRACTION_PROFILE_VERSION,
        "generator_contract": GENERATOR_CONTRACT,
        "generator_version": GENERATOR_VERSION,
        "template_version": TEMPLATE_VERSION,
        "registry_schema_version": registry["schema_version"],
        "registry_version": registry["registry_version"],
        "registry_content_hash": registry_hash,
        "used_module_compatibility": used_modules,
        "used_metric_compatibility": used_metrics,
        "evidence_id_contract_version": EVIDENCE_ID_CONTRACT,
        "draft_schema_version": DRAFT_SCHEMA_VERSION,
    }
    identity_hash = semantic_hash(identity_projection)
    draft_id = f"draft.{identity_hash}"
    unresolved = [{"field_path": "subject", "reason_code": "SUBJECT_REQUIRES_HUMAN_RESOLUTION"}]
    decisions = _generation_human_decisions([entry["evidence_candidate_id"] for entry in staged])
    metrics.sort(key=lambda item: (item["module"], item["metric_path"], item["observed_value"], item["evidence_candidate_id"]))
    staged.sort(key=lambda item: item["evidence_id"])
    draft = {
        "draft_schema_version": DRAFT_SCHEMA_VERSION,
        "draft_type": "descriptive_observation",
        "generator_contract": GENERATOR_CONTRACT,
        "generator_version": GENERATOR_VERSION,
        "template_version": TEMPLATE_VERSION,
        "draft_id": draft_id,
        "draft_input_identity_hash": identity_hash,
        "draft_input_identity": identity_projection,
        "run_metadata": runs,
        "observation_statements": metrics,
        "staged_evidence": staged,
        "used_module_compatibility": used_modules,
        "used_metric_compatibility": used_metrics,
        "unresolved_fields": unresolved,
        "human_decision_required": decisions,
    }
    report = _sort_report(
        {
            "generation_report_schema_version": GENERATION_REPORT_SCHEMA_VERSION,
            "report_type": "generation",
            "subject_id_kind": "draft_id",
            "subject_id": draft_id,
            "generator": {
                "generator_contract": GENERATOR_CONTRACT,
                "generator_version": GENERATOR_VERSION,
                "template_version": TEMPLATE_VERSION,
            },
            "sources": {"source_files": copy.deepcopy(source_collection)},
            "identity": {
                "status": "succeeded",
                "draft_id": draft_id,
                "draft_input_identity_hash": identity_hash,
            },
            "observation_validation": {
                "step_status": "succeeded",
                "validator_version": OBSERVATION_VALIDATOR_VERSION,
                "result_code": "SUCCEEDED",
            },
            "aggregate_validation": {
                "step_status": "succeeded",
                "consistency_result": "consistent",
            },
            "metric_extraction": {"step_status": "succeeded", "metrics": copy.deepcopy(metrics)},
            "unresolved_fields": copy.deepcopy(unresolved),
            "human_decision_required": copy.deepcopy(decisions),
            "diagnostics": [],
        }
    )
    draft_payload = yaml_bytes(draft)
    report_payload = json_bytes(report)
    receipt = _generation_receipt(draft, report, draft_payload, report_payload)
    validate_artifact(project_root, "observation-to-claim-draft.schema.json", draft)
    validate_artifact(project_root, "observation-to-claim-generation-report.schema.json", report)
    validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
    draft_dir = output_root / draft_id
    draft_same = _write_create_or_same(draft_dir / "pre-schema-draft.yaml", draft_payload, "DRAFT_ID_COLLISION")
    report_same = _write_create_or_same(draft_dir / "generation-report.json", report_payload, "DRAFT_ID_COLLISION")
    receipt_path = draft_dir / "generation-receipts" / f"{receipt['receipt_id']}.json"
    _write_create_or_same(receipt_path, json_bytes(receipt), "DRAFT_ID_COLLISION")
    return GenerationResult(draft_id, draft_dir, draft, report, receipt, draft_same and report_same)


def persist_generation_failure(
    project_root: Path,
    error: PipelineError,
    *,
    output_root: Path | None = None,
    source_paths: Sequence[Path] = (),
) -> Path:
    project_root = project_root.resolve()
    root = (output_root or project_root / "inbox" / "claim-draft-failures").resolve()
    attempt_id = uuid7_text()
    sources: list[dict[str, Any]] = []
    for source in source_paths:
        if not source.exists():
            continue
        payload = source.read_bytes()
        try:
            parsed = json.loads(payload.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            algorithm = "raw_bytes_sha256_v1"
            digest = raw_bytes_sha256_v1(payload)
            parse_status = "failed"
        else:
            algorithm = "jcs_sha256_v1"
            digest = semantic_hash(parsed)
            parse_status = "succeeded"
        sources.append(
            {
                "source_role": "observation",
                "logical_path": _logical_path(project_root, source),
                "hash_algorithm": algorithm,
                "hash_value": digest,
                "parse_status": parse_status,
                "module": "pose",
                "run_id": "not_applicable",
            }
        )
    report = _sort_report(
        {
            "generation_report_schema_version": GENERATION_REPORT_SCHEMA_VERSION,
            "report_type": "generation_failure",
            "subject_id_kind": "attempt_id",
            "subject_id": attempt_id,
            "generator": {
                "generator_contract": GENERATOR_CONTRACT,
                "generator_version": GENERATOR_VERSION,
                "template_version": TEMPLATE_VERSION,
            },
            "sources": {"source_files": sources},
            "identity": {"status": "failed", "error_code": error.code},
            "observation_validation": {
                "step_status": "failed",
                "validator_version": OBSERVATION_VALIDATOR_VERSION,
                "result_code": error.code,
            },
            "aggregate_validation": {"step_status": "not_started", "consistency_result": "unavailable"},
            "metric_extraction": {"step_status": "not_started", "metrics": []},
            "unresolved_fields": [],
            "human_decision_required": [],
            "diagnostics": [error.diagnostic()],
        }
    )
    directory = root / attempt_id
    report_payload = json_bytes(report)
    validate_artifact(project_root, "observation-to-claim-generation-report.schema.json", report)
    _write_create_or_same(directory / "generation-report.json", report_payload, "DRAFT_ID_COLLISION")
    receipt = {
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "receipt_id": uuid7_text(),
        "receipt_type": "generation",
        "recorded_at": utc_now_text(),
        "result": "failed",
        "related_artifact_ids": {"generation_report": attempt_id},
        "related_artifact_hashes": {
            "generation_report": _artifact_hash("raw_bytes_sha256_v1", report, report_payload)
        },
        "payload": {
            "source_validation": _receipt_step("failed", error.code),
            "identity_construction": _receipt_step("not_started", "NOT_STARTED"),
            "report_persistence": _receipt_step("succeeded", "SUCCEEDED"),
            "diagnostics": [error.diagnostic()],
        },
    }
    validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
    _write_create_or_same(
        directory / "generation-receipts" / f"{receipt['receipt_id']}.json",
        json_bytes(receipt),
        "DRAFT_ID_COLLISION",
    )
    return directory


def _load_and_verify_draft(project_root: Path, draft_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    draft_path = draft_dir / "pre-schema-draft.yaml"
    report_path = draft_dir / "generation-report.json"
    draft_payload = _read_bytes(draft_path)
    report_payload = _read_bytes(report_path)
    draft = _load_yaml(draft_path)
    report = _load_json(report_path)
    validate_artifact(project_root, "observation-to-claim-draft.schema.json", draft)
    validate_artifact(project_root, "observation-to-claim-generation-report.schema.json", report)
    if report.get("report_type") != "generation" or report.get("subject_id") != draft.get("draft_id"):
        raise PipelineError("DRAFT_CORRUPT", "Generation Report does not identify the persisted Draft")
    if report.get("identity", {}).get("draft_input_identity_hash") != draft.get("draft_input_identity_hash"):
        raise PipelineError("DRAFT_CORRUPT", "Generation Report Draft identity hash mismatch")

    receipts: list[dict[str, Any]] = []
    for path in _json_files(draft_dir / "generation-receipts"):
        receipt = _load_json(path)
        if (
            receipt.get("receipt_type") == "generation"
            and receipt.get("result") == "succeeded"
            and receipt.get("related_artifact_ids", {}).get("pre_schema_draft") == draft.get("draft_id")
        ):
            receipts.append(receipt)
    if not receipts:
        raise PipelineError("DRAFT_CORRUPT", "No successful Generation Receipt identifies the Draft")
    actual_draft_hash = _artifact_hash(
        "normalized_text_file_sha256_v1", draft, draft_payload
    )["value"]
    actual_report_hash = _artifact_hash("jcs_sha256_v1", report, report_payload)["value"]
    for receipt in receipts:
        stored = receipt.get("related_artifact_hashes", {})
        if stored.get("pre_schema_draft", {}).get("value") != actual_draft_hash:
            raise PipelineError("DRAFT_TAMPERED", "Persisted Draft no longer matches its Generation Receipt")
        if stored.get("generation_report", {}).get("value") != actual_report_hash:
            raise PipelineError("DRAFT_TAMPERED", "Generation Report no longer matches its Generation Receipt")
    return draft, report


def _validate_resolution(project_root: Path, resolution: Mapping[str, Any]) -> None:
    required = {
        "human_resolution_schema_version", "resolution_id", "source_draft_id",
        "source_draft_identity_hash", "selected_assertion_id", "selected_subject",
        "selected_claim_statement", "selected_evidence_bindings", "selected_claim_family",
        "selected_scope", "selected_generalization_status", "interpretation_candidates",
        "causal_hypotheses", "depends_on", "supersedes", "rejected_candidates",
        "decided_by", "decided_at",
    }
    if set(resolution) != required:
        missing = sorted(required - set(resolution))
        unknown = sorted(set(resolution) - required)
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", f"Human Resolution fields mismatch; missing={missing}, unknown={unknown}")
    if resolution["human_resolution_schema_version"] != HUMAN_RESOLUTION_SCHEMA_VERSION:
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "Unsupported Human Resolution schema version")
    if not UUID7_RE.fullmatch(str(resolution["resolution_id"])):
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "resolution_id must be UUIDv7")
    if not ASSERTION_ID_RE.fullmatch(str(resolution["selected_assertion_id"])):
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "selected_assertion_id is invalid")
    if not SNAKE_RE.fullmatch(str(resolution["selected_claim_family"])):
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "selected_claim_family is invalid")
    if not SHA256_RE.fullmatch(str(resolution["source_draft_identity_hash"])):
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "source_draft_identity_hash is invalid")
    decided_at = str(resolution["decided_at"])
    try:
        parsed_decided_at = datetime.fromisoformat(decided_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "decided_at must be RFC 3339") from exc
    if not decided_at.endswith("Z") or parsed_decided_at.utcoffset() != timezone.utc.utcoffset(parsed_decided_at):
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "decided_at must be a UTC timestamp with Z suffix")
    claim_schema = _load_json(project_root / CLAIM_SCHEMA_RELATIVE)
    defs = claim_schema["$defs"]
    checks = [
        (resolution["selected_subject"], defs["subject"], "selected_subject"),
        (resolution["selected_claim_statement"], defs["claim"], "selected_claim_statement"),
        (resolution["selected_scope"], defs["scope"], "selected_scope"),
        (resolution["selected_generalization_status"], defs["generalizationStatus"], "selected_generalization_status"),
    ]
    for value, sub_schema, name in checks:
        wrapper = {"$schema": claim_schema["$schema"], "$defs": defs, **sub_schema}
        errors = _schema_errors(value, wrapper)
        if errors:
            raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", f"{name}: {'; '.join(errors)}")
    array_checks = [
        ("selected_evidence_bindings", "evidenceBinding"),
        ("interpretation_candidates", "interpretationCandidate"),
        ("causal_hypotheses", "causalHypothesis"),
    ]
    for field, definition in array_checks:
        if not isinstance(resolution[field], list):
            raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", f"{field} must be an array")
        for index, value in enumerate(resolution[field]):
            wrapper = {"$schema": claim_schema["$schema"], "$defs": defs, **defs[definition]}
            errors = _schema_errors(value, wrapper)
            if errors:
                raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", f"{field}[{index}]: {'; '.join(errors)}")
    for field in ("depends_on", "supersedes"):
        values = resolution[field]
        if not isinstance(values, list) or len(values) != len(set(values)):
            raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", f"{field} must be a unique array")
        if any(not ASSERTION_ID_RE.fullmatch(str(value)) for value in values):
            raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", f"{field} contains an invalid Assertion ID")
    if not isinstance(resolution["rejected_candidates"], list):
        raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "rejected_candidates must be an array")
    for item in resolution["rejected_candidates"]:
        if set(item) != {"candidate_kind", "candidate_id", "reason_code"}:
            raise PipelineError("REQUIRED_HUMAN_DECISION_MISSING", "Invalid rejected_candidates item")
    validate_artifact(project_root, "observation-to-claim-human-resolution.schema.json", resolution)


def human_resolution_hash(resolution: Mapping[str, Any]) -> str:
    projection = {
        key: copy.deepcopy(value)
        for key, value in resolution.items()
        if key not in {"human_resolution_schema_version", "resolution_id", "decided_by", "decided_at"}
    }
    projection["selected_evidence_bindings"] = sorted(
        projection["selected_evidence_bindings"],
        key=lambda item: (item["evidence_ref_id"], item["evidence_role"], item["applies_to"]),
    )
    projection["interpretation_candidates"] = sorted(
        projection["interpretation_candidates"], key=lambda item: item["interpretation_candidate_id"]
    )
    projection["causal_hypotheses"] = sorted(
        projection["causal_hypotheses"], key=lambda item: item["causal_hypothesis_id"]
    )
    projection["depends_on"] = sorted(projection["depends_on"])
    projection["supersedes"] = sorted(projection["supersedes"])
    projection["rejected_candidates"] = sorted(
        projection["rejected_candidates"],
        key=lambda item: (item["candidate_kind"], item["candidate_id"], item["reason_code"]),
    )
    return semantic_hash(projection)


def _canonical_evidence(project_root: Path) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for path in sorted((project_root / "knowledge" / "assertions").glob("*.yaml")):
        document = _load_yaml(path)
        for fact in document.get("evidence_refs", []):
            evidence_id = fact["evidence_ref_id"]
            if evidence_id in result:
                raise PipelineError("DUPLICATE_EVIDENCE_ID", f"Duplicate canonical Evidence ID: {evidence_id}")
            result[evidence_id] = fact
    return result


def _fact_content(fact: Mapping[str, Any], observation_hash: str) -> dict[str, Any]:
    return {
        "observation_module": fact["observation_module"],
        "observation_content_hash": observation_hash,
        "metric": fact["metric"],
        "denominator_path": fact["denominator_path"],
        "count": fact["count"],
        "total": fact["total"],
        "measurement_coverage": fact["measurement_coverage"],
    }


def _existing_observation_content_hash(project_root: Path, fact: Mapping[str, Any]) -> str:
    stored_path = str(fact.get("observation_path") or "")
    posix = PurePosixPath(stored_path.replace("\\", "/"))
    if not stored_path or posix.is_absolute() or ".." in posix.parts or re.match(r"^[A-Za-z]:", stored_path):
        raise PipelineError(
            "EVIDENCE_CONTENT_UNRESOLVABLE",
            f"Existing Evidence has an unsafe Observation path: {stored_path!r}",
        )
    repo_root = _repository_root(project_root).resolve()
    observation_path = (repo_root / Path(*posix.parts)).resolve()
    try:
        observation_path.relative_to(repo_root)
    except ValueError as exc:
        raise PipelineError(
            "EVIDENCE_CONTENT_UNRESOLVABLE",
            f"Existing Evidence Observation escapes Repository Root: {stored_path}",
        ) from exc
    if not observation_path.is_file():
        raise PipelineError(
            "EVIDENCE_CONTENT_UNRESOLVABLE",
            f"Existing Evidence Observation does not exist: {stored_path}",
        )
    try:
        return semantic_hash(_load_json(observation_path))
    except PipelineError as exc:
        raise PipelineError(
            "EVIDENCE_CONTENT_UNRESOLVABLE",
            f"Existing Evidence Observation cannot be resolved: {stored_path}: {exc}",
        ) from exc


def _verify_existing_evidence_content(
    project_root: Path,
    existing_fact: Mapping[str, Any],
    staged_entry: Mapping[str, Any],
) -> None:
    existing_observation_hash = _existing_observation_content_hash(project_root, existing_fact)
    existing_hash = semantic_hash(_fact_content(existing_fact, existing_observation_hash))
    if existing_hash != staged_entry["evidence_content_hash"]:
        raise PipelineError(
            "EVIDENCE_ID_COLLISION",
            f"Canonical Evidence content differs for {staged_entry['evidence_id']}",
        )


def _reproduction(run_metadata: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    run_ids = sorted({str(item["run_id"]) for item in run_metadata})
    condition_ids = sorted({str(item["condition_id"]) for item in run_metadata})
    groups = sorted({str(item["experiment_group_id"]) for item in run_metadata})
    models = sorted({str(item["model_id"]) for item in run_metadata})
    contexts = sorted({str(item["context_id"]) for item in run_metadata})
    return {
        "panel_count": sum(int(item["panel_count"]) for item in run_metadata),
        "condition_count": len(condition_ids),
        "condition_ids": condition_ids,
        "run_count": len(run_ids),
        "run_ids": run_ids,
        "independent_experiment_count": len(groups),
        "experiment_group_ids": groups,
        "model_count": len(models),
        "model_ids": models,
        "context_count": len(contexts),
        "context_ids": contexts,
    }


def _assertion_file_id(assertion_id: str) -> str:
    value = re.sub(r"[._]+", "-", assertion_id.lower())
    value = re.sub(r"-+", "-", value).strip("-")
    return value


def _current_axis_refs(project_root: Path, modules: Iterable[str]) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for module in sorted(set(modules)):
        path = _axis_registry_for_module(project_root, module)
        result[module] = {
            "path": path.relative_to(project_root).as_posix(),
            "sha256": normalized_text_file_sha256_v1(path),
        }
    return result


def _candidate_identity(draft: Mapping[str, Any], resolution_hash: str) -> tuple[str, str, dict[str, Any]]:
    projection = {
        "source_draft_id": draft["draft_id"],
        "source_draft_identity_hash": draft["draft_input_identity_hash"],
        "human_resolution_hash": resolution_hash,
        "candidate_schema_version": CANDIDATE_SCHEMA_VERSION,
        "generator_version": GENERATOR_VERSION,
    }
    digest = semantic_hash(projection)
    return f"candidate.{digest}", digest, projection


def _assertion_content_v1_hash(project_root: Path, canonical: Mapping[str, Any]) -> str:
    evidence = _canonical_evidence(project_root)
    for fact in canonical.get("evidence_refs", []):
        evidence_id = fact["evidence_ref_id"]
        if evidence_id in evidence:
            raise PipelineError("DUPLICATE_EVIDENCE_ID", f"Duplicate Canonical Evidence: {evidence_id}")
        evidence[evidence_id] = fact
    assertions = canonical.get("assertions", [])
    if len(assertions) != 1:
        raise PipelineError("CANDIDATE_SCHEMA_INVALID", "Candidate must contain exactly one Assertion")
    try:
        return content_hash(assertion_payload(assertions[0], evidence))
    except KeyError as exc:
        raise PipelineError("CANDIDATE_SCHEMA_INVALID", f"Assertion Evidence cannot be resolved: {exc}") from exc


def _candidate_hash_binding(
    project_root: Path,
    wrapper: Mapping[str, Any],
    wrapper_payload: bytes,
    canonical_payload: bytes,
) -> dict[str, str]:
    return {
        "candidate_wrapper_artifact_hash_v1": _artifact_hash(
            "normalized_text_file_sha256_v1", wrapper, wrapper_payload
        )["value"],
        "canonical_assertion_artifact_hash_v1": _artifact_hash(
            "normalized_text_file_sha256_v1", wrapper["canonical_assertion"], canonical_payload
        )["value"],
        "assertion_content_v1_hash": _assertion_content_v1_hash(
            project_root, wrapper["canonical_assertion"]
        ),
    }


def _candidate_receipt(
    project_root: Path,
    draft: Mapping[str, Any],
    resolution: Mapping[str, Any],
    wrapper: Mapping[str, Any],
    draft_payload: bytes,
    wrapper_payload: bytes,
    canonical_payload: bytes,
) -> dict[str, Any]:
    binding = _candidate_hash_binding(project_root, wrapper, wrapper_payload, canonical_payload)
    identity = {
        "status": "available",
        "candidate_id": wrapper["candidate_id"],
        "candidate_id_projection_version": wrapper["candidate_id_projection_version"],
        "candidate_id_projection_hash": wrapper["candidate_id_projection_hash"],
        "candidate_schema_version": wrapper["candidate_schema_version"],
        "generator_version": wrapper["generator_version"],
        **binding,
    }
    return {
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "receipt_id": uuid7_text(),
        "receipt_type": "candidate_generation",
        "recorded_at": utc_now_text(),
        "result": "succeeded",
        "related_artifact_ids": {
            "pre_schema_draft": draft["draft_id"],
            "human_resolution": resolution["resolution_id"],
            "claim_candidate": wrapper["candidate_id"],
            "canonical_assertion": wrapper["canonical_assertion"]["assertions"][0]["assertion_id"],
        },
        "related_artifact_hashes": {
            "pre_schema_draft": _artifact_hash(
                "normalized_text_file_sha256_v1", draft, draft_payload
            ),
            "human_resolution": {"algorithm": "jcs_sha256_v1", "value": wrapper["human_resolution_hash"]},
            "claim_candidate": _artifact_hash("normalized_text_file_sha256_v1", wrapper, wrapper_payload),
            "canonical_assertion": _artifact_hash(
                "normalized_text_file_sha256_v1", wrapper["canonical_assertion"], canonical_payload
            ),
        },
        "payload": {
            "draft_validation": _receipt_step("succeeded", "SUCCEEDED"),
            "human_resolution_validation": _receipt_step("succeeded", "SUCCEEDED"),
            "candidate_construction": _receipt_step("succeeded", "SUCCEEDED"),
            "schema_validation": _receipt_step("succeeded", "SUCCEEDED"),
            "integration_validation": _receipt_step("succeeded", "SUCCEEDED"),
            "candidate_identity": identity,
            "diagnostics": [],
        },
    }


def _validate_canonical_schema(project_root: Path, document: Mapping[str, Any]) -> None:
    schema = _load_json(project_root / CLAIM_SCHEMA_RELATIVE)
    errors = _schema_errors(document, schema)
    if errors:
        raise PipelineError("CANDIDATE_SCHEMA_INVALID", "; ".join(errors))


def _validate_candidate_schema(project_root: Path, wrapper: Mapping[str, Any]) -> None:
    try:
        validate_artifact(project_root, "observation-to-claim-candidate.schema.json", wrapper)
    except PipelineError as exc:
        raise PipelineError("CANDIDATE_SCHEMA_INVALID", str(exc)) from exc


def _require_successful_validator_result(
    completed: subprocess.CompletedProcess[str], failure_code: str
) -> dict[str, Any]:
    try:
        report = json.loads(completed.stdout)
    except (json.JSONDecodeError, TypeError) as exc:
        raise PipelineError(failure_code, completed.stderr or completed.stdout or str(exc)) from exc
    required = (
        completed.returncode == 0
        and report.get("validation_completed") is True
        and report.get("passed") is True
        and report.get("valid") is True
        and report.get("exit_code") == 0
        and report.get("error_count") == 0
        and report.get("infrastructure_error_count") == 0
        and report.get("errors") == []
        and report.get("infrastructure_errors") == []
    )
    if not required:
        raise PipelineError(failure_code, "Research Claim Validator did not report a complete successful validation")
    return report


def _integrated_validate(
    project_root: Path, document: Mapping[str, Any], canonical_payload: bytes
) -> None:
    with tempfile.TemporaryDirectory(prefix="claim-candidate-") as directory:
        temp_knowledge = Path(directory) / "knowledge"
        shutil.copytree(project_root / "knowledge", temp_knowledge)
        target = temp_knowledge / "assertions" / f"{document['assertion_file_id']}.yaml"
        if target.exists():
            raise PipelineError("CANONICAL_DESTINATION_EXISTS", f"Canonical Assertion destination exists: {target.name}")
        target.write_bytes(canonical_payload)
        command = [
            sys.executable,
            str(project_root / "scripts" / "validate_research_claims.py"),
            "--root", str(project_root),
            "--knowledge-root", str(temp_knowledge),
            "--validation-context", "current_state",
            "--format", "json",
        ]
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", check=False)
        _require_successful_validator_result(completed, "CANDIDATE_INTEGRATION_FAILED")


def generate_candidate(project_root: Path, draft_dir: Path) -> CandidateResult:
    project_root = project_root.resolve()
    draft_dir = draft_dir.resolve()
    draft, report = _load_and_verify_draft(project_root, draft_dir)
    compatibility = check_registry_compatibility(project_root, draft_dir)
    if compatibility.classification == "incompatible":
        raise PipelineError(
            "DRAFT_REGISTRY_INCOMPATIBLE",
            "Current Registry contracts are incompatible with the persisted Draft",
        )
    resolution = _load_yaml(draft_dir / "human-resolution.yaml")
    if (
        draft.get("generator_version") != GENERATOR_VERSION
        or report.get("generator", {}).get("generator_version") != GENERATOR_VERSION
    ):
        raise PipelineError(
            "CANDIDATE_GENERATOR_VERSION_MISMATCH",
            "Draft generator_version does not match the Candidate Generator contract",
        )
    if semantic_hash(draft["draft_input_identity"]) != draft["draft_input_identity_hash"]:
        raise PipelineError("DRAFT_TAMPERED", "Draft identity hash no longer matches")
    if resolution.get("source_draft_id") != draft.get("draft_id") or resolution.get("source_draft_identity_hash") != draft.get("draft_input_identity_hash"):
        raise PipelineError("DRAFT_TAMPERED", "Human Resolution does not bind the current Draft identity")
    _validate_resolution(project_root, resolution)
    resolution_hash = human_resolution_hash(resolution)

    staged_by_id = {entry["evidence_id"]: entry for entry in draft["staged_evidence"]}
    canonical_existing = _canonical_evidence(project_root)
    selected_ids = sorted({item["evidence_ref_id"] for item in resolution["selected_evidence_bindings"]})
    new_facts: list[dict[str, Any]] = []
    selected_facts: list[dict[str, Any]] = []
    for evidence_id in selected_ids:
        staged_entry = staged_by_id.get(evidence_id)
        existing = canonical_existing.get(evidence_id)
        if staged_entry is None and existing is None:
            raise PipelineError("OBSERVED_METRIC_EVIDENCE_NOT_FOUND", f"Evidence is not staged or canonical: {evidence_id}")
        if staged_entry is not None:
            projection = staged_entry["evidence_id_projection"]
            if semantic_hash(projection) != staged_entry["evidence_id_projection_hash"]:
                raise PipelineError(
                    "EVIDENCE_ID_PROJECTION_HASH_MISMATCH",
                    f"Evidence ID projection hash mismatch: {evidence_id}",
                )
            expected_evidence_id = (
                f"evidence.{projection['normalized_run_id']}.{projection['canonical_module_slug']}."
                f"{projection['metric_slug']}.{projection['source_hash_prefix']}"
            )
            if expected_evidence_id != evidence_id:
                raise PipelineError(
                    "DRAFT_EVIDENCE_ID_INCOMPATIBLE",
                    f"Evidence ID does not match its frozen projection: {evidence_id}",
                )
            selected_facts.append(staged_entry["canonical_fact"])
            if existing is None:
                new_facts.append(copy.deepcopy(staged_entry["canonical_fact"]))
            else:
                _verify_existing_evidence_content(project_root, existing, staged_entry)
        else:
            selected_facts.append(existing)

    metrics_by_path: dict[str, list[dict[str, Any]]] = {}
    for fact in selected_facts:
        metrics_by_path.setdefault(fact["metric"], []).append(fact)
    observed_metrics = [
        {
            "metric": metric,
            "count": sum(item["count"] for item in facts),
            "total": sum(item["total"] for item in facts),
            "evidence_ref_ids": sorted(item["evidence_ref_id"] for item in facts),
        }
        for metric, facts in sorted(metrics_by_path.items())
    ]
    selected_modules = [fact["observation_module"] for fact in selected_facts]
    assertion_id = resolution["selected_assertion_id"]
    assertion = {
        "assertion_id": assertion_id,
        "status": "draft",
        "subject": copy.deepcopy(resolution["selected_subject"]),
        "claim": copy.deepcopy(resolution["selected_claim_statement"]),
        "observed_metrics": observed_metrics,
        "interpretation_candidates": copy.deepcopy(resolution["interpretation_candidates"]),
        "causal_hypotheses": copy.deepcopy(resolution["causal_hypotheses"]),
        "evidence_bindings": copy.deepcopy(resolution["selected_evidence_bindings"]),
        "depends_on": sorted(resolution["depends_on"]),
        "supersedes": sorted(resolution["supersedes"]),
        "reproduction": _reproduction(draft["run_metadata"]),
        "scope": copy.deepcopy(resolution["selected_scope"]),
        "generalization_status": copy.deepcopy(resolution["selected_generalization_status"]),
        "created_by": {
            "agent": "codex",
            "version": GENERATOR_VERSION,
            "created_at": resolution["decided_at"],
        },
        "promotion": {
            "action": "no_promotion",
            "status": "not_nominated",
            "approval_ids": [],
            "applications": [],
        },
    }
    canonical = {
        "schema_version": "0.1.0",
        "assertion_file_id": _assertion_file_id(assertion_id),
        "claim_family": resolution["selected_claim_family"],
        "path_base": "research_project_root",
        "metric_path_syntax": "dotted_object_path_v1",
        "axis_registry_refs": _current_axis_refs(project_root, selected_modules or [resolution["selected_scope"]["domain_scope"]]),
        "evidence_refs": sorted(new_facts, key=lambda item: item["evidence_ref_id"]),
        "assertions": [assertion],
    }
    _validate_canonical_schema(project_root, canonical)
    canonical_payload = canonical_assertion_bytes(canonical)
    _integrated_validate(project_root, canonical, canonical_payload)
    candidate_id, projection_hash, _projection = _candidate_identity(draft, resolution_hash)
    wrapper = {
        "candidate_schema_version": CANDIDATE_SCHEMA_VERSION,
        "candidate_id": candidate_id,
        "candidate_id_projection_version": CANDIDATE_ID_PROJECTION_VERSION,
        "candidate_id_projection_hash": projection_hash,
        "source_draft_id": draft["draft_id"],
        "source_draft_identity_hash": draft["draft_input_identity_hash"],
        "human_resolution_hash": resolution_hash,
        "generator_version": GENERATOR_VERSION,
        "canonical_assertion": canonical,
    }
    payload = yaml_bytes(wrapper)
    _validate_candidate_schema(project_root, wrapper)
    candidate_dir = draft_dir / "claim-candidates" / candidate_id
    path = candidate_dir / "claim-candidate.yaml"
    same = _write_create_or_same(path, payload, "CANDIDATE_ID_COLLISION")
    receipt = _candidate_receipt(
        project_root,
        draft,
        resolution,
        wrapper,
        _read_bytes(draft_dir / "pre-schema-draft.yaml"),
        payload,
        canonical_payload,
    )
    validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
    (candidate_dir / "generation-receipts").mkdir(parents=True, exist_ok=True)
    _write_create_or_same(
        candidate_dir / "generation-receipts" / f"{receipt['receipt_id']}.json",
        json_bytes(receipt),
        "CANDIDATE_ID_COLLISION",
    )
    return CandidateResult(candidate_id, candidate_dir, path, wrapper, receipt, same)


def check_registry_compatibility(project_root: Path, draft_dir: Path) -> CompatibilityResult:
    """Compare a persisted Draft with current Module/metric/Evidence contracts.

    This is an execution-time audit Receipt. It does not mutate the Draft and a
    later Registry change does not retroactively invalidate the original Draft.
    """
    project_root = project_root.resolve()
    draft_dir = draft_dir.resolve()
    draft, _report = _load_and_verify_draft(project_root, draft_dir)
    _registry, modules, _registry_hash = load_module_registry(project_root)

    module_results: list[dict[str, str]] = []
    module_classifications: list[str] = []
    for used in sorted(draft["used_module_compatibility"], key=lambda item: item["canonical_module_slug"]):
        slug = used["canonical_module_slug"]
        current = modules.get(slug)
        if current is None:
            raise PipelineError("MODULE_SLUG_NOT_REGISTERED", f"Module is no longer registered: {slug}")
        _semantic, hard_hash, fingerprint_hash = _module_projection(current)
        if current["status"] == "deprecated":
            classification = "incompatible"
        elif hard_hash != used["module_hard_compatibility_hash"]:
            classification = "incompatible"
        elif fingerprint_hash == used["module_change_fingerprint_hash"]:
            classification = "unchanged"
        else:
            classification = "compatible_changed"
        module_classifications.append(classification)
        module_results.append(
            {
                "canonical_module_slug": slug,
                "generation_hash": used["module_change_fingerprint_hash"],
                "current_hash": fingerprint_hash,
                "generation_status": used["status_at_generation"],
                "current_status": current["status"],
                "result": classification,
            }
        )

    rubric_paths: dict[str, set[Path]] = {}
    for source in draft["draft_input_identity"]["source_files"]:
        if source["source_role"] != "rubric":
            continue
        rubric_paths.setdefault(source["module"], set()).add(
            (_repository_root(project_root) / PurePosixPath(source["logical_path"])).resolve()
        )
    metric_results: list[dict[str, str]] = []
    for item in sorted(draft["used_metric_compatibility"], key=lambda entry: (entry["module"], entry["metric"])):
        module = item["module"]
        paths = rubric_paths.get(module) or {_axis_registry_for_module(project_root, module)}
        current_hashes: set[str] = set()
        metric_parts = tuple(item["metric"].split("."))
        observed_value = metric_parts[-1]
        for rubric_path in paths:
            rubric = _load_yaml(rubric_path)
            current_hashes.add(semantic_hash(_metric_contract(module, metric_parts, observed_value, rubric)))
        if len(current_hashes) != 1:
            raise PipelineError(
                "METRIC_COMPATIBILITY_UNAVAILABLE",
                f"Metric contract differs across current Registries: {module}/{item['metric']}",
            )
        current_hash = next(iter(current_hashes))
        result = "unchanged" if current_hash == item["compatibility_hash"] else "incompatible"
        if result == "incompatible":
            module_classifications.append(result)
        metric_results.append(
            {
                "module": module,
                "metric": item["metric"],
                "generation_hash": item["compatibility_hash"],
                "current_hash": current_hash,
                "result": result,
            }
        )
    evidence_results: list[dict[str, str]] = []
    for item in sorted(draft["staged_evidence"], key=lambda entry: entry["evidence_id"]):
        current_hash = semantic_hash(item["evidence_id_projection"])
        result = "unchanged" if current_hash == item["evidence_id_projection_hash"] else "incompatible"
        if result == "incompatible":
            module_classifications.append(result)
        evidence_results.append(
            {
                "evidence_id": item["evidence_id"],
                "generation_projection_hash": item["evidence_id_projection_hash"],
                "current_projection_hash": current_hash,
                "result": result,
            }
        )

    if "incompatible" in module_classifications:
        classification = "incompatible"
    elif "compatible_changed" in module_classifications:
        classification = "compatible_changed"
    else:
        classification = "unchanged"
    receipt = {
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "receipt_id": uuid7_text(),
        "receipt_type": "registry_compatibility_check",
        "recorded_at": utc_now_text(),
        "result": "succeeded" if classification != "incompatible" else "inconclusive",
        "related_artifact_ids": {"pre_schema_draft": draft["draft_id"]},
        "related_artifact_hashes": {
            "pre_schema_draft": _artifact_hash(
                "normalized_text_file_sha256_v1", draft, yaml_bytes(draft)
            )
        },
        "payload": {
            "registry_load": _receipt_step("succeeded", "SUCCEEDED"),
            "compatibility_evaluation": _receipt_step("succeeded", "SUCCEEDED"),
            "classification": classification,
            "module_results": module_results,
            "metric_results": metric_results,
            "evidence_id_results": evidence_results,
            "diagnostics": [],
        },
    }
    validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
    _write_create_or_same(
        draft_dir / "generation-receipts" / f"{receipt['receipt_id']}.json",
        json_bytes(receipt),
        "DRAFT_ID_COLLISION",
    )
    return CompatibilityResult(classification, receipt)


class _KnowledgeLock:
    def __init__(self, path: Path, timeout: float = 30.0) -> None:
        self.path = path
        self.timeout = timeout
        self.owner = {"pid": os.getpid(), "host": socket.gethostname(), "created_at": utc_now_text()}

    def __enter__(self) -> "_KnowledgeLock":
        deadline = time.monotonic() + self.timeout
        payload = json_bytes(self.owner)
        while True:
            try:
                descriptor = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
            except FileExistsError:
                if time.monotonic() >= deadline:
                    raise PipelineError("FINALIZE_LOCK_TIMEOUT", f"Timed out acquiring canonical lock: {self.path}")
                time.sleep(0.1)
                continue
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        try:
            current = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if current == self.owner:
            self.path.unlink(missing_ok=True)


def canonical_knowledge_snapshot(project_root: Path) -> str:
    entries: list[dict[str, str]] = []
    for path in sorted((project_root / "knowledge").rglob("*.yaml")):
        entries.append(
            {
                "path": path.relative_to(project_root).as_posix(),
                "content_hash": normalized_text_file_sha256_v1(path),
            }
        )
    for path in sorted((project_root / "concepts").glob("*.json")):
        entries.append(
            {
                "path": path.relative_to(project_root).as_posix(),
                "content_hash": semantic_hash(_load_json(path)),
            }
        )
    for path in sorted((project_root / "schemas").glob("*.json")):
        entries.append(
            {
                "path": path.relative_to(project_root).as_posix(),
                "content_hash": semantic_hash(_load_json(path)),
            }
        )
    for relative in (
        POSE_REGISTRY_RELATIVE,
        FACE_REGISTRY_RELATIVE,
        POSE_SCHEMA_RELATIVE,
        FACE_SCHEMA_RELATIVE,
    ):
        path = project_root / relative
        if path.exists():
            algorithm = semantic_hash(_load_json(path)) if path.suffix == ".json" else normalized_text_file_sha256_v1(path)
            entries.append(
                {
                    "path": path.relative_to(project_root).as_posix(),
                    "content_hash": algorithm,
                }
            )
    return semantic_hash(sorted(entries, key=lambda item: item["path"]))


def _resolve_candidate_path(
    draft_dir: Path,
    *,
    candidate_id: str | None,
    candidate_path: Path | None,
) -> tuple[Path, Path]:
    if (candidate_id is None) == (candidate_path is None):
        raise PipelineError(
            "CANDIDATE_SELECTION_REQUIRED",
            "Finalize requires exactly one of candidate_id or candidate_path",
        )
    root = (draft_dir / "claim-candidates").resolve()
    if candidate_id is not None:
        if not re.fullmatch(r"candidate\.[a-f0-9]{64}", candidate_id):
            raise PipelineError("CANDIDATE_SELECTION_INVALID", "candidate_id is invalid")
        candidate_dir = (root / candidate_id).resolve()
        path = candidate_dir / "claim-candidate.yaml"
    else:
        path = candidate_path.resolve()  # type: ignore[union-attr]
        candidate_dir = path.parent
    try:
        candidate_dir.relative_to(root)
    except ValueError as exc:
        raise PipelineError("CANDIDATE_SELECTION_INVALID", "Candidate path is outside the Draft") from exc
    if path.name != "claim-candidate.yaml" or candidate_dir.parent != root:
        raise PipelineError("CANDIDATE_SELECTION_INVALID", "Candidate path does not follow the immutable layout")
    if not os.path.isfile(_native_path(path)):
        raise PipelineError("CANDIDATE_SELECTION_INVALID", f"Candidate does not exist: {path}")
    return candidate_dir, path


def _receipt_hash_matches(
    receipt: Mapping[str, Any], role: str, algorithm: str, value: str
) -> bool:
    stored = receipt.get("related_artifact_hashes", {}).get(role, {})
    return stored.get("algorithm") == algorithm and stored.get("value") == value


def _verify_candidate_for_finalize(
    project_root: Path,
    draft_dir: Path,
    *,
    candidate_id: str | None,
    candidate_path: Path | None,
) -> VerifiedCandidate:
    candidate_dir, path = _resolve_candidate_path(
        draft_dir, candidate_id=candidate_id, candidate_path=candidate_path
    )
    wrapper_payload = _read_bytes(path)
    wrapper = _load_yaml(path)
    _validate_candidate_schema(project_root, wrapper)
    _validate_canonical_schema(project_root, wrapper["canonical_assertion"])
    if candidate_id is not None and wrapper["candidate_id"] != candidate_id:
        raise PipelineError("CANDIDATE_SELECTION_INVALID", "Selected candidate_id does not match Wrapper")
    if candidate_dir.name != wrapper["candidate_id"]:
        raise PipelineError("CANDIDATE_SELECTION_INVALID", "Candidate directory does not match Wrapper ID")

    draft, report = _load_and_verify_draft(project_root, draft_dir)
    resolution = _load_yaml(draft_dir / "human-resolution.yaml")
    _validate_resolution(project_root, resolution)
    if semantic_hash(draft["draft_input_identity"]) != draft["draft_input_identity_hash"]:
        raise PipelineError("DRAFT_TAMPERED", "Draft identity hash no longer matches")
    if (
        wrapper["source_draft_id"] != draft["draft_id"]
        or wrapper["source_draft_identity_hash"] != draft["draft_input_identity_hash"]
    ):
        raise PipelineError("DRAFT_TAMPERED", "Candidate does not bind the current Draft")
    if (
        resolution.get("source_draft_id") != draft["draft_id"]
        or resolution.get("source_draft_identity_hash") != draft["draft_input_identity_hash"]
    ):
        raise PipelineError("HUMAN_RESOLUTION_CHANGED", "Human Resolution does not bind the current Draft")
    resolution_hash = human_resolution_hash(resolution)
    if wrapper["human_resolution_hash"] != resolution_hash:
        raise PipelineError("HUMAN_RESOLUTION_CHANGED", "Human Resolution content changed after Candidate generation")
    if (
        draft.get("generator_version") != GENERATOR_VERSION
        or report.get("generator", {}).get("generator_version") != GENERATOR_VERSION
        or wrapper["generator_version"] != GENERATOR_VERSION
    ):
        raise PipelineError("CANDIDATE_TAMPERED", "Generator version binding mismatch")

    expected_id, expected_projection_hash, _projection = _candidate_identity(draft, resolution_hash)
    expected_metadata = {
        "candidate_id": expected_id,
        "candidate_id_projection_version": CANDIDATE_ID_PROJECTION_VERSION,
        "candidate_id_projection_hash": expected_projection_hash,
        "candidate_schema_version": CANDIDATE_SCHEMA_VERSION,
        "generator_version": GENERATOR_VERSION,
    }
    if any(wrapper.get(key) != value for key, value in expected_metadata.items()):
        raise PipelineError("CANDIDATE_TAMPERED", "Candidate identity metadata is inconsistent")

    compatibility = check_registry_compatibility(project_root, draft_dir)
    if compatibility.classification == "incompatible":
        raise PipelineError("DRAFT_REGISTRY_INCOMPATIBLE", "Current Registry is incompatible with the Candidate Draft")

    canonical_payload = canonical_assertion_bytes(wrapper["canonical_assertion"])
    binding = _candidate_hash_binding(project_root, wrapper, wrapper_payload, canonical_payload)
    receipt_paths = _json_files(candidate_dir / "generation-receipts")
    receipts: list[dict[str, Any]] = []
    for receipt_path in receipt_paths:
        receipt = _load_json(receipt_path)
        if (
            receipt.get("receipt_type") == "candidate_generation"
            and receipt.get("result") == "succeeded"
            and receipt.get("related_artifact_ids", {}).get("claim_candidate") == wrapper["candidate_id"]
        ):
            validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
            receipts.append(receipt)
    if not receipts:
        raise PipelineError("CANDIDATE_RECEIPT_NOT_FOUND", "No successful Candidate Generation Receipt was found")

    actual_draft_hash = _artifact_hash(
        "normalized_text_file_sha256_v1",
        draft,
        _read_bytes(draft_dir / "pre-schema-draft.yaml"),
    )["value"]
    mismatch_codes: set[str] = set()
    for receipt in receipts:
        identity = receipt.get("payload", {}).get("candidate_identity", {})
        identity_expected = {**expected_metadata, **binding, "status": "available"}
        if identity != identity_expected:
            if identity.get("canonical_assertion_artifact_hash_v1") != binding["canonical_assertion_artifact_hash_v1"]:
                mismatch_codes.add("CANONICAL_ASSERTION_HASH_MISMATCH")
            else:
                mismatch_codes.add("CANDIDATE_TAMPERED")
            continue
        if not _receipt_hash_matches(
            receipt,
            "canonical_assertion",
            "normalized_text_file_sha256_v1",
            binding["canonical_assertion_artifact_hash_v1"],
        ):
            mismatch_codes.add("CANONICAL_ASSERTION_HASH_MISMATCH")
            continue
        if not _receipt_hash_matches(
            receipt,
            "claim_candidate",
            "normalized_text_file_sha256_v1",
            binding["candidate_wrapper_artifact_hash_v1"],
        ):
            mismatch_codes.add("CANDIDATE_TAMPERED")
            continue
        if not _receipt_hash_matches(
            receipt, "pre_schema_draft", "normalized_text_file_sha256_v1", actual_draft_hash
        ):
            mismatch_codes.add("DRAFT_TAMPERED")
            continue
        if not _receipt_hash_matches(
            receipt, "human_resolution", "jcs_sha256_v1", resolution_hash
        ):
            mismatch_codes.add("HUMAN_RESOLUTION_CHANGED")
            continue
        return VerifiedCandidate(
            candidate_dir,
            wrapper,
            wrapper_payload,
            canonical_payload,
            binding,
            draft,
            resolution,
            receipt,
        )
    for code in (
        "CANONICAL_ASSERTION_HASH_MISMATCH",
        "HUMAN_RESOLUTION_CHANGED",
        "DRAFT_TAMPERED",
        "CANDIDATE_TAMPERED",
    ):
        if code in mismatch_codes:
            raise PipelineError(code, "Candidate Generation Receipt hash binding mismatch")
    raise PipelineError("CANDIDATE_TAMPERED", "Candidate Generation Receipt binding mismatch")


def _finalize_receipt(
    wrapper: Mapping[str, Any],
    destination: Path,
    result: str,
    steps: Mapping[str, Mapping[str, str]],
    diagnostics: Sequence[Mapping[str, str]],
    *,
    hash_binding: Mapping[str, str],
    canonical_payload: bytes,
    receipt_id: str | None = None,
    wrapper_payload: bytes | None = None,
) -> dict[str, Any]:
    canonical = wrapper["canonical_assertion"]
    identity = {
        "status": "available",
        "candidate_id": wrapper["candidate_id"],
        "candidate_id_projection_version": wrapper["candidate_id_projection_version"],
        "candidate_id_projection_hash": wrapper["candidate_id_projection_hash"],
        "candidate_schema_version": wrapper["candidate_schema_version"],
        "generator_version": wrapper["generator_version"],
        **hash_binding,
    }
    payload: dict[str, Any] = {
        "lock_acquisition": steps["lock_acquisition"],
        "snapshot_validation": steps["snapshot_validation"],
        "integration_validation": steps["integration_validation"],
        "install": steps["install"],
        "postcondition_validation": steps["postcondition_validation"],
        "candidate_identity": identity,
        "destination_path": destination.as_posix(),
        "diagnostics": list(diagnostics),
    }
    if result == "failed":
        error_code = str(diagnostics[0].get("code", "FINALIZE_FAILED")) if diagnostics else "FINALIZE_FAILED"
        payload["failed_step"] = next(
            (
                name
                for name, step in steps.items()
                if step.get("step_status") == "failed"
            ),
            "finalize_transaction",
        )
        payload["error_code"] = error_code
    return {
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "receipt_id": receipt_id or uuid7_text(),
        "receipt_type": "finalize_attempt",
        "recorded_at": utc_now_text(),
        "result": result,
        "related_artifact_ids": {
            "claim_candidate": wrapper["candidate_id"],
            "canonical_assertion": canonical["assertions"][0]["assertion_id"],
        },
        "related_artifact_hashes": {
            "claim_candidate": _artifact_hash(
                "normalized_text_file_sha256_v1", wrapper, wrapper_payload or yaml_bytes(wrapper)
            ),
            "canonical_assertion": _artifact_hash(
                "normalized_text_file_sha256_v1", canonical, canonical_payload
            ),
        },
        "payload": payload,
    }


def _preflight_finalize_receipt(
    candidate_id: str | None,
    error: PipelineError,
) -> dict[str, Any]:
    failed_steps = {
        "CANDIDATE_SCHEMA_INVALID": "candidate_schema_validation",
        "CANDIDATE_RECEIPT_NOT_FOUND": "candidate_receipt_binding",
        "CANDIDATE_TAMPERED": "candidate_receipt_binding",
        "CANONICAL_ASSERTION_HASH_MISMATCH": "candidate_receipt_binding",
        "DRAFT_TAMPERED": "draft_artifact_verification",
        "HUMAN_RESOLUTION_CHANGED": "human_resolution_validation",
        "DRAFT_REGISTRY_INCOMPATIBLE": "registry_compatibility_check",
    }
    steps = {
        name: _receipt_step("not_started", "NOT_STARTED")
        for name in (
            "lock_acquisition",
            "snapshot_validation",
            "integration_validation",
            "install",
            "postcondition_validation",
        )
    }
    artifact_ids: dict[str, str] = {}
    if candidate_id and re.fullmatch(r"candidate\.[a-f0-9]{64}", candidate_id):
        artifact_ids["claim_candidate"] = candidate_id
    return {
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "receipt_id": uuid7_text(),
        "receipt_type": "finalize_attempt",
        "recorded_at": utc_now_text(),
        "result": "failed",
        "related_artifact_ids": artifact_ids,
        "related_artifact_hashes": {},
        "payload": {
            **steps,
            "candidate_identity": {
                "status": "not_available",
                "reason_code": error.code,
            },
            "destination_path": "not_available",
            "failed_step": failed_steps.get(error.code, "candidate_identity_validation"),
            "error_code": error.code,
            "diagnostics": [error.diagnostic()],
        },
    }


def _preflight_receipt_directory(
    draft_dir: Path,
    candidate_id: str | None,
    candidate_path: Path | None,
) -> Path:
    if candidate_id and re.fullmatch(r"candidate\.[a-f0-9]{64}", candidate_id):
        return draft_dir / "claim-candidates" / candidate_id / "generation-receipts"
    if candidate_path is not None:
        candidate_dir = candidate_path.resolve().parent
        try:
            candidate_dir.relative_to((draft_dir / "claim-candidates").resolve())
        except ValueError:
            return draft_dir / "generation-receipts"
        return candidate_dir / "generation-receipts"
    return draft_dir / "generation-receipts"


def _rollback_receipt(
    wrapper: Mapping[str, Any],
    finalize_receipt_id: str,
    cause_code: str,
    destination: Path,
    pre_snapshot: str,
    post_snapshot: str | None,
    result: str,
    diagnostics: Sequence[Mapping[str, str]],
    *,
    hash_binding: Mapping[str, str],
    wrapper_payload: bytes,
    canonical_payload: bytes,
) -> dict[str, Any]:
    identity = {
        "status": "available",
        "candidate_id": wrapper["candidate_id"],
        "candidate_id_projection_version": wrapper["candidate_id_projection_version"],
        "candidate_id_projection_hash": wrapper["candidate_id_projection_hash"],
        "candidate_schema_version": wrapper["candidate_schema_version"],
        "generator_version": wrapper["generator_version"],
        **hash_binding,
    }
    return {
        "receipt_schema_version": RECEIPT_SCHEMA_VERSION,
        "receipt_id": uuid7_text(),
        "receipt_type": "rollback",
        "recorded_at": utc_now_text(),
        "result": result,
        "related_artifact_ids": {
            "claim_candidate": wrapper["candidate_id"],
            "canonical_assertion": wrapper["canonical_assertion"]["assertions"][0]["assertion_id"],
        },
        "related_artifact_hashes": {
            "claim_candidate": _artifact_hash(
                "normalized_text_file_sha256_v1", wrapper, wrapper_payload
            ),
            "canonical_assertion": _artifact_hash(
                "normalized_text_file_sha256_v1",
                wrapper["canonical_assertion"],
                canonical_payload,
            ),
        },
        "payload": {
            "related_finalize_receipt_id": finalize_receipt_id,
            "rollback_execution": _receipt_step(
                "succeeded" if result == "succeeded" else "failed",
                "SUCCEEDED" if result == "succeeded" else "ROLLBACK_FAILED",
            ),
            "cause_code": cause_code,
            "candidate_identity": identity,
            "staged_paths": [destination.as_posix()],
            "created_paths": [destination.as_posix()],
            "pre_snapshot": {
                "step_status": "succeeded",
                "result_code": "SUCCEEDED",
                "content_hash": pre_snapshot,
            },
            "post_snapshot": {
                "step_status": "succeeded" if post_snapshot else "failed",
                "result_code": "SUCCEEDED" if post_snapshot else "ROLLBACK_FAILED",
                "content_hash": post_snapshot or "not_available",
            },
            "diagnostics": list(diagnostics),
        },
    }


def finalize_candidate(
    project_root: Path,
    draft_dir: Path,
    *,
    candidate_id: str | None = None,
    candidate_path: Path | None = None,
    explicit_finalize: bool,
) -> FinalizeResult:
    if not explicit_finalize:
        raise PipelineError("EXPLICIT_FINALIZE_REQUIRED", "Finalize requires an explicit human action")
    project_root = project_root.resolve()
    draft_dir = draft_dir.resolve()
    try:
        verified = _verify_candidate_for_finalize(
            project_root,
            draft_dir,
            candidate_id=candidate_id,
            candidate_path=candidate_path,
        )
    except PipelineError as error:
        receipt = _preflight_finalize_receipt(candidate_id, error)
        validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
        receipt_dir = _preflight_receipt_directory(
            draft_dir, candidate_id, candidate_path
        )
        _write_create_or_same(
            receipt_dir / f"{receipt['receipt_id']}.json",
            json_bytes(receipt),
            "DRAFT_ID_COLLISION",
        )
        raise
    wrapper = verified.wrapper
    canonical = wrapper["canonical_assertion"]
    canonical_payload = verified.canonical_payload
    _integrated_validate(project_root, canonical, canonical_payload)
    destination = project_root / "knowledge" / "assertions" / f"{canonical['assertion_file_id']}.yaml"
    logical_destination = destination.relative_to(project_root)
    lock_path = project_root / "knowledge" / ".claim-finalize.lock"
    steps: dict[str, dict[str, str]] = {
        "lock_acquisition": _receipt_step("not_started", "NOT_STARTED"),
        "snapshot_validation": _receipt_step("not_started", "NOT_STARTED"),
        "integration_validation": _receipt_step("not_started", "NOT_STARTED"),
        "install": _receipt_step("not_started", "NOT_STARTED"),
        "postcondition_validation": _receipt_step("not_started", "NOT_STARTED"),
    }
    rollback_info: tuple[str, str, str | None, str, list[dict[str, str]]] | None = None
    wrapper_payload = verified.wrapper_payload
    receipt_dir = verified.candidate_dir / "generation-receipts"
    try:
        with _KnowledgeLock(lock_path):
            steps["lock_acquisition"] = _receipt_step("succeeded", "SUCCEEDED")
            before = canonical_knowledge_snapshot(project_root)
            steps["snapshot_validation"] = _receipt_step("succeeded", "SUCCEEDED")
            _integrated_validate(project_root, canonical, canonical_payload)
            steps["integration_validation"] = _receipt_step("succeeded", "SUCCEEDED")
            current = canonical_knowledge_snapshot(project_root)
            if current != before:
                _integrated_validate(project_root, canonical, canonical_payload)
                after_revalidation = canonical_knowledge_snapshot(project_root)
                if after_revalidation != current:
                    raise PipelineError("CANONICAL_SNAPSHOT_CHANGED", "Canonical Knowledge changed during Finalize")
                before = current
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(f".{destination.name}.{uuid7_text()}.tmp")
            temporary.write_bytes(canonical_payload)
            try:
                os.link(temporary, destination)
            except FileExistsError as exc:
                raise PipelineError("CANONICAL_DESTINATION_EXISTS", f"Destination already exists: {destination}") from exc
            finally:
                temporary.unlink(missing_ok=True)
            steps["install"] = _receipt_step("succeeded", "SUCCEEDED")
            try:
                command = [
                    sys.executable,
                    str(project_root / "scripts" / "validate_research_claims.py"),
                    "--root", str(project_root),
                    "--validation-context", "current_state",
                    "--format", "json",
                ]
                completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", check=False)
                _require_successful_validator_result(completed, "POST_VALIDATION_FAILED")
            except BaseException as post_error:
                cause_code = post_error.code if isinstance(post_error, PipelineError) else "POST_VALIDATION_FAILED"
                try:
                    destination.unlink()
                    post_snapshot = canonical_knowledge_snapshot(project_root)
                    rollback_info = (cause_code, before, post_snapshot, "succeeded", [])
                except OSError as rollback_error:
                    rollback_info = (
                        cause_code,
                        before,
                        None,
                        "failed",
                        [PipelineError("ROLLBACK_FAILED", str(rollback_error)).diagnostic()],
                    )
                    raise PipelineError("ROLLBACK_FAILED", f"Rollback failed: {rollback_error}") from rollback_error
                raise
            steps["postcondition_validation"] = _receipt_step("succeeded", "SUCCEEDED")
    except PipelineError as error:
        finalize_receipt_id = uuid7_text()
        receipt = _finalize_receipt(
            wrapper,
            logical_destination,
            "failed",
            steps,
            [error.diagnostic()],
            hash_binding=verified.hash_binding,
            canonical_payload=canonical_payload,
            receipt_id=finalize_receipt_id,
            wrapper_payload=wrapper_payload,
        )
        validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
        _write_create_or_same(
            receipt_dir / f"{receipt['receipt_id']}.json",
            json_bytes(receipt),
            "DRAFT_ID_COLLISION",
        )
        if rollback_info is not None:
            cause_code, pre_snapshot, post_snapshot, rollback_result, rollback_diagnostics = rollback_info
            rollback_receipt = _rollback_receipt(
                wrapper,
                finalize_receipt_id,
                cause_code,
                logical_destination,
                pre_snapshot,
                post_snapshot,
                rollback_result,
                rollback_diagnostics,
                hash_binding=verified.hash_binding,
                wrapper_payload=wrapper_payload,
                canonical_payload=canonical_payload,
            )
            validate_artifact(project_root, "observation-to-claim-receipt.schema.json", rollback_receipt)
            _write_create_or_same(
                receipt_dir / f"{rollback_receipt['receipt_id']}.json",
                json_bytes(rollback_receipt),
                "DRAFT_ID_COLLISION",
            )
        raise
    receipt = _finalize_receipt(
        wrapper,
        logical_destination,
        "succeeded",
        steps,
        [],
        hash_binding=verified.hash_binding,
        canonical_payload=canonical_payload,
        wrapper_payload=wrapper_payload,
    )
    validate_artifact(project_root, "observation-to-claim-receipt.schema.json", receipt)
    _write_create_or_same(
        receipt_dir / f"{receipt['receipt_id']}.json",
        json_bytes(receipt),
        "DRAFT_ID_COLLISION",
    )
    return FinalizeResult(destination, receipt)
