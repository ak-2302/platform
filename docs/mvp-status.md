# MVP status

最終確認: 2026-10-20

| 項目 | 状態 | 根拠 / 次の作業 |
| --- | --- | --- |
| Cloudflare Pages公開 | 完了 | `https://resonance.xn--n8jl2g.xn--q9jyb4c/` がHTTP 200 |
| Worker API公開 | 完了 | `/api/health` が正常応答 |
| openDAW連携 | 完了 | 固定engine commitとproject snapshot連携を実装 |
| D1提案・レンダージョブ保存 | 完了 | migrations `0001`〜`0003`を適用済み |
| Webhook署名検証 | 完了 | HMAC検証とdelivery重複排除を実装 |
| GitHub App設定 | 一部完了 | OAuth Client Secret・セッション署名秘密・コールバックURLは設定済み。App秘密鍵をWorker secretへ登録する |
| GitHubログイン | 完了 | `/api/auth/github`の302、`/api/auth/me`、提案作成時のログイン必須を確認 |
| GitHub PR作成 | 保留 | GitHub App秘密鍵登録後に本番経路を検証 |
| GitHub Actions固定レンダラー | 実装済み・要秘密鍵 | `song-demo/.github/workflows/trusted-render.yml`を追加。GitHub App秘密鍵とActions実行権限が必要 |
| Pi固定レンダラー | 任意の予備経路 | Piへ配布ZIPを配置した場合のみ利用 |
| A/B試聴 | Actions移行中 | Workerの簡易WAVからActions生成物へ切り替え。R2等の成果物配信が次の作業 |
| 本番受け入れテスト | 一部完了 | 公開・API・セキュリティ境界は確認済み。GitHub PRとPi実レンダーが未確認 |

## 次の順序

1. GitHub App秘密鍵をCloudflare Worker secretへ登録する。
2. Piへ`resonance-pi-renderer.zip`を配置し、固定openDAW rendererを検証する。
3. `PI_RENDERER_URL`と`PI_RENDERER_SECRET`をWorkerへ登録する。
4. `scripts/verify-production.ps1`を実行する。
5. ブラウザでNight Transitの編集、PR作成、A/B試聴を通しで確認する。
