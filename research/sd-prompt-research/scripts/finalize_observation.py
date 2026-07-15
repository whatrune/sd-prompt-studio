#!/usr/bin/env python3
"""Validate an Image Analyst observation JSON, compute aggregates, and mark the run OBSERVED."""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load_json_allow_fence(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8").strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines).strip()
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Observation root must be a JSON object")
    return value


def schema_errors(data: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    validator = Draft202012Validator(schema)
    errors: list[str] = []
    for error in sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path)):
        location = ".".join(str(part) for part in error.absolute_path) or "<root>"
        errors.append(f"{location}: {error.message}")
    return errors


def _has_all(text: str, *groups: tuple[str, ...]) -> bool:
    return all(any(term in text for term in group) for group in groups)


def visible_evidence_errors(
    data: dict[str, Any], rubric: dict[str, Any], active_axes: list[str]
) -> list[str]:
    """Require auditable notes for values that claim direct contact, clearance, or load.

    This policy is opt-in per rubric so historical Run rubrics remain valid. It does
    not decide whether the image evidence is true; it prevents a confirmed value
    from being stored without a note naming the visible evidence used.
    """
    if not (rubric.get("rules") or {}).get("enforce_visible_evidence_policy"):
        return []

    errors: list[str] = []
    direct = ("visible", "visibly", "direct", "clear", "clearly", "視認", "見える", "明確")
    contact = ("contact", "touch", "boundary", "接触", "境界")
    separation = (
        "gap", "clearance", "separation", "off the surface", "above the surface", "隙間", "離れ", "浮い"
    )
    load_path = (
        "load path", "weight transfer", "supports", "supporting", "stability", "bears weight",
        "荷重経路", "荷重", "支持", "安定", "体重",
    )
    axis_index = {axis: index for index, axis in enumerate(active_axes)}

    if data.get("leakage"):
        errors.append("Prompt / Concept Leakage is research-stage only; Image Analyst leakage must remain empty")

    def axis_value(panel: dict[str, Any], axis: str) -> str | None:
        index = axis_index.get(axis)
        values = panel.get("axis_values") or []
        return values[index] if index is not None and index < len(values) else None

    for panel in data.get("panels", []):
        panel_id = panel.get("panel_id")
        notes = " ".join(str(note).lower() for note in panel.get("evidence_notes", []))
        if any(effect.get("effect_type") == "leakage" for effect in panel.get("cross_domain_effects", [])):
            errors.append(
                f"Panel {panel_id}: cross-domain effect_type='leakage' is research-stage only and cannot be assigned by Image Analyst"
            )

        hip = axis_value(panel, "hip_elevation")
        if hip == "on_surface" and not _has_all(notes, ("pelvis", "hip", "骨盤", "臀部"), direct, contact):
            errors.append(
                f"Panel {panel_id}: hip_elevation='on_surface' requires Evidence Notes naming a directly visible pelvis-to-surface contact boundary"
            )
        if hip in {"low", "medium", "high", "extreme"} and not _has_all(
            notes, ("pelvis", "hip", "骨盤", "臀部"), direct, separation
        ):
            errors.append(
                f"Panel {panel_id}: hip_elevation={hip!r} requires Evidence Notes naming a directly visible pelvis-to-surface gap"
            )

        head = axis_value(panel, "head_surface_contact")
        if head not in {None, "absent", "unclear", "not_visible", "not_applicable"} and not _has_all(
            notes, ("head", "skull", "頭部", "頭"), direct, contact
        ):
            errors.append(
                f"Panel {panel_id}: head_surface_contact={head!r} requires a directly visible head contact boundary in Evidence Notes"
            )
        if head == "absent" and not _has_all(notes, ("head", "skull", "頭部", "頭"), direct, separation):
            errors.append(
                f"Panel {panel_id}: head_surface_contact='absent' requires directly visible head-to-surface separation in Evidence Notes"
            )

        shoulder = axis_value(panel, "shoulder_surface_contact")
        if shoulder in {"both", "left_only", "right_only"} and not _has_all(
            notes, ("shoulder", "肩"), direct, contact
        ):
            errors.append(
                f"Panel {panel_id}: shoulder_surface_contact={shoulder!r} requires a directly visible shoulder contact boundary in Evidence Notes"
            )
        if shoulder == "absent" and not _has_all(notes, ("shoulder", "肩"), direct, separation):
            errors.append(
                f"Panel {panel_id}: shoulder_surface_contact='absent' requires directly visible shoulder-to-surface separation in Evidence Notes"
            )

        support = axis_value(panel, "support_orientation")
        support_body_terms = {
            "posterior_body_support": ("head", "shoulder", "back", "pelvis", "posterior", "頭", "肩", "背", "骨盤"),
            "rear_arm_support": ("hand", "arm", "forearm", "手", "腕", "前腕"),
            "inferior_foot_support": ("foot", "feet", "sole", "足", "足底"),
            "mixed_support": ("mixed", "multiple", "hand", "arm", "foot", "back", "pelvis", "複数", "混在"),
            "prone_quadruped": ("hand", "arm", "knee", "foot"),
            "reverse_quadruped": ("hand", "arm", "foot"),
            "lateral_support": ("side", "lateral", "arm", "leg"),
            "supine_support": ("head", "shoulder", "back", "pelvis", "posterior"),
            "kneeling_hand_support": ("hand", "knee"),
        }
        if support in support_body_terms and not _has_all(notes, support_body_terms[support], direct, load_path):
            errors.append(
                f"Panel {panel_id}: support_orientation={support!r} requires a directly visible support/load path in Evidence Notes"
            )

        load_body_terms = {
            "left_hand": ("left hand", "hand"),
            "right_hand": ("right hand", "hand"),
            "left_forearm": ("left forearm", "forearm"),
            "right_forearm": ("right forearm", "forearm"),
        }
        for field, value in (panel.get("contact_load") or {}).items():
            if value in {"supporting", "weight_bearing"} and not _has_all(
                notes, load_body_terms.get(field, (field.replace("_", " "),)), direct, load_path
            ):
                errors.append(
                    f"Panel {panel_id}: contact_load.{field}={value!r} requires a directly visible load path in Evidence Notes"
                )

        visibility = axis_value(panel, "support_evidence_visibility")
        if visibility in {"partial", "occluded", "out_of_frame"} and panel.get("confidence") == "high":
            errors.append(
                f"Panel {panel_id}: confidence cannot be high when support_evidence_visibility is {visibility!r}"
            )

    return errors


