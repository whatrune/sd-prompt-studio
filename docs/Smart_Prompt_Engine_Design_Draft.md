# Smart Prompt Engine Draft Design

> Status: Draft / Experimental  
> この文書は現在までのPrompt検証から得た仮説を整理した設計案であり、完成仕様ではありません。モデル、checkpoint、seed、sampler等によって結果が変わるため、実装判断には追加検証が必要です。

関連文書: [Tag Role Model](./Tag_Role_Model.md) / [Prompt Experiment Log](./Prompt_Experiment_Log.md) / [Prompt Expansion Layer](./prompt-expansion.md) / [Prompt Ordering](./prompt-ordering.md) / [Slot Design](./slot-design.md)

## 1. Smart Prompt Engine概要

Smart Prompt Engineの目的は、選択タグをそのまま連結することでも、単に関連タグを追加することでもありません。モデル内部の意味構造を維持しながら概念を補助し、対象モデルが解釈しやすいPrompt構造へ変換することです。単語辞書ではなく、意味関係を持ったPrompt Compilerとして設計します。

```text
User Selection
  ↓
Tag Semantic Analysis
  ↓
Tag Role Classification
  ↓
Expansion / Modifier Resolution
  ↓
Compatibility / Semantic Interaction
  ↓
Prompt Rendering
```

### 1.1 User Selection

ユーザーが選択したcanonicalタグ、weight、選択対象（Character / Scene）、Character positionを入力として受け取ります。選択したCore Conceptは、展開処理によって暗黙に削除・置換しません。

### 1.2 Tag Semantic Analysis

タグが表す対象、部位、意味、時間的性質、作用領域を分析します。既存のcategoryやsubcategoryはUI上の探索分類として維持し、意味役割とは分離します。

分析候補:

- entity: Character / Scene / interaction
- target region: hair / eye / pupil / iris / mouth / body等
- semantic role: Core Concept / Attribute / Structure / Texture・Shape / State / Effect / Modifier
- persistence: intrinsic / temporary
- specificity: generic / specific / composite
- model support: native / support recommended / uncertain

### 1.3 Tag Role Classification

タグをAIへの作用単位で分類します。役割は表示カテゴリやslotを置き換えるものではありません。一つのタグが主roleと補助roleを持つことは許可しますが、分類の曖昧さを避けるため`primaryRole`は一つにします。

分類は`Tag → Role → Relationship`の3層で扱います。Roleはタグ自体の作用単位、Relationshipは他タグとの補助、構成、変化、合成、作用領域の関係を表します。

### 1.4 Expansion / Modifier Resolution

Core Conceptを保持したまま、再現を補助するタグ候補を解決します。展開は原則として置換ではなく追加です。ユーザーが明示選択したタグとEngineが補助追加したタグを区別し、Previewで追跡可能にします。

Modifierは単なる部品ではなく、CoreやStateの意味方向を変える可能性があります。たとえば`crying + smile`は矛盾として削除せず、「嬉し泣き」「安心して泣く」方向の合成として扱います。

### 1.5 Compatibility / Semantic Interaction

従来のConflict Detectionを包含する層です。明示的conflicts、slot排他、作用領域、意味合成の順に評価します。結果は完全競合の`hard`、意味上書き・曖昧化の`warning`、新しい意味になる`composed`、独立共存する`compatible`を返します。

### 1.6 Prompt Rendering

競合解決後のタグ集合を、既存の`promptGroup` / `promptOrder`とExpansion Layerへ渡します。Rendererは意味判定を行わず、決定済みのタグ、親子関係、Character / Scene境界、モデルstrategy、BREAK規則を出力へ変換します。

単体Characterの既存Prompt互換、canonical ID、weight、Scene一回出力を維持することを前提とします。

## 2. Tag Role Model

詳細な定義とデータ案は[Tag Role Model](./Tag_Role_Model.md)を参照してください。

| Role | 意味 | 例 |
|---|---|---|
| Core Concept | モデル内部に強い意味表現を持ち、複数特徴を内包し得る完成概念 | `bob cut`, `ponytail`, `maid outfit`, `happy face`, `cosmic eyes` |
| Attribute | 対象の基本属性 | `long hair`, `short hair`, `blue eyes`, `red eyes` |
| Structure | 部品構成や結合構造 | `braid`, `tied hair`, `double tied hair`, `bangs`, `sidelocks` |
| Texture / Shape | 質感、曲率、形状傾向 | `straight hair`, `curly hair`, `wavy hair`, `natural curls` |
| State | 一時的または変化可能な状態 | `messy hair`, `crying`, `wet hair` |
| Effect | 発光、反射、視覚効果 | `glowing eyes`, `sparkling eyes` |
| Modifier | CoreやStateの方向・強度を補助 | `smile`, `smirk`, `open mouth`, `sad eyes`, `angry eyes` |

