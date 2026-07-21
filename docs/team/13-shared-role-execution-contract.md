# Shared Role Execution Contract

## Purpose

このContractは、RepositoryでTaskを実行するすべてのRoleに共通するadmission、authority、停止、修正、testing、completion evidenceを定義する。Role固有の責務は各Role Charter、AssignmentとResult Handoffのrecord shapeおよびstatusは[Delegation and Result Contract](11-delegation-and-result-contract.md)が所有する。

このContractはRole taxonomy、RoleV1、Schema、Dispatcher、automation mapping、Result Handoff status、Context Health outcomeを追加または再定義しない。

## Admission and Fresh Fetch

Roleは、作業開始、resume、review、completion handoffの直前に、該当する範囲で次をfresh fetchして照合する。

- `task_id`、canonical URL、assigned Role
- mutableなIssue body/commentsと、権限あるTask Assignment、Freeze Contract、Cumulative Amendment、Resume Dispatch、Review Decision
- PRのHEAD、state、checks、reviews、files
- repository、branch、worktree、HEAD、base、dirty state
- allowed / forbidden changes、required validation、completion conditions
- open Review Amendmentと各findingのclosure state

Chat、記憶、staleなPR bodyまたは過去のlocal stateとfresh canonical stateが衝突する場合、fresh canonical stateを優先する。安全な実行に必要なmutable stateを取得できない場合は`external_blocker`で停止する。source contentだけからstatus、authority、closureを推測してはならない。

## Canonical Precedence and Same-Task Ordering

Repository全体のprecedenceはTeam Operating Modelが所有する。同一Task内では、単純な「最新コメント優先」ではなく、record type、task identity、authoring authority、cumulative scopeを検証する。

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

後続Recordは、同じ`task_id`、直接参照可能なtop-level canonical URL、authoring Roleのauthority、cumulativeまたはsupersede範囲、prior closure flagsとreviewed HEAD、protected actionを新たに付与しないことを確認できる場合だけ累積Sourceになる。Review Amendmentは、明示closureまたはFinal Review Decisionまで暗黙に破棄されない。

## Protected Actions and Role Boundary

Task Assignmentに明示的なauthorityがない限り、すべてのRoleで次を禁止する。

- Merge、Approve、Ready-for-review、Revert、Issue closure
- Product scopeまたはpriorityの決定
- Role追加、Role変更、暗黙reassignment
- Contract、Schema、API meaningの変更
- Existing Run、Research Artifact、Canonical Mappingの変更
- 別Task、branch、worktree、PRへの置換
- secret、credential、personal pathのcanonical record化

Role固有authorityがあっても、Task scope外のprotected actionは許可されない。上位SourceとRole Charterが衝突する場合は独自に選択せず、`architecture_gap`で停止する。

## Closed Terminal Stop Reason

Role executionがIntegrated Leadへ制御を返す`execution_stop_reason`は次の3値だけとする。

```text
completed
architecture_gap
external_blocker
```

| execution_stop_reason | Meaning | Compatible Result Handoff status |
| --- | --- | --- |
| `completed` | completion conditions、required validation、canonical handoffを満たした | `completed`、または真にnon-blockingなwarningだけなら`completed_with_warnings` |
| `architecture_gap` | Freeze済みSourceが不足または矛盾し、Role authority内で一意に決められない | `blocked` |
| `external_blocker` | permission、network、service、tool/runtime、repository stateなど外部条件により安全に完了できない | `blocked`、または実行失敗が確定した場合`failed` |

`execution_stop_reason`は、[Delegation and Result Contract](11-delegation-and-result-contract.md)の`status`とは別fieldである。`needs_followup`や`failed`をterminal reasonの代用にしてはならず、Result Handoffには両fieldを記録する。

## Progress-Only Reporting Prohibition

status update、acknowledgement、scope summaryは継続中checkpointとして許可するが、terminal Result Handoffの代わりにはならない。Roleは、completion、exact architecture gap、evidence-backed external blockerのいずれかまで継続する。

