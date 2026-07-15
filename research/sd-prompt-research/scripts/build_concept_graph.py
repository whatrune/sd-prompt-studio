#!/usr/bin/env python3
"""Validate module sources and build the Visual Concept Graph distribution."""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from jsonschema import Draft202012Validator, FormatChecker


SCHEMA_VERSION = "0.2.0"
DEFAULT_GRAPH_VERSION = "0.2.0"
ARRAY_KEYS = (
    "concepts",
    "relations",
    "target_patterns",
    "unmodeled_effects",
    "model_profiles",
    "intent_profiles",
    "control_context_profiles",
)
ID_KEYS = {
    "concepts": "concept_id",
    "relations": "relation_id",
    "target_patterns": "target_pattern_id",
    "unmodeled_effects": "effect_id",
    "model_profiles": "model_profile_id",
    "intent_profiles": "intent_profile_id",
    "control_context_profiles": "context_profile_id",
}
FAMILY_CONTENT = {
    "physical": {"concepts"},
    "semantic": {"concepts"},
    "relations": {"relations"},
    "target_patterns": {
        "target_patterns", "model_profiles", "intent_profiles", "control_context_profiles"
    },
    "unmodeled_effects": {"unmodeled_effects"},
}


class GraphBuildError(RuntimeError):
    """Raised when a source graph cannot be validated or linked."""


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise GraphBuildError(f"file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise GraphBuildError(
            f"invalid JSON in {path}: line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc


def _format_validation_errors(errors: Iterable[Any], source: Path) -> str:
    lines = []
    for error in sorted(errors, key=lambda item: list(item.absolute_path)):
        location = ".".join(str(part) for part in error.absolute_path) or "<root>"
        lines.append(f"{source}: {location}: {error.message}")
    return "\n".join(lines)


def _validate(instance: Any, schema: dict[str, Any], source: Path) -> None:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = list(validator.iter_errors(instance))
    if errors:
        raise GraphBuildError(_format_validation_errors(errors, source))


def _normalize_alias(value: str) -> str:
    return " ".join(value.casefold().split())


def _check_unique(items: list[dict[str, Any]], id_key: str, label: str) -> None:
    seen: dict[str, int] = {}
    for index, item in enumerate(items):
        item_id = item[id_key]
        if item_id in seen:
            raise GraphBuildError(
                f"duplicate {label} ID {item_id!r} at indexes {seen[item_id]} and {index}"
            )
        seen[item_id] = index


def _iter_evidence(owner: dict[str, Any]) -> Iterable[dict[str, Any]]:
    yield from owner.get("evidence_refs", [])
    for behavior in owner.get("model_behaviors", []):
        yield from behavior.get("evidence_refs", [])
    for property_group in ("clothing_properties", "hair_properties"):
        properties = owner.get(property_group, {})
        for effect_group in ("visibility_effects", "generative_effects"):
            for effect in properties.get(effect_group, []):
                yield from effect.get("evidence_refs", [])
    for risk in owner.get("known_visibility_risks", []):
        yield from risk.get("evidence_refs", [])


def _require_refs(
    owner_id: str,
    field: str,
    values: Iterable[str],
    available: set[str],
) -> None:
    missing = sorted(set(values) - available)
    if missing:
        raise GraphBuildError(
            f"{owner_id}.{field} references missing IDs: {', '.join(missing)}"
        )


def _validate_links(graph: dict[str, Any], root: Path) -> list[str]:
    warnings: list[str] = []
    concepts = graph["concepts"]
    relations = graph["relations"]
    patterns = graph["target_patterns"]
    profiles = graph["model_profiles"]
    intents = graph["intent_profiles"]
    effects = graph["unmodeled_effects"]
    contexts = graph["control_context_profiles"]

    for key, id_key in ID_KEYS.items():
        _check_unique(graph[key], id_key, key.removesuffix("s"))

    concept_ids = {item["concept_id"] for item in concepts}
    pattern_ids = {item["target_pattern_id"] for item in patterns}
    model_profile_ids = {item["model_profile_id"] for item in profiles}

    alias_owner: dict[str, str] = {}
    normalized_concept_ids = {
        _normalize_alias(value): value for value in concept_ids
    }
    for concept in concepts:
        concept_id = concept["concept_id"]
        for alias in concept.get("aliases", []):
            normalized = _normalize_alias(alias)
            previous = alias_owner.get(normalized)
            if previous and previous != concept_id:
                raise GraphBuildError(
                    f"duplicate alias {alias!r} belongs to both {previous} and {concept_id}"
                )
            if normalized in normalized_concept_ids and normalized_concept_ids[normalized] != concept_id:
                raise GraphBuildError(
                    f"alias {alias!r} on {concept_id} collides with another concept ID"
                )
            alias_owner[normalized] = concept_id

        for field in (
            "required_constraints",
            "optional_priors",
            "conflicts",
            "secondary_effects",
        ):
            _require_refs(concept_id, field, concept.get(field, []), concept_ids)
        for behavior in concept.get("model_behaviors", []):
            profile_id = behavior.get("model_profile_id")
            if profile_id:
                _require_refs(concept_id, "model_profile_id", [profile_id], model_profile_ids)

    relation_endpoints = concept_ids | pattern_ids
    for relation in relations:
        relation_id = relation["relation_id"]
        _require_refs(
            relation_id,
            "source_concept_id",
            [relation["source_concept_id"]],
            relation_endpoints,
        )
        _require_refs(
            relation_id,
            "target_concept_id",
            [relation["target_concept_id"]],
            relation_endpoints,
        )
        profile_id = relation.get("model_profile")
        if profile_id:
            _require_refs(relation_id, "model_profile", [profile_id], model_profile_ids)

    for pattern in patterns:
        pattern_id = pattern["target_pattern_id"]
        for field in ("required_constraints", "preferred_constraints", "conflicts"):
            _require_refs(pattern_id, field, pattern.get(field, []), concept_ids)
        _require_refs(
            pattern_id,
            "candidate_alternatives",
            pattern.get("candidate_alternatives", []),
            pattern_ids,
        )

    for effect in effects:
        effect_id = effect["effect_id"]
        source_id = effect.get("source_concept_id")
        if source_id:
            _require_refs(effect_id, "source_concept_id", [source_id], concept_ids)
        profile_id = effect.get("model_profile")
        if profile_id:
            _require_refs(effect_id, "model_profile", [profile_id], model_profile_ids)

    for intent in intents:
        intent_id = intent["intent_profile_id"]
        for field in (
            "required_structural_concepts",
            "preferred_structural_concepts",
            "conflict_concepts",
        ):
            _require_refs(intent_id, field, intent.get(field, []), concept_ids)
        _require_refs(
            intent_id,
            "target_pattern_ids",
            intent.get("target_pattern_ids", []),
            pattern_ids,
        )

    for context in contexts:
        _require_refs(
            context["context_profile_id"],
            "fixed_concept_ids",
            context.get("fixed_concept_ids", []),
            concept_ids,
        )

    evidence_values: dict[str, dict[str, Any]] = {}
    owners = concepts + relations + patterns + effects + contexts
    for owner in owners:
        owner_id = next(owner[key] for key in ID_KEYS.values() if key in owner)
        for evidence in _iter_evidence(owner):
            evidence_id = evidence["evidence_ref_id"]
            previous = evidence_values.get(evidence_id)
            if previous is not None and previous != evidence:
                raise GraphBuildError(
                    f"evidence_ref_id {evidence_id!r} is reused with different content"
                )
            evidence_values[evidence_id] = evidence
            if evidence.get("storage", "local") != "local":
                continue
            for field in ("observation_path", "research_packet_path"):
                relative = evidence.get(field)
                if relative and not (root / relative).is_file():
                    warnings.append(
                        f"{owner_id}: local {field} does not exist: {relative}"
                    )
    return sorted(set(warnings))


def _build_indexes(graph: dict[str, Any]) -> dict[str, Any]:
    concepts_by_module: dict[str, list[str]] = defaultdict(list)
    concepts_by_type: dict[str, list[str]] = defaultdict(list)
    relations_by_source: dict[str, list[str]] = defaultdict(list)
    relations_by_target: dict[str, list[str]] = defaultdict(list)
    evidence_by_run: dict[str, set[str]] = defaultdict(set)

    for index, concept in enumerate(graph["concepts"]):
        concept_id = concept["concept_id"]
        concepts_by_module[concept["module"]].append(concept_id)
        concepts_by_type[concept["concept_type"]].append(concept_id)

    aliases = {
        _normalize_alias(alias): concept["concept_id"]
        for concept in graph["concepts"]
        for alias in concept.get("aliases", [])
    }
    for relation in graph["relations"]:
        relation_id = relation["relation_id"]
        relations_by_source[relation["source_concept_id"]].append(relation_id)
        relations_by_target[relation["target_concept_id"]].append(relation_id)

    for collection in (
        graph["concepts"],
        graph["relations"],
        graph["target_patterns"],
        graph["unmodeled_effects"],
        graph["control_context_profiles"],
    ):
        for owner in collection:
            owner_id = next(owner[key] for key in ID_KEYS.values() if key in owner)
            for evidence in _iter_evidence(owner):
                evidence_by_run[evidence["run_id"]].add(owner_id)

    sort_lists = lambda mapping: {key: sorted(value) for key, value in sorted(mapping.items())}
    return {
        "concepts_by_id": {
            concept["concept_id"]: index
            for index, concept in enumerate(graph["concepts"])
        },
        "concepts_by_module": sort_lists(concepts_by_module),
        "concepts_by_type": sort_lists(concepts_by_type),
        "aliases_to_concept_id": dict(sorted(aliases.items())),
        "relations_by_source": sort_lists(relations_by_source),
        "relations_by_target": sort_lists(relations_by_target),
        "target_patterns_by_id": {
            pattern["target_pattern_id"]: index
            for index, pattern in enumerate(graph["target_patterns"])
        },
        "intent_profiles_by_id": {
            profile["intent_profile_id"]: index
            for index, profile in enumerate(graph["intent_profiles"])
        },
        "control_context_profiles_by_id": {
            profile["context_profile_id"]: index
            for index, profile in enumerate(graph["control_context_profiles"])
        },
        "evidence_by_run_id": {
            run_id: sorted(owner_ids)
            for run_id, owner_ids in sorted(evidence_by_run.items())
        },
    }


def build_graph(
    root: Path,
    source_dir: Path,
    schema_path: Path,
    generated_at: str | None = None,
) -> tuple[dict[str, Any], list[str]]:
    """Build and validate a graph in memory without writing output."""
    root = root.resolve()
    source_dir = source_dir.resolve()
    schema_path = schema_path.resolve()
    schema = _read_json(schema_path)
    Draft202012Validator.check_schema(schema)
    module_schema = {
        "$schema": schema["$schema"],
        "$ref": "#/$defs/sourceModule",
        "$defs": schema["$defs"],
    }

    source_paths = sorted(source_dir.glob("*.json"), key=lambda path: path.name)
    if not source_paths:
        raise GraphBuildError(f"no module source JSON files found in {source_dir}")

    merged: dict[str, list[dict[str, Any]]] = {key: [] for key in ARRAY_KEYS}
    graph_versions: set[str] = set()
    for source_path in source_paths:
        source = _read_json(source_path)
        _validate(source, module_schema, source_path)
        if source["module_file_id"] != source_path.stem:
            raise GraphBuildError(
                f"{source_path}: module_file_id must match filename stem {source_path.stem!r}"
            )
        family = source["module_family"]
        populated = {key for key in ARRAY_KEYS if source.get(key)}
        unexpected = populated - FAMILY_CONTENT[family]
        if unexpected:
            raise GraphBuildError(
                f"{source_path}: module family {family!r} cannot contain: "
                f"{', '.join(sorted(unexpected))}"
            )
        graph_versions.add(source["graph_version"])
        for key in ARRAY_KEYS:
            merged[key].extend(copy.deepcopy(source.get(key, [])))

    if len(graph_versions) != 1:
        raise GraphBuildError(
            f"source graph_version values must match; found: {', '.join(sorted(graph_versions))}"
        )

    for key, id_key in ID_KEYS.items():
        merged[key].sort(key=lambda item: item[id_key])

    def source_label(path: Path) -> str:
        try:
            return path.relative_to(root).as_posix()
        except ValueError:
            return path.name

    graph: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "graph_version": next(iter(graph_versions), DEFAULT_GRAPH_VERSION),
        "generated_at": generated_at
        or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source_files": [source_label(source_path) for source_path in source_paths],
        **merged,
        "indexes": {},
    }
    warnings = _validate_links(graph, root)
    graph["indexes"] = _build_indexes(graph)
    _validate(graph, schema, schema_path)
    return graph, warnings


