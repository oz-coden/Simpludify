# API

`@simpludify/core` is DOM-free. `@simpludify/web` re-exports Core and supplies Game, PixiRenderer, browser input, DOM UI and scoped default CSS. All mode objects export corresponding union types. Internal packages remain private source workspaces.

## Minimal game and defaults

```ts
import { Game, Character, Movement } from "@simpludify/web";
const game = new Game();
game.add(Character({ movement: Movement.WASD }));
await game.run();
```

Click or Tab into the game host to use movement keys. Game does not autofocus. Without parent, the host is appended to document.body; give the parent/page a height for full-screen layout. Default host CSS is 100% width/height with a 20rem minimum height. Native controls keep their keys. Call game.dispose when removing it.

| Game option | Default                       | Meaning                                                              |
| ----------- | ----------------------------- | -------------------------------------------------------------------- |
| parent      | document.body                 | Existing parent; only the Game-owned child is removed                |
| resolution  | `{ width: 800, height: 450 }` | Positive nominal logical view extent                                 |
| aspect      | Aspect.Fit                    | Fit / Fill / Adaptive world presentation                             |
| camera      | `new Camera()`                | Mutable x/y world origin and positive zoom                           |
| viewport    | full host                     | Explicit host-local CSS-pixel rectangle, including x/y offset        |
| pixelRatio  | min(devicePixelRatio, 2)      | Positive physical backing-buffer density; independent of world units |
| theme       | Theme.Dark                    | Dark or Light semantic tokens                                        |
| tokens      | no overrides                  | Partial background/surface/text/muted/accent/font overrides          |
| seed        | 1                             | Managed PRNG seed, converted to uint32                               |
| maxDelta    | 0.05 seconds                  | Positive Web frame delta cap                                         |
| renderer    | PixiRenderer factory          | Receives owned HTMLElement; returns RendererPort                     |
| frames      | RAF driver                    | FrameDriver request/cancel; callbacks must be asynchronous           |
| onError     | console.error                 | Background/UI/cleanup observer; nonfatal errors also reach an alert  |

Game.add(actor) returns the same Actor and works both before run and during execution. Game.remove(actorOrId) destroys a member of the current Scene and returns whether it existed. During preparation of another Scene these methods still target the current Scene; use the staged context's add/scene for the candidate.

Game.scene(id, setup) registers a unique factory. `Game<'menu' | 'play'>` restricts IDs at compile time. Setup receives scene, signal, add, ui, onUpdate, onActivate, onDeactivate and onDispose. Async setup is allowed; use signal for cancellable work and register cleanup before awaiting. run(id?) returns a shared startup Promise; await it before goTo. goTo(id) returns a readiness Promise, coalesces identical outstanding requests, queues different IDs and creates a fresh Scene after a completed reload. Before-commit setup/asset failures preserve the current scene. Lifecycle callback errors are reported after commit while retaining the new scene. Game.dispose is synchronous and idempotent; it promptly rejects outstanding navigation.

Game.whenReady waits for currently requested dynamic visual resources of the current scene, not for an independently pending navigation. A failed image rejects it and reports a background diagnostic. The failed visual remains absent; removing its Actor/Renderable clears that failure. Logical updates continue while runtime images load.

## Actors and Components

```ts
import { Actor, Transform, Renderable, Motion } from "@simpludify/core";
const actor = new Actor({ id: "projectile" });
actor.add(new Transform({ x: 100, y: 200 }));
actor.add(new Renderable({ width: 12, height: 12, color: 0xffc87a }));
actor.add(new Motion({ speed: 300, x: 1, y: 0 }));
game.add(actor);
```

Actor options are optional id and enabled (true). An omitted ID is assigned by its Scene. IDs are unique within a Scene; Actors belong to only one Scene. actor.scene is undefined before attachment/after destruction. actor.state is ActorState.Detached/Attached/Disposed. scene.find(id) looks up a member. scene.actors is an insertion-ordered readonly roster. scene.remove(actorOrId) and actor.dispose destroy the Actor; removal is not a detach/transfer API.

actor.add(component) returns it. actor.get(ComponentType) returns a typed instance or undefined; actor.require throws COMPONENT_MISSING. actor.remove(ComponentType) returns a boolean and destroys the removed instance. Add dependencies first and remove dependents first. One Component type per Actor and one Actor per Component instance are enforced. Component tokens are identity-based, with a debugging name. actor.enabled gates updates and visibility. component.enabled gates that component's update; Renderable.enabled gates visibility. Dependencies are structural, not an automatic update scheduler.

New Actors/Components update from the next step. Removal/disable takes effect immediately for remaining updates; lookups reflect structural changes immediately. Component plans and Actor membership are captured at step start. An Actor disabled at step start cannot start updating mid-step. Do not mutate returned readonly rosters.

### Built-in Components

