# API

`@simpludify/core` is DOM-free. [Typed Action input](action-input.md) defines logical buttons/axes, key bindings, source composition and input boundaries. `@simpludify/web` re-exports Core and supplies Game, PixiRenderer, browser input, DOM UI and scoped default CSS. All mode objects export corresponding union types. Internal packages remain private source workspaces.

## Fixed-size two-dimensional data

`Grid<T>` provides `new Grid(width,height,initial)`, `Grid.generate(width,height,(x,y)=>value)`, read-only width/height, `inBounds`, strict `get`/`set`, `fill`, `forEach` and `forEachRect`. It is independent of Engine/lifecycle/rendering, stores references without ownership, and uses a private row-major Array. See [Grid contracts and examples](grid.md) for shared initial values, range errors, traversal and the dense size limit.

## Minimal game and defaults

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";

const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
```

Click or Tab into the game host to use movement keys. Game does not autofocus. Without parent, the host is appended to document.body; give the parent/page a height for full-screen layout. Default host CSS is 100% width/height with a 20rem minimum height. Engine-owned buttons consume activation/navigation keys and permit unrelated gameplay bindings; native text/number/select editing owns its keys and clears browser movement. Tab navigates UI/page order. See [keyboard priority and focus](canvas-ui.md#keyboard-and-accessibility-scope). Call game.dispose when removing it.

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
| seed        | automatic                     | Optional validated uint32 initial seed                               |
| maxDelta    | 0.05 seconds                  | Positive Web frame delta cap                                         |
| renderer    | PixiRenderer factory          | Receives owned HTMLElement; returns RendererPort                     |
| frames      | RAF driver                    | FrameDriver request/cancel; callbacks must be asynchronous           |
| onError     | console.error                 | Background/UI/cleanup observer; nonfatal errors also reach an alert  |

Game.add(actor) returns the same Actor and works both before run and during execution. Game.remove(actorOrId) destroys a member of the current Scene and returns whether it existed. During preparation of another Scene these methods still target the current Scene; use the staged context's add/scene for the candidate.

Game.scene(id, setup) registers a unique factory. `Game<'menu' | 'play'>` restricts IDs at compile time. Setup receives scene, signal, add, ui, onUpdate, onActivate, onDeactivate and onDispose. Async setup is allowed; use signal for cancellable work and register cleanup before awaiting. run(id?) returns a shared startup Promise; await it before goTo. goTo(id) returns a readiness Promise, coalesces identical outstanding requests, queues different IDs and creates a fresh Scene after a completed reload. Before-commit setup/asset failures preserve the current scene. Lifecycle callback errors are reported after commit while retaining the new scene. Game.dispose is synchronous and idempotent; it promptly rejects outstanding navigation.

Game.whenReady synchronizes the captured current presentation, follows its latest observed requests and renders prepared state before resolving. Superseded/removed requests stop blocking; current failures reject promptly even with unrelated unfinished loads. Old displays survive runtime failures. Presentation disposal rejects GAME_DISPOSED. This does not await independent navigation or future assignments. See [live rendering](rendering.md).

`fixedStep?: { step?, maxSteps?, maxFrameDelta? }` opts Web into bounded fixed stepping; variable stepping remains the default. `Game.playReplay(data, { scene, controllers, expectedMetadata? })` configures playback in the initial Scene factory, before the fresh Engine's first step; `stopReplay()` releases it. See the [complete contract and examples](replay.md).

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

New Actors/Components update from the next step. An Actor created during an update is already a Scene member: a newly added Collider can therefore participate in that step's later collision pass, even before the new Actor's first component update. Removal/disable takes effect immediately for remaining updates; lookups reflect structural changes immediately. Component plans and Actor membership are captured at step start. An Actor disabled at step start cannot start updating mid-step. Do not mutate returned readonly rosters.

### Built-in Components

| Component      | Defaults and behavior                                                   | Required components |
| -------------- | ----------------------------------------------------------------------- | ------------------- |
| Transform      | x/y=0, rotation=0 radians, scaleX/Y=1; finite initial values            | none                |
| Renderable     | width/height=32, Box source, shape color=mint / image color=white       | Transform           |
| Motion         | mutable speed=180 units/second (zero allowed), direction x/y=0          | Transform           |
| ActionMovement | Axis2D reader, mutable scale=1; Update copies value × scale into Motion | Motion              |

Motion.direction is a finite, dimensionless direction/multiplier; arbitrary vectors are not normalized. Its reference is read-only but x/y are mutable. Motion.speed is finite/nonnegative and mutable. Integrate applies position += direction × speed × delta after command-producing Update Components, validating both resulting coordinates before committing either. ActionMovement.scale is finite/nonnegative (default 1); it scales captured input without rewriting/renormalizing Actions. Axis2D normalizes by default in ActionController. See [movement composition, sprint and migration](movement.md). Transform is live mutable data; callers must preserve finite values. Motion validates speed on assignment, direction at construction/integration, and derived coordinates before committing either axis.

Renderable exposes validated mutable width/height, color, source, visible, opacity and zIndex. The copied/frozen source is `{ kind: "shape", shape: Shape }` or `{ kind: "image", url: string, fit?: SpriteFit }`, default Box. Image fit defaults to Contain; Stretch fills the positive bounds. Initial color is mint for shapes and white for images; later source changes preserve color. Color fills shapes and multiplies image RGB. Validated changes advance Renderable.revision without touching Scene structure; equal values are no-ops. Source changes retain dependents and the old display until a new image succeeds. Circle uses half the smaller dimension; Triangle points up around its bounding-box center. Shape never changes Collider geometry. Higher zIndex draws above lower; equal depths use Actor insertion order. Visibility does not disable contacts. See [rendering contracts and migration](rendering.md).


Character(options) returns a CharacterActor preset with Transform, Renderable with a Character source, Motion and, when `movement` is supplied, ActionMovement. Options are id, x/y (400/225), speed (180), size (32), color (mint for shape / white for image), `source?: VisualSource` and `movement?: ActionReader<"axis2d">`. No input is enabled implicitly. Pass `controls.reader(Actions.Move)`; the Action name is defined by the game. CharacterActor.x/y are convenience accessors for Transform. Its speed option only initializes Motion.speed, which is the single base-speed state. Omit movement to add a custom movement Component without ActionMovement. It has no separate input/storage path. Position is not automatically clamped or recentered for another resolution.

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

Declare explicit token type annotations to avoid recursive TypeScript inference. Static type is the identifier used by get/require/remove; the instance type identifies its own capability. Override protected onAttach/onDisable/onDestroy for ownership hooks. onAttach runs when attached to an Actor, which may not yet belong to a Scene. It can read dependencies and register owned resources, but cannot recursively change the Actor component structure. onDispose(callback) registers removable LIFO cleanup. Component.dispose removes itself through the Actor and therefore respects dependency constraints. During onDestroy and owned cleanup, dependencies remain readable until their own reverse-order destruction. The Actor is already disposed and cannot acquire resources or change structure; actor.scene is undefined during whole-Actor destruction.

Default phase is ComponentPhase.Update for command calculation. The global order is Input → Update → Integrate → LateUpdate, then post-update hooks (including contact detection), simulation Tweens, timers and Scene callbacks. Motion uses Integrate; ActionMovement uses Update. Input policies can set adapter.scale for the same step; LateUpdate is for post-motion clamping/firing before contacts. Within a phase use Actor insertion order and Component insertion order. Requirements do not imply scheduling across phases. Frame context exposes delta (seconds) and scene; it is reused, so do not retain it.

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

Scene state is Preparing → Ready → Active → Inactive → Disposed. markReady is synchronous; Engine.activate can mark a Preparing headless scene ready for convenience. Engine.step activates its default scene before the first update. Engine replacement destroys the old instance. Disposed/Inactive instances cannot be reused. Register onActivate before activation; UI layout is available after awaiting Web run/goTo. onActivate/onDeactivate/onPostUpdate/onUpdate/onDispose register callbacks and return unregister functions; unregister does not invoke cleanup. Resource acquisition on inactive/disposed owners throws. Initial default activation preserves synthetic input, and replacement clears it.

Scene.events, Actor.events and Component.events are lazy local buses. `new EventBus()` and `new Lifetime()` are available for explicitly application-owned scopes; dispose them yourself. `bus.on(token, handler, owner?)` returns idempotent unsubscribe. Disposing either the bus or optional owner removes the subscription. Same-name event tokens remain distinct. emit is synchronous and registration-ordered; additions during delivery wait for the next emit, while removal takes effect immediately. Different tokens can nest; the same token cannot recursively dispatch on the same bus. All eligible handlers run; failures are thrown as AggregateError. Promise-returning handlers produce EVENT_ASYNC_HANDLER; their rejections are consumed and the emitter receives an aggregate error. Own async work explicitly outside synchronous delivery.

scene.after(delay, callback, owner?) permits finite nonnegative seconds; zero fires next step. scene.every(interval, callback, owner?) requires positive seconds. Both return cancellation functions, run only on active scene steps and cancel with the scene/optional owner. Timer eligibility is captured at the Engine.step boundary before Action callbacks and all Scene update phases: timers registered during any update phase, contact delivery, timer callback or Scene.onUpdate first advance on the following step. Repeated timers fire at most once per step, dropping missed repetitions while preserving the fractional remainder of their scheduled interval. Actor/Component disable does not pause owner timers.

## Trigger and Solid contacts

```ts
import {
  Actor,
  BodyType,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  ContactEnter,
  Transform,
} from "@simpludify/core";
const world = new CollisionWorld(scene);
const player = scene.add(new Actor());
player.add(new Transform({ x: 100, y: 200 }));
player.add(new CollisionBody({ motion: BodyType.Dynamic, mass: 1 }));
const playerCollider = player.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 13,
    response: CollisionResponse.Solid,
  }),
);
const wall = scene.add(new Actor());
wall.add(new Transform({ x: 150, y: 200 }));
wall.add(
  new Collider({ width: 18, height: 150, response: CollisionResponse.Solid }),
);
playerCollider.events.on(
  ContactEnter,
  ({ otherActor, normalX, normalY }) => {
    console.log(otherActor.id, normalX, normalY);
  },
  player,
);
// Optional pull-based inspection; event subscriptions are not required.
const contacts = world.contactsFor(playerCollider);
```

### Geometry, filtering and response policy

One Collider per Actor requires Transform; Renderable is optional. Box defaults to width/height 32, Circle to radius 16. Dimensions must be positive and finite. offsetX/Y default to 0 in local units and follow Transform scale/rotation. Boxes support independent scale axes and rotation in radians; circles require equal absolute scale axes (otherwise COLLIDER_SCALE_UNSUPPORTED). Negative scales reflect offsets, and zero on either axis excludes the collider. Actor.enabled and Collider.enabled gate participation; Transform.enabled and visibility do not. Finite values whose derived world geometry overflows are rejected.

`response` defaults to **CollisionResponse.Trigger**, preserving existing games. It is immutable, as are dimensions, offsets and filters; remove/re-add the Collider to change them. The named response values keep configuration readable and permit additional policies without overloading the opposite of an isTrigger/isSensor boolean. There is one policy API, rather than equivalent boolean aliases.

layer defaults to 1 (nonzero uint32); mask defaults to 0xffffffff (uint32, zero allowed). **Both** masks must include a bit of the other's layer. The same filter applies to detection, correction and notification. World contact tolerance defaults to 1e-7 world units, so exact touching and numerical gaps within that tolerance count as contact.

| Pair              | Contact detection/events                    | Position correction                          |
| ----------------- | ------------------------------------------- | -------------------------------------------- |
| Trigger / Trigger | Yes, at final corrected positions           | None                                         |
| Trigger / Solid   | Yes, at final corrected positions           | None                                         |
| Solid / Solid     | Yes, including encounters during correction | Based on enabled CollisionBody participation |

### CollisionBody and position correction

CollisionBody is a passive Component requiring Transform. `motion` defaults to BodyType.Dynamic, `mass` to 1 (finite, positive, with finite reciprocal). Dynamic bodies share translation inversely to mass. BodyType.Static, a disabled body, or **no CollisionBody** gives zero correction weight. Thus ordinary Solid walls require no body; a player explicitly opts into correction by adding one. A body without a Solid Collider does not create collisions. Motion still integrates directional movement intent, while the collision pass corrects Transform positions afterward. Neither the solver nor CollisionBody changes Motion.direction, creates velocity, rotates bodies or integrates forces.

Fixed bodies may still be moved explicitly by application code; Static is a response weight, not a Transform lock. Moving-platform velocity transfer and kinematic pushing are not implemented. A fixed/fixed overlap remains detectable but is not separated. Disabling/removing a body changes the next pass's weight without disabling its Collider. Disabling/removing a Collider excludes it and produces survivor exits under the rules below.

`new CollisionWorld(scene, { iterations: 6, tolerance: 1e-7 })` opts a Scene into detection/response. iterations must be an integer from 1 to 32; tolerance finite/nonnegative. One world per Scene is enforced (COLLISION_WORLD_DUPLICATE). The default iteration budget is bounded; it is not a rigid-body stability guarantee.

Each Engine step runs Component updates, then the world in its registered post-update hook, then timers and Scene.onUpdate. The world first validates/captures eligible geometry, then repeatedly sweeps X bounds, applies Y/filter rejection and computes minimum translation normals for Solid pairs. Pairs are corrected in deterministic collider-discovery order, recomputing current geometry before each correction. New overlaps introduced by correction are considered on subsequent iterations. Correction stops when no translation is needed or the budget is exhausted. A final pass detects Trigger contacts at corrected positions and records current Solid contacts. All event callbacks run **after** correction; the solver does not call game logic halfway through a response iteration. Registered post-update hooks before/after the world retain their normal registration order.

Normal wall movement stops along the collision normal and preserves tangent displacement, allowing sliding. Repeated inward Motion intent is corrected each step. Narrow impossible gaps, deep interlocking bodies, arbitrary crowds/stacks and too-small iteration budgets can retain penetration or jitter; inspect responseDiagnostics.unresolved. There are no impulses, restitution, gravity, friction, torque, angular response or rigid-body constraints.

This is **discrete** collision detection. Fast objects can cross thin walls between endpoints. Use suitably bounded Engine.step calls, or explicitly subdivide a movement interval into smaller Engine steps; additions, events and timers then follow each substep's normal semantics. Subdivision mitigates tunneling only when displacement is small enough for the geometry. Large teleports, swept contacts and a universal continuous-collision guarantee are not supported. Web's maxDelta cap limits time but cannot guarantee safety for every speed or shape.

### Contact lifecycle and observation

Contacts use ContactEnter/ContactStay/ContactExit for both policies, once per notified participant per world pass (not once per solver iteration). A newly observed pair enters, a pair seen on a later pass stays, and a previously notified pair absent/invalid on the next pass exits. Solid pairs encountered during correction remain observed for that pass even if another correction subsequently separates them; an exit can therefore follow on the next pass. Triggers are sampled after correction only. There is no swept Trigger crossing event.

Pairs deliver in deterministic discovery-ID order, first participant then second. Handler additions and position changes affect the next pass. Removal/disable suppresses later Enter/Stay to that participant immediately. Exit reaches previously notified surviving colliders, including disabled ones; destroyed colliders receive nothing. Scene/world disposal stops delivery and clears silently without synthetic exits. Handler failures are aggregated after other eligible contacts run. Geometry errors abort the pass; initial geometry validation occurs before response, but already performed Component updates or later corrections are not rolled back. A caller may correct invalid values and step again.

Contact payloads contain self/other Collider, selfActor/otherActor, normalX/Y (unit vector from self toward other), depth (largest observed pre-correction penetration in that pass), response (effective pair policy), and resolved (whether that pair translated a body in this pass). Exit retains the last observed payload. Participants can be disposed; check before acquiring resources. Event payloads are reused between passes; copy scalar values to retain history. `world.contactsFor(collider)` allocates independent readonly scalar snapshots of currently tracked eligible contacts; referenced Actors/Colliders remain live objects. It returns an empty array after disposal, and reflects the last pass rather than unstepped position changes.

`world.diagnostics` reports reconciled colliders (including disabled), tracked contacts, X candidates and narrow tests. `responseDiagnostics` reports solver passes, pair corrections and unresolved movable Solid overlaps in the final scan. Candidate/narrow-test counts include repeated solver scans. No response passes run without an eligible dynamic Solid. Removal during delivery can leave a tracked pair until the next pass; contactsFor excludes invalid pairs immediately.

World ownership, duplicate rejection, explicit step/dispose and reentrancy remain unchanged: automatic stepping normally suffices; manual world.step requires an active Scene and performs an additional pass. dispose is idempotent, unregisters hooks and permits a replacement world. Recursive step throws COLLISION_REENTRANT, and disposed step throws COLLISION_WORLD_DISPOSED. Dense contact storage/work remains quadratic; the sweep is not a universal scalability guarantee.

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

### CameraFollow

`new CameraFollow(camera, { resolution?, bounds?, responsiveness? })` supplies optional world-space tracking. resolution defaults to 800×450; bounds is an optional world rectangle; responsiveness defaults to 0 (immediate). `follow.update(target, seconds)` follows a finite x/y point and rejects negative/nonfinite time. Call it after response, for example from Scene.onUpdate, so it tracks the corrected position. It owns no subscriptions, Scene or host resources. Match resolution to the Game's logical extent; Adaptive layouts must supply their actual logical extent.

The view's center follows the target, clamped using camera.zoom so visible edges remain within bounds when possible. If the world is smaller than the visible extent, it is centered. Positive responsiveness uses exponential smoothing per simulation second, with no per-frame target allocation. Zero snaps even for a zero-duration update. On zoom changes, update the follower immediately if pointer conversion must use the newly clamped camera before the next simulation step. Pixel ratio is never part of tracking. Signal Run demonstrates bounded zoom/follow using the public API.

## Headless execution

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Engine,
} from "@simpludify/core";
const engine = new Engine({ seed: 42 });
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
});
engine.scene.add(Character({ movement: controls.reader(Actions.Move) }));
const automatic = controls.createSource();
automatic.set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
console.log(engine.snapshot().actors);
engine.dispose();
```

