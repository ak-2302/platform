# re:sonance 各部分の役割と必要機能

## 1. `platform`（Cloudflare Pages）

役割: ユーザーが使うWebアプリ。本番では静的ファイルとして配信し、動的処理はWorkerへ委譲する。

必要機能:

- Night Transitの試聴
- GitHubログイン開始とログイン状態表示
- openDAWの埋め込み・起動
- openDAWからプロジェクトスナップショットを受信
- 提案作成モーダル、入力検証、送信中表示、完了表示
- PR番号、base SHA、head SHA、提出者、素材情報の表示
- base版・変更版のA/B再生
- レンダリング中・成功・失敗・再試行の表示
- API障害時の明確なエラー表示

制約:

- GitHub秘密鍵・アクセストークンを保持しない
- 音源や大きなプロジェクトを静的配信物へ埋め込まない
- ビルド成果物をCloudflare Pagesへ配信する

## 2. `opendaw`（ブラウザ内編集エンジン）

役割: ユーザーが曲を編集し、再現可能なプロジェクトファイルを作る。

必要機能:

- 固定コミットでの起動
- `song-demo/project/main.od` の読み込み
- 再生・停止・編集・保存相当の操作
- `postMessage` によるスナップショット要求の受付
- 同一オリジン検証と対象曲IDの検証
- `ProjectBundle` のbase64化とplatformへの返却
- エラー時の `resonance:project-snapshot-error` 通知

制約:

- 編集処理はユーザーのブラウザで行い、サーバーへ常時送信しない
- Raspberry Piを編集処理の常駐ホストにしない

## 3. `song-demo`（曲リポジトリ）

役割: 楽曲プロジェクト、素材、ライセンス、クレジットの正本。

必要機能:

- `song.json` に曲ID、タイトル、対応openDAWコミット、素材一覧を定義
- `project/main.od` をプロジェクト正本として管理
- `credits.json` と素材ライセンスを管理
- `main` への直接pushを禁止
- 提案は `proposal/{proposalId}` ブランチとPRで管理
- CODEOWNERSとPRテンプレートを配置
- 大容量音源はGit LFSまたはR2へ分離

## 4. `worker`（Cloudflare Worker）

役割: ブラウザとGitHub・D1・ストレージ・レンダラーの間の最小API境界。

必要機能:

- ヘルスチェックと設定状態の返却
- GitHub OAuthまたは安全なログイン連携
- `main` のbase SHA取得
- 提案メタデータのD1保存・取得
- proposalブランチ作成
- プロジェクトスナップショットのGitHub Contents API登録
- PR作成とPR情報の保存
- PRのbase/head SHA検証
- レンダリングジョブの受付と状態管理
- R2への生成物保存と署名付きまたは期限付きURL発行
- CORS、レート制限、入力サイズ制限

制約:

- GitHub秘密情報はWorker Secretだけに置く
- PR内のWorkflow、任意コード、任意依存関係は実行しない
- Piへは必要なジョブだけ送信し、ポーリングを常時実行しない
- D1にはメタデータだけを保存し、WAV本体を保存しない

## 5. D1

役割: 軽量な提案・レンダリング状態のデータベース。

必要データ:

- proposal ID、song ID、提出者
- PR番号、base SHA、head SHA
- snapshot ID、renderer version
- レンダリング状態、エラー、生成物URLまたはR2キー
- created_at、updated_at

不要なデータ:

- WAV本体
- GitHubトークン
- openDAWの一時ログ全文

## 6. GitHub App / GitHub API

役割: 認証、リポジトリ操作、PRとレビュー履歴の基盤。

必要機能:

- 最小権限のGitHub App
- 対象リポジトリ限定のContents・Pull requests権限
- base SHAの取得
- proposalブランチ作成
- `project/main.od` のコミット
- PR作成・状態取得
- Webhook署名検証
- 配信イベントの重複排除

## 7. 固定レンダラー

役割: 信頼できるopenDAWコミットと固定依存関係だけでbase版・変更版をWAV化する。

必要機能:

- 入力SHAのallowlist検証
- 固定openDAWコミットの使用
- 固定renderer versionの記録
- base/head両方のレンダリング
- タイムアウト、CPU・メモリ上限、再試行制限
- 成果物をR2へ保存

禁止事項:

- PR内のGitHub Actionsを起動しない
- PR内のpackage.jsonや依存関係をそのまま実行しない
- 未検証の外部URLからレンダラーを取得しない

## 8. R2等のオブジェクトストレージ

役割: WAVプレビュー、将来の大容量素材、レンダリングログの保管。

必要機能:

- proposal IDとSHAを含む一意なキー
- MIME typeとサイズの記録
- 期限付き再生URL
- 世代管理・古いプレビューの削除
- 公開範囲の制御

## 9. Raspberry Pi / Tailscale Tunnel（予備）

役割: Cloudflareだけでは実行できない処理の非常用レンダリング先。

必要機能:

- Workerから認証済みジョブだけ受信
- 1ジョブずつ処理するキュー
- 結果をWorkerへ返してすぐ終了
- ヘルスチェックは低頻度
- Tailscale Tunnel経由の非公開接続
- ローカルキャッシュとCPU・メモリ上限

負荷抑制:

- 常駐の監視ループを置かない
- ブラウザからPiへ直接アクセスさせない
- 同一SHAの重複レンダリングを避ける
- Cloudflare側の低負荷プレビューを先に使う
- PiはCloudflareレンダラーが利用できない場合だけ使う

## 10. Cloudflare Pages / DNS

役割: 静的Webアプリの配信と独自ドメインの入口。

必要機能:

- GitHub `main` からのPagesデプロイ
- 動的処理をPages Functionsへ過度に寄せずWorkerへ集約
- `resonance.xn--n8jl2g.xn--q9jyb4c` のDNS設定
- HTTPS、キャッシュ、圧縮
- プレビュー環境と本番環境の分離

## 11. 受け入れテスト

ブラウザだけで次を確認する。

1. Night Transitを試聴できる。
2. GitHubログインできる。
3. openDAWで編集できる。
4. 提案からGitHub PRを作成できる。
5. base版・変更版のレンダリング状態を確認できる。
6. A/Bで両方を再生できる。
7. PR、コミット、提出者、素材情報を確認できる。
8. Piを停止しても、Piに依存しない画面と低負荷プレビューが動作する。
