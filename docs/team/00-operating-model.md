# SD Prompt Studio Team Operating Model

## Purpose

この文書は、SD Prompt Studioを複数担当で安全に開発するための共通運用モデルを定義する。目的は、Product判断、Contract設計、Backend実装、Frontend実装、定型作業を分離し、Freeze済み仕様と既存Research Artifactを保護したまま並行開発できる状態を作ることである。

この運用Contractは開発方法を定義するものであり、Product方針、Research Contract、Observation、Evidence、Schema、Canonical Research Dataの意味を変更しない。

## Protected Contract Baseline

PR81〜PR86で確立された次の責務境界は、本運用Contractの対象外であり、そのまま維持する。

- Prompt Provenance Foundation
- Camera Visibility Metadata Foundationとその実装境界
- Image Observation Contract Foundation
- Evidence Evaluation Foundationとpure evaluator実装境界

本運用Contractは、これらのSchema、Status、Error、Hash、Artifact、Observation、Evidenceの意味を再定義しない。将来これらを変更するTaskは、通常のImplementation Assignmentではなく、Product Ownerの明示判断とArchitect Teamによる別Contract Reviewを必要とする。

## Normative References and Precedence

作業者は次の優先順位で指示を解釈する。

1. Product Ownerの最新の明示判断
2. 対象作業で指定されたFreeze済みContractとTask Assignment
3. Repository rootの`AGENTS.md`
4. 本ディレクトリのRole Charterと運用文書
5. 対象領域の既存Documentationと実装上の慣例

下位文書が上位Contractと衝突する場合、作業者は独自解決せず、衝突箇所をArchitect Teamへ返却する。

## Roles

### Integrated Lead

責務:

- Product Ownerからの通常依頼の受付
- Development、Research Operations、Supportへの分類
- 既存RoleへのTask Assignmentと依存関係管理
- Result Handoffの受領、整合確認、差戻し
- Product Owner向け統合完了報告

Integrated Leadは専門作業、Architecture判断、Research判断、Mergeを行わない。既存Roleの責務や承認権限を置き換えず、通常窓口とRoutingを一本化する。詳細は[`08-integrated-lead-charter.md`](08-integrated-lead-charter.md)を参照する。

### Product Owner

責務:

- Product上の最終意思決定
- 優先順位と成功条件の承認
- Scope変更の承認
- Merge可否の最終判断
- 未決定事項を保留するか確定するかの判断

Product Ownerは技術Contractを単独で暗黙変更する役割ではない。技術的影響はArchitect Teamが整理し、判断可能な選択肢として提示する。

### Architect Team

責務:

- Architecture判断
- Contract設計とFreeze
- PRおよびTaskの分割
- Role間の責務境界の確定
- 技術レビュー
- 未定義事項とContract衝突の解消

参加Role:

- Product Owner
- Design Reviewer
- Backend Architect

### Backend Implementer

責務:

- Freeze済み仕様のBackend実装
- API、Validator、Artifact処理の実装
- Deterministic Logicと安全境界の実装
- Backend Testと回帰Testの作成
- 実装結果と未確認事項の報告

### Frontend Implementer

責務:

- UIとReact Componentの実装
- Frontend State管理
- UX改善
- API Contractに従ったRead Model表示
- Frontend TestとPreview確認

### Worker

責務:

- 調査、棚卸し、比較表作成
- 指示済み形式へのCSV/JSON整理
- READMEと資料の定型更新
- Test Matrix作成
- 判断を伴わない機械的修正

## Delivery Flow

標準フローは次のとおりとする。

```text
Product Decision
        ↓
Integrated Lead Intake / Routing
        ↓
Architect Design / Contract Freeze
        ↓
Task Assignment
        ↓
Implementation or Worker Execution
        ↓
Role Review / Contract Review
        ↓
Integrated Lead Completion Verification
        ↓
Product Owner Merge Decision
        ↓
Merge and Worktree Cleanup
```

Contract変更とImplementationは別作業単位として扱う。Implementation担当はFreeze済みContractを入力として受け取り、その作業内でContractを変更しない。実装中に曖昧性が見つかった場合は、実装で補完せずArchitect Teamへ返却する。

Integrated LeadはこのFlowの状態とHandoffを管理するが、各Gateの専門判断を代行しない。Development Routingは[`09-development-routing-contract.md`](09-development-routing-contract.md)、Research Operations Routingは[`10-research-operations-routing-contract.md`](10-research-operations-routing-contract.md)に従う。

## Work Item States

