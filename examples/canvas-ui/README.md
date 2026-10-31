# Canvas trail

```sh
npm run dev -- --example canvas-ui
```

Start opens a SpriteAnimation character in a SpriteSheet Tilemap. WASD and four Canvas hold buttons share the same typed Move Action. Stone stops the dynamic circle through CollisionWorld; water is a Trigger. Slide along the wall, edit the wall at (14,7), pause/resume with P/Escape or the Canvas button, select a world tile by clicking empty UI space, then Menu/Start to destroy and recreate the Scene. The Camera follows the corrected Actor; HUD and touch controls remain in screen coordinates. Resize to see Flex node wrapping, a min/max-constrained title panel and automatic Japanese/English text wrapping. Buttons use minimum height with automatic content height; each computed rectangle also drives pointer and keyboard-mirror bounds. Tab/Enter/Space operate mirrored native buttons and draw the focus ring on Canvas.

The existing DOM UI example remains independent. Canvas widgets render through Pixi, including Canvas2D fallback. This example does not implement a custom collision/movement/input router. `context.actions` supplies the staged Scene/input, `controls.createSource(node)` scopes each touch contribution, and `context.canvasUI(root)` scopes the entire UI tree. Async navigation buttons receive an owner AbortSignal; Scene disposal cancels gestures and subscriptions.

Original terrain/character SVG assets are reused from Tile trail/Sprite garden. No external artwork or layout runtime is added.

## Portable UI list lab

Choose **UI list lab** from the title screen. Select entries with Enter/Space or pointer input, add/remove/reverse them, scroll with the wheel or on-screen buttons, and use Tab/Shift-Tab to reveal entries outside the viewport. Back returns to the title. `portable-screen.ts` imports only Core and builds its full UI from Canvas factories; Web mounts it without game-specific DOM or Pixi code. The same definition runs in headless tests. The lab now supports content/thumb dragging, momentum and per-viewport live policies. Native editable/select/number controls and alternate Hosts remain unimplemented.

The main viewport exposes Inertia, Bars and Drag switches. The second viewport has its own inertia switch and always-visible bars; it contains nested both-axis cards and an immediate HoldButton. Hold then drag to see cancellation. Child ownership locks for a gesture; release and begin again at an edge to scroll an eligible parent. See [scroll contracts](../../docs/scrolling.md) and [measurement limits](../../docs/scroll-performance.md).

## Settings lab

Open **Settings lab** from the title screen. `settings-screen.ts` imports only Core: sound/grid checkboxes, volume/speed sliders, read-only mode, preview, Apply snapshot, Reset and Back. Drag sliders horizontally; vertical gestures scroll the form. Tab reveals controls; Space/Enter toggle checkboxes and arrows/Home/End/Page keys adjust sliders. Slider cancellation retains its immediate value. Apply stores a separate snapshot; Reset restores editing defaults. [Full control contract](../../docs/canvas-controls.md). Difficulty Select, player-name TextInput and a synchronized numeric volume field use the same standard API. Enter accepts text, Escape restores its accepted value, and Tab traverses/reveals fields. Native editing/IME contracts and unverified physical targets are documented in [the editing guide](../../docs/text-input-design.md).
