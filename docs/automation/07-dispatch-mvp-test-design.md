# Dispatch MVP Test Design

## Purpose

Dispatch MVP ImplementationがPR #91と[`06-dispatch-mvp-implementation-design.md`](06-dispatch-mvp-implementation-design.md)へ準拠することを、実装前に検証可能なScenarioへ分解する。

本書はTest Designであり、Test、Fixture、Mock、Schema、Workflowを実装しない。

## Test Layers

| Layer | Subject | External dependency |
| --- | --- | --- |
| Unit | Assignment parsing、Admission、Role、state、lock、path policy | なし |
| Component | GitHub Adapter、Runner Adapter、Publisher、Handoff Builder | fake client / fake process |
| Integration | logical job間のartifact、credential、state boundary | isolated test repository |
| End-to-End | approved Worker docs-only TaskからDraft PR/Handoffまで | Product Owner承認済みpilot |

Unit / Component Testはlive Secret、live Runner、実Repository writeを使用しない。End-to-EndはProvisioning完了後の別Taskで実行する。

## Test Evidence Requirements

各Caseは最低限、次を記録する。

- Test ID
- Assignment revision and execution ID
- Input event / fixture
- Expected state transitions
- Invoked and not-invoked components
- Credential boundary assertion
- Git / filesystem effects
- Handoff result
- Error category and owner

「Runnerが呼ばれなかった」ことが期待結果の場合、mock invocation countまたは同等の負の証拠を必要とする。

## Admission Test Matrix

| ID | Input | Expected result | Must not happen |
| --- | --- | --- | --- |
| ADM-001 | valid approved Worker Assignment | Execution Plan、queued | publishやmergeをAdmission内で行わない |
| ADM-002 | Task Assignmentなし | blocked | Runner起動、Secret access |
| ADM-003 | `canonical_record`なし | blocked | local fileをCanonical扱い |
| ADM-004 | Approval Labelなし | blocked | Worker起動 |
| ADM-005 | Role Labelなし | blocked | Role推測 |
| ADM-006 | 複数Role Label | blocked | 最初のLabel採用 |
| ADM-007 | `assigned_role`とLabel不一致 | blocked | Worker fallback |
| ADM-008 | `assigned_role`がWorker以外 | blocked | unsupported Runner起動 |
| ADM-009 | Required Field不足 | blocked | Default値補完 |
| ADM-010 | Assignment revisionがApproval後変更 | stale | 古いApprovalで実行 |
| ADM-011 | repository allowlist不一致 | blocked | checkout、Secret access |
| ADM-012 | Issue closed / transferred | blocked | 別Repositoryで継続 |

## Actor and Trigger Security Tests

| ID | Input | Expected result |
| --- | --- | --- |
| SEC-001 | authorized Actorがapproval label付与 | Admission継続 |
| SEC-002 | unauthorized Actor | blocked、Runner未起動 |
| SEC-003 | fork由来event | pre-admissionで拒否、State遷移なし、Secret未提供 |
| SEC-004 | Pull Request eventをIssue Triggerとして偽装 | rejected |
| SEC-005 | role labelだけ | Approval不足でblocked |
| SEC-006 | Issue title / bodyにShell metacharacter | dataとして保持、Shell実行なし |
| SEC-007 | prompt injectionを含む自由記述 | Role、permission、validationへ影響なし |
| SEC-008 | `main`または予約branch指定 | blocked |
| SEC-009 | backslash / traversalを含むpath | blocked |
| SEC-010 | Workflow、Secret、AGENTS.md等がforbidden path | publish拒否 |

## Role Resolution Tests

| ID | Input | Expected result |
| --- | --- | --- |
| ROLE-001 | Worker + enabled Worker Profile | unique mapping |
| ROLE-002 | Architect / Backend / Frontend / Research | blocked as not enabled |
| ROLE-003 | mappingなし | blocked |
| ROLE-004 | ambiguous mapping | blocked |
| ROLE-005 | Worker AssignmentがWorker Charter外 | blocked、Architect escalation |

