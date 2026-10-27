# Typed Action input

Action input separates physical keyboard positions from game meaning. Core owns typed tokens, bindings, source composition and explicit input boundaries. Web reuses the focused BrowserInput adapter; no DOM type enters Core. Character/KeyboardController and raw InputState remain available for small presets and physical-input tests.

## Define and use actions

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Engine,
  KeyCode,
} from "@simpludify/core";
const Actions = defineActions({
  Move: Action.axis2D(),
  Fire: Action.button(),
  Pause: Action.button(),
  Yaw: Action.axis1D(),
  Orientation: Action.axis3D(),
});
const engine = new Engine(42);
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: {
    Move: {
      x: {
        negative: [KeyCode.A, KeyCode.ArrowLeft],
        positive: [KeyCode.D, KeyCode.ArrowRight],
      },
      y: { negative: [KeyCode.W], positive: [KeyCode.S] },
    },
    Fire: { keys: [KeyCode.Space, KeyCode.Enter] },
    Pause: { keys: [KeyCode.P, KeyCode.Escape] },
    Yaw: { negative: [KeyCode.Q], positive: [KeyCode.E] },
  },
});
const automatic = controls.createSource(engine.scene);
automatic.set(Actions.Move, { x: 0.5, y: 0 });
automatic.set(Actions.Fire, true);
engine.scene.onUpdate(() => {
  const movement = controls.value(Actions.Move); // Axis2DValue
  const fire = controls.value(Actions.Fire); // boolean
  const yaw = controls.value(Actions.Yaw); // number
  const orientation = controls.value(Actions.Orientation); // Axis3DValue
  // Apply these values to ordinary game rules or Motion.direction.
});
controls.onPressed(Actions.Pause, () =>
  engine.paused ? engine.resume() : engine.pause(),
);
engine.step(1 / 60);
console.log(controls.snapshot());
engine.dispose();
```

Definitions contain kinds, not default game actions. Tokens carry a literal name, kind and runtime identity. A controller accepts only tokens from its definition; foreign tokens with identical names/kinds are also rejected at runtime. There are no built-in Fire/Jump/Yaw semantics. `Action.button` is deliberately namespaced so it does not conflict with the Web UI `Button` factory. `value(token)` infers boolean, number, Axis2DValue or Axis3DValue. Button-only operations reject Axis tokens at compile time.

The known-code table follows [UI Events code values](https://www.w3.org/TR/uievents-code/) and also accepts common F13–F24 codes; Unidentified is not bindable.

`KeyCode.W` means `KeyboardEvent.code === "KeyW"`, the physical key position. `KeyboardEvent.key` is layout/modifier-dependent text and is not a binding identifier. Static KeyMap and Action bindings accept the finite KeyCode union, including known literal code values. `isKeyCode(unknown)` narrows external data; `parseKeyCode(unknown)` throws INVALID_KEY_CODE. Raw InputState/InputSource.set(string, boolean) and BrowserInput remain low-level escape hatches; device axes are logical ActionSource values rather than invented keyboard codes.

## Input boundaries and buttons

Engine.step first performs implicit initial activation if needed, then captures Actor/Component/timer eligibility and freezes physical input and every active ActionController, then delivers onPressed callbacks, then runs simulation unless paused/disposed. All controllers are captured before the first callback. Input writes and rebinds during a callback/component affect the next boundary. Captured values/vectors/ButtonState are immutable for that boundary; repeated reads do not consume edges. Engine.step(0) is still an input boundary. Invalid/reentrant steps do not consume input.

Action input capture and onPressed controls also run while the Engine is paused, so the same Pause action can resume it. Simulation components, contacts, timers and Scene.onUpdate remain suspended. A resume in an input callback permits that step's supplied delta to simulate; a pause skips it. Pause from a running simulation component still takes effect on the next step. Web Game.pause/resume resets the RAF timestamp as before.

`button(token)` returns held, pressed, released, pressCount and releaseCount. A down/up between steps yields held=false, pressed=true, released=true. Multiple presses are counted; `events` preserves cross-button transition order and tokens. onPressed runs for each recorded logical press, synchronously, at the boundary (not inside a DOM handler). Errors aggregate after other eligible callbacks; async handlers are rejected like other Core events. Use the ordered events for commands where rotate/drop order matters. Axis values are continuous state; an axis excursion completed between steps is not a queued command.

One button is the OR of its keyboard keys and all logical sources. Releasing one key/source while another holds it creates no release. Source clear/dispose produces a normal logical release if the last contribution disappears. Global InputState.clear, Engine.pause/resume state changes and Scene replacement instead flush all held contributions and pending transitions silently, without artificial release/press events. The previous captured frame remains unchanged until the next boundary. Web ignores keyboard autorepeat down events, preventing a still-held pause key from immediately toggling again after a clear; a fresh press is required.

## Axes and device sources

Axis1D sources supply finite numbers in [-1,1]. Axis2D/3D supply exactly x/y or x/y/z, each finite and in [-1,1]. Inputs are copied, not retained by reference. Keyboard negative/positive groups each contribute -1/0/+1; opposites cancel. All sources add componentwise, then each component clamps to [-1,1]. Axis2D/3D default to clamping vector length to 1; analog magnitudes below 1 are preserved. `{ normalize: false }` retains independent clamped components, allowing diagonal length sqrt(2) or sqrt(3). No rotation, camera or movement rule is implied.

createSource(owner?) returns an independently releasable logical source. The controller always owns its sources; an optional Actor/Component/Lifetime owner may shorten their lifetime. A Scene's controllers must use the same Engine InputState; cross-Engine activation is rejected before commit. Scene disposal destroys the controller, its callbacks and every source. Disposed sources permit harmless neutral writes/releases, but reject new non-neutral values. InputState.sourceCount includes explicit physical and logical sources, excluding the legacy implicit scripted keyboard source.

In Web Game, active controller bindings are automatically accepted by the existing focused keyboard source; no extra BrowserInput is needed. Preparing Scene bindings do not capture browser keys. Replacement clears staged contributions at commit; default headless initial activation preserves pre-injected synthetic input. Native buttons/editable controls keep their keyboard interaction. Keyboard focus/blur releases only that physical source; independent touch/program contributions remain until their own release or a global clear.

```ts verify
import {
  Action,
  ActionController,
  Button,
  defineActions,
  Game,
  HoldButton,
  KeyCode,
  Panel,
} from "@simpludify/web";
const Actions = defineActions({ Fire: Action.button() });
const game = new Game<"play">();
game.scene("play", ({ scene, ui }) => {
  const controls = new ActionController(Actions, {
    scene,
    input: game.engine.input,
    bindings: { Fire: { keys: [KeyCode.Space] } },
  });
  const touch = controls.createSource(scene);
  ui(
    Panel([
      HoldButton("Fire", (held) => touch.set(Actions.Fire, held)),
      Button("Fire once", () => {
        touch.set(Actions.Fire, true);
        touch.set(Actions.Fire, false);
      }),
    ]),
  );
  scene.onUpdate(() => {
    if (controls.pressed(Actions.Fire)) {
      /* game command */
    }
  });
});
// Await game.run("play") in the browser entry; dispose game when removing it.
```

## Runtime binding changes

- getBinding(token) returns immutable normalized data; duplicate codes within one direction/key list are deduplicated.
- rebind(token, binding) replaces it; addBindings/removeBindings merge/subtract the supplied key lists.
- resetBindings(token?) restores initial constructor defaults for one/all actions.
- conflicts() reports keys appearing in multiple actions or directions. Shared keys are allowed; detection does not prohibit a binding.
- Changes apply at the next boundary. Held physical keys are adopted using the new mapping, but the changed action's pending keyboard/button edges are discarded without synthesizing a new press/release. Logical source values are preserved.
- exportBindings() returns JSON-compatible version 1 data keyed by action names. importBindings(unknown) validates all names, fields and KeyCodes before atomically applying it. The file must contain exactly the defined actions; renaming an action requires a configuration migration. Core owns no storage or settings UI.

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Engine,
  KeyCode,
} from "@simpludify/core";
const Actions = defineActions({ Yaw: Action.axis1D() });
const engine = new Engine();
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: { Yaw: { negative: [KeyCode.Q], positive: [KeyCode.E] } },
});
controls.rebind(Actions.Yaw, { negative: [KeyCode.Y], positive: [KeyCode.I] });
controls.addBindings(Actions.Yaw, { positive: [KeyCode.ArrowRight] });
controls.removeBindings(Actions.Yaw, { positive: [KeyCode.ArrowRight] });
const saved = JSON.stringify(controls.exportBindings());
controls.importBindings(JSON.parse(saved));
console.log(controls.conflicts(), controls.getBinding(Actions.Yaw));
controls.resetBindings();
engine.dispose();
```

