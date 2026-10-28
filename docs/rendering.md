# Live rendering and image readiness

Core stores display requests; Web owns asynchronous realization. Renderable requires Transform and remains the same Component when appearance changes. No Pixi object, image element, image-ready flag or implicit Collider size enters the simulation.

## Display state

```ts verify
import { Actor, Renderable, Shape, Transform } from "@simpludify/core";
const actor = new Actor();
actor.add(new Transform({ x: 100, y: 150 }));
const view = actor.add(
  new Renderable({ width: 32, height: 40, color: 0x65a8ed }),
);
view.color = 0xff4444;
view.width = 48;
view.height = 48;
view.source = { kind: "shape", shape: Shape.Triangle };
view.opacity = 0.5;
view.visible = true;
view.zIndex = 10;
```

Width/height are positive finite logical dimensions; color is an integer RGB value from 0 through 0xffffff; opacity is finite in [0,1]; zIndex is finite; visible is boolean. Invalid setters throw INVALID_VALUE before changing state or revision. Transform controls position, radians rotation and independent scales. Renderable dimensions never resize Motion, CollisionBody or Collider. Circle uses half the smaller dimension. Triangle points up around its bounding-box-center pivot; its vertices are `(0,-height/2)`, `(width/2,height/2)`, `(-width/2,height/2)`. Character keeps contrasting eyes when body color changes.

Validated display changes advance read-only `revision`, independently of Scene's structural revision. Equal values are no-ops. Component identity, dependencies, subscriptions and ownership are retained. Invisible/disabled visuals retain resources and can still load; visibility does not disable collision.

## Explicit immutable source

`VisualSource` is a readonly discriminated union:

- `{ kind: "shape", shape: Shape }`: Box, Circle, Character or Triangle. Default: Box.
- `{ kind: "image", url: string, fit?: SpriteFit }`: nonempty image URL, default Contain; Stretch fills the requested dimensions.

Sources are copied and frozen. Replace `view.source`, rather than mutating its URL or fit. Omitted and explicit Contain compare equal. URLs use exact string equality; no canonicalization or sharing occurs. Separate Renderables still load/own separate resources for the same URL.

```ts verify
import { Actor, Renderable, SpriteFit, Transform } from "@simpludify/core";
const actor = new Actor();
actor.add(new Transform());
const view = actor.add(
  new Renderable({
    source: { kind: "image", url: import.meta.env.BASE_URL + "player.svg" },
    width: 48,
    height: 48,
  }),
);
view.color = 0xff8080;
view.source = {
  kind: "image",
  url: import.meta.env.BASE_URL + "player.svg",
  fit: SpriteFit.Stretch,
};
```

Use Vite imports or BASE_URL for subpath-safe assets; cross-origin images require suitable CORS headers. Data/blob image URLs are accepted. Natural image dimensions only determine aspect fitting, never game dimensions or Collider geometry.

The constructor chooses mint 0x73e3c0 for shapes and white 0xffffff for images, unless color is explicit. Character follows the same selected-source rule. Later source changes retain the current color, including the constructor default. Set white when switching a colored shape to an untinted image. Shapes use color as body fill; images multiply source RGB channels. Multiplication cannot replace an arbitrary image with a flat color or brighten dark pixels. Opacity applies to both paths.

## Switching and waiting

```ts verify
import { Actor, Game, Renderable, Shape, Transform } from "@simpludify/web";
const game = new Game();
const actor = game.add(new Actor());
actor.add(new Transform({ x: 200, y: 150 }));
const view = actor.add(new Renderable());
await game.run();
view.color = 0xffffff;
view.source = { kind: "image", url: import.meta.env.BASE_URL + "player.svg" };
try {
  await game.whenReady();
} catch (error) {
  view.source = { kind: "shape", shape: Shape.Box };
  await game.whenReady();
  console.error(error);
}
game.dispose();
```

Assignment is synchronous. The next render/readiness synchronization observes it. Color, dimensions and shape changes need no asynchronous API.

