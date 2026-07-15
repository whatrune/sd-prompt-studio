#!/usr/bin/env python3
"""Create a PLANNED run directory from templates without ingesting images."""
from __future__ import annotations
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import shutil
import yaml


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    p.add_argument("--domain", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--title", default="")
    p.add_argument("--condition-label", default="Condition A")
    args = p.parse_args()
    root = args.root.resolve()
    run_dir = root / "experiments" / args.domain / args.run_id
    if run_dir.exists():
        raise SystemExit(f"Run already exists: {run_dir}")
    for sub in ("source", "panels", "preview"):
        (run_dir / sub).mkdir(parents=True, exist_ok=True)
        (run_dir / sub / ".gitkeep").touch()
    manifest = yaml.safe_load((root / "templates" / "manifest-template.yaml").read_text(encoding="utf-8"))
    manifest.update({
        "run_id": args.run_id,
        "domain": args.domain,
        "title": args.title or args.run_id,
        "status": "PLANNED",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    (run_dir / "manifest.yaml").write_text(yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8")
    rubric = yaml.safe_load((root / "templates" / "rubric-template.yaml").read_text(encoding="utf-8"))
    rubric["run_id"] = args.run_id
    rubric["blind_condition_label"] = args.condition_label
    (run_dir / "source" / "rubric.yaml").write_text(yaml.safe_dump(rubric, allow_unicode=True, sort_keys=False), encoding="utf-8")
    for template_name, output_name in (("observation-template.md", "observation.md"), ("research-review-template.md", "research-review.md")):
        text = (root / "templates" / template_name).read_text(encoding="utf-8")
        text = text.replace("{{RUN_ID}}", args.run_id).replace("{{CONDITION_LABEL}}", args.condition_label).replace("{{SOURCE_FILE}}", "")
        (run_dir / output_name).write_text(text, encoding="utf-8")

    observation_template = (root / "templates" / "observation-template.json").read_text(encoding="utf-8")
    observation_template = observation_template.replace("{{RUN_ID}}", args.run_id)
    observation_template = observation_template.replace("{{CONDITION_LABEL}}", args.condition_label)
    observation_template = observation_template.replace(
        "{{ACTIVE_AXIS_ORDER}}",
        json.dumps(rubric.get("active_observation_axes", []), ensure_ascii=False),
    )
    observation_payload = json.loads(observation_template)
    (run_dir / "observation.json").write_text(
        json.dumps(observation_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(run_dir)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
