#!/usr/bin/env python3
"""Safely ingest a six-panel SD result sheet into a research run directory."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from PIL import Image, ImageDraw, ImageFont

UPDATABLE_EXISTING_STATUSES = {"PLANNED", "GENERATED"}
METADATA_EXTENSIONS = (".yaml", ".yml", ".json", ".txt")


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def parse_layout(layout: str) -> tuple[int, int]:
    normalized = layout.lower().replace("×", "x")
    if normalized == "3x2":
        return 3, 2
    if normalized == "2x3":
        return 2, 3
    raise ValueError("layout must be 3x2 or 2x3")


def detect_metadata(image_path: Path) -> Path | None:
    for extension in METADATA_EXTENSIONS:
        candidate = image_path.with_suffix(extension)
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def read_metadata(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    if not path.exists():
        raise FileNotFoundError(f"Metadata file not found: {path}")
    suffix = path.suffix.lower()
    if suffix in {".yaml", ".yml"}:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return data or {}
    if suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))
    if suffix == ".txt":
        return {"raw_text": path.read_text(encoding="utf-8")}
    raise ValueError("metadata must be .txt, .yaml, .yml, or .json")



def parse_a1111_parameters(raw: str) -> dict[str, Any]:
    """Parse common A1111/Forge PNG `parameters` text without discarding raw data."""
    result: dict[str, Any] = {"raw_parameters": raw}
    if not raw.strip():
        return result

    lines = raw.strip().splitlines()
    settings_index: int | None = None
    for index in range(len(lines) - 1, -1, -1):
        if re.search(r"(?:^|,\s*)Steps\s*:", lines[index]):
            settings_index = index
            break

    prompt_lines = lines if settings_index is None else lines[:settings_index]
    settings_line = "" if settings_index is None else " ".join(lines[settings_index:])

    negative_index: int | None = None
    for index, line in enumerate(prompt_lines):
        if line.startswith("Negative prompt:"):
            negative_index = index
            break

    if negative_index is None:
        result["positive_prompt"] = "\n".join(prompt_lines).strip()
    else:
        result["positive_prompt"] = "\n".join(prompt_lines[:negative_index]).strip()
        negative_first = prompt_lines[negative_index][len("Negative prompt:"):].lstrip()
        result["negative_prompt"] = "\n".join([negative_first, *prompt_lines[negative_index + 1:]]).strip()

    if settings_line:
        settings: dict[str, Any] = {}
        # Values may contain spaces, but commonly not comma+Key:. Split only at the next key marker.
        parts = re.split(r",\s*(?=[A-Za-z][A-Za-z0-9 _/-]*\s*:)", settings_line)
        for part in parts:
            if ":" not in part:
                continue
            key, value = part.split(":", 1)
            key = key.strip()
            value = value.strip()
            if key:
                settings[key] = value
        result["settings"] = settings

        normalized = {
            "steps": settings.get("Steps"),
            "sampler": settings.get("Sampler"),
            "scheduler": settings.get("Schedule type") or settings.get("Scheduler"),
            "cfg_scale": settings.get("CFG scale"),
            "seed": settings.get("Seed"),
            "size": settings.get("Size"),
            "checkpoint": settings.get("Model"),
            "model_hash": settings.get("Model hash"),
            "vae": settings.get("VAE"),
            "clip_skip": settings.get("Clip skip"),
        }
        result["normalized"] = {key: value for key, value in normalized.items() if value not in (None, "")}
    return result


def read_embedded_image_metadata(image_path: Path) -> dict[str, Any]:
    """Read embedded PNG metadata from A1111/Forge/ComfyUI-style outputs."""
    with Image.open(image_path) as image:
        raw_info = dict(image.info)

    if not raw_info:
        return {"metadata_status": "not_found", "source": "image"}

    decoded: dict[str, Any] = {}
    for key, value in raw_info.items():
        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="replace")
        if isinstance(value, str) and key in {"prompt", "workflow"}:
            try:
                decoded[key] = json.loads(value)
                continue
            except json.JSONDecodeError:
                pass
        if isinstance(value, (str, int, float, bool, list, dict)) or value is None:
            decoded[key] = value
        else:
            decoded[key] = str(value)

    result: dict[str, Any] = {
        "metadata_status": "found",
        "source": "embedded_image",
        "format": image_path.suffix.lower().lstrip("."),
        "embedded": decoded,
    }
    parameters = decoded.get("parameters")
    if isinstance(parameters, str):
        result["generation"] = parse_a1111_parameters(parameters)
    elif "prompt" in decoded or "workflow" in decoded:
        result["generation"] = {
            "format": "comfyui",
            "prompt_graph_available": "prompt" in decoded,
            "workflow_available": "workflow" in decoded,
        }
    return result

def split_sheet(image: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    width, height = image.size
    if width < cols or height < rows:
        raise ValueError(f"Image is too small for {cols}x{rows} split: {width}x{height}")
    x_edges = [round(i * width / cols) for i in range(cols + 1)]
    y_edges = [round(i * height / rows) for i in range(rows + 1)]
    panels: list[Image.Image] = []
    for row in range(rows):
        for col in range(cols):
            box = (x_edges[col], y_edges[row], x_edges[col + 1], y_edges[row + 1])
            panels.append(image.crop(box).copy())
    if len(panels) != 6:
        raise ValueError(f"Expected 6 panels, got {len(panels)}")
    return panels


def make_preview(panels: list[Image.Image], run_id: str, max_panel_width: int = 420) -> Image.Image:
    thumbed: list[Image.Image] = []
    label_height = 34
    for index, panel in enumerate(panels, start=1):
        ratio = min(1.0, max_panel_width / panel.width)
        size = (max(1, int(panel.width * ratio)), max(1, int(panel.height * ratio)))
        thumb = panel.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (thumb.width, thumb.height + label_height), "white")
        canvas.paste(thumb.convert("RGB"), (0, label_height))
        draw = ImageDraw.Draw(canvas)
        draw.text((10, 9), f"{run_id}  Panel {index:02d}", fill="black", font=ImageFont.load_default())
        thumbed.append(canvas)

    cols, rows = 3, 2
    cell_w = max(im.width for im in thumbed)
    cell_h = max(im.height for im in thumbed)
    sheet = Image.new("RGB", (cell_w * cols, cell_h * rows), "#dddddd")
    for i, im in enumerate(thumbed):
        x = (i % cols) * cell_w + (cell_w - im.width) // 2
        y = (i // cols) * cell_h + (cell_h - im.height) // 2
        sheet.paste(im, (x, y))
    return sheet


def deep_merge(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result



def metadata_manifest_patch(metadata: dict[str, Any]) -> dict[str, Any]:
    """Map normalized embedded generation data into the standard manifest fields."""
    generation = metadata.get("generation")
    if not isinstance(generation, dict):
        return {}

    normalized = generation.get("normalized")
    if not isinstance(normalized, dict):
        normalized = {}

    prompt_patch: dict[str, Any] = {}
    if generation.get("positive_prompt"):
        prompt_patch["positive"] = generation["positive_prompt"]
    if generation.get("negative_prompt"):
        prompt_patch["negative"] = generation["negative_prompt"]

    model_patch: dict[str, Any] = {}
    key_map = {
        "checkpoint": "checkpoint",
        "vae": "vae",
        "sampler": "sampler",
        "scheduler": "scheduler",
        "steps": "steps",
        "cfg_scale": "cfg_scale",
    }
    for source_key, target_key in key_map.items():
        value = normalized.get(source_key)
        if value not in (None, ""):
            if target_key == "steps":
                try:
                    value = int(value)
                except (TypeError, ValueError):
                    pass
            elif target_key == "cfg_scale":
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    pass
            model_patch[target_key] = value

    size = normalized.get("size")
    if isinstance(size, str):
        match = re.match(r"\s*(\d+)\s*[xX×]\s*(\d+)\s*$", size)
        if match:
            model_patch["width"] = int(match.group(1))
            model_patch["height"] = int(match.group(2))

    seed = normalized.get("seed")
    if seed not in (None, ""):
        try:
            seed = int(seed)
        except (TypeError, ValueError):
            pass
        model_patch["seeds"] = [seed]

    patch: dict[str, Any] = {}
    if prompt_patch:
        patch["prompt"] = prompt_patch
    if model_patch:
        patch["model"] = model_patch
    return patch

def load_existing_manifest(run_dir: Path) -> dict[str, Any] | None:
    manifest_path = run_dir / "manifest.yaml"
    if not manifest_path.exists():
        return None
    data = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    return data


def update_run_index(root: Path, manifest: dict[str, Any]) -> None:
    index_path = root / "ledgers" / "run-index.yaml"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index = yaml.safe_load(index_path.read_text(encoding="utf-8")) if index_path.exists() else None
    if not isinstance(index, dict):
        index = {"schema_version": "1.0", "runs": []}
    runs = index.setdefault("runs", [])
    summary = {
        "run_id": manifest.get("run_id"),
        "domain": manifest.get("domain"),
        "title": manifest.get("title"),
        "status": manifest.get("status"),
        "updated_at": manifest.get("updated_at"),
        "path": f"experiments/{manifest.get('domain')}/{manifest.get('run_id')}",
    }
    replaced = False
    for i, item in enumerate(runs):
        if isinstance(item, dict) and item.get("run_id") == manifest.get("run_id"):
            runs[i] = summary
            replaced = True
            break
    if not replaced:
        runs.append(summary)
    index_path.write_text(yaml.safe_dump(index, allow_unicode=True, sort_keys=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--image", type=Path, required=True, help="Six-panel source image")
    parser.add_argument("--domain", required=True, help="Experiment domain, e.g. bridge")
    parser.add_argument("--run-id", required=True, help="Unique run ID, e.g. BRG-001")
    parser.add_argument("--layout", default="3x2", choices=["3x2", "2x3"])
    parser.add_argument("--metadata", type=Path, help="Optional sidecar metadata override. Normally unnecessary; PNG metadata is read automatically.")
    parser.add_argument("--title", default="")
    parser.add_argument("--condition-label", default="Condition A")
    parser.add_argument("--move", action="store_true", help="Remove inbox source files only after successful ingestion")
    parser.add_argument("--overwrite", action="store_true", help="Replace a non-PLANNED existing run directory")
    args = parser.parse_args()

    source_image = args.image.expanduser().resolve()
    if not source_image.exists() or not source_image.is_file():
        print(f"ERROR: Source image not found: {source_image}", file=sys.stderr)
        return 2

    metadata_path = args.metadata.expanduser().resolve() if args.metadata else detect_metadata(source_image)
    root = args.root.expanduser().resolve()
    run_dir = root / "experiments" / args.domain / args.run_id
    temp_dir = run_dir.with_name(run_dir.name + ".tmp-ingest")

    existing_manifest = load_existing_manifest(run_dir) if run_dir.exists() else None
    existing_status = existing_manifest.get("status") if existing_manifest else None
    may_update_existing = existing_status in UPDATABLE_EXISTING_STATUSES
    if run_dir.exists() and not args.overwrite and not may_update_existing:
        print(
            f"ERROR: Run already exists with status {existing_status or 'unknown'}: {run_dir}. "
            "Use --overwrite only when replacement is intentional.",
            file=sys.stderr,
        )
        return 3
    if temp_dir.exists():
        shutil.rmtree(temp_dir)

    try:
        cols, rows = parse_layout(args.layout)
        embedded_metadata = read_embedded_image_metadata(source_image)
        sidecar_metadata = read_metadata(metadata_path)
        metadata = deep_merge(embedded_metadata, {"sidecar": sidecar_metadata}) if sidecar_metadata else embedded_metadata

        with Image.open(source_image) as loaded:
            image = loaded.convert("RGB")
            panels = split_sheet(image, cols, rows)

        source_dir = temp_dir / "source"
        panels_dir = temp_dir / "panels"
        preview_dir = temp_dir / "preview"
        source_dir.mkdir(parents=True)
        panels_dir.mkdir(parents=True)
        preview_dir.mkdir(parents=True)

        source_name = f"{args.run_id}_sheet{source_image.suffix.lower()}"
        shutil.copy2(source_image, source_dir / source_name)
        sidecar_name = None
        if metadata_path:
            sidecar_name = f"{args.run_id}_sidecar{metadata_path.suffix.lower()}"
            shutil.copy2(metadata_path, source_dir / sidecar_name)

        metadata_name = f"{args.run_id}_metadata.yaml"
        (source_dir / metadata_name).write_text(
            yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )

        panel_files: list[str] = []
        for index, panel in enumerate(panels, start=1):
            panel_name = f"{args.run_id}_{index:02d}.png"
            panel.save(panels_dir / panel_name, format="PNG")
            panel_files.append(f"panels/{panel_name}")

        preview_name = f"{args.run_id}_preview.jpg"
        make_preview(panels, args.run_id).save(preview_dir / preview_name, quality=90, optimize=True)

        template = existing_manifest or yaml.safe_load(
            (root / "templates" / "manifest-template.yaml").read_text(encoding="utf-8")
        )
        created_at = template.get("created_at") or now_iso()
        generated = {
            "run_id": args.run_id,
            "domain": args.domain,
            "title": args.title or template.get("title") or args.run_id,
            "status": "INGESTED",
            "created_at": created_at,
            "updated_at": now_iso(),
            "source": {
                "sheet_file": f"source/{source_name}",
                "metadata_file": f"source/{metadata_name}",
                "sidecar_file": f"source/{sidecar_name}" if sidecar_name else None,
                "layout": args.layout,
                "panel_count": 6,
                "original_filename": source_image.name,
            },
            "outputs": {
                "panels": panel_files,
                "preview_file": f"preview/{preview_name}",
                "observation_file": "observation.md",
                "observation_json": "observation.json",
                "observation_schema": "templates/observation-schema.json",
                "canonical_observation": "observation.json",
                "research_review_file": "research-review.md",
                "rubric_file": "source/rubric.yaml",
            },
            "workflow": {"assigned_to": "画像解析ChatGPT"},
        }
        manifest = deep_merge(template, metadata_manifest_patch(metadata))
        manifest = deep_merge(manifest, generated)
        manifest["ingested_metadata"] = metadata

        (temp_dir / "manifest.yaml").write_text(
            yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )

        existing_rubric_candidates = [run_dir / "source" / "rubric.yaml", run_dir / "rubric.yaml"]
        existing_rubric = next((path for path in existing_rubric_candidates if path.exists()), None)
        if may_update_existing and existing_rubric is not None:
            rubric_template = yaml.safe_load(existing_rubric.read_text(encoding="utf-8")) or {}
        else:
            rubric_template = yaml.safe_load((root / "templates" / "rubric-template.yaml").read_text(encoding="utf-8"))
        rubric_template["run_id"] = args.run_id
        rubric_template["blind_condition_label"] = args.condition_label or rubric_template.get("blind_condition_label", "Condition A")
        (source_dir / "rubric.yaml").write_text(
            yaml.safe_dump(rubric_template, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )

        if may_update_existing and (run_dir / "observation.md").exists():
            shutil.copy2(run_dir / "observation.md", temp_dir / "observation.md")
        else:
            observation = (root / "templates" / "observation-template.md").read_text(encoding="utf-8")
            observation = observation.replace("{{RUN_ID}}", args.run_id)
            observation = observation.replace("{{CONDITION_LABEL}}", args.condition_label)
            observation = observation.replace("{{SOURCE_FILE}}", source_name)
            (temp_dir / "observation.md").write_text(observation, encoding="utf-8")

        if may_update_existing and (run_dir / "research-review.md").exists():
            shutil.copy2(run_dir / "research-review.md", temp_dir / "research-review.md")
        else:
            review = (root / "templates" / "research-review-template.md").read_text(encoding="utf-8")
            review = review.replace("{{RUN_ID}}", args.run_id)
            (temp_dir / "research-review.md").write_text(review, encoding="utf-8")

        existing_observation_json = run_dir / "observation.json"
        if may_update_existing and existing_observation_json.exists():
            shutil.copy2(existing_observation_json, temp_dir / "observation.json")
        else:
            observation_template = (root / "templates" / "observation-template.json").read_text(encoding="utf-8")
            observation_template = observation_template.replace("{{RUN_ID}}", args.run_id)
            observation_template = observation_template.replace("{{CONDITION_LABEL}}", args.condition_label)
            observation_template = observation_template.replace(
                "{{ACTIVE_AXIS_ORDER}}",
                json.dumps(rubric_template.get("active_observation_axes", []), ensure_ascii=False),
            )
            observation_payload = json.loads(observation_template)
            observation_payload["image_layout"] = args.layout
            (temp_dir / "observation.json").write_text(
                json.dumps(observation_payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

        backup_dir = run_dir.with_name(run_dir.name + ".backup")
        if run_dir.exists():
            if backup_dir.exists():
                shutil.rmtree(backup_dir)
            run_dir.rename(backup_dir)
            temp_dir.rename(run_dir)
            shutil.rmtree(backup_dir)
        else:
            run_dir.parent.mkdir(parents=True, exist_ok=True)
            temp_dir.rename(run_dir)

        update_run_index(root, manifest)

        if args.move:
            source_image.unlink()
            if metadata_path and metadata_path.exists():
                metadata_path.unlink()

        print(f"Ingested {args.run_id} -> {run_dir}")
        print(f"Source preserved: {run_dir / 'source' / source_name}")
        print(f"Panels: {len(panel_files)}")
        print(f"Preview: {run_dir / 'preview' / preview_name}")
        print(f"Generated metadata: {run_dir / 'source' / metadata_name}")
        if metadata_path:
            print(f"Optional sidecar preserved: {metadata_path.name}")
        return 0

    except Exception as exc:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        print(f"ERROR: {exc}", file=sys.stderr)
        print("The original source image and metadata were not modified.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
