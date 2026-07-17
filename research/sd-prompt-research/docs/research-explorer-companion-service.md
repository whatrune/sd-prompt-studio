# Research Explorer Local Companion Service

## Purpose

The Local Companion Service is the read-only filesystem boundary for Research Explorer. It discovers Research Artifacts, builds a derived index, serves an existing frontend build, and exposes the selected Artifact through a same-origin API.

This implementation does not add the three-pane Research Explorer UI. It provides the PR74 transport and discovery foundation required by that later UI.

```text
Local Companion Service (loopback only)
├─ Research Explorer frontend build
└─ /api/research/*
   ├─ GET /api/research/index
   └─ GET /api/research/artifacts/<opaque-artifact-id>
```

The service does not generate Claims, change Evidence, edit Observations, run Promotion, or write Canonical Knowledge.

## Build and run

Build the public-safe frontend with a root base for the same-origin Local Research Mode:

```powershell
pnpm run build:research-local
```

The ordinary `pnpm run build` keeps the deployment base used by GitHub Pages. Do not use that output for the Companion root routes: its assets are requested below `/sd-prompt-studio/`, so `/research` cannot load the application when the Companion serves the frontend at `/`. `build:research-local` changes only the Vite asset base; it does not enable Research Data in a public deployment or change the Research API contract.

Validate the index without writing a file:

```powershell
cd research/sd-prompt-research
.venv\Scripts\python.exe scripts\research_explorer.py index --check
```

Optionally write a local derived index. Generated output remains a disposable Read Model and must not be edited as research data.

```powershell
.venv\Scripts\python.exe scripts\research_explorer.py index `
  --output tmp\research-explorer-index.json
```

Serve the frontend and API from one origin:

```powershell
.venv\Scripts\python.exe scripts\research_explorer.py serve `
  --frontend-dir ..\..\dist `
  --host 127.0.0.1 `
  --port 8765
```

Open `http://127.0.0.1:8765/research`. Loading the frontend establishes an HttpOnly, `SameSite=Strict` session cookie scoped to `/api/research`.

Confirm both direct routes from the same Companion origin:

```text
http://127.0.0.1:8765/research
http://127.0.0.1:8765/research/artifact/<opaque-artifact-id>
```

Browser reload and direct navigation use the Companion SPA fallback. Do not connect a Cloudflare or GitHub Pages frontend to this loopback API, and do not add a CORS workaround.

## Integration validation

