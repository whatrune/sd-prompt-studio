# Research Claim Path Contract

## Research Project Root

The Research Project Root is the `research/sd-prompt-research/` directory in
the Git repository. Research Claim assertion files declare:

```yaml
path_base: research_project_root
```

This contract applies only to `axis_registry_refs.*.path`. Registry paths are
stored relative to the Research Project Root, for example:

```yaml
axis_registry_refs:
  face:
    path: templates/face-observation-rubric.yaml
```

The Git Repository Root and Research Project Root are separate concepts. A
legacy path such as
`research/sd-prompt-research/templates/face-observation-rubric.yaml` is not
silently rewritten or stripped by the current resolver.

## Evidence paths

`evidence_refs.*.observation_path` retains its existing Git Repository Root
contract. Its stored value and resolver are not affected by
`path_base: research_project_root`:

```yaml
observation_path: research/sd-prompt-research/experiments/bridge/BRG-008-B/face-observation.json
```

## Axis Registry resolver

The Validator resolves Registry paths in this order:

1. Reject Windows drive-absolute and drive-relative paths.
2. Reject UNC paths, absolute paths, and `..` traversal segments.
3. Resolve the path relative to the Research Project Root.
4. Resolve the real path and reject files or symlinks outside that root with
   `AXIS_REGISTRY_PATH_INVALID`.
5. Report a missing file as `AXIS_REGISTRY_NOT_FOUND`.
6. Validate UTF-8 and then calculate `normalized_text_file_sha256_v1`.

Path errors take priority over missing-file, encoding, and hash-drift checks.
The Path Contract does not change Text File Hash Normalization or any JCS
Semantic or Audit Hash.

## Hash-drift output

`AXIS_REGISTRY_HASH_DRIFT` warnings are aggregated by normalized stored
Registry Path. The top-level `file` is the Registry Path and `path` is the
aggregate JSON Path `$.axis_registry_refs.*.sha256`. The optional top-level
`assertion_id` is omitted. `details.references` contains mismatched references
only, sorted by Assertion ID and stored SHA:

```json
{
  "code": "AXIS_REGISTRY_HASH_DRIFT",
  "severity": "warning",
  "file": "templates/face-observation-rubric.yaml",
  "path": "$.axis_registry_refs.*.sha256",
  "message": "Axis registry hash drift detected",
  "details": {
    "registry_path": "templates/face-observation-rubric.yaml",
    "computed_sha256": "...",
    "references": [
      {
        "assertion_id": "assertion.example.001",
        "file": "sd-prompt-research/knowledge/assertions/example.yaml",
        "path": "$.axis_registry_refs.face.sha256",
        "stored_sha256": "..."
      }
    ]
  }
}
```

Other Registry errors are not aggregated. Existing Validator JSON fields are
retained; `details` is an additive field for this warning.

## Historical validation

Current Claim files are validated against the Current Commit's schemas.
Baseline Claim files are validated against the schemas stored in the Baseline
Commit. This preserves the historical validity of the former
`path_base: repository_root` contract without permitting it in the Current
Schema.
