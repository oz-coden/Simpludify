# 導入と最初のゲーム

ソースワークスペースを取得し、既存の最小サンプルを編集して始めます。`npm install @simpludify/web`で導入する公開SDKではありません。

## 必要な環境

- Node.js 22.12以上とnpm。CIはNode 24を使用します。
- WebGL、ResizeObserver、ES2022に対応するブラウザ。
- 自動検証対象はChromiumです。Safari・Firefox・実機スマートフォン全般の動作保証はありません。

```sh
git clone https://github.com/oz-coden/Simpludify.git
cd Simpludify
npm ci
npm run dev -- --example character
```

表示された `http://127.0.0.1:4173` を開き、ゲーム領域をクリックするかTabで選択し、WASDで移動します。

## 最初のコード

`examples/character/main.ts`の本体です。サンプル共通の起動補助を除いたSDKの使い方は次のとおりです。

```ts
import { Character, Game, Movement } from "@simpludify/web";

const parent = document.querySelector<HTMLElement>("#app")!;
const game = new Game({ parent });
game.add(Character({ movement: Movement.WASD }));
await game.run();

// ページからゲームを取り除くときに呼ぶ。
window.addEventListener("pagehide", () => game.dispose(), { once: true });
```

`examples/character/index.html`がページの高さとエントリーポイントを用意しています。既存例のHTMLをそのまま使えます。

```html
<style>
  html, body, #app { margin: 0; width: 100%; height: 100dvh; }
</style>
<main id="app"></main>
<script type="module" src="./main.ts"></script>
```

`Character`はTransform・Renderable・Motion・KeyboardControllerのプリセットです。画像なしでもプレースホルダーを表示できます。既定位置は世界座標(400,225)、速度は180単位/秒、サイズは32です。`Game`の既定の論理解像度は800×450です。

## 別のゲーム用ディレクトリをつくる

```sh
npm run create -- ../my-game
cd ../my-game
npm ci
npm run dev
```

既存ディレクトリには上書きしません。エンジンソース・ツール・文書をコピーする方式です。エンジン更新は自動反映されません。UIを作るなら`examples/ui-scenes/main.ts`、収集ゲームなら`examples/signal-run`を参照してください。

## 検証と配信

```sh
npm run check
npm test
npm run build -- --target web --example character --base /my-game/
```

ゲーム単体の出力は`dist/`です。`LICENSE.txt`、`THIRD-PARTY-NOTICES.txt`、`sbom.json`を含む全ファイルを静的ホストへ置きます。ルート配信では`--base /`、相対配置には既存CLIの既定`./`を使えます。

公式サイトと全サンプルの統合出力は別コマンドです。

```sh
npm run site:build -- --base /Simpludify/
npm run site:serve
```

サーバーの表示URLに`/Simpludify/`を付けて開きます。詳細は[ビルドと公開](hosting.md)を参照してください。

## 困ったとき

- 真っ暗・起動エラー：WebGLとブラウザのハードウェアアクセラレーション設定を確認します。起動に失敗したサンプルは案内を表示します。
- キーが効かない：ゲーム領域へフォーカスします。ネイティブのボタン上ではキーが通常のUI操作に使われます。
- 画像がない：選択したサンプルの`public/`へ置くかViteでimportし、サブパスを考慮します。
- もっと詳しい診断：`npm run doctor -- --json`。未実装のWindowsターゲットは成功扱いになりません。
