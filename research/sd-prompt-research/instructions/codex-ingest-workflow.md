# Codex Ingest Workflow

## Purpose

Convert images placed in inbox into research Runs.

## Input

User places generated images into:

inbox/

Image filenames are not important.

Examples:

- image.png
- image (1).png
- image (2).png


## Tasks

When requested to ingest images:

1. Run ingest_inbox.py.

Example:

python scripts/ingest_inbox.py --domain bridge --layout 3x2


2. Confirm created Run IDs.

- A single image uses the next numeric Run ID, for example `BRG-008`.
- Multiple images in one inbox batch share the next numeric Run ID and use condition suffixes, for example `BRG-008-A`, `BRG-008-B`, and `BRG-008-C`.
- The suffix and condition label must correspond: `-A` is `Condition A`, `-B` is `Condition B`, and so on.

3. Verify generated files:

experiments/{domain}/{run-id}/

Expected:

source/
- source image
- metadata
- rubric.yaml

panels/
preview/
manifest.yaml

4. Report the saved Run folder path in the completion response.

- Show the full folder path for each created Run.
- When multiple Runs are created, list every Run ID with its corresponding folder path.


## Rules

- Do not modify original images.
- Do not analyze image content.
- Do not assign research conclusions.
- Only perform file organization.
