# 三角形・六角形タイル幾何（TileGeometry）

CoreとWebは`TileGeometry`、`HexOrientation`、`GeometryTilemap`、`Shape.Hexagon`をexportします。Gridは行優先の固定ストレージのままであり、幾何形状は独立したローカル空間のタイリングを定義します。既存の画像ベースの正方形`Tilemap`、SpriteSheetの準備／リース、円／箱の地形衝突は契約を維持します。

## 作成・描画・編集

```ts verify
import { Game, GeometryTilemap, Grid, TileGeometry } from "@simpludify/web";
const game = new Game();
const map = new GeometryTilemap({
  geometry: TileGeometry.hex({ radius: 24 }),
  tiles: Grid.generate(12, 10, (q, r) => ((q + r) % 2 ? 0x397c87 : 0x305c70)),
  x: 80,
  y: 90,
}).place(game.engine.scene);
map.set(3, 4, 0xea739e);
const center = map.tileToWorld(3, 4, { center: true });
const selected = map.worldToTile(center.x, center.y);
console.log(selected, map.neighbors(3, 4));
await game.run();
```

セルは24ビットRGB整数（0/黒を含む）、または描画なしを表す`null`です。Gridと非空の矩形配列の双方がコピーされます。パレットやアセットの登録機構はありません。ゲーム固有の種類は独立したGridで管理し、その色を`set`を通じて投影できます。無効な色や寸法は変更前にスローされます。`get/set/inBounds`、`width/height`、`copyTiles`、`fill`、`revision`、配置と破棄は既存のTilemapの慣習に従います。

`x/y/zIndex/visible/enabled`は生きた配置プロパティであり、既定値は0/0/0/true/trueです。x/yはワールド単位の平行移動のみです。`GeometryTilemap`は1つのActorと受動的な配置Componentを所有し、セルごとのActorは作成しません。`place(scene)`はScene所有権を共有し、除去や破棄は終端処理です。寸法や不変幾何形状を後から変更することはできません。

## 座標と多角形の形状

| 幾何factory                               | インデックス／原点                      | 形状／サイズ                                                    |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `TileGeometry.square({width,height?})`    | 列／行。バウンディング原点(0,0)         | 半開矩形セル。heightの既定値はwidth                             |
| `TileGeometry.triangle({width,height?})`  | 列／行。水平刻みwidth/2、垂直刻みheight | 偶数(col+row)は上向き、奇数は下向き。heightの既定値はwidth×√3/2 |
| `TileGeometry.hex({radius,orientation?})` | 軸座標q/r（x/yとして表現）。中心(0,0)   | 正六角形。radiusは中心から頂点までの距離。既定はPointy          |

`HexOrientation.Pointy`は水平方向の中心間隔が√3×radiusで、行による横ズレがその半分です。垂直行間隔は1.5×radiusです。`HexOrientation.Flat`は水平q間隔が1.5×radius、垂直r間隔が√3×radiusで、qによる縦ズレがその半分です。有限の六角形ストレージはq/r平行四辺形であり、画面上の千鳥状矩形ではありません。(0,0)の六角形はその配置原点から左上へ突き出します。マップ全体を配置する際は`tileBounds`を活用してください。

`geometry.center(x,y)`、`.vertices(x,y)`、`.bounds(x,y)`はローカル空間データを返します。頂点はy軸下向きのワールドで時計回りです。三角形の中心はバウンディングボックスの中心ではなく重心（上向きは高さの2/3、下向きは1/3）です。

### 選択と境界判定

`geometry.worldToTile(x,y)`は無限タイリング上のセルを選択します。正方形は左・上を含み右・下を除外します。三角形や六角形は実際の閉じた多角形をテストし、共有エッジや頂点は最小の行（y/r）、次に列（x/q）を選択します。1e-10×width×heightの外積許容値が浮動小数点エッジを安定させます。

有限の`map.worldToTile`は境界クリッピングの**前に**無限タイリングの所有権を解決します。そのため、その所有セルがストレージ外である場合はundefinedを返します。

```ts verify
import {
  Game,
  GeometryTilemap,
  PointerClick,
  TileGeometry,
} from "@simpludify/web";
const game = new Game();
const map = new GeometryTilemap({
  geometry: TileGeometry.triangle({ width: 48 }),
  tiles: [[0x305c70, 0x397c87, 0x305c70]],
  x: 100,
  y: 100,
}).place(game.engine.scene);
game.pointer.events.on(
  PointerClick,
  (info) => {
    const tile = map.screenToTile(game.view, info.screen);
    if (tile) map.set(tile.x, tile.y, 0xea739e);
  },
  game.engine.scene,
);
await game.run();
```

`screenToTile(view, screenPoint)`は`view.clip`を検査し、逆Camera/ViewTransformを呼び出して多角形ピッキングを行います。スクリーン単位はホストローカルのCSSピクセルです。

## 隣接・範囲・距離

`geometry.neighbors(x,y)`は4つの正方形、3つの三角形、または6つの六角形エッジ隣接セルを返します。三角形の順序は左、右、そして水平エッジを跨ぐ垂直方向です。六角形の軸方向順序は方向に関わらず(1,0)、(1,-1)、(0,-1)、(-1,0)、(-1,1)、(0,1)です。`map.neighbors`はストレージ外のインデックスを除外します。

六角形の距離は`hex.distance(a,b) = (|dq| + |dr| + |dq + dr|) / 2`です。`hex.withinRadius(q, r, radius)`は包含関係にあるグラフ距離ディスクを行優先で列挙します。`triangle.pointsUp(x,y)`は偶奇性（上向きか下向きか）を返します。

`geometry.tilesInBounds(localBounds, coordinateLimit?)`はバウンディング矩形が交差するセルを保守的に列挙します。

## 描画・更新・ライフサイクル

WebはWebGLまたはCanvas2D上でPixi Graphicsを使用して実際の多角形塗りつぶしを描画します。六角形の中心に矩形画像を配置するような処理ではありません。マップは既存のCameraワールドコンテナおよび深度順序を共有します。変更のないビューではセル整合処理は0回です。変更された可視セルのみが保持されたGraphicsを再描画します。画面外の編集でセル走査は行われません。

## ActorのShape.Hexagon

```ts verify
import { Actor, Renderable, Shape, Transform } from "@simpludify/core";
const actor = new Actor();
actor.add(new Transform({ x: 100, y: 100, rotation: Math.PI / 6 }));
const view = actor.add(
  new Renderable({
    source: { kind: "shape", shape: Shape.Hexagon },
    width: 60,
    height: 70,
    color: 0xea739e,
    opacity: 0.8,
  }),
);
view.source = { kind: "shape", shape: Shape.Triangle };
view.source = { kind: "shape", shape: Shape.Hexagon };
```

HexagonはTransformを中心とし、バウンディング幅・高さ全体を持つ尖った六角形です。正六角形にするにはwidth=√3×radius、height=2×radiusを使用します。回転によって水平向き（Flat）にすることもできます。既存の`actorTween`もそのまま動作します。
