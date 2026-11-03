# Scene, Actor and Component

Simpludify separates a synchronous, DOM-free Core from a browser host. Core owns simulation, data, Actions and lifetime. Web owns asynchronous asset readiness, browser events, presentation, native editing and layout projection. Import public package roots; application code should not depend on engine source paths.

## A visible entity

Actor is an identity/owner, not a built-in behavior hierarchy. Add required Components first. Transform stores x/y/rotation/scale; Renderable describes visible shape/image state; Motion integrates direction × speed; ActionMovement reads an injected Axis2D ActionReader in Update. Character is a convenience composition of these pieces.

```ts verify
import {
  Actor,
  Component,
  defineComponent,
  Engine,
  Motion,
  Transform,
} from "@simpludify/core";
class MoveRight extends Component {
  static readonly type: ComponentType<MoveRight> = defineComponent<MoveRight>(
    "MoveRight",
    [Motion.type],
  );
  readonly type = MoveRight.type;
  update() {
    this.actor.require(Motion.type).direction.x = 1;
  }
}
const engine = new Engine();
const actor = engine.scene.add(new Actor());
actor.add(new Transform());
actor.add(new Motion({ speed: 100 }));
actor.add(new MoveRight());
engine.step(1 / 60);
engine.dispose();
```

A Component type may appear once per Actor. Missing/duplicate dependencies, cycles, shared instances and removal of required dependencies are diagnosed. Structural edits during onAttach are rejected so attachment can roll back safely. Removal/disposal destroys owned resources; it is not a reusable detach operation.

## Lifetime and updates

A Scene progresses Preparing → Ready → Active → Inactive → Disposed. Web factories prepare detached state and await assets before committing. Engine.activate supports headless initial activation; Web callers use await game.run/goTo. A replaced Scene is disposed, and a later visit constructs a fresh instance. Scope subscriptions/timers/sources to Scene/Actor/Component or Lifetime; disposal is idempotent and attempts all cleanup even if one fails.

Each Engine.step validates seconds, captures eligible Actors/Components/timers, samples live adapters, freezes every ActionController, dispatches Action presses, then runs Input → Update → Integrate → LateUpdate → contacts → simulation Tweens → timers → Scene.onUpdate. Additions wait until the next step. Removal/disable suppresses later execution immediately. One Actor disabled at the boundary remains ineligible until the next step even if enabled mid-step.

Pause stops simulation phases while Action controls and browser presentation continue. A fresh Pause Action can resume; input resets do not manufacture button events. Display Tweens use a separate presentation clock. Errors during simulation do not roll back arbitrary application state.

## State and dependencies

Keep score, health, puzzle state, AI policy and network authority in game-owned code. ActionReader is a read-only dependency, so changing keyboard/pad/program sources does not replace the Actor. Events are optional typed notifications, not a mandatory store. Grid models finite 2D data without requiring Actors/Colliders.

[API reference](../../docs/api.md) · [Scene/UI guide](scenes-ui.md) · [movement](../../docs/movement.md) · [Replay](../../docs/replay.md). Implementation graphs and measurements are available separately under Engineering.
