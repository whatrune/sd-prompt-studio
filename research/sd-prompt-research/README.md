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

## Codexへの簡易依頼

次のような自然言語の依頼を受けた場合、Codexは本README、対象Runの現在状態、関連するInstructionsおよび既存Contractを参照して処理する。

- 「inboxの画像を取り込んで」
- 「新しいRunとして正式化して」
- 「Observationを保存して正式化して」
- 「Research Explorerへ反映して」
- 「最新Runを解析・正式化してPDF化。研究判断なし。」
- 「研究開始」
- 「研究開始してPDF化」
- 「研究開始。最後にResearch PacketをPDF化」

Codexは明示的な許可がない限り、Research Interpretation、Working Conclusion、Research Claim、Research Claim Evidence Fact / Evidence Binding、Human Resolution、Promotion、Candidate Finalize、Application、Concept Dictionary更新、次実験提案を生成または確定しない。Visible Evidenceとして記録するObservationとResearch Claim Evidenceを混同せず、Runを`OBSERVED`へ更新するObservation FinalizationとCandidate Finalize / Applicationを区別する。

### 正式化の基本定義

「正式化」は、常に最初の工程からやり直すことを意味しない。Codexは対象Runの現在状態と既存成果物を確認し、必要な未完了工程だけを正しい順序で実行する。既に取り込み済みのRunに対して、inbox取込み、Run ID採番、Panel分割、既存成果物生成を重複実行しない。

対象成果物が揃っている範囲で、正式化は次の処理を含む。

1. 対象Run、Domain、開始時ステータスを特定する。
2. 未取り込みの場合のみ、inboxから画像を取り込む。
3. 新規Runの場合のみ、DomainとRun IDを確定して採番する。
4. 未分割の場合のみ、6枚一体画像をPanelへ分割する。
5. `manifest.yaml`、`source/rubric.yaml`、Observation成果物を所定位置へ作成または正規更新する。
6. Observation完成条件をすべて満たした場合のみ、Runを`OBSERVED`へ更新する。
7. 手順6に成功した場合のみ、`register_research_run.py`でRunを登録する。
8. 手順6に成功した場合のみ、Derived Indexを再生成して検証する。
9. 手順6に成功した場合のみ、必要に応じてLocal Companion Serviceを再起動し、Research Explorerで表示確認する。
10. 実行内容、作成・更新ファイル、最終ステータス、検証結果、未完了工程を報告する。

Observationが未完成またはValidationに失敗した場合は、`OBSERVED`へ更新せず、`register_research_run.py`を実行せず、Observed RunとしてDerived Indexへ登録しない。`INGESTED`または処理前の適切なステータスを維持し、手順10の報告だけを実行する。

既存Runがすでに`OBSERVED`以上のステータスである場合、再検証失敗だけを理由に自動降格したり、過去成果物を無効化・破棄したりしない。既存ステータスを維持し、再検証失敗を完了報告へ記録する。ステータス降格や過去成果物の無効化には、明示的なユーザー確認を必要とする。このREADME追記だけを根拠に、新しいValidation Record、Receipt、監査Artifact、Claim YAMLを作成しない。既存Workflowが正式な出力先を定義している場合のみ、その既存出力を使用する。

「正式化」は、無条件に`ACCEPTED`、Research Claim確定、Research Claim Evidence生成、Human Resolution、Promotion、Candidate Finalize、Application、Concept Dictionary更新まで進める意味ではない。`register_research_run.py`もこれらを生成しない。

### 研究開始

「研究開始」は、対象Runについて「正式化の基本定義」1〜10を、現在状態から実行可能な範囲で連続実行する明示指示として扱う。Observationが未完成の場合に必要となる画像解析の実行許可を含むが、画像から直接確認できるVisible Evidenceの記録に限定し、研究担当者としての判断を許可するものではない。

処理途中で必須成果物不足、画像不足、Schema違反、Rubric違反、Aggregate不一致、対象RunまたはGrouped Run構成の曖昧性が判明した場合は、安全に完了できた最高ステータスで停止する。未完了工程を成功扱いせず、停止理由、最終ステータス、未実行工程を報告する。

「研究開始」だけではPDF生成を含まない。PDFも必要な場合は、「研究開始してPDF化」または「研究開始。最後にResearch PacketをPDF化」のように明示する。

### 対象Runの決定

