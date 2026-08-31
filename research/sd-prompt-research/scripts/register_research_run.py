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
from typing import Any, Mapping

import yaml

from finalize_observation import compute_aggregate, rubric_errors, schema_errors
from research_explorer import build_research_index, validate_index
from validate_research_claims import UniqueKeyLoader


SAFE_SEGMENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
LEDGER_FIELDS = frozenset({"run_id", "domain", "title", "status", "updated_at", "path"})


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


def _validated_runs(project_root: Path, run_dirs: list[Path]) -> list[dict[str, Any]]:
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
    return sorted(validated, key=lambda item: item["run_id"])


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
    parser.add_argument("--require-registered", action="store_true", help="With --check, require exact canonical Run registrations")
    parser.add_argument("--expected-ledger-sha256")
    args = parser.parse_args()
    try:
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
