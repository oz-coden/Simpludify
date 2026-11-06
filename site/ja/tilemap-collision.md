# Tilemapの地形衝突

Tilemapの衝突判定は、Core側で同期的に動作する軽量なシミュレーション機能です。Sceneが所有する1つの `CollisionWorld` が、Actor同士の接触だけでなく、Actorと地形タイルの接触判定、位置補正、接触イベントの配信を一括して処理します。画像やCamera、Pixiの描画オブジェクトは衝突判定に関与しません。

## 最小限の利用例

```ts verify
import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  Scene,
  SpriteSheet,
  TileContactEnter,
  Tilemap,
  Transform,
} from "@simpludify/core";

const scene = new Scene("field");
const world = new CollisionWorld(scene);

const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { grass: 0, wall: 1, water: 2 },
});

// 地形タイルの定義と衝突ポリシーの設定
const terrain = new Tilemap({
  sheet,
  tiles: [["grass", "wall", "water"]],
  tileWidth: 32,
  tileHeight: 32,
  collision: {
    tiles: [
      { tile: "wall", response: CollisionResponse.Solid },
      { tile: "water", response: CollisionResponse.Trigger },
    ],
  },
}).place(scene);

// プレイヤーの配置
const player = scene.add(new Actor());
player.add(new Transform({ x: 20, y: 16 }));
player.add(new CollisionBody());
const collider = player.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 10,
    response: CollisionResponse.Solid,
  }),
);

// 地形接触イベントの購読
collider.events.on(TileContactEnter, (contact) => {
  console.log(
    contact.map === terrain,
    contact.tileX,
    contact.tileY,
    contact.response,
  );
});

console.log(world.tileContactsFor(collider));
```

通常の `Motion` は衝突判定の前に移動を積分するため、毎フレーム手動で地形を検索したり位置補正を呼ぶ必要はありません。壁でプレイヤーが停止するのは、**地形側とActor側の双方がSolid** であり、かつプレイヤーが有効な動的 `CollisionBody` を持っている場合のみです。既存のColliderの初期設定はTriggerのままです。

## ルール、セル上書き、API

`collision.tiles` には `{tile, response, layer?, mask?}` の配列を渡します。responseは必須で、layerの既定値は1、maskは0xffffffffです。タイルの指定にはSpriteSheetで定義された名前（文字列）またはインデックス（数値）がそのまま使えます。

| メソッド / プロパティ          | 内容                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `getCollision(x, y)`           | 指定座標の正規化された有効なセルポリシー（またはnull）を取得します。                         |
| `setCollision(x, y, policy)`   | 特定のセルに対して明示的なポリシー上書きを設定します（画像なしセルに壁を設けることも可能）。 |
| `setCollision(x, y, null)`     | セルを明示的な「衝突なし」に設定し、画像IDの既定値を無効化します。                           |
| `resetCollision(x, y)`         | セルの上書きを解除し、現在の画像IDの既定ポリシーに戻します。                                 |
| `setTileCollision(id, policy)` | タイルID単位の既定ポリシーを変更します（nullで削除）。マップ全体の再構築は不要です。         |
| `collisionEnabled`             | 地形衝突判定の有効/無効フラグ（既定値はtrue）。ルールなしの場合は常に衝突しません。          |
| `collisionRevision`            | 衝突設定の変更世代番号。接触判定の同一性ではなく設定の更新追跡に使用します。                 |

### 表示と衝突フラグの関係

| フラグ                     | 描画表示 | 衝突判定             |
| -------------------------- | -------- | -------------------- |
| `visible = false`          | 非表示   | 判定する（変更なし） |
| `collisionEnabled = false` | 表示     | 除外される           |
| `enabled = false`          | 除外     | 除外される           |

## Actor接触イベントと地形接触イベントの分離

Actor同士の接触イベントと地形タイルの接触イベントは、型が明確に分かれています：

- **Actor同士のイベント:** `ContactEnter` / `ContactStay` / `ContactExit`
  - プロパティ: `contact.self`, `contact.other`, `contact.selfActor`, `contact.otherActor`
- **地形タイルのイベント:** `TileContactEnter` / `TileContactStay` / `TileContactExit`
  - プロパティ: `contact.self`, `contact.selfActor`, `contact.map`, `contact.tileX`, `contact.tileY`, `contact.tileId`, `contact.policy`, `contact.normalX`, `contact.normalY`, `contact.depth`, `contact.response`

地形との接触では、偽のActorインスタンスを作ったり、型定義をnullableにするような複雑化は行われません。Actor側Colliderのイベントバスで直接 `TileContact` を受信できます。

## 性能とチャンク矩形探索

- 既定のWorldは近傍セルの直接参照で判定します。
- 広大なマップや高速移動時の最適化として、16×16チャンク単位の矩形候補探索（`chunkRectangles: true`）を有効にできます。
- 同一ポリシーの連続したセルが大きな矩形としてまとめられ、交差判定回数を最小限に抑えます。

## 制約事項

- **剛体物理ではありません:** 反発係数、摩擦、重力、回転モーメント、CCD（連続衝突判定）は含まれません。
- **矩形グリッド専用:** 斜面タイルや多角形タイルの物理演算は対象外です。四角形以外の多角形描画は [タイル幾何](tile-geometry.md) を参照してください。
- 1つのActorに付与できるColliderは1つです。

## 関連資料

- [Tilemapの基礎](tilemap.md)
- [衝突判定と位置補正](collision.md)
- [2次元Grid](grid.md)
- [APIリファレンス](api.md)
