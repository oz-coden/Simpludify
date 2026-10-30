# Canvas scrolling and gesture ownership

`CanvasScroll` is a Core UI panel with independent position, input policy, momentum and overlay scrollbars. Web supplies native pointer capture/coordinate conversion and Pixi drawing; content definitions need no DOM/Pixi operations.

```ts verify
import {
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasScroll,
  Game,
} from "@simpludify/web";
const inventory = CanvasScroll(
  Array.from({ length: 40 }, (_, i) =>
    CanvasButton(`Item ${i + 1}`, () => {}, { height: 44 }),
  ),
  {
    height: 240,
    scroll: "vertical",
    dragScroll: true,
    inertia: true,
    scrollbar: "auto",
  },
);
const notes = CanvasScroll(
  [CanvasLabel("A separate viewport", { height: 400 })],
  {
    height: 120,
    inertia: false,
    scrollbar: "always",
  },
);
const game = new Game();
const ui = game.canvasUI(
  CanvasColumn([inventory, notes], { gap: 12, padding: 12 }),
);
await game.run();
inventory.setStyle({ inertia: false, scrollbar: "hidden" });
inventory.scrollTo(0, 80);
console.log(ui.diagnostics.activeMomentum);
```

## Settings and units

| Setting       | Default                  | Meaning                                                                                                    |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| scroll        | vertical in CanvasScroll | vertical, horizontal or both; clips descendants and retains main-axis overflow                             |
| dragScroll    | true                     | Allows primary mouse/pen/touch content drag; does not disable scrollbar control                            |
| inertia       | true                     | Allows momentum after a content drag; disabling stops active momentum immediately                          |
| scrollbar     | auto                     | auto for overflow, always for an allocated track, hidden for no drawing/hits; scrolling remains enabled    |
| dragThreshold | 8                        | Finite nonnegative Host screen units; evaluated on supported movable axes, independent of UI scale and DPR |

Give a scroll panel a bounded size or Flex grow allocation. Positions/ranges are UI units; pointer positions and thresholds are Host screen units. The adapter converts screen coordinates through UI scale. World Camera and physical DPR never enter scroll calculations. Styles belong to each node, not global defaults shared across containers. `setStyle` validates a complete patch before applying it.

`scrollTo(x,y)` / `scrollBy(dx,dy)` clamp against the last resolved `maxScrollX/Y`. They stop momentum and cancel active pointer control of that scroller, including a no-op command. `stopScroll()` stops momentum only. `coasting` exposes whether velocity remains. Structure/size changes recompute ranges at the next layout and clamp offsets. Axis/policy changes cancel invalid gesture ownership immediately; new geometry and bar visibility are resolved at the next layout/presentation flush. Changing UI scale cancels UI gestures and momentum so old gesture samples cannot apply a different unit scale.

## Gesture arbitration

- A down first selects the topmost UI/world target. UI scroll candidates are only its original ancestor path; later overlays and world gestures cannot be stolen by a scroll panel behind them.
- Until the supported-axis threshold is reached, the existing target owns normal input. Button taps/subthreshold moves retain normal activation. `CanvasHoldButton` preserves its existing **immediate held-state** contract; it is not a delayed long-press recognizer.
- When a scroll gesture wins, the original pointer contribution is released and its target receives one PointerCancel. Native capture is retained. The selected scroller receives a new PointerDown and owns subsequent Move/Up/Cancel; the cancelled target receives no click/up activation. Keyboard/other-pointer hold contributions remain independent.
- The deepest movable ancestor wins at gesture start. A child at its edge can defer to a movable parent. Differently oriented ancestors consider only axes they can move. **Ownership stays locked until release**; reaching an edge during that drag does not jump to a parent. Release and start another gesture to change owner. Wheel chaining remains per-event.
- One pointer controls a scroller at a time; another pointer cannot steal its content or thumb. Separate scrollers can operate simultaneously. Removing the old content target after a completed transfer does not destroy the new scroller owner.
- Disable/hide/removal, direction or drag-policy changes, program commands, UI/Scene replacement, blur, pointercancel and lost capture release relevant state. Cancelled IDs stay suppressed until physical release/fresh down; cancellation never converts a UI gesture into a world click. Disposed targets receive no further events. Callback errors are aggregated after ownership/hold cleanup, not used to skip cleanup.

