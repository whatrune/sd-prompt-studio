#!/usr/bin/env python3
"""Validate and aggregate an optional hair-observation.json without modifying pose or face data."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Mapping

import yaml
from jsonschema import Draft202012Validator


HAIR_V1_AXES: dict[str, tuple[str, ...]] = {
    "hair_length_extent": (
        "above_neck", "neck_to_shoulder", "below_shoulder",
        "waist_or_longer", "unclear", "not_visible",
    ),
    "neck_hair_overlap": ("present", "absent", "unclear", "not_visible"),
    "shoulder_hair_overlap": ("present", "absent", "unclear", "not_visible"),
    "hair_identity_clarity": (
        "distinct", "ambiguous_with_clothing", "ambiguous_with_background",
        "artifact", "not_visible",
    ),
}


def schema_errors(data: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    validator = Draft202012Validator(schema)
    for error in sorted(validator.iter_errors(data), key=lambda item: list(item.absolute_path)):
        location = ".".join(str(part) for part in error.absolute_path) or "<root>"
        errors.append(f"{location}: {error.message}")
    return errors


def policy_errors(
    data: dict[str, Any], rubric: dict[str, Any], manifest: dict[str, Any]
) -> list[str]:
    errors: list[str] = []
    run_id = str(manifest.get("run_id") or "")
    if not run_id:
        errors.append("manifest.run_id is required")
    elif data.get("run_id") != run_id:
        errors.append(f"run_id must match manifest: {run_id!r}")

    expected_axes = list(HAIR_V1_AXES)
    if rubric.get("active_hair_axes") != expected_axes:
        errors.append("rubric.active_hair_axes must exactly match the frozen Hair V1 axes")
    catalog = rubric.get("axis_catalog") or {}
    for axis, allowed_values in HAIR_V1_AXES.items():
        configured = (catalog.get(axis) or {}).get("allowed_values") or []
        if configured != list(allowed_values):
            errors.append(f"rubric axis {axis!r} allowed_values must exactly match Hair V1")

    hair = data.get("hair_observation") or {}
    if not isinstance(hair, dict):
        return errors + ["hair_observation must be an object"]
    if hair.get("active_axis_order") != expected_axes:
        errors.append("hair_observation.active_axis_order must exactly match rubric.active_hair_axes")

    raw_panels = hair.get("panels") or []
    if not isinstance(raw_panels, list):
        return errors + ["hair_observation.panels must be an array"]
    panels = [panel for panel in raw_panels if isinstance(panel, dict)]
    panel_ids = [panel.get("panel_id") for panel in panels]
    valid_panel_ids = (
        len(panels) == len(raw_panels) == 6
        and all(type(panel_id) is int for panel_id in panel_ids)
        and sorted(panel_ids) == [1, 2, 3, 4, 5, 6]
    )
    if not valid_panel_ids:
        errors.append(f"panel_id values must be exactly integer IDs 1..6, got {panel_ids!r}")

    for panel in panels:
        panel_id = panel.get("panel_id")
        for axis, allowed_values in HAIR_V1_AXES.items():
            if panel.get(axis) not in allowed_values:
                errors.append(
                    f"Panel {panel_id}: {axis}={panel.get(axis)!r}; allowed={list(allowed_values)}"
                )
    return errors


def compute_aggregate(data: Mapping[str, Any]) -> dict[str, Any]:
    hair = data["hair_observation"]
    axis_counts = {
        axis: {value: 0 for value in allowed_values}
        for axis, allowed_values in HAIR_V1_AXES.items()
    }
    for panel in hair["panels"]:
        for axis in HAIR_V1_AXES:
            axis_counts[axis][panel[axis]] += 1
    return {"axis_counts": axis_counts}


def stored_aggregate_errors(data: dict[str, Any]) -> list[str]:
    stored = data.get("computed_aggregate")
    if stored is None:
        return ["computed_aggregate is required for a finalized hair observation"]
    try:
        expected = compute_aggregate(data)
    except (KeyError, TypeError) as exc:
        return [f"computed_aggregate cannot be verified against invalid panel data: {exc}"]
    if stored != expected:
        return ["computed_aggregate does not match the aggregate recomputed from panel data"]
    for axis, counts in stored["axis_counts"].items():
        if sum(counts.values()) != 6:
            return [f"computed_aggregate.axis_counts.{axis} must sum exactly to 6"]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--hair-observation", type=Path)
    parser.add_argument("--rubric", type=Path)
    parser.add_argument("--schema", type=Path)
    parser.add_argument("--no-write", action="store_true")
    args = parser.parse_args()

    run_dir = args.run_dir.expanduser().resolve()
    root = run_dir.parents[2]
    observation_path = args.hair_observation or run_dir / "hair-observation.json"
    rubric_path = args.rubric or root / "templates" / "hair-observation-rubric.yaml"
    schema_path = args.schema or root / "templates" / "hair-observation-schema.json"
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
        print("Hair observation validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    if not args.no_write:
        analyst_data["computed_aggregate"] = compute_aggregate(analyst_data)
        final_errors = schema_errors(analyst_data, schema)
        if not final_errors:
            final_errors.extend(stored_aggregate_errors(analyst_data))
        if final_errors:
            print("Internal hair aggregate validation failed:", file=sys.stderr)
            for error in final_errors:
                print(f"- {error}", file=sys.stderr)
            return 3
        observation_path.write_text(
            json.dumps(analyst_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    print(f"VALID: {observation_path}")
    print(f"Hair panels: {len((analyst_data.get('hair_observation') or {}).get('panels') or [])}")
    print(f"Hair axes: {len((analyst_data.get('hair_observation') or {}).get('active_axis_order') or [])}")
    if not args.no_write:
        print("hair computed_aggregate added; pose and face observations unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
