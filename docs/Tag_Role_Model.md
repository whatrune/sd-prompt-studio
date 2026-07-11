# Tag Role Model — Draft

この文書はSmart Prompt Engineで使用する意味役割モデルのDraftです。UI上のcategory/subcategory、競合用slot、出力用promptGroup/promptOrderとは独立した軸として扱います。

## Role definitions

### Core Concept

単体でモデル内部に強い意味表現を持つタグです。複数の属性・構造・状態を内包している場合があり、分解した特徴タグだけでは同じ結果を再現できません。Expansionで置換せず、必ず原概念を保持します。

たとえば`happy face`はsmile、eye expression、eyebrow、emotionを内包する可能性があります。`bob cut`はshort hair、silhouette、length、shapeを内包します。内包特徴はCoreを説明・補助できますが、Coreそのものの代替にはなりません。

Core Conceptは相対的な自立性・再現力を設計上保持できます。

```ts
type CoreConceptMetadata = {
  conceptStrength?: 'high' | 'medium' | 'low'
}
```

`high`は`bob cut`、`ponytail`、`twintails`、`medium`は`happy face`、`sad face`のような候補を想定します。`low`を含む具体値は今後の検証対象であり、現時点では確定しません。この値をPrompt weightと同一視せず、自動展開や競合を単独で決定する用途にも使いません。

例: `maid outfit`, `school uniform`, `bob cut`, `ponytail`, `twintails`, `single braid`, `happy face`, `angry face`, `cosmic eyes`

### Attribute

対象の比較的安定した基本属性です。Core Conceptを補助できますが、通常はCoreと同義ではありません。

例: `long hair`, `short hair`, `blue eyes`, `red eyes`

### Structure

部品、結合、分岐、配置等の構造を表します。

例: `braid`, `tied hair`, `double tied hair`, `bangs`, `sidelocks`

### Texture / Shape

表面、曲率、輪郭、形状傾向を表します。

例: `straight hair`, `curly hair`, `wavy hair`, `natural curls`

### State

対象へ一時的または可変の状態を付与します。Core Conceptと共存し、その見え方を変化させます。

例: `messy hair`, `crying`, `wet hair`

### Effect

発光、反射、粒子、輝き等の視覚効果を付与します。

例: `glowing eyes`, `sparkling eyes`

### Modifier

Core Concept、State、または他の意味の方向・強度・解釈を補助します。Modifier同士が必ず共存できるとは限らず、対象部位と合成結果を評価します。

例: `smile`, `smirk`, `open mouth`, `sad eyes`, `angry eyes`, `closed eyes`, `furrowed brows`

Modifierは意味方向を持つことがあるため、次のmetadataを保持できる設計とします。

```ts
type ModifierMetadata = {
  emotionBias?: string[]
  intensityChange?: string
  directionChange?: string
  affectedRegion?: string[]
}
```

- `smile`: `emotionBias: ['positive']`
- `smirk`: `directionChange: 'teasing / arrogant'`
- `open mouth`: `intensityChange: 'increase'`
- `tears`: `emotionBias: ['emotional']`

## Orthogonal semantic areas

Roleだけでは競合を判断できないため、作用領域を別軸で保持します。

```ts
type TagRoleMetadata = {
  primaryRole: 'core_concept' | 'attribute' | 'structure' | 'texture_shape' | 'state' | 'effect' | 'modifier'
  secondaryRoles?: string[]
  targetRegion: string[]
  scope: 'character' | 'scene' | 'interaction'
  persistence?: 'intrinsic' | 'temporary'
  specificity?: 'generic' | 'specific' | 'composite'
  confidence: 'confirmed' | 'provisional' | 'uncertain'
  evidenceIds?: string[]
}
```

Eyesの例:

| Tag | Primary role | Target region / semantic area |
|---|---|---|
| `blue eyes` | Attribute | eye / color |
| `slit pupils` | Structure | eye / pupil |
| `cosmic eyes` | Core Concept | eye / iris style |
| `glowing eyes` | Effect | eye / effect |

Expressionの例:

