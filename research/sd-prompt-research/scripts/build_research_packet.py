#!/usr/bin/env python3
"""Build a compact PDF packet from one Run or grouped condition Runs."""
from __future__ import annotations

import argparse
import html
import io
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image, KeepTogether, PageBreak, Paragraph, Preformatted, SimpleDocTemplate,
    Spacer, Table, TableStyle,
)

from finalize_face_observation import policy_errors, schema_errors, stored_aggregate_errors

FONT_CANDIDATES = (
    (Path("C:/Windows/Fonts/BIZ-UDGothicR.ttc"), Path("C:/Windows/Fonts/BIZ-UDGothicB.ttc")),
    (Path("C:/Windows/Fonts/NotoSansJP-VF.ttf"), Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")),
    (Path("C:/Windows/Fonts/meiryo.ttc"), Path("C:/Windows/Fonts/meiryob.ttc")),
)
COMPARE_FIELDS = (
    "body_state", "hip_elevation", "support_structure", "hand_contact",
    "contact_load", "head_surface_contact", "shoulder_surface_contact",
    "primary_morphology",
)
FACE_COMPARE_FIELDS = (
    "neck_extension", "chin_elevation", "face_orientation", "face_visibility",
    "gaze_direction", "eyelid_state", "mouth_state", "facial_foreshortening",
    "facial_distortion",
)
FACE_COMPARE_GROUPS = tuple(
    FACE_COMPARE_FIELDS[index:index + 3] for index in range(0, len(FACE_COMPARE_FIELDS), 3)
)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def register_fonts() -> tuple[str, str]:
    for regular, bold in FONT_CANDIDATES:
        if regular.exists() and bold.exists():
            try:
                pdfmetrics.registerFont(TTFont("Packet", str(regular)))
                pdfmetrics.registerFont(TTFont("PacketBold", str(bold)))
                return "Packet", "PacketBold"
            except Exception:
                pass
    raise RuntimeError("No usable Japanese font was found.")


def discover_runs(root: Path, domain: str, run_id: str) -> tuple[str, list[Path]]:
    domain_dir = root / "experiments" / domain
    pattern = re.compile(rf"^{re.escape(run_id)}-([A-Z]+)$", re.I)
    grouped = sorted(
        (p for p in domain_dir.iterdir() if p.is_dir() and pattern.fullmatch(p.name)),
        key=lambda p: pattern.fullmatch(p.name).group(1).upper(),  # type: ignore[union-attr]
    )
    if grouped:
        return run_id, grouped
    exact = domain_dir / run_id
    if exact.is_dir():
        return run_id, [exact]
    raise FileNotFoundError(f"No Run found for {run_id}")


def load_run(run_dir: Path, observation_name: str = "observation.json") -> dict[str, Any]:
    files = {
        "manifest": run_dir / "manifest.yaml",
        "observation": run_dir / observation_name,
        "markdown": run_dir / "observation.md",
        "preview": run_dir / "preview" / f"{run_dir.name}_preview.jpg",
    }
    missing = [str(p) for p in files.values() if not p.is_file()]
    if missing:
        raise FileNotFoundError("Missing: " + ", ".join(missing))
    manifest = yaml.safe_load(files["manifest"].read_text(encoding="utf-8")) or {}
    observation = json.loads(files["observation"].read_text(encoding="utf-8"))
    if manifest.get("run_id") != run_dir.name or observation.get("run_id") != run_dir.name:
        raise ValueError(f"run_id does not match folder: {run_dir}")
    if manifest.get("status") != "OBSERVED":
        raise ValueError(f"Run is not OBSERVED: {run_dir}")
    outputs = manifest.get("outputs") or {}
    configured_face = outputs.get("face_observation_json")
    face_path = run_dir / str(configured_face) if configured_face else None
    if face_path and not face_path.is_file():
        raise FileNotFoundError(f"Missing configured optional face observation: {face_path}")
    face_observation = json.loads(face_path.read_text(encoding="utf-8")) if face_path else None
    if face_observation and face_observation.get("run_id") != run_dir.name:
        raise ValueError(f"face observation run_id does not match folder: {run_dir}")
    if face_observation:
        root = run_dir.parents[2]
        schema_path = root / str(outputs.get("face_observation_schema") or "templates/face-observation-schema.json")
        rubric_path = root / str(outputs.get("face_observation_rubric") or "templates/face-observation-rubric.yaml")
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        rubric = yaml.safe_load(rubric_path.read_text(encoding="utf-8")) or {}
        errors = schema_errors(face_observation, schema)
        errors.extend(policy_errors(face_observation, rubric, manifest))
        errors.extend(stored_aggregate_errors(face_observation))
        if errors:
            raise ValueError(f"Invalid configured optional face observation: {'; '.join(errors)}")
    return {
        "dir": run_dir,
        "manifest": manifest,
        "observation": observation,
        "face_observation": face_observation,
        "preview": files["preview"],
    }


def make_styles(font: str, bold: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName=bold, fontSize=23, leading=29,
            alignment=TA_CENTER, textColor=colors.HexColor("#172033"), spaceAfter=8 * mm),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontName=font, fontSize=9.5,
            leading=15, alignment=TA_CENTER, textColor=colors.HexColor("#526078")),
        "run": ParagraphStyle("run", parent=base["Heading1"], fontName=bold, fontSize=18, leading=23,
            textColor=colors.HexColor("#172033"), spaceAfter=4 * mm),
        "section": ParagraphStyle("section", parent=base["Heading2"], fontName=bold, fontSize=13,
            leading=17, textColor=colors.HexColor("#2456A6"), spaceBefore=3 * mm, spaceAfter=2 * mm),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName=font, fontSize=8.3,
            leading=12, textColor=colors.HexColor("#202636"), spaceAfter=1.5 * mm),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName=font, fontSize=7.2,
            leading=10, textColor=colors.HexColor("#303849"), splitLongWords=True),
        "cell": ParagraphStyle("cell", parent=base["BodyText"], fontName=font, fontSize=7,
            leading=9.2, textColor=colors.HexColor("#202636"), splitLongWords=True),
        "head": ParagraphStyle("head", parent=base["BodyText"], fontName=bold, fontSize=7,
            leading=9.2, textColor=colors.white),
        "code": ParagraphStyle("code", parent=base["Code"], fontName=font, fontSize=5.7, leading=7.3,
            leftIndent=2 * mm, rightIndent=2 * mm, borderColor=colors.HexColor("#D9DFEA"),
            borderWidth=0.5, borderPadding=2 * mm, backColor=colors.HexColor("#F6F8FB")),
    }