Core Conceptは単に「完成して見えるタグ」ではなく、単体でモデル内部に強い意味表現を持つタグです。複数の属性・構造・状態を内包する場合があり、分解特徴だけでは同じ結果を再現できません。たとえば`happy face`はsmile、eye expression、eyebrow、emotionを、`bob cut`はshort hair、silhouette、length、shapeを内包する可能性があります。

### 2.1 Tag Relationship Layer

`Tag → Role → Relationship`として、タグ間の意味関係を保持します。

| Relationship | 意味 | 例 |
|---|---|---|
| `supports` | Coreを補助 | `bob cut → short hair` |
| `contains` | Coreが内部的に持つ特徴 | `bob cut contains short hair / silhouette / length` |
| `feature_of` | 既存互換用。特徴側からCoreを指す旧表現 | `long sidelocks feature_of hime cut` |
| `modifies` | 状態や方向を変化 | `bob cut + messy hair → messy bob` |
| `changes_direction` | 意味方向を変化 | `smug face + smirk → teasing / mocking` |
| `composes` | 新しい意味を合成 | `crying + smile → happy tears / relief crying` |
| `occupies` | 複数作用領域を宣言 | `nebulae cosmic eyes → iris style + color tone + luminosity` |

Modifierには`emotionBias`、`intensityChange`、`directionChange`、`affectedRegion`を付与可能にし、単なる補助語ではなく意味変換要素として扱います。詳細な型は[Tag Role Model](./Tag_Role_Model.md)を参照してください。

`supports`はPromptへ補助追加する運用関係、`contains`はCore内部の意味構造を記述する分析関係です。`contains`だけを根拠に特徴タグを自動出力しません。既存の`feature_of`概念は削除せず、`contains`の逆向き表現として読み替え可能な互換関係にします。

### 2.2 Core Concept Strength

Core Conceptは単体でモデル内部に強い意味表現を持つという定義を維持しつつ、その相対的な自立性・再現力を評価する任意metadataを保持できます。

```ts
type CoreConceptMetadata = {
  conceptStrength?: 'high' | 'medium' | 'low'
}
```

- `high`候補: `bob cut`, `ponytail`, `twintails`
- `medium`候補: `happy face`, `sad face`
- `low`: 今後の検証対象

これらは説明用の候補であり、現時点では具体値を確定しません。`conceptStrength`はPrompt weightや自動展開数を直接決定する値ではなく、実験結果に基づく設計判断の入力候補です。

## 3. Expansion Engine設計

### 3.1 基本原則

展開は「置換」ではなく「補助」を基本とします。

```text
Bad:
bob cut → short hair

Good:
bob cut
  + short hair
  + straight hair
```

`bob cut`は完成概念であり、`short hair`はその特徴の一部にすぎません。Core Conceptを消すと意味の特異性が失われます。

### 3.2 Expansion Mode

| Mode | 目的 | 例 |
|---|---|---|
| `concept_support` | Core Conceptの再現安定化 | `bob cut`に`short hair`を補助 |
| `feature_support` | 構成特徴を明示 | `bob cut`に`straight hair`を補助 |
| `state_modifier` | Coreへ状態を合成 | `bob cut`に`messy hair`を適用 |
| `variant` | 同一概念の別表現・派生候補 | hairstyleのモデル別表記候補 |
| `constraint` | 不要な解釈を抑制または条件付け | 対象部位、人数、左右等の制約 |
| `rejected_candidate` | 実験結果により自動展開から除外 | 効果の弱い`loose curls`を記録 |

`variant`は自動追加ではなく、モデルstrategyまたはユーザー選択による候補切替を基本とします。`constraint`はNegative Promptへの投入を意味せず、出力先を別途指定します。

### 3.3 親子関係

展開結果は平坦な文字列にせず、由来を保持します。

```ts
type ExpansionNode = {
  tagId: string
  origin: 'selected' | 'engine'
  parentTagId?: string
  mode?: 'concept_support' | 'feature_support' | 'state_modifier' | 'variant' | 'constraint' | 'rejected_candidate'
  confidence?: number
  evidenceIds?: string[]
  enabled: boolean
}
```

要件:

- 親タグを無効化した場合、その親だけを根拠とする子タグも無効化できる
- 同じ補助タグが複数の親から必要とされた場合は一度だけ出力し、複数の由来を保持する
- ユーザーが明示選択したタグは、同じタグが展開候補にも存在しても`selected`を優先する
- canonical IDで重複排除し、alias文字列だけで別タグを生成しない
- 展開前、展開後、最終採用をPreviewで比較できる

### 3.4 モデル別適用

展開規則はモデル非依存の意味規則と、モデル別の有効性データを分けます。たとえば`bob cut → short hair + straight hair`を意味候補として保持し、Illustrious等での採用可否やweightは実験ログに基づくstrategyが決定します。

## 4. 実験結果ログ設計

