# Prompt出力順

タグの選択順、競合管理、Prompt出力順は別の責務として扱います。

- `slot`: 同時指定できないタグの競合管理
- `promptGroup`: Prompt出力上のグループ
- `promptOrder`: 同じpromptGroup内の優先順位。小さい値を先に出力
- `sortSubcategory`: 既存Prompt順との互換フォールバック

`promptGroup`と`promptOrder`が両方のタグに設定され、同じgroupに属する場合だけ新しい順序を使います。未設定タグ、異なるgroup、同順位では従来のcategory、sortSubcategory、辞書登録順へフォールバックします。そのため、既存辞書へ段階的に導入できます。

競合判定はPromptソート前に独立して実行され、promptOrderは競合結果へ影響しません。

Eyesではpupil、eye color、eye shape、iris、state/gaze、highlight/effect、eyelash、eyelid/eyelinerの順にpromptOrderを設定します。これにより、例えば`slit pupils`は`red eyes`より先に出力されます。
