# Published SDK consumer patterns

The public npm packages `@simpludify/core@0.1.4` and `@simpludify/web@0.1.4` are intended for independent projects. This page records integration patterns observed while migrating [Run To Exit](https://github.com/oz-coden/Run-To-Exit) from a vendored engine workspace to npm.

## Installation and distribution

Start with the [npm/Vite guide](../../site/ja/npm.md). Install from npm, commit the generated lockfile, and use `npm ci` in CI. The Web package re-exports the Core public API and requires Core at the matching version. Use public package exports, not copied engine source or source-path aliases.

Include the dependency license texts and notices when redistributing a bundled game. Inspect the **actual locked production dependencies**: transitive packages may omit their license file from the published archive. An automated notice generator should report missing license text explicitly rather than silently claiming complete coverage.

## Canvas HUD and game world viewport

Canvas UI uses CSS-sized layout while world rendering is controlled by the Game viewport. Starting with v0.1.2, bind the resolved Flex region rather than duplicating HUD height constants:

```ts
const region = CanvasPanel([], { grow: 1, pointerEvents: "none" });
const ui = context.canvasUI(
  CanvasColumn([hud, region, hint], { height: "100%" }),
);
game.bindViewport(ui, region);
```

The binding follows layout changes, text wrapping, UI scale and host resize. It converts resolved UI units to CSS viewport pixels, clips empty regions and releases automatically when the UI or region is disposed. Use `pointerEvents: "none"` for a noninteractive world spacer so it does not capture world input. See [API contracts](../api.md) and the [integration lab](../../examples/sdk-integration/README.md).

Published v0.1.1 consumers continue to use `setViewport` with their own scoped `ResizeObserver`; `bindViewport` requires the v0.1.2 release. Convert pointer world positions through `tilemap.worldToTile` rather than dividing browser client coordinates by tile size.

## Canvas and DOM focus integration

Canvas controls can also compose instruction editors and paged event logs. Use Scroll for bounded forms, retain node identity during simulation updates, and restore logical focus after structural edits. SDK v0.1.3 mirrors CanvasLabel text, with optional heading levels and atomic status/alert regions. Published 0.1.2 omits noninteractive text from its mirror; full Canvas migrations require v0.1.3 or later. Actual screen-reader announcements require separate manual verification.

- Give a keyboard-operable map region an accessible name, a visible focus state and a textual description of its selected cell. Use arrow keys only when **that region** has focus, so DOM text and number fields retain their key ownership.
- When rebuilding DOM command rows after inserting, deleting or reordering, identify a surviving control to focus. Prefer logical row identity to a stale DOM element.
- Keep Canvas controls in the expected Tab sequence via the engine's accessibility/mirror support; test transitions between Canvas and DOM.
- Test real pointer/touch input separately from keyboard input, including narrow screen scroll and native editing behavior.

These are application integration responsibilities; avoid a game-specific giant widget in Core solely to accommodate one command editor.

## Deterministic world state and presentation Tween

For turn-based or integer-step games, **commit the discrete world first**; use `scene.presentationTweens` to animate a _separate_ numeric display progress. Never allow presentation frames to affect collision, occupancy, door schedules, or replay state.

The following pattern shows the separation; `renderBetween` belongs to the game and reads two immutable world snapshots.

```ts
import { Tween, Easing } from "@simpludify/web";

const display = { progress: 1 };
let oldWorld = world;
let newWorld = world;
let active: ReturnType<typeof scene.presentationTweens.play> | undefined;

function showCommittedWorld(committed: World) {
  active?.finish(); // finish the preceding finite animation
  oldWorld = newWorld;
  newWorld = committed;
  display.progress = 0;
  active = scene.presentationTweens.play(
    Tween.to(Tween.property(display, "progress"), 1, {
      duration: 0.24,
      easing: Easing.InOutCubic,
    }),
    { owner: scene },
  );
}

context.onUpdate(() => renderBetween(oldWorld, newWorld, display.progress));
```

This is a **pattern sketch**, not a standalone copy-paste example: `world`, `World`, and `renderBetween` are application symbols. For actual rendering during a simulation pause, choose an appropriate rendering/update hook for the host. For rapid step advancement or restarting from the initial state, decide whether to finish or cancel the old animation and deliberately reset the endpoints. Scene ownership ensures cleanup on scene disposal.

See [Tween and animation](tween.md) and the [Tween lab](../../examples/tween/README.md) for complete engine examples, and the [Run To Exit integration review](https://github.com/oz-coden/Run-To-Exit/blob/main/docs/engine-review.md) for a working consumer example.

## Executable integration and independent starter

The [SDK integration lab](../../examples/sdk-integration/README.md) exercises Flex-owned world space, DOM/Canvas Tab traversal, display-only discrete Tween and Scene replacement. Its `Game.bindViewport` helper is published functionality in v0.1.2. The existing `setViewport` pattern above remains valid for 0.1.1.

The [independent npm/Vite starter](../../templates/npm-vite/README.md) uses published 0.1.3 APIs, including layout-bound viewports. It has a committed lockfile, `npm ci`, explicit CSS, Scene startup/disposal, Pages `--base`, and fail-on-missing production license generation. CI copies it outside the workspace and validates it on Windows and Linux. No CLI generator is necessary for this small, inspectable template.
