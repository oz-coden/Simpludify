# 導入と最初のゲーム

このページでは、ソースワークスペースを取得して既存サンプルから始めます。エンジンのコピーなしで独立プロジェクトを作る場合は[npm SDK・配布アーカイブからの導入](npm.md)を参照してください。公開済みSDKと現在のソースはv0.1.6です。次の開発マイルストーンはv0.1.7の予定です。統一入力・ゲームパッドAPIや入力Binding・仮想入力もnpmから利用できます。

## 必要な環境

- Node.js 22.12以上とnpm。CIはNode 24を使用します。
- WebGL、ResizeObserver、ES2022に対応するブラウザを中心に検証します。
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

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";

const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
```

`examples/character/index.html`がページの高さとエントリーポイントを用意しています。既存例のHTMLをそのまま使えます。

```html
<style>
  html, body, #app { margin: 0; width: 100%; height: 100dvh; }
</style>
<main id="app"></main>
<script type="module" src="./main.ts"></script>
```

### コードの解説

1. **`new Game()`**: ブラウザ上で動作するゲーム全体を初期化します。描画キャンバス（PixiJS）の生成やキーボード・マウスの監視を自動的にセットアップします。
2. **`defineActions` と `ActionController`**: キーの物理位置（W/A/S/Dキー）とゲーム上の意味（移動する: `Move`）を分離して定義します。これにより、キーボードだけでなくゲームパッドやスマホのタッチ操作でも同じコードでキャラクターを動かせます。
3. **`Character({ movement: ... })`**: 位置（Transform）・見た目（Renderable）・移動（Motion）がセットになった、すぐに使える標準キャラクターのプリセットです。画像を指定しない場合でも、ミント色の四角形プレースホルダーが表示されます。
4. **`game.add(...)` と `await game.run()`**: 画面にキャラクターを配置し、ゲームループ（メインループ）を開始します。

### 画面表示と座標の基本

- **論理解像度（800 × 450）**: ゲームの基準となる仮想画面サイズです。ブラウザのウィンドウがどんな大きさでも、アスペクト比を維持したまま自動的に画面内に収まるように拡縮（Fit）されます。
- **世界座標**: キャラクターの初期位置は `(400, 225)` で、800×450の画面中央に配置されます。速度の既定値は `180` 単位/秒、サイズは `32` です。
- **HTMLと高さ**: ゲームを描画する `#app` 要素には、CSSで高さ（`height: 100dvh` や `height: 100%`）を指定する必要があります。高さが0だと画面が表示されないため注意してください。
- 詳しい速度変更や独自Componentへの拡張は[移動とComponent](./specs/movement.md)を参照してください。

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
- キーが効かない：ゲーム領域へフォーカスします。標準Button上ではEnter／SpaceはUI操作、WASD等の未消費キーはゲーム操作です。文字・数値・Selectの編集中はゲームキーを解放します。Tabで編集欄から移動し、新たにキーを押してください。
- 画像がない：選択したサンプルの`public/`へ置くかViteでimportし、サブパスを考慮します。
- もっと詳しい診断：`npm run doctor -- --json`。未実装のWindowsターゲットは成功扱いになりません。
