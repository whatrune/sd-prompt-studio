# Worktree and Branch Rules

<!-- role-contract-meta
id: 05
kind: contract
owns: git_lifecycle
uses: same_task_correction, resume_authority
-->

## Purpose

並行作業による変更混入、別PR branchの再利用、mainへの直接編集、未コミット変更の損失を防ぐため、branchとworktreeの運用を固定する。

本書はGit lifecycleだけを定義する。same-task correctionのauthorityとstop / resume meaningは[Shared Role Execution Contract](13-shared-role-execution-contract.md)をconsumeする。

## Core Rules

- `main`を直接編集しない。
- 新規作業は最新の`origin/main`から開始する。
- 1 branchは1つの主要目的だけを持つ。
- 1 worktreeは1つのTask Assignmentだけを扱う。
- 1担当者は、同じworktreeで複数の独立Taskを混在させない。
- 別PRのbranchを新規作業へ再利用しない。
- ユーザーまたは他担当者の未コミット変更を取り込まない。
- 変更対象だけを明示的にstageし、混在worktreeで`git add -A`を使わない。

## Recommended Layout

```text
repository-root/
├─ .git/
├─ .worktrees/
│  ├─ pr87-design/
│  ├─ pr88-backend/
│  ├─ pr89-frontend/
│  └─ worker-task/
└─ ...
```

実際の名前はTaskまたはPRを識別できればよい。canonical absolute worktree pathはprocess-localなBounded Execution Identityへ含めるが、authority、lifecycle evidence、Artifact ID、または永続recordにはしない。

## Project-Local Filesystem Boundary

- Before creating a worktree, a Worker or Implementer MUST freshly resolve the current repository root, inspect the registered worktrees, and confirm the project's existing worktree layout.
- A worktree, source copy, or build workspace that a Worker or Implementer selects or creates as the Task workspace MUST remain within the current repository or project's existing managed area. The repository-local `.worktrees/<task>` convention above MUST be preferred when it is available.
- A Worker or Implementer MUST NOT select or create such a Task workspace outside the project, including under OneDrive, Desktop, Downloads, a temporary directory, or another drive, unless an external path is genuinely necessary and the reason and exact external path receive explicit prior Product Owner approval before creation or use. Convenience alone MUST NOT justify an external path.
- An existing run-scoped immutable execution workspace created and controlled by the central production host, including role-host source materialization under `RUNNER_TEMP`, is not a Worker- or Implementer-selected Task workspace and is outside that external-path Product Owner approval rule. This is not a general `RUNNER_TEMP` exception for a Worker or Implementer, does not authorize an external Task workspace, and creates no per-run approval ceremony.
- Retired paths, historical environment information, and guessed paths MUST NOT be reused. The target path MUST be derived from the freshly confirmed repository root and existing project-local convention.

## Branch Naming

形式:

```text
codex/<role>-<purpose>
```

Role例:

- `architect`
- `backend`
- `frontend`
- `worker`

例:

```text
codex/architect-research-explorer-contract
codex/backend-implement-evidence-evaluation
codex/frontend-research-explorer-inspector
codex/worker-update-validation-matrix
```

既存PRへ追加修正する場合だけ、そのPRの既存branchを継続利用する。

## Start Procedure

```text
1. root worktreeのstatusを確認
2. GitHub connectivityを確認
3. origin/mainをfetch
4. 最新origin/mainから新branchを作成
5. 専用worktreeを追加
6. Task Assignmentと変更禁止範囲を再確認
```

概念コマンド:

```bash
git status --short --branch
git fetch origin main
git worktree add .worktrees/<task> -b codex/<role>-<purpose> origin/main
```

既存の未コミット変更がある場合、それを削除・stash・commitせず、別のclean worktreeを使用する。

## During Work

- 作業開始時と完了前に`git status --short --branch`を確認する。
- Scope外ファイルが変更された時点で停止し、原因を確認する。
- Generated Artifactが必要な場合、Task Assignmentが許可したPathだけへ出力する。
- 他担当者のbranchをmerge、rebase、cherry-pickする前に依存関係とOwnerを確認する。
- main更新が必要になった場合、未コミット変更を保持したまま無理に同期しない。
- force push、history rewrite、destructive resetを標準手順にしない。

## Parallel Isolation

