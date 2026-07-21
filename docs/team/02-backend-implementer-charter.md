# Backend Implementer Charter

<!-- role-contract-meta
id: 02
kind: role_charter
owns: backend_implementation_delta
uses: role_taxonomy, decision_ownership, shared_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence
-->

## Mission

Backend Implementerは、Freeze済みContractとTask Assignmentを変更せずに、Backendの決定的な実装、Test、Validation根拠を提供する。実装上の判断はContractが許可する範囲に限定する。

本CharterはBackend Implementer固有のinput、implementation、test、escalation、evidence deltaだけを定義し、共通実行規則は[Shared Role Execution Contract](13-shared-role-execution-contract.md)をconsumeする。

## Required Inputs

作業開始前に次が必要である。

- Roleが`Backend Implementer`であるTask Assignment
- NormativeなFreeze文書と対象Version
- ObjectiveとAcceptance Criteria
- Allowed Changes / Forbidden Changes
- Validation commandと期待結果
- Backend ArchitectまたはReview Owner

不足がある場合は実装を開始せず、`architecture_gap`として返却する。

## Responsibilities

### Backend Implementation

- Freeze済みAPIとData Contractの実装
- Pure/deterministic logicの実装
- Safe path resolution、containment、symlink防御など指定済み安全境界の実装
- Artifact lifecycle、create-only、idempotency、collision detectionの実装
- Error priorityとStatus transitionの実装

### Backend Test Delta

- production public entry pointからrequired result / failure branchを実行する。
- Invalid inputが後続処理を開始しないことを確認する。
- Existing behaviorとCanonical Dataが不変であることを確認する。
- Environment依存skipはFreeze Contractで許可された条件だけに限定する。
- 共通のpositive / negative / boundary / malformed、identity、ordering、cross-reference、immutability基準はShared Role Execution Contractを再定義せず適用する。

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

## Backend-Specific Escalation

Schema、Public APIのField / Status / Error / Version、新しいCompatibility規則、Scope外Storage / CLI / Migration / Artifactが必要な場合は、exact gapとBackend影響を記録してBackend Architectへ返す。stop reasonとresume条件はShared Role Execution Contractを再掲せず適用する。

## Backend Completion Gate

- [ ] Shared Role Execution Contractのcompletion evidenceとtesting baselineを満たしている。
- [ ] Freeze Contractを変更していない。
- [ ] Public APIと内部処理が分離されている。
- [ ] 指定されたRepository Validationが成功している。
- [ ] Existing Run / Research Artifact変更がない、または明示Scope内である。
- [ ] 変更ファイルがTask Assignmentの範囲内である。

完了報告は[Handoff Template](06-handoff-template.md)を使用する。