Engine.step takes finite nonnegative seconds without a cap. It captures all active ActionControllers before delivering any onPressed callbacks. UpdateContext supplies delta and scene; input dependencies are explicitly injected rather than read from a global raw frame. Read ActionController.value/button/events or inject a kind-typed reader into a Component. [Action input](action-input.md) defines buttons, axes, composition, binding changes, ownership and boundary semantics.

Engine.pause/resume and Web Game.pause/resume are idempotent. Paused steps capture Action input and dispatch onPressed controls but skip simulation unless resumed at that boundary. State changes clear held contributions and pending edges. Game continues rendering/DOM UI and resets its frame timestamp. Scene replacement clears input; disposal releases controllers and sources. Engine.random is an owned RandomManager with an actual initial seed and named independent streams. See [Random / Replay / fixed steps](replay.md). Engine.snapshot copies scene state, elapsed time, PRNG state, device-key diagnostics and generic Actor/Transform state. Logical state is available from controls.snapshot(); neither snapshot is a restorable custom-Component save format.

### Device adapters and text input

Game automatically owns one BrowserInput, routing focused physical KeyboardEvent.code values to **active Action bindings only**. Native controls/contenteditable and IME composition are excluded; blur/hiding/focus changes release the browser's contribution. No Actor/controller scan or independent raw movement reader remains. Touch and AI use controls.createSource(), never synthetic keyboard keys.

