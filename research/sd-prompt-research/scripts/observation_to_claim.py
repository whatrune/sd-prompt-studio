#!/usr/bin/env python3
"""Generate, validate, and finalize Observation-to-Claim Draft artifacts."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from claim_draft_pipeline import (
    PipelineError,
    check_registry_compatibility,
    finalize_candidate,
    generate_candidate,
    generate_draft,
    persist_generation_failure,
)


def parser(default_root: Path) -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--root", type=Path, default=default_root, help="Research Project Root")
    subcommands = result.add_subparsers(dest="command", required=True)

    generate = subcommands.add_parser("generate", help="Generate an immutable pre-schema Draft")
    generate.add_argument("--observation", type=Path, required=True, help="Required pose observation.json")
    generate.add_argument(
        "--optional-observation",
        action="append",
        default=[],
        metavar="MODULE=PATH",
        help="Optional Module Observation, for example face=.../face-observation.json",
    )
    generate.add_argument("--output-root", type=Path)

    candidate = subcommands.add_parser("candidate", help="Generate a Candidate Wrapper from Human Resolution")
    candidate.add_argument("--draft-dir", type=Path, required=True)

    compatibility = subcommands.add_parser(
        "registry-check", help="Record a Registry compatibility Receipt for a Draft"
    )
    compatibility.add_argument("--draft-dir", type=Path, required=True)

    finalize = subcommands.add_parser("finalize", help="Finalize a validated Candidate into Canonical Knowledge")
    finalize.add_argument("--draft-dir", type=Path, required=True)
    selection = finalize.add_mutually_exclusive_group(required=True)
    selection.add_argument("--candidate-id")
    selection.add_argument("--candidate-path", type=Path)
    finalize.add_argument(
        "--explicit-finalize",
        action="store_true",
        help="Required acknowledgement that a human explicitly requested Finalize",
    )
    return result


def _optional_sources(values: list[str]) -> list[tuple[Path, str]]:
    result: list[tuple[Path, str]] = []
    for value in values:
        if "=" not in value:
            raise PipelineError("OPTIONAL_SOURCE_INVALID", f"Expected MODULE=PATH, got {value!r}")
        module, path = value.split("=", 1)
        result.append((Path(path), module))
    return result


def main(argv: list[str] | None = None) -> int:
    default_root = Path(__file__).resolve().parents[1]
    args = parser(default_root).parse_args(argv)
    project_root = args.root.expanduser().resolve()
    try:
        if args.command == "generate":
            observations = [(args.observation.expanduser().resolve(), "pose")]
            observations.extend(
                (path.expanduser().resolve(), module)
                for path, module in _optional_sources(args.optional_observation)
            )
            try:
                result = generate_draft(
                    project_root,
                    observations,
                    output_root=args.output_root.expanduser().resolve() if args.output_root else None,
                )
            except PipelineError as error:
                failure_dir = persist_generation_failure(
                    project_root,
                    error,
                    source_paths=[path for path, _module in observations],
                )
                print(
                    json.dumps(
                        {"status": "failed", "code": error.code, "message": str(error), "failure_dir": str(failure_dir)},
                        ensure_ascii=False,
                    )
                )
                return 1
            print(
                json.dumps(
                    {
                        "status": "succeeded",
                        "draft_id": result.draft_id,
                        "draft_dir": str(result.draft_dir),
                        "idempotent": result.idempotent,
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        if args.command == "candidate":
            result = generate_candidate(project_root, args.draft_dir)
            print(
                json.dumps(
                    {
                        "status": "succeeded",
                        "candidate_id": result.candidate_id,
                        "candidate_dir": str(result.candidate_dir),
                        "candidate_path": str(result.candidate_path),
                        "idempotent": result.idempotent,
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        if args.command == "registry-check":
            result = check_registry_compatibility(project_root, args.draft_dir)
            print(
                json.dumps(
                    {
                        "status": "succeeded",
                        "classification": result.classification,
                        "receipt_id": result.receipt["receipt_id"],
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        if args.command == "finalize":
            result = finalize_candidate(
                project_root,
                args.draft_dir,
                candidate_id=args.candidate_id,
                candidate_path=args.candidate_path,
                explicit_finalize=args.explicit_finalize,
            )
            print(json.dumps({"status": "succeeded", "destination": str(result.destination)}, ensure_ascii=False))
            return 0
    except PipelineError as error:
        print(json.dumps({"status": "failed", "code": error.code, "message": str(error)}, ensure_ascii=False))
        return 1
    raise AssertionError(args.command)


if __name__ == "__main__":
    raise SystemExit(main())
