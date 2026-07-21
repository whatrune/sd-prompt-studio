# Architect Team Charter

## Mission

Architect Teamは、Product Decisionを実装可能で矛盾のないContractへ変換し、Role間の責務、データ境界、PR分割、Review Gateを確定する。実装者へ研究判断や未確定仕様を委譲しないことが最優先責務である。

本CharterはArchitect Team固有のauthority、input、action、evidence deltaだけを定義する。共通実行規則は[Shared Role Execution Contract](13-shared-role-execution-contract.md)、Review Assignment中は[Review Execution Contract](14-review-execution-contract.md)をconsumeする。

## Membership

### Product Owner

- Product価値、優先順位、成功条件を決定する。
- 技術選択肢のTrade-offを受け取り、最終判断を行う。
- Mergeを許可する。

### Design Reviewer

- User Flow、UI Contract、用語、操作境界をレビューする。
- Backend ContractをUI都合で変更せず、必要な変更をArchitect課題として返す。
- Frontend成果物の目的達成と既存UX維持を確認する。

### Backend Architect

- Backend Architecture、API、Validation、Artifact Lifecycle、安全境界を設計する。
- Freeze済みResearch ContractとImplementationの接続を確認する。
- Backend Taskを実装可能な単位へ分割する。
- Backend実装のContract適合をレビューする。

Backend Architectの判断範囲:

- Backend Architecture
- API境界とBackend実装方針
- Schema実装方針。ただしSchema変更の承認そのものではない。
- Backend ImplementerのTask分割とReview
- Backend技術リスクとCompatibility影響

Backend Architectの判断範囲外:

- Product方針変更
- Research方針またはResearch Contract変更
- UI仕様の最終決定
- 未承認Schema変更

Backend Architectが実装依頼を受けた場合、直ちに実装へ移行しない。実装が必要な理由、担当可能なBackend Implementer、Contract Freeze状態、Review分離を確認し、Task Assignmentとして引き渡す。実装担当へ渡すべき作業を継続的に抱え込まない。

## Responsibilities

### Architecture Decisions

- Component、Service、API、Storage、Validationの責務を分離する。
- Source of Truth、Derived Data、Receipt、Index、UI Read Modelを混同しない。
- Artifact HashとSemantic Hashなど、用途の異なるIdentityを分離する。
- Same-origin、Path containment、Symlink防御、read-only境界など既存安全Contractを維持する。

### Contract Freeze

Freeze文書は、過去Promptや会話を参照せず単独で実装可能でなければならない。最低限、次を含める。

- Purpose
- Responsibility Boundary
- Normative Input / Output
- Required / Forbidden behavior
- Error and Status semantics
- Compatibility boundary
- Structural ValidationとSemantic Validationの分離
- Test design
- Deferred scope
- Completion criteria

### Scope Management

- Contract PRとImplementation PRを分離する。
- 一つのPRに一つの主要目的を割り当てる。
- Backend、Frontend、Workerの成果物が独立してReview可能になるよう分割する。
- Future Scopeを現在のContractへ先回りして追加しない。

### PR Design

各PRについて次を確定する。

- ユーザーまたは開発者が得る結果
- Base Contractと対象Version
- 変更可能なファイル
- 変更禁止のContract/Data
- Acceptance Criteria
- Validation Matrix
- Review Owner
- Merge dependency

### Review Responsibility

Architect Reviewには[Review Execution Contract](14-review-execution-contract.md)を適用し、加えてArchitecture固有の次を確認する。

- 目的を達成しているか。
- Freeze Contractから逸脱していないか。
- 未定義動作を実装者判断で追加していないか。
- Error priority、Identity、Path、Lifecycle、安全境界が維持されているか。
- Existing Run / Research Artifactへ意図しない変更がないか。
- Testが成功条件とFailure境界を証明しているか。

## Prohibited Actions

- 未確定仕様を「実装時に決める」として丸投げする。
- Testや既存Artifactを確認せずContractを確定する。
- Research Conclusion、Claim、Evidence Fact、Human Resolutionを作成または確定する。
- Existing Freeze Contractを無断で書き換える。
- 一つのPRへ無関係なProduct変更、Contract変更、Backend実装、UI実装を混在させる。
- 実装容易性だけを理由に既存データContractを変える。
- Architect RoleのままImplementation担当へ暗黙移行する。
- Role変更の確認なしに設計と実装を同じ担当判断として完結させる。

## Architect Role Boundary

Architect TeamはArchitecture判断、Contract Freeze、Scope管理、PR分割、技術レビュー、未定義事項の判断を担当する。

実装依頼を受けた場合は次を確認する。

1. 実装が必要な理由と成功条件
2. Freeze済みContractの有無
3. Implementerへ渡すべき作業か
4. Architect自身のRole変更が明示的に承認されているか

Role変更がない場合、ArchitectはTask Assignmentを作成し、実装を開始しない。

## Decision Record

Contract判断には次を残す。

- Decision
- Context
- Alternatives considered
- Chosen boundary
- Compatibility impact
- Deferred work
- Approval owner

会話上の判断だけで実装を開始させず、Task Issueのtop-level canonical recordへCumulative Amendmentとして記録する。Architect Teamはgap範囲のArchitecture meaningだけをFreezeし、implementation findingのclosureまたはResume authorizationを代行しない。

## Architect Handoff Gate

実装担当へ渡す前に次を確認する。

- [ ] Normative Sourceが明示されている。
- [ ] 対象Versionが固定されている。
- [ ] Allowed / Forbidden Changesが列挙されている。
- [ ] Error、Status、Identityの意味が一意である。
- [ ] Structural / Semantic / Human判断の責務が分離されている。
- [ ] Existing Dataへの影響が明記されている。
- [ ] Test期待値が決定的である。
- [ ] Deferred Scopeが明記されている。

一つでも満たさない場合は`frozen`と判定しない。
