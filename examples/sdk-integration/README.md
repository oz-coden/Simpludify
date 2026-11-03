# SDK integration lab

Canvas HUDのFlexレイアウトからワールド領域を決め、DOMフォームとCanvas入力を併用するサンプルです。整数ステップの確定状態と表示専用Tweenを分離しています。

```sh
npm ci
npm run dev -- --example sdk-integration
```

- **Step**: immutableな整数座標を即時確定し、表示位置と脱出時のopacityを0.35秒で補間します。連打時は前のTweenをfinishしてから次を開始します。
- **Restart**: 旧Tweenをcancelし、始点・終点・表示進捗を初期化します。
- **Pause**: シミュレーションだけを停止します。表示Tweenは継続します。Tween単体のpause/resumeはヘッドレステストでも確認します。
- **Scene / Return**: 古いScene・UI・Tween・Viewport連携を破棄し、新しいインスタンスを作ります。
- DOMフォーム・Canvasボタン・Canvas日本語入力はTab/Shift+Tabで移動できます。フォーム保存では入力行を再構築しないため、フォーカスを保持します。

## Layout-owned viewport (since SDK v0.1.2)

`game.bindViewport(ui, region)` is a Web-host API added after published npm v0.1.1. It does not exist in that immutable release. Use published SDK v0.1.2 or later.

```ts
const region = CanvasPanel([], { grow: 1, minHeight: 100 });
const ui = context.canvasUI(CanvasColumn([hud, region], { height: "100%" }));
const unbind = game.bindViewport(ui, region);
```

The region belongs to the Game's Canvas UI. The host resolves its layout before drawing or pointer conversion, multiplies UI bounds by `ui.scale` to obtain host-local CSS pixels, and applies the existing resolution/aspect/camera projection. DPR affects backing pixels only. It uses the existing frame/resize pipeline and adds no ResizeObserver or frame loop. Unchanged rectangles reuse the ViewTransform.

One binding is allowed per UI; a new binding replaces the previous one. The returned unbind is idempotent and cannot remove a newer binding. The UI and region own cleanup. Bindings for staged Scenes do not affect the mounted Scene. Removing/disposing the region, disposing the UI, or unbinding restores the manual `setViewport` rectangle (full host by default). `setViewport` changes that fallback while a binding is active. Moving a live region out of its original UI makes its binding empty until it returns or is unbound.

A hidden, disabled or zero-sized region produces a zero clip for both world paint and pointer routing, rather than exposing the full world. Coordinate conversion in an empty region has no visible-world meaning; the host keeps an internal finite transform. The region is clipped to the host. Use a dedicated layout slot outside scrolling/clipping containers; this API is not an arbitrary Canvas-node mask or world-in-UI widget.

## State and animation ownership

`model.ts` imports only Core. Its world consists of frozen integer data. `Tween.bind` writes a separate progress value and paints display-only Actors. No animation callback changes rules, occupancy or replay state. Finishing/replacing a display animation deliberately snaps to the previous committed endpoint. A different game can choose another visual policy without changing the engine's Tween API.

Browser tests exercise resize, UI scale, DPR 2, camera inversion, pointer exclusion, empty regions, Tab boundaries, native forms, touch activation and Scene cleanup. Native IME sessions are covered by the existing Canvas native-control fixture; synthetic composition tests do not certify an operating system IME.