Only primary-button content/thumb input scrolls. PointerInfo now optionally carries `time`, monotonic Host seconds. Existing adapters that omit time still support dragging; they cannot launch momentum. Use real normalized Host times rather than simulation time or wall-clock estimates.

## Momentum and clocks

Recent input velocity uses a 45ms exponential filter. Samples over 150ms apart, missing/nonfinite/nonmonotonic timestamps and releases more than 80ms after the last move cannot launch stale motion. Velocity is capped at 3000 UI units/s per axis. Release uses exponential decay at 8/s and stops at 10 units/s; exact cutoff integration makes ordinary 30/60/120Hz updates agree. Each axis stops at its own scroll boundary; there is no overscroll/bounce.

Core exposes `ui.advance(seconds)` and keeps a Set containing only moving nodes. It has no RAF, host timer or hidden subscription. Invalid/negative time throws without changing positions. A discontinuity over 250ms stops momentum rather than applying a large jump. Empty sets do no per-node work. `ui.stopMotion()` ends all coasting in that tree.

Web Game passes presentation elapsed seconds through the existing frame chain. Game pause, direct Engine pause observed at the next frame, blur/hidden state and scene disposal stop momentum; resume never revives it. UI buttons remain usable while simulation is paused, but momentum does not continue through pause. Custom Hosts must call advance and stopMotion/release at the corresponding lifecycle boundaries. Do not drive this with simulation Timer subscriptions or allocate one frame chain per node.

## Overlay bars and keyboard operation

Bars overlay their viewport, reserve no layout space and use the existing text color. Visible tracks are 8 UI units wide with a 2-unit inset. Thumb length reflects viewport/(viewport+range), with a 24-unit minimum bounded by track length. The cross-axis hit region is at least 24 Host units and respects all ancestor clips. Both axes leave a shared corner clear.

`always` without overflow shows a dim full-track thumb that consumes pointer hits but cannot move; it does not activate the content underneath. Primary thumb drags map directly to the current range/track and preserve the fractional grab point through resize. Track presses page by 90% of viewport extent. These gestures never launch inertia. Hiding bars or removing their range cancels an active bar gesture safely.

Core's paint walk can visit each node after its descendants. Bars use that same post-subtree order for rendering and hits: they cover their own content, while later sibling overlays remain above them. Web retains/releases private Graphics contexts with the existing presentation. The transparent native button mirrors still do not perform pointer hit testing.

Tab/Shift-Tab reveals focused content. Arrow keys, PageUp/PageDown, Home and End on focused Canvas controls scroll the nearest movable ancestor, including hidden-bar containers. Gameplay keys on the Game surface and DOM/native editors keep their own routing. Bars are Canvas controls, not a full native scrollbar/OS accessibility implementation; physical screen-reader/IME validation is not claimed.

## Layout and rendering cost

Offset changes invalidate **projection**, not Flex. Unscrolled frozen layout boxes are retained weakly; a flush projects new bounds from current ancestor offsets without measuring text or resolving sizes. Structure/text/font/size/scale changes still use full layout. Frozen public bounds, focus reveal, masks, native mirrors and hit tests share those projected coordinates.

The renderer caches paint/style and mask signatures separately from translation. Moving content does not rebuild its background geometry or TextStyle, and unchanged clips do not rebuild masks. Bars redraw when their geometry/appearance changes. Projection/presentation traversal still visits the tree; this is not virtualization or an O(1) rendering guarantee.

See [scroll measurements](scroll-performance.md) for exact workloads and limitations. `diagnostics.layouts`, `scrollProjections` and `activeMomentum` distinguish layout, position flushes and active animation.

## Sample and support

Canvas trail → **UI list lab** includes live inertia/drag/bar switches, an independently configured second viewport, nested both-axis cards and a HoldButton. The screen definition imports only Core and is shared with headless tests. Scroll the main entries, drag either thumb, compare hidden/always/auto, hold then drag in the second panel, and change settings while moving.

Chromium CDP touch emulation and WebGL/Canvas2D fixtures are separate from physical Android/iOS validation. Browser touch-action:none on the existing Game canvas reserves that surface's pointer stream and disables native canvas-area page panning/pinch; DOM overlays and surrounding page retain their own behavior. No new browser-wide capture or replacement gameplay Action source was introduced. Physical device/other-engine/pinch ergonomics remain unverified. IME, editable/select/number controls, virtual lists, bounce and native packaging remain outside this implementation.