ユーザーがRun IDを明示している場合は、そのRunを対象とする。「最新Run」が指定された場合は、次の優先順位で対象を決定する。

1. 直前の取込み処理で作成されたRun。
2. 現在の作業文脈で明示されているRun。
3. 確定済みDomain内で`manifest.created_at`が最も新しいRun。

`created_at`が存在しない、同値、または比較不能な場合は、数値部分が最大の標準Run IDを候補とする。`created_at`と採番結果が矛盾する場合、Domainが確定していない場合、非標準Run IDが混在する場合、または同じ最新採番に無関係な複数候補がある場合は自動選択せず、候補Run ID、Domain、`created_at`、現在ステータスを提示して確認を求める。Bridgeを暗黙の既定Domainとして仮定しない。

標準Grouped Run IDは`<prefix>-<number>-<condition-suffix>`形式とし、末尾Condition Suffixを除いた部分を運用上のBase Run IDとして扱う。例は`BRG-010-A`、`BRG-010-B`、`BRG-010-AA`である。Base Run IDはObservation Schemaやmanifestの必須Canonical Fieldでも、Canonical Research DataのIdentity要素でもない。任意のハイフン分割や非標準IDからGrouped Run構造を推測しない。

最新Run判定では、Grouped Runを条件Run単位ではなくBase Run ID単位の候補グループとして比較する。代表`created_at`は、同じBase Run IDを持つ条件Runの`manifest.created_at`のうち最も新しい値とする。Grouped Runが対象になった場合は、条件Runのうち1件だけを選択せず、確認できた同一グループの全条件Runを対象とする。実行後の報告ではGrouped Runの場合のみ派生Base Run IDを表示し、単一Runでは省略または`not applicable`とする。

条件Runの欠落は、期待メンバー一覧が次のいずれかから明示的に確認できる場合だけ判定する。

- 直前の`ingest_inbox.py`実行結果。
- 現在の作業文脈で作成されたRun一覧。
- ユーザーが明示した条件Run一覧。
- 既存Artifactに明示的に保存された実験構成。

現在存在するRunディレクトリや標準Grouped Run形式だけから、存在しない条件Runや期待条件数を推測しない。期待メンバーが不明、一部条件Runが欠落、条件ごとにステータスが異なる、一部だけValidation Errorがある、または標準形式として一意に解析できない場合は、正常な条件だけを勝手に正式化しない。発見した条件Run、各ステータス、確認できた範囲、不確定理由、必要な確認事項を報告して停止する。

### 既存Runの正規更新と破壊的上書き

「既存Runを上書きしない」は、別Runを同一Run IDへ置換する、既存画像を意図せず置換する、取り込み済み画像を再取込みする、または他Runの成果物を選択中Runへ保存する破壊的操作を禁止する意味とする。

明示的に選択されたRunについて、既存Workflowに従って`manifest.yaml`、`observation.json`、`observation.md`、`computed_aggregate`、`research-review.md`の雛形、Run Ledger entry、Derived Indexを正規更新することは許可する。`ingest_run.py --overwrite`などの破壊的置換が必要な場合は、対象、理由、影響範囲を提示し、事前にユーザー確認を得る。

### 画像解析の境界

依頼文に「解析」が明示されている場合、または「研究開始」が指定されている場合のみ、Codexは[`instructions/codex-image-analysis-workflow.md`](instructions/codex-image-analysis-workflow.md)に従ってImage Analyst Workflowを実行し、Observationを作成してよい。これはCodexが研究担当者の役割を引き受けることを意味しない。

CodexがImage Analystとして実行できるのは、Visible Evidenceの記録、Observation項目の記入、Observation Schema準拠の検証である。見えないSupport、Contact、Orientation、身体構造、因果関係、意図を推測で補完せず、不明な項目は正式値として`unclear`を使用する。Research Interpretation、Working Conclusion、Research Claim、Research Claim Evidence、Concept分類、研究結論を作成または確定しない。

「解析」または「研究開始」が明示されていない場合、未完成のObservationを推測で補完しない。Observation雛形の生成、既存Observationの保存、形式検証など実行可能な工程までを行い、`INGESTED`または現在の適切なステータスを維持する。

### Observation完成条件

Observationの完成とは、次の条件をすべて満たす状態をいう。

