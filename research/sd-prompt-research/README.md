# SD Prompt Studio Research Operations

Stable Diffusion用の単純なPrompt Generatorではなく、Visual Concept Compilerを研究するためのローカル運用基盤です。

## 担当

### わたるん

- 研究責任者
- Stable Diffusionでの画像生成
- 実験条件の最終確認
- 人間による違和感・Artifact・成功基準のレビュー
- 仮説とConcept Dictionary更新の最終承認

### Codex

- `inbox`からの画像取込み
- 6枚一体画像の安全な分割
- Runフォルダ、manifest、rubric、レポート雛形の作成
- ステータス管理
- レポート、Ledger、Git管理の補助
- 研究結論は勝手に確定しない

### 画像解析ChatGPT

- 6枚画像の観察
- Panel別ラベリング
- Support、Orientation、Configuration、Visibility Evidenceの記録
- 6枚中の観測数集計
- 不明な箇所を`unclear`として残す
- **Observedまでを担当**し、Concept分類を確定しない

### 研究担当ChatGPT

- manifest、rubric、observationの統合
- **Observed → Interpretation → Working Conclusion**
- Concept DictionaryおよびResolverへの影響整理
- 過去仮説との矛盾検出
- 次回実験設計
- 必要な場合のみ元画像または指定Panelを再確認

## 標準フロー

1. 研究担当ChatGPTとわたるんが実験を設計する。
2. `new_run.py`でPLANNED Runを作る、または生成後に直接`ingest_run.py`を使う。
3. わたるんが6枚一体画像を生成する。
4. 6枚一体画像を`inbox`へ置く。設定ファイルは不要。PNG内メタデータを自動読取りする。
5. Codexまたはコマンドで画像を取込み、6分割する。
6. 画像解析ChatGPTが`observation.md`を完成させる。
7. ステータスを`OBSERVED`へ更新する。
8. 研究担当ChatGPTが`research-review.md`を完成させる。
9. わたるんが人間レビューする。
10. `ACCEPTED`、`REJECTED`、`NEEDS_FOLLOWUP`のいずれかへ更新する。
11. ACCEPTEDまたは有力な暫定結果を`ledgers/concept-ledger.yaml`へ反映する。

## 重要ルール

- Promptをタグ集合として扱わない。
- Human MeaningとObserved Model Behaviorを分離する。
- 画像解析担当は研究結論を確定しない。
- 研究担当はレポートだけで疑義が残る場合、代表Panelを再確認する。
- 6枚は方向確認と仮説候補の発見には使えるが、高Confidence確定には不足する。
- 原則として1回の比較で変更するPhraseは1つ。
- 失敗画像を消さない。漏れ先もモデル挙動の証拠である。
- 見えないSupportやContactを推測せず、`unclear`を正式値として使う。

## Research Claim Staging Layer

ObservationとVisual Concept Graphの間に、レビュー可能な研究Claimを保存する中間層があります。

```text
knowledge/assertions/*.yaml
knowledge/reviews/claim-review.yaml
knowledge/reviews/promotion-approval.yaml
```

Claim YAMLはConcept本体ではなく、`concepts/*.json`の代替でもありません。Observation、Interpretation候補、因果仮説、Promotionを分離して保存します。Review、Approval、Application ReceiptはAppend-only監査Recordです。

検証:

```powershell
.venv\Scripts\python.exe scripts\validate_research_claims.py --format json
```

完全なFreeze仕様とContext別コマンドは[`docs/research-claim-staging-layer.md`](docs/research-claim-staging-layer.md)を参照してください。

## セットアップ

Windows PowerShell例:

```powershell
cd sd-prompt-research
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

WSL / Linux例:

```bash
cd sd-prompt-research
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## PLANNED Runの作成

```bash
python scripts/new_run.py \
  --domain bridge \
  --run-id BRG-001 \
  --title "Bridge baseline without arm support" \
  --condition-label "Condition A"
```

この事前作成は任意です。生成後に`ingest_run.py`を直接実行すれば、Runフォルダと`manifest.yaml`を自動作成します。

## 6枚一体画像の取込み

3列×2行:

