# Canvas UI, Flex and Pointer input

Canvas UI state, layout and routing belong to `@simpludify/core`; `@simpludify/web` reexports them and supplies the Pixi/browser adapters. It draws Panels, text, Buttons and HoldButtons in the same Pixi canvas as the game, above the world. The existing DOM `Panel`, `Label`, `Button`, `HoldButton`, `Layout` and `Placement` remain available. Use CanvasScroll for bounded content lists. Prefer DOM for document layout, forms, text selection/editing and rich accessibility; prefer Canvas for game HUDs and controls that belong to the rendered surface. Canvas does not replace native text/IME input.

## A title screen and Action-driven game

```ts verify
import {
  Action,
  CanvasButton,
  CanvasColumn,
  CanvasHoldButton,
  CanvasLabel,
  CanvasPanel,
  CanvasRow,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
  PointerClick,
} from "@simpludify/web";

const game = new Game<"title" | "play">();
const Actions = defineActions({ Move: Action.axis2D() });
game.scene("title", ({ canvasUI }) => {
  canvasUI(
    CanvasColumn(
      [
        CanvasLabel("Ready?", { fontSize: 30 }),
        CanvasButton("Start", () => game.goTo("play")),
      ],
      { align: "center", justify: "center", gap: 20 },
    ),
  );
});
game.scene("play", ({ actions, canvasUI, add, pointer }) => {
  const controls = actions(Actions, { Move: KeyboardBindings.WASD });
  add(Character({ movement: controls.reader(Actions.Move) }));
  const right = CanvasHoldButton("Right", (held) => {
    source.set(Actions.Move, held ? { x: 1, y: 0 } : { x: 0, y: 0 });
  });
  const source = controls.createSource(right);
  const selected = CanvasLabel("Select the field");
  canvasUI(
    CanvasColumn(
      [
        CanvasRow([selected, CanvasButton("Menu", () => game.goTo("title"))], {
          gap: 12,
          wrap: true,
        }),
        CanvasPanel([], { grow: 1 }),
        right,
      ],
      { padding: 12, gap: 10 },
    ),
  );
  pointer.events.on(PointerClick, (event) => {
    selected.setText(
      `World ${Math.round(event.world.x)}, ${Math.round(event.world.y)}`,
    );
  });
});
await game.run("title");
```

Hold callbacks are synchronous (a returned Promise is diagnosed and its rejection is consumed); use the async CanvasButton callback for a cancellable one-shot task. Each independently releasable hold control should own its own `ActionSource`. Contributions combine with keyboard and other sources at the existing Engine input boundary, including short Button taps and normalized axes. No per-frame UI input update is required. `context.actions(definitions, bindings?)` supplies that staged Scene and the Game input; `game.actions` supplies the current Scene, including the default Scene before `run`. The explicit Core `new ActionController` remains the headless/multi-owner API. Do not use `game.actions` for a different staged Scene.

## Nodes and ownership

`CanvasPanel(children?, style?)`, `CanvasRow(children, style?)`, `CanvasColumn`, `CanvasLabel(text, style?)`, `CanvasButton(text, handler, style?)` and `CanvasHoldButton(text, onHold, style?)` return `CanvasNode`. A node exposes `text`, `setText`, frozen `style`, `setStyle(patch)`, `visible`, `enabled`, `busy`, `bounds`, `events`, `onDispose` and idempotent `dispose`. Panels expose a frozen `children` list, `add(...children)`, `remove(child)`, `move(child, finalIndex)` and `clear()`. Move retains identity/subscriptions; clear disposes all children even if one cleanup fails. Removal disposes that subtree; nodes cannot be reparented or reused after disposal. Additions validate ownership/cycles before mutation. Text and style setters ignore equal values. Style patches retain unspecified fields; pass a complete new node to replace a different configuration.

A Scene has one `context.canvasUI(root, { scale? })` root. Compose overlays within its tree. Before `run` the default Scene can instead use `game.canvasUI`. One Canvas UI owns its root, which owns descendants; Scene disposal releases the entire tree, events, holds, native mirrors, text textures, masks, and owner-linked ActionSources. Web button handlers receive a native AbortSignal; Core handlers receive an owner CancellationSignal. Both set `busy` while pending and reject through the Game error observer; late results after disposal do not mutate a replacement UI. Preparation is detached until the existing Scene transaction commits. Failed setup/preparation disposes the candidate and leaves the previous presentation usable.

