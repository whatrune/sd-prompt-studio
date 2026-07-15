#!/usr/bin/env python3
"""Update a run's workflow status safely."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from pathlib import Path
import yaml

VALID = ["PLANNED", "GENERATED", "INGESTED", "OBSERVED", "RESEARCHED", "HUMAN_REVIEWED", "ACCEPTED", "REJECTED", "NEEDS_FOLLOWUP", "ARCHIVED"]

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest", type=Path)
    p.add_argument("status", choices=VALID)
    args = p.parse_args()
    data = yaml.safe_load(args.manifest.read_text(encoding="utf-8")) or {}
    data["status"] = args.status
    data["updated_at"] = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    args.manifest.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"{args.manifest}: {args.status}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
