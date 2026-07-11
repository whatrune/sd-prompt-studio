# Prompt Engine 設計仕様（ドラフト）

> Status: Draft / Experimental  
> Target: SD Prompt Studio v21 以降  
> Purpose: 実装前レビュー用。現時点ではコードや辞書形式の変更を確定しない。

## 1. 背景

SD Prompt Studioは、日本語UIでタグを選び、Stable Diffusion向けの英語Promptを生成するPrompt Builderである。

従来は、各タグをほぼ独立した単語として扱い、次の情報を中心に管理してきた。

- 代表Prompt
- `aliases`（検索専用）
- `related`（関連候補専用）
- `slot`（競合判定）
- `layer` / `coverage`（衣装の占有関係）
- `generationNote`（生成上の実用メモ）

しかし、比較生成を重ねると、Promptは単純なタグ集合では説明しにくいことが分かった。完成概念を表すタグ、形状だけを補うタグ、現在の状態を加えるタグなどが異なる働きを持ち、組み合わせによって強化・変形・意味の混合が起きる。

本仕様では、この挙動を「厳密な自然言語文法」ではなく、**生成モデルが学習した概念同士の関係を扱うための意味構造**として整理する。

## 2. 設計目標

- 生成成功率の高い代表タグを中心にPromptを組み立てる。
- 完成概念を部品へ置換して壊さず、必要な補助だけ追加する。
- 同一カテゴリ内のタグを一律競合にしない。
- 競合、強化、意味変化、感情ブレンドを区別する。
- モデル差を前提とし、実験結果の確度と条件を保存できるようにする。
- Smart Tag Engineは勝手に選択せず、候補・警告・説明を提供する補助役とする。
- 既存の代表Prompt、`aliases`、`related`、`slot`を段階的に拡張できる設計にする。

## 3. 非目標

このドラフトでは、以下を確定しない。

- TypeScript型やJSONスキーマの最終形
- Prompt展開の自動実行
- タグの重みや順序の自動最適化
- モデル別の効果保証
- UIの最終レイアウト
- 既存辞書の一括移行
- 実験結果を普遍的なStable Diffusion仕様として断定すること

## 4. 基本概念

### 4.1 Core / Concept

対象そのもの、または完成した概念を表す代表タグ。

例:

- `maid outfit`
- `school uniform`
- `bob cut`
- `hime cut`
- `ponytail`
- `twintails`
- `single braid`
- `happy face`
- `smug face`

Coreは複数の視覚的特徴を内包する。原則として、展開時にもCoreを残す。

### 4.2 Attribute

対象の比較的安定した属性を表す。

例:

- `long hair`
- `short hair`
- `blue eyes`
- `black hair`

Attributeは対象を補足するが、それだけで完成概念を再構成できるとは限らない。

### 4.3 Structure / Component

対象の構造、部品、配置要素を表す。

例:

- `braid`
- `tied hair`
- `bangs`
- `sidelocks`
- `white apron`
- `maid headdress`

StructureはCoreの補強に使える一方、Structureだけを組み合わせても元のCoreと同じ結果にはならない場合が多い。

### 4.4 Modifier

Coreや他のタグの見え方、方向性、強度を変える修飾要素。

例:

- `smile`
- `smirk`
- `open mouth`
- `closed eyes`
- `one side tucked hair`

Modifierは常に中立ではない。`smirk`が表情を嘲笑・挑発寄りに変えるなど、意味方向のバイアスを持つ場合がある。

### 4.5 State

対象の現在状態を表し、Coreを保持したまま状態変化を加える。

例:

- `messy hair`
- `wet hair`
- `crying`
- `tears`

例: `bob cut + messy hair` は、ボブを別の髪型へ置換せず「ぼさぼさしたボブ」にする。

### 4.6 Texture / Shape

材質感、曲線、表面形状などを指定する。

例:

- `straight hair`
- `curly hair`
- `wavy hair`
- `natural curls`

髪型Coreとは別軸で働く可能性が高い。

### 4.7 Arrangement / Constraint

配置や制約を指定する。

例:

- `one side tucked hair`
- `symmetrical hair`
- `chin-length hair`

ConstraintはCoreを生成するものではなく、既存概念の揺れを抑える補助として扱う。

### 4.8 Effect

