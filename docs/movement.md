# Movement composition

Actions describe logical intent. They do not know Motion, Character, positions or physics. Motion is an optional input-independent integrator. ActionMovement is a small adapter, not the only route to movement. Transform remains the position/rotation/scale state; CollisionBody supplies Solid correction weight, not another velocity store.

## Standard movement and live scale

```ts verify
import {
  Action,
  ActionController,
  ActionMovement,
  Character,
  defineActions,
  Engine,
  KeyboardBindings,
  Motion,
} from "@simpludify/core";
const engine = new Engine({ seed: 42 });
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
const player = engine.scene.add(
  Character({ movement: controls.reader(Actions.Move), speed: 180 }),
);
const movement = player.require(ActionMovement.type);
movement.scale = 2; // 1 = normal, 0.5 = slow, 0 = stop
player.require(Motion.type).speed = 200; // change the base speed during play
controls.createSource().set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
engine.dispose();
```

Motion keeps **direction × speed**, rather than storing both that model and a second writable velocity. Existing projectile and AI code already uses unnormalized direction multipliers, while Character uses a useful base speed. Making speed mutable supplies the needed control without introducing conversion/synchronization between competing representations. Intended velocity is `(direction.x * speed, direction.y * speed)` in world units/second; displacement is that velocity times delta seconds. Collision correction can make actual displacement smaller: inspect Transform before/after the step if actual movement is required.

Motion.speed defaults to 180, is mutable, finite and nonnegative; zero stops integration. direction defaults to (0,0), accepts any finite x/y including negative values and magnitudes above one, and is never automatically normalized. The direction object's identity cannot be replaced, but its components can be changed. Invalid assignments throw INVALID_VALUE without accepting the new scalar. Both derived coordinates are validated before either Transform coordinate is committed; overflow throws. Failure does not roll back unrelated Components or the whole step.

`new ActionMovement(reader, { scale: 2 })` and `.scale = 2` use the same finite/nonnegative policy. The default is 1 and there is no arbitrary maximum; overflowing derived commands are rejected. Scale multiplies the captured vector **after** ActionController's composition/normalization. It never writes to ActionSource or clamps a doubled command back into [-1,1]. Negative scale is rejected; use an explicit direction transform for reversed controls. Character's speed option initializes Motion.speed only; Character stores no duplicate speed.

## Dash as a game policy

```ts verify
import {
  Action,
  ActionController,
  ActionMovement,
  type ActionReader,
  Character,
  Component,
  ComponentPhase,
  type ComponentType,
  defineActions,
  defineComponent,
  Engine,
  KeyCode,
} from "@simpludify/core";
class SprintScale extends Component {
  static readonly type: ComponentType<SprintScale> =
    defineComponent<SprintScale>("SprintScale", [ActionMovement.type]);
  readonly type = SprintScale.type;
  readonly phase = ComponentPhase.Input;
  private movement: ActionMovement | undefined;
  constructor(private readonly sprint: ActionReader<"button">) {
    super();
  }
  protected onAttach(): void {
    this.movement = this.actor.require(ActionMovement.type);
  }
  protected onDisable(): void {
    if (this.movement) this.movement.scale = 1;
  }
  protected onDestroy(): void {
    this.onDisable();
    this.movement = undefined;
  }
  update({ scene }: import("@simpludify/core").UpdateContext): void {
    if (this.sprint.scene !== scene)
      throw Error("Sprint reader belongs to another Scene");
    if (this.movement)
      this.movement.scale =
        !this.sprint.disposed && this.sprint.value() ? 2 : 1;
  }
}
const engine = new Engine({ seed: 42 });
const Actions = defineActions({
  Move: Action.axis2D(),
  Sprint: Action.button(),
});
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: { Sprint: { keys: [KeyCode.ShiftLeft, KeyCode.ShiftRight] } },
});
const player = engine.scene.add(
  Character({ movement: controls.reader(Actions.Move) }),
);
player.add(new SprintScale(controls.reader(Actions.Sprint)));
const touchOrAI = controls.createSource(engine.scene);
touchOrAI.set(Actions.Move, { x: 1, y: 0 });
touchOrAI.set(Actions.Sprint, true);
engine.step(1 / 60);
engine.dispose();
```

