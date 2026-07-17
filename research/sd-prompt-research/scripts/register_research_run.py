#!/usr/bin/env python3
"""Register one finalized Research Run and regenerate the Explorer read model."""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Any, Mapping

import yaml

from finalize_observation import compute_aggregate, rubric_errors, schema_errors
from ingest_run import update_run_index
from research_explorer import build_research_index, validate_index
from validate_research_claims import UniqueKeyLoader


SAFE_SEGMENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


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


def register_run(
    project_root: Path,
    run_dir: Path,
    *,
    index_output: Path | None = None,
    check_only: bool = False,
) -> dict[str, Any]:
    root = project_root.expanduser().resolve(strict=True)
    canonical_dir, relative_run, domain, run_id = _canonical_run_path(root, run_dir)
    manifest, _observation = _validate_bundle(root, canonical_dir, domain, run_id)

    ledger_path = root / "ledgers" / "run-index.yaml"
    ledger_existed = ledger_path.exists()
    ledger_before = ledger_path.read_bytes() if ledger_existed else None
    try:
        if not check_only:
            update_run_index(root, manifest)
        index = build_research_index(root)
        validate_index(index, root / "schemas" / "research-explorer-index.schema.json")
        run_source = f"{relative_run}/manifest.yaml"
        observation_source = f"{relative_run}/observation.json"
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
        if index_output is not None and not check_only:
            _write_index(index_output, index)
    except Exception as exc:
        if not check_only:
            if ledger_existed and ledger_before is not None:
                ledger_path.write_bytes(ledger_before)
            elif ledger_path.exists():
                ledger_path.unlink()
        if isinstance(exc, RunRegistrationError):
            raise
        raise RunRegistrationError("INDEX_REGENERATION_FAILED", str(exc)) from exc
    return {
        "registered": not check_only,
        "check_only": check_only,
        "run_id": run_id,
        "run_path": relative_run,
        "run_artifact_id": run_artifact["artifact_id"],
        "observation_artifact_id": observation_artifact["artifact_id"],
        "relationship": relationship,
        "index_snapshot_id": index["index_snapshot_id"],
        "artifact_count": len(index["artifacts"]),
        "diagnostic_count": len(index["diagnostics"]),
        "index_output": str(index_output.expanduser().resolve()) if index_output and not check_only else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--index-output", type=Path)
    parser.add_argument("--check", action="store_true", help="Validate without updating the Run ledger or output")
    args = parser.parse_args()
    try:
        result = register_run(
            args.root,
            args.run_dir,
            index_output=args.index_output,
            check_only=args.check,
        )
    except RunRegistrationError as exc:
        print(json.dumps({"error": exc.as_dict()}, ensure_ascii=False, sort_keys=True), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