## Lock and Idempotency Tests

| ID | Input | Expected result |
| --- | --- | --- |
| LOCK-001 | Lockなし | owned lock、unique execution ID |
| LOCK-002 | same repository/task/branch running | 新規実行なし、既存cancelなし |
| LOCK-003 | same completed revision | existing Handoff reference、no-op |
| LOCK-004 | revised Assignment with valid reapproval | new execution ID |
| LOCK-005 | stale lock、owner process alive | blocked |
| LOCK-006 | timeout後process終了未確認 | lock維持、human escalation |
| LOCK-007 | parallel unrelated task | global concurrency範囲内で独立 |

## Workspace and Git Tests

| ID | Input | Expected result |
| --- | --- | --- |
| GIT-001 | clean base、new branch/worktree | create-only success |
| GIT-002 | branch既存 | blocked、overwriteなし |
| GIT-003 | worktree既存 | blocked、removeなし |
| GIT-004 | dirty worktree | blocked、stash/resetなし |
| GIT-005 | base revision不一致 | stale |
| GIT-006 | `main` target | blocked |
| GIT-007 | push permission denial | blocked、権限拡大とforce pushなし |
| GIT-008 | push remote-state conflict | stale、force pushなし |
| GIT-009 | push API / network failureがbounded retry後も継続 | failed、同一commit保持 |
| GIT-010 | Scope内Markdownだけ | Change Policy PASS |
| GIT-011 | Scope外file混入 | publish停止 |
| GIT-012 | symlinkでallowed path外を参照 | publish停止 |

## Worker Execution Tests

| ID | Input | Expected result |
| --- | --- | --- |
| RUN-001 | valid Worker Task、process exit success | structured result、patch |
| RUN-002 | process exit failure | execution failed、partial result |
| RUN-003 | timeout | timed_out、termination attempt、partial result |
| RUN-004 | cancel | cancelled、新規command停止 |
| RUN-005 | malformed structured output | failed、publishなし |
| RUN-006 | no changes | no fabricated commit、Assignment条件に従うHandoff |
| RUN-007 | WorkerがContract判断を要求 | blocked、Architect escalation |
| RUN-008 | WorkerがGitHub writeを試行 | credentialなしで拒否 |

## Credential Boundary Tests

| ID | Component | Expected credential |
| --- | --- | --- |
| AUTH-001 | Admission | repository / Issue read only |
| AUTH-002 | Worker Execution | Codex credential、GitHub writeなし |
| AUTH-003 | Change Policy / Validation | Secretなし |
| AUTH-004 | Publish | GitHub branch / PR write、Codex credentialなし |
| AUTH-005 | Handoff | Issue / PR write、Codex credentialなし |

追加Assertion:

- environment、stdout、stderr、Handoff、patchにSecret値がない。
- full environment dumpがない。
- Worker processからpublish tokenを参照できない。
- Publish processはrepository codeやValidation commandを実行しない。

## Validation Tests

| ID | Input | Expected result |
| --- | --- | --- |
| VAL-001 | known validation profile、all pass | publish eligible |
| VAL-002 | unknown profile | blocked |
| VAL-003 | Assignmentにraw command | rejected |
| VAL-004 | required command failure | failed、publishなし |
| VAL-005 | timeout | timed_out、Result Handoffはfailed、publishなし |
| VAL-006 | Test report欠落 | completed不可 |
| VAL-007 | Existing Warningだけ | profile Contractに従い分離報告 |
| VAL-008 | new Error | failed、Warningへ降格しない |

## Draft PR Publication Tests

| ID | Input | Expected result |
| --- | --- | --- |
| PUB-001 | verified patch、Gate 2 valid | normal push、Draft PR |
| PUB-002 | Gate 2なし | publishせずblocked |
| PUB-003 | Scope違反 | push / PRなし |
| PUB-004 | PR creation API一時失敗 | 同一commitでretry可能 |
| PUB-005 | retry後既存PRあり | 二重PRを作らず既存PRを返す |
| PUB-006 | write permission不足 | blocked、権限拡大なし |
| PUB-007 | auto-merge設定が存在 | 使用しない |