Canvas UI requires the default `PixiRenderer` (including its Canvas2D fallback). A custom Core RendererPort without the Web Canvas presentation capability rejects with `RENDERER_CAPABILITY`; DOM UI still works. It is not silently drawn into a second unrelated canvas.

## Dynamic lists, scrolling and focus

`CanvasScroll(children?, style?)` is a clipped panel, vertical by default. `scroll: "horizontal" | "both"` selects other axes; choose `direction: "row"` for a horizontal row. Its viewport needs a bounded height/width or a Flex grow allocation. Children keep their content size on the scroll main axis instead of shrinking away the overflow. `scrollTo(x,y)` and `scrollBy(dx,dy)` use UI units, clamp to `maxScrollX/maxScrollY` from the last layout, and return whether the offset changed. Resize and child removal clamp offsets during the next layout. Bounds include ancestor scroll offsets and can have negative x/y; dimensions stay nonnegative.

Web normalizes wheel pixels/lines/pages and routes to the deepest movable scroller under the pointer; at an edge its ancestor can consume the wheel. Button-based scroll controls also work on touch screens. Content dragging, per-node inertia and overlay scrollbars are implemented; see [scroll contracts](scrolling.md) for ownership, cancellation and settings. Existing rectangular masks and hit tests share the same scrolled bounds. Offset-only scrolling updates cached projection without repeating Flex/text measurement; large lists are not virtualized.

Retain the CanvasUI returned by `canvasUI(root)`. `ui.focus(node?)` sets/clears logical focus; `ui.focusNext(reverse?)` walks available buttons, including offscreen entries, and returns undefined at a boundary. Focusing an entry reveals it through scroll ancestors. Call after initial layout/run when using computed bounds. Disabling/removing focused controls or ancestors releases focus. Web synchronizes native button mirrors and uses this traversal for Tab/Shift-Tab without trapping focus at the tree edges. Enter/Space activation and held-key cancellation are Core routing behavior.

The **UI list lab** button in Canvas trail opens a [Core-only screen definition](../examples/canvas-ui/portable-screen.ts) shared with headless tests: add, select, remove, reverse, scroll and navigate without direct DOM/Pixi operations. [Host contracts and migration](host-boundary.md) explain portable cancellation and custom presentation adapters.

## Layout contract

UI coordinates are host CSS dimensions divided by `ui.scale` (default 1). The root fills that extent unless it has explicit dimensions. Camera, world logical resolution, world Fit bars, zoom and physical DPR do not change those units. Root `scale` and resize cause relayout. All dimensions include padding; no border width is deducted. `bounds` is a frozen, root-relative logical rectangle after the last layout. Query after `await run/goTo` or a rendered update; setters invalidate synchronously but layout is deferred until rendering or the next pointer hit-test flush.

| Style                                    | Meaning / default                                                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| direction                                | `column`; Row/Column factories set the corresponding direction                                                                                             |
| width, height                            | nonnegative finite units, or percentage strings relative to the parent's content extent; omitted means intrinsic main size / stretched cross size          |
| minWidth, maxWidth, minHeight, maxHeight | optional finite nonnegative units or percentages of parent content; clamp preferred size and participate in grow/shrink freezing; conflicting minimum wins |
| textWrap                                 | true; wrap Label/Button/HoldButton text at allocated width minus padding; false preserves explicit lines only                                              |
| padding, gap                             | uniform nonnegative units; default 0                                                                                                                       |
| grow, shrink                             | 0 and 1; free space proportional to grow, deficit proportional to shrink × basis; zero-sized items freeze during shrink redistribution                     |
| align, alignSelf                         | cross-axis `start`, `center`, `end`, `stretch`; parent default stretch; optional child override                                                            |
| justify                                  | main-axis `start`, `center`, `end`, `space-between`, `space-around`; default start                                                                         |
| wrap                                     | explicit boolean, default false; greedy lines before flex distribution; line cross size is its largest item, line gap uses gap                             |
| scroll                                   | optional vertical/horizontal/both overflow; retains main-axis content and clips descendants                                                                |
| clip                                     | rectangular clip for self and descendants; default false                                                                                                   |
| pointerEvents                            | `children` (empty space passes through), `auto` (self blocks/receives), `none` (exclude subtree); buttons default auto                                     |
| background, color                        | optional background and text RGB integers 0..0xffffff; text default 0xeff7f6                                                                               |
| fontSize, fontFamily                     | positive units / CSS font family; default 18 / system-ui, sans-serif                                                                                       |
| radius                                   | nonnegative background corner radius, default 6; hit regions stay rectangular                                                                              |