The policy runs in Input, before ActionMovement's Update, so a newly captured Sprint affects this step. It owns only adapter scale; a power-up can independently change Motion's base speed. This policy is ordinary game code, not a built-in Sprint Action or new input context. Prism Raid uses this pattern with Shift and the touch DASH button. Multiple scale policies would still need game-defined arbitration; the engine does not silently compose them.

## Replace the adapter with a custom Component

```ts verify
import {
  Action,
  ActionController,
  type ActionReader,
  Character,
  Component,
  type ComponentType,
  defineActions,
  defineComponent,
  Engine,
  Motion,
  type UpdateContext,
} from "@simpludify/core";
class CustomMovement extends Component {
  static readonly type: ComponentType<CustomMovement> =
    defineComponent<CustomMovement>("CustomMovement", [Motion.type]);
  readonly type = CustomMovement.type;
  private motion: Motion | undefined;
  constructor(
    private readonly move: ActionReader<"axis2d">,
    private readonly sprint: ActionReader<"button">,
  ) {
    super();
  }
  protected onAttach(): void {
    this.motion = this.actor.require(Motion.type);
  }
  protected onDisable(): void {
    if (this.motion) {
      this.motion.direction.x = 0;
      this.motion.direction.y = 0;
    }
  }
  protected onDestroy(): void {
    this.onDisable();
    this.motion = undefined;
  }
  update({ scene }: UpdateContext): void {
    // default Update, even though Motion was attached first
    if (this.move.scene !== scene || this.sprint.scene !== scene)
      throw Error("Movement readers belong to another Scene");
    if (this.move.disposed || this.sprint.disposed) {
      this.onDisable();
      return;
    }
    if (!this.motion) return;
    const input = this.move.value();
    this.motion.speed = this.sprint.value() ? 300 : 180;
    this.motion.direction.x = Math.max(0, input.x); // game-specific restriction: no left movement
    this.motion.direction.y = input.y;
  }
}
const engine = new Engine({ seed: 42 });
const Actions = defineActions({
  Move: Action.axis2D(),
  Sprint: Action.button(),
});
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
});
const player = Character(); // includes Motion, without ActionMovement
player.add(
  new CustomMovement(
    controls.reader(Actions.Move),
    controls.reader(Actions.Sprint),
  ),
);
engine.scene.add(player);
controls.createSource().set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
engine.dispose();
```

Custom policies can use AI/game state instead of readers, write arbitrary finite direction/speed, or directly update Transform when that better expresses a scripted path. No ActionReader.map, movement pipeline, DI framework or input emulation is required. Signal Run's [SignalMovement](../examples/signal-run/logic.ts) selects keyboard intent or a pointer destination in one Update Component, limits the last displacement to avoid overshoot, and writes directly to Motion. It has no ActionMovement dependency or implicit overwrite ordering.

For an autonomous projectile, add Transform and `new Motion({ speed: 300, x: 0, y: -1 })`. It needs neither Character nor an ActionController. Disabling Motion pauses integration while retaining its command; enabling resumes that command. Disabling/removing ActionMovement clears direction, and disposed readers become neutral. A custom writer owns its stop/reset policy, as shown by onDisable/onDestroy. Actor disable gates all phases; destruction and Scene replacement remain terminal. Engine pause skips simulation, and resume clears input contributions rather than restoring stale held keys.

## Update order and competing writers

The step captures Actor/Component/timer eligibility, then all Action frames, before delivering Button callbacks. The fixed global Component order is:

