# Shared Role Execution Contract

<!-- role-contract-meta
id: 13
kind: contract
owns: shared_admission, canonical_record_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, finding_closure_authority, context_resistance_matrix
uses: assignment_shape, result_handoff_shape, handoff_status
-->

## Purpose and Ownership

このContractは、RepositoryでTaskを実行するすべてのRoleに共通するadmission、fresh fetch、authority、protected action、terminal stop、same-task correction、testing、completion evidenceの唯一のnormative ownerである。

Task AssignmentとResult Handoffのrecord shapeおよびstatus vocabularyは[Delegation and Result Contract](11-delegation-and-result-contract.md)が所有する。このlinkは`13 -> 11`のnormative dependencyである。Role Charter、routing contract、template、automation documentは本Contractのnormative inputではない。

このContractはRole taxonomy、RoleV1、Schema、Dispatcher、automation mapping、Result Handoff status、Context Health outcome、Research Review vocabularyを追加または再定義しない。

## Admission and Fresh Fetch

Roleは、session開始、resume、review開始、Review Decision記録、completion handoffの直前に、該当する範囲で次をfresh fetchして照合する。

- exact `task_id`、assigned Role、direct `canonical_record` URL
- mutableなIssue body / top-level commentsと、権限あるTask Assignment、Freeze Contract、Cumulative Amendment、Resume Dispatch、Review Decision
- PRのfull HEAD、state、checks、reviews、files
- repository、branch、worktree、full HEAD、base、dirty state
- allowed / forbidden changes、required validation、completion conditions
- open Review Amendmentとfindingごとのclosure flag

Chat、記憶、summary、stale PR body、過去の成功宣言、過去のlocal stateとfresh canonical stateが衝突する場合、fresh canonical stateを優先する。stale self-report、CI green、HEAD更新だけをauthority、closure、completion evidenceとして扱わない。

既知のdirect canonical URLをpermission、network、service、tool/runtime failureにより取得できない場合は`external_blocker`で停止する。source contentからstatus、authority、closureを推測してはならない。

## Record Validity and Same-Task Ordering

Repository全体のprecedenceはTeam Operating Modelが所有する。同一Task内のrecordは単純な「最新コメント優先」で解釈しない。累積Sourceとして採用する前に、該当する次をすべて検証する。

- exact `task_id`
- `record_type`
- `authoring_role`
- `authority_source`
- record全文をfresh fetchできるdirect GitHub `canonical_record` URL
- `prior_record_url`
- `cumulative_scope`または`supersede_scope`
- Reviewの場合はfull 40-character `reviewed_head`
- findingごとのclosure flag
- protected actionを新たに付与していないこと

```text
Task Assignment
  -> Architecture Amendment
  -> Integrated Lead Resume Dispatch
  -> Review Decision / Review Amendment
  -> Additional Architecture Amendment, when required
  -> Integrated Lead Resume Dispatch
  -> Final Review Decision
  -> Product Owner merge decision
```

Architecture AmendmentはArchitecture questionだけを閉じ、implementation findingを暗黙にcloseせず、実装をresumeしない。Review Amendmentは同じreview authorityを持つRoleがnew full HEADのevidenceでfindingごとに明示closeするまでopenである。

## Canonical and Supporting Records

migration後のlive Taskでは、Task Assignment、Architecture Amendment、Resume Dispatch、Review Decision / Amendment、Result Handoffの`canonical_record`を、record全文へ直接到達しfresh fetchできるGitHub Issue / PR bodyまたはtop-level comment URLにする。

- repository-relative Markdown path、local path、branch名、commit SHAだけを`canonical_record`にしない。
- repository-relative Markdownは、pathとfull 40-character commit SHAを組にしたimmutableな`supporting_record`としてだけ使用できる。
- `supporting_record`はmutable authority chainを代替しない。
- Inline review thread、CI log、chat、local file、Preview commentだけをcanonical recordにしない。
- PR review UIはTask Issue上のReview Decisionを置き換えない。

PR #167より前のlegacy Taskは当時のpinned canonical sourceとProduct Owner acceptanceを維持する。migration後のfieldを暗黙retrofitしてinvalid化しない。

