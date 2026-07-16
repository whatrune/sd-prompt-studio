# Research Experiment Data Structure

この文書は、BRG-009以降のExperiment Runで使用する研究データの保存責務とGit管理境界を定義する。Observation Schema、Research Claim Schema、各Validatorの仕様は変更しない。

## 1. データ層の分離

研究データは次の層を混在させない。

1. **Generation / Experiment**: 生成条件と再現情報。
2. **Observation**: 画像から直接確認できる観測事実。
3. **Research Review**: 仮説、解釈候補、不確実性、次回実験案。
4. **Research Claim Staging**: Review済み候補をConcept Graphへ接続する前の構造化Claim。

ObservationからResearch Claimへ自動昇格しない。`research-review.md`もClaimそのものではない。

## 2. Experiment Run

Experiment Runは1つの生成条件を表す実験単位である。同じ比較Experimentに複数条件がある場合も、`BRG-009-A`、`BRG-009-B`のように各条件を独立したRunとして保存し、Run IDを後から変更しない。

標準構造:

```text
experiments/{domain}/{run_id}/
├─ manifest.yaml
├─ observation.json
├─ observation.md
├─ research-review.md
├─ aggregate.json                 # Pipelineが別ファイルとして生成する場合のみ
├─ source/
│  ├─ {run_id}_metadata.yaml
│  ├─ rubric.yaml
│  └─ {run_id}_sheet.png
├─ panels/
└─ preview/
```

現在のObservation Pipelineは集計値を`observation.json`の`computed_aggregate`へ保存しており、BRG-009には独立した`aggregate.json`は存在しない。将来Pipelineが`aggregate.json`を生成する場合、そのファイルはGit管理対象とするが、本方針だけを理由に重複ファイルを作らない。

## 3. ファイルごとの責務

### `manifest.yaml`

生成条件とRun管理情報を保持する。Model、Prompt、Negative Prompt、Sampler、Scheduler、Steps、CFG、画像サイズ、Seed、source参照、出力参照、Run statusを再現情報として保存する。

### `observation.json`

Observation Schema v3.0準拠の機械可読な観測結果である。Visible Evidence、Ontology値、不確実性、機械集計を保存し、研究結論を保存しない。

### `observation.md`

観測事実を人間が確認するための表示・記録である。`observation.json`の内容を読みやすく提示してよいが、観測値から直接導いた因果・優劣・成功判定を書かない。

許可:

> 5 / 6 panels showed arm support morphology.

禁止:

> arm support improves stability.

前者は観測件数、後者は観測だけでは確定できない研究解釈である。

### `research-review.md`

研究者による考察メモである。仮説、次回実験案、不確実性、解釈候補を記録できる。ただしResearch Claim YAMLへ昇格する前段階であり、Claim Schema準拠RecordやConcept Graphの確定知識として扱わない。

### `run-index.yaml`

Run ID、domain、status、更新時刻、Run pathの索引である。`manifest.yaml`のstatusとpathに同期させる。

## 4. Git管理方針

### Git管理対象

- `manifest.yaml`
- `observation.json`
- Schemaで構成されたOptional Module観測ファイル（例: `face-observation.json`）
- `observation.md`
- `research-review.md`
- `aggregate.json`（Pipelineが生成する場合）
- `ledgers/run-index.yaml`
- `knowledge/`以下のResearch Claim関連YAML
- `source/`内のPrompt、Workflow、Rubric、Model、Sampler、Seed、Generation Metadataなどの再現情報

### Git管理対象外

- 元sheetを含む生成画像
- 分割Panel画像
- Preview画像
- 一時生成物
- Cache
- PDF検査用の一時レンダリング画像

`.gitignore`は未追跡ファイルに対する既定値であり、すでにGit管理されている画像を自動削除しない。既存画像をGit管理から外す場合は、別Migrationとして参照先、外部保存先、checksum、復元手順を先に定義する。

## 5. `source/`の分類

`source/`全体を一律にignoreしない。内容の責務で分類する。

| 分類 | 内容 | Git方針 |
|---|---|---|
| A: 研究再現データ | Prompt、Workflow、Rubric、Model設定、Sampler、Seed、Generation Metadata | 管理する |
| B: 生成物・Cache | 元sheet画像、中間画像、一時変換物、Cache | 管理しない |
| C: 外部Storage候補 | サイズの大きい元画像、Panel画像、Preview画像 | 将来移動候補。現時点では削除しない |

外部Storageへ移動する場合も、Run側には安定した参照、content hash、media type、保存先種別を保持し、観測Evidenceを再確認できる状態を維持する。

## 6. BRG-009 source監査例

BRG-009-A〜Eの各`source/`には次の3種類が存在する。

- `{run_id}_metadata.yaml`: 約3 KB。Prompt、Negative Prompt、生成設定、Seed、Model情報を含む。分類A。
- `rubric.yaml`: 約13 KB。Observation axis、allowed values、Evidence Policyを含む。分類A。
- `{run_id}_sheet.png`: 約5〜6 MB。6-panel元生成画像。分類Bであり、容量と再配置可能性の観点では分類Cの候補。

`panels/`と`preview/`は生成画像派生物であり、分類Bかつ分類C候補である。今回の整理では既存ファイルを削除・移動しない。

## 7. Run確定時の確認

1. `manifest.yaml`が存在し、Run IDとpathが一致する。
2. `observation.json`が指定SchemaとRubricを通過する。
3. `observation.md`が観測事実のみを表示する。
4. `research-review.md`が存在し、ObservationとResearch Interpretationを混在させない。
5. `run-index.yaml`のstatus、更新時刻、pathをmanifestへ同期する。
6. source再現情報はGit管理し、画像と一時生成物はignoreする。
7. Run ID、既存観測値、既存画像を破壊的に変更しない。
