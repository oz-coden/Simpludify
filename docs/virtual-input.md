# Virtual sticks and pointer controls

These APIs are available from **published Core/Web 0.1.5 registry packages**. The same controls accept mouse, touch and pen Pointer Events; no mobile-device detection enables or hides them automatically.

## One controller, ordinary sources

```ts verify
import {
  Action,
  Character,
  defineActions,
  Game,
  VirtualStickMode,
} from "@simpludify/web";
const game = new Game();
const Actions = defineActions({
  Move: Action.axis2D(),
  Aim: Action.axis2D(),
  Fire: Action.button(),
});
game.scene("play", ({ actions, add, virtualInput }) => {
  const controls = actions(Actions);
  const move = virtualInput.stick(controls, Actions.Move, {
    region: { kind: "rect", x: 0, y: 0, width: 0.44, height: 1 },
    position: { x: 0.22, y: 0.7 },
    radius: 60,
    deadZone: 0.15,
    mode: VirtualStickMode.Floating,
  });
  virtualInput.stick(controls, Actions.Aim, {
    region: { kind: "rect", x: 0.56, y: 0, width: 0.44, height: 1 },
    radius: 60,
    mode: VirtualStickMode.Follow,
  });
  const fire = virtualInput.button(controls, Actions.Fire, {
    region: { kind: "circle", x: 0.85, y: 0.25, radius: 0.09 },
    direction: true,
    radius: 48,
  });
  fire.onCommit(({ direction }) => {
    console.log("Release direction", direction);
  });
  add(Character({ movement: controls.reader(Actions.Move) }));
  // Hide paint independently of input. Disable also cancels the current gesture.
  move.visible = false;
  move.enabled = true;
});
await game.run("play");
```

`game.virtualInput` addresses the current/default Scene; factory `context.virtualInput` addresses that factory's Scene, including during asynchronous preparation. Every control owns one existing ActionSource. Its controller and Action must belong to that Scene/InputSystem and have the matching kind. Keyboard, gamepads, other virtual controls and program sources retain additive/clamped axes and OR buttons. A stable reader/Character does not need replacement when sources change. Disposing a control releases only its own contribution; another source can intentionally keep the same Action held.

## Activation geometry and coordinates

| Region          | Configuration                                                  | Units                                                                |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Left/right half | `VirtualRegions.Left` / `.Right`                               | Current Game Viewport                                                |
| Rectangle       | `{kind:"rect", x, y, width, height, space?}`                   | `viewport` by default; `screen` for host CSS pixels                  |
| Circle          | `{kind:"circle", x, y, radius, space?}`                        | Relative center; relative radius uses the smaller viewport dimension |
| Custom          | `{kind:"custom", bounds(viewport), contains(point, viewport)}` | Conservative bounds and point in host CSS pixels                     |

Viewport coordinates are fractions: x/y are relative to its top-left, width/height to its dimensions. `position` uses the same `space` convention and sets an idle/fixed center independently of the activation region. Without it the center is the region's bounding-box center. **Control `radius` is always host CSS pixels**; region-circle `radius` follows the table above. Camera, logical resolution, DPR and Canvas UI scale do not change these screen units.

The example leaves the middle 12% without a stick activation area. Such a gap does not consume world input: a world listener can still handle it. Activation geometry decides **where a press may begin**, not how far an already-owned pointer can move. A captured pointer can leave the viewport, cross the gap or cross another stick without transfer.

Rectangles are half-open at right/bottom edges; circles exclude the circumference. Touching boundaries therefore do not create a shared activation point. Empty regions accept nothing. Absolute regions are not implicitly clipped to the world viewport, but browser downs still have to reach the Game's surface.

`region` is replaceable and copied. Same-priority overlap is rejected with `VIRTUAL_REGION_OVERLAP`, including disabled/hidden controls, so enabling a preconfigured control cannot introduce ambiguity. Built-in rectangle/circle pairs use geometric intersection rather than only bounding boxes. Custom functions must return finite nonnegative bounds and a synchronous boolean; the implementation additionally restricts acceptance to those bounds. Intersecting conservative custom bounds are rejected even when predicates might be disjoint. Partition custom bounds or use the built-in shapes rather than relying on registration order.

