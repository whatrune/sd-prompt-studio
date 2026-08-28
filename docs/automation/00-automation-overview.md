# Integrated Dispatch Automation Overview

## Status

- Contract version: `0.1.0`
- Status: Freeze candidate
- Repository reality snapshot: supporting-record commit `65e84d3d787d4db871f34d4ab1ab452494a61605`; this immutable SHA is not labeled `Current main`
- General production dispatch／controller status: `UNKNOWN`; no incoming production edge to the general Dispatcher, Automatic Gate Progression, or Role Transition / Continuous Orchestration controller is confirmed at that snapshot
- Bounded production host status: Protected Transition Admission and its Repair Executor route are repository-reachable and have direct production execution evidence as described below

## Purpose

Integrated Dispatch Automation is the general target Contract for passing Canonical Task Assignments created by the Integrated Lead to specialist Role execution environments without adding decisions, and for collecting execution state and Result Handoffs. The bounded Protected Transition host that currently exists does not implement this Contract as a whole.

このContractの目的は自動実行そのものではなく、自動化してよい実行管理と、人間に残す判断を分離することである。

The following diagram shows the logical responsibility flow of the general target. It does not represent the current production runtime topology or an implemented host.

```text
Product Owner
        ↓ approval and product decisions
Integrated Lead
        ↓ canonical Task Assignment
Dispatcher
        ↓ validated execution request
Specialist Runner
        ↓ Result Handoff
Integrated Lead
        ↓ integrated report
Product Owner
```

## Repository Reality Snapshot

