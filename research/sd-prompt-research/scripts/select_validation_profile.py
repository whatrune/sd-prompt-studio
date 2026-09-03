#!/usr/bin/env python3
"""Select one closed validation profile from the shared path-ownership catalog."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = REPOSITORY_ROOT / "data" / "validation-path-ownership-v1.json"

RESEARCH_EXPERIMENT = "RESEARCH_EXPERIMENT"
CONCEPT_GRAPH = "CONCEPT_GRAPH"
FULL_RESEARCH = "FULL_RESEARCH"
PRODUCTION_ADVISORY = "PRODUCTION_ADVISORY"
PROMPT_DATA = "PROMPT_DATA"
APPLICATION = "APPLICATION"
PLATFORM = "PLATFORM"
DOCUMENTATION = "DOCUMENTATION"

PROFILE_NAMES = frozenset(
    {
        RESEARCH_EXPERIMENT,
        CONCEPT_GRAPH,
        FULL_RESEARCH,
        PRODUCTION_ADVISORY,
        PROMPT_DATA,
        APPLICATION,
        PLATFORM,
        DOCUMENTATION,
    }
)
BUNDLE_NAMES = frozenset(
    {
        "research_experiment",
        "concept_graph",
        "full_research",
        "research_validators",
        "production_advisory",
        "prompt_data",
        "application",
        "platform",
        "documentation",
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

COMMANDS_BY_BUNDLE = {
    "research_experiment": (
        "python -m unittest " + " ".join(EXPERIMENT_TEST_MODULES) + " -v",
    ),
    "concept_graph": (
        "python -m unittest " + " ".join(CONCEPT_TEST_MODULES) + " -v",
    ),
    "full_research": ("python -m unittest discover -s tests -v",),
    "research_validators": (
        "python scripts/build_concept_graph.py --check",
        "python scripts/research_explorer.py index --check",
        "python scripts/validate_research_claims.py --baseline-ref <exact-base> --validation-context current_state --format json",
    ),
    "production_advisory": (
        "node scripts/test-visual-concept-production-advisory-v1.mjs",
        "node scripts/test-visual-concept-read-only-advisory-v1.mjs",
        "node scripts/test-visual-concept-read-only-entry-adapter-v1.mjs",
        "node scripts/test-visual-concept-read-only-inspection-v1.mjs",
        "node scripts/promote-visual-concept-production-advisory-v1.mjs --check",
    ),
    "prompt_data": (
        "node scripts/validate-dictionaries.mjs",
        "node scripts/test-reclassification.mjs",
        "node scripts/test-prompt-analyzer.mjs",
    ),
    "application": ("pnpm test", "pnpm build"),
    "platform": (
        "node scripts/test-protected-transition-admission-v1.mjs",
        "node scripts/test-task-execution-context-v1.mjs",
    ),
    "documentation": ("node scripts/test-role-execution-contracts.mjs",),
}


@dataclass(frozen=True)
class CatalogProfile:
    runtime_deployable: bool
    bundles: tuple[str, ...]


@dataclass(frozen=True)
class OwnershipRule:
    profile: str
    exact: tuple[str, ...]
    prefixes: tuple[str, ...]


@dataclass(frozen=True)
class ValidationCatalog:
    full_profile: str
    profiles: dict[str, CatalogProfile]
    force_full_exact: frozenset[str]
    force_full_prefixes: tuple[str, ...]
    ownership: tuple[OwnershipRule, ...]


@dataclass(frozen=True)
class ClassifiedPath:
    path: str
    path_class: str


@dataclass(frozen=True)
class ValidationSelection:
    profile: str
    classified_paths: tuple[ClassifiedPath, ...]
    fallback_reason: str
    bundles: tuple[str, ...]
    runtime_deployable: bool
    commands: tuple[str, ...]

    def runs(self, bundle: str) -> bool:
        return bundle in self.bundles


def _exact_keys(value: object, expected: set[str]) -> bool:
    return isinstance(value, dict) and set(value) == expected


def _catalog_paths(value: object) -> tuple[str, ...]:
    if not isinstance(value, list) or any(not isinstance(item, str) or not item for item in value):
        raise ValueError("validation_catalog_invalid")
    if len(set(value)) != len(value):
        raise ValueError("validation_catalog_invalid")
    return tuple(value)


def load_catalog(path: Path = CATALOG_PATH) -> ValidationCatalog:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("validation_catalog_invalid") from error
    if not _exact_keys(
        value,
        {"catalog_id", "catalog_version", "full_profile", "profiles", "force_full", "ownership"},
    ):
        raise ValueError("validation_catalog_invalid")
    if (
        value["catalog_id"] != "validation_path_ownership_v1"
        or value["catalog_version"] != 1
        or value["full_profile"] != FULL_RESEARCH
        or not isinstance(value["profiles"], dict)
        or set(value["profiles"]) != PROFILE_NAMES
    ):
        raise ValueError("validation_catalog_invalid")

    profiles: dict[str, CatalogProfile] = {}
    for name, profile in value["profiles"].items():
        if not _exact_keys(profile, {"runtime_deployable", "bundles"}):
            raise ValueError("validation_catalog_invalid")
        bundles = _catalog_paths(profile["bundles"])
        if not isinstance(profile["runtime_deployable"], bool) or not set(bundles).issubset(BUNDLE_NAMES):
            raise ValueError("validation_catalog_invalid")
        profiles[name] = CatalogProfile(profile["runtime_deployable"], bundles)

    force_full = value["force_full"]
    if not _exact_keys(force_full, {"exact", "prefixes"}):
        raise ValueError("validation_catalog_invalid")
    force_exact = frozenset(_catalog_paths(force_full["exact"]))
    force_prefixes = _catalog_paths(force_full["prefixes"])

    ownership: list[OwnershipRule] = []
    seen_exact: set[str] = set()
    for rule in value["ownership"] if isinstance(value["ownership"], list) else ():
        if not _exact_keys(rule, {"profile", "exact", "prefixes"}) or rule["profile"] == FULL_RESEARCH:
            raise ValueError("validation_catalog_invalid")
        if rule["profile"] not in PROFILE_NAMES:
            raise ValueError("validation_catalog_invalid")
        exact = _catalog_paths(rule["exact"])
        prefixes = _catalog_paths(rule["prefixes"])
        if seen_exact.intersection(exact):
            raise ValueError("validation_catalog_invalid")
        seen_exact.update(exact)
        ownership.append(OwnershipRule(rule["profile"], exact, prefixes))
    if not ownership:
        raise ValueError("validation_catalog_invalid")
    return ValidationCatalog(FULL_RESEARCH, profiles, force_exact, force_prefixes, tuple(ownership))


CATALOG = load_catalog()


def _is_malformed_path(path: object) -> bool:
    if not isinstance(path, str) or not path or len(path) > 512:
        return True
    if "\\" in path or any(ord(character) < 32 or ord(character) == 127 for character in path):
        return True
    if path.startswith(("/", "./", "../")) or path.endswith("/") or "//" in path or re.match(r"^[A-Za-z]:", path):
        return True
    parts = PurePosixPath(path).parts
    return not parts or any(part in {"", ".", ".."} for part in parts)


def classify_path(path: str, catalog: ValidationCatalog = CATALOG) -> tuple[str, str]:
    if path in catalog.force_full_exact or any(path.startswith(prefix) for prefix in catalog.force_full_prefixes):
        return catalog.full_profile, f"control_plane_path:{path}"

    exact_matches = {rule.profile for rule in catalog.ownership if path in rule.exact}
    if len(exact_matches) == 1:
        return next(iter(exact_matches)), ""
    if len(exact_matches) > 1:
        return catalog.full_profile, f"ambiguous_exact_owner:{path}"

    prefix_matches = [
        (len(prefix), rule.profile)
        for rule in catalog.ownership
        for prefix in rule.prefixes
        if path.startswith(prefix)
    ]
    if not prefix_matches:
        return catalog.full_profile, f"unknown_path:{path}"
    longest = max(length for length, _ in prefix_matches)
    profiles = {profile for length, profile in prefix_matches if length == longest}
    if len(profiles) != 1:
        return catalog.full_profile, f"ambiguous_prefix_owner:{path}"
    return next(iter(profiles)), ""


def _commands(bundles: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(command for bundle in bundles for command in COMMANDS_BY_BUNDLE[bundle])


def _full_selection(
    classified_paths: tuple[ClassifiedPath, ...], reason: str, catalog: ValidationCatalog = CATALOG
) -> ValidationSelection:
    profile = catalog.profiles[catalog.full_profile]
    return ValidationSelection(
        catalog.full_profile,
        classified_paths,
        reason,
        profile.bundles,
        profile.runtime_deployable,
        _commands(profile.bundles),
    )


def classify_paths(paths: Iterable[object], catalog: ValidationCatalog = CATALOG) -> ValidationSelection:
    raw_paths = list(paths)
    if not raw_paths:
        return _full_selection((), "empty_changed_path_set", catalog)
    if any(_is_malformed_path(path) for path in raw_paths):
        return _full_selection((), "malformed_changed_path", catalog)
    normalized = [str(path) for path in raw_paths]
    if len(set(normalized)) != len(normalized):
        classified = tuple(
            ClassifiedPath(path, classify_path(path, catalog)[0]) for path in sorted(set(normalized))
        )
        return _full_selection(classified, "duplicate_changed_path", catalog)

    classified_items: list[ClassifiedPath] = []
    fallback_reasons: list[str] = []
    for path in sorted(normalized):
        profile, reason = classify_path(path, catalog)
        classified_items.append(ClassifiedPath(path, profile))
        if reason:
            fallback_reasons.append(reason)
    classified = tuple(classified_items)
    if fallback_reasons:
        return _full_selection(classified, fallback_reasons[0], catalog)

    profiles = {item.path_class for item in classified}
    if len(profiles) != 1:
        return _full_selection(classified, "mixed_ownership_classes", catalog)
    profile_name = next(iter(profiles))
    profile = catalog.profiles[profile_name]
    return ValidationSelection(
        profile_name,
        classified,
        "",
        profile.bundles,
        profile.runtime_deployable,
        _commands(profile.bundles),
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


def _output_values(selection: ValidationSelection) -> dict[str, str]:
    return {
        "selected_profile": selection.profile,
        "fallback_reason": selection.fallback_reason or "none",
        "runtime_deployable": str(selection.runtime_deployable).lower(),
        "install_research_dependencies": str(
            any(selection.runs(bundle) for bundle in ("research_experiment", "concept_graph", "full_research", "research_validators"))
        ).lower(),
        "install_node_dependencies": str(
            any(selection.runs(bundle) for bundle in ("production_advisory", "prompt_data", "application", "platform"))
        ).lower(),
        **{f"run_{bundle}": str(selection.runs(bundle)).lower() for bundle in sorted(BUNDLE_NAMES)},
    }


def _append_outputs(path: Path, selection: ValidationSelection) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        for key, value in _output_values(selection).items():
            stream.write(f"{key}={value}\n")


def _append_summary(path: Path, selection: ValidationSelection) -> None:
    def code(value: str) -> str:
        return value.replace("|", "\\|").replace("`", "&#96;")

    lines = [
        "## Validation profile",
        "",
        f"- Selected profile: `{selection.profile}`",
        f"- Full fallback reason: `{selection.fallback_reason or 'none'}`",
        f"- Runtime/deployable: `{str(selection.runtime_deployable).lower()}`",
        "",
        "### Classified paths",
        "",
        "| Path | Ownership |",
        "| --- | --- |",
    ]
    if selection.classified_paths:
        lines.extend(f"| `{code(item.path)}` | `{item.path_class}` |" for item in selection.classified_paths)
    else:
        lines.append("| _(forced or malformed input)_ | `FULL_RESEARCH` |")
    lines.extend(["", "### Exact commands selected", ""])
    lines.extend(f"- `{command}`" for command in selection.commands)
    lines.extend(["", "GitHub Actions records elapsed time for each selected validation step."])
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
        "bundles": list(selection.bundles),
        "classified_paths": [item.__dict__ for item in selection.classified_paths],
        "commands": list(selection.commands),
        "fallback_reason": selection.fallback_reason or None,
        "profile": selection.profile,
        "runtime_deployable": selection.runtime_deployable,
    }
    if args.format == "json":
        print(json.dumps(payload, sort_keys=True))
    else:
        for key, value in _output_values(selection).items():
            print(f"{key}={value}")
        for item in selection.classified_paths:
            print(f"classified_path={item.path} class={item.path_class}")
        for command in selection.commands:
            print(f"selected_command={command}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
