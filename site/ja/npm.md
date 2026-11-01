# npm SDKからゲームを始める

SimpludifyのExperimental v0.1.0は、`@simpludify/core`と`@simpludify/web`に分かれたESM SDKです。0.xではAPIが変更される可能性があります。内部ファイルの直接importは公開APIではありません。

**公開状態：npm初回公開の準備中です。以下のレジストリからのインストール手順は、両パッケージの公開確認後に利用できます。** 公開前にSDKを試す場合は、検証済みの配布アーカイブを使ってください。

## 1. 必要な環境とパッケージ

- 開発用のNode.js 22.12以上とnpm。CIではNode 24を使用します。
- ES2022、ResizeObserverに対応したモダンブラウザ。自動動作検証の対象はChromium/WebGLです。他ブラウザの互換性は未確認です。
- Viteなど、ESMとCSS importを扱うブラウザ用バンドラー。

| パッケージ | 内容 |
| --- | --- |
| `@simpludify/core` | Scene・Actor・Component、Grid・Geometry・Tilemap、Collision、Tween・Animation、Event・Timer、Camera、Canvas UIのモデル。DOM・PixiJSへの依存なし。Node.jsでも利用可能 |
| `@simpludify/web` | Game、PixiJS描画、ブラウザ入力、Canvas UI・DOM UIの表示。Core APIを再export。CoreとPixiJSは依存として自動導入 |

ブラウザゲームではWebだけをインストールすれば使えます。CommonJS、Node/SSR上でのWeb起動、Electron/Tauriの配布ツール、エディター、画像素材、リポジトリ専用CLIは含みません。

## 2. 独立したViteプロジェクトを作る

両パッケージのnpm公開を確認してから実行します。

```sh
mkdir my-game
cd my-game
npm init -y
npm pkg set type=module
npm pkg set scripts.dev=vite scripts.build="tsc --noEmit && vite build" scripts.preview="vite preview"
npm install @simpludify/web@0.1.0
npm install --save-dev vite@8.3.5 typescript@7.0.2
```

`index.html`を作成します。親要素の高さはアプリケーション側で指定します。

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Simpludify game</title>
    <style>html, body, #app { margin: 0; width: 100%; height: 100%; }</style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

`tsconfig.json`を作成します。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["main.ts"]
}
```

`main.ts`を作成します。

```ts
import {
  Action, ActionController, CanvasButton, CanvasColumn, CanvasLabel,
  Character, defineActions, Game, KeyboardBindings,
} from "@simpludify/web";

const game = new Game({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
const actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(actions.Move) }));
game.canvasUI(CanvasColumn([
  CanvasLabel("My first game"),
  CanvasButton("Pause", () => game.pause()),
  CanvasButton("Resume", () => game.resume()),
], { padding: 16, gap: 12 }));
await game.run();

// ページからゲームを取り除く際は game.dispose() を呼びます。
```

```sh
npm run dev
```

ターミナルに表示されたURLを開きます。ゲーム領域をクリック、またはTabで選択してからWASDで移動します。Canvas UIのボタンはポインター・キーボードで操作できます。

## 3. CSS・画像・終了処理

Webのエントリーは、スコープ付き標準CSSを自動importします。明示的なimportも利用できます。

```ts
import "@simpludify/web/style.css";
```

利用側でCSSを副作用なしとして除去しないでください。標準CSSはページ全体のリセットや親要素の高さを設定しません。独自画像はViteのimport、または`new URL("./player.png", import.meta.url).href`などでアプリケーション側から提供します。SDK内部のソースやサンプル素材へのパスを参照しないでください。

Sceneは所有するActor・入力・イベント・UI・画像リソースを破棄します。画面遷移にはGameのScene APIを使い、ゲーム全体を取り除くときは`game.dispose()`を呼びます。Reactなどへの組み込みでもコンポーネントの終了処理で呼び出します。

## 4. 本番ビルドと静的公開

```sh
npm run build
npm run preview
```

サブディレクトリに配置する場合は`npm run build -- --base /my-game/`ではなく、`npx tsc --noEmit`の後に`npx vite build --base /my-game/`を実行します。`dist/`全体を静的ホストへ配置します。依存のライセンス表記は配布アプリケーション側でも維持してください。SDKにはMITライセンスが含まれ、PixiJSなどの依存はそれぞれのライセンスに従います。

## 5. 公開前の配布アーカイブを使う

リポジトリ管理者は`npm ci`、`npm run pack:packages`で2つの`.tgz`を生成できます。独立したゲームプロジェクトには、エンジンのソースコピーをせずにアーカイブを導入できます。

```sh
npm install /path/to/simpludify-core-0.1.0.tgz
npm install /path/to/simpludify-web-0.1.0.tgz
```

公開前はCoreを先に導入します。Webの依存宣言は正式な`@simpludify/core@0.1.0`なので、Coreが未導入・未公開だとレジストリ解決に失敗します。公開後はWebだけの導入で依存が自動解決されます。

## 6. 互換性と制約

- ESMとTypeScript型定義を配布します。`dist`内部パスへの直接importやCJSの`require()`はサポートしません。
- JavaScript source mapには元ソースを埋め込んでいます。型定義mapは配布しません。
- Core/Webは同じ0.1.0を使用します。WebがCoreを再exportするため、通常はWebからまとめてimportできます。
- Coreの公開型はDOM/Node ambient型なしでも検証します。WebはブラウザのDOM型と実行環境が必要です。
- 対応範囲の詳細は[制約](limitations.md)、[API](../../docs/api.md)、[Core/Host境界](../../docs/host-boundary.md)を参照してください。

[GitHubリポジトリ](https://github.com/oz-coden/Simpludify) · [ソースからの開発](getting-started.md)
