# Slot設計ガイド

Smart Tag Engineのslotは、同じ部位・役割について同時に成立しないタグだけを排他的に扱うための仕組みです。同時に成立できる要素は同じslotへ入れず、必要に応じてslotを分割します。タグに明示的な`conflicts`がある場合は、slotによる一般判定より優先します。

## 姿勢と動作

現在は次の2種類を区別しています。

- `body_posture`: standing、sitting、lyingなど、同時に成立しない基本姿勢
- `body_motion`: walking、wavingなどの動作。複数の動作が同時に成立できるため`multiple`

`body_motion`を`multiple`にしても、walkingとrunning、jumpingとsittingなど、意味上同時に成立しない既知の組み合わせはSmart Tag Engine側でhard conflictとして扱います。

将来、動作辞書が増えた場合は、以下のような責務分割を検討します。

- `body_posture`: 身体全体の静的な姿勢
- `body_motion`: 移動、跳躍、回転など身体全体の動作
- `hand_action`: waving、clapping、pointingなど手・腕を中心とした動作

分割時は、既存タグのIDとPromptを維持し、同時成立可能な例と排他的な例の両方を回帰テストへ追加します。

## 眉

眉は形状と一時的な状態を別slotにします。

### `eyebrow_shape`

眉そのものの形や太さを表します。

- thick eyebrows
- thin eyebrows
- short eyebrows
- arched eyebrows

### `eyebrow_state`

表情によって変化する眉の状態を表します。

- raised eyebrow / raised eyebrows
- one eyebrow raised
- furrowed brow
- sad eyebrows

形状と状態は同時に成立できるため、たとえば`thick eyebrows + raised eyebrow`は許可します。同じ状態slot内の異なる指定は排他的に扱います。

## まつ毛

- `eyelash_length`: 上下を明示しない一般的な長さ・量。現在は上まつ毛側の一般指定として扱う
- `upper_eyelashes`: 上まつ毛を明示する指定
- `lower_eyelashes`: 下まつ毛を明示する指定

一般まつ毛と上まつ毛の明示指定は重複するため競合し、一般まつ毛と下まつ毛は併用できます。

## Character

Characterでは表示分類とPrompt出力分類を分離できます。衣装状態を表す`alternate costume`、`cosplay`、`uniformed character`は服装から探せるようにしつつ、`outputCategory: character`で従来のPrompt位置を維持します。

種族は基本種族、複合種族、存在形態、機械種別に分割します。異なるslotは併用可能で、同じslot内の種族だけを排他的に扱います。種族特徴は耳、角、翼、尻尾など部位ごとに分割し、異なる部位は同時に指定できます。

職業・役割と元素属性は複数同時に成立できるため`multiple`とし、明確に矛盾する組み合わせが生じた場合だけタグの`conflicts`で制限します。

## Motion Library（現行設計）

姿勢・移動・部位動作を分離し、同時成立できる要素は別slotにします。Interaction系の対人行動はMotionへ移しません。

- `body_posture` (single): standing、sitting、lyingなどの基本姿勢
- `posture_modifier` (multiple): leaning、bendingなど姿勢への追加要素
- `locomotion` (single): walking、running、crawlingなどの移動
- `hand_action` (multiple): waving、clapping、pointingなどの手・腕動作
- `gaze_action` (single): looking backなど視線を伴う動作
- `sport_action` (single): スポーツ種目・動作
- `dance_style` (single): ダンスの種類。異なるスタイルの同時指定は原則競合
- `acrobatics` (single): 体操・アクロバット
- `combat_action` (multiple): 武術・戦闘動作。攻防の併用を許可する
- `airborne_state` (single): jumping、falling、floatingなど空中状態
- `balance_pose` (single): 片足立ち、綱渡りなどバランス姿勢
- `leg_pose` (multiple): 開脚など脚の形
- `vehicle_action` (single): 自転車、騎乗、運転など乗り物上の動作

`body_posture`と`locomotion`、`body_posture`と`airborne_state`など、slotが異なっても意味上同時に成立しない組み合わせはhard conflictにします。複数slotを持つタグ自身は一つの複合動作として扱います。

`combat_action`は現状multipleを維持します。辞書拡張で戦闘流派と具体的な攻防動作が増えた場合は、`combat_style`を分離する候補として再検討します。

## RIN canonical辞書

Motion辞書は、将来のRIN大量追加を前提に物理レコードとUI表示レコードを分離します。

- `allTags`: deprecatedを含む物理辞書。旧IDの解決とmigrationに使用
- `tags`: deprecatedを除いたcanonical表示辞書。UI、検索、Prompt選択に使用
- `sources`: `existing` / `RIN`の由来を配列で保持
- `deprecated: true`: 重複統合後も物理削除しない旧レコード
- `redirectTo`: deprecated IDからcanonical IDへの解決先

既存IDを可能な限りcanonical IDとして維持し、RIN由来のPrompt・aliases・relatedを統合します。RIN Promptを原則優先しますが、`v`のように短く曖昧な語は例外とし、明確な`peace sign`を代表Promptに残して検索aliasへ追加します。

RIN追加フローは次の順序です。

1. RINタグを取得し、`sources: ['RIN']`を付与する
2. canonical辞書からPrompt完全一致と意味近似候補を検索する
3. 完全重複は既存canonicalへmetadataを統合し、RINレコードをdeprecated + redirectToにする
4. 意味が近いだけなら、独立タグを維持してaliasesまたはrelatedを追加する
5. 姿勢・部位・動作を再評価してslotを付与する
6. 全旧ID解決、canonical表示件数、保存データ・お気に入りmigrationを検証する
