#!/usr/bin/env python3
"""Render canonical observation.json as a human-readable Markdown report."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import yaml


def bullet_lines(values: list[str], empty: str = "none_observed") -> list[str]:
    return [f"- {value}" for value in values] if values else [f"- {empty}"]


def observed_morphologies(data: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for panel in data.get("panels", []):
        values.append(str(panel.get("primary_morphology")))
        values.extend(str(value) for value in panel.get("secondary_morphologies", []))
    return list(dict.fromkeys(value for value in values if value and value != "None"))


def render(data: dict[str, Any], rubric: dict[str, Any]) -> str:
    axes = data["active_axis_order"]
    catalog = rubric.get("axis_catalog") or {}
    lines: list[str] = [
        "# Observation Report",
        "",
        "## Run Summary",
        "",
        f"- Run ID: {data['run_id']}",
        f"- Condition: {data['blind_condition_label']}",
        f"- Panel Count: {data['panel_count']}",
        f"- Image Layout: {data['image_layout']}",
        "- Overall Visible Pattern:",
    ]
    lines.extend([f"  - {item}" for item in data["summary"]["overall_visible_pattern"]] or ["  - none_observed"])
    lines.append("- Analysis Notes:")
    lines.extend([f"  - {item}" for item in data["summary"]["analysis_notes"]] or ["  - none_observed"])

    lines.extend(["", "## Panel-by-Panel Observations", ""])
    for panel in sorted(data["panels"], key=lambda item: item["panel_id"]):
        lines.extend([f"### Panel {panel['panel_id']}", ""])
        for axis, value in zip(axes, panel["axis_values"], strict=True):
            label = (catalog.get(axis) or {}).get("label", axis)
            lines.append(f"- {label}: {value}")
        lines.append(f"- Primary Pose Morphology: {panel['primary_morphology']}")
        secondary = panel.get("secondary_morphologies") or []
        lines.append(f"- Secondary Pose Morphologies: {', '.join(secondary) if secondary else 'none_observed'}")
        lines.append("- Evidence Notes:")
        lines.extend([f"  - {item}" for item in panel.get("evidence_notes", [])] or ["  - none_observed"])
        lines.append("- Cross-domain Effects:")
        effects = panel.get("cross_domain_effects", [])
        if effects:
            for effect in effects:
                lines.extend([
                    f"  - Domain: {effect['domain']}",
                    f"    - Strength: {effect['strength']}",
                    f"    - Effect Type: {effect['effect_type']}",
                    f"    - Observation: {effect['observation']}",
                ])
        else:
            lines.append("  - none_observed")
        artifacts = [value for value in panel.get("artifacts", []) if value != "none"]
        lines.append(f"- Visual Artifacts: {', '.join(artifacts) if artifacts else 'none observed'}")
        lines.append(f"- Confidence: {panel['confidence']}")
        lines.append("")

    aggregate = data.get("computed_aggregate") or {}
    lines.extend(["## Computed Aggregate", ""])
    axis_counts = aggregate.get("axis_counts") or {}
    if axis_counts:
        for axis in axes:
            label = (catalog.get(axis) or {}).get("label", axis)
            counts = axis_counts.get(axis, {})
            formatted = ", ".join(f"{value}={count}/6" for value, count in sorted(counts.items()))
            lines.append(f"- {label}: {formatted}")
    else:
        lines.append("- Not generated. Run finalize_observation.py first.")

    visual_artifacts = sorted({
        artifact
        for panel in data.get("panels", [])
        for artifact in panel.get("artifacts", [])
        if artifact != "none"
    })
    lines.extend(["", "## Visual Artifacts", ""])
    lines.extend(bullet_lines(visual_artifacts, "none observed"))

    lines.extend(["", "## Prompt / Concept Leakage", ""])
    if data.get("leakage"):
        for item in data["leakage"]:
            panels = ", ".join(str(value) for value in item["panel_ids"])
            lines.append(
                f"- {item['type']}: panels [{panels}], strength={item['strength']}. {item['observation']}"
            )
    else:
        lines.append("- not assessed")

    lines.extend(["", "## Observed Morphologies", ""])
    lines.extend(bullet_lines(observed_morphologies(data), "none observed"))

    lines.extend(["", "## Uncertain", ""])
    if data.get("uncertain"):
        for item in data["uncertain"]:
            lines.append(f"- Panel {item['panel_id']} / {item['field']}: {item['reason']}")
    else:
        lines.append("- none")

    lines.extend(["", "## Ontology Extension Candidates", ""])
    if data.get("ontology_extension_candidates"):
        for item in data["ontology_extension_candidates"]:
            panels = ", ".join(str(value) for value in item["panel_ids"])
            lines.append(
                f"- {item['field']} -> {item['candidate_value']} / panels [{panels}]: {item['observation']}"
            )
    else:
        lines.append("- none")

    comparison = data["cross_condition_comparison"]
    lines.extend(["", "## Cross-condition Comparison", ""])
    lines.append(f"- Status: {comparison['status']}")
    lines.append(f"- Reason: {comparison['reason'] or 'not_applicable'}")
    if comparison["observations"]:
        for item in comparison["observations"]:
            lines.append(f"- {item['field']}: {item['observation']}")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--observation", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    run_dir = args.run_dir.expanduser().resolve()
    observation_path = args.observation.expanduser().resolve() if args.observation else run_dir / "observation.json"
    rubric_path = run_dir / "source" / "rubric.yaml"
    output_path = args.output.expanduser().resolve() if args.output else run_dir / "observation.md"

    data = json.loads(observation_path.read_text(encoding="utf-8"))
    rubric = yaml.safe_load(rubric_path.read_text(encoding="utf-8")) or {}
    output_path.write_text(render(data, rubric), encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
