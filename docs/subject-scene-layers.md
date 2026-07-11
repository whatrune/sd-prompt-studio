# Subject / Sceneレイヤー

Prompt編集状態は、被写体ごとの`blocks`（Subjects）と画像全体で共有する`sceneTags`（Scene）に分離します。

## カテゴリ対応

Subject: `people`, `character`, `body`, `hair`, `eyes`, `expression`, `clothes`, `accessories`, `pose`

Scene: `quality`, `camera`, `background`, `scene_props`, `lighting`, `effects`

現行辞書ではstyleはqualityの小カテゴリ、composition/depthはcameraまたはeffectsの小カテゴリとして扱うため、新しい大カテゴリは追加しません。Negative Promptは従来どおり独立した`negative`文字列です。

## migration

保存データversion 9で、各blockからSceneカテゴリを抽出して`sceneTags`へ移します。同じIDは最初の出現位置を維持して一件にまとめ、weightが異なる場合は最大値を採用します。Subject名、Subjectタグ、weight、favoriteIds、ユーザー辞書は維持します。

Prompt生成時、Sceneタグは全体に一回だけ出力し、各Subject固有タグはBREAK区切りの被写体ブロックへ出力します。未移行の呼び出しに対しても、buildPrompt側でblock内のSceneタグを一回に重複排除します。
