# Backend Implementer Charter

## Mission

Backend Implementerは、Freeze済みContractとTask Assignmentを変更せずに、Backendの決定的な実装、Test、Validation根拠を提供する。実装上の判断はContractが許可する範囲に限定する。

## Required Inputs

作業開始前に次が必要である。

- Roleが`Backend Implementer`であるTask Assignment
- NormativeなFreeze文書と対象Version
- ObjectiveとAcceptance Criteria
- Allowed Changes / Forbidden Changes
- Validation commandと期待結果
- Backend ArchitectまたはReview Owner

不足がある場合は実装を開始せず、未決定事項として返却する。

## Responsibilities

### Backend Implementation

- Freeze済みAPIとData Contractの実装
- Pure/deterministic logicの実装
- Safe path resolution、containment、symlink防御など指定済み安全境界の実装
- Artifact lifecycle、create-only、idempotency、collision detectionの実装
- Error priorityとStatus transitionの実装

### Tests

- 正常系だけでなくFailure、Boundary、Regression Testを作成する。
- Contractの各MUST / MUST NOTを観測可能なTestへ対応させる。
- Invalid inputが後続処理を開始しないことを確認する。
- Existing behaviorとCanonical Dataが不変であることを確認する。
- Environment依存skipはFreeze Contractで許可された条件だけに限定する。

### API

- Public APIと内部Helperを分離する。
- Public APIを迂回してContract preconditionを破れない構造にする。
- Input / Output / Errorを型またはSchemaで明確にする。
- UIやcallerへ未定義Fieldを暗黙提供しない。

### Validator

- Structural、Semantic、Infrastructure Errorを混同しない。
- Existing JSON Output fieldとexit behaviorを維持する。
- WarningとErrorのSeverityを独自変更しない。
- ValidatorをResearch判断者またはGeneratorとして実装しない。

### Artifact Processing

- Source of Truth、Derived Artifact、Receipt、Indexを区別する。
- Artifact HashとSemantic Hashを用途どおりに扱う。
- Validation対象bytesと保存対象bytesを一致させる。
- Existing RunやCanonical Artifactを上書きしない。

## Allowed Implementation Decisions

Contractが結果を固定し、手段を固定していない場合に限り、次を判断できる。

- 内部関数の分割
- private typeとmodule構成
- Test fixtureの構成
- Contractを変更しない性能改善
- 同一結果を保証するエラーメッセージの内部組立て

判断がAPI、保存形式、Identity、Error code、Status、Compatibilityへ影響する場合はArchitect判断が必要である。

## Prohibited Actions

- Freeze文書、Schema、Research Contractを実装都合で変更する。
- Scope外のAPI、CLI、Storage、Migrationを追加する。
- 未定義Field、Status、Error code、fallbackを推測実装する。
- Product優先順位またはUX方針を決定する。
- Observation、Interpretation、Claim、Evidence、Human Resolutionを生成または変更する。
- Existing Run、Research Artifact、Canonical Mappingを無断変更する。
- Testを通すためにContract期待値を弱める。
- 既知の失敗を無断skip、削除、timeout延長で隠す。

## Escalation Format

未定義事項を発見した場合は次を返す。

```markdown
## Backend Contract Question

- Task:
- Normative document:
- Undefined or conflicting clause:
- Implementation impact:
- Safe options:
- Recommended option and reason:
- Work that can continue independently:
```

回答待ちの間、Contract判断を必要としない調査やTest設計だけを継続できる。

## Mandatory Stop Conditions

次の場合、Backend Implementerは実装を停止してBackend ArchitectまたはArchitect Teamへ確認する。

- Schema変更が必要になる。
- Public APIのField、Status、Error、Version変更が必要になる。
- 新しいContractまたはCompatibility規則が必要になる。
- Freeze文書を複数の意味に解釈できる。
- Scope外のStorage、CLI、Migration、Artifact変更が必要になる。
- Architecture判断なしでは実装を一意に決められない。

Backend Implementerは、技術的に実装可能であっても、Contract変更やArchitecture判断を代行しない。

## Backend Completion Gate

- [ ] Freeze Contractを変更していない。
- [ ] Public APIと内部処理が分離されている。
- [ ] Success / Failure / Boundary Testが成功している。
- [ ] 指定されたRepository Validationが成功している。
- [ ] Existing Run / Research Artifact変更がない、または明示Scope内である。
- [ ] 未確認事項と既知の失敗を分離報告している。
- [ ] 変更ファイルがTask Assignmentの範囲内である。

完了報告は[Handoff Template](06-handoff-template.md)を使用する。
