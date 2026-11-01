# Published SDK consumer patterns

The public npm packages `@simpludify/core@0.1.1` and `@simpludify/web@0.1.1` are intended for independent projects. This page records integration patterns observed while migrating [Run To Exit](https://github.com/oz-coden/Run-To-Exit) from a vendored engine workspace to npm.

## Installation and distribution

Start with the [npm/Vite guide](../site/ja/npm.md). Install from npm, commit the generated lockfile, and use `npm ci` in CI. The Web package re-exports the Core public API and requires Core at the matching version. Use public package exports, not copied engine source or source-path aliases.

Include the dependency license texts and notices when redistributing a bundled game. Inspect the **actual locked production dependencies**: transitive packages may omit their license file from the published archive. An automated notice generator should report missing license text explicitly rather than silently claiming complete coverage.

## Canvas HUD and game world viewport

Canvas UI uses CSS-sized layout while world rendering is controlled by the Game viewport. For a map below a game HUD, reserve a consistent region and update it when the host size changes:

```ts
const updateViewport = () => {
  const width = game.element.clientWidth;
  const height = game.element.clientHeight;
  if (width > 0 && height > 0) {
    game.setViewport({
      x: 0,
      y: 64,
      width,
      height: Math.max(1, height - 96),
    });
  }
};
const resizeObserver = new ResizeObserver(updateViewport);
resizeObserver.observe(game.element);
context.onActivate(updateViewport);
context.onDispose(() => resizeObserver.disconnect());
```

The 64px HUD and 32px lower inset above are application-specific _examples_, not framework constants. For a dynamic layout, the application should read its own UI bounds and update the viewport whenever layout changes. Convert pointer world positions through `tilemap.worldToTile` rather than dividing browser client coordinates by tile size.

A possible future helper could connect a layout-owned region to a world viewport, but must clarify CSS vs logical units, scaling, scene disposal, pointer hit-testing, and empty-size behavior before being introduced as a public API.

## Canvas and DOM focus integration

Canvas controls are suitable for in-game HUDs and menus; a long reorderable instruction editor with native inputs, IME and accessible document structure may be better kept in DOM.

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

See [Tween and animation](tween.md) and the [Tween lab](../examples/tween/README.md) for complete engine examples, and the [Run To Exit integration review](https://github.com/oz-coden/Run-To-Exit/blob/main/docs/engine-review.md) for a working consumer example.
