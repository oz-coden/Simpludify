# API

The Web entry point is `@simpludify/web`; it also re-exports the core API and loads the default CSS. The DOM-free entry point is `@simpludify/core`. All mode objects export a same-named union type.

## Minimal Web game

```ts
import { Game, Character, Movement } from "@simpludify/web";
const game = new Game();
game.add(Character({ movement: Movement.WASD }));
await game.run();
```

Supply a parent with a defined height for an embedded/full-screen game. Without a parent the host is appended to `document.body`; its CSS is 100% wide/high with a 20rem minimum height. Default stylesheet selectors are scoped to `.simpludify`. Override them in application CSS for different spacing, sizes or fixed placements. Fixed geometry may clip; it does not inherit responsive guarantees.

## Game

| Option                        | Default                      | Meaning                                                                               |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `parent`                      | `document.body`              | Existing parent; Game creates/removes only its own child host                         |
| `world.width`, `world.height` | 800, 450                     | Positive logical world extent                                                         |
| `world.aspect`                | `Aspect.Fit`                 | Fixed-ratio fit, fixed-ratio fill/crop, or adaptive extent                            |
| `theme`                       | `Theme.Dark`                 | Dark or Light token set                                                               |
| `tokens`                      | none                         | Partial background/surface/text/muted/accent/font overrides                           |
| `seed`                        | 1                            | Seed for managed PRNG (converted to unsigned 32-bit)                                  |
| `maxDelta`                    | 0.05                         | Positive seconds; Web frame delta clamp                                               |
| `renderer`                    | PixiRenderer factory         | RendererPort factory receiving owned host                                             |
| `frames`                      | requestAnimationFrame driver | Host-controlled frame scheduling                                                      |
| `onError`                     | none                         | Observer for background callback/cleanup/UI errors; UI errors also appear in an alert |

`add(character)` and `uiOverlay(...nodes)` configure the default scene before `run()`. `scene(id, setup)` registers a unique factory and returns the Game for chaining. `Game<'menu' | 'play'>` restricts scene IDs at compile time. Setup receives `add`, `ui`, `onUpdate`, `onDispose`, and the owned `scene`. Setup may return a Promise; updates/rendering begin after readiness. Register cleanup before awaiting user asynchronous work.

`run(initialScene?) -> Promise<void>` resolves after the initial scene and assets are ready and the first render has happened. Use `await` or handle its rejection. `goTo(id) -> Promise<void>` queues navigation; readiness failure preserves the current scene. Calling it before `run` initialization or after disposal rejects. A failed transition does not poison the queue. Duplicate registration throws. `dispose()` is synchronous and idempotent.

`engine` exposes snapshots and synthetic input for testing. `element` exposes the focusable host. Avoid direct core scene activation/step calls on a running Web game.

## Character and movement

```ts
import { Character, Movement } from "@simpludify/web";
const player = Character({
  id: "player",
  x: 400,
  y: 225,
  speed: 180,
  size: 32,
  movement: Movement.WASD,
});
```

| Option     | Default               | Units/behavior                                                         |
| ---------- | --------------------- | ---------------------------------------------------------------------- |
| `id`       | omitted               | Optional ID, unique within one scene                                   |
| `x`, `y`   | 400, 225              | Finite world coordinates; center of the character                      |
| `speed`    | 180                   | Positive world units/second                                            |
| `size`     | 32                    | Positive logical width/height of placeholder or image box              |
| `color`    | `0x73e3c0`            | RGB integer for the built-in rounded placeholder                       |
| `movement` | `Movement.None`       | `WASD`, `Arrows`, or `None`                                            |
| `keys`     | map for movement mode | Explicit physical key-code arrays `up/down/left/right`; overrides mode |
| `sprite`   | omitted               | Image URL; readiness rejects if it cannot be loaded                    |

Image sprites are centered and sized to a square `size × size`; source aspect preservation/sprite-sheet animation are deferred. Use a same-origin asset or a CORS-enabled image. In Vite use `import playerUrl from './player.png'` or `import.meta.env.BASE_URL + 'player.svg'` for a public asset. Each scene owns its textures. The placeholder and sample SVG are original MIT assets.

Input uses a Set of pressed codes. Repeats do not accelerate movement. Up+down or left+right cancel. Diagonal vectors have unit length. `player.x/y` are mutable; no collision, bounds clamping, animation, camera follow or world wrapping is implicit. A custom world extent does not recenter the default `(400,225)`; set coordinates explicitly for another extent.

## Scenes and UI

