# Integrated Dispatch Automation Overview

## Status

- Contract version: `0.1.0`
- Status: Freeze candidate
- Source / test component status: repository source and focused test components exist at supporting-record commit `ba5fc2a4395d2ac474ce95af3cd9b0e56cdb603a`
- Production automation runtime status: `UNKNOWN`（production dispatch／controller hostからのincoming edgeは未証明）

## Purpose

Integrated Dispatch Automationは、Integrated Leadが作成したCanonical Task Assignmentを、判断を追加せずに専門Roleの実行環境へ引き渡し、実行状態とResult Handoffを回収するための将来Contractである。

このContractの目的は自動実行そのものではなく、自動化してよい実行管理と、人間に残す判断を分離することである。

次の図は将来の論理責務フローであり、現在のproduction runtime topologyまたは実装済みhostを表さない。

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

## Repository Reality at Exact Base

- Canonical Task recordはdirect GitHub recordである[Issue #240](https://github.com/whatrune/sd-prompt-studio/issues/240)と[Resume Dispatch](https://github.com/whatrune/sd-prompt-studio/issues/240#issuecomment-5176584167)である。
- 次の「Current Protected Transition Host」小節を除き、本節および本書のrepository-relative pathは、full commit SHA `ba5fc2a4395d2ac474ce95af3cd9b0e56cdb603a`に束縛されたsupporting recordとしてのみ扱う。repository-relative path自体をCanonical Recordまたはruntime proofにしない。
- Production composition rootのsupporting recordは`src/main.tsx` → `src/appRouter.tsx` → `src/App.tsx`である。このrootから`src/dispatch/**`、`src/automatic-gate-progression/**`、`src/canonical-event-admission/**`、`src/gate-status-publisher/**`、`src/continuous-orchestration/**`へのincoming edgeは確認できない。
- `scripts/run-ready-review-terminal-observation-collector-v1.mjs`はCollector V1のproduction CLI adapter sourceとして存在し、`src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts`のpure coreを直接importして呼び出す。ただし、このsource edgeはphysical operator、scheduler／automatic trigger、Cloudflare設定、またはrepository外の実行経路の存在を証明しない。
- Source、public export、fixture、test runner、internal library／module consumerの存在は、それだけではproduction runtime reachabilityの証拠にならない。

### Current Protected Transition Host

- Exact base `017c329546f16d59440014846c48d5773a63a321`では、`.github/workflows/protected-transition-admission-v1.yml`がdefault branch上のactive hostとして存在し、`scripts/run-protected-transition-admission-v1.mjs`を実行する。
- workflow inputは`transition`、`task_issue_number`、`pr_number`、`exact_head`の4件に限定される。
- Current main `04821c1b414b1db2c07af397cc06b4fdc5e36e36`では、同じhostがscope内の`CHANGES_REQUIRED`を`REPAIR_EXECUTOR`へroutingする。Executorは許可済みpathだけを修正し、選択されたfocused validation profileの成功後に1件の通常commitをpushする。
- Push後は既存state writerがPRのsingle 10-field stateをnew HEADの`REVIEW_PENDING`へrebindし、`next_action: REVIEW`（reason: `fresh_review_required`）としてfresh Reviewへ戻す。自動Mergeは行わない。
- この実在確認はProtected Transition Admission V1 hostだけに適用する。一般的なproduction dispatch／controller hostのincoming edgeを証明せず、次節の`UNKNOWN`境界を変更しない。

## Preserved UNKNOWN

次はcanonical runtime recordまたはproduction composition／execution hostからのincoming edgeで実証されるまで`UNKNOWN`のまま維持する。

- production dispatch／controller host
- Collector V1 physical operator
- Collector V1 scheduler／automatic trigger owner
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
