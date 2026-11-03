# Scenes, state and UI

Game registers typed Scene factories; each visit creates a new owned Scene. The game defines menu/play state and rules. Use [Canvas UI](../../docs/canvas-ui.md) for controls drawn with the game, or native DOM UI for document layout and richer browser semantics.

```ts verify
import {
  Action,
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
game.scene("menu", ({ ui }) =>
  ui(Panel([Label("Ready?"), Button("Start", () => game.goTo("play"))])),
);
game.scene("play", ({ add, actions, ui }) => {
  const controls = actions(Actions, { Move: KeyboardBindings.WASD });
  add(Character({ movement: controls.reader(Actions.Move) }));
  ui(Panel([Button("Menu", () => game.goTo("menu"))]));
});
await game.run("menu");
```

Factories may be async. Own cleanup before awaiting, and use the supplied AbortSignal for cancellable Web tasks. Await run before navigating. Concurrent identical goTo requests coalesce; different requests queue. A pre-commit preparation/asset failure leaves the active Scene intact. Lifecycle callback failures after commit are reported while retaining the new Scene. Game.dispose cancels pending navigation promptly.

Scene owns Actors, events, simulation timers, ActionControllers and one Canvas UI root. Actor/Component owners can shorten a subscription/source lifetime. onActivate/onDeactivate/onDispose run synchronously; Core callbacks must not return Promises. Web Button callbacks may be async, receive cancellation, prevent duplicate activation with aria-busy/aria-disabled and route failures to diagnostics. Late completion cannot mutate a replacement UI.

Label.setText updates subscribed DOM text. Store semantic game state in a normal game model, update only affected labels, and keep simulation independent from DOM nodes. Panels default to Column; Row wraps and Grid auto-fits. Layout/Placement select responsive grouping/position; camera zoom does not scale DOM UI. [Layout](layout.md) explains Canvas bounds and world viewports.

Theme.Dark/Light and partial background/surface/text/muted/accent/font tokens customize appearance. Color tokens are validated CSS colors and applied to color-only properties; font names may use quotes/escapes and fallback stacks. Unknown themes/tokens and unsafe values throw INVALID_THEME/INVALID_THEME_TOKEN. Maintain contrast and keyboard accessibility when overriding tokens.

Native buttons use Tab, Enter and Space. Engine buttons may pass unrelated gameplay keys; native editors/selects/contenteditable and IME own their keys. Empty UI overlay space does not capture world pointer input. Gamepad gameplay follows focused-host/editor eligibility and does not automatically navigate UI. Use [Actions](../../docs/action-input.md) and [gamepads](../../docs/gamepads.md) for input ownership.
