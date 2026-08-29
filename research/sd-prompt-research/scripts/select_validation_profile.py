#!/usr/bin/env python3
"""Select the closed Research validation profile for an exact changed-path set."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable


RESEARCH_EXPERIMENT_ONLY = "RESEARCH_EXPERIMENT_ONLY"
CONCEPT_GRAPH_CONTENT = "CONCEPT_GRAPH_CONTENT"
PRODUCTION_ADAPTER = "PRODUCTION_ADAPTER"
FULL_RESEARCH = "FULL_RESEARCH"

EXPERIMENT = "RESEARCH_EXPERIMENT_CONTENT"
CONCEPT = "CONCEPT_GRAPH_CONTENT"
PRODUCTION = "PRODUCTION_ADAPTER"
VALIDATOR = "RESEARCH_VALIDATOR_CODE"
CROSS_CUTTING = "SCHEMA_OR_CROSS_CUTTING"
UNKNOWN = "UNKNOWN"

WORKFLOW_PATH = ".github/workflows/research-claims.yml"
RESEARCH_ROOT = "research/sd-prompt-research/"
EXPERIMENT_ROOT = f"{RESEARCH_ROOT}experiments/"
CONCEPT_ROOT = f"{RESEARCH_ROOT}concepts/"
SCRIPT_ROOT = f"{RESEARCH_ROOT}scripts/"
TEST_ROOT = f"{RESEARCH_ROOT}tests/"
SCHEMA_ROOT = f"{RESEARCH_ROOT}schemas/"
TEMPLATE_ROOT = f"{RESEARCH_ROOT}templates/"
SHARED_REGISTRY_ROOT = f"{RESEARCH_ROOT}knowledge/registries/"
RUN_INDEX_PATH = f"{RESEARCH_ROOT}ledgers/run-index.yaml"
GRAPH_DIST_PATH = f"{RESEARCH_ROOT}dist/visual-concept-graph.json"
REQUIREMENTS_PATH = f"{RESEARCH_ROOT}requirements.txt"

PRODUCTION_ADAPTER_PATHS = frozenset(
    {
        "data/visual-concept-advisory-relation-allowlist-v1.json",
        "data/visual-concept-prompt-tag-bindings-v1.json",
        "scripts/promote-visual-concept-production-advisory-v1.mjs",
        "scripts/test-visual-concept-production-advisory-v1.mjs",
        "src/data/visual-concept-production-advisory-v1.json",
        "src/visualConceptProductionAdvisoryV1.ts",
    }
)

EXPERIMENT_TEST_MODULES = (
    "tests.test_camera_visibility_metadata_schema",
    "tests.test_concept_graph",
    "tests.test_evidence_evaluation",
    "tests.test_face_observation",
    "tests.test_hair_observation",
    "tests.test_image_observation_evidence_rule_schema",
    "tests.test_observation_pipeline",
    "tests.test_prompt_provenance_schema",
    "tests.test_research_claims",
    "tests.test_research_explorer_integration",
    "tests.test_research_run_registration",
)
CONCEPT_TEST_MODULES = (
    "tests.test_concept_graph",
    "tests.test_research_claims",
    "tests.test_research_explorer_integration",
)

FULL_TEST_COMMAND = "python -m unittest discover -s tests -v"
EXPERIMENT_TEST_COMMAND = "python -m unittest " + " ".join(EXPERIMENT_TEST_MODULES) + " -v"
CONCEPT_TEST_COMMAND = "python -m unittest " + " ".join(CONCEPT_TEST_MODULES) + " -v"
GRAPH_CHECK_COMMAND = "python scripts/build_concept_graph.py --check"
EXPLORER_CHECK_COMMAND = "python scripts/research_explorer.py index --check"
CLAIMS_CHECK_COMMAND = (
    "python scripts/validate_research_claims.py --baseline-ref <exact-base> "
    "--validation-context current_state --format json"
)
PRODUCTION_TEST_COMMAND = "node scripts/test-visual-concept-production-advisory-v1.mjs"
PRODUCTION_CHECK_COMMAND = "node scripts/promote-visual-concept-production-advisory-v1.mjs --check"


@dataclass(frozen=True)
class ClassifiedPath:
    path: str
    path_class: str


@dataclass(frozen=True)
class ValidationSelection:
    profile: str
    classified_paths: tuple[ClassifiedPath, ...]
    fallback_reason: str
    run_experiment_tests: bool
    run_concept_tests: bool
    run_production_adapter_tests: bool
    run_research_validators: bool
    run_full_research: bool
    commands: tuple[str, ...]


def _is_malformed_path(path: object) -> bool:
    if not isinstance(path, str) or not path:
        return True
    if "\\" in path or any(ord(character) < 32 or ord(character) == 127 for character in path):
        return True
    if path.startswith(("/", "./", "../")) or re.match(r"^[A-Za-z]:", path):
        return True
    parts = PurePosixPath(path).parts
    return not parts or any(part in {"", ".", ".."} for part in parts)


def classify_path(path: str) -> str:
    if path == WORKFLOW_PATH or path.startswith((SCRIPT_ROOT, TEST_ROOT)):
        return VALIDATOR
    if path.startswith((SCHEMA_ROOT, TEMPLATE_ROOT, SHARED_REGISTRY_ROOT)) or path == REQUIREMENTS_PATH:
        return CROSS_CUTTING
    if path.startswith(EXPERIMENT_ROOT) or path == RUN_INDEX_PATH:
        return EXPERIMENT
    if path == GRAPH_DIST_PATH:
        return CONCEPT
    if path.startswith(CONCEPT_ROOT):
        relative = path[len(CONCEPT_ROOT) :]
        if "/" not in relative and relative.endswith(".json"):
            return CONCEPT
        return UNKNOWN
    if path in PRODUCTION_ADAPTER_PATHS:
        return PRODUCTION
    return UNKNOWN


def _commands(*, profile: str, experiment: bool, concept: bool, production: bool) -> tuple[str, ...]:
    commands: list[str] = []
    if profile == FULL_RESEARCH:
        commands.append(FULL_TEST_COMMAND)
    elif experiment:
        commands.append(EXPERIMENT_TEST_COMMAND)
    elif concept:
        commands.append(CONCEPT_TEST_COMMAND)
    if profile != PRODUCTION_ADAPTER:
        commands.extend((GRAPH_CHECK_COMMAND, EXPLORER_CHECK_COMMAND, CLAIMS_CHECK_COMMAND))
    if production:
        commands.extend((PRODUCTION_TEST_COMMAND, PRODUCTION_CHECK_COMMAND))
    return tuple(commands)


def _full_selection(classified_paths: tuple[ClassifiedPath, ...], reason: str) -> ValidationSelection:
    return ValidationSelection(
        profile=FULL_RESEARCH,
        classified_paths=classified_paths,
        fallback_reason=reason,
        run_experiment_tests=False,
        run_concept_tests=False,
        run_production_adapter_tests=True,
        run_research_validators=True,
        run_full_research=True,
        commands=_commands(
            profile=FULL_RESEARCH,
            experiment=False,
            concept=False,
            production=True,
        ),
    )


def classify_paths(paths: Iterable[object]) -> ValidationSelection:
    raw_paths = list(paths)
    if not raw_paths:
        return _full_selection((), "empty_changed_path_set")
    if any(_is_malformed_path(path) for path in raw_paths):
        return _full_selection((), "malformed_changed_path")

    normalized = [str(path) for path in raw_paths]
    if len(set(normalized)) != len(normalized):
        classified = tuple(
            ClassifiedPath(path, classify_path(path)) for path in sorted(set(normalized))
        )
        return _full_selection(classified, "duplicate_changed_path")

    classified = tuple(ClassifiedPath(path, classify_path(path)) for path in sorted(normalized))
    full_classes = {VALIDATOR, CROSS_CUTTING, UNKNOWN}
    first_full = next((item for item in classified if item.path_class in full_classes), None)
    if first_full:
        return _full_selection(
            classified, f"{first_full.path_class.lower()}:{first_full.path}"
        )

    classes = {item.path_class for item in classified}
    experiment = EXPERIMENT in classes
    concept = CONCEPT in classes
    production = PRODUCTION in classes
    if concept:
        profile = CONCEPT_GRAPH_CONTENT
    elif experiment:
        profile = RESEARCH_EXPERIMENT_ONLY
    elif production:
        profile = PRODUCTION_ADAPTER
    else:
        return _full_selection(classified, "unclassified_changed_path_set")

    return ValidationSelection(
        profile=profile,
        classified_paths=classified,
        fallback_reason="",
        run_experiment_tests=experiment,
        run_concept_tests=concept,
        run_production_adapter_tests=production,
        run_research_validators=profile != PRODUCTION_ADAPTER,
        run_full_research=False,
        commands=_commands(
            profile=profile,
            experiment=experiment,
            concept=concept,
            production=production,
        ),
    )


def parse_nul_paths(data: bytes) -> tuple[list[str], str | None]:
    if not data:
        return [], "empty_changed_path_set"
    if not data.endswith(b"\0"):
        return [], "malformed_nul_path_stream"
    try:
        parts = [part.decode("utf-8", errors="strict") for part in data[:-1].split(b"\0")]
    except UnicodeDecodeError:
        return [], "malformed_utf8_path"
    if any(not part for part in parts):
        return [], "malformed_nul_path_stream"
    return parts, None


def forced_full_selection(reason: str) -> ValidationSelection:
    if not reason or len(reason) > 160 or not re.fullmatch(r"[a-z0-9_]+", reason):
        return _full_selection((), "invalid_force_full_reason")
    return _full_selection((), reason)


def _append_outputs(path: Path, selection: ValidationSelection) -> None:
    values = {
        "selected_profile": selection.profile,
        "fallback_reason": selection.fallback_reason or "none",
        "run_experiment_tests": str(selection.run_experiment_tests).lower(),
        "run_concept_tests": str(selection.run_concept_tests).lower(),
        "run_production_adapter_tests": str(selection.run_production_adapter_tests).lower(),
        "run_research_validators": str(selection.run_research_validators).lower(),
        "run_full_research": str(selection.run_full_research).lower(),
    }
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        for key, value in values.items():
            stream.write(f"{key}={value}\n")


def _append_summary(path: Path, selection: ValidationSelection) -> None:
    def summary_code(value: str) -> str:
        return value.replace("|", "\\|").replace("`", "&#96;")

    lines = [
        "## Research validation profile",
        "",
        f"- Selected profile: `{selection.profile}`",
        f"- Full fallback reason: `{selection.fallback_reason or 'none'}`",
        "",
        "### Classified paths",
        "",
        "| Path | Class |",
        "| --- | --- |",
    ]
    if selection.classified_paths:
        lines.extend(
            f"| `{summary_code(item.path)}` | `{item.path_class}` |"
            for item in selection.classified_paths
        )
    else:
        lines.append("| _(forced or malformed input)_ | `FULL_RESEARCH` |")
    lines.extend(["", "### Exact commands selected", ""])
    lines.extend(f"- `{command}`" for command in selection.commands)
    lines.extend(
        ["", "### Elapsed validation stages", "", "| Stage | Seconds |", "| --- | ---: |"]
    )
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write("\n".join(lines) + "\n")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--paths-file", type=Path)
    source.add_argument("--force-full-reason")
    parser.add_argument("--github-output", type=Path)
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--format", choices=("json", "text"), default="text")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.force_full_reason is not None:
        selection = forced_full_selection(args.force_full_reason)
    else:
        paths, parse_error = parse_nul_paths(args.paths_file.read_bytes())
        selection = _full_selection((), parse_error) if parse_error else classify_paths(paths)

    if args.github_output:
        _append_outputs(args.github_output, selection)
    if args.summary:
        _append_summary(args.summary, selection)

    payload = {
        "classified_paths": [item.__dict__ for item in selection.classified_paths],
        "commands": list(selection.commands),
        "fallback_reason": selection.fallback_reason or None,
        "profile": selection.profile,
    }
    if args.format == "json":
        print(json.dumps(payload, sort_keys=True))
    else:
        print(f"selected_profile={selection.profile}")
        print(f"fallback_reason={selection.fallback_reason or 'none'}")
        for item in selection.classified_paths:
            print(f"classified_path={item.path} class={item.path_class}")
        for command in selection.commands:
            print(f"selected_command={command}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