## Handoff Tests

| ID | Input | Expected result |
| --- | --- | --- |
| HND-001 | 全必須Field、PR URL、Validationあり | Canonical Handoff、completed候補 |
| HND-002 | `canonical_record`なし | completed不可 |
| HND-003 | validation resultなし | completed不可 |
| HND-004 | change-producing成功TaskでPR URLなし | completed不可 |
| HND-005 | execution statusとResult status矛盾 | Handoff拒否、Result statusはneeds_followup、dispatch completed禁止 |
| HND-006 | Handoff投稿がbounded retry後も失敗 | Result statusはfailed、dispatch completed禁止 |
| HND-007 | same execution ID再投稿 | idempotent update、duplicateなし |
| HND-008 | failed Worker | failure step、partial output、next ownerを保存 |
| HND-009 | timeout | execution_status timed_out、Result status failed |

## State Transition Tests

許可Transitionを明示的に列挙し、それ以外を拒否する。

- draft → approved
- approved → queued | blocked | stale | cancelled
- queued → running | blocked | cancelled
- running → completed | failed | blocked | cancelled | timed_out
- failed / blocked / timed_out → 明示reapprovalを伴うnew execution

Terminal resultがない状態からcompletedへ直接遷移しない。Handoff投稿成功前にcompletedを記録しない。

## Failure Recovery Tests

- Runner crash後にLock ownershipを確認できる。
- API failure後に既存branch、commit、PRを再利用できる。
- retryが新しいbranchまたはPRを重複作成しない。
- power lossまたはjob interruptionをcompleted扱いしない。
- partial patchを未検証のままpublishしない。
- Handoffだけ失敗した場合、Workerを再実行せずHandoff再投稿できる。
- cancel後にprocessが残る場合、cleanupせずEscalateする。

## End-to-End Acceptance Scenarios

### E2E-001: Approved Worker docs-only Task

1. Canonical Assignmentと正しいLabelを用意する。
2. Admission、Lock、Worker、Validation、Publish、Handoffを実行する。
3. 専用branch、Draft PR、Canonical Handoffを確認する。
4. `main`変更、force push、auto-mergeがないことを確認する。

### E2E-002: Unapproved Task

- Worker process、Codex credential、GitHub write credentialへ到達しない。
- blocked evidenceを確認する。

### E2E-003: Forbidden Change

- WorkerがScope外fileを変更するFixtureを返す。
- Validationとpublishを停止し、failed Handoffを確認する。

### E2E-004: Duplicate Trigger

- 同一revisionへLabel eventを重複送信する。
- Worker実行、branch、Draft PRが1件だけであることを確認する。

### E2E-005: Timeout and Handoff Retry

- Workerをtimeoutさせる。
- process termination、Lock、partial resultを確認する。
- Handoff APIだけを一時失敗させ、Worker再実行なしで再投稿する。

## Deferred Test Decisions

- Test frameworkとmodule layout
- GitHub API fake / sandbox repositoryの選択
- Codex Action / CLI fake adapter
- exact timeout and retry values
- structured output schema
- log redaction fixture policy
- Artifact retention test
- live End-to-End repository and cost owner

これらはTechnology Decision後にBackend Implementer Task Assignmentへ固定する。

## Completion Gate for the Future Implementation

- Unit / Component Testが全てPASSする。
- Security negative testでWorker、Secret、write permissionが起動されていない証拠がある。
- duplicate、timeout、Handoff retryがidempotentである。
- Scope外変更、Validation failure、missing Handoffをcompleted扱いしない。
- End-to-EndでDraft PRまで到達し、Mergeは行われない。
- PR #91 Contract、Worker Charter、Role Boundaryに変更がない。