発光、輝き、粒子、光学表現など、対象や画面へ視覚効果を重ねる。

例:

- `glowing eyes`
- `sparkling eyes`

Effectは他要素と共存できるが、強いEffectが瞳孔形状などの細部を隠す可能性がある。

### 4.9 Variant

同じ上位概念に属するが、相互に独立した完成形。

例:

- `school uniform` のブレザー型とセーラー型
- `cosmic eyes` と `nebulae cosmic eyes`

Variantは単純な親子関係や補助関係とせず、選択肢として扱う。

## 5. Promptの意味構造

Promptを厳密な品詞文法として扱うのではなく、次のような意味レイヤーとして解釈する。

```text
Core
  + Attribute
  + Structure / Component
  + Texture / Shape
  + Arrangement / Constraint
  + State
  + Modifier
  + Effect
```

例:

```text
bob cut                 # Core
+ short hair            # Attribute
+ straight hair         # Texture
+ chin-length hair      # Constraint
+ messy hair            # State
+ one side tucked hair  # Arrangement
```

重要な原則は、**Coreから補助要素を推定できても、補助要素の集合からCoreを復元できるとは限らない**ことである。

```text
ponytail -> long hair + tied hair（概念上の分解は可能）
long hair + tied hair -> ponytail（生成結果としては保証されない）
```

## 6. Expansion設計

Expansionは、選択された代表タグを生成時に補助する仕組みである。関連候補を自動選択済みタグとして増やす機能とは分離する。

### 6.1 Atomic / None

代表タグだけを出力する。

適用例:

- 単体で十分安定するタグ
- 補助がモデル依存で確度不足のタグ
- ユーザーが簡潔なPromptを優先する場合

### 6.2 Append Support

Coreを残し、構成要素や属性を後ろへ追加する。

```text
maid outfit,
black dress,
white apron,
white frills,
maid headdress
```

完成概念を維持しながら、曖昧な部位を補強する。

### 6.3 Minimal Support

効果が明確な最小数の補助だけを追加する。

例:

```text
single braid,
long hair
```

タグ数を増やしすぎず、代表タグの弱点だけを補う。

### 6.4 Structural Support

Coreが内包する構造を明示して安定させる。

例:

```text
hime cut,
straight bangs,
long sidelocks
```

```text
bob cut,
short hair,
straight hair,
chin-length hair
```

### 6.5 State Overlay

Coreを維持したまま状態を重ねる。

```text
bob cut,
messy hair
```

StateはCoreの代替ではない。

### 6.6 Variant Selection

上位概念から派生形を選択する。

```text
school uniform
  -> blazer variant
  -> sailor variant
```

Variantは同時追加ではなく、原則として一つを選ぶ。

### 6.7 Replace

Coreを別表現へ置換する方式。概念喪失の危険が高いため、既定では使わない。モデル固有の実測で置換の方が明確に有効な場合のみ、将来の高度設定として検討する。

### 6.8 Expansionの原則

- 選択済み一覧には、ユーザーが選択した代表タグを表示する。
- Expansionで追加された補助は、内部の生成結果として区別する。
- `aliases`はPromptへ出力しない。
- `related`は候補表示専用で、自動追加しない。
- Expansion同士の重複を除去する。
- Expansion後にも競合判定を行う。
- モデルプロファイルがない場合は、安全な最小展開または展開なしを選ぶ。

## 7. Conflict / Interaction設計

### 7.1 Hard Conflict

同じ単一選択slotへ異なる値を指定し、同時成立が難しい組み合わせ。

例:

- 異なる基本髪色
- `open eyes` と `closed eyes` のような排他的な状態
- 単一の衣装占有範囲が重なる組み合わせ

既存の`slot`、`layer`、`coverage`を主に利用する。

### 7.2 Soft Conflict

同時指定は可能だが、一方が弱くなったり結果が不安定になったりする組み合わせ。

例:

- 特殊虹彩表現と細い瞳孔形状
- 強い目のEffectと瞳孔ディテール
- 複数の強い表情方向

警告対象にはできるが、追加は禁止しない。

### 7.3 Contextual Conflict

二つだけなら成立しても、三つ目の文脈で競合する組み合わせ。

観察例:

