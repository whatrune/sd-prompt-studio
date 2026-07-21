# Research Operations Routing Contract

## Purpose

このContractは、研究運用依頼をIntegrated Leadが既存Research Operations RoleへRoutingする規則を定義する。全Role共通の実行規則は[Shared Role Execution Contract](13-shared-role-execution-contract.md)、Research Review OPがReview Assignmentを受けたときの共通Review規則は[Review Execution Contract](14-review-execution-contract.md)を追加適用する。Observation、Evidence、Research Claim、Review statusの意味や生成権限は変更しない。

## Research Operations Roles

### Research Execution OP

- Inbox取込み
- 明示済みA/B/C条件の整理
- Run作成とPanel分割
- 研究開始処理の進行管理

Research Observationまたは研究結論を作成しない。

### Image Analysis OP

- 全PanelのVisible Evidence観察
- 明示的に許可されたObservation作成
- Rubric Axis、Value、順序の遵守
- 不明な状態を推測で補完しない

見えない接触、支持、荷重、因果、意図を補完せず、Research Interpretationを行わない。

### Research Review OP

- Image-to-Observation整合確認
- Observation Schema確認
- Rubric Evidence Policy確認
- AggregateとDerived Indexの確認
- `APPROVE`、`COMMENT`、`NEEDS_FOLLOWUP`、`REJECT`判定

原則としてレビュー中に成果物を変更しない。修正依頼と修正実行を分離する。

Research Review OPはReview Execution Contractをcapability overlayとして適用するが、`APPROVE`、`COMMENT`、`NEEDS_FOLLOWUP`、`REJECT`の判定語彙とResearch meaningは本Routing Contractと既存Research Workflowのまま維持する。

### Maintenance OP

- 既存Workflowに従ったAggregate生成
- 条件成立時の`OBSERVED`更新
- Run Ledger登録とDerived Index更新
- Validator実行
- 一時生成物整理

新しいResearch判断や未定義Artifactを生成しない。

### Reporting OP

- Markdown ReportとPDF生成
- 全ページ表示確認
- 成果物PathとRender結果の報告

Observation、Review Status、Research Conclusionを変更しない。

## Request Routing

### 研究開始 / 次の研究開始

1. Research Execution OP
2. Image Analysis OP
3. Maintenance OP
4. Integrated Leadが各結果と未完了工程を統合報告

「研究開始」と「次の研究開始」は、既存Research ContractとTask Assignmentの範囲内で、Research Execution OP、Image Analysis OP、Maintenance OPへRoutingする明示許可である。Image Analysis OPは全PanelのVisible Evidence観察、Observation作成、Rubric Axis、Value、順序の遵守を行えるが、見えない接触、支持、荷重、因果、意図を補完しない。

この依頼にはResearch Review、Research Interpretation、Working Conclusion、Research Claim、Human Resolution、Canonical Mappingの正式採用、PDF生成、Existing Runの上書き・削除・置換を含まない。Research Reviewは「研究結果レビュー」等、PDF生成は「PDF化して」または「研究開始してPDF化」等の明示依頼を必要とする。Research Interpretation以降は既存Research Workflowが要求する別の明示承認を必要とする。

対象Run、入力画像、期待Panel構成、Rubricなどの必須Inputが不足する場合は安全停止し、不足情報を報告する。Integrated Lead自身がImage AnalysisまたはMaintenanceを実行する意味ではない。

### 研究結果レビュー

1. Research Review OP
2. Integrated LeadがReview Status、Critical Finding、未確認項目を確認
3. Product Ownerへ結果を報告

### 修正して再レビュー

1. Integrated Leadが修正対象と適切なRoleを特定
2. 修正作業を担当OPへ委譲
3. 必要な再生成をMaintenance OPへ委譲
4. Research Review OPへ新しいReview Taskを割当
5. Integrated Leadが結果を統合報告

仕様判断が必要な場合はResearch OPへ推測させずArchitect TeamへRoutingする。

### PDF化して

1. Reporting OP
2. Renderおよび表示確認
3. Integrated Leadが成果物Path、対象Run、Validation、未確認事項を報告

Observation未完成またはValidation失敗時に、Reporting成功を研究処理全体の成功として扱わない。

### 引継ぎを更新して

1. Workerまたは既存責務に該当するMaintenance OP
2. Integrated Leadが現在地、完了、未決定、次工程を確認
3. Product Ownerへ更新結果を報告

## Completion Gate

共通のcompletion evidenceとterminal reasonはShared Role Execution Contractが所有する。Research Operationsを完了報告する場合は、Role固有結果として次を分離確認する。

- Run取込み結果
- Observation作成とSchema Validation結果
- Rubric Evidence Policy結果
- Aggregate、Ledger、Derived Index結果
- Research Review Status
- Research Interpretationの実施有無
- PDF生成とRender確認の実施有無
- 未完了工程と次の安全な工程

例として、Observation Schemaが`PASS`でもRubric Evidence Policyが`FAIL`なら全体を`PASS`としない。必要に応じて`needs_followup`または`failed`とする。

## Research Boundary

Integrated Leadおよび本Routing Contractは次を許可しない。

- Observationの推測生成
- Visibility MetadataからObservation Confidenceへの自動変換
- Research Interpretation、Working Conclusion、Claimの自動生成
- Review結果の書換え
- Canonical Research Dataの独自採用
- Existing Runの上書き、削除、置換

研究判断が必要な事項は既存Research WorkflowまたはProduct Ownerへ戻す。

## Handoff Requirements

各Research OPは[`11-delegation-and-result-contract.md`](11-delegation-and-result-contract.md)に従い、対象Run、開始・終了Status、作成・更新Artifact、Validation、研究判断の実施有無、未完了工程を返す。会話のみを完了根拠にしない。