| Component          | Defaults and behavior                                        | Required components |
| ------------------ | ------------------------------------------------------------ | ------------------- |
| Transform          | x/y=0, rotation=0 radians, scaleX/Y=1; finite initial values | none                |
| Renderable         | width/height=32, color=0x73e3c0, shape=Shape.Box, no sprite  | Transform           |
| Motion             | speed=180 units/second, direction x/y=0                      | Transform           |
| KeyboardController | KeyMaps.wasd; physical key codes; normalized diagonals       | Motion              |

Motion.direction is an explicit velocity direction/multiplier; arbitrary user vectors are not normalized. KeyboardController normalizes its own input vector and writes into Motion. Renderable shape is Box or Character; sprite is an image URL, centered in its width/height box. Image aspect preservation, animation, collision, camera follow and physics remain deferred. Renderable configuration is immutable; remove/re-add it to change image/geometry. Transform and Motion.direction are live mutable numeric data; callers must preserve finite values when changing them.

Character(options) returns a CharacterActor preset with Transform, Renderable(Shape.Character), Motion and KeyboardController. Its options retain id, x/y (400/225), speed (180), size (32), color (0x73e3c0), movement (Movement.None), keys and sprite. Movement.WASD/Arrows/None select mappings; explicit keys overrides movement. CharacterActor.x/y are convenience accessors for Transform. It has no separate simulation/storage path. Position is not automatically clamped or recentered for another resolution.

Use Vite imports or `import.meta.env.BASE_URL + 'player.svg'` for subpath-safe images. Runtime images require same-origin or CORS-enabled sources.

### A custom Component

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

Declare explicit token type annotations to avoid recursive TypeScript inference. Static type is the identifier used by get/require/remove; the instance type identifies its own capability. Override protected onAttach/onDisable/onDestroy for ownership hooks. onAttach runs when attached to an Actor, which may not yet belong to a Scene. It can read dependencies and register owned resources, but cannot recursively change the Actor component structure. onDispose(callback) registers removable LIFO cleanup. Component.dispose removes itself through the Actor and therefore respects dependency constraints.

Default phase is ComponentPhase.Update; override readonly phase with ComponentPhase.Input for input processing. All Input components run before any Update components, then scene timers and scene callbacks run. Within a phase use Actor insertion order and Component insertion order. Requirements do not imply scheduling across phases. Frame context exposes delta (seconds), frozen input and scene; it is reused, so do not retain it.

## Scenes, events and timers

```ts
import { Actor, defineEvent, Scene } from "@simpludify/core";
const Damage = defineEvent<{ amount: number }>("Damage");
const scene = new Scene("arena");
const actor = scene.add(new Actor());
const off = scene.events.on(Damage, ({ amount }) => console.log(amount), actor);
scene.events.emit(Damage, { amount: 2 });
off(); // also automatic when actor is destroyed
scene.after(1, () => console.log("one simulation second"), actor);
```

Scene state is Preparing → Ready → Active → Inactive → Disposed. markReady is synchronous; Engine.activate can mark a Preparing headless scene ready for convenience. Engine.step activates its default scene before the first update. Engine replacement destroys the old instance. Disposed/Inactive instances cannot be reused. Register onActivate before activation; UI layout is available after awaiting Web run/goTo. onActivate/onDeactivate/onUpdate/onDispose register callbacks and return unregister functions; unregister does not invoke cleanup. Resource acquisition on inactive/disposed owners throws. Initial default activation preserves synthetic input, and replacement clears it.

Scene.events, Actor.events and Component.events are lazy local buses. `new EventBus()` and `new Lifetime()` are available for explicitly application-owned scopes; dispose them yourself. `bus.on(token, handler, owner?)` returns idempotent unsubscribe. Disposing either the bus or optional owner removes the subscription. Same-name event tokens remain distinct. emit is synchronous and registration-ordered; additions during delivery wait for the next emit, while removal takes effect immediately. Different tokens can nest; the same token cannot recursively dispatch on the same bus. All eligible handlers run; failures are thrown as AggregateError. Promise-returning handlers produce EVENT_ASYNC_HANDLER; their rejections are consumed and the emitter receives an aggregate error. Own async work explicitly outside synchronous delivery.

scene.after(delay, callback, owner?) permits finite nonnegative seconds; zero fires next step. scene.every(interval, callback, owner?) requires positive seconds. Both return cancellation functions, run only on active scene steps and cancel with the scene/optional owner. Repeated timers fire at most once per step, dropping missed repetitions. Timers created during a timer callback wait for another step. Actor/Component disable does not pause owner timers.

## Camera and coordinate spaces

```ts
import {
  Camera,
  createViewTransform,
  worldPoint,
  worldToScreen,
  screenToWorld,
} from "@simpludify/core";
const camera = new Camera({ x: 100, y: 50, zoom: 2 });
const view = createViewTransform({
  viewport: { x: 20, y: 30, width: 800, height: 450 },
  resolution: { width: 800, height: 450 },
  camera,
});
const screen = worldToScreen(view, worldPoint(500, 275));
const world = screenToWorld(view, screen);
```

