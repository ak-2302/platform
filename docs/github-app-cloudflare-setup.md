# GitHub App → Cloudflare Worker 設定

このプロジェクトは、ブラウザやRaspberry PiへGitHub秘密情報を渡さず、Cloudflare WorkerだけでGitHub APIを呼び出します。

## 1. GitHub App

GitHubの `Settings → Developer settings → GitHub Apps → New GitHub App` で作成します。

必要な設定：

- Repository access: `Only select repositories` → `ak-2302/song-demo`
- Repository permissions: `Contents: Read and write`, `Pull requests: Read and write`, `Metadata: Read-only`
- Webhook URL: `https://resonance-api.meiteya.workers.dev/api/webhooks/github`
- Webhook secret: ランダムな長い文字列
- Subscribe to events: `Pull request`

Appを作成したら、Private keyを1回だけ生成し、インストール画面から `song-demo` にインストールします。

## 2. Cloudflare Workerへ登録

PowerShellで以下を実行します。値はGitHub App画面のものに置き換えます。

```powershell
cd C:\Users\koyoa\Documents\mymusic\platform
$env:APP_ID = "GitHub App ID"
$env:INSTALLATION_ID = "Installation ID"
$env:WEBHOOK_SECRET = "Webhook secret"

node worker\node_modules\wrangler\bin\wrangler.js secret put GITHUB_APP_PRIVATE_KEY --config worker\wrangler.toml
node worker\node_modules\wrangler\bin\wrangler.js secret put GITHUB_WEBHOOK_SECRET --config worker\wrangler.toml
```

`GITHUB_APP_PRIVATE_KEY` には生成したPEMファイルの内容を貼り付けます。App IDとInstallation IDは公開情報として扱えるため、必要なら `worker/wrangler.toml` の vars に設定できますが、秘密情報と同じくSecretにしても構いません。

```powershell
node worker\node_modules\wrangler\bin\wrangler.js secret put GITHUB_APP_ID --config worker\wrangler.toml
node worker\node_modules\wrangler\bin\wrangler.js secret put GITHUB_INSTALLATION_ID --config worker\wrangler.toml
```

## 3. 確認

```powershell
Invoke-RestMethod https://resonance-api.meiteya.workers.dev/api/config
```

`githubConfigured: true` と `githubAuthMode: "github-app-private-key"` が返れば、Workerは短期Installation Tokenを自動取得できます。Private key、Token、Webhook secretはブラウザへ返しません。

### PEMファイルからの一括登録

秘密鍵をダウンロードできた場合は、内容をチャットや画面へ貼り付けず、次のスクリプトで登録できます。秘密値はWranglerの標準入力へ直接渡し、表示・保存しません。

```powershell
.\scripts\configure-github-app.ps1 `
  -PrivateKeyPath "$env:USERPROFILE\Downloads\private-key.pem" `
  -AppId "5390226" `
  -InstallationId "173243925" `
  -WebhookSecret "Webhook secret"
```
