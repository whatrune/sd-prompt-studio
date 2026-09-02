#!/usr/bin/env python3
"""Register one finalized Research Run and regenerate the Explorer read model."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence

import yaml

from finalize_observation import compute_aggregate, rubric_errors, schema_errors
from research_explorer import build_research_index, validate_index
from validate_research_claims import UniqueKeyLoader


SAFE_SEGMENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
LEDGER_FIELDS = frozenset({"run_id", "domain", "title", "status", "updated_at", "path"})
PROMPT_BLIND_OWNER_FIELDS = frozenset(
    {"record_type", "owner_path", "serialization", "freeze", "mapping", "observer_input"}
)


class RunRegistrationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        value = yaml.load(path.read_text(encoding="utf-8-sig"), Loader=UniqueKeyLoader)
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
        raise RunRegistrationError("RUN_MANIFEST_INVALID", f"Cannot read YAML: {path}") from exc
    if not isinstance(value, dict):
        raise RunRegistrationError("RUN_MANIFEST_INVALID", f"YAML root must be an object: {path}")
    return value


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RunRegistrationError("OBSERVATION_INVALID", f"Cannot read Observation JSON: {path}") from exc
    if not isinstance(value, dict):
        raise RunRegistrationError("OBSERVATION_INVALID", "Observation root must be an object")
    return value


def _sha256_utf8(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _repository_relative_path(project_root: Path, path: Path) -> str:
    resolved_root = project_root.resolve(strict=True)
    resolved_path = path.resolve(strict=True)
    parts = resolved_root.parts
    for index in range(len(parts) - 1):
        if parts[index : index + 2] == ("research", "sd-prompt-research"):
            repository_root = Path(*parts[:index])
            return resolved_path.relative_to(repository_root).as_posix()
    return resolved_path.relative_to(resolved_root).as_posix()


def _metadata_path_for_manifest(
    run_dir: Path, manifest: Mapping[str, Any], *, required: bool = True
) -> Path | None:
    source = manifest.get("source")
    metadata_file = source.get("metadata_file") if isinstance(source, Mapping) else None
    if metadata_file is None:
        return None
    if not isinstance(metadata_file, str) or not metadata_file:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Manifest metadata_file must be a non-empty path"
        )
    relative = PurePosixPath(metadata_file.replace("\\", "/"))
    if relative.is_absolute() or ".." in relative.parts:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Metadata path must remain inside its Run directory"
        )
    candidate = run_dir.joinpath(*relative.parts)
    if not candidate.exists() and not required:
        return None
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(run_dir.resolve(strict=True))
    except (FileNotFoundError, ValueError) as exc:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Tracked metadata path is missing or escapes its Run"
        ) from exc
    if candidate.is_symlink() or not resolved.is_file():
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Tracked metadata must be a regular non-symlink file"
        )
    return resolved


def _prompt_blind_metadata(
    project_root: Path, domain: str, run_id: str
) -> tuple[Path, dict[str, Any]]:
    if not SAFE_SEGMENT_RE.fullmatch(run_id):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", f"Unsafe matched Run ID: {run_id}"
        )
    run_dir, _relative, actual_domain, actual_run_id = _canonical_run_path(
        project_root, project_root / "experiments" / domain / run_id
    )
    manifest = _load_yaml(run_dir / "manifest.yaml")
    if manifest.get("run_id") != actual_run_id or manifest.get("domain") != actual_domain:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Matched Run manifest identity is invalid"
        )
    metadata_path = _metadata_path_for_manifest(run_dir, manifest)
    if metadata_path is None:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", f"Matched Run has no tracked metadata: {run_id}"
        )
    return metadata_path, _load_yaml(metadata_path)


def _prompt_blind_group_ids(metadata: Mapping[str, Any]) -> tuple[str, ...]:
    contract = metadata.get("matched_seed_contract")
    run_ids = contract.get("run_ids") if isinstance(contract, Mapping) else None
    if not isinstance(run_ids, list) or len(run_ids) < 2:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID",
            "Recheckable prompt-blind metadata requires a multi-Run matched_seed_contract",
        )
    if any(not isinstance(run_id, str) or not SAFE_SEGMENT_RE.fullmatch(run_id) for run_id in run_ids):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Matched Run IDs must be safe strings"
        )
    if len(set(run_ids)) != len(run_ids):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Matched Run IDs must be unique"
        )
    return tuple(run_ids)


def _requires_prompt_blind_binding(metadata: Mapping[str, Any]) -> bool:
    binding = metadata.get("provenance_binding")
    return (
        isinstance(binding, Mapping)
        and binding.get("independently_recheckable_from_tracked_metadata") is True
    )


def _validate_payload_record(name: str, value: Any) -> str:
    if not isinstance(value, dict) or set(value) != {"sha256", "utf8_payload"}:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", f"Owner {name} payload shape is invalid"
        )
    digest = value.get("sha256")
    payload = value.get("utf8_payload")
    if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", f"Owner {name} digest is invalid"
        )
    if not isinstance(payload, str) or _sha256_utf8(payload) != digest:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", f"Owner {name} payload digest does not match"
        )
    return digest


def _validated_owner_record(
    project_root: Path,
    owner_metadata_path: Path,
    owner_metadata: Mapping[str, Any],
) -> tuple[dict[str, Any], dict[str, str]]:
    owner = owner_metadata.get("prompt_blind_record_owner")
    if not isinstance(owner, dict):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Exactly one tracked prompt-blind owner is required"
        )
    allowed = set(PROMPT_BLIND_OWNER_FIELDS)
    if set(owner) - allowed or not {"record_type", "owner_path", "serialization", "freeze", "mapping"}.issubset(owner):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Prompt-blind owner record shape is invalid"
        )
    if owner.get("record_type") != "tracked_prompt_blind_record_owner_v1":
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Prompt-blind owner record_type is invalid"
        )
    expected_owner_path = _repository_relative_path(project_root, owner_metadata_path)
    if owner.get("owner_path") != expected_owner_path:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Prompt-blind owner path does not resolve exactly"
        )
    if owner.get("serialization") not in {"exact_utf8", "exact_utf8_lf"}:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Prompt-blind owner serialization is invalid"
        )
    digests = {
        "freeze_sha256": _validate_payload_record("freeze", owner.get("freeze")),
        "mapping_sha256": _validate_payload_record("mapping", owner.get("mapping")),
    }
    if "observer_input" in owner:
        digests["observer_input_sha256"] = _validate_payload_record(
            "observer_input", owner.get("observer_input")
        )
    provenance = owner_metadata.get("provenance_binding")
    if not isinstance(provenance, Mapping):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Owner provenance_binding is missing"
        )
    if ("observer_input_sha256" in provenance) != ("observer_input_sha256" in digests):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID",
            "Owner observer-input payload and provenance hash must be present together",
        )
    expected_provenance = {
        "blind_freeze_sha256": digests["freeze_sha256"],
        "sealed_mapping_sha256": digests["mapping_sha256"],
    }
    if "observer_input_sha256" in digests:
        expected_provenance["observer_input_sha256"] = digests["observer_input_sha256"]
    if any(provenance.get(key) != value for key, value in expected_provenance.items()):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Owner provenance hashes do not match tracked payloads"
        )
    return owner, digests


def _validate_prompt_blind_group(project_root: Path, domain: str, seed_metadata: Mapping[str, Any]) -> None:
    run_ids = _prompt_blind_group_ids(seed_metadata)
    group: list[tuple[str, Path, dict[str, Any]]] = []
    for run_id in run_ids:
        metadata_path, metadata = _prompt_blind_metadata(project_root, domain, run_id)
        if _prompt_blind_group_ids(metadata) != run_ids:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID", "Matched Runs do not declare the same ordered Run set"
            )
        if not _requires_prompt_blind_binding(metadata):
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID", "Every matched Run must claim tracked recheckability"
            )
        group.append((run_id, metadata_path, metadata))

    owners = [item for item in group if "prompt_blind_record_owner" in item[2]]
    if len(owners) != 1:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Exactly one tracked prompt-blind owner is required"
        )
    owner_run_id, owner_path, owner_metadata = owners[0]
    if "prompt_blind_record_reference" in owner_metadata:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Owner Run must not contain a dependent reference"
        )
    owner, digests = _validated_owner_record(project_root, owner_path, owner_metadata)
    expected_reference = {"owner_path": owner["owner_path"], **digests}
    for run_id, _metadata_path, metadata in group:
        if run_id == owner_run_id:
            continue
        if "prompt_blind_record_owner" in metadata:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID", "Dependent Run must not contain an owner record"
            )
        reference = metadata.get("prompt_blind_record_reference")
        if not isinstance(reference, dict) or reference != expected_reference:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID",
                f"Dependent Run does not bind the exact tracked owner: {run_id}",
            )
        provenance = metadata.get("provenance_binding")
        expected_provenance = {
            "blind_freeze_sha256": digests["freeze_sha256"],
            "sealed_mapping_sha256": digests["mapping_sha256"],
        }
        if "observer_input_sha256" in digests:
            expected_provenance["observer_input_sha256"] = digests["observer_input_sha256"]
        if not isinstance(provenance, Mapping) or any(
            provenance.get(key) != value for key, value in expected_provenance.items()
        ):
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID",
                f"Dependent provenance hashes do not match the tracked owner: {run_id}",
            )


def _validate_prompt_blind_groups(project_root: Path, validated_runs: Sequence[Mapping[str, Any]]) -> None:
    validated_groups: set[tuple[str, tuple[str, ...]]] = set()
    for run in validated_runs:
        manifest = run["manifest"]
        metadata_path = _metadata_path_for_manifest(
            run["canonical_dir"], manifest, required=False
        )
        if metadata_path is None:
            continue
        metadata = _load_yaml(metadata_path)
        if not _requires_prompt_blind_binding(metadata):
            continue
        run_ids = _prompt_blind_group_ids(metadata)
        if run["run_id"] not in run_ids:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID",
                f"Validated Run is absent from its declared matched Run set: {run['run_id']}",
            )
        identity = (run["domain"], run_ids)
        if identity not in validated_groups:
            _validate_prompt_blind_group(project_root, run["domain"], metadata)
            validated_groups.add(identity)


def _canonical_run_path(project_root: Path, run_dir: Path) -> tuple[Path, str, str, str]:
    root = project_root.resolve(strict=True)
    requested = run_dir.expanduser()
    if not requested.is_absolute():
        requested = root / requested
    if requested.is_symlink():
        raise RunRegistrationError("RUN_PATH_INVALID", "Run directory must not be a symlink")
    try:
        resolved = requested.resolve(strict=True)
        relative = resolved.relative_to(root)
    except (FileNotFoundError, ValueError) as exc:
        raise RunRegistrationError(
            "RUN_PATH_INVALID", "Run directory must exist below Research Project Root"
        ) from exc
    parts = relative.parts
    if len(parts) != 3 or parts[0] != "experiments":
        raise RunRegistrationError(
            "RUN_PATH_INVALID", "Run directory must be experiments/<domain>/<run-id>"
        )
    domain, run_id = parts[1], parts[2]
    if not SAFE_SEGMENT_RE.fullmatch(domain) or not SAFE_SEGMENT_RE.fullmatch(run_id):
        raise RunRegistrationError("RUN_PATH_INVALID", "Domain and Run ID must be safe path segments")
    return resolved, relative.as_posix(), domain, run_id


def _validate_bundle(
    project_root: Path,
    run_dir: Path,
    domain: str,
    run_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    manifest_path = run_dir / "manifest.yaml"
    observation_path = run_dir / "observation.json"
    rubric_path = run_dir / "source" / "rubric.yaml"
    for path in (manifest_path, observation_path, rubric_path):
        if not path.is_file() or path.is_symlink():
            raise RunRegistrationError("RUN_ARTIFACT_MISSING", f"Required Artifact is missing: {path.name}")

    manifest = _load_yaml(manifest_path)
    observation = _load_json(observation_path)
    rubric = _load_yaml(rubric_path)
    if manifest.get("run_id") != run_id or manifest.get("domain") != domain:
        raise RunRegistrationError(
            "RUN_MANIFEST_INVALID", "Manifest run_id/domain must match its canonical directory"
        )
    if manifest.get("status") != "OBSERVED":
        raise RunRegistrationError(
            "RUN_NOT_OBSERVED", "Run must be finalized as OBSERVED before registration"
        )
    if observation.get("run_id") != run_id:
        raise RunRegistrationError(
            "OBSERVATION_RUN_MISMATCH", "Observation run_id must match manifest run_id"
        )
    outputs = manifest.get("outputs")
    if not isinstance(outputs, Mapping) or any(
        outputs.get(field) != "observation.json"
        for field in ("observation_json", "canonical_observation")
    ):
        raise RunRegistrationError(
            "RUN_MANIFEST_INVALID", "Manifest must identify observation.json as the canonical Observation"
        )

    try:
        schema = json.loads((project_root / "templates" / "observation-schema.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RunRegistrationError("OBSERVATION_SCHEMA_UNAVAILABLE", "Observation Schema is unavailable") from exc

    without_aggregate = copy.deepcopy(observation)
    stored_aggregate = without_aggregate.pop("computed_aggregate", None)
    errors = schema_errors(observation, schema)
    rubric_error_list, _warnings = rubric_errors(without_aggregate, rubric)
    errors.extend(rubric_error_list)
    if errors:
        raise RunRegistrationError("OBSERVATION_INVALID", "; ".join(errors))
    if stored_aggregate != compute_aggregate(without_aggregate):
        raise RunRegistrationError(
            "OBSERVATION_AGGREGATE_MISMATCH",
            "computed_aggregate must match the stored Observation panels",
        )
    return manifest, observation


def _run_summary(manifest: Mapping[str, Any]) -> dict[str, Any]:
    run_id = manifest.get("run_id")
    domain = manifest.get("domain")
    summary = {
        "run_id": run_id,
        "domain": domain,
        "title": manifest.get("title"),
        "status": manifest.get("status"),
        "updated_at": manifest.get("updated_at"),
        "path": f"experiments/{domain}/{run_id}",
    }
    if not _valid_ledger_entry(summary):
        raise RunRegistrationError(
            "RUN_MANIFEST_INVALID", "Manifest cannot project an exact Run Ledger entry"
        )
    return summary


def _valid_ledger_entry(entry: Any) -> bool:
    if not isinstance(entry, dict) or set(entry) != LEDGER_FIELDS:
        return False
    run_id = entry.get("run_id")
    domain = entry.get("domain")
    return (
        isinstance(run_id, str)
        and SAFE_SEGMENT_RE.fullmatch(run_id) is not None
        and isinstance(domain, str)
        and SAFE_SEGMENT_RE.fullmatch(domain) is not None
        and all(
            isinstance(entry.get(field), str) and len(entry[field]) > 0
            for field in ("title", "status", "updated_at")
        )
        and entry.get("path") == f"experiments/{domain}/{run_id}"
    )


def _load_ledger_strict(path: Path) -> tuple[dict[str, Any], bytes]:
    try:
        payload = path.read_bytes()
        value = yaml.load(payload.decode("utf-8-sig"), Loader=UniqueKeyLoader)
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
        raise RunRegistrationError("RUN_LEDGER_INVALID", "Run Ledger cannot be read strictly") from exc
    if not isinstance(value, dict) or set(value) != {"schema_version", "runs"}:
        raise RunRegistrationError("RUN_LEDGER_INVALID", "Run Ledger root shape is invalid")
    if value.get("schema_version") != "1.0" or not isinstance(value.get("runs"), list):
        raise RunRegistrationError("RUN_LEDGER_INVALID", "Run Ledger schema or runs collection is invalid")
    run_ids: set[str] = set()
    for entry in value["runs"]:
        if not _valid_ledger_entry(entry):
            raise RunRegistrationError("RUN_LEDGER_INVALID", "Run Ledger entry shape is invalid")
        run_id = entry["run_id"]
        if run_id in run_ids:
            raise RunRegistrationError("RUN_LEDGER_DUPLICATE_ID", f"Duplicate Run ID: {run_id}")
        run_ids.add(run_id)
    return value, payload


def _ledger_digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _validated_runs(
    project_root: Path,
    run_dirs: list[Path],
    *,
    validate_prompt_blind: bool = True,
) -> list[dict[str, Any]]:
    if not run_dirs:
        raise RunRegistrationError("RUN_SET_INVALID", "At least one Run directory is required")
    validated: list[dict[str, Any]] = []
    run_ids: set[str] = set()
    for run_dir in run_dirs:
        canonical_dir, relative_run, domain, run_id = _canonical_run_path(project_root, run_dir)
        manifest, _observation = _validate_bundle(project_root, canonical_dir, domain, run_id)
        if run_id in run_ids:
            raise RunRegistrationError("RUN_INPUT_DUPLICATE_ID", f"Duplicate supplied Run ID: {run_id}")
        run_ids.add(run_id)
        validated.append(
            {
                "canonical_dir": canonical_dir,
                "relative_run": relative_run,
                "domain": domain,
                "run_id": run_id,
                "manifest": manifest,
                "summary": _run_summary(manifest),
            }
        )
    sorted_runs = sorted(validated, key=lambda item: item["run_id"])
    if validate_prompt_blind:
        _validate_prompt_blind_groups(project_root, sorted_runs)
    return sorted_runs


def _load_owner_record(path: Path) -> dict[str, Any]:
    try:
        resolved = path.expanduser().resolve(strict=True)
    except OSError as exc:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Prompt-blind owner record cannot be resolved"
        ) from exc
    value = _load_yaml(resolved)
    if set(value) == {"prompt_blind_record_owner"}:
        value = value["prompt_blind_record_owner"]
    if not isinstance(value, dict):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Owner record input must be a YAML object"
        )
    return value


def _append_yaml_field(payload: bytes, field: str, value: Mapping[str, Any]) -> bytes:
    try:
        payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Tracked metadata must be UTF-8"
        ) from exc
    prefix = payload
    if prefix.startswith(b"\xef\xbb\xbf"):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Tracked metadata must be UTF-8 without BOM"
        )
    if prefix and not prefix.endswith(b"\n"):
        prefix += b"\n"
    rendered = yaml.safe_dump(
        {field: dict(value)}, allow_unicode=True, sort_keys=False, line_break="\n"
    ).encode("utf-8")
    return prefix + rendered


def _require_metadata_fresh(path: Path, expected: bytes) -> None:
    try:
        current = path.read_bytes()
    except OSError as exc:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_STALE", f"Tracked metadata cannot be refetched: {path.name}"
        ) from exc
    if current != expected:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_STALE", f"Tracked metadata changed before binding: {path.name}"
        )


def bind_prompt_blind_provenance(
    project_root: Path,
    run_dirs: list[Path],
    *,
    owner_run_id: str,
    owner_record_path: Path,
) -> dict[str, Any]:
    root = project_root.expanduser().resolve(strict=True)
    validated_runs = _validated_runs(root, run_dirs, validate_prompt_blind=False)
    supplied_ids = tuple(run["run_id"] for run in validated_runs)
    if owner_run_id not in supplied_ids:
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Owner Run must be included in the exact supplied Run set"
        )
    domain = validated_runs[0]["domain"]
    if any(run["domain"] != domain for run in validated_runs):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Prompt-blind matched Runs must share one domain"
        )

    metadata_by_run: dict[str, tuple[Path, dict[str, Any]]] = {}
    declared_run_ids: tuple[str, ...] | None = None
    for run in validated_runs:
        metadata_path = _metadata_path_for_manifest(run["canonical_dir"], run["manifest"])
        if metadata_path is None:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID", f"Tracked metadata is required: {run['run_id']}"
            )
        metadata = _load_yaml(metadata_path)
        if not _requires_prompt_blind_binding(metadata):
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID",
                f"Tracked recheckability must be declared before binding: {run['run_id']}",
            )
        current_run_ids = _prompt_blind_group_ids(metadata)
        if declared_run_ids is None:
            declared_run_ids = current_run_ids
        elif current_run_ids != declared_run_ids:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID", "Matched Runs do not declare one ordered Run set"
            )
        metadata_by_run[run["run_id"]] = (metadata_path, metadata)
    if set(supplied_ids) != set(declared_run_ids or ()):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Authoring requires the complete declared matched Run set"
        )

    owner_path, owner_metadata = metadata_by_run[owner_run_id]
    owner_record = _load_owner_record(owner_record_path)
    if owner_record.get("owner_path") != _repository_relative_path(root, owner_path):
        raise RunRegistrationError(
            "PROMPT_BLIND_PROVENANCE_INVALID", "Owner record path does not bind the selected metadata"
        )
    candidate_owner_metadata = dict(owner_metadata)
    candidate_owner_metadata["prompt_blind_record_owner"] = owner_record
    _owner, digests = _validated_owner_record(root, owner_path, candidate_owner_metadata)
    reference = {"owner_path": owner_record["owner_path"], **digests}

    candidates: dict[Path, bytes] = {}
    originals: dict[Path, bytes] = {}
    for run_id, (metadata_path, metadata) in metadata_by_run.items():
        expected_field = (
            "prompt_blind_record_owner" if run_id == owner_run_id else "prompt_blind_record_reference"
        )
        unexpected_field = (
            "prompt_blind_record_reference" if run_id == owner_run_id else "prompt_blind_record_owner"
        )
        if unexpected_field in metadata:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID", f"Conflicting prompt-blind binding: {run_id}"
            )
        expected_value = owner_record if run_id == owner_run_id else reference
        existing = metadata.get(expected_field)
        originals[metadata_path] = metadata_path.read_bytes()
        if existing is None:
            candidates[metadata_path] = _append_yaml_field(
                originals[metadata_path], expected_field, expected_value
            )
        elif existing == expected_value:
            candidates[metadata_path] = originals[metadata_path]
        else:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_INVALID", f"Existing prompt-blind binding conflicts: {run_id}"
            )

    written: list[Path] = []
    temporaries: list[Path] = []
    try:
        for metadata_path in candidates:
            _require_metadata_fresh(metadata_path, originals[metadata_path])
        for metadata_path, candidate in candidates.items():
            if candidate == originals[metadata_path]:
                continue
            temporary = metadata_path.with_name(metadata_path.name + ".prompt-blind.tmp")
            if temporary.exists():
                raise RunRegistrationError(
                    "PROMPT_BLIND_PROVENANCE_WRITE_FAILED",
                    f"Prompt-blind temporary path already exists: {temporary.name}",
                )
            temporary.write_bytes(candidate)
            temporaries.append(temporary)
        for temporary in temporaries:
            destination = temporary.with_name(temporary.name.removesuffix(".prompt-blind.tmp"))
            _require_metadata_fresh(destination, originals[destination])
            temporary.replace(destination)
            written.append(destination)
        seed_metadata = _load_yaml(metadata_by_run[owner_run_id][0])
        _validate_prompt_blind_group(root, domain, seed_metadata)
    except Exception as exc:
        rollback_conflict = False
        for path in written:
            try:
                if path.read_bytes() == candidates[path]:
                    rollback = path.with_name(path.name + ".prompt-blind.rollback.tmp")
                    if rollback.exists():
                        rollback_conflict = True
                        continue
                    rollback.write_bytes(originals[path])
                    rollback.replace(path)
                else:
                    rollback_conflict = True
            except OSError:
                rollback_conflict = True
        for temporary in temporaries:
            if temporary.exists():
                temporary.unlink()
        if rollback_conflict:
            raise RunRegistrationError(
                "PROMPT_BLIND_PROVENANCE_ROLLBACK_CONFLICT",
                "Prompt-blind authoring stopped without overwriting concurrently changed metadata",
            ) from exc
        if isinstance(exc, RunRegistrationError):
            raise
        raise RunRegistrationError("PROMPT_BLIND_PROVENANCE_WRITE_FAILED", str(exc)) from exc

    return {
        "authored": True,
        "owner_run_id": owner_run_id,
        "owner_path": owner_record["owner_path"],
        "run_ids": list(declared_run_ids or ()),
        "changed_metadata_paths": [
            _repository_relative_path(root, path)
            for path in sorted(written, key=lambda item: item.as_posix())
        ],
        "ledger_mutated": False,
    }


def _reconcile_ledger(
    ledger: Mapping[str, Any],
    validated_runs: list[dict[str, Any]],
) -> dict[str, Any]:
    reconciled = copy.deepcopy(ledger)
    entries = reconciled["runs"]
    positions = {entry["run_id"]: index for index, entry in enumerate(entries)}
    for run in validated_runs:
        summary = run["summary"]
        position = positions.get(run["run_id"])
        if position is None:
            positions[run["run_id"]] = len(entries)
            entries.append(copy.deepcopy(summary))
            continue
        existing = entries[position]
        if existing == summary:
            continue
        if (existing["run_id"], existing["domain"], existing["path"]) != (
            summary["run_id"], summary["domain"], summary["path"]
        ):
            raise RunRegistrationError(
                "RUN_LEDGER_IDENTITY_COLLISION",
                f"Run ID has a different canonical identity: {run['run_id']}",
            )
        entries[position] = copy.deepcopy(summary)
    return reconciled


def _serialize_ledger(ledger: Mapping[str, Any]) -> bytes:
    return yaml.safe_dump(
        dict(ledger), allow_unicode=True, sort_keys=False
    ).encode("utf-8")


def _require_registered(
    ledger: Mapping[str, Any], validated_runs: list[dict[str, Any]]
) -> None:
    entries = {entry["run_id"]: entry for entry in ledger["runs"]}
    for run in validated_runs:
        if entries.get(run["run_id"]) != run["summary"]:
            raise RunRegistrationError(
                "RUN_REGISTRATION_MISSING",
                f"Run is not registered exactly: {run['run_id']}",
            )


def _validate_index_for_runs(
    project_root: Path,
    validated_runs: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    index = build_research_index(project_root)
    validate_index(index, project_root / "schemas" / "research-explorer-index.schema.json")
    projected: list[dict[str, Any]] = []
    for run in validated_runs:
        run_source = f"{run['relative_run']}/manifest.yaml"
        observation_source = f"{run['relative_run']}/observation.json"
        run_artifact = next(
            (item for item in index["artifacts"] if item["source_path"] == run_source), None
        )
        observation_artifact = next(
            (item for item in index["artifacts"] if item["source_path"] == observation_source), None
        )
        if run_artifact is None or observation_artifact is None:
            raise RunRegistrationError(
                "INDEX_REGISTRATION_INCOMPLETE", "Derived Index did not discover the Run and Observation"
            )
        relationship = next(
            (
                item
                for item in observation_artifact["relationships"]
                if item.get("relation") == "observation_of"
                and item.get("target_artifact_id") == run_artifact["artifact_id"]
            ),
            None,
        )
        if relationship is None:
            raise RunRegistrationError(
                "INDEX_RELATIONSHIP_MISSING", "Derived Index did not bind Observation to its Run"
            )
        projected.append(
            {
                "run_id": run["run_id"],
                "run_path": run["relative_run"],
                "run_artifact_id": run_artifact["artifact_id"],
                "observation_artifact_id": observation_artifact["artifact_id"],
                "relationship": relationship,
            }
        )
    return index, projected


def _write_index(path: Path, index: Mapping[str, Any]) -> None:
    path = path.expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(
        json.dumps(index, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    temporary.replace(path)


def register_runs(
    project_root: Path,
    run_dirs: list[Path],
    *,
    index_output: Path | None = None,
    check_only: bool = False,
    require_registered: bool = False,
    finalize_ledger: bool = False,
    expected_ledger_sha256: str | None = None,
) -> dict[str, Any]:
    root = project_root.expanduser().resolve(strict=True)
    if check_only == finalize_ledger:
        raise RunRegistrationError(
            "REGISTRATION_MODE_INVALID", "Select exactly one of --check or --finalize-ledger"
        )
    if require_registered and not check_only:
        raise RunRegistrationError(
            "REGISTRATION_MODE_INVALID", "--require-registered requires --check"
        )
    if finalize_ledger and not SHA256_RE.fullmatch(expected_ledger_sha256 or ""):
        raise RunRegistrationError(
            "RUN_LEDGER_DIGEST_INVALID", "A lowercase SHA-256 ledger digest is required"
        )
    if not finalize_ledger and expected_ledger_sha256 is not None:
        raise RunRegistrationError(
            "REGISTRATION_MODE_INVALID", "Ledger digest is only valid for finalization"
        )

    validated_runs = _validated_runs(root, run_dirs)
    ledger_path = root / "ledgers" / "run-index.yaml"
    ledger_before: bytes | None = None
    wrote_ledger = False
    try:
        if finalize_ledger:
            ledger, ledger_before = _load_ledger_strict(ledger_path)
            if _ledger_digest(ledger_before) != expected_ledger_sha256:
                raise RunRegistrationError(
                    "RUN_LEDGER_STALE", "Run Ledger does not match the expected fresh digest"
                )
            reconciled = _reconcile_ledger(ledger, validated_runs)
            candidate = _serialize_ledger(reconciled)
            fresh_before = ledger_path.read_bytes()
            if fresh_before != ledger_before or _ledger_digest(fresh_before) != expected_ledger_sha256:
                raise RunRegistrationError(
                    "RUN_LEDGER_STALE", "Run Ledger changed before the final write"
                )
            if candidate != ledger_before:
                temporary = ledger_path.with_name(ledger_path.name + ".tmp")
                temporary.write_bytes(candidate)
                temporary.replace(ledger_path)
                wrote_ledger = True
                written_ledger, _written_bytes = _load_ledger_strict(ledger_path)
            else:
                written_ledger = ledger
            _require_registered(written_ledger, validated_runs)
        elif require_registered:
            ledger, _ledger_bytes = _load_ledger_strict(ledger_path)
            _require_registered(ledger, validated_runs)

        index, projected_runs = _validate_index_for_runs(root, validated_runs)
        if index_output is not None and finalize_ledger:
            _write_index(index_output, index)
    except Exception as exc:
        if wrote_ledger and ledger_before is not None:
            ledger_path.write_bytes(ledger_before)
        if isinstance(exc, RunRegistrationError):
            raise
        raise RunRegistrationError("INDEX_REGENERATION_FAILED", str(exc)) from exc

    common = {
        "registered": finalize_ledger,
        "check_only": check_only,
        "index_snapshot_id": index["index_snapshot_id"],
        "artifact_count": len(index["artifacts"]),
        "diagnostic_count": len(index["diagnostics"]),
        "index_output": str(index_output.expanduser().resolve()) if index_output and finalize_ledger else None,
    }
    if len(projected_runs) == 1:
        return {**common, **projected_runs[0]}
    return {
        **common,
        "run_ids": [item["run_id"] for item in projected_runs],
        "runs": projected_runs,
    }


def register_run(
    project_root: Path,
    run_dir: Path,
    *,
    index_output: Path | None = None,
    check_only: bool = False,
    require_registered: bool = False,
    finalize_ledger: bool = False,
    expected_ledger_sha256: str | None = None,
) -> dict[str, Any]:
    return register_runs(
        project_root,
        [run_dir],
        index_output=index_output,
        check_only=check_only,
        require_registered=require_registered,
        finalize_ledger=finalize_ledger,
        expected_ledger_sha256=expected_ledger_sha256,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--run-dir", type=Path, required=True, action="append")
    parser.add_argument("--index-output", type=Path)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--check", action="store_true", help="Validate without updating the Run ledger or output")
    modes.add_argument("--finalize-ledger", action="store_true", help="Atomically reconcile finalized Runs into the fresh Run Ledger")
    modes.add_argument(
        "--bind-prompt-blind-provenance",
        action="store_true",
        help="Author one tracked blind owner and exact dependent references without changing the ledger",
    )
    parser.add_argument("--require-registered", action="store_true", help="With --check, require exact canonical Run registrations")
    parser.add_argument("--expected-ledger-sha256")
    parser.add_argument("--prompt-blind-owner-run-id")
    parser.add_argument("--prompt-blind-owner-record", type=Path)
    args = parser.parse_args()
    try:
        if args.bind_prompt_blind_provenance:
            if (
                not args.prompt_blind_owner_run_id
                or args.prompt_blind_owner_record is None
                or args.require_registered
                or args.expected_ledger_sha256 is not None
                or args.index_output is not None
            ):
                raise RunRegistrationError(
                    "REGISTRATION_MODE_INVALID",
                    "Prompt-blind authoring requires owner Run/record and accepts no ledger/index options",
                )
            result = bind_prompt_blind_provenance(
                args.root,
                args.run_dir,
                owner_run_id=args.prompt_blind_owner_run_id,
                owner_record_path=args.prompt_blind_owner_record,
            )
        else:
            if args.prompt_blind_owner_run_id or args.prompt_blind_owner_record is not None:
                raise RunRegistrationError(
                    "REGISTRATION_MODE_INVALID", "Prompt-blind owner options require authoring mode"
                )
            result = register_runs(
                args.root,
                args.run_dir,
                index_output=args.index_output,
                check_only=args.check,
                require_registered=args.require_registered,
                finalize_ledger=args.finalize_ledger,
                expected_ledger_sha256=args.expected_ledger_sha256,
            )
    except RunRegistrationError as exc:
        print(json.dumps({"error": exc.as_dict()}, ensure_ascii=False, sort_keys=True), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