- Each active Task has one exact registered worktree path and one exact branch. Resolution by current working directory, fuzzy branch name, latest related commit, latest PR, or a historical same-path commit is prohibited.
- The expected base is the freshly resolved remote `origin/main` commit. A local branch named `main` is never base evidence.
- Independent executions must have distinct Task, branch, worktree, execution-instance, and published PR identities. Disjoint authorized paths may execute concurrently.
- Overlapping authorized paths require explicit dependency ordering or compatibility reconciliation before either execution mutates shared paths.
- Every mutation command explicitly targets the assigned worktree. A command must not inherit another Task merely because that Task's worktree is the current directory.
- A shared `node_modules` junction is read-only for concurrent Tasks and is admitted only when tracked dependency manifest identities match. No package-manager install, update, repair, or metadata mutation may run through the shared junction.
- Python validation dependencies are shared only through the immutable repository-scoped cache at `<git-common-dir>/codex-cache/python-validation-v1/`. Its identity is derived from the exact Python runtime/platform and the `requirements.txt` plus hashed lock digests, never from Task or Git state. Finalized environments are outside Task worktrees, contain no editable/repository path injection, and are never package-manager mutation targets. The returned `python_executable` is an opaque execution identity and MUST be preserved byte-for-byte through invocation: consumers MUST NOT strip a Windows `\\?\` prefix or reconstruct the executable from `cache_root`. PowerShell consumers invoke it with `& $result.python_executable -B -E -s` while keeping the assigned worktree as the explicit working directory.
- Concurrent worktrees may reuse the same finalized Python environment when the dependency/runtime identity is exact. One identity lock owns a cache miss; other processes wait for and validate the atomic winner. Dependency or Python compatibility changes produce a new identity. Repository source changes alone do not invalidate the cache, and the cache never selects a Task, branch, PR, HEAD, or worktree.
- Historical commits may be inspected only as explicitly labelled diagnostics and never become the current execution target.

## PR Rules

- 通常の自律Publicationではnon-Draft PRとして作成する。DraftはProduct Ownerがmanual working stateとして明示的に要求した場合だけ使用する。
- Draft PRはMerge対象にせず、自律LifecycleはDraftからnon-Draftへの状態変更を所有しない。
- PR本文にはPurpose、Background、User impact、Changes、Validation、Unverified itemsを含める。
- Contract PRはImplementationを含めない。
- Implementation PRは対象Freeze Contractを変更しない。
- Frontend PRはBackend Contractを変更しない。
- Worker PRは判断を伴うContract変更を含めない。
- Shared Role Execution Contractがsame-task correctionを要求するReview修正は、同じPR branchへcommitしてpushする。
- 自分のPRを自己Approveしない。

## Merge Gate

The [Shared Role Execution Contract](13-shared-role-execution-contract.md#merge-decision-and-merge-operation) is the sole normative owner of Merge sequencing, eligibility, exact-HEAD decisions, and operator authority. This document does not redefine them.

The only additional Git lifecycle check is that an explicitly authorized operator uses the authorized exact HEAD and Merge method under Repository policy. For a squash merge, confirm that the PR title or commit message represents the result.

## Cleanup Procedure

正常にMergeされたTaskのrepository cleanupは、次の順序で終了する。

```text
1. Mergeが確認済みで、post-Merge verificationがPASSしていることを確認
2. origin/mainをfresh-fetchする
3. root worktreeがcleanであることを確認する
4. local mainにlocal-only commitがないことを確認する
5. mainがorigin/mainのancestorであり、fast-forwardだけが可能であることを確認する
6. main == origin/mainならidempotent PASS、そうでなければgit merge --ff-only origin/mainを実行する
7. main == origin/mainを再確認する
8. PRがMERGED / CLOSEDであることを確認
9. assigned Task worktreeに未コミット変更がないことを確認
10. active executionまたはprocessがworktreeを使用していないことを確認
11. git worktree remove <task-worktree>
12. DONE
```

概念コマンド:

```bash
pwsh scripts/sync-local-main-after-merge-v1.ps1 -RepositoryPath <repository-root>
git worktree remove <task-worktree>
```

`sync-local-main-after-merge-v1.ps1`はpost-Merge verification後のlocal housekeeping ownerである。fresh-fetchした`origin/main`をintegration authorityとして使い、rootが`main`をcheckoutしたroot worktreeであること、rootがcleanであること、`origin/main..main`のcommit数が0であること、および`main`が`origin/main`のancestorであることをrequireする。同期は既にequalならzero-mutation PASS、それ以外は`git merge --ff-only origin/main`だけを許し、最後に`main == origin/main`とclean rootをrequireする。rebase、merge commit、reset、force-update、およびbranch deletionは行わない。

fetch failure、dirty root、local-only commit、divergence、FF-only failure、またはfinal equality failureではlocal-main synchronizationをfail closedにする。そのfailureは確認済みMergeを無効化せず、local-main synchronization failureとして分離して報告する。Task worktree cleanupに実際の依存がなければ、上記の安全なcleanup確認を継続してよい。

Canonical Task Issueのcloseはrepository cleanupとは別のprotected actionであり、明示的なProduct OwnerまたはIssue-closure authorityを必要とする。Merge Decision authorityからIssue closeを推論してはならない。Issue-closure authorityの不在またはIssue closeの失敗は、確認済みのMergeまたはworktree cleanupをblockせず、無効化もしない。

未コミット変更があるworktreeを強制削除しない。normal cleanupはlocal branchまたはremote branchを削除しない。worktree removalの失敗は、既に確認済みのMergeを無効化せず、cleanup failureとしてMerge結果とは分離して報告する。この手順はTask終了時の同期的な処理であり、cleanup framework、daemon、scheduler、databaseを要求しない。

## Handoff Between Worktrees

別担当へ引き継ぐ場合、worktree自体を共有状態として扱わない。mutable authorityとHandoffの正本はdirect GitHub canonical URLとし、commit SHA、branch、repository pathはcommit-pinned supporting recordとして扱う。未コミット差分を引継ぎ手段にしない。

引継ぎには最低限、次を含む。

- Source commit / branch
- Dependency PR
- Changed files
- Validation results
- Remaining work
- Contract questions
- Safe restart point
