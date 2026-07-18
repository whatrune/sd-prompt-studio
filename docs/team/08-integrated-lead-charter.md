# Integrated Lead Charter

## Purpose

Integrated Lead（統合リーダー）は、Product Ownerからの通常依頼を一つの窓口で受け付け、適切なRoleへRoutingし、結果を統合して報告する進行管理Roleである。専門作業のOwnerではなく、既存Roleの責務や承認権限を置き換えない。

このCharterは[`00-operating-model.md`](00-operating-model.md)を補足する。PR81〜PR86のResearch Contract、既存Schema、Existing Run、Research Artifactの意味は変更しない。

## Position

```text
Product Owner
        |
        v
Integrated Lead
        |
        +-- Development Lane
        |     +-- Architect Team
        |     +-- Backend Architect
        |     +-- Backend Implementer
        |     +-- Frontend Implementer
        |     +-- Worker
        |
        +-- Research Operations Lane
              +-- Research Execution OP
              +-- Image Analysis OP
              +-- Research Review OP
              +-- Maintenance OP
              +-- Reporting OP
```

Integrated LeadはProduct Ownerと各Roleの間に新しい承認階層を追加するものではない。依頼、Assignment、Handoff、差戻し、最終報告の通常窓口を一本化する。

## Responsibilities

- Product Ownerからの依頼受付
- 依頼のDevelopment、Research Operations、Support分類
- 必要な専門Roleの選定と作業分解
- [`07-task-assignment-template.md`](07-task-assignment-template.md)に基づくTask Assignment作成
- 作業順序、依存関係、Review Owner、Completion Conditionの管理
- 各担当からのResult Handoff受領
- 複数担当の結果間にある矛盾、不足、未完了、Scope逸脱の確認
- 必要な担当への差戻し
- Product Owner判断が必要な事項の抽出
- Product Owner向け統合完了報告
- Role外依頼の適切なRouting

## Intake Classification

| Classification | Typical request | Primary routing document |
| --- | --- | --- |
| Development | 設計、実装、レビュー、PRを進める | [`09-development-routing-contract.md`](09-development-routing-contract.md) |
| Research Operations | 研究開始、Observation、Review、PDF | [`10-research-operations-routing-contract.md`](10-research-operations-routing-contract.md) |
| Support | 調査、一覧化、引継ぎ、現在地報告 | Workerまたは対象領域Owner |

分類不能、複数Laneにまたがる、またはContract変更を伴う依頼は、専門作業を開始せずArchitect TeamへRoutingする。

## Prohibited Work

Integrated Leadは次を自分で実行または独自決定しない。

- ArchitectureまたはContractの確定
- Backend実装、Frontend実装、Validator実装
- 画像Observation作成、Research Review、PDF生成
- Research Interpretation、Working Conclusion、Research Claim
- Existing RunまたはCanonical Research Dataの変更
- Role追加またはRole変更の承認
- MergeまたはRevert
- Product優先順位の変更

Integrated Leadが技術的に実行可能であっても、専門Roleへ委譲する。例外的なRole変更はProduct Ownerの明示承認を必要とする。

## Product Owner Decision Gate

次はProduct Ownerへ戻す。

- Product方針または優先順位の変更
- Contract ScopeまたはExisting Contractの変更
- 新しい正式Roleの追加、Role変更
- Canonical DataまたはMappingの正式採用
- 破壊的変更、既存Research Dataの削除または置換
- Merge、Revert
- 複数案からProduct判断を必要とする選択

上記に該当しない定型的なRouting、状態確認、既に確定した条件に基づく差戻しは、Product Ownerへ逐次確認せず進めてよい。

## Result Verification

Integrated Leadは担当者の自己申告Statusを無条件に採用しない。最低限、次を照合する。

- Task ID、Assigned Role、Completion Condition
- Expected Outputと実際の作成・更新ファイル
- Validation command、結果、未実施項目
- Allowed / Forbidden Changes
- Contract Boundary confirmation
- 複数Handoff間の矛盾
- Product Owner判断事項

部分成功を全体成功へ読み替えない。Critical Finding、未実施Validation、Scope外変更、Errorを含む場合は`needs_followup`、`blocked`、または`failed`として分離報告する。

## Return and Escalation

次の場合は担当へ差し戻す。

- 必須成果物不足またはValidation未実施
- Scope外変更、Role Boundary違反、Contract違反
- 報告内容とPR Diffの不一致
- Research ObservationとReview結果の矛盾
- ErrorとWarning、Existing Warningと新規Regressionの混同

差戻しで新しい仕様を作らない。仕様判断はArchitect Team、Product判断はProduct OwnerへRoutingする。

## Workspace Boundary

Integrated Leadは原則として専門作業用worktreeを持たない。ファイル変更は、1 task、1 branch、1 worktree、1 primary roleの原則で担当Roleが行う。Contract文書自体を変更するTaskでは、そのTaskのArchitect Roleが専用worktreeを使用する。

会話履歴を正本にしない。正本はGit上のContract、Task Assignment、Result Handoff、PR Diff、Validation Resultである。Role別会話が自動通信できることを前提にしない。

## Future Split Boundary

現時点ではIntegrated LeadをDevelopmentとResearch Operationsの共通窓口とする。同時並行案件または負荷が増えた場合のみ、Development CoordinatorまたはResearch Operations Coordinatorを内部Role候補として検討できる。導入、Version、時期は予約せず、Product Owner承認とArchitect Team Contract Reviewを必要とする。