```bash
python scripts/ingest_run.py \
  --image inbox/BRG-001.png \
  --domain bridge \
  --run-id BRG-001 \
  --layout 3x2 \
  --title "Bridge baseline without arm support" \
  --condition-label "Condition A"
```

2列×3行:

```bash
python scripts/ingest_run.py \
  --image inbox/BRG-001.png \
  --domain bridge \
  --run-id BRG-001 \
  --layout 2x3
```

`BRG-001.png`だけで取込みできます。取込み時に次を自動生成します。

- `manifest.yaml`
- `source/BRG-001_metadata.yaml`
- `rubric.yaml`
- `observation.md` / `observation.json`
- `research-review.md`
- 6分割PanelとPreview

A1111 / Forge系PNGの`parameters`が埋め込まれている場合、Positive Prompt、Negative Prompt、Steps、Sampler、CFG、Seed、Size、Checkpointなどを抽出し、`manifest.yaml`へ反映します。ComfyUIの`prompt` / `workflow`も元データを保存します。PNG内に生成情報がない場合でもファイル一式は生成され、該当項目は空欄になります。

同名の`.yaml`、`.yml`、`.json`、`.txt`は任意の追加情報です。通常は不要です。存在する場合だけ自動検出し、PNG内情報へ追加して保存します。PLANNEDまたはGENERATED状態のRunにはそのまま画像を取り込めます。それ以外の既存Runを置き換える場合のみ`--overwrite`を付けます。`--move`を付けた場合も、処理がすべて成功してからinboxの元ファイルを削除します。失敗時に元画像は変更されません。

## 出力構造

```text
experiments/bridge/BRG-001/
├─ source/
│  ├─ BRG-001_sheet.png
│  └─ BRG-001_metadata.yaml
├─ panels/
│  ├─ BRG-001_01.png
│  ├─ ...
│  └─ BRG-001_06.png
├─ preview/
│  └─ BRG-001_preview.jpg
├─ manifest.yaml
├─ rubric.yaml
├─ observation.md
├─ observation.json
└─ research-review.md
```

## ステータス更新

```bash
python scripts/update_status.py experiments/bridge/BRG-001/manifest.yaml OBSERVED
```

使用可能な状態:

```text
PLANNED
GENERATED
INGESTED
OBSERVED
RESEARCHED
HUMAN_REVIEWED
ACCEPTED
REJECTED
NEEDS_FOLLOWUP
ARCHIVED
```

## 最初のBridge比較

- BRG-001: Core baseline without `arm support`
- BRG-002: 同一条件へ`arm support`のみ追加

一次解析ではCondition A/Bとして観察し、集計後にPhrase対応を開示します。

## 名前を変えずにinboxへ連続投入する

画像ファイル名は変更不要です。例えば次のまま置けます。

```text
inbox/
├─ image.png
├─ image (1).png
└─ image (2).png
```

Bridge用として一括取込みする場合:

```powershell
python scripts\ingest_inbox.py --domain bridge --layout 3x2
```

自然順で自動採番されます。

```text
image.png     -> BRG-001
image (1).png -> BRG-002
image (2).png -> BRG-003
```

すでに`BRG-001`から`BRG-004`まで存在する場合は、自動的に`BRG-005`から開始します。取込み後、Run内では`BRG-005_sheet.png`、Panelは`BRG-005_01.png`～`BRG-005_06.png`へ自動命名されます。元のファイル名は`manifest.yaml`の`source.original_filename`へ保存されます。

成功した元画像は、再取込みを防ぐため次へ移動します。

```text
inbox/processed/BRG-001.png
```

元画像をinboxへ残す場合:

```powershell
python scripts\ingest_inbox.py --domain bridge --layout 3x2 --keep-inbox
```

実行前に採番だけ確認する場合:

```powershell
python scripts\ingest_inbox.py --domain bridge --layout 3x2 --dry-run
```

Domainごとの既定Prefix:

```text
bridge   -> BRG
split    -> SPL
lying    -> LYG
hand-arm -> ARM
object   -> OBJ
lighting -> LGT
effects  -> EFX
```

任意のPrefixも指定できます。

```powershell
python scripts\ingest_inbox.py --domain bridge --prefix TEST --layout 3x2
```