## Cross-Role Authority

- **Gap discovery:** すべてのRoleがexact gapを検出し、canonical handoffへ記録できる。
- **Gap Freeze:** Architect TeamだけがCumulative Architecture Amendmentで未定義または矛盾するmeaningを確定できる。
- **Gap routing / resume:** Integrated Leadがgap stopを検証してArchitect TeamへRoutingし、closure後にsame-task Resume Dispatchを記録する。
- **Implementation:** ImplementerとWorkerは未定義Contractを選ばず、Role外変更が技術的に可能でも実施しない。
- **Review finding:** assigned reviewing RoleだけがReview Decision / Amendmentを記録する。
- **Finding closure:** 同じreview authorityを持つRoleだけがnew full HEADのevidenceでfindingを明示closeできる。

Role Charterは上記authorityを緩和または再定義せず、Role固有のinput、action、evidence deltaだけを所有する。

## Protected Actions and Role Boundary

Task Assignmentに明示的なauthorityがない限り、すべてのRoleで次を禁止する。

- Merge、Approve、Ready-for-review、Revert、Issue closure
- Product scopeまたはpriorityの決定
- Role追加、Role変更、暗黙reassignment
- Contract、Schema、API meaningの変更
- Existing Run、Research Artifact、Canonical Mappingの変更
- 別Task、branch、worktree、PRへの置換
- secret、credential、personal pathのcanonical record化

Role固有authorityがあってもTask scope外のprotected actionは許可されない。fresh fetchは成功したが、必要なfield / projection / behaviorが未定義、複数解釈、またはContract間で矛盾する場合は`architecture_gap`で停止する。

## Closed Terminal Stop Reason

Role executionがIntegrated Leadへ制御を返す`execution_stop_reason`は次の3値だけとする。

```text
completed
architecture_gap
external_blocker
```

| execution_stop_reason | Meaning | Compatible Result Handoff status |
| --- | --- | --- |
| `completed` | Task自身のcompletion conditions、required validation、canonical handoffを満たした。review対象やdownstream成果物のmerge readinessは意味しない | `completed`、`completed_with_warnings`、`needs_followup`、`not_applicable` |
| `architecture_gap` | fresh fetch済みSourceのmeaningが不足または矛盾し、Role authority内で一意に決められない | `blocked` |
| `external_blocker` | required authority recordの不在、permission、network、service、tool/runtime、repository stateなど外部条件により安全に完了できない | `blocked`、または実行失敗が確定した場合`failed` |

`execution_stop_reason`はResult Handoff `status`とは別fieldである。`needs_followup`や`failed`をterminal reasonの代用にしてはならず、Result Handoffには両fieldを記録する。

Reviewや調査Taskが自身のcompletion conditionsを満たし、blocking findingまたは次対象への修正要求をcanonical record化した場合、そのTaskは`execution_stop_reason: completed`と`status: needs_followup`を返せる。`needs_followup`をTask自身の未実施作業や未実施validationの隠蔽に使用してはならない。

対象条件が成立しないことを検証してcanonical handoffを完了したTaskは、`execution_stop_reason: completed`と`status: not_applicable`を返せる。

## Progress-Only Reporting Prohibition

status update、acknowledgement、scope summaryは継続中checkpointとして許可するが、terminal Result Handoffの代わりにはならない。「調査した」「次にtestする」「CIがgreen」「fileを追加した」だけではterminal resultにできない。

Roleは、completion、exact architecture gap、evidence-backed external blockerのいずれかまで継続する。

## Same-Task Correction Rule

Review correctionとArchitecture gap closureは、原則として同じ`task_id`、branch、worktree、PRを維持する。

- Implementerはgapを推測実装せず、exact gapとboundaryをTask Issueへ記録する。
- Architect Teamはgap範囲だけをCumulative Architecture AmendmentでFreezeする。
- Integrated LeadだけがResume Dispatchを記録する。
- Implementerはvalidなsame-task Resume Dispatch前に再開しない。
- Review Amendment修正で新しいTask、branch、worktree、PRを作らない。
- purpose、primary Role、contract domain、allowed file boundaryが変わる場合だけ別Taskを設計し、Product Owner判断を得る。