- The original alignment authority consists of the direct GitHub records [Issue #240](https://github.com/whatrune/sd-prompt-studio/issues/240) and [Resume Dispatch](https://github.com/whatrune/sd-prompt-studio/issues/240#issuecomment-5176584167). The direct record for Repair Executor production evidence is [Issue #278](https://github.com/whatrune/sd-prompt-studio/issues/278).
- Repository-relative paths in this section and document are supporting records only when bound to full commit SHA `65e84d3d787d4db871f34d4ab1ab452494a61605`. A repository-relative path is not itself a Canonical Record, authority, or runtime proof.
- Production composition rootのsupporting recordは`src/main.tsx` → `src/appRouter.tsx` → `src/App.tsx`である。このrootから`src/dispatch/**`、`src/automatic-gate-progression/**`、`src/canonical-event-admission/**`、`src/gate-status-publisher/**`、`src/continuous-orchestration/**`へのincoming edgeは確認できない。
- Retired Collector V1 and its Continuous Orchestration sources are absent from the current repository. The current Merge contract's terminal-observation requirement is owned by the bounded Protected Transition Admission owner described below; this does not restore the retired service or CLI.
- Source、public export、fixture、test runner、internal library／module consumerの存在は、それだけではproduction runtime reachabilityの証拠にならない。

### Capability and Reachability Matrix

| Capability | Repository component at snapshot | Production incoming edge | Evidence state |
| --- | --- | --- | --- |
| General Dispatcher / controller | `src/dispatch/**` and continuous-orchestration libraries exist | none confirmed from the application root or an external production host | `UNKNOWN` |
| Automatic Gate Progression / Role Transition | evaluator, admission, publisher, and reducer modules exist | none confirmed from the application root or Protected Transition host | `UNKNOWN` |
| Protected Transition Admission | default-branch workflow invokes its owner CLI | `.github/workflows/protected-transition-admission-v1.yml` → `scripts/run-protected-transition-admission-v1.mjs` | production-reachable |
| Canonical Draft Return Owner V1 | Protected Transition Admission validates one exact-HEAD, operation-specific authority and performs `convertPullRequestToDraft` once | bounded `workflow_dispatch.draft_return_required_resume` route | repository-reachable after the implementing exact HEAD reaches the default branch |
| Current PTA Ready Review Terminal Observation Owner V1 | Protected Transition Admission binds the current real Ready generation, an explicit admitted-reviewer roster, terminal receipts, complete post-terminal review-thread pagination, a final HEAD refetch, and one self-bound canonical JSON seal | bounded `workflow_dispatch.ready_review_terminal_observation_resume` route; Merge Decision and Merge Operator reacquire the current-generation record | repository-reachable after the implementing exact HEAD reaches the default branch |
| Repair Executor | the same workflow conditionally routes admitted `CHANGES_REQUIRED` to a self-hosted Windows job | Protected Transition Admission → `REPAIR_EXECUTOR` | production execution proven at the bound historical run below |
| Retired Collector V1 / Continuous Orchestration | removed in the retirement change; no source, CLI, workflow, service, or scheduler owner remains | none | retired; not a current Merge evidence owner |

### Protected Transition Production Host

- At snapshot `65e84d3d787d4db871f34d4ab1ab452494a61605`, `.github/workflows/protected-transition-admission-v1.yml` exists as a default-branch host. It evaluates `scripts/run-protected-transition-admission-v1.mjs` once for `workflow_dispatch`, created `issue_comment`, and `pull_request.ready_for_review` events.
- A same-HEAD Review Decision is projected into state. An admissible `APPROVE` advances to one admission evaluation. `CHANGES_REQUIRED` or `BLOCKED` records blocking state and does not advance except to an authorized next action.
- For admitted `CHANGES_REQUIRED`, the Repair Executor targets only authorized paths and produces the minimum repair for the current blocking findings. After the selected focused validation profile passes, it pushes one normal non-force commit.
- [Production run 31554006864](https://github.com/whatrune/sd-prompt-studio/actions/runs/31554006864), at host SHA `21aeefd43156ea8ddb134e74141d3e69813705ad`, is historical exact-run evidence of successful self-hosted execution, Codex repair, validation, one commit, normal push, and fresh Review handoff. The static host path is confirmed at snapshot `65e84d3d787d4db871f34d4ab1ab452494a61605`, but Repair Executor E2E success with that exact snapshot as the host SHA remains `UNKNOWN`.
- Push後は既存state writerがPRのsingle 10-field stateをnew HEADの`REVIEW_PENDING`へrebindし、`next_action: REVIEW`（reason: `fresh_review_required`）としてfresh Reviewへ戻す。自動Mergeは行わない。
- `draft_return_required_resume` is the bounded recovery route for a Ready PR whose HEAD changed. It admits one self-bound `draft_return_authority_v1`, binds the authority body digest, proves that the prior Ready completion belongs to a different HEAD, performs exactly one `convertPullRequestToDraft` mutation, refetches the open PR at the unchanged authorized HEAD, publishes one self-bound `draft_return_completion_v1`, and stops. A completion consumes the authority only after the GitHub Actions bot actor, Task/PR/HEAD, self URL, authority digest, operation evidence, and the exact default-branch PTA run/job/log all authenticate. If the mutation and Draft refetch succeeded but completion publication failed, the failed PTA run is the durable `operation_consumed=true` / `completion_recorded=false` owner: a later resume may publish only the missing completion after revalidating that run and the unchanged open Draft PR, with `mutation_count=0`. Draft state alone is never recovery evidence. Fresh validation, Independent Review, Ready authority, the existing Ready operator, and the real `ready_for_review` event remain later lifecycle owners.
- Every attempted Draft Return mutation adds one closed `mutation_diagnostic` object to the existing terminal Actions result. It records only the operation, bounded execution phase and transport/response identity, bounded sanitized GraphQL errors or network exception identity, and one outcome: `DEFINITIVE_REJECTION`, `OUTCOME_UNKNOWN`, or `MUTATION_CONFIRMED`. A definitive GraphQL rejection requires every structured error type to be in the closed non-transient operation-rejection set (`FORBIDDEN` or `UNPROCESSABLE`); unknown, missing, internal, timeout, rate/service, or mixed errors remain outcome-unknown. Confirmation requires both a successful mutation response and a fresh `OPEN / Draft / unmerged` refetch at the unchanged exact HEAD; current PR state alone is not mutation evidence. The diagnostic never contains tokens, authorization or cookie headers, raw response bodies, or URL-like message tokens of any kind. It is observational only: one attempted mutation still consumes its authority, no automatic retry or successor authority is introduced, and completion recovery remains limited to a confirmed mutation plus Draft after-state whose completion publication is missing.
- Draft Return does not subscribe to or synthesize `pull_request.converted_to_draft`. The canonical completion is the operator's direct before/after refetch record. The normative event catalog remains unchanged and does not by itself establish a production incoming edge.
- `ready_review_terminal_observation_resume` admits one exact-HEAD, operation-specific Product Owner / Backend Architect authority. The authority binds the current Ready completion to the latest real `ready_for_review` timeline event and freezes a unique roster of admitted `INDEPENDENT_IMPLEMENTATION_REVIEWER` dispatches for that generation. Exactly one canonical Review Decision receipt is required per roster producer, and each receipt must be later than the Ready event.
- After the last terminal receipt, the owner fetches every `PullRequest.reviewThreads` page, records pagination completeness and snapshot timestamps, and refetches the open Ready PR at the unchanged exact HEAD. It then publishes one self-bound `ready_review_terminal_observation_artifact_v1`, validates every component digest and the final canonical JSON SHA-256 seal, and refetches the published Task Issue comment.
- The sealed artifact supplements rather than replaces current Merge evidence. Merge Decision and Merge Operator reacquire the artifact for the current Ready generation, while the existing owners still freshly enforce current `APPROVE / 0 / 0 / 0`, unresolved-thread count, successful checks, exact HEAD, mergeability, Product Owner Merge Decision, and the final Merge rebind.
- A stale generation, synthetic or mismatched Ready identity, missing or duplicate producer receipt, pre-Ready receipt, incomplete thread pagination, HEAD drift, malformed canonical JSON, or digest mismatch stops before Merge. Old Ready generations remain historical. GADP remains an isolated `continue-on-error` non-authoritative shadow and cannot substitute for the sealed PTA record.
- この実在確認はProtected Transition Admission V1 hostだけに適用する。一般的なproduction dispatch／controller hostのincoming edgeを証明せず、次節の`UNKNOWN`境界を変更しない。

## Preserved UNKNOWN

次はcanonical runtime recordまたはproduction composition／execution hostからのincoming edgeで実証されるまで`UNKNOWN`のまま維持する。

- production dispatch／controller host
- Cloudflare側設定と実行条件
- repository外Automation実行経路

## Responsibility Boundary

### Integrated Lead

- 依頼を分類する。
- 適切な専門Roleと依存関係を決める。
- Task AssignmentをCanonical Recordへ保存する。
- Result Handoffを検証し、必要なら差し戻す。
- Product Ownerへ統合報告する。

### Dispatcher

- Task Assignmentを受け付ける。
- 形式、承認、Role Binding、重複実行を確認する。
- 対応する論理Runnerへ起動要求を渡す。
- Dispatch状態、timeout、cancel、failureを管理する。
- Result Handoffを受領してIntegrated Leadへ返す。

Dispatcherは実行管理Roleであり、Architecture、Contract、Product、Research、Observation、Scope、Merge、Revertを判断しない。

### Specialist Runner

- Assignmentで指定されたPrimary Roleとして作業する。
- Allowed / Forbidden ChangesとFreeze済みContractを守る。
- 指定Validationを実行する。
- Result Handoffを返す。

## Normative Sources

このContractは次を拡張せずに参照する。

1. [`../team/00-operating-model.md`](../team/00-operating-model.md)
2. [`../team/05-worktree-and-branch-rules.md`](../team/05-worktree-and-branch-rules.md)
3. [`../team/08-integrated-lead-charter.md`](../team/08-integrated-lead-charter.md)
4. [`../team/09-development-routing-contract.md`](../team/09-development-routing-contract.md)
5. [`../team/10-research-operations-routing-contract.md`](../team/10-research-operations-routing-contract.md)
6. [`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md)

衝突時は既存Team Contractと対象領域のFreeze Contractを優先する。Dispatcherは衝突を解決せず`blocked`としてArchitect Teamへ返す。

## Future MVP Scope

将来の最小MVPは次の一往復に限定する。

```text
Approved GitHub Issue Task Assignment
        ↓
Dispatcher admission
        ↓
Worker Runner one-shot execution
        ↓
Draft PR or Result Handoff
        ↓
Integrated Lead verification
```

MVPで自動化可能な操作:

- Task形式と必須Fieldの確認
- 承認状態とRole Bindingの確認
- Worker Runnerの一回起動
- Assignmentで指定されたValidationの実行要求
- 許可済みの場合の通常PushとDraft PR作成要求
- Result Handoff投稿
- Dispatch状態更新

MVPで自動化しない操作:

- 自動Approve、Merge、Revert
- `main`直接変更またはforce push
- Contract、Scope、Product優先順位の変更
- 次Roleの自動連鎖
- Canonical Mapping採用
- Research判断、Observation判断、Research Claim生成
- Existing RunまたはResearch Artifactの破壊的変更

## Contract Documents

- [`01-dispatch-contract.md`](01-dispatch-contract.md): Trigger、状態、重複防止、実行Lifecycle
- [`02-role-runner-mapping.md`](02-role-runner-mapping.md): Role Bindingと論理Runner
- [`03-approval-gate.md`](03-approval-gate.md): Human GateとAutomation Gate
- [`04-security-boundary.md`](04-security-boundary.md): Trust Boundaryと禁止事項
- [`05-automation-handoff-contract.md`](05-automation-handoff-contract.md): 実行情報を含むResult Handoff

## Deferred Implementation Decisions

次は本Contractでは決定または実装しない。

- GitHub-hosted / self-hosted runnerの選択
- RunnerのOS、Service、User、Network構成
- GitHub Actions、Webhook、Bot、常駐Serviceの選択
- Codex CLI、SDK、Actionの選択と引数
- Secret、Token、Environmentの具体設定
- 永続DatabaseまたはJSON Schema
- Workflow YAML、Dispatcher Script、Runner provisioning

これらは本ContractのSecurity BoundaryとAcceptance Criteriaを満たす別Implementation Taskで決定する。
