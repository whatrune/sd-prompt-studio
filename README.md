# SD Prompt Studio v20

公開されているStable Diffusionプロンプト資料を参考に、辞書を代表タグ方式へ再構築した版です。

- 類義語は検索用 aliases に格納
- 出力は原則として代表タグ1つ
- 補助タグは related に格納
- 「安定版」「推奨」などの表示名を撤去
- ポーズ、手指、脚、構図を重点的に整理
- LANアクセス対応

```powershell
npm.cmd install
npm.cmd run dev
```

## v20.2 pose dictionary fix
- ポーズの出力を代表タグ1件に統一
- 補助語は related に移動
- 開脚座りを sitting with legs apart に修正
- カード詳細ボタンの位置を調整


## v20.2
- LAN内のHTTPアクセスでもコピーできるフォールバックを追加しました。
- PromptとNegative Promptの両方に対応しています。

# SD Prompt Studio

Stable Diffusion Prompt Builder

## Features

- Japanese-first UI
- Smart Tag Engine
- Prompt Builder
- Category-based dictionary
- Related tag suggestions

## Development

```bash
npm install
npm run dev