| State | Meaning | Exit condition |
| --- | --- | --- |
| `proposed` | 目的と背景のみ存在する | Product Ownerが優先順位と目的を承認 |
| `designing` | Architect Teamが境界を設計中 | 未決定事項が明示され、レビュー可能 |
| `frozen` | 実装可能なContractが確定 | Task Assignmentが作成可能 |
| `assigned` | Role、Scope、入力、出力が確定 | 専用branch/worktreeが準備済み |
| `in_progress` | 担当者が作業中 | Expected OutputとValidationが完了 |
| `review` | Role責務とContract適合を確認中 | Blockerがなく、検証根拠が揃う |
| `merge_ready` | Product Owner判断待ち | Product OwnerがMergeを許可 |
| `merged` | mainへ導入済み | Worktreeとbranchのcleanup完了 |
| `blocked` | 未定義事項または外部条件待ち | BlockerのOwnerが解消またはScopeを変更 |

## Decision Boundaries

| Decision | Owner | Required consultation |
| --- | --- | --- |
| Product priority and Merge | Product Owner | Architect Team |
| Architecture and Contract | Architect Team | Affected Implementers |
| Backend implementation detail | Backend Implementer | Backend Architect when Contract-sensitive |
| Frontend implementation detail | Frontend Implementer | Design Reviewer; Backend Architect for API impact |
| Mechanical transformation | Worker | Assigning Role |
| Research conclusion or Canonical research judgment | Authorized Research Workflow/Human | Not delegated by this operating model |

## Role Boundary Protection

担当者は依頼を受けた時点で、作業開始前に次を確認する。

1. 依頼は現在のRole責務内か。
2. 必要な権限と判断範囲を現在のRoleが持つか。
3. 別RoleがOwnerとなる領域ではないか。

責務外の場合は次のとおり対応する。

- 作業を開始しない。
- 必要な担当Roleを提示する。
- 依頼が一時的または恒久的なRole変更を意味するか確認する。
- Role変更が明示されるまでは、現在のRole境界を維持する。

例:

- Backend ImplementerがContract変更を依頼された場合、変更せずBackend ArchitectまたはArchitect Teamへ返却する。
- WorkerがArchitecture判断を依頼された場合、判断せずArchitect Teamへ返却する。
- Frontend ImplementerがBackend Schema変更を依頼された場合、変更せずBackend Architectへ返却する。
- Backend Architectが実装作業を依頼された場合、実装理由と緊急性を確認し、Backend ImplementerへTask Assignmentすべきかを先に判断する。

責務外依頼への返答は最低限、次を含む。

```text
Current Role:
Requested Work:
Why It Is Outside the Current Role:
Required Role:
Next Confirmation Owner:
Role Change Confirmation Required: yes / no
```

この確認は「技術的に実行可能か」ではなく、「現在のRoleとして実行する権限があるか」を判定するために行う。

## Non-negotiable Boundaries

- Freeze済みContractをImplementation担当が変更しない。
- 未定義仕様を実装者またはWorkerが推測して確定しない。
- Existing Run、Research Artifact、Canonical MappingをTask Assignmentなしで変更しない。
- UI都合でBackend Contractを変更しない。
- Backend都合でProductまたはResearch上の意味を変更しない。
- Observation、Interpretation、Working Conclusion、Claim、Evidence、Human ResolutionをRole権限だけを根拠に生成または確定しない。
- Review未完了の成果物をMerge Readyと報告しない。

## Review Model

| Change type | Required review |
| --- | --- |
| Architecture / Contract | Architect Team |
| Backend implementation | Backend Architectまたは委任されたBackend Reviewer |
| Frontend implementation | Design Reviewer; API影響時はBackend Architectも必要 |
| Worker output | Taskを割り当てたRole |
| Research Artifact | 既存Research Workflowで要求されるReview |

自分が作成したPRを自分でApproveしない。レビュー担当は目的達成、Contract適合、既存機能維持、Validation根拠を確認する。

## Stop and Escalate Conditions

担当者は次の場合に作業を停止し、Handoff形式でArchitect Teamへ返却する。

- Freeze文書間に矛盾がある。
- Expected Outputに必要なField、Status、Error、API動作が未定義である。
- 指定Scope外のSchema、Contract、Research Data変更が必要になる。
- Existing RunまたはCanonical Artifactの上書きが必要になる。
- Test期待値とFreeze Contractが一致しない。
- Product判断またはResearch判断なしでは結果を一意に決められない。

## Completion Standard

完了報告は最低限、次を含む。

- RoleとTask ID
- 対象branch/worktree
- 作成・更新ファイル
- 実施内容と非実施範囲
- Validationコマンドと結果
- Contract変更有無
- Existing Run / Research Artifact変更有無
- 未確認事項、既知の失敗、残課題
- Commit、PR、Checksの状態（該当する場合）
