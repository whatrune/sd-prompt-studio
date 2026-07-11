# Prompt Experiment Log — Draft

Smart Prompt Engineの規則候補を検証するための実験ログです。現時点の記録はユーザー検証結果の整理であり、model/checkpointや試行条件が未記録の項目は`provisional`として扱います。

## Log schema

```yaml
- id: EXP-YYYY-NNN
  date: YYYY-MM-DD
  status: provisional | reproduced | rejected
  model_family: unknown
  checkpoint: unknown
  seed: unknown
  sampler: unknown
  steps: unknown
  cfg: unknown
  resolution: unknown
  sample_count: unknown
  original_tag: ""
  tested_prompt: ""
  result_summary: ""
  observed_meaning: []
  effective_tags: []
  failed_tags: []
  suggested_role: ""
  concept_strength: unknown # high | medium | low | unknown
  expansion_candidate: []
  conflict_candidate: []
  side_effects: []
  notes: ""
```

### Required review rules

- Original Tagを除いた実験と残した実験を区別する。
- `effective_tags`は因果が確定したことを意味せず、その試行で有効に見えたタグを記録する。
- `observed_meaning`には、効いたかどうかだけでなく、生成結果がどの意味へ変換されたかを記録する。
- `concept_strength`はCore Conceptの相対的な自立性・再現力を将来評価するための追加候補とする。既存実験へ一括適用せず、根拠が揃った記録だけに`high`、`medium`、`low`を設定する。
- `failed_tags`はタグ自体の恒久的無効を意味せず、対象モデルと条件を記録する。
- 自動展開候補への採用には複数試行、反証例、副作用の確認を必要とする。
- 感情Modifierは成功/失敗だけでなく、どの方向へ意味が変化したかを記録する。

## Current experiment records

### EXP-HAIR-001 — bob cut support

- Original Tag: `bob cut`
- Tested Prompt: `bob cut + short hair + straight hair`
- Result Summary: ボブの再現が安定した。
- Effective Tags: `bob cut`, `short hair`, `straight hair`
- Failed Tags: なし
- Suggested Role: Core Concept
- Expansion Candidate: `short hair` (`concept_support`), `straight hair` (`feature_support`)
- Conflict Candidate: なし
- Status: provisional

### EXP-HAIR-002 — ponytail decomposition

- Original Tag: `ponytail`
- Tested Prompt: `long hair + tied hair`
- Result Summary: 特徴タグだけではポニーテールにならなかった。
- Effective Tags: `ponytail`を保持する必要あり
- Failed Tags: `long hair + tied hair`による置換
- Suggested Role: Core Concept
- Expansion Candidate: `long hair`, `tied hair`は補助候補
- Conflict Candidate: なし
- Status: provisional

### EXP-HAIR-003 — twintails decomposition

- Original Tag: `twintails`
- Tested Prompt: `long hair + tied hair + symmetrical hair`
- Result Summary: 特徴タグだけではtwintailsを再現できなかった。
- Effective Tags: `twintails`を保持する必要あり
- Failed Tags: 特徴タグによる置換
- Suggested Role: Core Concept
- Expansion Candidate: 特徴タグは補助候補としてのみ検討
- Conflict Candidate: なし
- Status: provisional

### EXP-HAIR-004 — single braid decomposition

- Original Tag: `single braid`
- Tested Prompt: `long hair + braid + tied hair`
- Result Summary: 特徴タグだけでは不十分だった。
- Effective Tags: `single braid`
- Failed Tags: `long hair + braid + tied hair`による置換
- Suggested Role: Core Concept
- Expansion Candidate: `long hair`, `braid`, `tied hair`は補助候補
- Conflict Candidate: なし
- Status: provisional

### EXP-HAIR-005 — messy bob composition

- Original Tag: `messy hair`
- Tested Prompt: `bob cut + messy hair`
- Result Summary: ぼさぼさしたボブとして合成された。
- Effective Tags: `bob cut`, `messy hair`
- Failed Tags: なし
- Suggested Role: State
- Expansion Candidate: `messy hair` (`state_modifier`、明示選択時)
- Conflict Candidate: なし。Core + Stateは共存。
- Status: provisional

### EXP-HAIR-006 — curl vocabulary

