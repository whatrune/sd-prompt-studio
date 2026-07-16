# Research Specifications

This directory is the entry point for normative, versioned research-system
specifications. It separates contracts that implementations must follow from
operational notes, experiment records, and implementation-specific guides.

## Directory layout

```text
specifications/
├─ README.md
├─ pipelines/
│  └─ observation-to-claim-draft-pipeline-freeze.md
├─ contracts/      # Reserved for cross-pipeline data and hash contracts
├─ registries/     # Reserved for registry format and lifecycle contracts
└─ workflows/      # Reserved for review, approval, and operational workflows
```

Only directories containing a specification are committed. The reserved
categories above establish where future specifications belong; empty
directories are not added to Git.

## Document rules

- A Freeze specification is normative and must be implementable without prior
  chat history or unpublished design notes.
- Each specification states its status, scope, version boundaries, invariants,
  failure behavior, and intentionally deferred implementation choices.
- Observation, interpretation candidates, causal hypotheses, Reviews,
  Approvals, and Applications remain separate responsibility layers.
- A later specification supersedes an earlier one explicitly. Existing Freeze
  documents are not silently rewritten to represent a different contract.
- Generated artifacts and implementation code do not belong in this directory.

## Current specifications

- [Observation-to-Claim Draft Pipeline Freeze Specification](pipelines/observation-to-claim-draft-pipeline-freeze.md)

Existing documents directly under `docs/` remain in place. Moving them into
this hierarchy is outside the scope of the initial specifications PR and must
be performed separately with link and history review.