```ts
import {
  Game,
  Character,
  Movement,
  Label,
  Button,
  Panel,
} from "@simpludify/web";
const game = new Game<"menu" | "play">();
game.scene("menu", ({ ui }) => {
  ui(Panel([Label("Ready?"), Button("Play", () => game.goTo("play"))]));
});
game.scene("play", ({ add, ui, onUpdate, onDispose }) => {
  const player = add(Character({ movement: Movement.WASD }));
  const status = Label("Move with WASD");
  ui(Panel([status, Button("Menu", () => game.goTo("menu"))]));
  onUpdate(() => status.setText(`x = ${Math.round(player.x)}`));
  onDispose(() => {
    /* Release application-owned subscriptions/resources. */
  });
});
await game.run("menu");
```

`Label(text, { muted?: boolean })` creates a text descriptor. `setText` notifies subscriptions only if the text changes; DOM mounting unsubscribes on scene disposal. Text is inserted using `textContent`. `Button(text, onClick)` is a native button; handlers may return a Promise. The button is disabled while its handler runs; failures reach the game error observer and alert. A disposed button no longer invokes its handler.

`Panel(children, { title?, layout? })` defaults to `Layout.Column`. `Layout.Row` wraps and `Layout.Grid` uses auto-fitting columns. Panels have intrinsic size and a maximum width of 30rem; the overlay fits the host and scrolls when necessary. UI has no default absolute coordinates. System fonts are the default, with semantic color/font overrides through `tokens`. Packaged local fonts use ordinary `@font-face` in application CSS and `tokens.font`. Load required fonts with `await document.fonts.load(...)` before `run` if first-frame font readiness matters; there is no separate engine font manager.

Native focus/keyboard behavior is preserved. The game does not autofocus on startup. Click empty game space or Tab to the host to move; Tab to buttons and use Enter/Space for activation. Custom colors/fonts must preserve the application's accessibility requirements.

## Aspect and coordinate transforms

`Aspect.Fit` uses the smaller viewport/world scale, centered with background bars. `Aspect.Fill` uses the larger scale and crops. Neither distorts proportions. `Aspect.Adaptive` uses scale 1 and world extent equal to viewport CSS pixels; UI reflows independently of every world policy.

`viewTransform(viewportWidth, viewportHeight, worldView)` returns `{ scale, x, y, worldWidth, worldHeight }`. To convert a host-local CSS coordinate to world coordinates use `(screenX - x) / scale`, `(screenY - y) / scale`. The renderer's device pixel ratio does not enter this conversion. A public pointer/world picking API is deferred.

## Headless execution

```ts
import { Engine, Character, Movement, Scene } from "@simpludify/core";
const engine = new Engine(42);
engine.scene.add(Character({ movement: Movement.WASD }));
engine.input.set("KeyD", true);
engine.step(1 / 60);
console.log(engine.snapshot());
engine.activate(new Scene("next"));
engine.dispose();
```

`InputState.set(code, pressed)`, `clear`, `isPressed`, `snapshot`, and `direction(map)` support synthetic input. Key snapshots are sorted. `Engine.step` rejects negative/nonfinite seconds; zero is allowed. It advances movement before scene update callbacks. `random()` yields a deterministic value in [0,1); snapshots include scene ID, elapsed time, PRNG state, input and character positions, but not user data or restorable renderer state.

A Scene owns entities, update callbacks and LIFO cleanup callbacks. `seal()` closes the entity roster; Web calls it at readiness. `dispose` releases all callbacks/entities and throws an AggregateError after running all failing cleanups. `Engine.activate` clears input and disposes the old scene. If old cleanup throws, the new scene remains active.

## Errors and adapter contracts

`EngineError` has `code`, `message`, `details`, and `toJSON()`. Current codes include `INVALID_VALUE`, `INVALID_MOVEMENT`, `INVALID_ASPECT`, `INVALID_THEME`, `INVALID_DELTA`, `DUPLICATE_ENTITY`, `DUPLICATE_SCENE`, `SCENE_NOT_FOUND`, `SCENE_SEALED`, `SCENE_DISPOSED`, `GAME_NOT_READY`, `GAME_DISPOSED`, `RENDERER_NOT_READY`, `ASSET_LOAD_FAILED`. Arbitrary user errors are not rewritten. Scene/asset diagnostic context is included where available.

Custom RendererPort implementations must make disposal idempotent, handle disposal during async `init/prepare`, and release every prepared resource. A prepared scene's `render` reads live positions, and `dispose` must release its owned resources. A FrameDriver must schedule callbacks asynchronously and cancel outstanding handles. Browser tests inject fake ports to exercise readiness/ownership; real Pixi tests verify the default implementation.