Numeric/percentage sizes resolve before flexible distribution. Percentage values are ignored during intrinsic measurement (the child's content still contributes), then resolve against the allocated parent content box. Avoid cyclic intrinsic/percentage dependencies; use an explicit parent size for percentage children. Min/max constrain border-box sizes before line selection and during flexible distribution. An item reaching a bound freezes and the remaining free space/deficit is redistributed using original bases. A conflicting minimum wins, including mixed absolute/percentage constraints resolved after resize. Zero is valid; negative, nonfinite and malformed dimensions reject with INVALID_UI. If minima cannot fit, overflow is retained rather than violating the constraints. The subset has no CSS basis, margins, order/reverse, align-content, absolute positioning or Grid. Flex `wrap` wraps **nodes**; `textWrap` independently wraps text and defaults to true. Nested rows and columns derive auto height from text remeasured after final horizontal allocation. Intrinsic text with no explicit width fits the available width even with `align: "start"`. Explicit heights and maxHeight can clip text; leave height omitted for content-driven buttons. Oversized children can overflow if shrink is zero or their content cannot fit; use `clip` deliberately. A maximum nesting depth of 64 is enforced during layout; all computed boxes must be finite.

The dirty root is laid out only after geometry/content/visibility/scale/size/font property changes. Hover/press/focus changes only paint. One changed leaf can affect sibling positions and percentages, so a dirty layout traverses the root; there is no claim of subtree-incremental Flex. Load custom browser fonts before creating the tree (for example await `document.fonts.load` in Scene setup); automatic web-font cache invalidation is not provided. Text metrics are cached, native labels update only on changes, and unchanged frames skip UI layout **and** visual tree synchronization. Explicit clipping uses Pixi masks; ordinary full-host UI does not allocate a full-screen mask per node. [Measurements](canvas-ui-performance.md) distinguish model, routing, synchronization and GPU rendering.

## Responsive text and size constraints

```ts verify
import {
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasPanel,
} from "@simpludify/web";
const panel = CanvasPanel(
  [
    CanvasColumn(
      [
        CanvasLabel("Status / 現在の状態\n明示的な改行も保持します。"),
        CanvasButton("Continue / 次のステージへ進む", () => {}, {
          width: "100%",
          minWidth: 120,
          maxWidth: 360,
          minHeight: 48,
        }),
      ],
      { gap: 12 },
    ),
  ],
  { width: "80%", minWidth: 200, maxWidth: 600, minHeight: 80, padding: 16 },
);
console.log(panel);
```

Sizes include padding. Percentages use the parent's content box (root percentages use the host UI extent); minima can deliberately exceed it. Constraints apply on both axes, stretch and each wrap line. Percentage constraints do not contribute a circular intrinsic size; supply a definite parent extent when using percentages on that axis.

Text preserves explicit newlines (CRLF/CR normalize to LF), empty lines and whitespace within an unwrapped line. Soft-wrap boundary spaces are omitted. `Intl.Segmenter` word/grapheme boundaries preserve emoji ZWJ sequences, skin tones, flags and combining marks. English prefers word boundaries; long words/URLs fall back to grapheme boundaries. Japanese can break between characters, with common opening/closing brackets, punctuation and small kana kept off inappropriate line edges when a fitting alternative exists. This is best-effort UI line breaking, not full UAX #14/JIS typesetting, hyphenation, bidi layout or locale-specific typography. A single grapheme or an impossible punctuation pair can exceed a very narrow content width; paint is clipped to the node's box in that case.

Measurement uses complete substrings with the same Pixi font family/size and explicit line string as the rendered Text. Pixi's separate automatic wrapper stays disabled. Final width, padding, text, font, textWrap, constraints, UI scale and host size determine remeasurement. Each live text node keeps at most eight width-specific results; content/font changes replace that cache and Scene disposal clears it. Unchanged frames do no layout, measurement or visual sync. Paint-only changes reuse metrics. Fonts must finish loading before creating the tree; automatic invalidation after an external web-font load remains deferred.

## Pointer events and ownership

`PointerDown`, `PointerMove`, `PointerUp`, `PointerCancel`, `PointerEnter`, `PointerLeave` and `PointerClick` are typed EventBus tokens. Subscribe on `node.events` for UI, or `context.pointer.events` / current `game.pointer.events` for world input. Subscriptions on those buses are released with their owners. Handlers are synchronous, as in Core EventBus; CanvasButton's callback is the separately owned async convenience API.

Payloads are snapshots: `pointerId`, `pointerType`, `button`, `buttons`, `screen`, `world`, `inside`. Screen is host CSS coordinates; world uses the current Camera/ViewTransform at that DOM event. No DOM event or mutable device state is retained. `inside` means the captured UI target's current clipped hit rectangle, or the world view clip. The UI's logical coordinate is screen / ui.scale. World callbacks are input delivery, not simulation updates: set an ActionSource or queue a command when deterministic step timing matters. Replay records Actions, not pointer coordinates or UI events.

The one Game-owned capture-phase DOM adapter routes these events. UI Pixi containers have `eventMode = none`, avoiding duplicate Pixi/DOM dispatch or reliance on a later window bubbling listener. Don't attach another raw DOM handler to implement the same game operation; migrate that handler to the Scene pointer channel. Existing DOM UI keeps its native events and has priority wherever it covers the canvas.

- Hit testing follows the same depth-first paint order (later siblings/descendants win), enabled/visible ancestry and rectangular clips. There is no bubbling between Canvas nodes. A label/panel receiving events needs pointerEvents auto. No Actor/collider hit-test subscription is implicit: world events provide already converted world coordinates for game-specific selection.
- Down locks the UI target or world channel, with one deliberate UI-only exception: an eligible original ancestor scroller can claim a threshold-crossing content drag after cancelling the old target. Capture is automatic; dragging outside UI keeps that target. A HoldButton stays held until up/cancel, even outside. Click/activation requires primary-button down and up inside the original target. Secondary mouse buttons can deliver Down/Move/Up but do not hold/activate buttons.
- World downs outside `view.clip` are ignored; UI in Fit bars remains interactive. UI will not steal an already-started world gesture. World clicks require release inside the view clip. Each pointer is independent.
- Cancel/lost capture, window blur, hidden document, disable, removal, Scene replacement and Game disposal release relevant holds. Invalidated gesture IDs remain suppressed until their physical up/cancel or a fresh down, preventing a transfer into a new Scene. Removing a UI never turns its pending drag into a world drag. [Scroll contracts](scrolling.md) specify content/thumb arbitration and momentum. Terminal disposal clears all routing state.
- Move/hover without a held gesture goes to the current hit. Enter/Leave are per UI target, without bubbling. Layout changes affect the next hit test; hover is not synthesized continuously while the device is stationary. Moving UI under a held pointer changes inside/click eligibility, but not ownership.
- UI/world events are live while simulation is paused. `game.pause/resume` release gestures/keyboard holds; Engine state changes silently clear Action contributions and pending edges. A held control must be released/repressed to contribute again. Direct Core pause/resume still has its documented silent reset; Web release is additional host cleanup.

## Keyboard and accessibility scope

Rendered buttons have native, invisible, pointer-transparent button mirrors using the same resolved/clipped bounds, name, busy/disabled/held state and tree order. Tab/Shift-Tab focus them; Canvas draws a gold focus ring. Enter/Space press/release the focused control; autorepeat does not create repeated presses and an unmatched keyup cannot activate. Blur releases keyboard holds. Invisible/clipped/disabled controls are excluded or disabled in the native mirror; Core traversal can reveal offscreen entries in a scroll container. DOM UI/native editors retain their own keys. Canvas mouse/touch controls focus the Game surface, allowing keyboard and touch Action sources to overlap instead of stealing keyboard focus.

A native accessibility activation invokes Button callbacks. Text-only Canvas labels/panels are not mirrored as a semantic document, live regions are not automatically announced, HoldButton is not a universal assistive-technology gesture replacement, and no actual screen-reader/OS IME/physical mobile conformance is claimed. Use DOM UI for those richer requirements. Focus is released when a Scene UI is removed; the application/browser chooses the next focus, and the engine does not trap Tab.

Run [Canvas trail](../examples/canvas-ui/README.md) for the complete Sprite/Tilemap/Collision/HUD/input/Scene integration example. [Implementation and validation](canvas-ui-implementation.md) records actual gates and limitations.

[Touch dragging, inertia, overlay scrollbars and dynamic policy](scrolling.md) document the current portable scrolling API. [Measured projection costs](scroll-performance.md) separate layout work from actual renderer performance.
