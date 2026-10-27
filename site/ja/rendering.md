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

RenderableはTransformを必要とします。Box・Circle・Characterの形状、または画像を表示できます。

```ts
import { Renderable, SpriteFit } from "@simpludify/core";
actor.add(
  new Renderable({
    sprite: import.meta.env.BASE_URL + "player.svg",
    width: 48,
    height: 48,
    fit: SpriteFit.Contain,
  }),
);
```

画像は選択サンプルの`public/`へ置くかVite importを使います。外部URLは適切なCORS設定が必要です。`visible`、`opacity`、`zIndex`は実行中に変更できます。高いzIndexが手前、同値はActorの挿入順です。`actor.enabled`は更新と表示を止めますが、`visible`だけをfalseにしても接触は続きます。

サイズ・画像・色・形状はimmutableです。変更には依存関係を守ってRenderableを差し替えます。画像準備は非同期で、`game.whenReady()`が現在要求済みの画像の完了を待ちます。Actorの論理更新はロード中も継続できます。スプライトアニメーションは未実装です。

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

Scene/Actor破棄で対応する表示・保留画像を解放します。`Game.dispose()`でフレーム、入力、ResizeObserver、DOM、rendererを破棄します。画像ロード失敗は`whenReady`のrejectと診断で扱い、背景の更新・描画エラーはWeb Gameを停止・破棄します。WebGLコンテキスト喪失からの自動復旧は未検証・未対応です。
