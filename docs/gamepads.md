# Gamepads and unified input

Source v0.1.6 lets a GamepadSource follow controller bindings by omitting the bindings option. Explicit bindings retain the independent legacy path. See [common settings and capture](input-bindings.md).

These APIs are available in the published Core/Web v0.1.4 SDK. Install matching registry versions as described in the [npm guide](../site/en/npm.md).

An Actor reads an ActionReader; it does not know whether a keyboard, pad, Canvas gesture or external program supplied the value. ActionController remains the single composition boundary. Game.gamepads supplies a Web adapter, not another gameplay Controller or player registry. Core has no navigator, DOM or Gamepad API dependency.

## One reader, several sources

```ts verify
import {
  Action,
  Character,
  defineActions,
  Game,
  GamepadBindings,
  GamepadButton,
  KeyboardBindings,
} from "@simpludify/web";
const game = new Game();
game.scene("play", ({ actions, add }) => {
  const Actions = defineActions({
    Move: Action.axis2D(),
    Fire: Action.button(),
  });
  const controls = actions(Actions, { Move: KeyboardBindings.WASD });
  const pad = game.gamepads.bind(controls, {
    index: 0,
    bindings: {
      Move: GamepadBindings.Move,
      Fire: { buttons: [GamepadButton.South] },
    },
  });
  const scripted = controls.createSource();
  scripted.enabled = false;
  add(Character({ movement: controls.reader(Actions.Move) }));
  // A game-owned handoff changes sources, not the Character or its state.
  function useProgram() {
    controls.keyboardEnabled = false;
    pad.enabled = false;
    scripted.enabled = true;
    scripted.set(Actions.Move, { x: 0.5, y: 0 });
  }
  void useProgram;
});
await game.run("play");
```

The pad index is an explicit assignment chosen by the game. A second controller can use index 1 or any other browser-exposed index. The same pad may deliberately feed multiple controllers; each binding owns an independent contribution. Disabling/disposal of one leaves the others alone. Shared keyboard keys also fan out to all enabled matching controllers; conflicts() reports only conflicts within its controller. For exclusive players, choose separate bindings or set keyboardEnabled=false on pad/program-only controllers. No maximum player/pad count is imposed by the engine; the browser/hardware determines availability.

CanvasHoldButton callbacks write controls.createSource().set just like a program. Use one source per simultaneous gesture, or maintain your own combined gesture state. Clearing one gesture must not erase another gesture's hold. The [two-player input lab](../examples/unified-input/README.md) demonstrates independent directional touch sources.

## Assignment, gating and ownership

| API                                        | Contract                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| game.gamepads.bind(controller, options)    | Returns a GamepadSource owned by that controller and the host; cross-Engine controllers are rejected                                    |
| options.index / source.assign(index)       | Nonnegative safe integer slot; reassignment clears the old contribution and waits for neutral                                           |
| options.bindings / source.rebind(bindings) | Typed Action-keyed map; validates all names/fields/indices/thresholds before applying; rebind clears/rearms                             |
| options.deadZone                           | Default 0.15; finite 0 ≤ value < 1; bindings can override it                                                                            |
| options.mapping                            | standard by default; nonstandard pads are neutral unless explicitly set to raw                                                          |
| source.enabled                             | Disable clears contributions; re-enable restores no old hold and requires neutral                                                       |
| source.clear() / dispose()                 | Clear rearms; dispose detaches permanently and removes the contribution                                                                 |
| source.info / connected / usable           | Latest polled facts, physical availability and mapping-policy eligibility; these do not imply the host currently accepts gameplay input |
| game.gamepads.devices                      | Frozen snapshots of exposed connected devices, sorted by index                                                                          |
| game.gamepads.available                    | Most recent polling attempt succeeded; an empty successful list may still need a user gesture                                           |
| game.gamepads.onChange(handler, owner?)    | Synchronous notification when device facts/availability change; owner-scoped unsubscribe, usable during pause                           |

ActionSource and KeyboardSource also expose enabled. Disabled writes are validated but ignored, and re-enable begins empty. Disposed sources retain the existing harmless-neutral-write rule and reject new non-neutral values. Per-controller keyboardEnabled=false removes only that controller's keyboard contribution; re-enable ignores keys that were already held until released and pressed again. Existing constructor bindings remain available for later reuse; new ActionController also accepts keyboard:false.

Source clear/disable/dispose creates a normal logical Button release if its last contribution disappears. Another holding source keeps the Action held. Captured values remain frozen until the next Engine.step. Global input.clear, pause/resume transitions and Scene replacement instead flush pending edges silently, preserving the existing reset contract.

A gamepad binding becomes armed only after all its mapped Actions sample neutral (buttons below thresholds, axes within dead zones). Initial assignment, reconnect, identity/mapping/count change, reassignment, rebind, enable, focus interruption and global reset require this neutral sample. A held stick/button cannot resume accidentally. This conservative whole-binding gate may require releasing both a held stick and the pause button before a new pause/resume press.

Scene disposal destroys its controllers, bindings, program/touch sources and subscriptions. Game disposal releases listeners and the sampling adapter. InputSystem disposal also disposes registered adapters. No source or reader should be reused across a replacement Scene.

## Polling, focus and Replay

The adapter reads navigator.getGamepads once per Engine input boundary, before all controllers freeze and before Action callbacks. Fixed-step hosts may sample several times per rendered frame. Buttons retain transitions observed between boundaries; a complete physical tap between two polling reads cannot be reconstructed. Axis excursions are continuous state, not queued commands.