- `crying + closed eyes` は成立し得る。
- `sad eyes + closed eyes` は、目の感情表現と閉眼が競合しやすい。
- したがって `crying + sad eyes + closed eyes` は不安定になり得る。

ペアだけの静的競合表では表現しにくいため、条件付きルールが必要になる。

### 7.4 Support / Reinforcement

同じ方向を補強する組み合わせ。

例:

- `happy face + smile + happy eyes + closed eyes`
- `crying + tears`
- `bob cut + short hair + straight hair`

### 7.5 Semantic Shift

共存するが、結果の意味が変わる組み合わせ。

例:

- `smug face + smirk` は余裕のある表情から挑発・嘲笑寄りへ移る可能性がある。
- `angry face + open mouth` は怒りの強度や叫びのニュアンスを増す。

競合ではなく「意味変化」として説明する。

### 7.6 Blend

一見矛盾する要素が、新しい複合感情として成立する組み合わせ。

例:

- `crying + smile` は、嬉し泣き、安心による涙、感情が溢れた表情へ寄ることがある。

BlendをHard Conflictとして扱わない。

### 7.7 競合判定の順序

1. ユーザーが直接選択したタグ同士を判定する。
2. Expansionを解決する。
3. Expansionによって追加されたタグを含めて再判定する。
4. 重複を除去する。
5. Hard Conflict、Soft Conflict、Semantic Shift、Blendを区別して結果を返す。
6. UIは設定に応じて簡潔な警告または詳細説明を表示する。

メインUIの既定警告は既存方針を維持し、簡潔にする。

```text
競合しています。
そのまま追加しますか？
```

内部では理由を保持しても、常に画面へ長文表示する必要はない。

## 8. 実験から得られた知見

以下は特定のモデル・設定・画像比較に基づく観察であり、全モデルでの保証ではない。

### 8.1 衣装

- `maid outfit` は単体でも完成概念として強い。
- `maid outfit + black dress + white apron` のようにCoreを残して部品を補うと安定しやすい。
- 部品だけへ置換すると、メイド服という完成概念が弱まる可能性がある。
- `school uniform` もCoreとして扱い、ブレザー型・セーラー型はVariantとして管理するのが自然。

### 8.2 髪型Core

#### bob cut

- `bob cut` 単体で、長さ、丸いシルエット、後ろ髪のラインが比較的安定した。
- `short hair + straight hair` は短いストレートヘアにはなるが、ボブ特有の後ろ髪や輪郭が揺れた。
- `bob cut + short hair + straight hair` はボブを維持しつつ補強した。
- `chin-length hair` は必須ではないが、長さ制約として揺れを減らす可能性がある。

#### ponytail

- `ponytail` は結束位置と尻尾状の束を含む完成構造として働いた。
- `long hair + tied hair` は「束ねた長髪」になり、ポニーテールを再現しなかった。
- `ponytail + long hair + tied hair` はCoreを保持して長さと結束感を補強した。

#### twintails

- `twintails` は左右二本の完成構造として働いた。
- `long hair + tied hair + symmetrical hair` だけでは、典型的なツインテールを再現しなかった。
- `double tied hair` は二箇所の結束構造を示すが、それ単体でツインテールを保証しない。
- Coreを残した上での`tied hair`や対称性指定は補助として働く。

#### single braid

- `single braid` は一本の三つ編みという完成構造として働いた。
- `long hair + braid + tied hair` は編んだ長髪にはなるが、一本三つ編みの配置が揺れた。
- `single braid + long hair + braid + tied hair` はCoreを維持しながら構造を補強した。

#### hime cut

- `hime cut` は完成概念として扱う。
- `straight bangs`と`long sidelocks`は構造補助として有望。

### 8.3 髪の状態・質感・配置

- `bob cut + messy hair` は「ぼさぼさしたボブ」になり、`messy hair`がStateとして働くことを示した。
- `long hair + loose hair + uneven hair` は`messy hair`の代替にならず、比較的整った下ろし髪になった。
- `curly hair`、`wavy hair`、`natural curls`はボブへ質感・形状変化を加えた。
- `loose curls`は単体でもボブとの組み合わせでも目立つ変化がなく、現時点では採用優先度が低い。
- `one side tucked hair`はボブにも作用し、Arrangementとして扱える。
- `flowing hair`、`windblown hair`などのMotion系は未検証。

### 8.4 目

