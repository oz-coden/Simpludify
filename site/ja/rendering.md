# 描画・座標・カメラ

ゲーム内の単位、CSSピクセル、描画バッファのピクセルを分けると、画面サイズに依存しにくいロジックを作れます。

## 座標の区別

| 概念                | 意味                                         |
| ------------------- | -------------------------------------------- |
| WorldPoint          | ゲーム世界の位置。速度は世界単位/秒          |
| LogicalResolution   | 既定800×450の論理的な表示範囲                |
| Camera              | 世界上の表示原点x/yと中心を基準としたzoom    |
| Viewport            | ホスト内のCSS座標の矩形。x/yオフセットを含む |
| ScreenPoint         | ホスト内のCSSピクセル位置                    |
| PhysicalPoint / DPR | 実際の描画バッファ。世界の計算には使わない   |

`worldPoint` / `screenPoint`の空間タグと変換関数で誤用を防ぎます。`game.worldToScreen`と`screenToWorld`は現在のCameraとViewportを反映します。

## 画面への収め方

`Aspect.Fit`は比率を保って全体を表示し余白を作ります。`Fill`は比率を保って一部を切り取り、`Adaptive`はViewportのCSSサイズを論理解像度として扱います。DOM UIは独立してホスト全体で再配置されます。

`pixelRatio`は既定でmin(devicePixelRatio,2)です。DPRを上げてもゲーム内の速度・座標は変えません。単一Camera・単一Viewportのみ実装しています。

## 表示と画像

RenderableはTransformを必要とします。同じComponentを維持したまま、色・幅・高さ・source・opacity・visible・zIndexを変更できます。

```ts verify
import { Actor, Renderable, SpriteFit, Transform } from "@simpludify/core";
const actor = new Actor();
actor.add(new Transform());
const view = actor.add(
  new Renderable({ width: 32, height: 32, color: 0x73e3c0 }),
);
view.width = 48;
view.height = 48;
view.color = 0xffffff;
view.source = {
  kind: "image",
  url: import.meta.env.BASE_URL + "player.svg",
  fit: SpriteFit.Contain,
};
view.opacity = 0.5;
```

`source`は`{ kind: "shape", shape: Shape.Triangle }`などの図形、または`{ kind: "image", url, fit? }`の画像です。省略時はBox、画像のfit省略時はContain。Stretchは幅・高さ全体へ伸縮します。sourceはコピー・凍結されるため、画像やfitの変更はsource全体を再代入します。同じ内容の指定はrevisionも画像要求も変えません。

幅・高さは正の有限数、colorは0〜0xffffffの整数、opacityは0〜1、zIndexは有限数、visibleはbooleanです。不正値は状態変更前に拒否します。表示状態のrevisionはSceneの構造revisionと独立し、依存Componentや所有権を変えません。Transform・Colliderの寸法も変更しません。

初期色は図形がミント、画像が無着色の白です。source変更後もcolorは維持するため、色付き図形から画像へ変えるときは必要に応じて白を指定します。図形では塗り色、画像ではRGB乗算です。元画像を任意の単色へ置き換える効果とは異なります。Characterの目は本体と異なる色を維持します。

画像は選択サンプルのpublicへ置くかVite importを使います。外部URLは適切なCORS設定が必要です。高いzIndexが手前、同値はActorの挿入順です。actor.enabledは更新と表示を止めますが、visibleだけをfalseにしても接触は続きます。非表示でもリソースを保持し、画像準備は行います。

## 画像の切り替えと待機

```ts verify
import { Actor, Game, Renderable, Shape, Transform } from "@simpludify/web";
const game = new Game();
const actor = game.add(new Actor());
actor.add(new Transform({ x: 200, y: 150 }));
const view = actor.add(new Renderable());
await game.run();
view.color = 0xffffff;
view.source = { kind: "image", url: import.meta.env.BASE_URL + "player.svg" };
try {
  await game.whenReady();
} catch (error) {
  view.source = { kind: "shape", shape: Shape.Box };
  await game.whenReady();
  console.error(error);
}
game.dispose();
```

代入は同期的で、次の描画・準備同期で反映します。新画像のロード中は旧画像や図形を維持し、旧表示がない初回画像では未表示です。現在の寸法・色・透明度・Transformは旧表示にも適用しますが、旧画像のfitは新画像への切り替えまで保持します。

