# Core concepts and architecture

Simpludify balances convenient presets with small, composable building blocks. Game-specific rules and logic are expressed in standard TypeScript without mandatory engine-specific frameworks.

## Responsibilities and ownership

| Concept   | Responsibility                                                                  | Lifetime                                  |
| --------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| Engine    | Active Scene, frozen input frame, explicit step progression, seeded PRNG        | Owned by the application                  |
| Scene     | Actor roster, simulation timers, local typed events                             | Old instance destroyed upon transition    |
| Actor     | Identifiable entity in the game world, Component composition                    | Belongs to one Scene; removal destroys it |
| Component | Modular data or reusable behavior capability                                    | Belongs to one Actor                      |
| EventBus  | Optional typed synchronous notifications                                        | Managed by an explicit owner              |
| Web Game  | Pixi presentation, browser input, asynchronous Scene preparation, DOM/Canvas UI | Released via `dispose()`                  |

Scenes, Actors, and Components are not reused after disposal. `remove` is not a temporary detach or transfer API; it destroys the item permanently.

## Composing an Actor

```ts
import { Actor, Motion, Renderable, Transform } from "@simpludify/core";

const actor = new Actor({ id: "courier" });
actor.add(new Transform({ x: 120, y: 200 }));
actor.add(new Renderable({ width: 24, height: 24, color: 0x73e3c0 }));
actor.add(new Motion({ speed: 80, x: 1, y: 0 }));
scene.add(actor);
```

Add dependencies first. Both Renderable and Motion require Transform. Duplicate component types on one Actor, sharing component instances between Actors, and removing a required dependency before its dependents trigger diagnostic errors. Logic-only Actors without Transform or Renderable are fully supported.

## Custom Components

```ts
import {
  Component,
  type ComponentType,
  defineComponent,
  Transform,
  type UpdateContext,
} from "@simpludify/core";

class Drift extends Component {
  static readonly type: ComponentType<Drift> = defineComponent<Drift>("Drift", [
    Transform.type,
  ]);
  readonly type = Drift.type;
  update({ delta }: UpdateContext): void {
    this.actor.require(Transform.type).x += 20 * delta;
  }
}
```

The static `type` is an identity token rather than an arbitrary string name. `actor.get(Drift.type)` returns a typed instance or undefined; `actor.require` throws if missing. Dependency declarations enforce structural constraints, not an automatic scheduling graph.

## Events are optional

State can be stored in ordinary variables or queried directly from Components. When notifications need to be broadcast to multiple listeners, typed events provide clean decoupling:

```ts
import { defineEvent } from "@simpludify/core";
const ScoreChanged = defineEvent<{ score: number }>("ScoreChanged");
scene.events.on(
  ScoreChanged,
  ({ score }) => label.setText(String(score)),
  scene,
);
scene.events.emit(ScoreChanged, { score: 1 });
```

The optional final owner argument scopes the subscription lifetime to a Scene, Actor, or Component. Delivery is synchronous and registration-ordered. Same-token recursive dispatch and Promise-returning handlers are rejected. Manage asynchronous tasks outside the synchronous event bus.

## Update sequence and state changes

Each `Engine.step` executes in a deterministic order:

1. Validate delta and freeze the input frame for all active ActionControllers.
2. Dispatch `onPressed` callbacks, including while paused.
3. Run Input-phase Components for all captured Actors.
4. Run Update-phase Components (commands produced by ActionMovement or custom policies).
5. Run Integrate Components (`Motion` applies velocity to `Transform`), then LateUpdate Components for clamping and post-movement adjustments.
6. Run post-update hooks, including `CollisionWorld` position correction, contact detection, and event delivery.
7. Advance captured simulation Tweens, simulation timers, and `Scene.onUpdate`.
8. Return to the host, where the Web presentation reconciles changes and renders the current state.

Within each phase, Actors and Components execute in insertion order. Newly added Actors or Components update starting on the **next** step; removals and disables take effect immediately for remaining phases.

## Game-specific models

A puzzle game like [Blockfall](../../examples/blockfall/README.md) implements grid occupation, piece rotation, hard drops, and line clears using standard array and integer logic in pure game code. Actors and Renderables handle presentation, Actions handle input, and UI displays scores. No mandatory physics Colliders or rigid-body solvers are imposed. Seeded 7-bag piece generation, ghost projections, and hold slots remain game-owned state, cleanly separated from engine rendering and lifecycle.