InputSystem.createKeyboardSource(owner?) is for implementing a keyboard adapter or testing physical bindings. It accepts only validated KeyCode values, is independently disposable and cannot read game state. InputSystem.snapshot() reports physical-key diagnostics; sourceCount counts device and logical handles. There is no implicit scripted source. InputSystem.clear() silently flushes all sources and pending edges while preserving live handles. InputSystem.keyDown and registration/capture methods are internal routing, not another gameplay input API. Do not attach a second BrowserInput to a Game; it already owns the adapter. Custom keys are ordinary Button Actions with bindings.

Text and IME commits use native input/textarea value, input and composition events, rather than KeyCode. See the working [typing recipe and current limitations](action-input.md#text-and-typing-games). Canvas text editing keeps logical draft/selection/composition contracts in Core and delegates native editing/IME to the Host. See [native editing contracts and verification limits](text-input-design.md).

## Canvas UI and Pointer

Web `context.actions(definitions, bindings?)` creates the existing ActionController with the factory's Scene and Game input. `game.actions` uses the current Scene; Core explicit construction is unchanged. `context.canvasUI(root, {scale?})` owns one staged Canvas tree; `game.canvasUI` configures the default Scene before run. Core CanvasPanel/Row/Column/Scroll/Label/Button/HoldButton (reexported by Web) expose validated style patches, text changes, visibility, enablement, node events and Scene-linked cleanup. A bounded Flex subset runs on dirty geometry/content only. UI units are host CSS pixels / UI scale, independent of Camera and DPR.

`context.pointer.events` (or current `game.pointer.events`) receives world-only PointerDown/Move/Up/Cancel/Click. Nodes receive typed Pointer events through their own events bus. Down fixes routing until release; an original ancestor scroller may claim a UI drag after cancelling the old target. World gestures remain fixed. Capture is automatic. Native transparent button mirrors supply Tab/Enter/Space with drawn focus; they do not perform pointer hit testing. DOM UI is retained. [Full contracts, examples and limits](canvas-ui.md) define clips, ordering, async button cancellation and supported accessibility scope.

## DOM UI and styling

Label(text, {muted?}) exposes setText and only updates subscribers when text changes. Button(text, handler) is a native button; the handler receives the mounted overlay's AbortSignal, aborted on unmount. It disables itself while an async handler runs and reports failures. HoldButton(text, onHold) reports a boolean held state across mouse/touch pointers and Enter/Space, including simultaneous pointers. Repeated presses do not repeat callbacks. Release, pointer cancellation, lost capture, blur, hiding and UI disposal release the relevant hold. Errors reach the UI observer. Use a separate owned ActionSource for each independently releasable control group. Panel(children, {title?,layout?,placement?}) defaults to Layout.Column and Placement.Top; Placement.Center/Bottom align an outer panel within the overlay. Row wraps and Grid auto-fits. Panels use intrinsic sizing, a 30rem maximum width, safe-area spacing and native overlay scrolling. Text is inserted with textContent. Empty overlay space passes pointer events to the world.

Theme.Dark/Light and partial tokens override typography/colors. Packaged fonts use ordinary @font-face; await document.fonts.load before run when needed for first-frame font readiness. DOM layout follows browser text/font/viewport invalidation; no custom font or layout manager is required. Application token overrides must preserve accessibility. Tab/Enter/Space retain native button interaction.

## Renderer ports, diagnostics and migration

RendererPort exposes init(), prepare(scene), resize(cssWidth, cssHeight, dpr) and dispose(). PreparedScene exposes render(view), optional ready() and dispose(). Rendering reads live state; custom adapters must handle cancellation, structural changes and idempotent cleanup. PixiRenderer shares images by resolved URL within the Renderer; Visuals retain independent appearance and pending/committed leases. Final release aborts loading or destroys the shared Texture/TextureSource. Diagnostics returns presentations, visuals, textures, imageReferences, imageEntries and pendingImages on demand; pendingImages counts unique underlying loads, not waiting Visuals. See [sharing, URL identity and readiness](rendering.md).

EngineError carries code/message/details and toJSON. Ownership/state diagnostics include ACTOR_OWNERSHIP, DUPLICATE_ACTOR, COMPONENT_OWNERSHIP, COMPONENT_MISSING, COMPONENT_DUPLICATE, COMPONENT_CYCLE, COMPONENT_REQUIRED, COMPONENT_PHASE, SCENE_STATE, SCENE_OWNERSHIP, TRANSITION_REENTRANT, STEP_REENTRANT and EVENT_REENTRANT. Disposed scopes reject new resource acquisition. User errors remain ordinary Errors/AggregateErrors. See architecture for commit-time error semantics.

This experimental revision intentionally removes obsolete storage APIs:

| Previous API                                          | Current API / reason                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| CharacterState plain object                           | CharacterActor composition preset; custom objects use Actor + Components                   |
| Scene.characters / Scene.seal                         | Scene.actors with dynamic membership; no sealed roster                                     |
| Character direct keys/speed/size/color/sprite fields  | inject an ActionReader; get/require Motion or Renderable; x/y convenience accessors remain |
| snapshot().characters                                 | snapshot().actors with optional transform                                                  |
| GameOptions.world                                     | resolution + aspect + camera + viewport, separated by responsibility                       |
| viewTransform / WorldView                             | createViewTransform with explicit logical resolution, camera and viewport                  |
| Renderer.prepare(characterList), resize(...worldView) | prepare(scene), resize(cssWidth,cssHeight,dpr), render(view)                               |

This experimental revision also removes InputState, InputSource, InputReader, KeyMap/KeyMaps, Movement and KeyboardController. Character now accepts an explicit Axis2D ActionReader. UpdateContext no longer contains raw input. See `examples/composition` for a runnable game exercising custom Components, typed events, scoped timers/listeners, spawning, removal and Camera zoom.

## SpriteSheet and SpriteAnimation

[Sprite contracts and examples](sprites.md) define grid/named/rectangular image sources, simulation-time playback, Renderable source ownership, deferred bounds checking and shared crop/source cleanup. Both APIs are exported by Core and Web. SpriteAnimation requires Renderable, runs in LateUpdate, and does not add host timers or an asynchronous Core lifecycle.

## Tilemap placements

[Tilemap](tilemap.md) is a facade over one existing Actor/TilemapLayer placement per map. It copies Grid/row data and exposes typed tile IDs, set/fill, tile/world conversion, translation and depth/visibility. Web owns a culled incremental visible-cell renderer and shared sheet lease. Optional [terrain collision](tilemap-collision.md) uses the same CollisionWorld with ID defaults/cell overrides and dedicated TileContact events. No per-cell Actor/Component is added.

Canvas panels also support `move(child, finalIndex)` without disposal and `clear()` with aggregate cleanup. CanvasUI owns logical focus and scrolled bounds; [Canvas contracts](canvas-ui.md) and [Host migration](host-boundary.md) cover scroll range, exact text metrics, native AbortSignal compatibility and the portable CancellationSignal.

CanvasScroll supports per-node dragScroll/inertia/scrollbar/dragThreshold, direct thumbs and keyboard scrolling. [Scroll contracts](scrolling.md) cover default values, timestamps, Core advance(seconds), runtime mutation and cancellation. Offset-only updates now project cached layout instead of repeating Flex.

## Standard Canvas value controls

Core/Web `CanvasCheckbox(label, {checked?, readOnly?}, style?)` and `CanvasSlider({label?, min?, max?, step?, value?, readOnly?}, style?)` return typed CanvasInputNode subclasses. Values, onChange/onCommit/onCancel, runtime range updates, read-only behavior and lifecycle are defined in [Canvas controls](canvas-controls.md). Both reuse CanvasUI focus and PointerRouting; Core remains Host-independent. The [settings screen](../examples/canvas-ui/settings-screen.ts) uses standard Core APIs only. `CanvasSelect(options, config?, style?)`, `CanvasTextInput(options?, style?)` and `CanvasNumberInput(options?, style?)` add accepted values, native draft sessions, focus and lifecycle cleanup. [Native editing contracts](text-input-design.md) define options, numeric parsing, keyboard operations, Host migration and unverified OS IME/mobile targets.

## Tween and display animation

[Numeric Tween reference](tween.md) defines Tween, Easing, TweenScheduler, Playback, Scene/Game clocks, actorTween, canvasTween and sliderTween. All are exported by Core and Web. Renderable draw offsets, relative rotation/scale and Canvas presentation are independent of world physics and Flex layout. Existing SpriteAnimation remains the source/frame player. Custom Hosts supply explicit display seconds through Scene.advancePresentation; Web supplies them automatically.