最後に同期した要求を優先し、取り消した古い要求が遅れて完了しても表示しません。色・寸法・同じURLのfit変更では画像を再ロードしません。図形同士はGraphics、画像同士はSpriteを再利用し、両経路の間ではバックエンドの表示オブジェクトだけを交換します。

`game.whenReady()`は起動後の現在の表示を捕捉し、最新の同期済み要求が完了するまで追従します。置き換えた要求や除去した要求は待たず、現在の失敗は別画像が未完了でも速やかにrejectします。成功時は準備済み状態を描画します。将来の代入や別に準備中のScene遷移は待ちません。遷移には`await game.goTo(id)`を使います。

失敗はASSET_LOAD_FAILEDの診断と待機のrejectで通知し、旧表示とゲーム更新を維持します。別の正常なsourceで復旧できます。同じ失敗URLの再代入は再試行しません。再試行には別sourceを選んで描画・whenReadyで同期した後、元URLを指定します。無限の自動再試行はありません。

待機中の表示やGameが破棄された場合はGAME_DISPOSEDでrejectします。通常のフレームは変更を自動同期し、手動ホストではrenderまたはreadyを呼びます。setter自体はブラウザ処理を予約せず、ポーリングタイマーも追加しません。

## 旧APIからの移行

- `shape: Shape.Triangle` → `source: { kind: "shape", shape: Shape.Triangle }`
- `sprite: url, fit: SpriteFit.Stretch` → `source: { kind: "image", url, fit: SpriteFit.Stretch }`
- Characterのspriteも同じsource指定へ変更
- 寸法・色・画像のためのComponent差し替え → 同じRenderableのプロパティ変更
- 画像への明示的なcolor指定は着色になるため、以前の無着色結果には白を指定

図形と画像の暗黙の優先順位はありません。Signal Runは被弾色と透明度を同じRenderableへ反映し、Blockfallは盤面セルのActorを維持して色を更新します。画像共有、TextureRef、Material、Sprite Sheet、アニメーションは未実装です。

## 三角形

```ts verify
import { Actor, Renderable, Shape, Transform } from "@simpludify/core";
const ship = new Actor();
ship.add(new Transform({ x: 160, y: 300 }));
ship.add(
  new Renderable({
    source: { kind: "shape", shape: Shape.Triangle },
    width: 32,
    height: 40,
    color: 0x65a8ed,
  }),
);
```

Triangleは上向きの二等辺三角形です。ローカル頂点は`(0,-height/2)`、`(width/2,height/2)`、`(-width/2,height/2)`。原点・回転中心は外接矩形の中心で、重心ではありません。幅と高さ、回転（ラジアン）、正負の拡大縮小を既存形状と同じように扱います。`opacity`・`visible`・`zIndex`も共通です。

描画形状と衝突形状は独立しています。三角形の機体にも、操作感に合わせた円・矩形のTriggerを付けられます。Triangleの追加は三角形ColliderやSolidの処理を変更しません。

## カメラ追従

```ts
import { CameraFollow } from "@simpludify/core";
const follow = new CameraFollow(game.camera, {
  bounds: { x: 0, y: 0, width: 800, height: 450 },
});
scene.onUpdate((seconds) => follow.update(player, seconds));
```

位置補正後に追従します。`player`はx/yを持つ値、例えばCharacterActorやTransformです。`responsiveness`は既定0で即時追従、正値で指数平滑化します。zoomを変えた直後に座標変換するなら`follow.update(player, 0)`も呼びます。独自論理解像度を使う場合は追従にも同じresolutionを指定します。

## リソースと失敗

Scene/Actor破棄で対応する表示・保留画像を解放します。`Game.dispose()`でフレーム、入力、ResizeObserver、DOM、rendererを破棄します。画像準備が失敗したScene遷移は候補を破棄して現在のSceneを維持します。実行中の画像失敗はwhenReadyのrejectと診断で扱い、旧表示とSceneを維持します。既知の失敗は無関係な未完了画像を待ちません。各Visualが画像を個別所有し、破棄でロードも取り消します。遅延完了した結果は解放します。背景の更新・描画エラーはWeb Gameを停止・破棄します。WebGLコンテキスト喪失からの自動復旧は未検証・未対応です。