- Original Tag: `curly hair`, `wavy hair`, `natural curls`, `loose curls`
- Tested Prompt: 各Texture / Shapeタグ
- Result Summary: `curly hair`, `wavy hair`, `natural curls`は形状表現。`loose curls`は現時点で効果が弱い。
- Observed Meaning: `loose curls`単体では明確な追加意味を確認できない
- Effective Tags: `curly hair`, `wavy hair`, `natural curls`
- Failed Tags: `loose curls`（現条件）
- Suggested Role: Texture / Shape
- Expansion Candidate: `loose curls`は`rejected_candidate`として記録
- Conflict Candidate: Texture同士の排他性は未確定
- Status: provisional

### EXP-EYE-001 — independent eye regions

- Original Tag: `blue eyes`, `slit pupils`, `cosmic eyes`
- Tested Prompt: `blue eyes + slit pupils + cosmic eyes`
- Result Summary: Color、Pupil、Iris Styleとして共存可能と判断。
- Effective Tags: 全タグ
- Failed Tags: なし
- Suggested Role: Attribute / Structure / Core Concept
- Expansion Candidate: なし
- Conflict Candidate: hard conflictなし
- Status: provisional

### EXP-EYE-002 — nebula iris and color

- Original Tag: `nebulae cosmic eyes`
- Tested Prompt: `nebulae cosmic eyes + eye color`
- Result Summary: Iris Styleが色指定を内包または上書きする可能性がある。
- Effective Tags: 未確定
- Failed Tags: 未確定
- Suggested Role: Core Concept
- Expansion Candidate: なし
- Conflict Candidate: warning候補
- Status: provisional

### EXP-EYE-003 — highlight target ambiguity

- Original Tag: `star-shaped highlights`
- Tested Prompt: `star-shaped highlights`
- Result Summary: 目のハイライトではなく装飾寄りに出る可能性がある。
- Effective Tags: 未確定
- Failed Tags: 未確定
- Suggested Role: EffectまたはDecoration（未確定）
- Expansion Candidate: 自動適用しない
- Conflict Candidate: `no highlights`との関係を再検証
- Status: provisional

### EXP-EXPR-001 — smug modifier

- Original Tag: `smug face`
- Tested Prompt: `smug face + smirk`
- Result Summary: 嘲笑寄りへ意味が変化する可能性がある。
- Observed Meaning: `teasing smile`, `mocking expression`
- Effective Tags: `smug face`, `smirk`
- Failed Tags: なし
- Suggested Role: Core Concept + Modifier
- Expansion Candidate: `smirk`は自動追加せず意味方向をPreview
- Conflict Candidate: composed
- Status: provisional

### EXP-EXPR-002 — crying with smile

- Original Tag: `crying`
- Tested Prompt: `crying + smile`
- Result Summary: 嬉し泣き、安心して泣く方向へ変化する。
- Observed Meaning: `happy tears`, `relief crying`
- Effective Tags: `crying`, `smile`
- Failed Tags: なし
- Suggested Role: State + Modifier
- Expansion Candidate: なし
- Conflict Candidate: hard conflictではなくcomposed
- Status: provisional

### EXP-EXPR-003 — natural happy face

- Original Tag: `happy face`
- Tested Prompt: `happy face + smile + happy eyes + closed eyes`
- Result Summary: 自然な笑顔になる。
- Observed Meaning: `natural happy smile`
- Effective Tags: 全タグ
- Failed Tags: なし
- Suggested Role: Core Concept + Modifiers
- Expansion Candidate: `smile`, `happy eyes`, `closed eyes`は補助候補。ただし自動適用は未確定。
- Conflict Candidate: 目状態の組み合わせを確認
- Status: provisional

### EXP-EXPR-004 — stacked sad state

- Original Tag: `crying`
- Tested Prompt: `crying + sad eyes + closed eyes`
- Result Summary: 同方向の重複強調と、閉眼による目表現の不可視化が起こる可能性。
- Observed Meaning: `intensified sadness`、目の感情情報が閉眼で弱まる可能性
- Effective Tags: 未確定
- Failed Tags: 未確定
- Suggested Role: State + Modifiers
- Expansion Candidate: なし
- Conflict Candidate: warning候補
- Status: provisional

## Planned experiments

### Hair Motion

- `flowing hair`
- `windblown hair`

確認事項: State / Motion / Effectのどれとして扱うか、静的hairstyle Coreとの共存、Cameraや風Sceneタグへの依存。

### Body / Proportion

AttributeとCore Conceptの境界、複数部位への作用、weightによる過剰強調を検証する。

### Pose

body_posture、locomotion、部位動作、複合Poseの分解可否と、Core Poseを残す必要性を検証する。

### Camera

Scene作用、Character position、複数被写体、構図タグとの競合・優先順を検証する。
