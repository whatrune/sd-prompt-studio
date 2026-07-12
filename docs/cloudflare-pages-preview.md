# Cloudflare Pages Preview Deploy

Cloudflare Pages の GitHub 連携を使い、Pull Request ごとにブラウザで確認できる Preview URL を作成するための設定手順です。

この設定は Cloudflare Dashboard 上で行います。リポジトリには Wrangler 設定や Cloudflare 用の環境変数を追加しません。既存の GitHub Pages 本番デプロイと Pull Request Preview Artifact workflow はそのまま維持します。

## Build settings

| Setting | Value |
| --- | --- |
| Repository | `whatrune/sd-prompt-studio` |
| Production branch | `main` |
| Framework preset | Vite |
| Build command | `pnpm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | `22` |

Node.js 22 は Cloudflare Pages の Build variables で `NODE_VERSION=22` として設定してください。依存関係のインストールにはリポジトリの `package.json` を使用します。

## Project creation

1. Cloudflare Dashboard の **Workers & Pages** を開く。
2. **Create application**、**Pages**、**Connect to Git** の順に選択する。
3. GitHub を認証し、`whatrune/sd-prompt-studio` へのアクセスを許可する。
4. Production branch に `main` を指定する。
5. 上記の Build settings を入力する。
6. Preview branch control を **All non-Production branches** にする。
7. 最初のデプロイを実行し、`<project>.pages.dev` が生成されることを確認する。

Git連携で作成したPagesプロジェクトは、あとからDirect Upload方式へ切り替えられません。Preview Deployを目的とするため、このプロジェクトではGit連携方式を使用します。

## Pull Request preview

同一GitHubリポジトリ内のブランチからPull Requestを作成すると、Cloudflare Pagesが自動的にbuildし、次の確認手段を提供します。

- Pull RequestのCloudflare Pages check
- commit固有の`<hash>.<project>.pages.dev` URL
- 最新branch buildを示す`<branch>.<project>.pages.dev` alias

Preview URLはPull RequestのChecks、またはCloudflare Dashboardの **Workers & Pages > project > Deployments** から開けます。fork由来のPull RequestにはPreview URLが作成されないため、必要なUI確認用branchはこのリポジトリ内に作成してください。

## Verification checklist

- `main`へのpushでCloudflare Pages production deploymentが実行される。
- Pull Requestの作成・更新でPreview deploymentが実行される。
- Build commandが`pnpm run build`になっている。
- Build output directoryが`dist`になっている。
- Preview URLでUI、Context切替、Tag操作を確認できる。
- [Pull Request Preview workflow](../.github/workflows/preview.yml)のtest、build、Artifact生成も成功する。
- [GitHub Pages workflow](../.github/workflows/deploy.yml)が変更されていない。

## References

- [Cloudflare Pages: Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages: Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Cloudflare Pages: Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)