「調査した」「次にtestする」「CIがgreen」「fileを追加した」だけではterminal resultにできない。

## Same-Task Correction Rule

Review correctionとArchitecture gap closureは、原則として同じ`task_id`、branch、worktree、PRを維持する。

- Implementerはgapを推測実装せず、exact gapとboundaryをTask Issueへ記録する。
- Architectはgapの範囲だけをCumulative AmendmentでFreezeする。
- Integrated LeadだけがResume Dispatchを記録する。
- ImplementerはResume Dispatch前に再開しない。
- Review Amendmentの修正で新しいTask、branch、worktree、PRを作らない。
- purpose、primary Role、contract domain、allowed file boundaryが変わる場合だけ別Taskを設計し、Product Owner判断を得る。

## Canonical Record Locations

- Task Assignment、Architecture Amendment、Resume Dispatch、Review DecisionはTask Issue bodyまたはtop-level commentへ記録する。
- Result HandoffはDraft PR bodyを第一選択とし、PRがないTaskはTask Issue top-level commentへ記録する。
- Inline review thread、CI log、chat、local file、Preview commentだけを正本にしない。
- PR review UIはTask Issue上のReview Decisionを置き換えない。

## Completion Evidence

すべてのRoleはResult Handoffへ次を記録する。

- final `task_id`とcanonical URLs
- Role、branch、worktree、base、full HEAD
- created / updated filesとscope外変更がないこと
- exact command、exit result、実行HEAD
- focused coverageとfull regression coverage
- GitHub checksのname、conclusion、checked HEAD
- unresolved / unverified items
- protected actionsを実施していないこと
- Contract、Schema、Existing Run、Research Artifactへの影響
- next actionとowner

CI greenは必要条件になり得るが十分条件ではない。stale HEAD、smoke test、symbol existence、helper-only test、PR bodyの自己申告はcompletion evidenceにならない。

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

非該当はnormative basisを添えて`not_applicable`とする。未実行を`not_applicable`に読み替えてはならない。Architecture test matrixに未消化rowが1つでもあれば`completed`は禁止する。

## Role-Specific Deltas

- Integrated LeadはAssignmentをcanonical化してdispatchし、gap stopを検証してArchitectへ返し、closure後にsame-task Resume Dispatchを記録する。specialist実装、Architecture判断、Review代行、Merge、Revertを行わない。
- Backend Architectはexact gapを閉じるCumulative Amendmentとclosure flagsをFreezeし、fresh HEADでContract適合をReviewする。implementation、Product decision、Resume authorizationを代行しない。
- Backend ImplementerはFreeze済みinputだけを実装し、production entry、success / failure / boundary / malformed、identity / ordering / cross-reference / immutabilityを証明する。hidden default、meaning repair、test期待値の弱体化を行わない。
- Frontend Implementer、Worker、Research Operations RoleはこのContractを継承し、各Role Charterまたはrouting contractの固有境界を維持する。
- Review Assignmentを受けた既存Roleには、このContractに加えてreview capability overlayを適用する。

## Compatibility

- 既存Task AssignmentとResult Handoffをinvalid化しない。
- migration前Taskはpinned canonical sourcesを維持する。
- migration後の新Taskは、このContractのcommit-pinned revisionをBindingする。
- 進行中Taskへの適用は、Integrated Leadがsame-task top-level Amendmentで明示する。暗黙retrofitを禁止する。
- Result Handoff status、Context Health outcome、Dispatch state、Research Review vocabularyを変更しない。

## Normative Ownership Boundary

このContractはRole Charter、routing contract、template、automation designをnormative inputにしない。Role Charterは共通規則を再定義せず、Role固有差分だけを所有する。routing contractはroutingだけ、templateはrecordの記入例だけ、automation documentはhuman Role contractのconsumerだけを担い、Role authorityを拡張しない。
