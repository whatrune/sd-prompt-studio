# Repository Working Rules

このファイルは、このリポジトリで作業するCodex向けの永続的な運用ルールです。ユーザーの最新の明示指示が本書と競合する場合は、最新の明示指示を優先してください。

## Rule conflict and user override

- ユーザーの依頼が本書のルールに反する場合は、作業を始める前に短く警告する。
- 警告では、抵触するルール、想定されるリスク、推奨する代替案を具体的に示す。
- 警告後、ユーザーがリスクを理解した上で明示的に続行を求めた場合は、そのタスクに限りユーザー指示を優先して作業を続けてよい。
- 明示的なoverrideを受けた後は、同じ抵触事項について繰り返し確認しない。ただし、リスクや変更範囲が当初の説明から拡大した場合は再度警告する。
- overrideは、その依頼と同じ作業範囲にだけ適用する。将来の依頼や別PRへ自動的に引き継がない。
- システムまたは組織の安全ポリシー、権限制約、秘密情報の保護、外部への重要な副作用に必要な確認は、ユーザーのoverrideでは解除できない。

## Git workflow

### GitHub authentication checks

- Do not treat `gh auth status` as the sole source of truth. In this environment it may report an invalid token even when GitHub API access and repository access work.
- Verify actual connectivity with both `gh api user --jq ".login"` and `git ls-remote origin HEAD` before declaring GitHub authentication blocked.
- An HTTPS push that adds or updates `.github/workflows/*` may be rejected when the OAuth token lacks the `workflow` scope, even if ordinary API calls and pushes work.
- When only the `workflow` scope is missing, keep the workflow file in the change and use an already-configured SSH remote for the push, or refresh the HTTPS credential with `gh auth refresh -h github.com -s workflow`. Do not silently omit the workflow file.
- After using a temporary SSH configuration, confirm that it did not leave files such as `NUL` or temporary host-key files in the worktree.

- 新規PRは、必ず最新の `main` から新しいブランチを作成する。
- 別PRのブランチを再利用しない。
- ユーザーの未コミット変更を削除、上書き、または無断で取り込まない。
- 変更対象だけを明示的にステージする。混在したworktreeで `git add -A` を使わない。
- 追加修正は、対象PRの同じブランチへcommitしてpushする。
- PRは指定がなければDraftで作成する。
- PR本文には目的、背景、ユーザーへの影響、変更内容、検証結果、未確認事項を書く。

## Team development baseline

- `main`へ直接作業せず、担当Task専用のbranchとworktreeを使用する。
- 1担当、1branch、1worktreeにつき1つの主要作業単位だけを扱う。
- 未定義仕様、Contract衝突、Product判断を実装者またはWorkerが独自に確定しない。
- Architecture、Schema、API、Freeze仕様などのContract変更はArchitect Teamのレビュー対象とする。
- Freeze済み仕様をImplementation担当が変更しない。変更が必要な場合は実装を停止してArchitect Teamへ返却する。
- Existing Run、Research Artifact、Canonical MappingをTask Assignmentなしで変更しない。
- すべての担当者は、変更ファイル、非実施範囲、Validation結果、未確認事項を含む完了報告を行う。
- Role別責務、worktree運用、Handoff、Task Assignmentの詳細は[`docs/team/`](docs/team/00-operating-model.md)を参照する。

### Role boundary protection

- 依頼を受けた時点で、現在のRole、依頼内容、必要権限、他Roleの担当領域かを確認する。
- 現在のRole責務外の場合は作業を開始せず、適切な担当Roleと確認先を提示する。
- 責務外の依頼をRole変更として扱う場合、ユーザーまたはProduct Ownerの明示確認を得る。依頼内容だけからRole変更を推測しない。
- Contract判断、実装判断、Research判断、定型作業を一つのRole判断として混在させない。

## Implementation rules

- ユーザー価値と成功条件を、実装手段より優先する。
- 指定された変更範囲を守る。範囲外の変更が必要な場合は、理由を説明して確認する。
- 「原則変更禁止」とされたファイルやロジックを変更する必要が生じた場合は、先に理由を提示する。
- UI変更では、既存の表示条件、active状態、横スクロール、状態同期、保存互換性を維持する。
- overlay、疑似要素、固定height、負のoffset、過大なz-indexを追加する前に、DOMとスクロールコンテナの構造で解決できないか確認する。
- ユーザーの最新指示が以前の設計方針を置き換えた場合は、最新指示を優先し、不要になった暫定実装を残さない。

## Validation

コード変更後は、該当するコマンドを実行する。

- `pnpm run validate:dictionary`
- `pnpm test`
- `pnpm run build`
- `git diff --check`

UI変更では可能な限り、次も確認する。

- Cloudflare Pages Preview
- Dark ModeとLight Mode
- 狭い画面幅
- 対象Panel内のスクロール
- ブラウザコンソールのwarningとerror

実際に確認していない項目を「確認済み」と報告しない。環境制約で確認できない場合は、未確認事項として明記する。

## Failure prevention

- 同じ症状への修正が2回続けて失敗した場合は、3回目を実装する前に停止する。DOM、scroll container、stacking context、computed style、Previewの実状態を再調査し、新しい方針を説明する。
- Preview確認前に、対象commit SHAのCloudflare Checkが成功していることを確認する。古い表示が疑われる場合は、最新deployment URLまたはcache-busting queryを使う。
- UI動作の完了報告には、Preview操作、DOMまたはcomputed style、スクリーンショット、Check結果などの根拠を持つ。build成功やDOM上の存在だけで、表示・操作の成功を断定しない。
- 方針変更時は、以前の方針で追加したwrapper、selector、pseudo、z-index、offset、コメントを検索し、不要な暫定実装を同じ変更内で削除する。
- 「レビューして」という依頼は、原則として問題の特定と判定までとする。修正、commit、push、review submissionは、ユーザーが依頼した範囲でのみ行う。自分が作成したPRは自己Approveせず、「APPROVE相当」と根拠を報告する。

