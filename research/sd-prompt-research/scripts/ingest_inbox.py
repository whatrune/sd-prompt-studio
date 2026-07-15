#!/usr/bin/env python3
"""Batch-ingest arbitrarily named six-panel images from inbox with automatic Run IDs."""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

from ingest_run import detect_metadata

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
DEFAULT_PREFIXES = {
    "bridge": "BRG",
    "split": "SPL",
    "lying": "LYG",
    "hand-arm": "ARM",
    "object": "OBJ",
    "lighting": "LGT",
    "effects": "EFX",
}


def natural_key(path: Path) -> tuple[object, ...]:
    """Sort browser-style names: image, image (1), image (2), image (10)."""
    match = re.match(r"^(.*?)(?: \((\d+)\))?$", path.stem)
    if match:
        base = match.group(1).casefold()
        copy_number = int(match.group(2)) if match.group(2) is not None else 0
        return (base, copy_number, path.suffix.casefold())
    parts = tuple(int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", path.name))
    return parts


def excel_label(index: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA."""
    if index < 0:
        raise ValueError("index must be non-negative")
    result = ""
    value = index + 1
    while value:
        value, remainder = divmod(value - 1, 26)
        result = chr(ord("A") + remainder) + result
    return result


def next_run_number(root: Path, domain: str, prefix: str) -> int:
    run_root = root / "experiments" / domain
    highest = 0
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)(?:-[A-Z]+)?$", re.IGNORECASE)
    if run_root.exists():
        for child in run_root.iterdir():
            if not child.is_dir():
                continue
            match = pattern.match(child.name)
            if match:
                highest = max(highest, int(match.group(1)))
    return highest + 1


def build_mappings(
    images: list[Path],
    prefix: str,
    first_number: int,
    condition_start: int,
) -> list[tuple[Path, str, str]]:
    width = max(3, len(str(first_number)))
    grouped = len(images) > 1
    base_run_id = f"{prefix}-{first_number:0{width}d}"
    mappings: list[tuple[Path, str, str]] = []

    for index, image in enumerate(images):
        condition_suffix = excel_label(condition_start + index)
        run_id = f"{base_run_id}-{condition_suffix}" if grouped else base_run_id
        condition = f"Condition {condition_suffix}"
        mappings.append((image, run_id, condition))

    return mappings


def unique_destination(directory: Path, name: str) -> Path:
    candidate = directory / name
    if not candidate.exists():
        return candidate
    path = Path(name)
    counter = 2
    while True:
        candidate = directory / f"{path.stem}_{counter}{path.suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def archive_source(source: Path, sidecar: Path | None, processed_dir: Path, run_id: str) -> None:
    processed_dir.mkdir(parents=True, exist_ok=True)
    destination = unique_destination(processed_dir, f"{run_id}{source.suffix.lower()}")
    shutil.move(str(source), str(destination))
    if sidecar and sidecar.exists():
        sidecar_destination = unique_destination(
            processed_dir,
            f"{run_id}_sidecar{sidecar.suffix.lower()}",
        )
        shutil.move(str(sidecar), str(sidecar_destination))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--domain", required=True, help="Experiment domain, e.g. bridge")
    parser.add_argument("--prefix", help="Run prefix. Defaults by domain, e.g. bridge -> BRG")
    parser.add_argument("--layout", default="3x2", choices=["3x2", "2x3"])
    parser.add_argument("--start", type=int, help="Explicit first run number. Default: next unused number")
    parser.add_argument("--condition-start", type=int, default=0, help="0=A, 1=B, ... for this batch")
    parser.add_argument("--title-prefix", default="", help="Optional title prefix for generated manifests")
    parser.add_argument("--keep-inbox", action="store_true", help="Keep original files in inbox after success")
    parser.add_argument("--dry-run", action="store_true", help="Show filename -> Run ID mapping without ingesting")
    args = parser.parse_args()

    root = args.root.expanduser().resolve()
    inbox = root / "inbox"
    inbox.mkdir(parents=True, exist_ok=True)
    prefix = (args.prefix or DEFAULT_PREFIXES.get(args.domain) or args.domain[:3]).upper()

    images = sorted(
        [path for path in inbox.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS],
        key=natural_key,
    )
    if not images:
        print(f"No images found in {inbox}")
        return 0

    first_number = args.start if args.start is not None else next_run_number(root, args.domain, prefix)
    mappings = build_mappings(images, prefix, first_number, args.condition_start)

    print("Inbox mapping:")
    for image, run_id, condition in mappings:
        print(f"  {image.name} -> {run_id} ({condition})")

    if args.dry_run:
        return 0

    ingest_script = root / "scripts" / "ingest_run.py"
    processed_dir = inbox / "processed"
    success_count = 0
    failed: list[str] = []

    for image, run_id, condition in mappings:
        sidecar = detect_metadata(image)
        title = f"{args.title_prefix} {run_id}".strip() if args.title_prefix else run_id
        command = [
            sys.executable,
            str(ingest_script),
            "--root",
            str(root),
            "--image",
            str(image),
            "--domain",
            args.domain,
            "--run-id",
            run_id,
            "--layout",
            args.layout,
            "--title",
            title,
            "--condition-label",
            condition,
        ]
        result = subprocess.run(command, check=False)
        if result.returncode != 0:
            failed.append(image.name)
            print(f"FAILED: {image.name} remains in inbox.", file=sys.stderr)
            continue

        success_count += 1
        if not args.keep_inbox:
            archive_source(image, sidecar, processed_dir, run_id)

    print(f"Completed: {success_count}/{len(mappings)}")
    if not args.keep_inbox:
        print(f"Processed originals: {processed_dir}")
    if failed:
        print("Failed files: " + ", ".join(failed), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
