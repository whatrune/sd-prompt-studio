#!/usr/bin/env python3
"""Validate and aggregate an optional face-observation.json without modifying pose observation data."""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator


def schema_errors(data: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    validator = Draft202012Validator(schema)
    for error in sorted(validator.iter_errors(data), key=lambda item: list(item.absolute_path)):
        location = ".".join(str(part) for part in error.absolute_path) or "<root>"
        errors.append(f"{location}: {error.message}")
    return errors


def policy_errors(data: dict[str, Any], rubric: dict[str, Any], manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    run_id = str(manifest.get("run_id") or "")
    if data.get("run_id") != run_id:
        errors.append(f"run_id must match manifest: {run_id!r}")

    face = data.get("face_observation") or {}
    if not isinstance(face, dict):
        return errors + ["face_observation must be an object"]
    active_axes = rubric.get("active_face_axes") or []
    if face.get("active_axis_order") != active_axes:
        errors.append("face_observation.active_axis_order must exactly match rubric.active_face_axes")

    raw_panels = face.get("panels") or []
    if not isinstance(raw_panels, list):
        return errors + ["face_observation.panels must be an array"]
    panels = [panel for panel in raw_panels if isinstance(panel, dict)]
    panel_ids = [panel.get("panel_id") for panel in panels]
    valid_panel_ids = (
        len(panels) == len(raw_panels) == 6
        and all(type(panel_id) is int for panel_id in panel_ids)
        and sorted(panel_ids) == [1, 2, 3, 4, 5, 6]
    )
    if not valid_panel_ids:
        errors.append(f"panel_id values must be exactly integer IDs 1..6, got {panel_ids!r}")

    catalog = rubric.get("axis_catalog") or {}
    prohibited = [term.casefold() for term in ((rubric.get("rules") or {}).get("emotion_terms_prohibited") or [])]
    panel_by_id = {
        panel["panel_id"]: panel
        for panel in panels
        if type(panel.get("panel_id")) is int
    }
    for panel in panels:
        panel_id = panel.get("panel_id")
        for axis in active_axes:
            allowed = (catalog.get(axis) or {}).get("allowed_values") or []
            if panel.get(axis) not in allowed:
                errors.append(f"Panel {panel_id}: {axis}={panel.get(axis)!r}; allowed={allowed}")
        notes = " ".join(str(note) for note in panel.get("evidence_notes") or []).casefold()
        for term in prohibited:
            if term in notes:
                errors.append(f"Panel {panel_id}: emotion meaning {term!r} is prohibited in evidence_notes")

    allowed_regions = set((rubric.get("cross_domain_effects") or {}).get("evidence_regions") or [])
    effects = data.get("cross_domain_effects") or []
    if ((rubric.get("cross_domain_effects") or {}).get("observation_stage") == "must_be_empty" and effects):
        errors.append(
            "cross_domain_effects must remain empty during observation-only finalization; "
            "effect selection belongs to the Research Interpretation Layer"
        )
    for effect in effects:
        if not isinstance(effect, dict):
            continue
        panel_id = effect.get("panel_id")
        panel = panel_by_id.get(panel_id) or {}
        observed = str(effect.get("observed_effect") or "")
        if ":" not in observed:
            errors.append(f"Panel {panel_id}: observed_effect must use '<axis_id>:<observed_value>'")
            continue
        axis, value = observed.split(":", 1)
        if axis not in active_axes:
            errors.append(f"Panel {panel_id}: cross-domain axis {axis!r} is not active")
        elif panel.get(axis) != value:
            errors.append(
                f"Panel {panel_id}: observed_effect {observed!r} does not match panel value {panel.get(axis)!r}"
            )
        if allowed_regions and effect.get("evidence_region") not in allowed_regions:
            errors.append(f"Panel {panel_id}: invalid evidence_region {effect.get('evidence_region')!r}")
        if any(term in observed.casefold() for term in prohibited):
            errors.append(f"Panel {panel_id}: observed_effect contains prohibited emotion meaning")
    return errors


def compute_aggregate(data: dict[str, Any]) -> dict[str, Any]:
    face = data["face_observation"]
    axis_counts = {axis: Counter() for axis in face["active_axis_order"]}
    effect_counts: Counter[str] = Counter()
    for panel in face["panels"]:
        for axis in face["active_axis_order"]:
            axis_counts[axis][panel[axis]] += 1
    for effect in data.get("cross_domain_effects") or []:
        effect_counts[effect["observed_effect"]] += 1
    return {
        "axis_counts": {axis: dict(sorted(counts.items())) for axis, counts in axis_counts.items()},
        "cross_domain_effect_counts": dict(sorted(effect_counts.items())),
    }


def stored_aggregate_errors(data: dict[str, Any]) -> list[str]:
    """Require a stored aggregate and verify that it exactly matches panel data."""
    stored = data.get("computed_aggregate")
    if stored is None:
        return ["computed_aggregate is required for a finalized face observation"]
    try:
        expected = compute_aggregate(data)
    except (KeyError, TypeError) as exc:
        return [f"computed_aggregate cannot be verified against invalid panel data: {exc}"]
    if stored != expected:
        return ["computed_aggregate does not match the aggregate recomputed from panel data"]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--face-observation", type=Path)
    parser.add_argument("--rubric", type=Path)
    parser.add_argument("--schema", type=Path)
    parser.add_argument("--no-write", action="store_true")
    args = parser.parse_args()

    run_dir = args.run_dir.expanduser().resolve()
    root = run_dir.parents[2]
    observation_path = args.face_observation or run_dir / "face-observation.json"
    rubric_path = args.rubric or root / "templates" / "face-observation-rubric.yaml"
    schema_path = args.schema or root / "templates" / "face-observation-schema.json"
    manifest_path = run_dir / "manifest.yaml"
    try:
        data = json.loads(observation_path.read_text(encoding="utf-8"))
        rubric = yaml.safe_load(rubric_path.read_text(encoding="utf-8")) or {}
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    analyst_data = dict(data)
    analyst_data.pop("computed_aggregate", None)
    errors = schema_errors(analyst_data, schema)
    if not errors:
        errors.extend(policy_errors(analyst_data, rubric, manifest))
    if args.no_write and not errors:
        finalized_schema_errors = schema_errors(data, schema)
        errors.extend(finalized_schema_errors)
        if not finalized_schema_errors:
            errors.extend(stored_aggregate_errors(data))
    if errors:
        print("Face observation validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    if not args.no_write:
        analyst_data["computed_aggregate"] = compute_aggregate(analyst_data)
        final_errors = schema_errors(analyst_data, schema)
        if final_errors:
            print("Internal face aggregate validation failed:", file=sys.stderr)
            for error in final_errors:
                print(f"- {error}", file=sys.stderr)
            return 3
        observation_path.write_text(
            json.dumps(analyst_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    print(f"VALID: {observation_path}")
    print(f"Face panels: {len((analyst_data.get('face_observation') or {}).get('panels') or [])}")
    print(f"Face axes: {len((analyst_data.get('face_observation') or {}).get('active_axis_order') or [])}")
    if not args.no_write:
        print("face computed_aggregate added; pose observation.json unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
