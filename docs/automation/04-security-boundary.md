# Integrated Dispatch Security Boundary

## Purpose

Issue、Dispatcher、Runner、Repository、Result Handoff間のTrust Boundaryを定義し、AutomationがRepository、credential、個人環境、別Taskへ影響を拡大しないようにする。

本書はSecurity要件を定義するが、Runner、Environment、Token、Workflowの具体実装は定義しない。

## Trust Model

信頼できるControl Input:

- allowlist内Repositoryのversion管理済みContract
- 直接参照可能なCanonical Task Assignment
- 許可ActorによるApproval
- 承認済みRole MappingとValidation Profile

信頼しないInput:

- IssueまたはCommentの自由記述
- fork、外部PR、外部Repositoryの内容
- Assignmentに列挙されていないCommand
- 未承認branchの`AGENTS.md`、Workflow、Script
- Runnerに残存する別Taskのfile、credential、process

## Mandatory Security Controls

- Repository allowlistを使用する。
- 未承認Issue、fork、外部ActorからRunnerを起動しない。
- `main`直接pushとforce pushを禁止する。
- 1 Taskごとにbranch、worktree、Execution、Lockを分離する。
- Issue本文をShellへ展開せず、任意Commandを許可しない。
- Token、Secret、credential、個人情報をPrompt、Log、PR、Handoff、Artifactへ出力しない。
- Runnerへ必要最小限のfilesystem、network、GitHub権限だけを与える。
- Assignmentの`allowed_changes`外の変更をpublishしない。
- Workflow、Action、Role Contractのrevisionを実行時に追跡可能にする。
- timeout、cancel、process crash後に別Taskへ状態を残さない。

## Threat Matrix

| Threat | Required response |
| --- | --- |
| Issue prompt injection | 自由記述を制御命令としてShellやRole設定へ使用しない |
| Shell command injection | version管理されたValidation Profile以外を実行しない |
| fork / external actor | Admissionで拒否しRunnerを起動しない |
| Approval Label misuse | Actor、Assignment revision、Roleを同時検証する |
| Over-privileged token | JobまたはProcess単位で最小権限に分離する |
| Codex credential exposure | 実行範囲を限定し、Log/Handoffへ保存しない |
| Local personal file access | Workspace containmentを必須とし、個人Directoryへ拡張しない |
| Malicious repository instruction | 承認済みbase revisionのContractだけへBindingする |
| Workflow tampering | Workflow変更Taskと通常Taskを分離し、Human Reviewを必須とする |
| Persistent runner contamination | Task隔離、cleanup確認、残存時の安全停止を要求する |
| Cross-task worktree contamination | 既存worktreeを再利用・上書きしない |
| Dependency or supply-chain script | 許可済みprofileだけをSecretなし環境で実行する |
| Secret or personal data in artifact | publish前に禁止内容を確認し、検出時はfailedとする |

## Repository and Branch Protection

将来実装は最低限、次を満たす。

- 対象Repositoryを固定し、任意Repositoryを受け付けない。
- `main`へのAutomation writeを拒否する。
- Task branchだけへ通常Pushする。
- Branch Protectionまたは同等のServer-side RuleでHuman Merge Gateを保護する。
- WorkflowまたはDispatcherの変更は通常Taskから分離してReviewする。

## Approval Environment

Secretまたはwrite権限を使用する実装では、人間のGate通過前にそれらをRunnerへ渡してはならない。Approval Environmentは必要概念だが、製品名、設定値、Reviewer、Secret名はImplementation / Provisioning Taskで決定する。

## Logging and Retention

- Auditに必要なTask ID、Execution ID、state transition、時刻、runner identity、commit、PR URLを記録可能にする。
- Secret、Token、完全なcredential、個人の絶対Pathを記録しない。
- Full promptや全文Transcriptを標準監査Recordにしない。
- ArtifactとLogの保持期間はProvisioning Contractで明示し、無期限を暗黙既定にしない。

## Security Failure

次を検出した場合、自動修正またはfallbackせず起動・publishを停止する。

- untrusted originまたはActor
- Approval不一致
- Scope外file変更
- credential出力の疑い
- repository / branch containment違反
- dirtyまたは別Task所有worktree
- Lock ownership不明
- ContractまたはRole revision不一致

可能な範囲で失敗HandoffをCanonical Recordへ残し、専門判断が必要ならArchitect Team、Product判断が必要ならProduct Ownerへ返す。