def rubric_errors(data: dict[str, Any], rubric: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    expected_run = str(rubric.get("run_id") or "").strip()
    if expected_run and data.get("run_id") != expected_run:
        errors.append(f"run_id must be {expected_run!r}, got {data.get('run_id')!r}")

    expected_condition = str(rubric.get("blind_condition_label") or "").strip()
    if expected_condition and data.get("blind_condition_label") != expected_condition:
        errors.append(
            f"blind_condition_label must be {expected_condition!r}, got {data.get('blind_condition_label')!r}"
        )

    active_axes = rubric.get("active_observation_axes") or []
    if data.get("active_axis_order") != active_axes:
        errors.append("active_axis_order must exactly match rubric.active_observation_axes")

    axis_catalog = rubric.get("axis_catalog") or {}
    panel_ids: list[int] = []
    for panel in data.get("panels", []):
        panel_id = panel.get("panel_id")
        panel_ids.append(panel_id)
        values = panel.get("axis_values") or []
        if len(values) != len(active_axes):
            errors.append(
                f"Panel {panel_id}: axis_values has {len(values)} values; expected {len(active_axes)}"
            )
            continue
        for index, (axis_id, value) in enumerate(zip(active_axes, values, strict=True)):
            axis = axis_catalog.get(axis_id)
            if not isinstance(axis, dict):
                errors.append(f"Rubric is missing axis_catalog.{axis_id}")
                continue
            allowed = axis.get("allowed_values") or []
            if value not in allowed:
                errors.append(
                    f"Panel {panel_id}: axis_values[{index}] for {axis_id} is {value!r}; allowed={allowed}"
                )

    if sorted(panel_ids) != [1, 2, 3, 4, 5, 6]:
        errors.append(f"panel_id values must be exactly 1..6, got {sorted(panel_ids)}")

    morphology = rubric.get("morphology_candidates") or {}
    primary_allowed = set(morphology.get("primary") or [])
    secondary_allowed = set(morphology.get("secondary") or [])
    artifact_allowed = set(rubric.get("artifact_checks") or [])
    cross = rubric.get("cross_domain_effects") or {}
    domain_allowed = set(cross.get("domains") or [])
    strength_allowed = set(cross.get("strength_values") or [])
    effect_type_allowed = set(cross.get("effect_type_values") or [])

    for panel in data.get("panels", []):
        panel_id = panel.get("panel_id")
        primary = panel.get("primary_morphology")
        if primary_allowed and primary not in primary_allowed:
            errors.append(f"Panel {panel_id}: invalid primary_morphology {primary!r}")
        for secondary in panel.get("secondary_morphologies", []):
            if secondary_allowed and secondary not in secondary_allowed:
                errors.append(f"Panel {panel_id}: invalid secondary morphology {secondary!r}")

        artifacts = panel.get("artifacts", [])
        for artifact in artifacts:
            if artifact_allowed and artifact not in artifact_allowed:
                errors.append(f"Panel {panel_id}: invalid artifact {artifact!r}")
        if "none" in artifacts and len(artifacts) > 1:
            errors.append(f"Panel {panel_id}: artifact 'none' cannot be combined with other artifacts")

        for effect in panel.get("cross_domain_effects", []):
            if domain_allowed and effect.get("domain") not in domain_allowed:
                errors.append(f"Panel {panel_id}: invalid cross-domain domain {effect.get('domain')!r}")
            if strength_allowed and effect.get("strength") not in strength_allowed:
                errors.append(f"Panel {panel_id}: invalid cross-domain strength {effect.get('strength')!r}")
            if effect_type_allowed and effect.get("effect_type") not in effect_type_allowed:
                errors.append(f"Panel {panel_id}: invalid cross-domain effect_type {effect.get('effect_type')!r}")

    known_leakage = set(rubric.get("known_leakage_candidates") or [])
    for leakage in data.get("leakage", []):
        leakage_type = leakage.get("type")
        if known_leakage and leakage_type not in known_leakage:
            warnings.append(
                f"Leakage type {leakage_type!r} is not in known_leakage_candidates; review as an ontology candidate"
            )

    errors.extend(visible_evidence_errors(data, rubric, active_axes))

    return errors, warnings


def compute_aggregate(data: dict[str, Any]) -> dict[str, Any]:
    axes = data["active_axis_order"]
    axis_counts: dict[str, Counter[str]] = {axis: Counter() for axis in axes}
    primary_counts: Counter[str] = Counter()
    secondary_counts: Counter[str] = Counter()
    artifact_counts: Counter[str] = Counter()
    cross_counts: dict[str, Counter[str]] = defaultdict(Counter)
    leakage_counts: Counter[str] = Counter()

    for panel in data["panels"]:
        for axis, value in zip(axes, panel["axis_values"], strict=True):
            axis_counts[axis][value] += 1
        primary_counts[panel["primary_morphology"]] += 1
        secondary_counts.update(panel.get("secondary_morphologies", []))
        artifact_counts.update(panel.get("artifacts", []))
        for effect in panel.get("cross_domain_effects", []):
            key = f"{effect['effect_type']}:{effect['strength']}"
            cross_counts[effect["domain"]][key] += 1

    for item in data.get("leakage", []):
        leakage_counts[item["type"]] += len(item.get("panel_ids", []))

    return {
        "axis_counts": {axis: dict(counter) for axis, counter in axis_counts.items()},
        "primary_morphology_counts": dict(primary_counts),
        "secondary_morphology_counts": dict(secondary_counts),
        "artifact_counts": dict(artifact_counts),
        "cross_domain_effect_counts": {domain: dict(counter) for domain, counter in cross_counts.items()},
        "leakage_counts": dict(leakage_counts),
    }


def update_manifest(run_dir: Path) -> None:
    manifest_path = run_dir / "manifest.yaml"
    if not manifest_path.exists():
        return
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    manifest["status"] = "OBSERVED"
    manifest["updated_at"] = now_iso()
    workflow = manifest.setdefault("workflow", {})
    workflow["assigned_to"] = "研究担当ChatGPT"
    manifest_path.write_text(
        yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, help="Run directory containing observation.json and source/rubric.yaml")
    parser.add_argument("--observation", type=Path, help="Observation JSON path")
    parser.add_argument("--rubric", type=Path, help="Rubric YAML path")
    parser.add_argument("--schema", type=Path, help="Observation JSON Schema path")
    parser.add_argument("--no-write", action="store_true", help="Validate without adding computed_aggregate or updating files")
    args = parser.parse_args()

    if args.run_dir:
        run_dir = args.run_dir.expanduser().resolve()
        observation_path = args.observation or run_dir / "observation.json"
        rubric_path = args.rubric or run_dir / "source" / "rubric.yaml"
        root = run_dir.parents[2]
        schema_path = args.schema or root / "templates" / "observation-schema.json"
    else:
        if not args.observation or not args.rubric:
            parser.error("Use --run-dir, or provide both --observation and --rubric")
        run_dir = None
        observation_path = args.observation.expanduser().resolve()
        rubric_path = args.rubric.expanduser().resolve()
        schema_path = (
            args.schema.expanduser().resolve()
            if args.schema
            else Path(__file__).resolve().parents[1] / "templates" / "observation-schema.json"
        )

    try:
        data = load_json_allow_fence(observation_path)
        rubric = yaml.safe_load(rubric_path.read_text(encoding="utf-8")) or {}
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    # Validate the analyst payload without trusting any pre-existing aggregate.
    data_without_aggregate = dict(data)
    data_without_aggregate.pop("computed_aggregate", None)
    errors = schema_errors(data_without_aggregate, schema)
    rubric_error_list, warnings = rubric_errors(data_without_aggregate, rubric)
    errors.extend(rubric_error_list)

    if errors:
        print("Observation validation failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"WARNING: {warning}", file=sys.stderr)

    if not args.no_write:
        data_without_aggregate["computed_aggregate"] = compute_aggregate(data_without_aggregate)
        final_errors = schema_errors(data_without_aggregate, schema)
        if final_errors:
            print("Internal aggregate validation failed:", file=sys.stderr)
            for item in final_errors:
                print(f"- {item}", file=sys.stderr)
            return 3
        observation_path.write_text(
            json.dumps(data_without_aggregate, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        if run_dir is not None:
            update_manifest(run_dir)

    print(f"VALID: {observation_path}")
    print(f"Panels: {len(data_without_aggregate['panels'])}")
    print(f"Axes per panel: {len(data_without_aggregate['active_axis_order'])}")
    if not args.no_write:
        print("computed_aggregate added and run marked OBSERVED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
