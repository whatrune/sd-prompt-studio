# Development Routing Contract

## Purpose

このContractは、Product Ownerから受けた開発依頼をIntegrated Leadが既存Roleへ安全にRoutingする規則を定義する。Architecture判断、実装、Review、Merge判断のOwnerは既存Charterのまま維持する。

## Standard Flow

```text
Product Owner Request
        |
        v
Integrated Lead intake and classification
        |
        v
Architect Team design / freeze
        |
        v
Integrated Lead verifies implementation-ready freeze
        |
        +--> Backend Implementer
        +--> Frontend Implementer
        +--> Worker
        |
        v
Architect Review
        |
        v
Integrated Lead verifies integrated completion
        |
        v
Product Owner merge decision
```

Contract変更とImplementationは別Taskとする。Freezeが存在しない、複数解釈が残る、またはInput Contractが衝突する場合はImplementationへRoutingしない。

## Routing Matrix

| Work | Primary role | Review / consultation |
| --- | --- | --- |
| Architecture、Contract、PR分割 | Architect Team | 影響を受けるImplementer |
| Backend Architecture、API境界、Backend技術判断 | Backend Architect | Architect Team |
| Freeze済みBackend仕様の実装 | Backend Implementer | Backend Architect |
| UI、React、State、UX、Frontend Test | Frontend Implementer | Design Reviewer、API影響時Backend Architect |
| 調査、一覧化、Markdown整理、Test Matrix、定型更新 | Worker | Assigning Role |
| PR Contract Review | Architect Team | 必要に応じ専門Reviewer |
| Merge判断 | Product Owner | Integrated Leadが状態を統合報告 |

## Intake Rules

Integrated Leadは依頼を受けたら次を順に確認する。

1. Product上の目的と観測可能な成功条件
2. Contract変更かFreeze済み仕様の実装か
3. Backend、Frontend、Workerの作業境界
4. 依存PR、Normative Source、Review Owner
5. Product Ownerへ戻す判断の有無

## Freeze Verification Gate

Implementation Assignment前に次を確認する。

- Normative ContractとVersionが一意
- Allowed / Forbidden Changesが明示
- Required BehaviorとFailure Behaviorが決定的
- Acceptance CriteriaとValidation commandが存在
- 未決定事項がImplementerへ委譲されていない
- Existing Run、Research Artifact、Schemaへの影響が明記

不成立の場合はArchitect Teamへ返却する。

## Assignment Rules

- 一つのTaskに一つのPrimary Roleを割り当てる。
- BackendとFrontendの両変更が必要な場合は、Contract依存関係を確定して別Taskへ分割する。
- WorkerへArchitecture、Contract、Product判断を割り当てない。
- Reviewは実装担当と分離する。
- 各Taskは[`11-delegation-and-result-contract.md`](11-delegation-and-result-contract.md)に従う。

## Completion Gate

Development TaskをProduct Ownerへ`completed`または`merge_ready`として報告するには次が必要である。

- Freeze済み仕様が参照可能
- 必要実装とTestが完了
- Required Validation結果が記録済み
- Architect Review完了
- 未解決Critical Findingなし
- GitHub ChecksとMergeability確認済み
- 未確認事項とProduct Owner判断事項が明示

Checks未完了、Review未完了、Critical Findingありの場合はMerge Readyと報告しない。

## Prohibited Routing

- Integrated LeadがArchitectureやContractを確定する
- Integrated Leadが実装を引き取る
- Implementerが未定義仕様を補完する
- WorkerがArchitecture判断する
- Frontend都合でBackend Contractを変更する
- Backend都合でResearch Contractを変更する
- Product Owner承認なしでMergeまたはRevertする

## Example

依頼「この機能をマージ可能な状態まで進めて」は、次のように分解する。

1. Integrated Leadが目的、現状、未決定事項を確認する。
2. Contract未FreezeならArchitect TeamへRoutingする。
3. Freeze後、BackendまたはFrontend ImplementerへTask Assignmentする。
4. 専門ReviewerへReviewを依頼する。
5. Checks、Mergeability、Critical Findingを統合する。
6. Merge可否と判断事項をProduct Ownerへ返す。

Integrated LeadはStep 3の実装またはStep 6のMergeを代行しない。
