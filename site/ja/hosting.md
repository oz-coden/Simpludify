# ビルド・公開・通信

ゲーム単体のCLIと、公式サイト全体のビルドは別です。ホスティング先を変えてもゲームロジックを変更する必要はありません。

## 統合サイトをビルドする

```sh
npm ci
npm run site:build -- --base /Simpludify/
npm run site:check
npm run site:serve
```

`site-dist/`に日本語・英語文書、共有CSS/JS、`play/character/`・`play/ui-scenes/`・`play/composition/`・`play/signal-run/`、ライセンス・依存一覧を出力します。表示されたローカルURLの`/Simpludify/`を開きます。

`SITE_BASE`環境変数、または`--base`で配信パスを指定します。既定は`/Simpludify/`、独自ドメインのルートなら`/`です。安全に予測できる絶対パスに限定し、末尾`/`を必須にしています。

```sh
npm run site:build -- --base /
```

出力全体を任意の静的ホストへ置けます。`.site-build/`と`site-dist/`だけを生成し直し、既存CLIの`dist/`は変更しません。`file://`で直接開かずHTTP(S)で配信してください。

## 技術選定

既存のVite 8で複数HTMLと4サンプルをビルドし、Markdownはmarkdown-itで静的HTMLへ変換します。文書表示にVueやReact、実行時Markdown変換は不要です。VitePressも比較しましたが、確認時の安定版1.6.4は別のVite 5とVue等を追加するため、今回は小規模な構成を選びました。

ページ一覧・言語・サンプル定義は`site/config.mjs`、日本語本文は`site/ja/`です。既存英語文書を直接取り込み、複製によるずれを防ぎます。本文内の相対Markdownリンクはビルド時にサイトのルートへ変換します。見つからないリポジトリ内資料はGitHubへリンクし、全ローカルリンクとanchorを検査します。

## GitHub Pages

`.github/workflows/pages.yml`はmain・作業ブランチ・PRで型検査、単体テスト、統合本番ビルド、リンク・アセット検査、既存エンジンとPC/狭幅サイトのブラウザテストを実行し、成果物を保存します。mainまたはmain上の手動実行のみデプロイします。既存CIも継続して実行します。

PagesのSourceは**GitHub Actions**を選びます。構成アクションでPagesを自動作成せず、未有効なら設定不足として失敗します。デプロイjobだけが`pages: write`と`id-token: write`を持ち、通常の検証jobは`contents: read`のみです。公開対象は`site-dist/`全体です。

既定の公開先は`https://oz-coden.github.io/Simpludify/`です。公開の可否と検証結果は[サイト運用記録](https://github.com/oz-coden/Simpludify/blob/main/docs/site-validation.md)で確認できます。ソースが公開であることと、Pagesで公開が有効であることは別です。

## 独自ドメインへの移行

GitHub Pages以外でも出力を配信できます。独自ドメインを利用するならActionsの`SITE_BASE`を`/`など実際のパスへ合わせて再ビルドします。Pages側のドメイン・DNS・証明書は管理者が別途設定してください。このリポジトリのビルドはDNS変更やCNAMEを自動追加しません。

## サーバーなしとネットワークの違い

| 概念                       | 現在の意味                                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| 静的配信                   | HTML/JS/CSS/アセットを配る。配信元のHTTPサーバーは必要                      |
| 外部サービスなしの単体動作 | 読み込み後、サンプルのゲーム進行にAPI・AI・認証・ゲームサーバーは不要       |
| オンライン通信             | 静的なクライアントでも外部API等に接続可能。ただしエンジンの通信機能は未実装 |
| 専用ゲームサーバー         | 全ゲームで必須ではない。将来の方式の選択肢                                  |

Service Workerやオフラインインストールは実装していません。「外部サービス不要」は初回ダウンロードや配信元まで不要という意味ではありません。将来のP2P・プレイヤーホスト・専用サーバーでは、通信方式・実行場所・状態の権威を分けて設計します。