- 目には少なくともColor、Pupil、Iris Style、Effectの別軸がある。
- 目の色と`slit pupils`は共存した。
- `cosmic eyes`や`nebulae cosmic eyes`は特殊虹彩の完成概念またはVariantとして扱うのが自然。
- 特殊虹彩は色や発光を内包し、瞳孔形状の明瞭さを下げる可能性がある。
- `heart pupils`はピンク・可愛さ・感情表現のバイアスを持つ可能性があるが、特殊虹彩と共存した例がある。
- `glowing eyes`や`sparkling eyes`はEffectとして共存し得るが、細い瞳孔形状を隠す可能性がある。
- `star-shaped highlights`は期待した目のハイライトではなく頭部装飾へ寄った例があり、辞書採用には再検証が必要。

### 8.5 表情

- `happy face`、`sad face`、`angry face`、`smug face`は表情Core候補。
- `smile`、`smirk`、`open mouth`、`closed eyes`、眉・目の感情タグはModifier候補。
- `crying`は感情状態として複数部位へ作用し、`tears`はそれを補強する。
- `happy face + smile + happy eyes + closed eyes`は同方向の補強として自然な笑顔になった。
- `raised eyebrows`は幸福より驚き・関心へ寄せる可能性がある。
- `crying + smile`は単純競合ではなく、安心・嬉し泣きに近いBlendとして成立した。
- `crying + closed eyes`は成立したが、`sad eyes + closed eyes`は目の表現として競合しやすい。

## 9. データモデル案

以下は概念検討用であり、実装型ではない。

```ts
type SemanticRole =
  | "core"
  | "attribute"
  | "structure"
  | "modifier"
  | "state"
  | "texture"
  | "arrangement"
  | "constraint"
  | "effect"
  | "variant";

type InteractionKind =
  | "hard_conflict"
  | "soft_conflict"
  | "support"
  | "semantic_shift"
  | "blend";

interface PromptTagDraft {
  id: string;
  label: string;
  prompt: string;

  category: string;
  subcategory?: string;

  slot?: string;
  layer?: string;
  coverage?: string[];

  aliases?: string[];
  related?: string[];
  generationNote?: string;

  semanticRole?: SemanticRole;
  affects?: string[];

  expansion?: {
    mode:
      | "none"
      | "append_support"
      | "minimal_support"
      | "structural_support"
      | "state_overlay"
      | "variant"
      | "replace";
    tags?: string[];
  };

  interactions?: Array<{
    with: string[];
    kind: InteractionKind;
    condition?: string;
    note?: string;
  }>;

  evidence?: {
    status: "hypothesis" | "observed" | "reproduced" | "verified";
    model?: string;
    sampleCount?: number;
    note?: string;
  };
}
```

### 9.1 `affects`

一つのタグが複数部位へ作用することを表す。

例:

```text
crying
-> eyes
-> mouth
-> expression
-> tears
```

単一の`slot`だけでは表現できない影響範囲に利用する。

### 9.2 Evidence Status

- `hypothesis`: 会話や一例から得た仮説
- `observed`: 比較実験で観察した
- `reproduced`: 条件を変えて複数回再現した
- `verified`: 採用対象モデルで基準を満たした

辞書の一般公開タグには、少なくとも`observed`以上を求める方針を検討する。

## 10. Prompt解決パイプライン案

```text
1. ユーザー選択を受け取る
2. 代表タグと辞書メタデータを解決する
3. 直接選択間の競合・相互作用を評価する
4. モデルプロファイルと設定からExpansionを決める
5. 補助タグを内部的に追加する
6. 重複を除去する
7. Expansion後の競合・意味変化・Blendを再評価する
8. 既存のPromptグループと出力順へ配置する
9. Promptをレンダリングする
10. UIへ警告、候補、生成メモを返す
```

重要事項:

- 小カテゴリ再編によって新しいPromptグループを作らない。
- UIの分類とPrompt出力グループは別概念として扱う。
- 既存のPrompt順を維持する。
- Expansionは選択履歴を汚さない。
- ユーザーは最終Promptを編集できる。

## 11. 実験プロトコル案

今後の検証は、印象だけでなく再現可能な記録へ寄せる。

### 11.1 固定条件

