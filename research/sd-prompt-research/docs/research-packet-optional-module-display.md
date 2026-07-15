# Research Packet Optional Module Display

## Purpose

Research PacketのOptional Module表示は、Face、Hair、Clothing、Camera、ObjectなどのModuleが増えても、同じ表示規約を利用する。

PDFは観測済みデータを提示する表示層であり、Module AggregateやCross-condition Countsから研究解釈を生成しない。

## Optional Module Aggregate template

各RunのOptional Module Aggregateは次の共通構造を使用する。

```text
Optional {Module} Module Aggregate
(Observation Layer Only)

This module contains visible-state observations only.
It does not infer:
- Prompt effect
- Intent
- Emotion meaning
- Success / failure judgment
It records:
- Visible geometry
- Orientation
- State
- Visibility

Metric | Counts
```

Module固有のデータ取得処理は、表示処理へ次を渡す。

- Module label
- Optional observation payload
- payload内のobservation key
- `computed_aggregate.axis_counts`
- `panel_count`
- 表示順を定める`active_axis_order`

表示処理は集計値を再計算せず、各値を`X / panel_count`形式で表示する。

## Module Cross-condition Counts template

条件間比較はModule共通の縦型表示を使用する。

```text
Module Cross-condition Counts

Module: {Module}

Metric: {metric}

{Run ID}
- {state}: X / panel_count
```

複数Metricは読みやすいページ単位へ安定した順序で分割する。値がないstateは表示せず、全stateが空の場合のみ`none observed`と表示する。Moduleが有効でないRunは`not enabled`と表示する。

## Responsibility boundary

Optional Module表示に含めるObservation Layerは次の範囲とする。

- visible state
- geometry
- contact
- visibility
- orientation

次のResearch InterpretationはPDFのOptional Module AggregateおよびModule Cross-condition Countsへ混在させない。

- Phrase effect
- Concept meaning
- Emotion meaning
- Intent
- Resolver impact

Research Interpretationは観測データとは別工程で扱う。

## Future design note: gaze_visibility

Face Moduleの将来追加候補として、次のAxisを記録する。

```text
gaze_visibility:
- visible
- partially_visible
- not_visible
- unclear
```

目的は、`face_visibility`低下に伴って`gaze_direction`が`not_visible`になった場合に、視線状態の変化と観測不能を分離できるようにすることである。

今回は設計候補の記録のみとし、Schema、Validator、Aggregate、Image Analyst、既存Runデータ、PDFのMetric一覧には追加しない。