Connection events clear/invalidate assignments, but their event payload is never treated as a usable input sample. The next poll establishes availability. A disconnect event suppresses stale connected snapshots until absence or a connection event is observed. Missing APIs, blocked permissions or a throwing provider yield an empty neutral list; keyboard/touch/program input continues. Unmapped devices expose their facts safely but require explicit raw binding configuration for gameplay.

The default Game accepts pad gameplay only while its visible host has document focus and a compatible focused descendant. Native inputs/selects/contenteditable/unmanaged buttons retain editing/UI ownership. Losing eligibility clears gamepad contributions and requires neutral before resuming. Gamepads do not synthesize Enter/Space or implement UI navigation. Canvas/DOM keyboard priority and touch routing remain unchanged; independent program/touch sources obey their own ownership/gating.

Live adapter sampling is excluded during Replay playback. Replay records the final composed ActionFrames and ordered Button events, not hardware IDs or assignments. Controller IDs still disambiguate players; playback requires a fresh Engine, matching schema/version and the existing single-Scene contract. Switching sources preserves the Actor state but is not itself a game-state save or networking protocol.

## Bindings and analog values

| Action kind | Binding fields                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------ |
| button      | buttons: array of indices or {button, threshold}; default threshold 0.5, valid 0 < threshold ≤ 1 |
| axis1d      | axis?, invert?, negative?, positive?, deadZone?                                                  |
| axis2d      | x?, y? scalar bindings                                                                           |
| axis3d      | x?, y?, z? scalar bindings                                                                       |

negative/positive are button-index lists. Their maximum analog values are subtracted/added to the selected axis, clamped to [-1,1], optionally inverted, then passed through an axial dead zone: zero for abs(v) ≤ d, otherwise sign(v) × (abs(v)-d)/(1-d). Missing/nonfinite device values are neutral; finite out-of-range values clamp safely. The dead zone is axial, not radial. The final Action still sums all sources, clamps components and applies its usual vector normalization, preserving analog magnitudes below one.

GamepadBindings.LeftStick, RightStick, DPad and Move are immutable Axis2D data. Move combines the left stick with DPad. Standard axes are LeftX=0, LeftY=1, RightX=2, RightY=3; negative Y is up. Triggers are analog button values: for example { positive: [GamepadButton.RightTrigger], deadZone: 0 } feeds an Axis1D in [0,1]. Use a button threshold when a digital trigger Action is wanted.

GamepadButton provides South/East/West/North, Left/RightShoulder, Left/RightTrigger, Select, Start, Left/RightStick, DPadUp/Down/Left/Right and Home. These names denote standard physical positions. Raw bindings use device-specific numeric indices and make no positional guarantee.

## Browser facts and display hints

GamepadInfo preserves id, index, connected, mapping, standardMapping, buttonCount and axisCount. inferredLayout is a heuristic hint derived from the ID text: generic, xbox, playstation or nintendo. It does not establish a manufacturer, product, printed legend or identity. Browser remapping, drivers and compatible controllers may make it wrong. An index is a reusable connection slot; an ID is not a persistent individual-device identifier. A newly exposed device in an assigned slot is accepted only after the rearm rule; games needing explicit replacement confirmation should disable that binding and ask the player to assign it.

| Physical position | Xbox hint | PlayStation hint | Nintendo hint | Generic |
| ----------------- | --------- | ---------------- | ------------- | ------- |
| South             | A         | ×                | B             | South   |
| East              | B         | ○                | A             | East    |
| West              | X         | □                | Y             | West    |
| North             | Y         | △                | X             | North   |

```ts verify
import { GamepadButton, gamepadButtonLabel } from "@simpludify/web";
const guessed = gamepadButtonLabel(GamepadButton.South, {
  layout: "playstation",
});
const chosen = gamepadButtonLabel(GamepadButton.South, {
  layout: "nintendo",
  overrides: { [GamepadButton.South]: "Confirm" },
});
console.log(guessed, chosen); // ×, Confirm
```

Use info.standardMapping before displaying positional labels. For raw/unmapped devices display Button N unless the game/user supplies a verified mapping. Unknown standard layouts fall back to generic position names; unknown extra indices use Button N. Label overrides are display text, not changed physical mappings. The lab offers an explicit display-layout override.

## External programs and future transports

Use ordinary ActionSource.set with typed tokens; it copies and validates booleans and finite bounded axes, rejecting foreign tokens and malformed dimensions. The application validates any message envelope, tick/sequence, authority and scheduling before supplying values. Apply received input before the intended Engine.step; callback/component writes affect the next boundary. On disconnect, clear/disable/dispose that source. A new owner can supply the same controller without recreating its reader/Actor. No WebSocket, WebRTC, queue, rollback, authority model or AI policy is included.

Custom Web hosts/tests may construct GamepadInput(input, {poll, active, events}); poll returns structural GamepadState snapshots and active supplies host eligibility. Ordinary games use game.gamepads. Other hosts can register a DOM-free InputAdapter with InputSystem.addAdapter; they own sample/reset/dispose. Errors from custom observer/policy code are ordinary programming errors, not silently converted to valid inputs.

## Verification limits

Automated tests use controlled provider snapshots and browser events, plus real DOM focus and emulated touch under Chromium/WebGL/Canvas2D. They do not certify physical gamepads, rumble, OS drivers, vendor layouts, mobile hardware, Safari/Firefox or actual OS IME behavior. Browsers may require HTTPS/localhost, an allowed gamepad Permissions Policy and a pad user gesture before exposing devices. See the [standard Gamepad API](https://www.w3.org/TR/gamepad/) and [platform limits](../site/en/limitations.md).
