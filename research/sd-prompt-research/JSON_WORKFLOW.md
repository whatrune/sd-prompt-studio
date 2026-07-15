# Observation JSON Workflow v4

## Canonical Source

- `observation.json`: 正式な画像観察データ
- `observation.md`: JSONから生成する閲覧用ビュー
- `source/rubric.yaml`: 観察軸・許可値・順序

## 手順

1. 画像解析ChatGPTへ以下を渡す。
   - `source/<RUN_ID>_sheet.png`
   - `source/rubric.yaml`
   - Condition名
2. 画像解析ChatGPTから返った1つの`json`コードブロックの中身を`observation.json`へ保存する。
3. 検証・集計する。

```powershell
python scripts\finalize_observation.py --run-dir experiments\bridge\BRG-001
```

4. 必要な場合だけMarkdownを生成する。

```powershell
python scripts\render_observation_md.py --run-dir experiments\bridge\BRG-001
```

5. 研究担当ChatGPTへ以下を渡す。
   - `manifest.yaml`
   - `source/rubric.yaml`
   - `observation.json`

## finalize_observation.pyの処理

- JSON Schema検証
- Run IDとConditionの一致確認
- `active_axis_order`とRubric順の一致確認
- 全Panelの値数・許可値チェック
- Morphology、Artifact、Cross-domain Effectsの許可値チェック
- `computed_aggregate`自動生成
- Run statusを`OBSERVED`へ更新

## 注意

- 画像解析ChatGPTは`computed_aggregate`を書かない。
- `target_like / partial / failure`は画像解析JSONへ含めない。
- JSONにMarkdownコードフェンスが残っていても、finalizeスクリプトは除去して読み取れる。