Run the real-data API integration test from the Research Project Root:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_research_explorer_integration -v
```

The test keeps the service read-only and verifies:

- same-origin `/`, `/research`, and Artifact direct-route fallback;
- the HttpOnly session boundary;
- the current Derived Index with at least 136 Artifacts;
- JSON, YAML, and Markdown Artifact round trips;
- Artifact and snapshot response headers;
- `INDEX_SNAPSHOT_MISMATCH` without stale body disclosure; and
- absence of absolute Repository paths and session tokens from the Index response.

The current checked-in dataset does not contain a `text/plain` Artifact. Plain Text remains a supported Viewer media type, but real-data display requires such an Artifact to be present in a future Derived Index.

### Troubleshooting

If `/research` returns HTML but the screen remains blank, inspect the generated `dist/index.html`. Asset URLs must start with `/assets/` for Local Research Mode. Rebuild with `pnpm run build:research-local`; do not change the Companion route or add CORS.

If the UI displays `Research Data Unavailable`, verify that the page is loaded from the Companion origin and that the initial frontend response established the session cookie. Public Preview without a fixture is expected to remain unavailable.

If Artifact loading stops with `INDEX_SNAPSHOT_MISMATCH` or `ARTIFACT_STALE`, do not display cached content. Rebuild or restart the read-only Companion as documented; no Refresh API is currently provided.

The server refuses wildcard and non-loopback bind addresses.

## API contract

### `GET /api/research/index`

Returns the in-memory Derived Index. A valid session cookie is required.

The index contains:

- `index_snapshot_id`
- opaque Artifact IDs
- Research Project Root-relative locators
- Display Metadata and mechanically derived Display Status
- `source_freshness_fingerprint`
- references to existing Research/Audit Hashes when present
- Relationships and Diagnostics

It does not contain Observation, Claim, Receipt, image, or report bodies.

### `GET /api/research/artifacts/<opaque-artifact-id>`

Returns the exact Artifact bytes only when:

- the session cookie is valid;
- the `X-Research-Index-Snapshot` request header matches the current index;
- the opaque Artifact ID exists in the index;
- a single Secure Read keeps the opened file within Research Project Root; and
- the byte size and Source Freshness Fingerprint derived from the response bytes match the index.

Mismatch returns HTTP 409 with `INDEX_SNAPSHOT_MISMATCH` or `ARTIFACT_STALE`. A file-identity change detected during the Secure Read is exposed at the Artifact API boundary as `ARTIFACT_STALE`. Stale content is not returned.

The API does not accept raw filesystem paths. `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS` return `READ_ONLY_API` with HTTP 405.

## Source Freshness Fingerprint v1

`source_freshness_fingerprint_v1` is a Derived Index freshness mechanism, not a Research/Audit Hash.

Algorithm:

1. Resolve and open a Research Project Root-contained file through the shared Secure Read helper.
2. Read the exact source bytes once.
3. Apply no text, newline, Unicode, YAML, or JSON normalization.
4. Calculate SHA-256 and byte size from those same bytes.
5. Store lowercase hexadecimal as the fingerprint value.

Index generation and Artifact responses use the same Secure Read helper. It checks path containment and symlink escape, opens one file, detects file-identity changes during the read, and derives response body, size, and fingerprint from one byte snapshot. The service does not validate one path and then reopen a different path for the response.

It is used only for stale detection and cache/snapshot identity. It must not be used for Semantic Equality, Claim decisions, Evidence identity, Review, Approval, Promotion, or as a replacement for an existing Pipeline Hash.

Research/Audit Hashes remain owned by the existing Pipeline. Research Explorer only references these existing fields when present:

- `draft_input_identity_hash`
- `candidate_wrapper_artifact_hash_v1`
- `canonical_assertion_artifact_hash_v1`
- `assertion_content_v1_hash`

## Status and relationship rules

Display Status is a Read Model value. The browser does not calculate it.

- Presence-based Artifact types receive their documented discovery state.
- Receipt status comes from the existing `receipt.result` value.
- Validator status comes from existing Validator result fields.
- Every Receipt is validated against `observation-to-claim-receipt.schema.json`. Invalid Receipts remain visible as failed Artifacts and add `RECEIPT_INVALID` to index diagnostics.
- A Candidate is marked `finalized` only when a schema-valid, successful `finalize_attempt` Receipt identifies the Candidate and Canonical Assertion; Candidate identity fields match the wrapper; the wrapper and Canonical YAML artifact hashes match; and the recomputed `assertion_content_v1_hash` matches the Receipt binding.
- `RECEIPT_HASH_MISMATCH` records an internally inconsistent Receipt hash binding. `FINALIZE_BINDING_INVALID` records a mismatch between the Receipt and current Candidate or Canonical Artifact.

Assertion ID equality alone does not establish Finalize success.
Research Explorer does not rerun Finalize, replace Validator behavior, or repair a Receipt. It only derives a display relationship from existing Pipeline contracts and current read-only Artifact snapshots.

## Security boundary

The implementation enforces:

- loopback-only binding;
- Host allowlist;
- Origin allowlist when an Origin header is present;
- rejection of cross-site `Sec-Fetch-Site` values;
- no wildcard CORS response;
- an HttpOnly, `SameSite=Strict` session cookie;
- no token in URL, query parameters, or browser storage;
- Research Project Root containment;
- symlink escape rejection;
- opaque Artifact ID lookup;
- read-only HTTP methods; and
- no API that accepts raw filesystem paths.

The token is generated in memory for each service process and is not written to the Repository or index.

## Public Preview boundary

Cloudflare Pages and GitHub Pages remain public fixture-only environments. They must not activate a Local Companion connection or contain real Research Artifacts. Local Research Mode is served by the Local Companion Service and may use the same-origin `/api/research/*` client contract.

`pnpm run validate:research-boundaries` rejects:

- Frontend source imports from `research/sd-prompt-research`;
- known Research Artifact filenames in `public/`;
- live Repository, inbox, Claim, Run, or localhost paths in the built public bundle; and
- concrete IDs extracted from current Run, Draft, Candidate, Evidence, Receipt, and Assertion Artifacts.

The guard intentionally allows inert Local Research Mode API client code such as `/api/research/index`. This separates legitimate same-origin transport code from real Artifact content. Public Preview remains fixture-only; runtime activation of Research Mode belongs only to the Local Companion origin.

`pnpm run build` runs this validation before and after the Vite build.

## Versioning and generated files

- Derived Index Schema: `schemas/research-explorer-index.schema.json`
- `schema_version`: `0.1.0`
- Fingerprint contract: `source_freshness_fingerprint_v1`

The index is generated in memory by default. `--output` is for local inspection and must not be treated as Canonical Research Data or bundled into the frontend.
