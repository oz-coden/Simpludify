# Scenes, state and UI

Simpludify cleanly separates game simulation logic from DOM presentation, using typed Scene IDs for structured screen transitions. The game defines menu, play, and game-over states in standard application code. Use [Canvas UI](./specs/canvas-ui.md) for controls drawn inside the game canvas, or native DOM UI for document-style overlay layouts.

## Registering Scenes

```ts verify
import {
  Action,
  ActionController,
  Button,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
  Label,
  Panel,
} from "@simpludify/web";

const game = new Game<"menu" | "play">();
const Actions = defineActions({ Move: Action.axis2D() });

game.scene("menu", ({ ui }) => {
  ui(Panel([Label("Ready?"), Button("Start", () => game.changeScene("play"))]));
});

game.scene("play", ({ scene, add, ui }) => {
  const controls = new ActionController(Actions, {
    scene,
    input: game.engine.input,
    bindings: { Move: KeyboardBindings.WASD },
  });
  add(Character({ movement: controls.reader(Actions.Move) }));
  ui(Panel([Button("Menu", () => game.changeScene("menu"))]));
});

await game.run("menu");
```

Await `game.run` before calling `game.changeScene`. During scene preparation, the active Scene continues running. If preparation fails, the existing Scene remains active. Once preparation succeeds, the new Scene is committed. By default the old Scene is disposed and navigating to the same Scene ID constructs a fresh instance. To keep a Scene across navigation, set `sceneRetention: "retain"` on Game or pass `{ retention: "retain" }` when registering it. [Retained Scene behavior](api.md#retained-scenes).

## Asynchronous setup and cancellation

Scene setup functions may return a Promise. Pass the context `signal` to async operations and register cleanup via `onDispose` before awaiting. Game disposal promptly cancels pending navigation. A Scene aborts its own setup signal on disposal. Use the context `assets` to keep resources until the Scene is disposed, including while it is retained. Arbitrary application Promises cannot be forcibly stopped; use the signal to handle early cancellation gracefully.

Core Scene lifecycle states are **Preparing → Ready → Active → Inactive → Disposed**. The Web layer manages asset preparation and presentation consistency. Do not invoke `markReady` or `Engine.activate` manually from Web scene factories.

## Reflecting state in UI

`Label.setText` updates the DOM only when the text content changes, avoiding unnecessary DOM invalidation:

```ts
const score = Label("Score 0");
scene.events.on(
  ScoreChanged,
  (state) => {
    score.setText(`Score ${state.score}`);
  },
  scene,
);
ui(Panel([score]));
```

In Signal Run, the `Round` model tracks HP, score, remaining time, and victory conditions in Core; the Web Scene connects these values to labels and navigation buttons. No universal global state store is mandated.

## Layout and styling

`Panel` defaults to `Layout.Column`; `Layout.Row` wraps elements; Grid auto-fits columns. Choose `Placement.Top`, `Center`, or `Bottom`. Theme tokens support `Theme.Dark`, `Theme.Light`, or partial token overrides for background, surface, text, muted, accent, and fonts. Camera zoom does not scale or affect the DOM UI overlay.

Tokens must be valid CSS colors accepted by the browser. Background tokens are applied to `background-color`; image functions are not supported. Invalid themes or unsafe font syntax throw `INVALID_THEME` or `INVALID_THEME_TOKEN` before creating DOM elements.

## Button behavior and keyboard focus

`Button` is a native HTML button element supporting Tab navigation, Enter, and Space keys. Synchronous handlers preserve focus. While an asynchronous handler runs, the button sets `aria-busy` and `aria-disabled` with duplicate-execution guards to prevent re-triggering and temporarily leaves Tab focus. Gameplay keys such as WASD continue uninterrupted. Unhandled errors are routed to the Game error observer.

## Ownership and error boundaries

Scope subscriptions, timers, and ActionSources to the Scene, Actor, or Component. For custom DOM event listeners, use the setup `signal` or register cleanup callbacks. Disposal is idempotent; failures in one cleanup handler do not prevent remaining handlers from executing.

Pre-commit setup errors preserve the previous Scene. Errors occurring in lifecycle hooks after commit are reported while retaining the new Scene. See [Architecture](architecture.md) for full transaction contracts.