## Scope and migration

Action controllers are not an input-context/priority stack, a gamepad adapter or a full replay/save system. Gamepad adapters may write analog values into their own source later. snapshot copies captured logical state; events/tokens and user component state are not a restorable save format. Reproducibility requires controlled seed, step sequence and inputs, including command order.

Existing raw key tests and Character/KeyboardController continue to work. Action-based games should read logical values/edges, register bindings once, feed touch/AI through ActionSource and remove per-game keydown command queues. Changing bindings then does not change game logic. No Engine movement behavior depends on an action name.


## Validation and measured scope

The integrated source checkpoint is [`1017c25`](https://github.com/oz-coden/Simpludify/commit/1017c259598b47dde823970264473196a08b2428). Lifecycle/timer fixes are independently saved in `335d93d`, and the initial Action foundation in `94f0df8`.

- Strict TypeScript and DOM-free Core checks pass, including `@ts-expect-error` contracts for unknown keys/actions, value types, vector dimensions and button-only operations.
- 204 unit cases pass. Input cases cover multiple short presses and ordering, source/key unions, normalized/independent axes, immutable capture, rebinding/config validation, pause/resume, initial/staged input, cross-Engine ownership, failed preparation cleanup and mutation from input callbacks. Lifecycle cases cover activation disposal, dependency teardown and six hundred simulation seconds of 144Hz repeating timers.
- All 80 Chromium browser cases pass at 1440×900 and 390×844. New fixtures use real keyboard events, real CDP touch, source overlap/cancellation, native-control focus, pause/autorepeat, Scene preparation and actual Blockfall/Prism Raid rebinding. A touch-end synthetic mouse focus change is a focus-release case; touch cancellation with the game focused separately verifies source composition.
- Production site checks pass with both `/` and `/Simpludify/`: 23 documentation pages, all six games, 14 independently typechecked snippets, themes, keyboard/touch, game outcomes, restart/stop and iframe cleanup. Standalone UI/scenes and Signal Run build smoke checks pass, and standalone Blockfall/Prism Raid builds succeed.

[Raw Core measurements](../benchmarks/action-input/core.json) record Node 24.22.1, Linux, AMD EPYC 9V74, clean source `1017c25`. Recorded benchmarking ran without other local tests/builds. Sixty complete input-only automatic rounds (seeds 42–101, dt=1/120, decisions every six steps, five warmup rounds) produced 172796 steps, 1439.97 simulation seconds, 1440 kills and 60 wins in 3.47 wall seconds. All round/world resources were asserted empty after disposal. The peak 41 counts game Units, not every Scene Actor.

The 100-enemy/1000-shot contact/removal profile has step p95 about 3.68ms; it is not a steady 1101-Unit workload. Ten thousand shot Actor create/dispose operations take about 122.46ms. Forced-GC managed heap across the sixty rounds is about 19.60→19.70MB, including Vite/SSR/tooling. These are local observations, not a statistically established speed comparison or proof of leak freedom. No new hardware GPU or physical-device performance measurement is claimed.

Remaining limits: no full gamepad adapter, input-context priority stack, replay/save format or fixed-step Web scheduler. Axis excursions completed between steps are continuous-state changes rather than queued commands. Browser/OS-reserved keys may not be delivered. Physical mobile devices, Safari/Firefox and cross-platform bitwise reproducibility remain unverified.