| Phase                  | Role                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| Input                  | Policies that configure command producers, including sprint scale                |
| Update (default)       | Game rules and command calculation; ActionMovement or a custom movement writer   |
| Integrate              | Motion applies the current command to Transform                                  |
| LateUpdate             | Position clamps, firing from the new position, offscreen cleanup before contacts |
| Scene post-update      | CollisionWorld correction/detection and contact delivery                         |
| Timers, Scene.onUpdate | Simulation timers and final observations/UI state                                |

Every Actor finishes a phase before the Scene starts the next phase. Within a phase, Actor and Component insertion order remains explicit. Requirements enforce presence/ownership/removal safety, not peer sorting. A custom default Update Component attached after Motion can affect that same step; post-motion work must explicitly choose LateUpdate. Motion does not require input, while an input reader never depends on Motion.

Use **one direction writer per Motion**. Character() plus a custom writer is the normal replacement path. If intentionally combining writers in a phase, later writes win; there is no automatic blending or ownership registry. An Input direction write can be overwritten by an Update adapter. Changing adapter.scale after that adapter's Update affects its next Update, so use Input for a scale policy. Writing a Motion command in LateUpdate affects the next integration. Disabling/removing a writer can clear its command, so do not rely on another writer's retained values surviving its cleanup.

Execution plans are cached and captured at step start. Additions first update next step; removals/disables suppress later eligible execution immediately. Empty phase plans share immutable arrays; normal movement introduces no per-step vector allocation. Phase is a readonly named mode, not an arbitrary priority or dependency graph.

## Motion, CollisionBody and Transform

Transform is the shared world-position state. Motion is simple kinematic integration, not acceleration/friction/gravity simulation. CollisionBody adds inverse-mass correction participation for Solid pairs and never owns or rewrites Motion intent. Static means zero correction weight, not a position lock: a scripted Static object can still move. Triggers do not correct positions. CollisionWorld runs after Integrate and LateUpdate, so contacts see corrected/clamped positions in that step. Direct Transform writes and Motion are both permitted, but choose their axes/order deliberately rather than accidentally moving the same axis twice. A LateUpdate clamp happens before collision correction; use Scene.onUpdate to observe final corrected positions, not to create an extra untested movement pass.

Constant intent produces the same displacement over equal accumulated simulation time with fixed or variable subdivisions, subject to floating-point error. Collisions, timers, state changes and clamped destinations can depend on subdivisions. FixedStepRunner has bounded catch-up and may drop host time; compare equal executed dt sums, not wall-clock duration. Replay still records logical Actions and exact step deltas, not arbitrary changes to speed/scale/AI state. Reproduce game policies and initial configuration or express a gameplay change through Actions. ReplayData remains format v1; Prism Raid's new Sprint schema uses game version prism-raid-replay-2 and rejects older incompatible controller schemas.

## Migration and adjacent scope

- Motion.speed is now mutable and accepts zero. Direction assignments now validate finite values; replacing its object is rejected.
- Motion moves from Update to Integrate. ActionMovement moves from Input to Update. Migrate custom post-motion Update Components to LateUpdate; scale policies use Input. Same-phase requirements still do not schedule peers.
- Character's options and optional movement reader remain valid. No new Character speed field or mandatory adapter was introduced.
- Signal Run replaces PointControl plus ActionMovement with one custom SignalMovement. Prism Raid's clamp/weapon/TTL Components use LateUpdate; normal non-sprint game state is checked against pre-refactor fingerprints.
- Renderable visibility, opacity, depth, enable flags and Transform are already live. Width/height/color/sprite/shape/fit remain immutable and require remove/re-add. Graphics geometry/fill is created once, and images have asynchronous ownership, so animation-style updates require a separate renderer contract. No renderer/asset/animation redesign is included here.

Tests cover live scale/speed, numeric rejection/overflow, custom/default-phase commands, ownership, Solid/Static behavior, ordering, fixed stepping, JSON replay, real keys/touch and complete game outcomes.
