# 固定サイズの2次元Grid

`Grid<T>`は盤面、地形ID、通行可否、座標付き状態などを保持するデータ構造です。`@simpludify/core`から利用でき、Webも再exportします。Scene・Actor・Component・描画・ブラウザから独立しており、Node.jsでも利用できます。

## 生成と座標

```ts verify
import { Grid } from "@simpludify/core";
const grid = new Grid<number>(10, 20, 0);
grid.set(3, 5, 42);
const value: number = grid.get(3, 5);
console.log(grid.width, grid.height, value);
```

`(0,0)`は左上、xは右、yは下へ増える整数インデックスです。ピクセルやワールド座標ではありません。幅・高さは生成後に変更できません。内部は非公開の一次元Arrayで、`y * width + x`の行優先順に格納します。

幅・高さは正の安全な整数で、要素数も安全な整数かつ`Grid.maxCells`（16,777,216）以下に制限します。0サイズ・負数・小数・NaN・Infinity・過大なサイズは生成前に`GRID_SIZE`で拒否します。この上限は密な配列の過大な要求を抑えるためのものです。許容サイズなら必ずメモリが足りる、という保証ではなく、セルが指すオブジェクトの大きさも制限しません。

## 共有する値とセル別生成

コンストラクターの初期値は全セルで共有します。数値などのprimitiveはその値、オブジェクト・配列・関数は同じ参照を保持します。コピーやfreezeはしません。独立した値を作るときは、曖昧さのない別APIの`Grid.generate`を使います。

```ts verify
import { Grid } from "@simpludify/core";
const shared = { blocked: false };
const aliases = new Grid(2, 2, shared);
aliases.get(0, 0).blocked = true; // 全セルが同じsharedを見る
const cells = Grid.generate(2, 2, (x, y) => ({ x, y, blocked: false }));
cells.get(0, 0).blocked = true; // 他セルは変わらない
const functions = new Grid(2, 2, () => 123); // 関数そのものを格納
console.log(aliases.get(1, 1), cells.get(1, 1), functions.get(0, 0)());
```

生成関数は`(x,y)`を受け取り、左から右、上から下へ各セル1回呼ばれます。同じオブジェクトを返して意図的に共有しても構いません。例外が発生すると、その例外をそのまま返し、以後の生成を停止します。途中のGridは返しません。

`T`の実行時スキーマは持ちません。結果の型はTypeScriptで確認し、JavaScriptやanyから利用する場合の値型は呼び出し側の責任です。undefinedも正当な値として格納でき、Promiseを返した場合はPromise自体を格納して待機しません。

## 値の取得・変更と範囲外

| API                      | 動作                                              |
| ------------------------ | ------------------------------------------------- |
| `get(x,y): T`            | 値を取得。範囲外なら`GRID_BOUNDS`                 |
| `set(x,y,value): void`   | 座標を検証して変更。範囲外を無視しない            |
| `inBounds(x,y): boolean` | 整数かつ範囲内ならtrue。不正な数値や範囲外はfalse |
| `fill(value): void`      | 全セルを同じ値・参照で置換                        |
| `Grid.generate(w,h,f)`   | セルごとに初期値を生成                            |

幅・高さと同じ座標、負数、小数、NaN、Infinityは範囲外です。例外には座標・Gridの幅高さ・操作名が含まれます。`get`がundefinedを返す方式は、undefinedを格納した正常セルと区別しづらいため採用していません。候補座標が外側になり得る処理では`inBounds`で確認します。

```ts verify
import { Grid } from "@simpludify/core";
const grid = new Grid<number | undefined>(3, 2, undefined);
const directions = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
for (const [dx, dy] of directions) {
  const x = 1 + dx,
    y = 1 + dy;
  if (grid.inBounds(x, y)) grid.set(x, y, 1);
}
```

4近傍・8近傍・端の折り返しといった方針は利用側で決めます。Gridは経路探索や空間インデックスではありません。

## 走査と矩形

`forEach((value,x,y)=>...)`は全セルを行優先で走査します。`forEachRect(x,y,width,height,visit)`は完全に範囲内の矩形だけを走査し、元のGrid座標を渡します。幅・高さは非負の安全な整数です。空の矩形も許可し、右端・下端の0サイズ領域も指定できます。不正な矩形はcallback開始前に拒否し、自動クリップしません。

```ts verify
import { Grid } from "@simpludify/core";
const terrain = Grid.generate(8, 6, () => ({ blocked: false }));
terrain.forEachRect(1, 2, 3, 2, (cell) => {
  cell.blocked = true;
});
let count = 0;
terrain.forEach((cell) => {
  if (cell.blocked) count++;
});
// 行や列も同じAPIで指定できる
terrain.forEachRect(0, 2, terrain.width, 1, (cell) => {
  cell.blocked = false;
});
terrain.forEachRect(3, 0, 1, terrain.height, (cell) => {
  cell.blocked = false;
});
console.log(count);
```

走査はスナップショットではなく、その時点の値を読みます。未訪問セルを書き換えると、その後の訪問で新しい値を読みます。過去のセルを再訪問することはありません。callbackの例外は直ちに伝播し、それまでの変更は残ります。戻り値は無視し、async callbackを待機しません。座標オブジェクトをセルごとに生成することもありません。

`map`、entries/values、行列コピー、公開index変換、近傍オブジェクトなどは追加していません。まずは全体・矩形走査とfillに絞っています。内部Arrayを変更するAPIも公開しませんが、取り出したTのオブジェクト内部は通常どおり変更できます。

## 実用例と既存ゲーム

[配置盤面の独立例](../../examples/grid/logic.ts)では、セルごとに独立した通行禁止フラグと建物IDを保持し、矩形を禁止領域にする、建物の占有範囲を検査する、配置・撤去する処理を実装しています。[単体テスト](../../tests/unit/grid.test.ts)で範囲外・重複・禁止領域を確認しています。描画やActor生成を伴わない通常のゲームデータです。

Blockfallは10×20の二重配列を維持します。行単位のfilter・spliceによるライン消去と盤面上側の負のy座標を扱うルールがあり、Gridへ移すだけでは明確な改善にならないためです。Prism Raidの連続的なワールド座標・Actor集合にもGridを強制しません。

## 性能・所有権・Tilemap

get/set/inBoundsはO(1)、生成・fill・全走査はO(幅×高さ)、矩形走査はO(矩形の面積)です。行ごとの配列は不要ですが、get/setの数値・範囲検証やcallback走査には直接配列より追加コストがあります。generateは実装を簡潔に保つため、非公開Arrayを初期化後に生成結果で上書きします。[測定条件・生データ・メモリの制約](../../docs/grid-performance.md)を参照してください。

Gridは格納したオブジェクトを自動破棄せず、制御権・排他権も取得しません。Grid自体のdisposeやSceneへの登録も不要です。汎用制御権システムの正式導入は見送っています。

将来のTilemapはタイルID・属性などにGridを利用できますが、描画・レイヤー・SpriteSheet・ワールド変換は別責務です。NDArray、動的リサイズ、Sparse/Infinite/ChunkedGridは今回の対象外です。密な固定Gridとの将来互換性を理由に共通ストレージ層を追加することもしません。