- New images retain the old image or shape until success. Current color/dimensions/opacity/Transform apply to that retained display; its old image fit remains until a replacement commits.
- A visual without a previous display remains absent while its first image loads.
- Latest observed requests win. Superseded loads are cancelled; late completions release their resource and cannot overwrite a newer display.
- Switching to a shape takes effect at the next synchronization. Returning to the still-displayed image reuses its resource.
- Color, dimensions, opacity, visibility, depth and same-URL fit changes do not reload images. Shapes reuse Graphics, images reuse Sprite. Changing between these backend types replaces the display object, not the Actor/Component.
- A current failure reports ASSET_LOAD_FAILED once, retains the old display and does not stop the active Scene. Replace/remove the failed request to recover; no automatic retry loop exists.
- Reassigning the same failed source remains a no-op. Retry by first selecting and synchronizing another source, then selecting the image URL again. No separate retry API is introduced.

`Game.whenReady()` captures the current presentation after startup, synchronizes it, and follows its latest observed requests until none remain pending. Superseded/removed requests stop blocking. A current error rejects promptly even when another image never finishes. Calls keep rejecting until the failed request is replaced/removed. Successful waits render the prepared current state before returning. They do not wait for future assignments or independently pending navigation; use `await game.goTo(id)` for navigation. Continuous source replacement can keep readiness pending.

Normal frames observe changes automatically. Manual hosts must call render or ready to observe new Core values; setters do not schedule browser work, and readiness adds no polling timer or animation-frame chain. Disposal of the captured presentation or Game rejects GAME_DISPOSED, including navigation that disposes the old presentation.

## Preparation, cleanup and independence

Initial run and staged goTo prepare initial images through the same machinery. Known failures reject preparation without waiting for unrelated unfinished images. Failed navigation disposes the candidate and retains the active Scene/presentation. Startup failure retains its existing terminal startup-error behavior. Runtime additions/source changes keep logical updates running on image failure.

Actor/Renderable disposal cancels its requests and releases its owned display/image; Scene disposal releases all of its visuals and wakes waiters. Game also cancels initialization/navigation and removes owned canvas/listeners. Late acquired resources release themselves without committing. Diagnostics count presentations, visuals, owned image resources and pending requests; they do not measure native/GPU bytes.

Every Visual currently owns a private acquired image resource through an internal release operation. Images bypass Pixi's shared global cache. There is no public TextureRef, shared cache, reference counter, Material, generic AssetManager, Sprite Sheet or animation API. Renderer consumes validated data without importing backend objects into Core. Replay format, random consumption and fixed-step logic are unchanged. Do not make game outcomes depend on uncontrolled image completion times.

## Migration

- Renderable `{ shape: Shape.Triangle }` becomes `{ source: { kind: "shape", shape: Shape.Triangle } }`.
- `{ sprite: url, fit: SpriteFit.Stretch }` becomes `{ source: { kind: "image", url, fit: SpriteFit.Stretch } }`.
- Character's sprite option becomes the same source option; no source still selects Character geometry.
- Read source through its kind discriminator instead of view.sprite/shape/fit.
- Change properties in place instead of removing/re-adding Renderable and its dependents.
- Explicit image color is now tint instead of being ignored. Use white for the old untinted result.

## Sharing follow-up

Preserve Component identity, immutable sources, revision/no-op semantics, latest-generation checks, retained displays, readiness and simulation independence. The source field can later accept a typed image reference without redesigning Component lifecycle; the URL/reference shorthand belongs to that later API decision.

Only resource acquisition/release needs sharing. Do not retain per-Visual texture.destroy(true) once resources are shared. Consumer cancellation must detach that consumer; abort a shared load only after the last consumer is gone. Track Visual requests separately from resource ownership and release stale acquisitions idempotently. Staged Scenes must acquire references before old Scene disposal releases theirs.

The first sharing tests should assert one load/resource for two Actors, independent tint/opacity/source, survival after one removal/cancellation, release at the last consumer, overlapping active/staged Scene lifetimes, isolated Games, and failures that cannot revive superseded requests.
