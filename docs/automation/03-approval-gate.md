# Integrated Dispatch Approval Gate

## Purpose

Automationが実行してよい定型操作と、人間の明示判断を必要とする操作を分離する。技術的に実行可能であることを承認済みと解釈しない。

## Approval Gates

| Gate | Decision | Required owner | Automation boundary |
| --- | --- | --- | --- |
| Gate 1: Task start | Assignmentを起動してよいか | Product Ownerまたは明示的に委任されたActor | 未承認ならRunnerを起動しない |
| Gate 2: Publish | 通常PushとDraft PR作成を許可するか | Task Assignmentで指定されたOwner | 許可範囲とValidation成功時だけ実行要求可能 |
| Gate 3: Next role | 次Roleへ新Taskを割り当てるか | Integrated Lead、Contract判断時はArchitect Team | MVPでは自動連鎖しない |
| Gate 4: Merge / Revert | mainへ導入または取消するか | Product Owner | 常に人間判断 |

## Human-only Decisions

次は自動化しない。

- Product方針、優先順位、成功条件の変更
- Contract、Architecture、Schema、API Scopeの変更
- Task ScopeまたはRoleの変更
- Canonical Mapping採用
- Research Interpretation、Working Conclusion、Research Claim
- Existing RunまたはResearch Artifactの削除、置換、無効化
- Merge、Approve、Revert
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

Automation可能であっても、必須情報不足、Scope外変更、Validation失敗を自動補正しない。

## Approval Validity

Approvalは次へBindingする。

- repository
- `task_id`
- Canonical Assignment revision
- assigned role
- base branchまたはbase revision
- allowed / forbidden changes

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