WorldPoint, ScreenPoint and PhysicalPoint carry a space tag so accidental cross-space calls fail typechecking. worldPoint/screenPoint construct finite coordinates. Screen units are host-local CSS pixels; Viewport x/y offset is included. LogicalResolution is a nominal extent, not a backing-buffer dimension. Camera x/y are the nominal view's top-left world coordinates; zoom is centered on that extent. Camera defaults to (0,0,1) and rejects nonfinite positions/nonpositive zoom.

Aspect.Fit preserves ratio with centered bars and clips to the fitted rectangle. Fill preserves ratio and crops to the viewport. Adaptive uses the viewport CSS size as logical extent. containsScreenPoint(view, point) checks visible clip bounds. screenToPhysical(point, dpr) scales only presentation pixels; DPR never belongs in world/screen conversion.

Game.camera is mutable. Game.view returns the current cached projection; worldToScreen/screenToWorld methods use it. Game.pointerToWorld({clientX,clientY}) accounts for host bounds/scaling and returns WorldPoint. It converts outside points too; call containsScreenPoint if clicks in bars must be ignored. Game.setViewport(rect) selects a fixed CSS rectangle; setViewport() restores full-host tracking. The overlay remains responsive across the whole host and is unaffected by Camera. Custom fixed CSS positioning can clip independently.

## Headless execution

```ts
import { Engine, Character, Movement } from "@simpludify/core";
const engine = new Engine(42);
engine.scene.add(Character({ movement: Movement.WASD }));
engine.input.set("KeyD", true);
engine.step(1 / 60);
console.log(engine.snapshot().actors);
engine.dispose();
```

Engine.step takes finite nonnegative seconds without a cap. InputState supports set/clear/isPressed/direction/writeDirection/snapshot. capture returns a cached immutable InputReader until input changes. Engine.random is a seeded uint32 LCG. snapshots copy scene ID/state, elapsed time, PRNG state, input and generic Actor IDs/enable flags/optional Transform values. Custom component data and renderer state are not automatically serialized/restorable.

## DOM UI and styling

Label(text, {muted?}) exposes setText and only updates subscribers when text changes. Button(text, handler) is a native button; it disables itself while an async handler runs and reports failures. Panel(children, {title?,layout?}) defaults to Layout.Column; Row wraps and Grid auto-fits. Panels use intrinsic sizing, a 30rem maximum width, safe-area spacing and native overlay scrolling. Text is inserted with textContent. Empty overlay space passes pointer events to the world.

Theme.Dark/Light and partial tokens override typography/colors. Packaged fonts use ordinary @font-face; await document.fonts.load before run when needed for first-frame font readiness. DOM layout follows browser text/font/viewport invalidation; no custom font or layout manager is required. Application token overrides must preserve accessibility. Tab/Enter/Space retain native button interaction.

## Renderer ports, diagnostics and migration

RendererPort exposes init(), prepare(scene), resize(cssWidth, cssHeight, dpr) and dispose(). PreparedScene exposes render(view), optional ready() and dispose(). Rendering reads live state; custom adapters must handle cancellation, structural changes and idempotent cleanup. PixiRenderer.diagnostics returns current presentations/visuals/pendingImages counts on demand.

EngineError carries code/message/details and toJSON. Ownership/state diagnostics include ACTOR_OWNERSHIP, DUPLICATE_ACTOR, COMPONENT_OWNERSHIP, COMPONENT_MISSING, COMPONENT_DUPLICATE, COMPONENT_CYCLE, COMPONENT_REQUIRED, SCENE_STATE, SCENE_OWNERSHIP, TRANSITION_REENTRANT, STEP_REENTRANT and EVENT_REENTRANT. Disposed scopes reject new resource acquisition. User errors remain ordinary Errors/AggregateErrors. See architecture for commit-time error semantics.

This experimental revision intentionally removes obsolete storage APIs:

| Previous API                                          | Current API / reason                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| CharacterState plain object                           | CharacterActor composition preset; custom objects use Actor + Components               |
| Scene.characters / Scene.seal                         | Scene.actors with dynamic membership; no sealed roster                                 |
| Character direct keys/speed/size/color/sprite fields  | get/require KeyboardController, Motion or Renderable; x/y convenience accessors remain |
| snapshot().characters                                 | snapshot().actors with optional transform                                              |
| GameOptions.world                                     | resolution + aspect + camera + viewport, separated by responsibility                   |
| viewTransform / WorldView                             | createViewTransform with explicit logical resolution, camera and viewport              |
| Renderer.prepare(characterList), resize(...worldView) | prepare(scene), resize(cssWidth,cssHeight,dpr), render(view)                           |

The minimal Game/Character/Movement example remains unchanged. See `examples/composition` for a runnable game exercising custom Components, typed events, scoped timers/listeners, spawning, removal and Camera zoom.
