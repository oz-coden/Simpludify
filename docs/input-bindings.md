# Physical bindings and single-input capture

Core/Web v0.1.6 extends the existing ActionController and is published on npm. Actions describe game meaning and bindings describe physical positions. Readers and Characters stay alive during runtime changes.

## Several devices, one configuration

```ts verify
import {
  Action,
  defineActions,
  Game,
  GamepadButton,
  KeyCode,
  MouseButton,
} from "@simpludify/web";

const game = new Game();
const A = defineActions({ Jump: Action.button() });
const controls = game.actions(A, {
  Jump: {
    keys: [KeyCode.Space],
    mouse: [MouseButton.Back],
    gamepad: { buttons: [GamepadButton.South] },
  },
});
const pad = game.gamepads.bind(controls, { index: 0 });
await game.run();
controls.addBindings(A.Jump, { mouse: [MouseButton.Forward] });
controls.removeBindings(A.Jump, { keys: [KeyCode.Space] });
controls.rebind(A.Jump, { keys: [KeyCode.ShiftLeft] });
controls.resetBindings(A.Jump);
console.log(controls.getBinding(A.Jump), pad.info);
game.dispose();
```

KeyCode uses KeyboardEvent.code, including standalone Shift, Control, Alt and Escape. MouseButton uses DOM indices: Left=0, Middle=1, Right=2, Back=3, Forward=4. Touch/pen remain pointer controls. Axis1D uses negative/positive key arrays and mouseNegative/mousePositive mouse arrays; Axis2D/3D reuse these fields in x/y/z. The optional gamepad binding belongs at the Action root. Existing gamepad axis, button, threshold and dead-zone settings remain available.

Omitting GamepadInput.bind's bindings option follows the controller's gamepad fields, including rebind/import/reset. Explicit bindings retain the independent legacy path; source.rebind() returns to controller settings. Source index, mapping and deadZone are separate from persisted controller data. Standard mapping remains the default; select mapping: "raw" explicitly when constructing a source for known nonstandard hardware. A captured device ID is a browser fact, not a persistent identity or automatic player/vendor assignment.

Button contributions OR: releasing Space while South stays held creates no release or second press. One physical input may feed several Actions. Axes retain component addition, clamps and optional vector normalization. conflicts() preserves keyboard-only diagnostics; conflicts("mouse"), conflicts("gamepad") and conflicts("all") opt into additional diagnostics. Conflicts never disable assignments. Gamepad diagnostics compare control indices in that controller rather than runtime device assignments.

## Pointer priority and focus

The existing router owns each gesture: Canvas UI/scroll first, virtual controls next, world last. Mouse bindings observe world-owned gestures only. They neither acquire another Pointer Capture nor suppress world callbacks. Crossing a region does not transfer ownership. Button changes during an existing mouse gesture use the DOM buttons mask, including simultaneous holds.

Only accepted world bindings suppress the corresponding contextmenu/auxclick default; unbound operations retain browser behavior. OS/browser-reserved gestures may remain unavailable. Native editing and focus loss release physical input. Existing keyboard UI consumption remains intact. keyboardEnabled and mouseEnabled are independent; GamepadSource.enabled and ActionSource.enabled keep their existing roles. Gating/reset require fresh physical input rather than restoring held controls. Keyboard/mouse rebinding retains the existing behavior: held controls use the new mapping at the next boundary, without synthetic press/release edges. Changed controller-managed gamepad bindings reset only that Action silently and wait for their new controls to become neutral; unchanged Actions retain their contributions.

## Capture one input

```ts verify
import { Action, defineActions, Game, InputDevice } from "@simpludify/web";

const game = new Game();
const A = defineActions({ Jump: Action.button() });
const controls = game.actions(A);
await game.run();
game.element.focus();
const capture = game.captureInput({
  devices: [InputDevice.Keyboard, InputDevice.Mouse, InputDevice.Gamepad],
  gamepadIndex: 0,
});
// An application Cancel control calls capture.cancel().
const input = await capture.result;
if (input) controls.addBindings(A.Jump, input.binding);
game.dispose();
```

Call after run with an Active Scene and focused, visible document. The session focuses the game surface; only one session per Game is allowed. An optional owner can shorten the Scene-owned lifetime. State begins arming: eligible held inputs, including the opening mouse button, must become neutral. Pads need a post-start baseline poll. Listening accepts the first fresh selected key, game-surface mouse button or pad button with value ≥ 0.5. Newly connected/replaced pads also require neutral. gamepadIndex optionally selects a browser slot.

Repeats, IME/composition, native editing, touch and pad axes are not captured. The immutable result contains device, code/button and a ready Button binding; pads also include index/id/mapping. Completion sets completed and resolves once. cancel/dispose sets cancelled and resolves undefined. Escape is assignable; cancellation comes explicitly from the application/API. Native settings buttons remain usable for a Cancel control; click the game surface to resume keyboard capture after focusing such a button.

Blur, hidden/editing focus, input clear/pause/Replay, Scene/owner destruction and Game disposal cancel safely. During capture, live keyboard/mouse/pad/virtual gameplay is neutralized, queued logical transitions are flushed and routed pointers released. Previously frozen frames retain the next-boundary contract. Explicit program Source values and intentional program writes remain possible. Captured key/mouse holds stay suppressed until release; pads require neutral rearming. The existing GamepadInput poll is shared.

Capture does not change an assignment itself. No automatic Escape cancellation, timeout, standard settings widget, analog-axis capture, chord/sequence, pattern recognition, Action priority/exclusion or game-specific rule is added. Existing manual analog settings are unrestricted.

## Persistence and compatibility

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Engine,
  KeyCode,
  MouseButton,
} from "@simpludify/core";

const engine = new Engine();
const A = defineActions({ Jump: Action.button() });
const controls = new ActionController(A, {
  scene: engine.scene,
  input: engine.input,
  bindings: {
    Jump: {
      keys: [KeyCode.Space],
      mouse: [MouseButton.Back],
      gamepad: { buttons: [0] },
    },
  },
});
const json = JSON.stringify(controls.exportBindings());
controls.rebind(A.Jump, {});
controls.importBindings(JSON.parse(json));
controls.resetBindings(A.Jump);
controls.resetBindings();
engine.dispose();
```

The version-1 envelope remains; optional mouse/gamepad fields are additive. Old keyboard-only data retains its normalized shape. Older SDKs reject extended fields: record SDK capabilities with application data or keep a keyboard-only fallback for older clients. Import validates the complete object before changing anything, rejecting unknown actions/fields, invalid codes/indices, nonfinite thresholds and malformed vectors.

Bindings do not persist device identity, source enable state, mapping/dead-zone policy or game state. The application owns storage permissions, JSON parsing/error UI and player selection. See the [lab](../examples/input-bindings/README.md), [Action boundaries](action-input.md), [gamepads](gamepads.md) and [virtual controls](virtual-input.md). Chromium tests use simulated pads; physical devices, Safari/Firefox, OS-reserved controls and vendor layouts need separate real-device checks.