- Canonicalな`observation.json`が所定位置に存在する。
- Observation Schema検証が成功している。
- `source/rubric.yaml`の`active_observation_axes`と`axis_values`に準拠している。
- Rubric Evidence Policyに違反していない。
- Panel数、Panel ID、各Panelの必須項目が正しい。
- `unclear`が正式値として正しく扱われている。
- `computed_aggregate`とPanel別Observationの集計結果が一致している。
- Run ID、Condition Label、Panel ID、参照先に不整合がない。
- Grouped Runの場合は、Run IDのsuffixとCondition Labelの対応が正しい。

これらの検証がすべて成功した場合のみ`OBSERVED`へ更新する。失敗した場合は、Validation Error、対象ファイル、失敗項目、データ整理上の修正候補、未実行工程を報告する。

### PNGメタデータと追加設定ファイル

生成条件はPNG内メタデータを優先する。Positive Prompt、Negative Prompt、Steps、Sampler、CFG、Seed、Size、Checkpointなどは、埋め込まれた生成情報から取得する。同名の`.yaml`、`.yml`、`.json`、`.txt`は、存在する場合だけ補助情報として使用し、存在しないことをエラーにしない。PNG内情報と追加設定ファイルが矛盾する場合は勝手に統合せず、差異を報告する。

### PDF化

依頼文に「PDF化」または「Research PacketをPDF化」が明示された場合のみ、[`instructions/codex-image-analysis-workflow.md`](instructions/codex-image-analysis-workflow.md)および既存Research Packet生成処理に従ってPDFを生成する。対象Runが`OBSERVED`になり、Observation検証が成功した後に実行する。

Grouped Runは共有Base Run ID単位で1つ、単一RunはそのRunだけをPDF化する。PDF内容は既存Research Packet生成処理の定義範囲に限定し、この簡易依頼を根拠に新しいセクション、研究解釈、Panel別全文、Observation JSON全文を無条件に追加しない。

生成後はPDFをページ画像へRenderし、文字切れ、要素の重なり、画像・文章の欠落、ページ外へのはみ出し、Panel順序・ラベル、日本語・記号の文字化けを確認する。問題がある場合は修正して再Renderする。

### Research Explorerへの反映

「Research Explorerへ反映」は、`register_research_run.py`によるRun Ledgerへの登録または同期、Derived Index再生成、Derived Index上でのRun/Observation Relationship生成、IndexのSchema・整合性検証、必要なLocal Companion Service再起動、対象Run・Observation・Relationshipの表示確認を意味する。

Run/Observation Relationshipは、同一Canonical Runディレクトリに存在し、完全一致するRun IDを持つRun ArtifactとObservation Artifactから機械的に派生するRead Model情報である。Base Run IDやGrouped Runの比較関係から生成せず、Canonical Research Dataへ研究判断として永続保存しない。各条件Runは完全なRun ID単位で個別にRelationshipを生成する。

Research Explorer APIへMutation Endpointを追加せず、既存のread-only境界を維持する。Companion Serviceまたはブラウザ環境の制約で画面確認できない場合も、正常に完了したObservation Finalization、Run登録、Derived Index生成を巻き戻さない。Run登録、Index検証、Service起動、UI表示確認を分離して報告し、UIを確認できなかった場合は`未確認`とする。

### 実行後の報告

処理後は、該当する次の項目を報告する。

- 対象Domain、Run ID、Grouped Runの場合の派生Base Run IDと対象条件Run。
- 開始時ステータスと最終ステータス。
- 実行したコマンド。
- 作成したファイルと正規更新したファイル。
- Observation Schema、Rubric Evidence Policy、`computed_aggregate`の検証結果。
- Run登録とDerived Indexの検証結果。
- Companion Serviceの再起動結果とResearch Explorer表示確認結果。
- 明示された場合のPDF生成先とRender確認結果。
- 未完了工程、停止理由、Validation Error、判断が必要な点。

「研究判断なし」が指定されている場合は、Visible EvidenceのObservation、形式検証、正規保存、`OBSERVED`への更新、Run登録、Derived Index生成、Explorer表示確認、明示された場合のPDF化だけを実行し、Research Interpretation以降へ進まない。

## 重要ルール

- Promptをタグ集合として扱わない。
- Human MeaningとObserved Model Behaviorを分離する。
- 画像解析担当は研究結論を確定しない。
- 研究担当はレポートだけで疑義が残る場合、代表Panelを再確認する。
- 6枚は方向確認と仮説候補の発見には使えるが、高Confidence確定には不足する。
- 原則として1回の比較で変更するPhraseは1つ。
- 失敗画像を消さない。漏れ先もモデル挙動の証拠である。
- 見えないSupportやContactを推測せず、`unclear`を正式値として使う。

