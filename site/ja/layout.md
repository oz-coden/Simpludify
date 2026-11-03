# レイアウト・Viewport・座標

DOMのPanelはブラウザのFlexbox/Grid、CanvasColumn/CanvasRow/CanvasPanelはCoreの限定的なFlexを使います。どちらもワールド座標そのものを変更しません。Camera・論理解像度・HostのCSSピクセル・描画用の物理ピクセルを分離します。

CanvasStyleは数値／百分率のwidth/height、min/max寸法、padding/gap、grow/shrink、direction、wrap、align/alignSelf、justifyを扱います。文字は利用可能幅とフォント計測に従って折り返します。min/maxで固定した項目を除いて残りを再配分し、折り返す領域には明示的な幅・高さの境界が必要な場合があります。完全なCSS、任意配置、カスケード、全項目の百分率、外部レイアウト依存は追加しません。

```ts verify
import { CanvasColumn, CanvasLabel, CanvasPanel, Game } from "@simpludify/web";
const game = new Game();
game.scene("play", ({ canvasUI }) => {
  const field = CanvasPanel([], {
    grow: 1,
    width: "100%",
    minHeight: 120,
    pointerEvents: "none",
  });
  const ui = canvasUI(
    CanvasColumn([CanvasLabel("HUD", { fontSize: 20 }), field], {
      width: "100%",
      height: "100%",
      gap: 8,
      padding: 12,
    }),
  );
  game.bindViewport(ui, field);
});
await game.run("play");
```

bindViewportは専用Canvas領域の解決済みbounds×UI scaleをHostのCSSピクセルとして読みます。スクロールしない専用slotを使い、任意の入れ子マスクの代用にはしません。UIごとに1つ、再割り当て可能で、解除関数は冪等です。Scene/UI/nodeの破棄で解除し、隠れた／無効／空の領域はワールド描画とポインター対象から外れます。準備中UIは現在の投影を変更しません。setViewportは手動のフォールバックです。

Aspect.Fitは余白付きで比率を保ち、Fillは切り抜き、AdaptiveはViewportのCSS寸法を論理範囲にします。Cameraのx/y/zoomはワールド投影だけに作用します。DPRはバッキング画像だけを拡大します。worldPoint/screenPoint、worldToScreen/screenToWorld、Game.pointerToWorldを使い、余白を除外する場合はcontainsScreenPointを確認してください。HUDの高さをゲームロジックへ重複記述したり、CSS座標にDPRを掛けたりしません。

Canvasのスクロール・clip・focus reveal・ネイティブ編集位置は同じ解決済みboundsを使います。動的変更後の明示的focusは、Hostの直近計測で保留レイアウトを解決します。WebGLの限定的なスクロール描画キャッシュは内部最適化です。[Canvas UI](canvas-ui.md)、[スクロール](scrolling.md)、[SDK利用パターン](sdk-patterns.md)に詳しい制約をまとめています。