## Completion Evidence

すべてのRoleはResult Handoffへ次を記録する。

- final `task_id`、`record_type`、`authoring_role`、`authority_source`、direct canonical URLs
- prior record URL、cumulative / supersede scope、該当するclosure flags
- Role、branch、worktree、base、full HEAD
- created / updated filesとscope外変更がないこと
- exact command、exit result、実行full HEAD
- focused coverageとfull regression coverage
- GitHub checksのname、conclusion、checked full HEAD
- unresolved / unverified items
- protected actionsを実施していないこと
- Contract、Schema、Existing Run、Research Artifactへの影響
- next actionとowner

CI greenは必要条件になり得るが十分条件ではない。stale HEAD、smoke test、symbol existence、helper-only test、PR bodyの自己申告はcompletion evidenceにならない。

## PR Gate Status Completion Contract

This Contract is the normative owner of current PR Gate Status. A PR Body is a
canonical Result-Handoff surface for its current Gate Status, but it does not
replace the Issue-level canonical decision or completion record.

### Required current-state fields

The PR Body Gate Status section MUST state all of the following:

- the current full 40-character PR HEAD;
- Final Regression status and direct canonical evidence URL;
- Operational Validation status and direct canonical evidence URL;
- PR state and Draft/Ready state;
- Ready, Approve, and Merge status separately;
- current blocking reason, if any, and the next gate / owner.

Each gate value MUST be explicit as one of `completed`, `historical_at_prior_head`,
`pending`, `blocked`, or `unperformed`. These values describe a PR Body field;
they do not add to or alter the Result Handoff status vocabulary owned by
[Delegation and Result Contract](11-delegation-and-result-contract.md).

The Role authorized by the Task Assignment to update the PR Body owns the
metadata mutation. The Role that performs a gate owns that gate's canonical
completion record. The PR Body MUST cite the record; it MUST NOT infer a gate
result from CI green, a chat summary, or a stale prior statement.

### Completion conditions and invalidation

| Event | Required completion evidence | Required PR Body action before downstream reliance |
| --- | --- | --- |
| Final Regression | case-level `PASS` or `BLOCKED` result, all bound to one exact HEAD | record that exact HEAD, result, and canonical evidence URL |
| Operational Validation | direct canonical PASS or BLOCKED result bound to one exact HEAD | record that exact HEAD, result, and canonical evidence URL before a Ready recommendation is actionable |
| Draft-to-Ready or Ready-to-Draft transition | exact HEAD before and after, PR state before and after, and a record that identifies the sole transition action | immediately update PR state, Draft/Ready status, transition evidence URL, and remaining protected-action status |
| HEAD change | new exact full HEAD and canonical change record | mark prior gate evidence `historical_at_prior_head` or invalidate it; update Gate Status before any subsequent review or gate decision relies on it |

A downstream gate decision MUST stop as `needs_followup` when the current PR
Body omits a required field, conflicts with the corresponding completion
record, or presents prior-HEAD evidence as current. A metadata-only correction
does not change the authority of the evidence it cites, but it requires the
dependent gate to revalidate the corrected current PR Body at the unchanged
HEAD.

Ready, Approve, and Merge are protected actions. A Gate Status entry may record
only a completed protected action backed by its canonical completion record;
it does not itself authorize that action.

### Protected-action behavior after a HEAD change

The following matrix is the closed rule for the three protected-action rows.
It uses the same field labels and values required by the PR template and the
Review Execution Contract.

| Protected action | Allowed Gate Status values | Required canonical evidence | Required transition after `historical_at_prior_head` |
| --- | --- | --- | --- |
| Ready for Review | `completed \| historical_at_prior_head \| pending \| blocked \| unperformed` | direct completion record with exact HEAD before/after, PR state before/after, and sole-action evidence | If the PR is currently Ready, a Draft-return completion record is required before re-review; then fresh required gates, review, and a new Ready completion are required. |
| Approve | `completed \| historical_at_prior_head \| pending \| blocked \| unperformed` | direct approval record with the approved exact HEAD and reviewing authority | A prior approval cannot authorize the new HEAD. Fresh review and a new approval after Ready are required. |
| Merge | `completed \| historical_at_prior_head \| pending \| blocked \| unperformed` | direct merge or PR-closure record with the exact merged HEAD | No automatic continuation. A claimed completed merge with a later open-PR HEAD is a canonical conflict: stop as `blocked` and escalate to Product Owner / Architect Team. |

