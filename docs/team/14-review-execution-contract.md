# Review Execution Contract

<!-- role-contract-meta
id: 14
kind: contract
owns: review_admission, review_finding, review_decision_record
uses: assignment_shape, result_handoff_shape, handoff_status, shared_admission, canonical_record_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, finding_closure_authority
-->

## Purpose and Dependencies

このContractは、既存RoleがReview Assignmentを受けたときに[Shared Role Execution Contract](13-shared-role-execution-contract.md)へ追加適用するReview capability ruleの唯一のnormative ownerである。Review AssignmentとResult Handoffのshape / statusは[Delegation and Result Contract](11-delegation-and-result-contract.md)をconsumeする。

単一の汎用Reviewerまたは`Frontend Architect`を正式Roleとして追加せず、Role taxonomy、RoleV1、Result Handoff status、Research Review vocabularyを変更しない。

## Admission

Reviewerは、review開始時とDecision記録直前に次をfresh fetchする。

- Task objectiveとobservable acceptance criteria
- Freeze済みContract、Task-specific test matrix、Cumulative Amendment
- open Review Amendmentとfindingごとのclosure state
- reviewed PR、full 40-character HEAD、base、Diff、files
- production path、focused test、full regression、GitHub checksと各実行full HEAD
- Role固有のreview authorityとprotected action boundary
- record type、authoring authority、prior record、cumulative scopeを含むcanonical chain

Review対象のHEADが変わった場合、古いreview evidenceを新HEADの証明として再利用しない。HEAD更新だけでfindingをcloseしない。

## Review Order

1. 実装手段ではなく、Task objectiveとobservable acceptanceの達成を確認する。
2. Freeze Contractとallowed / forbidden scopeへの適合を確認する。
3. production public entryを通るbehaviorとfailure pathを確認する。
4. Shared Role Execution Contractのtesting baselineとTask-specific matrixの全rowを照合する。
5. full regressionとGitHub checksを、同じreviewed full HEADに対して確認する。
6. existing behavior、data、state、compatibilityへのregressionを確認する。
7. findingとrequired correctionをdirect canonical Review Decisionへ記録する。

主要objective、acceptance、required matrixのいずれかが未達なら、review対象をcompleted、APPROVE相当、merge-readyと判定しない。ただしReviewerがAssignment上のreviewと必須検証を完遂し、blocking findingをcanonical record化した場合、Review Task自身は`execution_stop_reason: completed`と`status: needs_followup`で完遂できる。

## Evidence Standard

CI greenだけではReview Decisionを確定しない。helper-only test、smoke test、symbol existence、stale HEAD、PR bodyの自己申告をnormative coverageとして扱わない。

Review evidenceは該当する範囲で次を含む。

- reviewed PRとfull `reviewed_head`
- objective / acceptanceごとの観測結果
- production pathとrequired result / failure branches
- positive / negative / boundary / malformed coverage
- unknown / duplicate / missing / ordering / cross-reference coverage
- mutation isolation、deep immutability、recursive freeze coverage
- focused / full validation commands、result、実行full HEAD
- GitHub check name、conclusion、checked full HEAD
- scope外変更、compatibility、unresolved / unverified items

Architecture test matrixに未消化rowがある場合、review対象はcompletionまたはAPPROVE相当にならない。Review Taskは未消化rowをblocking findingとして記録した場合だけ`completed + needs_followup`になれる。

## Gate Status Review Overlay

This section is a review overlay. The completion conditions, evidence ownership,
and PR Body Gate Status fields are owned by the
[Shared Role Execution Contract](13-shared-role-execution-contract.md); this
Contract does not become a generic execution owner.

Before a reviewer relies on a Gate Status entry, the reviewer MUST fresh-fetch
the PR Body, exact PR HEAD and state, and every cited canonical completion
record. The reviewer MUST verify that:

- each current gate is bound to the reviewed full HEAD;
- prior-HEAD evidence is explicitly labeled `historical_at_prior_head` and is
  not used as current completion evidence;
- Final Regression and Operational Validation have direct canonical result
  records rather than inferred CI status;
- a Draft/Ready transition is represented by its sole-action completion record;
- Ready, Approve, and Merge are independent status fields; and
- the current blocking reason and next gate match the canonical record chain.

A stale, missing, or conflicting Gate Status entry is a review finding. The
reviewer MUST record the exact mismatch and require a same-task metadata-only
correction; the reviewer MUST NOT silently repair the PR Body or treat CI green
as completion. The correction must be followed by the dependent read-only gate
revalidation at the unchanged exact HEAD before a review decision relies on it.

## Review Decision Canonical Record

Review DecisionまたはReview Amendmentは、Task Issueのtop-level commentへ記録し、record全文へ直接到達できるGitHub URLを`canonical_record`とする。PR review UIとinline threadはmirror / evidence pointerであり、canonical recordを置き換えない。

Decisionには次を含める。

- `task_id`
- `record_type`: `review_decision | review_amendment`
- `authoring_role`と`authority_source`
- direct `canonical_record` URL
- `prior_record_url`
- `cumulative_scope`または`supersede_scope`
- `reviewed_pr`
- full 40-character `reviewed_head`
- reviewing Roleと適用Contract
- `decision`
- blocking findingsとevidence
- required corrections
- allowed next actionとforbidden next action
- findingごとのclosure flag
- unresolved / unverified items

Repository-relative Markdownを添える場合は、pathとfull 40-character commit SHAを組にした`supporting_record`として記録する。

## Cumulative Findings and Closure

- Review Amendmentは同じ`task_id`、branch、worktree、PRへ累積する。
- 後続pushは既存findingを暗黙にcloseしない。
- finding closure authorityはShared Role Execution Contractを適用する。Reviewerは要求されたnew full HEADのevidenceとfinding別closure flagをcanonical Review Decisionへ記録する。
- Final Review Decisionもprior findingを個別に列挙し、open / closedを明示する。
- Architecture gapが必要な場合、Reviewerはgapの内容とboundaryを記録し、Architect Teamへ返す。Reviewer自身がContractを補完しない。
- Architecture AmendmentはArchitecture questionだけを閉じ、implementation findingを自動closeしない。
- Architecture Amendmentだけではimplementationをresumeしない。Integrated Leadのvalidなsame-task Resume Dispatchを必要とする。

## Capability Boundary

このoverlayはReviewを担当する既存Roleへ新しいprotected action authorityを付与しない。protected actionの一覧とsame-task correctionの共通意味はShared Role Execution Contractを参照する。

- 自分が作成したPRを自己Approveしない。
- Review中に成果物を無断修正しない。修正は対象TaskのImplementerへ同一Taskで返す。
- `APPROVE`というGitHub actionがAssignmentで禁止されている場合は実行せず、`APPROVE相当`の判定と根拠だけをcanonical recordへ記録する。
- Design Reviewer、Backend Architect、Architect Team、Research Review OPは、それぞれのRole固有authorityと判定語彙を維持する。
- Research Review OPの`APPROVE | COMMENT | NEEDS_FOLLOWUP | REJECT`やResearch meaningをこのContractで再定義しない。

## Review Terminal Result

Review executionもShared Role Execution Contractのclosed `execution_stop_reason`を使用し、Result Handoff `status`とは分離する。

- Review Assignment自体と必須validationを完遂し、findingなし: `completed + completed`
- Review Assignment自体と必須validationを完遂し、blocking findingをcanonical record化: `completed + needs_followup`
- Review meaningが未Freezeまたは矛盾: `architecture_gap + blocked`
- required authority recordまたはfresh stateを取得不能: `external_blocker + blocked | failed`

progress-only report、CI green、Review開始のacknowledgementだけをterminal resultにしない。