## Research Review Output Format

Research Reviewは、既存の責務と研究フローを変更せず、レビュー結果の出力形式だけを次のContractへ統一する。このContractはImage-to-Observation整合確認を行うObservation Review出力を対象とし、Observation Schema、Research Claim Contract、Run status、`research-review.md`の責務を変更しない。標準フローにある研究担当のInterpretationおよびWorking Conclusion工程を置き換えない。

### Review Status

Research Reviewは、先頭に必ず`Review Status`を出力し、値は次のEnumから1つだけを使用する。

- `APPROVE`: Observationと画像の間に、修正を必要とする不整合が存在しない。
- `COMMENT`: 重大な修正は不要だが、境界的な観察、注意事項、または再確認推奨事項が存在する。
- `NEEDS_FOLLOWUP`: Observation修正、再確認、または追加レビューが必要である。
- `REJECT`: Observationと画像の間に重大な不整合があり、現在のObservationを研究利用できない。

Status名へ「相当」などの接尾辞を追加してはならない。`APPROVE`、`COMMENT`、`NEEDS_FOLLOWUP`、`REJECT`をそのまま出力する。

このReview Statusはレビュー出力上の判定であり、Run lifecycle statusではない。Review Statusを出力しただけでは`manifest.yaml`のstatusを変更しない。既存フローの人間レビュー後に使用する`ACCEPTED`、`REJECTED`、`NEEDS_FOLLOWUP`とは別に扱い、status更新は明示的な依頼または既存フローの所定工程でのみ行う。

### 標準構成

人間向けのResearch Reviewは次の順序を標準として推奨する。`Observed Comparison`は条件比較を行う場合だけ含め、それ以外のSectionと機械判定可能な固定項目は維持する。

```markdown
## Review Status

Review Status:
COMMENT

## Review Summary

BRG-012はCOMMENTです。
画像とObservationの大きな不整合はありませんが、BRG-012-B Panel 6のtorso_arch分類は境界的であり、条件比較に利用する場合は再確認を推奨します。

## Scope

- Image-to-Observation consistency
- Observation Schema consistency
- Rubric Evidence Policy consistency
- Computed Aggregate consistency
- Derived Index consistency

## Critical Findings

None

## Warnings

- BRG-012-B Panel 6のtorso_arch=strongはmediumとの境界的分類。胴体強度を条件比較に使用する場合は再確認を推奨。

## Observed Comparison

| Condition | wheel_like | Main Morphology | Support Structure | Artifact |
| --- | --- | --- | --- | --- |
| BRG-012-A | 2/6 | kneeling_hand_support 3/6, prone_quadruped 2/6 | hand_and_knee | none |
| BRG-012-B | 1/6 | kneeling_backbend 1/6 | hand_and_knee 2/6 | none |
| BRG-012-C | 1/6 | kneeling_hand_support 2/6 | mixed_support | perspective_ambiguity 1 |

## Validation Status

Validation Status:

- Observation Schema: PASS
- Rubric Evidence Policy: PASS
- Computed Aggregate: PASS
- Derived Index: PASS

## Research Interpretation Boundary

Research Interpretation:
Not performed.

## Modification Status

Modification Status:

Files Modified:
None

## Next Action

- Recheck BRG-012-B Panel 6 torso_arch
- Proceed to Working Conclusion review
```

各Sectionは次の規則に従う。