On a HEAD change, any completed protected-action evidence for the prior HEAD is
recorded as `historical_at_prior_head`; it is preserved as evidence but is not
current authorization. `pending`, `blocked`, and `unperformed` remain their
stated value only when their evidence is still applicable to the new HEAD.

Draft return is required only when a PR is Ready at the time its HEAD changes.
Its direct canonical completion record MUST identify the prior and current
HEAD, Ready-to-Draft state transition, and the sole transition action. A
historical Ready record alone does not permit re-review or a later Ready action.
The later Ready completion requires fresh applicable Final Regression and
Operational Validation evidence, the required review decision, and its own
exact-HEAD completion record.

## Testing Baseline

Taskの適用範囲に応じ、testを`positive`、`negative`、`boundary`、`malformed`へ分類する。

Closed contract、validator、builder、evaluator、integration taskでは、該当する次の観点も必須とする。

- every closed boundaryでのunknown field rejection
- duplicate memberとmissing memberのrejection
- set ordering invarianceとlist ordering significance
- cross-referenceとstored / calculated identityの検証
- conditional-fieldのpositive / negative matrix
- caller mutation isolationとdefensive clone
- deep immutabilityとrecursive freeze
- production public entry pointを経由したrequired result / failure branch
- Architecture test matrixの各rowとrejection classのexecuted coverage

非該当はnormative basisを添えて`not_applicable`とする。未実行を`not_applicable`に読み替えてはならない。Architecture test matrixに未消化rowがある成果物をcompletedまたはAPPROVE相当と判定しない。Review Task自身が全rowを照合し、未消化rowをblocking findingとしてcanonical record化した場合は、`completed + needs_followup`でReviewを完遂できる。

## Context-Resistance Regression Matrix

このmatrixはauthority、stop、Result Handoff、allowed / forbidden action、canonical record、resume conditionのnormative regression baselineである。

