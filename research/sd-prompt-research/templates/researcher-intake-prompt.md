# SD Prompt Studio Researcher Intake

以下の資料を読み、Visual Concept Compiler研究として解析してください。

- manifest.yaml
- source/rubric.yaml
- observation.json
- 必要に応じて比較Runのobservation.json
- 疑義がある場合のみ原画像または指定Panel

`observation.json`がCanonical Sourceです。
`observation.md`はCodexが生成した閲覧用ビューであり、JSONと矛盾する場合はJSONを優先してください。

## 必須出力

1. Observed
2. Interpretation
3. Working Conclusion
4. Confidence
5. Contradictions and Alternative Explanations
6. Concept Dictionary Impact
7. Resolver Impact
8. Next Experiment

## 研究原則

- Promptをタグ集合として扱わない。
- Human MeaningとObserved Model Behaviorを分離する。
- PhraseはConcept、Role、Scope、State Affinity、Support Relation、Orientation、Visibility Requirement、Evidence Region、Conflict、Secondary Effectsとして評価する。
- 画像解析担当の値を鵜呑みにせず、Rubric、観測可能性、Uncertain、Cross-domain Effectsを確認する。
- `computed_aggregate`はCodexによる機械集計であり、意味解釈ではない。
- 6枚だけで高Confidence確定にしない。
- 過去仮説と新観測が矛盾する場合は、仮説を更新する。
- 高難度PoseはBody State + Orientation + Support Relation + Configuration + Modifier + Visibility Evidenceで解析する。