実験記録のテンプレートと初期ログは[Prompt Experiment Log](./Prompt_Experiment_Log.md)に定義します。

最低限、次を記録します。

- Original Tag
- Tested Prompt
- Result Summary
- Effective Tags
- Failed Tags
- Suggested Role
- Expansion Candidate
- Conflict Candidate
- Observed Meaning

比較可能性を高めるため、可能ならmodel/checkpoint、seed、sampler、steps、CFG、resolution、試行枚数、判定者、日付も記録します。単発の成功例は規則へ直結させず、再現率と反証例を残します。

## 5. 現時点の検証結果

### 5.1 Hair

- `bob cut`: Core Concept。`bob cut + short hair + straight hair`で安定。`bob cut`自体は残す。
- `ponytail`: Core Concept。`long hair + tied hair`だけではポニーテールにならない。
- `twintails`: Core Concept。`long hair + tied hair + symmetrical hair`だけでは再現できない。
- `single braid`: Core Concept。`long hair + braid + tied hair`だけでは不十分で、`single braid`を残す必要がある。
- `messy hair`: State。`bob cut + messy hair`で「ぼさぼさしたボブ」として合成される。
- `curly hair` / `wavy hair` / `natural curls`: Texture / Shape。
- `loose curls`: 現時点では効果が弱い。自動展開候補から除外し、未確定としてログを継続する。

### 5.2 Eyes

| Semantic area | Tags |
|---|---|
| Color | `blue eyes`, `red eyes` |
| Pupil | `slit pupils`, `heart pupils` |
| Iris Style | `cosmic eyes`, `nebulae cosmic eyes` |
| Effect | `glowing eyes`, `sparkling eyes` |

`star-shaped highlights`は目の特徴として作用する場合と、目周辺の装飾として解釈される場合があるため、作用領域を未確定とします。既存のeye highlight分類を直ちに変更せず検証を継続します。

### 5.3 Expression

- Core Concept: `happy face`, `sad face`, `angry face`, `smug face`
- State: `crying`
- Modifier: `smile`, `smirk`, `sad eyes`, `angry eyes`, `closed eyes`, `open mouth`, `furrowed brows`

Modifierは組み合わせによって感情方向を変えます。

- `smug face + smirk`: 嘲笑寄りになる可能性
- `crying + smile`: 嬉し泣き、安心して泣く方向
- `happy face + smile + happy eyes + closed eyes`: 自然な笑顔

したがって、Expressionの競合は部位排他だけでなく、意味合成結果も返す必要があります。

## 6. Compatibility / Semantic Interaction Layer設計

### 6.1 判定軸

```text
explicit conflicts
  ↓
exclusive slot / same target region
  ↓
role compatibility
  ↓
semantic composition
  ↓
model-specific ambiguity
```

各タグについて`targetRegion`、`role`、`scope`、`slot`、明示的conflicts、既知の組み合わせ結果を参照します。

### 6.2 判定結果

| Result | 意味 | UI候補 |
|---|---|---|
| `compatible` | 独立または補完関係 | 通常表示 |
| `composed` | 成立するが意味方向が変わる | 合成結果を説明 |
| `warning` | 上書き、曖昧化、過剰指定の可能性 | 注意表示、選択は許可 |
| `hard` | 同一領域で排他的、または明示的禁止 | 競合表示 |

### 6.3 現時点の例

- OK: `blue eyes + slit pupils + cosmic eyes`。Color / Pupil / Iris Styleが別領域。
- 注意: `nebulae cosmic eyes + eye color`。Iris Styleが色を内包・上書きする可能性。
- OK / composed: `crying + smile`。矛盾ではなく感情方向が変化。
- 注意: `crying + sad eyes + closed eyes`。同方向の重複強調と目情報の不可視化が起こる可能性。

Compatibility / Semantic Interaction Layerは最終的な画像結果を保証しません。警告または意味合成の根拠、対象モデル、evidenceを返し、ユーザーが判断できる設計にします。実装上は既存Conflict Engineを段階的に拡張可能な境界とします。

## 7. 今後の検証予定

以下は未確定であり、現時点では自動展開・hard conflictへ採用しません。

- Hair Motion
  - `flowing hair`
  - `windblown hair`
- Body / Proportion
- Pose
- Camera

特にPoseとCameraはCharacter / Scene、構図、複数被写体の境界に影響するため、単一タグ検証だけでなく、PR17のEntity Expansion出力を使った組み合わせ検証が必要です。

## Draft採用基準

実装候補へ昇格する規則は、少なくとも次を満たす必要があります。

1. Original Tagを消さずに改善するか確認されている
2. 複数seedまたは複数試行で再現する
3. 対象model/checkpointが記録されている
4. 反証例と副作用が記録されている
5. canonical ID、Prompt互換、Prompt順への影響が説明されている
6. 単体Characterと複数Characterの双方で評価されている
