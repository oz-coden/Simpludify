# Layout, viewports and coordinates

DOM Panel uses browser Flexbox/Grid; CanvasColumn/CanvasRow/CanvasPanel use the Core's bounded Flex subset. Neither changes world coordinates. Camera, logical resolution, host CSS pixels and physical renderer pixels are separate spaces.

Canvas styles include numeric/percentage width/height, min/max dimensions, padding/gap, grow/shrink, direction, wrap, align/alignSelf and justify. Text wrapping follows available width and font metrics. Min/max constraints freeze and redistribute remaining space; a wrapping container may need an explicit bounded width/height. This is not full CSS: no arbitrary positioning, CSS cascade, general percentages for every field or application layout dependency is added.

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

bindViewport reads the dedicated resolved Canvas slot × UI scale in host CSS pixels. Use an unscrolled slot, not an arbitrary nested clipping mask. One binding per UI is replaceable; its returned unbind is idempotent. Scene/UI/node disposal releases it. Hidden/disabled/empty slots clip world rendering and pointer hit eligibility; staged UI does not change the active view. setViewport supplies the manual fallback.

Aspect.Fit preserves ratio with bars, Fill crops, Adaptive uses viewport CSS dimensions. Camera x/y/zoom affect world projection, not DOM layout. DPR scales backing pixels only. Use worldPoint/screenPoint, worldToScreen/screenToWorld and Game.pointerToWorld; check containsScreenPoint when clicks in bars must be ignored. Do not duplicate HUD heights in world code or apply DPR to CSS coordinates.

Canvas scroll, clipping, explicit focus reveal and native editor geometry share resolved bounds. Layout invalidation is handled by the model/host, while WebGL bounded scroll paint caches are internal optimizations. Focus after dynamic mutations resolves pending geometry through the host's last metrics. [Canvas UI](../../docs/specs/canvas-ui.md), [scrolling](../../docs/specs/scrolling.md) and [SDK patterns](../../docs/specs/sdk-consumer-patterns.md) define the detailed limits.