def text(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=False)


def paragraph(value: Any, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text(value).replace("\n", "<br/>"), style)


def make_table(rows: list[list[Any]], widths: list[float], styles: dict[str, ParagraphStyle]) -> Table:
    rendered = [
        [paragraph(value, styles["head"] if index == 0 else styles["cell"]) for value in row]
        for index, row in enumerate(rows)
    ]
    table = Table(rendered, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2456A6")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CAD3E3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2 * mm),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6F8FB")]),
    ]))
    return table


def count_text(counts: dict[str, Any] | Counter[str]) -> str:
    return "; ".join(f"{k}={v}" for k, v in sorted(counts.items())) or "none"


def morphology_count_text(counts: dict[str, Any], panel_count: int) -> str:
    """Render one morphology aggregate without mixing primary and secondary counts."""
    return "\n".join(
        f"{name} = {count} / {panel_count}" for name, count in sorted(counts.items())
    ) or "none observed"


def module_count_text(counts: dict[str, Any], panel_count: int) -> str:
    """Render optional-module counts in explicit X / panel_count form."""
    return "\n".join(
        f"{name} = {count} / {panel_count}" for name, count in sorted(counts.items())
    ) or "none observed"


def axis_counts(observation: dict[str, Any], axis: str) -> dict[str, int]:
    aggregate = observation.get("computed_aggregate") or {}
    return dict((aggregate.get("axis_counts") or {}).get(axis) or {})


