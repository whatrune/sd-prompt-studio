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

実際の名前はTaskまたはPRを識別できればよい。worktree Path自体をContract、Artifact ID、保存データへ含めない。

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

## PR Rules

- 指定がなければDraft PRとして作成する。
- PR本文にはPurpose、Background、User impact、Changes、Validation、Unverified itemsを含める。
- Contract PRはImplementationを含めない。
- Implementation PRは対象Freeze Contractを変更しない。
- Frontend PRはBackend Contractを変更しない。
- Worker PRは判断を伴うContract変更を含めない。
- Shared Role Execution Contractがsame-task correctionを要求するReview修正は、同じPR branchへcommitしてpushする。
- 自分のPRを自己Approveしない。

## Merge Gate

Merge前に次を確認する。

- [ ] ScopeとPR目的が一致する。
- [ ] Required Reviewが完了している。
- [ ] 指定ValidationとGitHub Checksが成功している。
- [ ] Existing Run / Research Artifactの意図しない変更がない。
- [ ] 未確認事項がMerge判断者へ提示されている。
- [ ] Product OwnerがMergeを許可している。

Merge方式はRepository方針に従う。Squash mergeを使用する場合、PR titleまたはcommit messageが成果を表すことを確認する。

## Cleanup Procedure

Merge確認後に次を行う。

```text
1. PRがMERGEDであることを確認
2. origin/mainにmerge commitが存在することを確認
3. remote作業branchを削除
4. worktreeに未コミット変更がないことを確認
5. worktree remove
6. local branchを削除
7. git worktree prune
```

概念コマンド:

```bash
git worktree remove .worktrees/<task>
git branch -d codex/<role>-<purpose>
git worktree prune
```

未コミット変更があるworktreeを強制削除しない。cleanup失敗はmerge失敗と混同せず、PR状態とlocal cleanup状態を分離して報告する。

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
