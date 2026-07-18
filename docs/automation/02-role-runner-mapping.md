# Role and Runner Mapping Contract

## Purpose

Task Assignmentの`assigned_role`を、専門作業を実行する論理Runner Profileへ一意にBindingする。Runnerは物理Machineや特定製品名ではなく、Role、権限、入力、出力、Validation能力の組を表す。

## Mapping Principles

- `assigned_role`は自由記述から推測しない。
- Version管理されたRole Contractと完全一致するRoleだけを扱う。
- Issue Label、Assignment Role、Runner Profileが一致しなければ起動しない。
- Runnerは別Roleの判断または権限を取得しない。
- Runner未対応Roleを近いRoleへfallbackしない。
- Role Mapping変更はArchitect Team Reviewを必要とする。

## Logical Mapping

| Assigned Role | Logical Runner | Contract source | Future MVP status |
| --- | --- | --- | --- |
| Worker | Worker Runner | [`../team/04-worker-charter.md`](../team/04-worker-charter.md) | enabled candidate |
| Architect Team | Architect Runner | [`../team/01-architect-team-charter.md`](../team/01-architect-team-charter.md) | not enabled |
| Backend Implementer | Backend Runner | [`../team/02-backend-implementer-charter.md`](../team/02-backend-implementer-charter.md) | not enabled |
| Frontend Implementer | Frontend Runner | [`../team/03-frontend-implementer-charter.md`](../team/03-frontend-implementer-charter.md) | not enabled |
| Image Analysis OP | Research Runner | [`../team/10-research-operations-routing-contract.md`](../team/10-research-operations-routing-contract.md) | not enabled |
| Research Review OP | Review Runner | [`../team/10-research-operations-routing-contract.md`](../team/10-research-operations-routing-contract.md) | not enabled |
| Maintenance OP | Maintenance Runner | [`../team/10-research-operations-routing-contract.md`](../team/10-research-operations-routing-contract.md) | not enabled |
| Reporting OP | Reporting Runner | [`../team/10-research-operations-routing-contract.md`](../team/10-research-operations-routing-contract.md) | not enabled |

`not enabled`はRoleの無効化を意味しない。Automation MVPから除外され、従来のTask Assignmentと手動起動を維持することを意味する。

## Worker Runner MVP Boundary

Future MVPのWorker Runnerは次に限定する。

- 調査、棚卸し、比較表、README、Test MatrixなどWorker Charter内の作業
- Assignmentで列挙されたPathだけの変更
- Product、Architecture、Contract、Research Conclusionを判断しない作業
- Assignmentで許可されたValidation profile
- 通常PushとDraft PRが明示許可された場合の成果物引渡し

次を必要とするTaskはWorker Runnerへ割り当てない。

- Code、Schema、Workflow、Secret、Runner設定の変更
- ArchitectureまたはContract Freeze
- Observation、Research Review、Claim、Canonical Mapping判断
- Existing RunまたはResearch Artifactの破壊的変更
- 未定義仕様の選択

## Runner Profile Requirements

全Runner Profileは最低限、次を宣言する。

- supported role
- repository allowlist
- allowed path boundary
- prohibited operations
- branch/worktree policy
- validation profile allowlist
- timeout and retry boundary
- network and filesystem boundary
- Result Handoff capability

具体的なOS、Machine、Service、Codex起動方式、credential方式はImplementation Contractへ延期する。

## Selection Failure

次の場合、Dispatcherは`blocked`としてIntegrated Leadへ返す。

- Role Mappingが存在しない。
- RoleがMVPで有効化されていない。
- 複数Runner Profileが同じ優先度で一致する。
- AssignmentがRunner Profileの権限を超える。
- Role Contractを参照できない、またはrevisionが一致しない。

Dispatcherは自動的に権限の強いRunnerへ切り替えない。