def write_graph_atomic(graph: dict[str, Any], output_path: Path) -> None:
    """Write a completed graph atomically, preserving an existing dist on failure."""
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary = Path(handle.name)
            json.dump(graph, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, output_path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def _parser(default_root: Path) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--sources", type=Path, help="module source directory")
    parser.add_argument("--schema", type=Path, help="graph JSON Schema")
    parser.add_argument("--output", type=Path, help="distribution output path")
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate and build in memory without writing dist",
    )
    parser.add_argument("--generated-at", help=argparse.SUPPRESS)
    return parser


def main(argv: list[str] | None = None) -> int:
    default_root = Path(__file__).resolve().parents[1]
    args = _parser(default_root).parse_args(argv)
    root = args.root.resolve()
    source_dir = (args.sources or root / "concepts").resolve()
    schema_path = (
        args.schema or root / "schemas" / "visual-concept-graph.schema.json"
    ).resolve()
    output_path = (
        args.output or root / "dist" / "visual-concept-graph.json"
    ).resolve()
    try:
        graph, warnings = build_graph(
            root, source_dir, schema_path, generated_at=args.generated_at
        )
        for warning in warnings:
            print(f"warning: {warning}", file=sys.stderr)
        if args.check:
            print(
                f"Visual Concept Graph valid: {len(graph['concepts'])} concepts, "
                f"{len(graph['relations'])} relations, "
                f"{len(graph['target_patterns'])} target patterns"
            )
        else:
            write_graph_atomic(graph, output_path)
            print(f"Visual Concept Graph written: {output_path}")
        return 0
    except (GraphBuildError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # pragma: no cover - unexpected configuration/runtime failures
        print(f"fatal: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
