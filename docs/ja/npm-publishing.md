# npm SDKの公開と運用

このドキュメントは、Simpludifyのリポジトリ管理者およびメンテナー向けに、`@simpludify/core` と `@simpludify/web` パッケージのビルド・検証・npm公開（Trusted Publishing）の手順をまとめたものです。利用者の導入手順は [npm SDK導入ガイド](npm.md) を参照してください。

## 公開ステータス

Core/Web **v0.1.6 はnpmレジストリに公開済み** です。物理Bindingおよび単一入力キャプチャが含まれます。次回開発マイルストーンは **v0.1.7** の予定です。詳細は [v0.1.6公開検証記録](https://github.com/oz-coden/Simpludify/blob/main/docs/work-reports/2026-11-05-v0.1.6-publication.md) を参照してください。公開済みのバージョンおよびタグはイミュータブル（不変）です。

## リリース準備と検証手順

開発時はNode 22.12以上、CIではNode 24を使用します。公開ジョブにはnpm 11.5.1以上とNode 22.14以上が必要です。

クリーンな作業ブランチから以下を実行して事前検証を行います：

```sh
npm ci
npm run version:sdk -- 0.1.6
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run test:packages
npm run test:starter
npm run pack:packages
node scripts/publish-packages.mjs
```

`node scripts/publish-packages.mjs` はアーカイブとレジストリの利用可能状態を確認するだけであり、この時点では公開は行われません。

`test:packages` はワークスペース外に一時的なプロジェクトを自動生成し、実環境でのインストールと型検査、ビルド、ブラウザ動作を厳密に検証します：
- `@simpludify/core` 単独でNode.js環境（DOM型なし）で動作すること
- `@simpludify/web` が依存関係としてCoreを正しく解決できること
- デスクトップおよび狭小画面（390px, 320px）でのCSS、公開型、UIコントロール、リソース解放が正常であること

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
3. リリース管理者の承認を得て、タグ名（例: `v0.1.6`）を確定します。
4. GitHub Actionsの **Publish experimental npm SDK** ワークフローを手動実行（`workflow_dispatch`）します。
   - タグ名と確認文字列を入力して実行します。
5. 公開ジョブは、**まず `@simpludify/core` を公開し、レジストリでの存在が確認されてから `@simpludify/web` を公開** します。
6. `test:packages:registry` を実行し、公開されたレジストリから実際にインストールして最終検証を行います。

## 関連資料

- [npm導入ガイド（利用者向け）](npm.md)
- [設計思想と責務](architecture.md)
- [制約事項とロードマップ](roadmap.md)
