# npm SDKの公開と運用

このドキュメントは、Simpludifyのリポジトリ管理者およびメンテナー向けに、`@simpludify/core` と `@simpludify/web` パッケージのビルド・検証・npm公開（Trusted Publishing）の手順をまとめたものです。利用者の導入手順は [npm SDK導入ガイド](npm.md) を参照してください。

## 公開ステータス

Core/Web **v0.3.0はnpmレジストリで公開済み**です。[v0.3.0公開記録](../work-reports/2026-11-13-v0.3.0-world-queries.md#publication)と[v0.2.0への移行ガイド](migrate-0.2.0.md)を参照してください。公開済みのバージョンとタグは変更できません。

## リリース準備と検証手順

開発時はNode 22.12以上、CIではNode 24を使用します。公開ジョブにはnpm 11.5.1以上とNode 22.14以上が必要です。

クリーンな作業ブランチから以下を実行して事前検証を行います：

```sh
npm ci
npm run version:sdk -- <version> # 例: 0.1.7
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run pack:packages
npm run test:packages -- --packed
npm run test:starter -- --packed
node scripts/publish-packages.mjs
```

`node scripts/publish-packages.mjs` はアーカイブとレジストリの利用可能状態を確認するだけであり、この時点では公開は行われません。

`test:packages` はワークスペース外に一時的なプロジェクトを自動生成し、実環境でのインストールと型検査、ビルド、ブラウザ動作を厳密に検証します：
- `@simpludify/core` 単独でNode.js環境（DOM型なし）で動作すること
- `@simpludify/web` が依存関係としてCoreを正しく解決できること
- デスクトップおよび狭小画面（390px, 320px）でのCSS、公開型、画像・JSONの明示ロード、UIコントロール、リソース解放が正常であること

通常CIは現行ソースから候補を一組生成し、WindowsとLinuxの両方でパッケージとViteスターターを検証します。配布用スターターのlockfileは公開済みの版を固定します。候補検証では一時コピー内のSDK依存を差し替えてから `npm ci` を実行します。Run To Exitは固定したアプリのソースで型検査・単体テスト・本番ビルドを一度行い、同じビルドを3つの画面幅とWebGL・Canvas2Dで検証します。

公開版を個別に確認する場合は、対象バージョンと一致するソースrefで **Verify published npm SDK** を実行します。ローカルでは該当ソースから `npm run test:packages:registry` と `npm run test:starter:registry` を実行します。それぞれ空のnpmキャッシュから検証を始めます。スターターの公開版の固定値が対象バージョンと異なる場合は、一時コピーのlockfileだけを更新します。

## Trusted Publishing（OIDC）の構成

GitHub Actionsとnpmの連携には長期トークン（APIキー）を使わず、**GitHub ActionsのOIDC（Trusted Publishing）** を利用します。ワークフローは `.github/workflows/npm-publish.yml` で管理され、手動トリガー（`workflow_dispatch`）でのみ実行されます。

npmのパッケージ設定（Settings → Trusted publishing）は両パッケージで以下と一致している必要があります：

| 項目              | 設定値                       |
| ----------------- | ---------------------------- |
| GitHub user       | `oz-coden`                   |
| Repository        | `Simpludify`                 |
| Workflow filename | `npm-publish.yml`            |
| Environment       | （空欄：環境指定なし）       |
| Allowed actions   | Direct `npm publish` enabled |

## 承認と手動公開ワークフロー

1. すべてのCIテストが通過したコミットのみを対象とします。`main` ブランチのコミットSHAを確定し、CIが成功していることを確認します。
2. 候補アーカイブ（`.tgz`）を生成・検査し、SHA512チェックサム、エクスポート一覧、ライセンス表記、型定義を確認します。
3. リリース管理者の承認を得て、両パッケージのバージョン、公開対象のコミットSHA、タグ名（`v<version>`）を確定します。
4. 対象SHAが `main` のHEADで、同じSHAのpush CIが成功した状態で **Create approved SDK tag** を実行します。タグ名、SHA、確認文字列（`create TAG at SHA`）を入力します。続けて `main` から **Publish experimental npm SDK** を手動実行します。
   - タグ名（`v<version>`）と確認文字列（`publish @simpludify/core@<version> and @simpludify/web@<version>`）を入力して実行します。
5. 公開ジョブは、**まず `@simpludify/core` を公開し、レジストリでの存在が確認されてから `@simpludify/web` を公開** します。
6. 両パッケージの公開後、独立したレジストリ検証ジョブがパッケージとスターターをクリーンインストールして検証します。結果は `npm-sdk-registry-acceptance` アーティファクトとジョブログで確認できます。

## 関連資料

- [npm導入ガイド（利用者向け）](npm.md)
- [設計思想と責務](architecture.md)
- [制約事項とロードマップ](roadmap.md)
