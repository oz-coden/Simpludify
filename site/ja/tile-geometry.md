# 三角形・六角形タイル

`TileGeometry`はタイルの幾何計算、`Grid<T>`はデータ保持、`GeometryTilemap`はSceneに配置する単色レイヤーを担当します。四角形画像用の`Tilemap`と既存Collisionは引き続き利用できます。

## 作成と更新

```ts verify
import { Game, GeometryTilemap, Grid, HexOrientation, PointerClick, TileGeometry } from "@simpludify/web";
const game = new Game();
const ground = new GeometryTilemap({
  geometry: TileGeometry.hex({ radius: 24, orientation: HexOrientation.Pointy }),
  tiles: Grid.generate(12, 10, (q, r) => (q + r) % 2 ? 0x397c87 : 0x305c70),
  x: 80, y: 90,
}).place(game.engine.scene);
game.pointer.events.on(PointerClick, info => {
  const tile = ground.screenToTile(game.view, info.screen);
  if (tile) ground.set(tile.x, tile.y, 0xea739e);
}, game.engine.scene);
await game.run();
```

セルはRGB整数、非表示セルは`null`です。0は黒色として扱います。Grid・行配列はコピーされ、`get/set/fill/copyTiles`で操作します。セル変更は描画へ自動反映され、静止した画面で変更がなければセルの再構築はありません。画像の多角形切り抜き・SpriteSheetのUV対応は今回の単色レイヤーにはありません。

| 形状 | 指定 | 座標 |
| --- | --- | --- |
| 四角形 | `TileGeometry.square({width: 40, height: 32})` | 列・行。height省略時はwidth |
| 三角形 | `TileGeometry.triangle({width: 48})` | 列・行。列+行が偶数なら上向き、奇数なら下向き。横間隔は幅の半分 |
| 六角形 | `TileGeometry.hex({radius: 24, orientation: HexOrientation.Flat})` | Axialのq/rをx/yとして指定。PointyとFlatに対応 |

三角形のheight省略時は正三角形です。六角形のradiusは中心から頂点までの距離です。六角形(0,0)の中心が配置原点となり、有限マップはq/rの平行四辺形です。見た目が横長の長方形になるとは限りません。

## 選択・頂点・隣接

- `tileToWorld(x,y,{center:true})`：ワールド上の中心。三角形は重心。
- `tileToWorld(x,y)`：頂点ではなく外接矩形の左上。
- `tileVertices(x,y)`・`tileBounds(x,y)`：ワールド上の頂点・外接矩形。
- `worldToTile(x,y)`：実際の多角形で選択。マップ外はundefined。
- `screenToTile(view,point)`：Camera・ズーム・Viewportを反映して選択。画面外やFit余白はundefined。
- `neighbors(x,y)`：辺を共有する隣接セル。マップ外を除外。
- `tilesInBounds(bounds)`：外接矩形がワールド範囲に触れるセル候補。

四角形の境界は従来どおり左・上を含み、右・下を含みません。三角形・六角形の共有辺・頂点は、行/rが小さい方、その次に列/qが小さい方へ割り当てます。有限マップの外周も無限のタイル配置で所有セルを決めてから範囲確認するため、外側の隣接セルに属する境界ではundefinedになります。浮動小数点の誤差を安定させる微小許容値の詳細は[英語契約](../../docs/tile-geometry.md)を参照してください。

生のGeometryは負の整数座標も扱えます。`geometry.center/vertices/bounds/neighbors/worldToTile`はローカル座標です。六角形では`distance(a,b)`と`withinRadius(q,r,radius)`も利用できます。範囲列挙は遅延評価ですが、巨大な範囲を指定すると列挙数も増えます。

## Actorでも六角形を表示

`Renderable`のsourceに`{kind:"shape",shape:Shape.Hexagon}`を指定します。中心・幅・高さ・色・透明度・回転・拡縮・実行中の変更・Tweenは既存の描画APIと共通です。Pointy形状なので、正六角形は幅=√3×半径、高さ=2×半径です。回転でFlat方向にもできます。三角形の`Shape.Triangle`も引き続き利用できます。

描画と衝突形状は独立しています。六角形Actorに既存の円・矩形Colliderを付けられますが、多角形Colliderや三角形・六角形Tilemapからの自動Collision生成は提供していません。

## サンプル

```sh
npm run dev -- --example tile-geometry
```

[サンプルギャラリー](examples.html)のTile geometry labで形状切り替え・タップ選択・色変更・隣接強調・表示切り替え・カメラ操作・Scene再生成を確認できます。スマートフォン幅でもPan・Zoomボタンを利用できます。Desktop/Narrowは自動ブラウザ検証の画面幅を示し、実機スマートフォン全般の動作保証ではありません。

詳しいAPI・画像対応の制約・寿命・カリングは[Tile geometry契約](../../docs/tile-geometry.md)、検証と測定は[作業報告](../../docs/work-reports/2026-11-01-tilemap-geometry.md)に記録しています。
