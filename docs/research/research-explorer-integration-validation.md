# Research Explorer Integration Validation

## Purpose

This runbook validates the existing Research Explorer Frontend, Research API Client, Local Companion Service, Derived Index, and Research Artifacts as one read-only same-origin path. It does not change the PR69, PR71, PR73, PR75, or PR77 contracts.

## Local Research Mode

From the Repository root, build the Local Companion frontend:

```powershell
pnpm run build:research-local
```

Then start the Companion from the Research Project Root:

```powershell
cd research\sd-prompt-research
.venv\Scripts\python.exe scripts\research_explorer.py index --check
.venv\Scripts\python.exe scripts\research_explorer.py serve `
  --frontend-dir ..\..\dist `
  --host 127.0.0.1 `
  --port 8765
```

Open `http://127.0.0.1:8765/research`. Keep the Frontend and API on this single origin. A public Preview, another origin, or a CORS workaround is outside the supported architecture.

## Integration checks

1. Load `/research` and confirm the Navigator displays Runs, Observations, Drafts, Candidates, Canonical Assertions, Receipts, and Validation Results. Do not derive an Experiment hierarchy.
2. Select JSON, YAML, or Markdown Artifacts and confirm Parsed or Preview and exact Source views.
3. Confirm the Inspector shows exact Display Status and its source, Source Freshness separately from Research / Audit Hashes, relationships, diagnostics, and `Not Provided` for unavailable metadata.
4. Reload `/research/artifact/<opaque-artifact-id>` and confirm the same Artifact is restored without a filesystem path in the URL.
5. Send the Index snapshot in `X-Research-Index-Snapshot` for Artifact reads. A mismatch must return `INDEX_SNAPSHOT_MISMATCH`; changed source bytes must return `ARTIFACT_STALE`. Neither response may expose the old Artifact body.
6. Confirm the session cookie is HttpOnly and no token, absolute Repository path, raw-path API, or Research Data is exposed by a public Preview.

## Automated validation

From the Repository root:

```powershell
pnpm test
pnpm run build
pnpm run build:research-local
pnpm run validate:research-boundaries
```

From `research/sd-prompt-research`:

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -v
.venv\Scripts\python.exe scripts\research_explorer.py index --check
.venv\Scripts\python.exe scripts\validate_research_claims.py --format json
```

## Current data availability

The 2026-07-17 checked-in Derived Index contains 136 Artifacts and zero Diagnostics. JSON, YAML, and Markdown are present. No `text/plain` Artifact, normalized Research / Audit Hash entry, or Relationship entry is currently present, so those value-bearing UI states cannot be established from current Canonical Research Data. Their empty or `Not Provided` states remain valid and must not be filled by Frontend inference.

## Troubleshooting

- Blank `/research` with successful HTML: rebuild with `pnpm run build:research-local`. The Local Companion requires root-based `/assets/` URLs.
- `Research Data Unavailable`: load the page from the Companion origin so the scoped HttpOnly session is established. Public Preview without a fixture is expected to be unavailable.
- `INDEX_SNAPSHOT_MISMATCH` or `ARTIFACT_STALE`: stop displaying the body. Restart or rebuild the read-only Companion; Refresh API is unavailable.
- Missing Entity groups: an empty group is valid. Do not synthesize Experiment, Draft, Candidate, Receipt, or Validation Result entities from paths or Artifact content.
