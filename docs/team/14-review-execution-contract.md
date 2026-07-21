# Review Execution Contract

## Purpose

このContractは、既存RoleがReview Assignmentを受けたときに[Shared Role Execution Contract](13-shared-role-execution-contract.md)へ追加適用するcapability overlayである。単一の汎用Reviewerまたは`Frontend Architect`を正式Roleとして追加せず、Role taxonomy、RoleV1、Research Review vocabularyを変更しない。

Review AssignmentとResult Handoffのrecord shapeは[Delegation and Result Contract](11-delegation-and-result-contract.md)に従う。

## Admission

Reviewerは、review開始時とDecision記録直前に次をfresh fetchする。

- Task objectiveと操作または入力単位のacceptance criteria
- Freeze済みContract、Task-specific test matrix、Cumulative Amendment
- open Review Amendmentと各findingのclosure state
- reviewed PR、full 40-character HEAD、base、Diff、files
- production path、focused test、full regression、GitHub checksと各実行HEAD
- Role固有のreview authorityとprotected action boundary

Review対象のHEADが変わった場合、古いreview evidenceを新HEADの証明として再利用しない。

## Review Order

1. 実装手段ではなく、Task objectiveとobservable acceptanceの達成を確認する。
2. Freeze Contractとallowed / forbidden scopeへの適合を確認する。
3. production public entryを通るbehaviorとfailure pathを確認する。
4. [Shared Role Execution Contract](13-shared-role-execution-contract.md)のtesting baselineとTask-specific matrixの全rowを照合する。
5. full regressionとGitHub checksを、同じreviewed HEADに対して確認する。
6. existing behavior、data、state、compatibilityへのregressionを確認する。

主要objective、acceptance、required matrixのいずれかが未達なら、implementationが存在してもReviewを完了扱いにしない。

## Evidence Standard

CI greenだけではReview Decisionを確定しない。helper-only test、smoke test、symbol existence、stale HEAD、PR bodyの自己申告をnormative coverageとして扱わない。

Review evidenceは該当する範囲で次を含む。

- reviewed PRとfull reviewed HEAD
- objective / acceptanceごとの観測結果
- production pathとrequired result / failure branches
- positive / negative / boundary / malformed coverage
- unknown / duplicate / missing / ordering / cross-reference coverage
- mutation isolation、deep immutability、recursive freeze coverage
- focused / full validation commands、result、実行HEAD
- GitHub check name、conclusion、checked HEAD
- scope外変更、compatibility、未確認事項

Architecture test matrixに未消化rowがある場合、CIがgreenでもcompletionまたはAPPROVE相当と判定しない。

## Review Decision Canonical Record

Review DecisionまたはReview Amendmentは、Task Issueのtop-level commentへ記録する。PR review UIはmirrorであり、canonical recordを置き換えない。

Decisionには次を含める。

- `task_id`
- `reviewed_pr`
- full 40-character `reviewed_head`
- reviewing Roleと適用Contract
- `decision`
- blocking findingsとevidence
- required corrections
- allowed next actionとforbidden next action
- prior findingごとのclosure flag
- unresolved / unverified items

## Cumulative Findings and Correction

- Review Amendmentは同じ`task_id`、branch、worktree、PRへ累積する。
- 後続pushは既存findingを暗黙にcloseしない。
- 各findingは、該当HEADでのevidenceと明示closure、またはFinal Review Decisionで個別に閉じる。
- Architecture gapが必要な場合、Reviewerはgapの内容とboundaryを記録し、Architectへ返す。Reviewer自身がContractを補完しない。
- Architect Amendmentだけではimplementationをresumeしない。Integrated Leadのsame-task Resume Dispatchを必要とする。

## Capability Boundary

このoverlayはReviewを担当する既存Roleへ、Merge、Approve、Ready-for-review、Revert、Issue closure、Product decision、Role変更、無断修正のauthorityを付与しない。

- 自分が作成したPRを自己Approveしない。
- Review中に成果物を無断修正しない。修正は対象TaskのImplementerへ同一Taskで返す。
- `APPROVE`というGitHub actionがAssignmentで禁止されている場合は実行せず、`APPROVE相当`の判定と根拠だけをcanonical recordへ記録する。
- Design Reviewer、Backend Architect、Architect Team、Research Review OPは、それぞれのRole固有authorityと判定語彙を維持する。
- Research Review OPの`APPROVE | COMMENT | NEEDS_FOLLOWUP | REJECT`やResearch meaningをこのContractで再定義しない。

## Review Terminal Result

Review executionも[Shared Role Execution Contract](13-shared-role-execution-contract.md)のclosed `execution_stop_reason`を使用し、Result Handoff `status`とは分離する。progress-only report、CI green、Review開始のacknowledgementだけをterminal resultにしない。