| ID | Scenario | Applicable Role | Expected authority decision | execution_stop_reason | Result Handoff status | Allowed action | Forbidden action | Required canonical record | Resume condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CR-01` | Freeze Contractに必要なprojectionが未定義 | Implementer / Worker / Reviewer / Integrated Lead / Architect Team | 実行Roleは選択しない。Architect TeamだけがgapをFreeze | `architecture_gap` | `blocked` | exact gap記録、IL routing、Architecture Amendment | projection推測、field追加/削除 | gap Handoff、IL routing record、Cumulative Architecture Amendment | IL same-task Resume Dispatch |
| `CR-02` | builder outputとclosed validatorが矛盾 | Backend Implementer / Backend Architect / Reviewer / IL | public contractを実装都合で緩和しない | `architecture_gap` | `blocked` | production-entry evidence、exact mismatch記録 | cast / any回避、validator弱体化 | Architecture Gap Handoff | exact projection Freeze + IL Resume |
| `CR-03` | CI greenだがArchitecture matrix未消化 | Reviewer / Implementer / IL | target completion / APPROVE相当不可。Review Taskはfinding記録で完遂可 | `completed` | `needs_followup` | CHANGES_REQUIREDと未消化row記録 | CIだけでclose / merge-ready | Review Amendment | 全rowをnew HEADで実行しReviewerがclose |
| `CR-04` | Review Amendment後にHEADだけ更新 | Implementer / Reviewer / IL | findingはopenのまま。Review Taskは再確認結果を記録 | `completed` | `needs_followup` | new HEAD review | pushだけで暗黙close | new Review Decisionとclosure flags | Reviewerのfinding別明示closure |
| `CR-05` | Architecture Amendment済みだがResume Dispatch未記録 | Implementer / Architect Team / IL | Implementerにresume authorityなし | `external_blocker` | `blocked` | missing Resume recordを報告 | Amendmentだけでresume | IL Resume Dispatch | valid same-task Resume Dispatch |
| `CR-06` | stale PR bodyとfresh Issue commentが衝突 | All Roles | validなfresh cumulative Issue recordを優先 | `continue` | `not_terminal` | stale項目をunverifiedとして記録 | stale PR自己申告を優先 | final Handoffにconflict / evidence記録 | canonical chain確定後に継続 |
| `CR-07` | Role外Contract変更が実装上は可能 | Implementer / Worker / Reviewer | authorityなし | `architecture_gap` | `blocked` | exact必要変更をArchitect Teamへ返す | Schema / Contract / API meaning変更 | gap Handoff | Architect Freeze + IL Resume |
| `CR-08` | progress reportだけで停止しようとする | All Roles | terminal resultとして不受理 | `continue` | `in_progress` | terminal conditionまで継続 | acknowledgementをResult Handoff化 | terminal Handoffのみ | terminal condition成立 |
| `CR-09` | session記憶とRepository canonical stateが衝突 | All Roles | Repository canonical stateを優先 | `continue` | `not_terminal` | 記憶をdiscardして再評価 | chat summaryでauthority補完 | Handoffにfresh source列挙 | fresh fetch済みstateで継続 |
| `CR-10` | canonical URLが既知だが取得不能 | All Roles | authority検証不能 | `external_blocker` | `blocked` | evidence付き停止 | source内容 / status推測 | blocker Handoff | canonical source取得可能 |
| `CR-11` | Review完遂でblocking findingあり | Reviewer / IL | Review executionは完了、対象成果物はfollow-up | `completed` | `needs_followup` | CHANGES_REQUIRED Decision | `architecture_gap`誤分類、merge-ready | Review Decision | correction後new HEADをReviewerが再確認 |
| `CR-12` | repository-relative Markdownだけをcanonical_recordに指定 | Assignee / IL | migration後Taskのcanonical admission不成立 | `external_blocker` | `blocked` | direct GitHub URL要求、pathをsupporting record化 | pathだけでmutable authority確定 | direct Task Issue / PR URL | direct URL canonicalization |

`continue`と`not_terminal`はterminal Result Handoff値ではなく、Taskを停止せず継続するmatrix表記である。

### Issue #163 Walkthrough

Issue #163のAmendment 007でCheckpoint exact projectionの矛盾をfresh fetchした場合、`CR-01` / `CR-02`によりBackend Implementerは`architecture_gap + blocked`で停止する。Cumulative Architecture Amendment 002がArchitecture meaningをFreezeしても、Review findingは自動closeせず、Integrated Lead Resume Dispatchがない間は`CR-05`により`external_blocker + blocked`で再開しない。validなsame-task Resume Dispatch後だけ実装を再開できる。

## Compatibility

- PR #167より前のTask AssignmentとResult Handoffをinvalid化しない。
- migration前Taskは当時のpinned canonical sourcesを維持する。
- migration後の新Taskは、このContractのfull commit SHAとdirect canonical URLをBindingする。
- 進行中Taskへの適用は、Integrated Leadがsame-task top-level Amendmentで明示する。暗黙retrofitを禁止する。
- Result Handoff status、Context Health outcome、Dispatch state、Research Review vocabularyを変更しない。

## Normative Reference Graph

normative dependencyは必ず`consumer -> owner`とする。graphのsource of truthは各対象文書先頭の`role-contract-meta`にある`owns` / `uses`宣言であり、手書きedge listではない。validatorは実文書からowner mapとedgeを導出する。ownership declaration、navigation backlink、non-normative exampleはdependency edgeとして数えない。literal Markdown link graphとnormative dependency graphは別に検査する。

- 13はRole Charter、routing、template、automationをconsumeしない。
- 11はexecution semanticsを定義しない。13へのbacklinkがある場合はnavigationである。
- 14は13と11をconsumeし、正式Roleやstatusを追加しない。
- templatesとexamplesはnormative ownerにならない。
