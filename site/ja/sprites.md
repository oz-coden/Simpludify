# SpriteSheet・SpriteAnimation

1枚の画像の切り出しからアニメーション再生まで、エンジンがフレームを管理します。Coreに画像やPixiのオブジェクトを持ち込まず、既存のRenderable・画像共有・Scene破棄の仕組みに接続します。

## 少ないコードで再生する

```ts verify
import { Character, Game, SpriteAnimation, SpriteSheet } from "@simpludify/web";
const sheet = SpriteSheet.grid("hero.png", { frameWidth: 32, frameHeight: 32 });
const game = new Game();
const player = game.add(Character({ source: sheet.get(0) }));
const animation = player.add(
  new SpriteAnimation({
    sheet,
    clips: {
      idle: { frames: [0, 1], fps: 4 },
      walk: { frames: [2, 3, 4, 5], fps: 8 },
    },
    initial: "idle",
  }),
);
animation.play("walk");
await game.run();
```

上の例には実際に6フレーム以上を含む画像が必要です。`play("walk")`だけで画像が切り替わります。同じ再生中／一時停止中クリップへのplayは進行を保つため、移動状態に応じて毎ステップ呼べます。別のクリップは先頭から開始します。

手動構成するActorにはTransform・Renderableを先に追加してください。プレースホルダーのRenderableへ後からアニメーションを追加すると既存の色を維持するため、無着色なら`color: 0xffffff`を指定します。

## 切り出しと名前

```ts verify
import { SpriteSheet } from "@simpludify/core";
const grid = SpriteSheet.grid("hero.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { idle: 0, walk: 2 },
});
grid.get("idle");
const atlas = SpriteSheet.rects("atlas.png", {
  face: { x: 40, y: 8, width: 16, height: 16 },
  body: { x: 0, y: 0, width: 24, height: 32 },
} as const);
atlas.get("face");
atlas.get(1); // 定義順のbody
```

- 元画像の自然なピクセル寸法を使い、左上原点・右向きx・下向きyです。座標は0以上、幅・高さは1以上の安全な整数です。
- グリッドの番号は0始まりで左から右、上から下です。画像の幅・高さがセル寸法で割り切れない場合はエラーにします。
- 任意矩形は重なっていても利用できます。配列による数値参照も可能です。回転・余白除去・ピボットのAtlasメタデータは扱いません。
- `get()`の結果はそのまま`Renderable.source`に指定できます。名前はオブジェクトのキーから推論します。別変数に定義するときは`as const`を使えます。
- 不明な名前・既知の矩形インデックスは即座にエラーです。グリッド上限と画像境界は画像ロード後に、要求されたフレームを検証します。未使用フレームを先読み検証しません。`count`は矩形定義の個数で、未ロードのgridではundefinedです。

不正な定義はSPRITE_FRAME_INVALID、不明な参照・画像外領域はSPRITE_FRAME_BOUNDSです。実行中の境界エラーは`Game.whenReady()`をrejectし、旧表示を維持します。正常なsourceへ変更すれば復帰できます。

## 再生操作

| API                                | 動作                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `play(name)`                       | 別クリップは先頭へ。同じ再生中／一時停止中クリップは維持。停止済み／完了済みなら再開始。 |
| `play(name, { restart: true })`    | 同じクリップでも先頭へ戻す。                                                             |
| `pause()`・`resume()`              | 現在位置で一時停止し、そこから再開。resumeは一時停止中だけ有効。                         |
| `stop()`                           | 選択中クリップの先頭を表示して停止。完了通知は発生しない。                               |
| `state`                            | playing / paused / stopped / completed。                                                 |
| `current`・`frameIndex`・`elapsed` | クリップ名、クリップ内の番号、シミュレーション秒。                                       |

`fps`または`frameSeconds`で等間隔の速度を設定します。既定は8fps・ループ有効・最初のクリップを自動再生です。`loop: false`は最後のフレームの表示時間まで再生し、そのフレームを保持します。オプションの`onComplete: (name) => { ... }`は1回だけ同期呼び出しし、次のplayやActor破棄も可能です。必要なクリップは作成時にまとめて登録し、定義はコピーします。

更新はLateUpdateで行い、Gameのシミュレーション時間に従います。大きなdeltaでもループ回数分の処理をせず最終フレームへ進みます。GameのpauseやActor／Componentのdisableは時間の進行を止めます。画像ロード完了の順序でゲーム時間を変えません。

再生中はsourceをアニメーションが設定します。手動でsourceを変更すると次の更新で現在フレームへ戻るため、手動表示はpause／stop／disable／Component削除後に行ってください。サイズ・色・透明度・表示・奥行き・Transformは自由に変更できます。アニメーション削除後も最後のsourceはRenderableに残ります。画像を解放するにはActor／Renderableを破棄するか別sourceを選びます。

## 共有と解放

同じURLの元画像はRenderer内で共有し、切り出し矩形のTextureも共有します。フレーム変更でロードや利用参照の再取得は発生しません。各Actorの再生状態・色・位置は独立しています。最後の画像利用参照がなくなると切り出しTexture、元Texture、TextureSourceを解放します。ロード中の破棄・古い完了結果・Scene遷移も既存のキャンセル契約に従います。SpriteSheet自体は定義だけなのでdispose不要です。

隠した／無効化したRenderableは画像参照を保持します。使用済みの切り出し矩形は元画像の最後の参照までキャッシュするため、同じ画像で無制限に異なる矩形を作る用途は避けてください。`diagnostics.textures`は元画像の数で、切り出しTexture数やGPUメモリ量ではありません。

## 実動作サンプル

```sh
npm run dev -- --example sprites
```

[Sprite garden](../../examples/sprites/README.md)はWASD移動に応じた待機／歩行、同じ画像を共有する仲間、再生操作、Scene往復を含みます。元画像もリポジトリのMITライセンスによるオリジナル素材です。ブラウザテストではデスクトップ／幅390px、WebGL／Canvas2Dで実画素・操作・遅延完了・解放を検証します。

詳細なAPI契約と制約は[英語リファレンス](../en/sprites.html)を参照してください。Atlasパーサー、GUI、可変フレーム時間、汎用状態機械・制御権、事前ロードは今回の対象外です。