## PR review workflow

### 0. PRの目的を1文で固定する

レビュー開始時に、「このPRでユーザーが何をできるようになるか」を1文で定義する。実装手段を目的に含めない。

悪い例:

> sticky wrapperを追加するPR

良い例:

> 長いタグ一覧をスクロールしても、色変更とカテゴリ切替を継続して操作できるようにするPR

### 1. 目的達成を最優先で確認する

コード品質より先に、ユーザー視点で問題が解決したかを確認する。

- 目的となる操作を実行できる: 続行
- 実装は存在するが目的の操作ができない: 即REQUEST CHANGES

手段が実装されていることを、目的達成の証拠にしない。

### 2. 受け入れ条件を操作単位で確認する

PR本文の確認ケースを基準に、記載された操作と期待結果をそのまま検証する。「似た状態」ではなく、条件を満たしているかで判定する。

### 3. 既存機能の破壊を確認する

目的達成後、次を確認する。

- 既存操作が引き続き可能か
- stateの同期が壊れていないか
- 保存データと復元動作が壊れていないか
- 他カテゴリ、他Panel、他画面へ悪影響がないか

状態をまたぐ機能では、適用、対象切替、復帰、表示復元まで確認する。

### 4. 実装レビューは構造から始める

コードは次の順番で確認する。

1. DOM、コンポーネント、データ構造
2. stateの責務、更新箇所、同期経路
3. CSSの余白、色、responsive、z-index、sticky、overflow

CSSで症状を隠す前に、DOMやデータ構造が目的に合っているか確認する。

### 5. 手段が目的化していないか確認する

レビュー中に「この変更はユーザー価値を実現しているか、それとも実装を完成させること自体が目的になっていないか」を問う。

### 6. UI系PRはPreviewを先に見る

UI変更は、原則として次の順番でレビューする。

1. Previewを開く
2. 受け入れ条件の操作を行う
3. スクリーンショットまたは目視で結果を確認する
4. コードを確認する

画面上で目的未達が確認できた場合は、コード詳細へ進む前にその事実を報告する。

### 7. APPROVE条件

次をすべて満たした場合のみApproveする。

- 目的を達成している
- 受け入れ条件を満たしている
- 既存機能を維持している
- Previewで主要操作を確認した
- DOMまたはデータ構造に問題がない
- 実装方法が目的と保守性に対して妥当
- 必須のtestとbuildが成功している

目的未達が1つでもあればApproveしない。

### 8. REQUEST CHANGESとCOMMENTの基準

次はREQUEST CHANGESとする。

- 目的未達
- 既存機能の破壊
- 保存データまたはデータ構造の破壊
- 主要UIが操作不能
- 受け入れ条件の不達

次の軽微な指摘は、原則としてCOMMENTでよい。

- 命名
- 小さなCSS調整
- 将来の拡張性
- 目的達成に影響しないリファクタリング提案

## Codex向けPRプロンプト作成ルール

### 1. 最初に目的を書く

「何を実装するか」ではなく、「ユーザーが何をできるようになるか」を最初に書く。

### 2. 実装方法より先に成功条件を書く

成功条件はユーザー操作と観測可能な結果で記載する。実装手段が完成していても、成功条件を満たさなければ未完了とする。

### 3. 実装方法は設計意図を伴う推奨案として書く

実装方法を絶対条件にする必要がない場合は、次の形で書く。

> 推奨実装: Color Modifierとsubcategory tabsを同一wrapperで管理する。ただし、目的と成功条件を満たす別実装も可。

避けたい設計がある場合は、禁止事項と理由を併記する。

### 4. UI変更では期待DOMを書く

Panel、Header、Content、controls、通常スクロール領域の親子関係をtreeで示す。CSS指定だけで構造を表現しない。

### 5. 変更範囲を書く

- 変更してよいファイル
- 原則変更しないファイルやロジック
- 範囲外変更が必要な場合の確認方法

を明記する。

### 6. 禁止事項には理由を書く

禁止だけでなく、避ける理由も書く。Codexが代替案を判断できる情報を与える。

### 7. 検証ケースはユーザー操作で書く

「CSSを確認」ではなく、「タグ一覧をスクロールする」「subcategoryを切り替える」のように操作を記載し、その直後に期待結果を書く。

### 8. NG状態を書く

手段の実装だけで完了しないよう、成功していない状態を明示する。

例:

- stickyは存在するがcontrolを操作できない
- タブまたはColor Barが消える
- 空の余白だけが残る
- DOMは整理されているがユーザー操作を完了できない

## PR request template

```md
# PRタイトル

## 目的

ユーザーが何をできるようになるかを1文で記載する。

## 背景

現在の問題と影響を記載する。

## 成功条件

- ユーザー操作と観測可能な結果

## 期待構造

DOMまたはデータ構造をtreeで記載する。

## 実装方針

推奨方法と設計意図を記載する。目的達成を手段より優先する。

## 変更範囲

変更OK:

- 対象ファイル

原則変更禁止:

- 対象ファイルまたはロジック

## 禁止事項

- 禁止内容
- 理由

## NG状態

- 完了と判定してはいけない状態

## 確認ケース

1. 操作:
   期待結果:

2. 操作:
   期待結果:

## Build

- test
- build
- `git diff --check`
- Preview確認
```
