# Integrated Dispatch Approval Gate

## Purpose

Separate routine operations that Automation may perform from operations that require an explicit human decision. Technical executability does not imply approval. [`../team/13-shared-role-execution-contract.md`](../team/13-shared-role-execution-contract.md) is the sole normative owner of protected actions, Merge sequencing, exact-HEAD decisions, and operator authority. This document defines only Automation-specific gate deltas.

## Approval Gates

| Gate | Decision | Required owner | Automation boundary |
| --- | --- | --- | --- |
| Gate 1: Task start | Assignmentを起動してよいか | Product Ownerまたは明示的に委任されたActor | 未承認ならRunnerを起動しない |
| Gate 2: Publish | 通常PushとDraft PR作成を許可するか | Task Assignmentで指定されたOwner | 許可範囲とValidation成功時だけ実行要求可能 |
| Gate 3: Next role | Whether a new Task may be assigned to the next Role | Integrated Lead; Architect Team for Contract decisions | This general MVP trigger does not chain automatically. Opt-in automatic progression follows [`23-automatic-gate-progression-contract.md`](23-automatic-gate-progression-contract.md) |
| Gate 4: Merge / Revert | mainへ導入または取消するか | Product Owner | 判断はexact HEADへbindingし、判断とは別に、明示的に許可されたOperatorだけが許可methodで操作する |

## Human-only Decisions

次は自動化しない。

- Product方針、優先順位、成功条件の変更
- Contract、Architecture、Schema、API Scopeの変更
- Task ScopeまたはRoleの変更
- Canonical Mapping採用
- Research Interpretation、Working Conclusion、Research Claim
- Existing RunまたはResearch Artifactの削除、置換、無効化
- Merge、Approve、Revert
- Merge可否の判断と、判断にbindingしたexact HEADまたはmethodの変更
- Security Boundaryの例外承認

## Automation-permitted Operations

承認済みAssignmentの範囲内で、Dispatcherは次を要求できる。

- Required FieldとCanonical Recordの確認
- repository、Role、revision、重複実行の確認
- Runner起動
- 承認済みValidation profileの実行
- Assignmentで許可された通常PushとDraft PR作成
- Result Handoff投稿
- Dispatch状態更新

This general Dispatcher does not infer corrections from missing required information, out-of-Scope changes, or Validation failures. The separately existing Protected Transition Repair Executor performs only minimum correction limited to admitted `CHANGES_REQUIRED` and authorized paths on the production host recorded in [`00-automation-overview.md`](00-automation-overview.md).

Merge operatorはProduct Ownerの判断を作成または補完しない。Product Ownerの判断だけでもMerge操作は完了しておらず、操作可能なActorが存在するだけでもMerge判断済みとは扱わない。

## Approval Validity

Approvalは次へBindingする。

- repository
- `task_id`
- Canonical Assignment revision
- assigned role
- base branchまたはbase revision
- allowed / forbidden changes
- Merge-decision binding follows the Shared Role Execution Contract's canonical sequence and exact-HEAD conditions

承認後にBinding対象が変化した場合、既存Approvalは無効で`stale`となる。表記修正か実質変更かをDispatcherが判断して継続してはならず、再承認を必要とする。

## Rejection and Cancellation

- Gate未通過はfailureではなく`blocked`または`draft`とする。
- Product Ownerは`queued`または`running`をcancelできる。
- Cancelは既に作成されたcommit、branch、artifactを自動削除しない。
- Cancel後のcleanupまたは再利用は人間がHandoffを確認して決める。

## No Implicit Approval

次はApprovalとして扱わない。

- Issue作成またはAssignment保存だけ
- Role Labelだけ
- Integrated LeadのRouting判断だけ
- 過去Taskでの承認
- 会話上の推測
- Runnerが起動可能であること
- Validationが成功したこと
