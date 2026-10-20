# re:sonance 現状比較と今後の開発計画

## 判定基準

- **実装済み**: 本番またはコード上で主要経路が動作する。
- **部分実装**: APIやUIの一部はあるが、利用者の一連の操作として未完成。
- **未実装**: 仕様だけで、実際の処理がない。

## 現在の実装状況

### 実装済み

| 項目 | 現状 | 確認できる場所 |
|---|---|---|
| Cloudflare Pages | 本番サイトを公開済み | `platform` のVite build / Pages |
| Cloudflare Worker | APIを公開済み | `platform/worker/src/index.mjs` |
| D1 | 提案メタデータを保存済み | `worker/migrations/0001_proposals.sql` |
| Night Transitの基本情報 | manifest、ファイル、コミットAPIあり | Workerの `/api/songs/night-transit/*` |
| proposal保存 | D1へ保存するAPIあり | `POST /api/songs/night-transit/proposals` |
| GitHub PR APIの骨格 | ブランチ作成、`main.od`更新、PR作成処理あり | `POST .../pull-request` |
| SHA検証 | `main` と固定manifestのbase SHAを比較 | WorkerのPR作成処理 |
| openDAWスナップショット橋渡し | `postMessage` と `ProjectBundle` 変換あり | `opendaw/packages/app/studio/src/boot.ts` |
| ファイル一覧・履歴UI | Files / Historyタブあり | `platform/src/main.jsx` |
| Cloudflare低負荷プレビュー | 短い合成WAVをキャッシュ返却 | Workerの `/audio/*` |
| Pi負荷抑制 | Pi未設定時はWorker側プレビューへフォールバック | `PI_RENDERER_URL` 未設定時の分岐 |

### 部分実装

| 項目 | 現状 | 不足しているもの |
|---|---|---|
| openDAW編集 | openDAW側にスナップショット受信処理がある | platform内の実際の埋め込み・起動・プロジェクト読み込みを一連で確認する必要がある |
| 提案作成 | API、snapshot、PR呼び出しがある | UIがGitHub未設定・API失敗時にローカル偽提案へフォールバックするため、実運用では成功と失敗を正しく表示する必要がある |
| GitHub連携 | APIコードはある | Worker Secretの`GITHUB_TOKEN`、実リポジトリ権限、ログインセッションが未設定 |
| 認証 | ログイン導線の見た目はある | GitHub OAuth/App認証、セッションCookie、ユーザー識別、ログアウトがない |
| A/B試聴 | UIラベルと合成プレビューAPIはある | 現在のUI操作が実音声プレイヤーに接続されておらず、変更前後を同じ位置で比較できない |
| レンダリング状態 | APIのready/queued表示がある | 実際のopenDAWレンダリング、ジョブ永続化、失敗・再試行がない |
| Piレンダラー | WorkerからHMAC付きで呼ぶ骨格がある | Tunnel公開、認証済みジョブキュー、結果返却、負荷制限の実運用確認がない |
| プロジェクト情報 | Filesと詳細表示がある | `song.json`、`credits.json`、実commitからの動的表示に統一されていない箇所がある |

### 未実装

- R2などへのレンダリング音源保存
- base/head SHAとrenderer versionを含むレンダリング成果物の永続記録
- Webhook署名検証と重複イベント排除
- GitHub Appの最小権限設定と実ユーザーログイン
- `main` 直接push禁止、CODEOWNERS、PRテンプレートの適用確認
- 提案詳細ページ、PR詳細、素材ライセンス詳細の専用画面
- 投票、レビュー、タイムラインコメント
- MIDI差分、派生作品、貢献履歴、バッジ、Discord通知

## 重要な技術上の差分

1. **音声はまだ本物のレンダリング結果ではない**。現在のWorkerプレビューは負荷を抑える合成WAVで、openDAWプロジェクトをレンダリングしていない。
2. **GitHub認証は未完了**。WorkerにGitHub Secretがない場合、画面は「GitHub App not configured」の状態になる。
3. **UIにはデモ状態が残っている**。提案、投票数、履歴、contributorsの一部が固定値で、実データとの整合が取れていない。
4. **openDAWのバージョン情報を統一する必要がある**。`song-demo/song.json`、Worker manifest、platformの` songManifest`を実際に採用するopenDAWコミットへ揃える。
5. **受け入れテストがブラウザE2Eになっていない**。API単体・ビルド確認だけでなく、ログインからPR・A/B試聴までを公開環境で確認する必要がある。