| Tag | Primary role | Target region |
|---|---|---|
| `happy face` | Core Concept | face / expression |
| `crying` | State | face + eyes |
| `smile` | Modifier | mouth / expression direction |
| `closed eyes` | Modifier | eye state |

RoleはslotやUI categoryとは別概念です。たとえば`blue eyes`はRole = Attribute / Target = Eye Color、`cosmic eyes`はRole = Core Concept / Target = Iris Style、`closed eyes`はRole = Modifier / Target = Eye State、`happy face`はRole = Core Concept / Target = Expressionです。

## Tag Relationship Layer

```text
Tag
  ↓
Role
  ↓
Relationship
```

| Relationship | 意味 | 例 |
|---|---|---|
| `supports` | 親概念の再現安定化や補助として追加する | `bob cut → short hair`, `bob cut → straight hair` |
| `contains` | Coreが内部的に持つ特徴を記述する | `bob cut contains short hair / silhouette / length` |
| `feature_of` | 既存互換用。特徴側からCoreを指す旧表現 | `long sidelocks feature_of hime cut` |
| `modifies` | 状態や方向を変化させる | `bob cut + messy hair → messy bob` |
| `changes_direction` | 感情等の意味方向を変える | `smug face + smirk → teasing / mocking` |
| `composes` | 組み合わせで新しい意味になる | `crying + smile → happy tears / relief crying` |
| `occupies` | 一つのタグが複数領域へ作用する | `nebulae cosmic eyes → iris style + color tone + luminosity` |

Relationshipは方向性を持ちます。`supports`は補助タグをPromptへ追加する運用関係、`contains`はCore内部の意味構造を表す分析関係です。`contains`だけを根拠に子特徴を自動出力しません。既存の`feature_of`は削除せず、`contains`の逆方向を表す互換表現として保持します。`modifies`、`changes_direction`、`composes`では入力集合とObserved Meaningを保持します。`occupies`は競合ではなく作用領域宣言であり、領域ごとの互換性判定に利用します。

## Role classification rules

1. 特徴の組み合わせだけで再現できない固有概念はCore Conceptとする。
2. Coreを構成する一般特徴はAttribute、Structure、Texture / Shapeへ分ける。
3. 時間的・環境的に変化するものはStateを優先する。
4. 発光や輝き等のレンダリング作用はEffectとする。
5. 感情や状態の意味方向を変える部品はModifierとする。
6. 同じroleであることを競合理由にしない。targetRegion、slot、意味合成を併用する。
7. 分類が未確定のタグは`confidence: uncertain`とし、自動展開に使わない。

## Expansion relationship

```ts
type TagRelationship = {
  parentTagId: string
  childTagId: string
  relationship: 'supports' | 'contains' | 'feature_of' | 'modifies' | 'changes_direction' | 'composes' | 'occupies'
  mode: 'concept_support' | 'feature_support' | 'state_modifier' | 'variant' | 'constraint' | 'rejected_candidate'
  model?: string
  confidence: number
  evidenceIds: string[]
  autoApply: boolean
}
```

初期候補:

| Parent | Child | Mode | Draft判断 |
|---|---|---|---|
| `bob cut` | `short hair` | concept_support | 有効候補 |
| `bob cut` | `straight hair` | feature_support | 有効候補 |
| `bob cut` | `messy hair` | state_modifier | ユーザー選択時に合成 |
| `ponytail` | `long hair` | concept_support | 補助候補。ただし親を置換不可 |
| `single braid` | `braid` | feature_support | 補助候補。ただし親を置換不可 |
| `curly hair` | `loose curls` | rejected_candidate | 単体効果が弱く、`curly hair` / `natural curls`の方が安定するため自動適用対象外 |

## Relationship with existing metadata

- `category/subcategory`: ユーザーがタグを探すための表示分類
- `slot/conflicts`: 排他性と既知の禁止関係
- `promptGroup/promptOrder`: 最終Promptの安定した出力順
- `role/targetRegion`: 意味解析、展開、合成判断
- `parent/child expansion`: 補助タグの由来
- `source/canonical/redirect`: 辞書由来とID互換

Role Model導入時も既存フィールドを上書きせず、追加メタデータまたは独立したsemantic registryとして段階導入する想定です。
