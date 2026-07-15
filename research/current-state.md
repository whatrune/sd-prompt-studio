# SD Prompt Studio

## Visual Concept Compiler Current State Update

更新日：2026-07-15

------------------------------------------------------------------------

## 23. Current Development Status

SD Prompt Studioは単純なPrompt Generatorではなく、 Visual Concept
Compilerとして開発している。

現在の処理思想：

Human Intent ↓ Visual Concept Analysis ↓ Concept Graph Construction ↓
Constraint / Relation / Visibility Resolution ↓ Prompt Rendering

------------------------------------------------------------------------

## 24. Research Pipeline Status

正式フロー：

Experiment Design ↓ Stable Diffusion Generation ↓ Image Analyst ↓
Observation JSON ↓ Codex Validation / Organization ↓ Research AI
Analysis ↓ Concept Dictionary Update ↓ Resolver Update

------------------------------------------------------------------------

## 25. Image Analyst Status

Image Analyst v1完成。

担当：

-   画像観察
-   JSON化
-   不確実性記録
-   Artifact記録
-   Cross-domain Effect記録

担当外：

-   研究結論
-   Concept確定
-   Resolver設計

出力：

`{run_id}_observation.json`

------------------------------------------------------------------------

## 26. Observation Schema Status

Observation JSON Schema v3完成。

対応：

-   Body State
-   Orientation
-   Support Relation
-   Contact
-   Contact Load
-   Morphology
-   Leakage
-   Artifact
-   Cross-domain Effects
-   Uncertainty

Aggregate生成はCodex担当。

------------------------------------------------------------------------

## 27. Codex Integration Status

Codex担当：

-   Run整理
-   JSON検証
-   Manifest管理
-   Aggregate生成
-   Research Review管理

担当外：

-   Pose解釈
-   Concept判断
-   仮説生成

------------------------------------------------------------------------

## 28. BRG-006 Pipeline Test

BRG-006にて以下を確認。

-   Run作成
-   rubric生成
-   Image Analyst解析
-   observation.json生成
-   Codex aggregate生成

研究データ形式への移行確認済み。

------------------------------------------------------------------------

## 29. Current Research Hypothesis

Bridge系Phraseは単一Pose Conceptではなく、
複数Conceptへ分岐する可能性が高い。

観測された分岐：

-   kneeling_backbend
-   reverse_quadruped
-   supine_bridge_like
-   reclined_arm_support

現在の仮説：

Bridge安定化には、

-   Body State
-   Orientation
-   Support Relation
-   Contact Load

の明示が重要。

------------------------------------------------------------------------

## 30. Next Tasks

優先：

1.  import_observation.py作成

目的：

observation.json ↓ Run配置 ↓ Schema Validation ↓ Manifest Update

2.  BRG-006 Research Review作成

形式：

Observed ↓ Interpretation ↓ Working Conclusion ↓ Concept Dictionary
Impact ↓ Resolver Impact

3.  Bridge Resolver研究再開

次候補：

BRG-007 Arm Support Ablation Test

目的：

arm supportがBridge成立要素か、 reverse_quadruped誘発要素か確認する。

------------------------------------------------------------------------

## 31. Next担当者への重要メッセージ

このプロジェクトはタグ辞書作成ではない。

必ず：

Observed ↓ Interpretation ↓ Working Conclusion

の順で研究する。

見るべき項目：

-   Human Meaning
-   Observed Model Behavior
-   Concept Type
-   Role
-   Scope
-   Support Relation
-   Conflict
-   Secondary Effects
-   Stability

最終目的：

Visual Concept Graph + Constraint Resolver + Model Adapter

を持つVisual Concept Compilerの構築。

END
