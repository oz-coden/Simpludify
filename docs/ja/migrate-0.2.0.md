# Simpludify v0.1.7からv0.2.0への移行

v0.2.0は未公開のSDK候補です。CoreとWebのバージョンを揃え、lockfileも更新します。ソースから試す場合は、[配布アーカイブでの検証手順](npm.md)に従ってください。

## 1. Scene遷移と既存の画像URL

Scene遷移は引き続き `game.changeScene(id)` を使います。既定では切り替え前のSceneを破棄し、再入場時は新しいインスタンスを作成します。入力Bindingや、URLを直接指定したRenderable・SpriteSheet・Tilemapはこれまでどおり動作します。

別のSceneへ移動しても進行状態を維持する場合は、対象のSceneに保持を指定します。setupはインスタンスごとに一度実行されます。非アクティブ時は描画と通常の入力が止まり、Actor・Asset・シミュレーションのタイマーとTweenは保持されます。再入場時に活性化フックが再実行され、表示が再構築されます。遷移で再スタートしたいSceneは既定の破棄設定を使います。

```ts verify
import { Game, Label } from "@simpludify/web";

const game = new Game<"menu" | "play">();
game.scene("menu", ({ ui }) => ui(Label("Menu")));
game.scene("play", ({ ui }) => ui(Label("Play")), { retention: "retain" });
await game.run("menu");
await game.changeScene("play");
```

## 2. Assetの所有者を選んでロードする

Sceneが所有する素材は、setupが受け取る `assets` からロードします。ゲーム全体で共有する素材は `game.assets`、一時的なロードのまとまりには `game.assets.scope()` を使います。別の所有者へ渡すときは、その所有者が参照を取得するまでハンドルを保持します。保持SceneのスコープはSceneの破棄まで存続します。

```ts verify
import { Actor, Game, Renderable, Transform } from "@simpludify/web";

const game = new Game<"stage">({ assets: { cacheEntries: 8 } });
game.scene("stage", async ({ add, assets }) => {
  const image = assets.load({ kind: "image", url: "./hero.png" });
  const rules = assets.load({ kind: "json", url: "./rules.json" });
  await Promise.all([image.ready, rules.ready]);
  // rules.valueはアプリケーションのデータとして使う前に検証します。
  const actor = add(new Actor());
  actor.add(new Transform({ x: 100, y: 100 }));
  actor.add(new Renderable({ source: image.source }));
});
await game.run("stage");
```

既定のRendererでは、初回ロード時に同じURLの画像を暗黙ロードと共有します。Fallbackや差し替えを描画に反映するには、`image.source` を使います。SpriteSheetやTilemapでは `image.source.url` を使用します。元のURLを直接渡す場合は従来どおりの暗黙ロードです。[Assetの設定・進捗・Retry](api.md#asset管理)。

## 3. AudioやGame標準フォントを追加する

音声とフォントも共通のAsset APIでロードします。Sceneの破棄に合わせて音を止める場合は、再生の所有者にSceneを指定します。保持Sceneでは非アクティブ時も再生の所有権が残ります。離脱時に音を止めて再入場で続ける場合は、ライフサイクルのフックから `pause()` と `resume()` を呼びます。ブラウザが自動再生を制限している間は、信頼された操作まで再生が待機することがあります。

```ts verify
import { Game } from "@simpludify/web";

const game = new Game<"stage">();
const font = game.assets.load({ kind: "font", url: "./ui.woff2" });
game.setFont(font);
font.release(); // リセットまたは破棄までGameが独立した参照を保持します。

game.scene(
  "stage",
  ({ assets, scene, onActivate, onDeactivate }) => {
    const theme = assets.load({ kind: "audio", url: "./theme.ogg" });
    const voice = game.audio.play(theme, {
      owner: scene,
      group: "music",
      loop: true,
    });
    game.audio.group("music").volume = 0.6;
    onDeactivate(() => voice.pause());
    onActivate(() => voice.resume());
  },
  { retention: "retain" },
);
await game.run("stage");
```

[Audio・同時再生上限・フォント登録](api.md#audioとフォント)。

## 4. 構造化された診断に移行する

従来の `GameOptions.onError` は既存の実行時エラーを引き続き受け取りますが、非推奨です。新しいコードではGameを起動する前に `game.logger` を購読します。`run()` と `changeScene()` が返すPromiseの拒否は従来どおり呼び出し元で処理します。Console出力は購読者と独立して無効にできます。

```ts verify
import { Game, Lifetime } from "@simpludify/web";

const reporting = new Lifetime();
const game = new Game({ logging: { console: false } });
game.logger.subscribe((entry) => {
  if (entry.fatal) console.warn(entry.message);
}, reporting);
await game.run();
// 購読元を取り除くときにreportingを破棄します。
```

エンジンの既定出力には要約を使います。診断を購読すると元の原因や詳細を参照できます。[Loggerの設定と所有権](api.md#loggerと診断)。
