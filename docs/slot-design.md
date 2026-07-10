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
