# Tilemapで地形を配置する

Gridや行列で定義した地形を、SpriteSheetの画像で描画します。Tilemapは世界全体にも、一部分の床や装飾にも使えます。地面・壁・飾りは独立したTilemapを重ねます。

## 最小構成

```ts verify
import { Game, SpriteSheet, Tilemap } from "@simpludify/web";
const game = new Game();
const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { grass: 0, wall: 1 },
});
const terrain = new Tilemap({
  sheet,
  tiles: [
    ["grass", 0, 0],
    [0, "wall", null],
  ],
  tileWidth: 32,
  tileHeight: 24,
}).place(game.engine.scene);
terrain.set(2, 1, "grass");
await game.run();
```

画像には指定フレームが必要です。`place(scene)`だけで配置し、Scene破棄時には描画と画像参照を解放します。毎フレームの手動更新やTexture管理は不要です。nullは空セル、0は最初の画像フレームです。名前はSpriteSheetの定義から補完されます。任意矩形のSpriteSheetも使用できます。

## データの操作

| API                            | 意味                                                  |
| ------------------------------ | ----------------------------------------------------- |
| `get(x,y)`・`set(x,y,id)`      | 整数タイル座標による取得・変更。範囲外はGRID_BOUNDS。 |
| `fill(id)`                     | 全セルを同じID／nullへ変更。                          |
| `inBounds(x,y)`                | 有効な整数座標かを確認。                              |
| `copyTiles()`                  | 独立したGridを取得。次のSceneでも再利用可能。         |
| `width`・`height`              | セル数。サイズは構築後に変わらない。                  |
| `x`・`y`                       | ワールド上の左上位置。負の座標も指定可能。            |
| `zIndex`・`visible`・`enabled` | 表示順、可視性、配置の有効状態。                      |
| `dispose()`                    | Sceneから取り除いて破棄。                             |

行列は`tiles[y][x]`の向きです。Gridからも構築でき、どちらの入力もコピーします。外部Gridを変更しても描画キャッシュは古くなりません。変更はTilemapのset／fillから行います。タイルの表示寸法は元フレームとは独立し、セルの幅・高さへ画像を引き伸ばします。

空・不揃いの行列はGRID_SIZE、無効な名前やフレームはSpriteSheetのエラーです。画像ロード前には数値グリッドの上限を確定できないため、Webで使用中のIDを検証します。画面外セルも検証対象です。不正な実行中の変更はwhenReadyをrejectし、旧表示を保持します。正常なIDへ戻せば復帰できます。

## 座標とレイヤー

```ts verify
import { SpriteSheet, Tilemap } from "@simpludify/core";
const map = new Tilemap({
  sheet: SpriteSheet.grid("tiles.png", { frameWidth: 16, frameHeight: 16 }),
  tiles: [
    [0, null],
    [1, 0],
  ],
  tileWidth: 32,
  tileHeight: 24,
  x: -32,
  y: 48,
});
const origin = map.tileToWorld(1, 1);
const center = map.tileToWorld(1, 1, { center: true });
const tile = map.worldToTile(center.x, center.y);
console.log(origin, tile);
```

左上原点、右向きx・下向きyです。tileToWorldはタイル左上、center指定は中心を返します。worldToTileは左／上を含み、右／下を含まない範囲で切り捨て計算し、マップ外ならundefinedです。内部境界は右／下のセルに属します。画面座標は先にGame.pointerToWorldなどでワールド座標へ変換します。

地面・壁・装飾はそれぞれ作ってplaceしてください。zIndexは普通のRenderableと共通で、同値なら配置順です。Actorを地面と装飾の間に描けます。1枚のTilemap内にActorを差し込む順序制御はありません。初期版の配置は平行移動のみです。

## 所有権と描画

公開TilemapはActorを継承せず、内部で1個のActorと受動Componentを使います。既存Sceneの所有・破棄を再利用しながら、Actor.getとTilemap.getの混同を避けています。セルごとにActor／Componentを生成しません。

描画範囲のタイルだけにPixi Spriteを作ります。静止時のセル走査は0、画面内1セルの変更なら1セル更新です。画面外変更は表示範囲へ入った時に反映します。Cameraでタイル範囲が変わると現在の表示範囲を再走査します。表示中の全Spriteの描画コストは残り、特にCanvas2Dで大量のセルを全表示すると重くなります。[実測値と条件](../en/tilemap-performance.html)を確認してください。

元画像と切り出しTextureは既存の画像共有を使います。空・非表示・無効化したマップも画像参照は保持します。最後の画像参照がなくなると切り出しと元画像を解放します。ロード中の破棄やScene準備失敗も既存のキャンセル契約に従います。

## 動くサンプル

```sh
npm run dev -- --example tilemap
```

[Tile trail](../../examples/tilemap/README.md)は3枚のTilemap、WASD移動、Camera追従、足元の書き換え、座標表示、Scene往復を含みます。石・木はSolidの壁、水は通過できるTriggerです。Toggle wall aheadで生成／破壊、Toggle collisionで見た目を保ったまま衝突を切り替えられます。

衝突を使う場合は、SceneにCollisionWorldを1つ作り、動かすActorにSolid ColliderとCollisionBodyを追加します。Tilemapのcollision.tilesへIDごとの応答を設定し、setCollision(x,y,null)でセルだけ無効、resetCollision(x,y)で継承に戻せます。visibleは描画だけ、collisionEnabledは衝突だけ、enabledは配置全体を止めます。Actor用Contactは変更せず、地形用にはTileContactEnter/Stay/Exitを購読します。[詳しい契約](../en/tilemap-collision.html)と[衝突ガイド](collision.md)を参照してください。

無限マップ、エディター、オートタイル、複雑なアニメーションタイルは未実装です。完全な剛体物理やCCD、任意の深い埋まりからの復帰は保証しません。
