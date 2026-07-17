# Research Experiment Rules

## 1. Prompt出力ルール

-   Promptは常に全文出力する
-   差分Promptは禁止する
-   Conditionごとに独立したPromptを保持する
-   Prompt本文は1行形式で保存する
-   Phrase順序は研究対象として保持する
-   Raw Prompt文字列を保存する

## 2. Seedルール

### Default Seed

``` yaml
default_base_seed: 424242
```

指定がない場合はこの値を使用する。

### Batch生成

複数枚生成時は以下として扱う。

``` yaml
seed_mode: fixed_batch
base_seed: 424242
derivation: sequential
```

例：

  Panel   Seed
  ------- --------
  1       424242
  2       424243
  3       424244
  4       424245
  5       424246
  6       424247

## 3. Seed固定の解釈

Seed固定とは全画像が同一になることではない。

-   Base seedを固定する
-   Batch内各画像は派生seedを使用する
-   同一設定で同一画像セットを再現可能にする

## 4. 比較実験ルール

Phrase比較実験では以下を固定する。

-   Checkpoint
-   Sampler
-   Scheduler
-   Steps
-   CFG
-   Resolution
-   Seed設定
-   Batch枚数
-   Camera条件

変更対象は検証対象Phraseのみとする。

## 5. Experiment Control記録

``` yaml
experiment_controls:
  seed:
    base_seed:
    mode:
    derivation:

  camera:
    fixed:
    values:

  generation:
    checkpoint:
    sampler:
    steps:
    cfg:
    resolution:
```

## 6. Cameraルール

CameraはPrompt要素であると同時に実験制御条件として扱う。

記録対象：

-   framing
-   angle
-   view direction
-   camera fixed / variable

Cameraが固定されていない比較では、結果をPrompt単独の影響として確定しない。

## 7. Prompt Provenance

将来的にPromptを構造化保存する。

``` yaml
prompt_provenance:
  phrases:
    - text:
      category:
      position:
```

目的：

-   Phrase順序研究
-   Prompt Influence Graph生成
-   Prompt Compiler改善
-   Resolver分析

## 8. 比較結果の信頼度

Prompt影響評価では以下を考慮する。

-   Seed固定状態
-   Camera固定状態
-   Condition数
-   Sample数
-   Prompt差分範囲

条件不足時は因果効果ではなく観測傾向として扱う。

## 9. 研究データ保存方針

-   Image Artifact: 実画像保存
-   Manifest: Run情報保存
-   Prompt Provenance: Prompt構造保存
-   Observation: Visible Evidence保存
-   Research Review: 品質確認

研究判断はObservation層へ混在させない。