The Game refreshes regions after Canvas layout and before rendering/routing. A changed Viewport or custom bound cancels active gestures. Invalid geometry/overlap is validated before replacing the previous resolved layout. For a Canvas Flex slot, a custom bounds callback can project `node.bounds` by `ui.scale`; use zero extents when its logical visibility or clipping policy excludes input. This allows layout-owned regions without assigning world coordinates to UI.

## Modes and state

| API                                 | Behavior                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `VirtualStickMode.Fixed`            | Default; direction starts at the configured/resolved center                                   |
| `.Floating`                         | The down point becomes the center for that gesture                                            |
| `.Follow`                           | Starts at down; when displacement exceeds radius, center follows the excess distance          |
| `radius`                            | Positive finite CSS-pixel magnitude scale; default 64 for sticks, 28 for buttons              |
| `deadZone`                          | Default 0.15; finite `0 <= value < 1`; radial zero zone followed by rescaled analog magnitude |
| `value` / `direction`               | Stick's frozen vector, magnitude at most one; down is positive Y                              |
| `center` / `knob`                   | Screen-space paint coordinates; knob is clamped visually to the radius                        |
| `pointerId` / `pressed` / `elapsed` | Owned pointer, active gesture and presentation seconds                                        |
| `enabled` / `visible`               | Independent on each control and on the Scene's VirtualInput                                   |

Changing mode, radius, dead zone or region interrupts the old gesture. Disable, explicit `cancel()`, global input reset, pause/resume, Replay transitions, lost capture, focus loss, hidden document and Scene/controller/Game disposal clear the corresponding contribution. Re-enable does not restore the old pointer's held state. Scene ownership is terminal; do not reuse disposed controls in another Scene.

Captured Action values still change at the next Engine input boundary. Control state/events update at pointer delivery; reading a control's immediate value is not a second gameplay input system. Components should continue reading their ActionReader.

## Buttons, holds, confirmation and cancellation

`virtualInput.button(controls, ButtonAction, options)` defaults to **no direction**. It supplies true from down until normal release/cancel; a complete down/up between simulation boundaries retains the existing Button edges. Use it for a generic press/hold such as self-targeted actions without adding an artificial aim vector.

Set `direction:true` to obtain an optional drag direction anchored at the down point. Radius/deadZone have the same radial rules as sticks. The Action remains a Button; the release event carries the final direction. Confirmation occurs on normal release anywhere, including outside the activation region. `cancel()` or a pointer/lifetime cancellation does not confirm. Game-specific skill rules, cooldowns, targeting and damage remain application code.

`onStart`, `onChange`, `onEnd`, `onCancel` and `onHold` accept optional Lifetime owners. Button `onCommit` observes normal `onEnd`. Event snapshots retain pointer identity/type, origin, position, center, direction, inside-region status and elapsed seconds. End/cancel payloads retain the final direction after the live source has become neutral. `onHold` fires once after `holdDelay` (default 0.5 presentation seconds), even without pointer moves; it is a notification, not repeat-fire or a gameplay timer. Core hosts explicitly call `virtualInput.advance(seconds)`; the Web Game supplies capped visible-frame presentation time. Replay input is locked against new live virtual gestures and resets old ones.

## Arbitration and support

At down, the existing PointerRouting chooses **Canvas UI first, then virtual button, then virtual stick, then world**. Ordinary Canvas hit/clip/scroll ordering is preserved; a broad stick region is allowed beneath an ordinary UI button. Virtual button regions may deliberately overlap sticks. Two same-priority virtual regions may not ambiguously overlap. An occupied control suppresses an additional pointer until that pointer releases; it does not fall through to the world or another control. Only primary button downs start virtual controls; right/middle mouse actions retain world routing.

One router and the existing browser capture adapter own all IDs. Finger crossing and leaving an activation region do not reassign ownership. There is no automatic device-mode switching. Supply keyboard/gamepad/Canvas controls as alternatives; the painted virtual buttons are pointer controls, not separate native keyboard-focus mirrors.

The [virtual input lab](../examples/virtual-input/README.md) covers both sticks, a center gap, optional-direction buttons, ordinary Canvas priority, mode/visibility/enablement, program handoff and resizing. Automated checks exercise Core state, actual CDP multitouch and browser mouse/Capture under WebGL/Canvas2D. Emulated touch and software rendering do not certify physical devices, pen pressure/tilt, drivers, mobile browser gesture policies, Safari/Firefox, OS IME or assistive technologies.