def hand_contact_counts(observation: dict[str, Any]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    counts.update(axis_counts(observation, "left_hand_surface_contact"))
    counts.update(axis_counts(observation, "right_hand_surface_contact"))
    return dict(counts)


def load_counts(observation: dict[str, Any]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for panel in observation.get("panels") or []:
        load = panel.get("contact_load") or {}
        counts[str(load.get("left_hand", "unclear"))] += 1
        counts[str(load.get("right_hand", "unclear"))] += 1
    return dict(counts)


def compare_value(observation: dict[str, Any], field: str) -> str:
    aggregate = observation.get("computed_aggregate") or {}
    if field == "hand_contact":
        return count_text(hand_contact_counts(observation))
    if field == "contact_load":
        return count_text(load_counts(observation))
    if field == "primary_morphology":
        return count_text(aggregate.get("primary_morphology_counts") or {})
    return count_text(axis_counts(observation, field))


def prompt_parts(prompt: str) -> list[str]:
    return [part.strip() for part in re.split(r",|\n", prompt) if part.strip()]


def unique_phrases(runs: list[dict[str, Any]]) -> dict[str, list[str]]:
    prompts = {
        run["dir"].name: prompt_parts(str((run["manifest"].get("prompt") or {}).get("positive") or ""))
        for run in runs
    }
    if len(prompts) == 1:
        return prompts
    common = set.intersection(*(set(parts) for parts in prompts.values()))
    return {name: [part for part in parts if part not in common] for name, parts in prompts.items()}


def preview_image(path: Path) -> Image:
    with PILImage.open(path) as source:
        image = source.convert("RGB")
        image.thumbnail((720, 720), PILImage.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=58, optimize=True, progressive=True)
        buffer.seek(0)
        px_width, px_height = image.size
    width = 110 * mm
    result = Image(buffer, width=width, height=width * px_height / px_width)
    result.hAlign = "CENTER"
    return result


def model_rows(runs: list[dict[str, Any]]) -> list[list[Any]]:
    model = runs[0]["manifest"].get("model") or {}
    return [
        ["Setting", "Value"],
        ["Checkpoint", model.get("checkpoint", "")],
        ["Sampler", model.get("sampler", "")],
        ["Scheduler", model.get("scheduler", "")],
        ["Steps", model.get("steps", "")],
        ["CFG", model.get("cfg_scale", "")],
        ["Size", f"{model.get('width', '')}x{model.get('height', '')}"],
    ]


def condition_rows(runs: list[dict[str, Any]], unique: dict[str, list[str]]) -> list[list[Any]]:
    rows: list[list[Any]] = [["Run", "Condition", "Unique prompt phrase", "Seed", "Status"]]
    for run in runs:
        manifest = run["manifest"]
        seeds = (manifest.get("model") or {}).get("seeds") or []
        rows.append([
            run["dir"].name,
            manifest.get("condition") or run["observation"].get("blind_condition_label", ""),
            ", ".join(unique[run["dir"].name]) or "(shared prompt only)",
            ", ".join(map(str, seeds)),
            manifest.get("status", ""),
        ])
    return rows


def aggregate_rows(observation: dict[str, Any]) -> list[list[Any]]:
    aggregate = observation.get("computed_aggregate") or {}
    rows: list[list[Any]] = [["Metric", "Counts"]]
    for axis in observation.get("active_axis_order") or []:
        rows.append([axis, count_text(axis_counts(observation, axis))])
    rows.extend([
        ["contact_load (hands)", count_text(load_counts(observation))],
        ["primary_morphology", count_text(aggregate.get("primary_morphology_counts") or {})],
        ["secondary_morphology", count_text(aggregate.get("secondary_morphology_counts") or {})],
    ])
    non_none = {k: v for k, v in (aggregate.get("artifact_counts") or {}).items() if k != "none"}
    if non_none:
        rows.append(["artifacts (non-none)", count_text(non_none)])
    return rows


def face_aggregate_rows(face_observation: dict[str, Any]) -> list[list[Any]]:
    face = face_observation.get("face_observation") or {}
    aggregate = face_observation.get("computed_aggregate") or {}
    axis_count_map = aggregate.get("axis_counts") or {}
    panel_count = int(face_observation.get("panel_count") or len(face.get("panels") or []))
    rows: list[list[Any]] = [["Face Metric", "Counts"]]
    for axis in face.get("active_axis_order") or []:
        rows.append([axis, module_count_text(axis_count_map.get(axis) or {}, panel_count)])
    return rows


def face_compare_value(face_observation: dict[str, Any] | None, field: str) -> str:
    if not face_observation:
        return "not enabled"
    aggregate = face_observation.get("computed_aggregate") or {}
    panel_count = int(face_observation.get("panel_count") or 0)
    return module_count_text((aggregate.get("axis_counts") or {}).get(field) or {}, panel_count)


def face_vertical_count_text(counts: dict[str, Any], panel_count: int) -> str:
    """Render non-zero optional-module counts for a vertical comparison block."""
    visible = [(name, count) for name, count in sorted(counts.items()) if int(count) > 0]
    return "\n".join(f"{name}: {count} / {panel_count}" for name, count in visible) or "none observed"


def face_cross_condition_metric_rows(runs: list[dict[str, Any]], field: str) -> list[list[Any]]:
    """Build one vertical Run-by-Run comparison for a Face metric."""
    rows: list[list[Any]] = [["Run", "Observed counts"]]
    for run in runs:
        face_observation = run.get("face_observation")
        if not face_observation:
            value = "not enabled"
        else:
            aggregate = face_observation.get("computed_aggregate") or {}
            panel_count = int(face_observation.get("panel_count") or 0)
            counts = (aggregate.get("axis_counts") or {}).get(field) or {}
            value = face_vertical_count_text(counts, panel_count)
        rows.append([run["dir"].name, value])
    return rows


def uncertainty_rows(runs: list[dict[str, Any]]) -> list[list[Any]]:
    rows: list[list[Any]] = [[
        "Run", "Uncertain", "Visual Artifacts", "Prompt / Concept Leakage",
        "Primary Morphologies", "Secondary Morphologies"
    ]]
    for run in runs:
        observation = run["observation"]
        uncertain = observation.get("uncertain") or []
        uncertainty = "\n".join(
            f"P{item.get('panel_id')} {item.get('field')}: {item.get('reason')}" for item in uncertain
        ) or "none"
        artifact_counts = Counter(
            artifact for panel in observation.get("panels") or []
            for artifact in (panel.get("artifacts") or []) if artifact != "none"
        )
        leakage = observation.get("leakage") or []
        comparison = observation.get("cross_condition_comparison") or {}
        leakage_text = (
            "; ".join(str(item.get("type")) for item in leakage)
            if leakage
            else "not assessed" if comparison.get("status") != "performed" else "no entries recorded"
        )
        aggregate = observation.get("computed_aggregate") or {}
        panel_count = int(observation.get("panel_count") or len(observation.get("panels") or []))
        rows.append([
            run["dir"].name,
            uncertainty,
            count_text(artifact_counts) if artifact_counts else "none observed",
            leakage_text,
            morphology_count_text(aggregate.get("primary_morphology_counts") or {}, panel_count),
            morphology_count_text(aggregate.get("secondary_morphology_counts") or {}, panel_count),
        ])
    return rows


def decorator(packet_id: str, font: str):
    def draw(canvas, document) -> None:
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#D9DFEA"))
        canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor("#475467"))
        canvas.drawString(18 * mm, 8.5 * mm, f"{packet_id} research packet")
        canvas.drawRightString(A4[0] - 18 * mm, 8.5 * mm, f"Page {document.page}")
        canvas.restoreState()
    return draw


def build_packet(
    root: Path, domain: str, run_id: str, output: Path | None, include_json: bool,
    observation_name: str = "observation.json",
) -> Path:
    packet_id, directories = discover_runs(root, domain, run_id)
    runs = [load_run(directory, observation_name) for directory in directories]
    output_path = (output or root / "reports" / f"{packet_id}_research-packet.pdf").resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    font, bold = register_fonts()
    styles = make_styles(font, bold)
    document = SimpleDocTemplate(
        str(output_path), pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm,
        topMargin=15 * mm, bottomMargin=19 * mm, title=f"{packet_id} Research Packet",
        author="SD Prompt Studio", subject="Compact Research Run data packet",
    )
    unique = unique_phrases(runs)
    story: list[Any] = [
        Spacer(1, 24 * mm),
        paragraph(f"{packet_id}\nResearch Packet", styles["title"]),
        paragraph(f"Domain: {domain}\nIncluded Runs: {len(runs)}\nGenerated: {now_iso()}", styles["subtitle"]),
        Spacer(1, 11 * mm),
        paragraph("Experiment Overview", styles["section"]),
        make_table(model_rows(runs), [45 * mm, 115 * mm], styles),
        Spacer(1, 4 * mm),
        paragraph("Conditions", styles["section"]),
        make_table(condition_rows(runs, unique), [24 * mm, 27 * mm, 61 * mm, 26 * mm, 22 * mm], styles),
    ]

    for run in runs:
        manifest, observation = run["manifest"], run["observation"]
        condition = manifest.get("condition") or observation.get("blind_condition_label", "")
        phrase = ", ".join(unique[run["dir"].name]) or "(shared prompt only)"
        story.extend([
            PageBreak(),
            paragraph(run["dir"].name, styles["run"]),
            paragraph(f"Condition: {condition}\nStatus: {manifest.get('status', '')}\nUnique prompt phrase: {phrase}", styles["body"]),
            preview_image(run["preview"]),
            Spacer(1, 2 * mm),
            paragraph("Positive Prompt", styles["section"]),
            paragraph((manifest.get("prompt") or {}).get("positive", ""), styles["small"]),
            PageBreak(),
            paragraph("Computed Aggregate", styles["section"]),
            make_table(aggregate_rows(observation), [58 * mm, 102 * mm], styles),
        ])
        face_observation = run.get("face_observation")
        if face_observation:
            story.extend([
                PageBreak(),
                paragraph("Optional Face Module Aggregate", styles["section"]),
                paragraph(
                    "Visible face-state counts only. Emotion meaning, Prompt causality, and research interpretation are not assessed.",
                    styles["body"],
                ),
                make_table(face_aggregate_rows(face_observation), [58 * mm, 102 * mm], styles),
            ])

    if len(runs) > 1:
        rows: list[list[Any]] = [["Metric", *[run["dir"].name for run in runs]]]
        rows.extend([[field, *[compare_value(run["observation"], field) for run in runs]] for field in COMPARE_FIELDS])
        story.extend([
            PageBreak(),
            paragraph("Cross-condition Mechanical Counts", styles["run"]),
            paragraph("Direct counts from observation.json only. No success judgment or research interpretation is applied.", styles["body"]),
            make_table(rows, [38 * mm, *([122 * mm / len(runs)] * len(runs))], styles),
        ])

        if any(run.get("face_observation") for run in runs):
            for group_index, fields in enumerate(FACE_COMPARE_GROUPS, start=1):
                story.extend([
                    PageBreak(),
                    paragraph("Face Module Cross-condition Counts", styles["run"]),
                    paragraph(
                        f"Metric group {group_index} / {len(FACE_COMPARE_GROUPS)}. "
                        "Direct visible-state counts from face-observation.json. Runs are mechanically aligned with the manifest conditions; no Phrase effect or emotion meaning is inferred.",
                        styles["body"],
                    ),
                ])
                for field in fields:
                    story.append(KeepTogether([
                        paragraph(f"Face Metric: {field}", styles["section"]),
                        make_table(
                            face_cross_condition_metric_rows(runs, field),
                            [36 * mm, 124 * mm],
                            styles,
                        ),
                        Spacer(1, 3 * mm),
                    ]))

    story.extend([
        PageBreak(),
        paragraph("Observation Boundaries", styles["run"]),
        paragraph(
            "Visual artifacts and observed morphologies are image observations. Prompt / Concept Leakage is a separate research-stage assessment.",
            styles["body"],
        ),
        make_table(
            uncertainty_rows(runs),
            [17 * mm, 39 * mm, 26 * mm, 30 * mm, 31 * mm, 31 * mm],
            styles,
        ),
    ])

    if include_json:
        for run in runs:
            story.extend([
                PageBreak(),
                paragraph(f"Appendix: {run['dir'].name} observation.json", styles["run"]),
                Preformatted(json.dumps(run["observation"], ensure_ascii=False, indent=2),
                    styles["code"], maxLineLength=118, splitChars=" ,;:/"),
            ])

    draw = decorator(packet_id, font)
    document.build(story, onFirstPage=draw, onLaterPages=draw)
    reader = PdfReader(str(output_path))
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not reader.pages or any(run["dir"].name not in extracted for run in runs):
        raise RuntimeError("Generated PDF verification failed")
    print(f"Created: {output_path}")
    print(f"Runs: {', '.join(run['dir'].name for run in runs)}")
    print(f"Pages: {len(reader.pages)}")
    print(f"JSON appendix: {'included' if include_json else 'omitted'}")
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--domain", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--include-json-appendix", action="store_true")
    parser.add_argument("--observation-name", default="observation.json")
    args = parser.parse_args()
    try:
        build_packet(
            args.root.resolve(), args.domain, args.run_id, args.output,
            args.include_json_appendix, args.observation_name,
        )
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
