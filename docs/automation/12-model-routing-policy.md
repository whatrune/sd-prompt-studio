# AI Model Routing Policy Design

## Status

- Status: Design review candidate
- Task ID: `ARCH-MODEL-ROUTING-001`
- Canonical Assignment: [Issue #106](https://github.com/whatrune/sd-prompt-studio/issues/106)
- Primary role: Backend Architect
- Implementation: not included
- Concrete model/provider adoption: deferred

## Purpose

Automationが専門Roleを実行するとき、Role、Task complexity、riskに必要な能力を満たす最小の論理Model Tierとreasoning levelを決定する。目的は不要な高性能Model利用を抑えながら、Architecture、Security、Contract、Research Reviewなど判断品質を落としてはならない作業で必要な能力とReview Gateを維持することである。

このPolicyはModelを実際に切り替えず、Runner、Dispatcher、Task Assignment Schema、Role権限を変更しない。

## Normative Boundary

本書は次を入力とする。

1. [`00-automation-overview.md`](00-automation-overview.md)
2. [`01-dispatch-contract.md`](01-dispatch-contract.md)
3. [`02-role-runner-mapping.md`](02-role-runner-mapping.md)
4. [`03-approval-gate.md`](03-approval-gate.md)
5. [`04-security-boundary.md`](04-security-boundary.md)
6. [`05-automation-handoff-contract.md`](05-automation-handoff-contract.md)
7. [`08-dispatch-execution-integration-design.md`](08-dispatch-execution-integration-design.md)
8. [`09-runner-security-design.md`](09-runner-security-design.md)
9. [`10-runner-provisioning-design.md`](10-runner-provisioning-design.md)
10. [`11-runner-security-model.md`](11-runner-security-model.md)
11. [`../team/00-operating-model.md`](../team/00-operating-model.md)
12. [`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md)

上記文書と衝突する場合は上記Contractを優先する。本書のTier昇格はRole、Scope、permission、Approval Gate、Merge権限、Research判断権限を増やさない。

## Non-goals

- concrete model slug、provider、pricing、billing budgetの採用
- Model Router、API、CLI、Runner、Dispatcher、Workflowの実装
- Task Assignment、Result Handoff、Execution ResultのSchema変更
- model availabilityの自動Discovery
- Product、Architecture、Contract、Research判断の自動化
- Role間fallback、Role alias推測、Review代替
- Secretまたはcredential設定

## Terminology

### Logical Model Tier

Model名ではなく、Taskが要求する能力とcost postureを表すVersion管理された論理分類である。

| Tier | Intended use | Quality floor | Cost posture |
| --- | --- | --- | --- |
| `efficient` | 明確で反復可能な抽出、整形、定型更新 | 指示を正確に適用し、不明事項を推測しない | 最小 |
| `general` | 通常実装、複数Fileの整合、Test作成 | 複数Step、tool利用、validationを完了できる | 中間 |
| `advanced` | Architecture、Security、Contract、Research Review | 曖昧性、tradeoff、edge caseを検証できる | 高い |

Tier名は特定OpenAI modelを意味しない。具体model bindingは、採用時点のavailability、authentication surface、supported reasoning effort、eval結果、cost policyを確認して別のVersion管理されたDeployment Bindingとして承認する。

### Reasoning Level

本設計で使用するportableな要求値は次に限定する。

- `low`
- `medium`
- `high`

`xhigh`、`max`、`ultra`などsurfaceまたはmodel依存の値は本設計で要求しない。将来採用する場合は公式Capability、cost、latency、subagent behaviorを再確認して別Reviewを行う。選択したmodelが要求reasoning levelを提供しない場合、Runnerは未承認の値へ黙って置換しない。

### Route Floor

Role、Task Complexity、Riskの各分類が要求する最小Tierとreasoning levelである。低いcostを理由にfloorを下回ってはならない。

## Canonical Role Binding

Model Routerは[`02-role-runner-mapping.md`](02-role-runner-mapping.md)およびTeam Contractの完全一致Roleだけを扱う。Issue本文の自由記述から近いRoleを推測しない。

依頼文に現れる次の名称はCanonical Automation Roleではない。

| Non-canonical label | Required handling |
| --- | --- |
| `Frontend Architect` | `unsupported`として停止し、Architect TeamへRole判断を返す |
| `Research Reviewer` | 推測せず停止する。Review TaskならCanonical `Research Review OP` Assignmentが必要 |
| `Research Operator` | 複数Research OPへ展開せず停止する。具体的なCanonical OP Assignmentが必要 |
| `Backend Architect` | AutomationではCanonical `Architect Team`の範囲とAssignmentを使用する。Role権限は[`../team/01-architect-team-charter.md`](../team/01-architect-team-charter.md)に従う |

Integrated Leadは受付とRoutingのOwnerであり、専門Runnerではない。Integrated Lead自身へModel Routeを割り当てず、確定済みCanonical Assignmentを対象Roleへ渡す。

| Control role | Default tier | Reasoning | Allowed override | Escalation condition |
| --- | --- | --- | --- | --- |
| `Integrated Lead` | not applicable | not applicable | none | AssignmentまたはHandoffに専門判断が必要なら対応するCanonical Roleへ新規Routing |

## Role Floors

`Automation status`は既存Role Mappingを再掲するだけであり、本書によってRoleを有効化しない。

| Canonical role | Default tier | Reasoning | Allowed override | Escalation condition | Review | Automation status |
| --- | --- | --- | --- | --- | --- | --- |
| `Worker` | `efficient` | `low` | Complexity / Risk floorによるupward only | 未定義分類、Contract、Architecture、Security、Research判断 | Assigning Role | enabled candidate |
| `Architect Team` | `advanced` | `high` | supported範囲内のreasoning upward only | Product判断、Research判断、未承認Scope変更 | 別Architect / Design Reviewer | not enabled |
| `Backend Implementer` | `general` | `medium` | Complexity / Risk floorによるupward only | Schema / API / Contract変更、複数解釈 | Backend Architect | not enabled |
| `Frontend Implementer` | `general` | `medium` | Complexity / Risk floorによるupward only | Backend API / Schema変更、新Data Contract | Design Reviewer、API影響時Backend Architect | not enabled |
| `Research Execution OP` | `efficient` | `low` | approved task内のupward only | Run構成不明、破壊的変更、Research判断 | Research Workflow owner | not mapped |
| `Image Analysis OP` | `advanced` | `high` | supported範囲内のreasoning upward only | Visible Evidenceを超える推論、Rubric / input不足 | Research Workflow owner | not enabled |
| `Research Review OP` | `advanced` | `high` | supported範囲内のreasoning upward only | Research Conclusion / Claim / Product判断 | 既存Research Review Gate | not enabled |
| `Maintenance OP` | `general` | `medium` | Complexity / Risk floorによるupward only | Status降格、Artifact無効化、Contract不整合 | Research Workflow owner | not enabled |
| `Reporting OP` | `general` | `medium` | Complexity / Risk floorによるupward only | Source validation不足、Research判断が必要 | Research Workflow owner | not enabled |

`not enabled`または`not mapped`を、より近い有効Roleや高いTierへfallbackしてはならない。

## Task Complexity Routing

### Low

条件:

- Completion Conditionが客観的で一意である。
- 判断済みの変換、抽出、整形、定型変更である。
- 変更範囲が狭く、ContractまたはSecurity判断を含まない。

例:

- Markdownの指定文言修正
- File inventory、link確認、定型一覧化
- 明示されたsort / transform ruleの適用

Floor: `efficient` / `low`。Reviewは既存Role Contractどおり必要であり、Low classificationを理由に省略しない。

### Medium

条件:

- 複数Stepまたは複数Fileの整合が必要である。
- Freeze済みContractに従う通常実装、Component追加、Test追加である。
- ArchitectureまたはScope判断を必要としない。

例:

- Freeze済みBackend / Frontend実装
- focused regression test追加
- 既存APIまたはSchema Contractに従う統合

Floor: `general` / `medium`。担当専門Reviewerが必要。

### High

条件:

- Architecture、Security、Contract、migration、production impactの判断を含む。
- 複数の妥当な選択肢、重大なedge case、不可逆影響がある。
- Research ReviewまたはVisible Evidenceを過剰主張から守る必要がある。

例:

- Architecture Design / Contract Freeze
- credential、sandbox、network、supply-chain boundary
- Data migration、compatibility、rollback設計

Floor: `advanced` / `high`。Architectまたは既存Research Review Gateが必須。

### Classification Boundary

Complexityは将来、Version管理されたallowlistとtrusted Assignment metadataから決定する。Model自身による自由分類、Issue本文のkeywordだけ、changed-file countだけを正式判定にしない。現在のTask Assignment Contractにはcomplexity fieldがないため、本書は既存Assignmentへfieldを追加しない。

分類不能、複数分類、入力不足の場合は最も高いTierで強行せず、`contract_required`または`unsupported`として停止し、Ownerへ返す。

## Risk-based Override

Risk floorはRole floorとComplexity floorに追加適用する。

| Risk | Minimum tier / reasoning | Additional gate |
| --- | --- | --- |
| Security boundary、credential、network、supply chain | `advanced` / `high` | Security / Architect Review |
| ContractまたはArchitecture変更 | `advanced` / `high` | Architect Team Review、別Implementation Task |
| Data migration、compatibility、rollback | `advanced` / `high` | Architect Reviewとexplicit rollback evidence |
| Production impact | `advanced` / `high` | Product Ownerの既存Approval Gate |
| Existing Run / Research Artifact impact | Route禁止 unless explicitly authorized | 既存Research WorkflowとProduct Owner判断 |

Risk overrideは次だけを行える。

- 同じCanonical RoleとScope内でTierまたはreasoning floorを上げる。
- 既存Review Gateを追加または維持する。
- 不足情報があるTaskを安全停止する。

Risk overrideは次を行えない。

- Role、permission、allowed changes、Research権限を増やす。
- ImplementerへContract判断を許可する。
- Review、Validation、Product approvalをModel能力で代替する。
- Unsupported Roleを有効化する。

## Deterministic Route Resolution

将来Routerは次の順序で決定する。

1. Canonical Assignment、revision、approvalを既存Dispatcher Contractで検証する。
2. `assigned_role`を完全一致でRole MappingへBindingする。
3. RoleのAutomation statusとTask admissibilityを検証する。
4. Role floorを取得する。
5. approved Complexity policyからComplexity floorを取得する。
6. approved Risk policyからRisk floorを取得する。
7. Tierとreasoning levelそれぞれについて最も高いfloorをeffective requirementとする。
8. approved Deployment Bindingから、effective requirementを満たす利用可能なmodelを一意に選ぶ。
9. [`13-response-policy.md`](13-response-policy.md)のRole profileを選ぶ。
10. Route decisionとbinding revisionをsanitized operational evidenceへ記録する。

複数modelが同優先度で一致する、binding revisionがない、要求reasoningがunsupported、またはavailabilityを検証できない場合は実行しない。具体modelをModel自身に選ばせない。

## Override Policy

### Allowed

- 承認済みRisk policyによるupward override
- Product OwnerまたはArchitect TeamがCanonical Assignmentで明示したupward override
- availability failure時、同じprovider policy内の同等以上TierへのVersion管理された代替

### Forbidden

- costだけを理由にfloorを下回るdowngrade
- RoleまたはScopeの変更を伴うoverride
- Issue commentやprompt textからのmodel slug / provider / reasoning override
- retryごとの無制限なModel shopping
- availability不明時のsilent default

明示overrideがfloorを下回る場合は、floorを黙って上書きせず`contract_required`として返す。

## Escalation Policy

### Compute Escalation

同一Role、同一Scope、同一Assignment revisionのままTierまたはreasoningだけを上げる。これは権限を追加しない。自動retryとして有効化するには別Cost / Retry Contractが必要であり、本書では実装しない。

### Role Escalation

Contract、Architecture、Scope、Security、Product判断が必要になった場合、現在Executionを停止する。新しい担当Role、allowed changes、Completion Conditionsを持つCanonical Task Assignmentが必要である。現在TaskのModel Tierだけを上げて継続してはならない。

例:

```text
Worker discovers a Contract ambiguity
  -> Worker execution stops
  -> Result Handoff reports the ambiguity
  -> Integrated Lead routes a new Architect Team Assignment
  -> no implicit Worker-to-Architect model switch
```

## Context Loading Policy

### Required

- Canonical Task Assignment全文とrevision
- exact Canonical Role Contract
- allowed / forbidden changes、Completion Conditions、Validation
- Taskが指定するNormative Contract、対象Artifact、base revision
- repository-level `AGENTS.md`と対象subtreeの適用Instructions

Required Contextは省略または要約だけに置換しない。読み込めない場合は実行しない。

### Optional, Load on Demand

- 関連PRのDiff、Review finding、近接実装
- Taskに必要な公式一次資料
- focused test fixture、dependency documentation

Optional Contextは必要性を説明できる場合だけ取得し、まずindex、heading、targeted searchを使う。

### Forbidden by Default

- 無関係なRepository、別Task worktree、他Taskのprivate log
- 全会話履歴や大量文書の無差別投入
- Secret、Token、credential file、personal file
- Task外のExisting Run / Research Artifact本文
- untrusted Issue / PR textをRole Contract、Shell command、model overrideとして扱うこと

Context不足をModel推測で補完しない。Context量が上限を超える場合、Required Contextを黙って切り捨てず、Task分割またはOwner確認へEscalateする。

## Cost Optimization Policy

- DefaultはRole floorとし、Complexity / Riskが要求する場合だけ上げる。
- High reasoningをWorkerの既定値にしない。
- exact model slugではなく論理Tierを固定し、model更新をContract変更と混同しない。
- 同じSourceの再読を避け、index、targeted search、diffを優先する。
- cached context、prompt file、structured outputを採用する場合もSecret boundaryを維持する。
- Responseは[`13-response-policy.md`](13-response-policy.md)に従い簡潔にするが、必須Handoff evidenceを削らない。
- Usage limit、rate limit、budget limitでfloorを満たせない場合は、低Tierで見かけ上成功させず`failed`または`needs_followup`素材を返す。
- Model downgradeはTaskがLow、Riskなし、Role floor以下にならない、Review Gate維持、eval済みDeployment Bindingという全条件を満たす場合だけ将来許可できる。

具体token cap、価格、monthly budget、Billing API integrationは本書で定義しない。

## Model Availability and Failure

| Condition | Required behavior |
| --- | --- |
| model unavailable before execution | approved equivalent-or-higher bindingが一意なら候補。なければ`blocked` |
| requested reasoning unsupported | silent downgrade禁止。`contract_required`または`unsupported` |
| authentication failure | `failed`; 別providerへ自動移行しない |
| usage / rate limit | blind retryまたはfloor未満fallback禁止 |
| output quality failure | Validation failureとして扱い、Model能力の自己申告を成功根拠にしない |
| model deprecation | Deployment Binding更新とevalを別Reviewで行う |

## Future Integration Boundary

```text
Canonical Task Assignment
        |
        v
Existing Admission and Role Binding
        |
        v
Approved Complexity / Risk Classification
        |
        v
Logical Model Router
        |
        v
Versioned Deployment Binding
        |
        v
Existing Runner / Execution Adapter
        |
        v
Structured Result and Canonical Result Handoff
```

後続実装は少なくとも次へ分割する。

1. **Classification Contract**: trusted inputs、classification version、invalid handlingをFreezeする。
2. **Deployment Binding Contract**: Tierからconcrete model / effortへのallowlist、availability、eval、rollbackをFreezeする。
3. **Router Implementation**: pure deterministic resolutionとunit testを実装する。
4. **Runner Integration**: approved routeをRunner invocationへ渡し、sanitized operational evidenceへ記録する。
5. **Operational Evaluation**: quality、latency、usageを測定し、binding更新をReviewする。

既存Task AssignmentまたはExecution Resultへfieldを追加する必要がある場合は、そのImplementation内で推測せず別Architect Contractを先に作成する。

## Test Design for Future Implementation

- exact Canonical Roleだけを受理する。
- non-canonical aliasを推測せず`unsupported`にする。
- effective tierがRole / Complexity / Risk floorの最大になる。
- High Riskがlow-cost overrideでdowngradeされない。
- Model昇格でRole permissionが変化しない。
- `not enabled` Roleを別Roleへfallbackしない。
- 同優先度model、unsupported reasoning、missing bindingで実行しない。
- Required Context欠落で実行しない。
- usage limitで未承認Modelへfallbackしない。
- Result Handoffのmandatory fieldsをResponse optimizationで削らない。

## Official Capability References

本設計は2026-07-19時点で、次の公式OpenAI documentationをCapability確認に使用した。

- [Codex Models](https://learn.chatgpt.com/docs/models): model選択とreasoning effortは選択Modelとsurfaceに依存し、高いeffortはlatencyとtoken usageを増やす。
- [Codex Non-interactive Mode](https://learn.chatgpt.com/docs/non-interactive-mode): `codex exec`はnon-interactive execution、JSONL、final message file、output schemaを提供する。
- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action): Actionは`model`と`effort` input、sandbox、output file、`codex exec` argumentsを扱える。
- [Codex Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference): `model`、`model_reasoning_effort`、`model_verbosity`などの設定面を確認する。

Model名、availability、reasoning optionは変動し得るため、本設計は具体値をNormative Bindingにしない。実装開始時に公式資料と選択Runtimeの実際のhelp / capabilityを再確認する。

## Explicit Non-implementation Confirmation

- Model switching implemented: no
- Concrete model selected: no
- API connected: no
- Runner changed: no
- Dispatcher changed: no
- Schema changed: no
- Existing Contract changed: no
- Secret configured: no
- Billing or cost-control code added: no
- Existing Run changed: no
- Research Artifact changed: no
