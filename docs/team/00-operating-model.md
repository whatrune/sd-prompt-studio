# SD Prompt Studio Team Operating Model

<!-- role-contract-meta
id: 00
kind: operating_model
owns: role_taxonomy, precedence, decision_ownership, team_topology
uses: shared_admission, protected_actions, terminal_stop_reason, review_admission, review_finding, review_decision_record, assignment_shape, result_handoff_shape, handoff_status
-->

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

1. Product Ownerの最新の明示判断（Product Owner authority内のみ）
2. 対象TaskのFreeze済みContract、Task Assignment、権限あるCumulative Amendment、Review Decision、Resume Dispatch
3. Repository rootの`AGENTS.md`
4. 本Operating Model
5. [`13-shared-role-execution-contract.md`](13-shared-role-execution-contract.md)
6. applicable primary Role Charter
7. applicable capability overlayである[`14-review-execution-contract.md`](14-review-execution-contract.md)
8. routing、branch、automation integration contract
9. templateとexample
10. implementation convention

下位Sourceは上位Sourceを緩和できない。Role Charterと共通Contractが衝突する場合、作業者は独自解決せず、`architecture_gap`としてArchitect Teamへ返却する。

## Normative Ownership Map

| Concern | Normative owner |
| --- | --- |
| Role taxonomy、team topology、全体flow、最上位precedence | 本Operating Model |
| 全Role共通のadmission、authority、stop、same-task correction、testing、completion evidence | [`13-shared-role-execution-contract.md`](13-shared-role-execution-contract.md) |
| Role固有責務とauthority delta | applicable Role Charter |
| Review capabilityの実行規則 | [`14-review-execution-contract.md`](14-review-execution-contract.md) |
| Task Assignment / Result Handoff shapeとstatus | [`11-delegation-and-result-contract.md`](11-delegation-and-result-contract.md) |
| routing、Git lifecycle、automation integration | 各専用contract |
| 記入形式 | templates。normative ruleを所有しない |

`Frontend Architect`と単一の汎用Reviewerは正式Roleとして追加しない。Review Contractは既存RoleへAssignment時だけ適用するcapability overlayである。

## Reference Edge Types

- `normative dependency`: consumerがownerのruleを適用するedge。必ず`consumer -> owner`で記録する。
- `ownership declaration`: 本Operating Modelがunique ownerを列挙するためのpointer。dependency edgeではない。
- `navigation backlink`: 読者の移動だけを目的とするlink。dependency edgeではない。
- `example`: non-normativeでありdependency edgeではない。

literal Markdown link graphとnormative dependency graphは別に検証し、どちらにもcycleを作らない。

各`AGENTS.md` / `docs/team/00`〜`14`は、先頭にexactly oneの`role-contract-meta` commentを持つ。

- `id`: graph nodeとして一意なdocument ID
- `kind`: `entry_guard | operating_model | role_charter | contract | routing_contract | template`
- `owns`: この文書だけがnormative ownerであるconcernのcomma-separated list。所有しない場合は`none`
- `uses`: 他文書のnormative concernをconsumeするcomma-separated list。consumeしない場合は`none`

validatorは実文書の`owns`からunique owner mapを作り、各`uses`をそのownerへ解決して`consumer -> owner` edgeを導出する。undeclared owner reference、duplicate owner、Freeze済みownerの反転、self dependency、cycleを失敗させる。`kind: template`は`owns: none`だけが許可される。

## Roles

### Integrated Lead

責務:

- Product Ownerからの通常依頼の受付
- Development、Research Operations、Supportへの分類
- 既存RoleへのTask Assignmentと依存関係管理
- Result Handoffの受領、整合確認、差戻し
- Product Owner向け統合完了報告

Integrated Leadは専門作業、Architecture判断、Research判断、Mergeを行わない。既存Roleの責務や承認権限を置き換えず、通常窓口とRoutingを一本化する。詳細は[`08-integrated-lead-charter.md`](08-integrated-lead-charter.md)を参照する。

### Dispatcher

Dispatcherは、将来のIntegrated Dispatch AutomationでCanonical Task Assignmentの受付、Role Binding、Runner起動要求、実行状態管理、Result Handoff回収を行う実行管理Roleである。判断Roleではなく、Integrated Lead、Architect Team、Product Owner、Research Operations Roleの判断を代行しない。

現在はContractのみであり、Dispatcher、Runner、Bot、Workflow、CLIは実装されていない。責務と自動化境界は[`../automation/00-automation-overview.md`](../automation/00-automation-overview.md)を参照する。

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

将来Dispatcherを有効化する場合も、`Task Assignment`から`Implementation or Worker Execution`までの起動と実行状態管理だけを補助する。Contract Freeze、Role Review、Integrated Lead Completion Verification、Product Owner Merge Decisionは自動化しない。

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

全Role共通のadmission、protected action、Role変更禁止、stop reasonは[Shared Role Execution Contract](13-shared-role-execution-contract.md)を適用する。本Operating ModelではRoleの存在とDecision ownerだけを定義し、共通実行規則を再定義しない。

Freeze済みContractの変更、Existing Run、Research Artifact、Canonical Mappingの変更、ProductまたはResearch meaningの決定は、上記Decision BoundaryとTask Assignmentのauthorityに従う。

## Review Model

| Change type | Required review |
| --- | --- |
| Architecture / Contract | Architect Team |
| Backend implementation | Backend Architectまたは委任されたBackend Reviewer |
| Frontend implementation | Design Reviewer; API影響時はBackend Architectも必要 |
| Worker output | Taskを割り当てたRole |
| Research Artifact | 既存Research Workflowで要求されるReview |

Review Assignmentを受けた既存Roleは[Review Execution Contract](14-review-execution-contract.md)を適用する。このoverlayは正式Roleを追加せず、Merge、Approve、Ready、Revert、Issue closureのauthorityを付与しない。

## Execution and Completion

全Role共通のfresh fetch、terminal stop reason、progress-only reporting禁止、same-task correction、testing baseline、completion evidenceは[Shared Role Execution Contract](13-shared-role-execution-contract.md)が唯一のnormative ownerである。Result Handoffのfieldとstatusは[Delegation and Result Contract](11-delegation-and-result-contract.md)に従う。
