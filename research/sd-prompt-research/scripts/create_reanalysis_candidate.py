#!/usr/bin/env python3
"""Create a noncanonical observation candidate from auditable panel overrides."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import yaml


def apply_overrides(data: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    result = dict(data)
    result.pop("computed_aggregate", None)
    axes = list(result["active_axis_order"])
    axis_index = {axis: index for index, axis in enumerate(axes)}
    panels = {int(panel["panel_id"]): panel for panel in result["panels"]}

    for field in (
        "summary", "leakage", "uncertain", "ontology_extension_candidates", "cross_condition_comparison"
    ):
        if field in overrides:
            result[field] = overrides[field]

    for panel_id_raw, changes in (overrides.get("panels") or {}).items():
        panel_id = int(panel_id_raw)
        if panel_id not in panels:
            raise ValueError(f"Unknown panel_id in overrides: {panel_id}")
        panel = panels[panel_id]
        for axis, value in (changes.get("axis_values") or {}).items():
            if axis not in axis_index:
                raise ValueError(f"Unknown axis in overrides: {axis}")
            panel["axis_values"][axis_index[axis]] = value
        for field in (
            "primary_morphology", "secondary_morphologies", "evidence_notes",
            "cross_domain_effects", "artifacts", "confidence", "contact_load",
        ):
            if field in changes:
                panel[field] = changes[field]

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--overrides", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    run_dir = args.run_dir.resolve()
    output = args.output.resolve() if args.output else run_dir / "observation.reanalysis.json"
    data = json.loads((run_dir / "observation.json").read_text(encoding="utf-8"))
    overrides = yaml.safe_load(args.overrides.read_text(encoding="utf-8")) or {}
    candidate = apply_overrides(data, overrides)
    output.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