- モデル名とハッシュ
- VAE
- Sampler / Scheduler
- Steps
- CFG
- 解像度
- Seed
- Batch size / Batch count
- Positive Prompt
- Negative Prompt
- 使用UIまたは生成環境

### 11.2 比較方式

基本はA/B/C比較とする。

- A: Coreのみ
- B: 分解・補助のみ
- C: Core + 補助

状態やModifierの検証では次の形式も使う。

- A: Modifierのみ
- B: 分解候補
- C: Core + Modifier

### 11.3 Seed

- 因果比較では同一Seedを使用する。
- 安定性確認では複数Seedを使用する。
- 一枚の成功例だけで採用を決めない。

### 11.4 記録項目

- 期待した変化
- 実際の変化
- Coreの維持率
- 副作用
- 競合
- モデル依存の疑い
- 採用、保留、削除候補

## 12. UIへの将来反映

本ドラフトはUI実装を確定しないが、将来は次の表示が有用と考えられる。

- 代表タグ
- 役割（Core / State / Textureなど）
- 補助候補
- Variant
- 生成メモ
- 競合または意味変化の簡潔な警告
- 実験済みモデル
- Expansionのプレビュー

Smart Tag Engineは、次の区別を保つ。

- 競合: 同時指定が難しい
- 注意: 不安定または一方が弱くなる
- 補強: 同じ方向へ強くする
- 変化: 意味や印象が変わる
- 合成: 新しい複合表現になる

## 13. 未解決事項

- Core、State、Modifierを全カテゴリ共通語彙にするか、カテゴリ別語彙にするか。
- 一つのタグが複数Roleを持つ場合の表現方法。
- `crying`のような広範囲タグをCoreとStateのどちらへ置くか。
- Expansionをモデル別にどの粒度で持つか。
- タグ順序と重みが相互作用へ与える影響。
- VariantとConflictの境界。
- `affects`と既存`slot`の役割分担。
- 実験証拠を本体辞書へ含めるか、別ファイルへ分離するか。
- 髪のMotion、体型、ポーズ、カメラ、ライティング、奥行きで同じ意味構造が成立するか。
- 成人向けポーズと行動の分類でも、静的姿勢と動作の文法が有効か。
- モデル間で結果が反転した場合の既定動作。

## 14. 次の検証候補

優先順の案:

1. Hair Motion
   - `flowing hair`
   - `windblown hair`
   - `floating hair`
2. Body / Proportion
   - `petite`
   - `slim`
   - `curvy`
   - `tall`
3. Pose / Action
   - `standing`
   - `sitting`
   - 手足の配置
   - 静止姿勢と動作の境界
4. Camera
   - shot type
   - view
   - angle
   - lens
5. Lighting / Depth / Effect
   - 光源、方向、色
   - 被写界深度
   - 前景・背景ぼかし
   - 光学効果

## 15. 実装開始前のレビュー項目

- 用語がユーザー向けと開発向けで混線していないか。
- Coreを残す原則に例外が必要か。
- Expansionと`related`の違いが明確か。
- ConflictとSemantic ShiftとBlendを機械的に判別できるか。
- 既存の`slot`、`layer`、`coverage`を壊さず拡張できるか。
- PromptグループとUIカテゴリを分離できているか。
- 実験結果をモデル固有の観察として扱えているか。
- 最小構成から段階導入できるか。

## 16. 段階導入案

### Phase 1: 記録のみ

- 辞書形式は変更しない。
- 実験結果を別ドキュメントまたは検証データへ記録する。
- 用語と判定基準を固める。

### Phase 2: メタデータ追加

- 一部タグに`semanticRole`、`affects`、Evidenceを試験追加する。
- 既存動作へ影響させない。

### Phase 3: 読み取り専用の提案

- Expansion候補と相互作用をUIへプレビュー表示する。
- 自動追加しない。

### Phase 4: オプトイン展開

- ユーザー設定でExpansionを有効化する。
- 元の代表タグを保持する。
- 最終Promptを必ず確認・編集できるようにする。

### Phase 5: モデルプロファイル

- 実測に基づくモデル別Expansionと注意を導入する。
- 未知モデルでは安全側へフォールバックする。

---

この文書は、実験の進行に合わせて更新する生きた設計書とする。観察結果と設計判断を混同せず、再現性が確認できたものから段階的に仕様へ昇格させる。
