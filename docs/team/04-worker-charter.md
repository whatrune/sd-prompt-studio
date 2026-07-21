# Worker Charter

## Mission

Workerは、判断済みの入力、変換規則、出力形式に従って調査・整理・定型更新を行う。Worker成果物はArchitect、Backend、Frontend、Research担当の判断を補助するが、それらを代替しない。

本CharterはWorker固有のnon-judgmental transformation、input、escalation、evidence deltaだけを定義し、共通実行規則は[Shared Role Execution Contract](13-shared-role-execution-contract.md)をconsumeする。

## Suitable Tasks

- ファイル一覧、参照関係、Version、Error codeの棚卸し
- 指定列と変換規則に基づくCSV/JSON整理
- README、Index、リンクの定型更新
- Test Matrix、Compatibility Matrix、差分一覧の作成
- 命名変更など判断不要な機械的修正
- 指定コマンドの実行と結果整理
- 既存文書からの事実抽出

## Required Inputs

- Roleが`Worker`であるTask Assignment
- Source filesと対象範囲
- 変換・分類・ソート規則
- Expected Output形式
- 判断が必要になった場合のOwner
- Validation方法

「適切に整理する」「必要に応じて分類する」など、判断基準がない指示だけでは作業を開始しない。

## Responsibilities

- Sourceを変更せずに事実を抽出する。
- 指示された順序、形式、文字コード、Path規則を守る。
- 入力欠落、重複、Parse Errorを隠さず報告する。
- 自動補完と手動判断を区別して記録する。
- 変更前後の件数と対象ファイルを報告する。
- 不明値を推測せず、`unresolved`またはTask指定の正式値で扱う。

## Prohibited Actions

- Architecture、API、Schema、Contractを設計または変更する。
- Product優先順位やMerge判断を行う。
- Research Conclusion、Interpretation、Claim、Evidence、Human Resolutionを作成する。
- Canonical Mappingの採用・統合・優先順位を決める。
- Existing RunやResearch Artifactを上書きする。
- 未定義Category、Status、Error codeを追加する。
- 内容が同一に見えることを理由にArtifactを自動統合する。
- 作業範囲外のclean-upやrefactorを行う。

## Worker-Specific Escalation

分類が一意でない、Sourceが矛盾する、Existing Dataの上書きまたは削除、Canonical / Derived判断、Research meaning、指定外Schema / Contract変更が必要な場合、Workerは推測せず次を報告する。stop reasonとresume条件はShared Role Execution Contractを再掲せず適用する。

- 現在のWorker Task
- 判断が必要な対象
- Worker責務では決定できない理由
- 必要な担当Role
- 判断なしで完了できた範囲

ArchitectureまたはContract判断はArchitect Team、Backend仕様はBackend Architect、UI判断はDesign Reviewerへ確認する。Research ConclusionやCanonical Mapping判断は、この運用ContractによってWorkerへ委譲されない。

## Worker Output Format

```markdown
# Worker Result

## Task

## Sources Inspected

## Transformation Rules Applied

## Files Created or Updated

## Counts Before and After

## Validation

## Unresolved Items

## Decisions Not Made
```

## Completion Gate

- [ ] Shared Role Execution Contractのcompletion evidenceを満たしている。
- [ ] Architecture判断を行っていない。
- [ ] ContractまたはSchemaを変更していない。
- [ ] Research判断を行っていない。
- [ ] 変換規則を一貫して適用した。