- `Review Summary`: Review Statusの判定理由、主要な注意点、レビュー後の扱いを、人間が短時間で把握できる自然文で簡潔に記載する。原則として2〜3文以内とし、Research Interpretationを含めない。
- `Scope`: レビュー対象範囲を列挙する。
- `Critical Findings`: 研究利用を止める重大な不整合を記載する。存在しない場合は`None`とする。
- `Warnings`: 重大な修正を必要としない境界的な観察、注意事項、再確認推奨事項を記載する。人間が読みやすい文章または箇条書きを使用し、存在しない場合は`None`とする。
- `Observed Comparison`: Markdown Tableを優先し、1行を1 Condition、`Condition`以外の列を観測軸ごとに分離する。列は対象実験のObservationに存在する観測軸だけを使用し、実験内容に応じて変更できる。`wheel_like`、`Main Morphology`、`Support Structure`、`Artifact`は例示列であり、必須ではない。Observationに記録された観測値だけを記載し、条件比較を行わない場合はSectionごと省略する。
- `Validation Status`: `Observation Schema`、`Rubric Evidence Policy`、`Computed Aggregate`、`Derived Index`を固定項目とし、各値は`PASS`、`FAIL`、`NOT_RUN`のいずれかとする。
- `Research Interpretation Boundary`: `Research Interpretation: Not performed.`または`Research Interpretation: Pending human review.`を明記し、Observation ReviewでResearch Conclusionを確定しない。
- `Modification Status`: 修正なしでも必ず出力する。変更がない場合は`Files Modified: None`、変更がある場合は`Files Modified:`の下に変更したrepo-relative pathを列挙する。
- `Next Action`: 必要な次工程を自然文または箇条書きで記載する。不要な場合は`None`とする。

`Critical Findings`が存在する場合は`NEEDS_FOLLOWUP`または`REJECT`を使用する。`Critical Findings`が`None`で`Warnings`が存在する場合は`COMMENT`、両方が`None`の場合は`APPROVE`を使用する。

### Observation ReviewとResearch Conclusionの分離

このOutput Formatを用いるObservation Reviewで許可されるのは次の確認に限る。

- ImageとObservationの整合確認
- Visible Evidence確認
- Rubric違反確認
- Observation Schema確認
- `computed_aggregate`確認

このObservation Reviewでは次を行わない。

- Working Conclusion確定
- Research Claim生成または確定
- Concept Dictionary更新
- Prompt Resolver更新
- 次実験の確定

研究解釈は別工程で行う。レビュー担当は、明示的な修正依頼なしにObservation、Research Claim、Concept Dictionary、Run statusを変更しない。

### Comparison表現ルール

Observation Reviewの比較記述は、Observationに記録された頻度と分布だけを扱う。

許可:

- metric名
- count
- `X/6`形式
- observed category
- artifact名
- 「BRG-012-Cでは`wheel_like`が3/6観測された」

禁止:

- 「`wheel_like`が改善した」
- 「BRG-012-Cが最も成功した」
- 「bridge poseが有効だった」
- 「body bridgeが優れている」

成功率、効果量、Working Conclusion、および成功、失敗、優劣、有効性、因果を示す表現はResearch Interpretation以降で扱い、Observation Reviewには含めない。

表の各セルは、将来的に`condition`、`metric`、`value`へ分離して検索、集計、Graph化、Influence分析へ利用できる粒度を維持する。

```json
{
  "condition": "BRG-012-A",
  "metric": "wheel_like",
  "value": "2/6"
}
```

この粒度はReview出力の表示規則であり、JSON Schema、Observationの保存形式、Index、またはResearch Claim Contractを追加・変更するものではない。

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

## Research Explorer Companion Service

Research Explorer向けのLocal Companion Serviceは、Research Artifactをread-onlyで探索し、Derived Indexを生成して、既存Frontend buildと`/api/research/*`を同一Originで配信します。公開Previewへ実Research Dataを含めず、ブラウザへfilesystem pathを渡しません。Candidateの`finalized`表示は、正式Receipt Schema、Candidate Identity、Artifact Hash、`assertion_content_v1_hash`をすべて照合した結果からのみ派生します。

Index生成とArtifact Responseは共通Secure Readを利用し、同一bytesからbyte size、Source Freshness Fingerprint、response bodyを生成します。Public Previewはfixture-only、Local Research Modeだけが同一Origin API clientを利用します。

Index検証:

```powershell
.venv\Scripts\python.exe scripts\research_explorer.py index --check
```

起動方法、API、Fingerprint、Security境界は[`docs/research-explorer-companion-service.md`](docs/research-explorer-companion-service.md)を参照してください。

正式化済みRunをLedgerへ登録し、Run/Observation Relationshipを含むDerived Indexを再生成・検証する最小経路:

```powershell
.venv\Scripts\python.exe scripts\register_research_run.py `
  --run-dir experiments\bridge\BRG-010-A `
  --index-output tmp\research-explorer-index.json
```

この処理はClaim、Evidence、Human Resolution、Finalizeを生成しません。詳細は[`docs/research-run-ingestion.md`](docs/research-run-ingestion.md)を参照してください。

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