## 今後の開発計画

### Phase 0: 基準値の固定（最優先）

目的: 実装の前提を一つに揃える。

- openDAWの採用コミットを1つ決定する。
- `song-demo/song.json`、Worker manifest、platform manifestのSHAを統一する。
- `project/main.od` がそのコミットで開けることを確認する。
- `credits.json` とライセンス情報を実ファイルとして揃える。
- `npm test`、`npm run build`、openDAWビルドを再確認する。

完了条件: 3箇所のSHA、曲ID、プロジェクトパスが一致し、同じプロジェクトを開ける。

### Phase 1: ブラウザ編集を本物にする

- 独立PagesのopenDAW Studio（`https://resonance-daw.pages.dev/`）をplatformから開けるようにする。
- platformからopenDAWを同一画面または専用編集ビューで起動する。
- `main.od` を読み込む。
- 編集後にsnapshot要求を送る。
- snapshotがない場合は提案送信を止め、明確なエラーを表示する。
- 大きなsnapshotに対してサイズ上限と圧縮を設ける。

完了条件: ブラウザ操作だけで編集し、実際のsnapshotを取得できる。

### Phase 2: GitHub認証と実PR作成

- GitHub AppまたはOAuthをWorker側に実装する。
- HttpOnly・Secureなセッションを使う。
- GitHubトークンをブラウザへ返さない。
- Worker Secretへ`GITHUB_TOKEN`またはApp秘密鍵を登録する。
- PR作成者を実ログインユーザーにする。
- API失敗時のローカル偽提案フォールバックを削除する。

完了条件: ログインユーザーがsnapshot付き提案を送り、実際の`song-demo` PRが作成される。

### Phase 3: 本物のレンダリング境界

- まずPiを使わず、固定レンダラーをCloudflare外部の専用実行環境へ置けるか検証する。
- Piを使う場合はCloudflare Tunnel経由、Workerからのみアクセスする。
- 入力SHA、openDAWコミット、renderer versionをallowlist検証する。
- PR由来のWorkflow、依存関係、任意スクリプトを実行しない。
- ジョブを1回だけ実行し、同じproposal/SHAはキャッシュする。
- 失敗・タイムアウト・再試行回数を記録する。

完了条件: base/headの実プロジェクトからWAVが生成され、Pi停止時も低負荷プレビューが動く。

### Phase 4: 音源保存とA/B試聴

- R2バケットを作成する。
- `songId/baseSha/headSha/rendererVersion/mode.wav` のキー規則を採用する。
- WorkerまたはレンダラーからR2へ保存する。
- D1へ状態、SHA、renderer version、R2キーを保存する。
- UIのAudio要素を実WAV URLへ接続する。
- A/B切り替え時に再生位置を維持する。
- 失敗時の再試行ボタンを実装する。

完了条件: 公開サイトで同じ再生位置からbase/headを聴き比べられる。

### Phase 5: リポジトリ保護と公開品質

- `main`への直接pushを禁止する。
- CODEOWNERS、PRテンプレート、ライセンスチェックを追加する。
- Webhook署名検証とイベント重複排除を実装する。
- APIのレート制限、入力サイズ制限、監査ログを追加する。
- 固定デモデータを実APIデータへ置き換える。
- 公開ドメイン、HTTPS、キャッシュ、エラーページを確認する。

### Phase 6: MVP受け入れテスト

以下をブラウザ1台で順に実施し、画面録画またはチェックリストに残す。

1. Night Transitを試聴する。
2. GitHubログインする。
3. openDAWで編集する。
4. 提案を送信する。
5. GitHub PRを確認する。
6. base/headのレンダリングを待つ。
7. A/Bで聴き比べる。
8. PR、コミット、提出者、素材情報を確認する。
9. Piを停止しても低負荷プレビューが使えることを確認する。

## 優先順位

1. SHA・曲データ・openDAWの基準値統一
2. openDAWの実読み込みとsnapshot取得
3. GitHub認証とSecret設定
4. ローカル偽フォールバック削除
5. 実PR作成の公開環境テスト
6. R2と実レンダリング
7. A/Bプレイヤー完成
8. Webhook・リポジトリ保護・監査
9. 投票やコミュニティ機能

この順序なら、先にPiへ負荷をかけずにブラウザ・Cloudflare・GitHubの基礎を完成させ、最後に必要な場合だけレンダリング環境を接続できる。
