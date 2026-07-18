# Automation Response Policy Design

## Status

- Status: Design review candidate
- Task ID: `ARCH-MODEL-ROUTING-001`
- Canonical Assignment: [Issue #106](https://github.com/whatrune/sd-prompt-studio/issues/106)
- Primary role: Backend Architect
- Structured output implementation: not included

## Purpose

Automationで実行される各Roleが、責務に適した粒度で結果を返しつつ、Integrated LeadがCompletion Condition、Diff、Validation、Role Boundaryを検証できるResponse Policyを定義する。

簡潔化は、既存Result HandoffのField、Status、Canonical Record、失敗証拠を削ることを意味しない。

## Normative Boundary

Responseは次を維持する。

1. [`../team/06-handoff-template.md`](../team/06-handoff-template.md)
2. [`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md)
3. [`05-automation-handoff-contract.md`](05-automation-handoff-contract.md)
4. [`08-dispatch-execution-integration-design.md`](08-dispatch-execution-integration-design.md)

本書は新しいResult Status、JSON Schema、Receipt、Database、Validation Recordを追加しない。Role別Response Profileは既存Result Handoffを置換するSchemaではなく、`completed_work`、`validation_results`、`unresolved_items`、`recommended_next_action`などをどう明確に記述するかのPresentation Policyである。

## Response Layers

### Layer 1: Runtime Output

Agent Runtimeが生成するrawまたはstructured output。Canonical Recordではない。Secret、個人Path、untrusted raw logを公開Handoffへ直接転記しない。

### Layer 2: Provisional Result

Execution Adapterが既存Contractへmappingする検証前の結果素材。実行成功だけでTask完了を宣言しない。

### Layer 3: Canonical Result Handoff

既存Contractの全必須Field、Automation Execution Field、Validation evidenceを持ち、許可されたCanonical Locationへ保存された正式な受領候補。Integrated Leadはこれだけを完了確認に使用する。

### Layer 4: Integrated Summary

Product Owner向けの短い統合報告。Canonical Handoffへの直接参照を持ち、`failed`、`blocked`、`needs_followup`、未実施Validationを隠さない。

## Common Mandatory Envelope

全RoleのCanonical Result Handoffは少なくとも次を保持する。

- `task_id`
- `canonical_record`
- `role`
- `status`
- `completed_work`
- `created_files`
- `updated_files`
- `validation_results`
- `contract_boundary_confirmation`
- `unresolved_items`
- `escalation_required`
- `recommended_next_action`

Automation executionでは[`05-automation-handoff-contract.md`](05-automation-handoff-contract.md)の`execution_id`、`runner_id`、時刻、execution status、retry、timeout、branch、worktree、commit、PR、execution recordも必要である。

Role別の短いSummaryが上記Fieldを省略しても、Canonical Handoffには全Fieldを残す。Response optimizationによってmandatory evidenceを失わない。

## Common Writing Rules

- Outcomeを先に書き、実施手順の逐語記録を避ける。
- 実施済み、未実施、失敗、未確認を分離する。
- Statusは既存Vocabularyだけを使う。
- Validationはcommand / checkごとに結果とevidenceを記録する。
- `completed`をModelの自己評価だけで決めない。
- Created / Updated fileを分離し、scope外変更があれば隠さない。
- BlockerにはOwnerと次の安全な行動を付ける。
- 推測したResearch、Product、Contract判断を書かない。
- raw chain-of-thoughtまたはprivate reasoningを要求・保存しない。Architectの`rationale`はReview可能な根拠の要約であり、内部推論記録ではない。
- Secret、Token、credential、absolute personal path、unsanitized logを出力しない。

## Integrated Lead Profile

Integrated Leadは専門Executionの出力を生成しない。ResponseはRoutingと受領結果に限定する。

Required summary:

- overall status
- routed tasks and Canonical Assignment links
- received Handoff links and per-task status
- completion evidence gaps
- required Architect / Product Owner decision
- recommended next routing action

禁止:

- 専門Roleの判断を補完すること
- 未実行Taskを完了扱いすること
- Warningまたは`not_applicable`でfailureを隠すこと
- Merge判断を代行すること

## Worker Profile

目的は判断済み規則による作業結果を短く検証可能に返すことである。

Summary order:

1. `status`
2. inspected sources / applied transformation rule
3. created / updated files and counts
4. validation
5. blockers / unresolved items
6. decisions not made
7. next action

Avoid:

- 長いArchitecture説明
- 未依頼の改善提案
- Canonical、Research、Product判断
- 不明値の補完

Worker Summary例:

```markdown
Status: completed

Files:
- created: docs/example.md
- updated: none

Validation:
- git diff --check: passed

Blocker: none
Decisions not made: Contract classification
Next action: Assigning Role reviews the inventory.
```

これはCanonical Handoff全体の代替ではない。

## Backend Implementer Profile

目的はFreeze Contractに対するBehavior、Diff、TestをReview可能に返すことである。

Summary order:

1. status and implemented behavior
2. created / updated files
3. focused tests and regression coverage
4. required validation and exact failures
5. Contract / Schema / Existing Data boundary
6. unresolved items and escalation
7. reviewer handoff

必須観点:

- `changed_files`
- `tests`
- `validation`
- `unresolved_items`
- `handoff`

禁止:

- Contractを実装都合で再定義すること
- test failureをwarningへ読み替えること
- 未実施checkをpassedと記載すること

## Frontend Implementer Profile

Backend Implementer Profileに加え、次を明示する。

- user-visible behavior and acceptance operation
- Preview URLと対象commit、または未確認理由
- Dark / Light、狭幅、scroll、consoleなどTask指定のUI evidence
- Backend API / Schemaを変更していない確認
- fixtureと実Data境界

DOM上の存在またはbuild成功だけで操作成功を断定しない。

## Architect Team Profile

目的は実装可能でReview可能な判断記録を返すことである。

Summary order:

1. `decision`
2. `rationale`
3. considered alternatives
4. risks and mitigations
5. tradeoffs
6. recommendation
7. deferred decisions and decision owner
8. implementation split, reviewer, merge gate
9. validation and non-implementation confirmation

Architect Responseに必須の意味:

- `decision`: 今回確定した設計境界。採用未決定事項をDecisionと書かない。
- `rationale`: Normative sourceと観測可能な制約に基づく要約。
- `alternatives`: 比較した案と不採用理由。
- `risks`: 残存risk、mitigation、Owner。
- `tradeoffs`: quality、latency、cost、security、maintenanceの交換条件。
- `recommendation`: Product Ownerまたは次担当が取る具体的な次Step。

禁止:

- 自分のDesign PRを自己Approveすること
- Product decision、Research conclusion、Merge decisionを代行すること
- 未確定のmodel/provider/technologyをFreeze済みと表現すること

## Research Operations Profiles

Research Roleはgeneric `Research Operator`または`Research Reviewer`としてまとめない。Canonical Roleごとに[`../team/10-research-operations-routing-contract.md`](../team/10-research-operations-routing-contract.md)へ従う。

### Research Execution OP

- target Domain / Run ID
- ingest / panel / manifest outputs
- start / end status
- existing Run overwrite absence
- validation and incomplete conditions

### Image Analysis OP

- target Run and panels
- Visible Evidence Observation outputs
- Schema / Rubric validation
- unclear handling
- Interpretation、Claim、Evidence、Conclusionを作成していない確認

### Research Review OP

- review target and revision
- Review Status、findings、severity
- verified evidence and unverified items
- correction owner and next review gate
- Observationを自動変更していない確認

### Maintenance OP

- validation、Ledger、Derived Index resultを分離
- status transition conditionと未成立条件
- rollbackしていない処理
- UI表示確認とdata validationを分離

### Reporting OP

- report / PDF path
- source Run and validation binding
- render / visual QA result
- Research judgmentを追加していない確認

## Status-specific Requirements

| Result status | Response requirement |
| --- | --- |
| `completed` | 全Completion Condition、必須Validation、Canonical保存の証拠 |
| `completed_with_warnings` | non-blocking warningと影響。Errorや未実施必須checkは禁止 |
| `needs_followup` | 完了範囲、未完了範囲、次Owner、再開点 |
| `blocked` | blocking condition、権限を拡大しなかった確認、必要判断Owner |
| `failed` | failed step、partial output、validation、cleanup / lock、retry condition |
| `not_applicable` | 対象条件が成立しない根拠。Applicable failureを隠さない |

## Error and Diagnostic Policy

- Runtime exit、execution status、Result Handoff statusを混同しない。
- malformed、truncated、schema-invalid、secret-contaminated outputを成功へ変換しない。
- Runnerが`succeeded`でもValidationまたはCanonical Handoff保存が失敗したら`completed`にしない。
- retryで既存PR、branch、Handoffを二重作成しない。
- error messageはsanitized summary、affected step、retryability、Ownerを持つ。
- raw stderrはrestricted operational evidence候補であり、公開Handoffへ無条件転記しない。

## Length and Detail Policy

Response lengthはRoleと結果に合わせる。

- Worker: concise by default
- Implementer: changed behaviorとvalidationを中心に必要十分
- Architect: decisionの再現に必要なalternatives、risk、tradeoffを保持
- failed / blocked: 成功時より詳細でも、Secretと無関係logを除外

固定word countやtoken countは設けない。長さ制限によってmandatory field、failure evidence、unresolved itemを切り捨ててはならない。大量logは要約し、sanitized referenceを付ける。

## Structured Output Boundary

OpenAI Codexのnon-interactive executionはJSONLとJSON Schemaによるfinal structured outputを提供できるが、本設計ではSchemaを作成しない。将来実装する場合は次を満たす別Contract Reviewが必要である。

- existing Result Handoff fieldとStatusを変更しない。
- schema version、backward compatibility、maximum sizeを定義する。
- schema-invalid outputを成功へfallbackしない。
- raw responseをCanonical Handoffとみなさない。
- Role profileはversion-managed prompt sourceへBindingする。
- exact Runtime / CLI versionでCapabilityを再確認する。

## Context-to-response Boundary

- ResponseにはTask実行に使用したNormative sourceを必要範囲で示す。
- Forbidden Context、Secret、他Task private dataを含めない。
- Contextが不足した場合は不明点を隠さず`blocked`または`needs_followup`へ反映する。
- 大量Contextを読んだ事実を品質の根拠にしない。
- External sourceを使用した場合、sourceと確認日を記録する。

## Future Integration Split

1. **Response Profile Contract**: Role別prompt source、profile version、compatibilityをFreezeする。
2. **Structured Output Contract**: JSON Schemaとexisting Handoff mappingをFreezeする。
3. **Runtime Parser**: final output validation、redaction、size limitを実装する。
4. **Handoff Publisher**: Canonical Locationへidempotentに保存する。
5. **Integrated Summary Renderer**: Handoff参照を保ったProduct Owner向けsummaryを生成する。

この分割前にRunner、Dispatcher、既存Result型を変更しない。

## Test Design for Future Implementation

- Role profileごとのrequired meaningが存在する。
- Worker summaryがContract判断を含まない。
- Implementer summaryがfailed validationを隠さない。
- Architect summaryがDecisionとDeferredを区別する。
- Research Role aliasを推測しない。
- all mandatory Handoff fieldsがCanonical outputに残る。
- invalid status、unknown field policy、malformed outputがfail closedになる。
- Secret fixture、absolute personal path、raw credentialがpublic outputに出ない。
- `succeeded` execution + failed publicationを`completed`にしない。
- retryが二重PRまたは二重Handoffを作らない。

## Official Capability References

- [Codex Non-interactive Mode](https://learn.chatgpt.com/docs/non-interactive-mode): stdout / stderr separation、JSONL、final message file、output schema。
- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action): final message、output file、model / effort、sandbox、structured output integration候補。

Capabilityは将来変更され得るため、実装時に公式Documentationとpin対象Runtimeで再確認する。

## Explicit Non-implementation Confirmation

- Response Schema added: no
- Parser implemented: no
- Handoff Publisher changed: no
- Runner changed: no
- Dispatcher changed: no
- Existing Result Handoff changed: no
- Existing Contract changed: no
- Existing Run changed: no
- Research Artifact changed: no
