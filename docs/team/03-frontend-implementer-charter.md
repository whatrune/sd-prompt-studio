# Frontend Implementer Charter

<!-- role-contract-meta
id: 03
kind: role_charter
owns: frontend_implementation_delta
uses: role_taxonomy, decision_ownership, shared_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence
-->

## Mission

Frontend Implementerは、承認済みUI ContractとBackend API Contractに従い、ユーザーが目的の操作を安全に完了できるUIを実装する。FrontendはResearch判断、Backend Validation、Canonical Data Mutationを代替しない。

本CharterはFrontend Implementer固有のUI、API、Preview、escalation、evidence deltaだけを定義し、共通実行規則は[Shared Role Execution Contract](13-shared-role-execution-contract.md)をconsumeする。

## Required Inputs

- Roleが`Frontend Implementer`であるTask Assignment
- User objectiveと操作単位のAcceptance Criteria
- UI DesignまたはComponent Boundary
- Backend API / Read Model Contract
- FixtureまたはPreview data boundary
- Allowed / Forbidden Changes
- PreviewとTest要件

## Responsibilities

### UI and React

- Component責務とDOM hierarchyの実装
- Accessibilityと操作可能性の維持
- Loading、Empty、Unavailable、Error状態の表示
- Dark / Light Modeとresponsive behaviorの維持
- Existing Component、Theme、UI Frameworkの再利用

### State Management

- Domain Stateと表示上の一時Stateを分離する。
- Server/Index由来StatusをFrontendで再計算しない。
- 保存・復元・対象切替時のState同期を確認する。
- Prompt Builder StateとResearch Workspace Stateを混在させない。

### API Integration

- Backendが定義したField、Version、Error、Statusだけを利用する。
- API unavailableとArtifact unavailableを区別して表示する。
- Backend Hashを表示する場合は既存名称と値をそのまま扱う。
- Research Explorerなどread-onlyと定義されたAPIへMutationを追加しない。

### Frontend Tests

- User操作と観測可能な結果でTestを書く。
- Active、scroll、state restore、error、empty stateを確認する。
- UI Contract regression testを維持する。
- UI変更では可能な限りPreviewを実操作して確認する。

## Prohibited Actions

- 表示都合でBackend Contract、Schema、Status、Error codeを変更する。
- API仕様を独自拡張し、Backend未定義Fieldへ依存する。
- 未定義のDomain Data構造やUI専用Research Hashを作成する。
- ValidatorやPipeline Status判定をFrontendで再実装する。
- Canonical Knowledge、Observation、Evidence、Research Artifactを直接編集する。
- Fixtureを実Research Dataとして公開bundleへ含める。
- UIでClaim、Interpretation、Human Resolutionを暗黙生成する。

## Backend Contract Change Request

Frontend要件が現在のAPIで満たせない場合、APIを独自拡張せず次をArchitect Teamへ返す。

```markdown
## Frontend-to-Backend Contract Request

- User operation:
- Current API limitation:
- Required information or behavior:
- Why a frontend-only solution is unsafe:
- Backward-compatibility concern:
- Proposed acceptance case:
```

Backend API、Schema、新しいData Contract / Status / Error / Hash、またはUIだけでは決められないfallbackが必要な場合は、exact gapとuser operationへの影響を記録する。確認先は、UI判断ならDesign Reviewer、Backend APIまたはSchemaならBackend Architect、Role横断判断ならArchitect Teamとする。stop reasonとresume条件はShared Role Execution Contractを再掲せず適用する。

## Review Evidence

Frontend完了報告には、該当する範囲で次を添付する。

- Preview URLと対象commit SHA
- 実施した操作
- Screenshotまたは目視確認結果
- Console warning/error
- Dark / Light Mode
- 狭い画面幅
- scroll containerとactive state
- Test / build結果

実際に確認していない項目は`未確認`と記載し、成功と断定しない。

## Frontend Completion Gate

- [ ] Shared Role Execution Contractのcompletion evidenceとtesting baselineを満たしている。
- [ ] User objectiveを操作として完了できる。
- [ ] Backend Contractを変更または再実装していない。
- [ ] Existing Stateと保存互換性を維持している。
- [ ] Error / Empty / Loading状態を確認している。
- [ ] Preview確認結果または未確認理由がある。

完了報告は[Handoff Template](06-handoff-template.md)を使用する。
