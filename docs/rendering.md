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

Sources are copied and frozen. Replace `view.source`, rather than mutating its URL or fit. Omitted and explicit Contain compare equal. Core compares URL strings exactly for revision/no-op behavior. Web resolves them against document.baseURI when acquiring an image and shares equivalent resolved URLs within one Renderer. Separate Renderables retain independent display state and Sprite objects.

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
- Latest observed requests win. Superseded consumers are cancelled; a shared load continues for other consumers. Late completions release their lease and cannot overwrite a newer display.
- Switching to a shape takes effect at the next synchronization. Returning to the still-displayed image reuses its resource.
- Color, dimensions, opacity, visibility, depth and same-URL fit changes do not reload images. Shapes reuse Graphics, images reuse Sprite. Changing between these backend types replaces the display object, not the Actor/Component.
- A current failure reports ASSET_LOAD_FAILED once, retains the old display and does not stop the active Scene. Replace/remove the failed request to recover; no automatic retry loop exists.
- Reassigning the same failed source remains a no-op. Retry by first selecting and synchronizing another source, then selecting the image URL again. No separate retry API is introduced.

`Game.whenReady()` captures the current presentation after startup, synchronizes it, and follows its latest observed requests until none remain pending. Superseded/removed requests stop blocking. A current error rejects promptly even when another image never finishes. Calls keep rejecting until the failed request is replaced/removed. Successful waits render the prepared current state before returning. This is CPU rendering submission, not a GPU fence or browser compositor-paint barrier. They do not wait for future assignments or independently pending navigation; use `await game.goTo(id)` for navigation. Continuous source replacement can keep readiness pending.

Normal frames observe changes automatically. Manual hosts must call render or ready to observe new Core values; setters do not schedule browser work, and readiness adds no polling timer or animation-frame chain. Disposal of the captured presentation or Game rejects GAME_DISPOSED, including navigation that disposes the old presentation.

## Preparation, cleanup and independence

Initial run and staged goTo prepare initial images through the same machinery. Actors created by activation hooks are runtime additions; use whenReady after run/goTo to await their images. Known failures reject preparation without waiting for unrelated unfinished images. Failed navigation disposes the candidate and retains the active Scene/presentation. Startup failure retains its existing terminal startup-error behavior. Runtime additions/source changes keep logical updates running on image failure.

Actor/Renderable disposal cancels its pending use and releases its display/committed image lease; Scene disposal releases all of its visuals and wakes waiters. Game also cancels initialization/navigation and removes owned canvas/listeners. Late acquired resources release themselves without committing. Other consumers keep their pending loads and displayed images.

Each Renderer owns a live-reference image cache; Visuals own independent leases. A pending replacement lease and the currently displayed lease are separate: old images stay alive until successful replacement, shape selection or owner disposal. Sprite.destroy() does not destroy the shared Texture. Only final lease release destroys the Texture and its TextureSource. Images bypass Pixi's global cache; one Game cannot destroy another Game's image resources.

Renderer consumes validated data without importing backend objects into Core. Custom renderers with asynchronous visual work must implement PreparedScene.ready and cancellation/disposal with the same presentation-scoped contract. Replay format, random consumption and fixed-step logic are unchanged. Do not make game outcomes depend on uncontrolled image completion times.

## Shared images without an asset API

The existing image source is the declarative reference. It contains no loading, readiness or disposal methods; copying or JSON-serializing it does not acquire resources. No TextureRef class is required. Reusing the same URL is sufficient:

```ts verify
import { Actor, Game, Renderable, Transform } from "@simpludify/web";
const game = new Game();
const url = import.meta.env.BASE_URL + "player.svg";
function spawn(x: number, color: number) {
  const actor = game.add(new Actor());
  actor.add(new Transform({ x, y: 100 }));
  actor.add(
    new Renderable({
      source: { kind: "image", url },
      width: 48,
      height: 48,
      color,
    }),
  );
  return actor;
}
const first = spawn(100, 0xff8080);
const second = spawn(200, 0xffffff);
await game.run();
first.require(Renderable.type).opacity = 0.5;
first.dispose(); // second retains its independent Sprite and the shared image
await game.whenReady();
second.dispose(); // last use releases the image
await game.whenReady();
game.dispose();
```

- Parallel requests for a key share one Image load, one Texture and one TextureSource in the pinned Pixi backend. Each Visual still owns its Sprite, tint, opacity, size, fit, visibility, depth and Transform. Changing these properties never changes another Visual or reloads the image.
- The key is `new URL(url, document.baseURI).href` at acquisition. Relative/absolute equivalents share. Standard URL resolution handles dot segments and host normalization; the engine does not strip or sort query parameters, remove fragments, follow redirects to combine keys, or ignore embedded credentials. Distinct query/fragment strings remain distinct entries even if a browser reuses a network response. Data/blob URLs work too; callers must not revoke a blob URL while it is in use.
- Loading always uses anonymous CORS, with no per-image credentials/crossOrigin options. Key identity includes that fixed policy implicitly. Future load settings affecting identity must be included in the key. Same-origin cookies follow browser anonymous-CORS semantics. Changing authentication or document.baseURI does not reload an existing unchanged source: select a new source or remove/reacquire it explicitly.
- Pending and ready consumers are counted together. Cancelling one pending consumer rejects only its acquisition. The underlying load aborts only when the last consumer leaves. A non-abortable late result is released without entering a replacement cache entry. Consumer release is idempotent.
- Ready images remain cached only while at least one pending/committed use exists. Hidden/disabled Visuals retain leases. No idle retention, LRU, preload handles or process-global cache is implemented. Reacquisition after the last use loads anew.
- Active and staged Scenes share the Renderer cache. A successfully prepared next Scene acquires before the old Scene releases; failed preparation releases only the candidate's leases and retains the active Scene. Separate default Games have separate Renderer caches, even for the same source object/URL.
- Failure evicts the cache entry and rejects its current waiters. Each current Visual retains its own failure diagnostic and old display. Failed Visuals do not automatically acquire again; assigning an equal failed source stays a no-op. Another new consumer can explicitly request the evicted URL again, but success does not silently clear a different Visual's recorded failure. Replace/remove each failed request as described above.

`PixiRenderer.diagnostics` is computed on demand:

| Field           | Meaning                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| presentations   | Live prepared/staged Scene presentations                                                 |
| visuals         | Live Visuals, including hidden ones or those awaiting their first image                  |
| textures        | Live owned image Texture objects (one TextureSource per successful load in this backend) |
| imageReferences | Pending acquisitions plus committed display leases; one replacing Visual can hold two    |
| imageEntries    | Unique loading/ready cache keys with consumers; failures are evicted                     |
| pendingImages   | Unique underlying loads with consumers, rather than number of Visual waiters             |

After normal Game disposal these counters are zero. An external/non-abortable loader can temporarily finish after cancellation; its late result is released. Counters do not measure native decoder/GPU memory, browser caches or prove leak freedom. Pool lookup occurs only when image requests change; diagnostics scans are not performed each render. The pinned Canvas2D backend can additionally cache tint-derived canvases per Texture/color. A single shared source does not imply a single physical allocation across every rendering path.

## Migration

- Renderable `{ shape: Shape.Triangle }` becomes `{ source: { kind: "shape", shape: Shape.Triangle } }`.
- `{ sprite: url, fit: SpriteFit.Stretch }` becomes `{ source: { kind: "image", url, fit: SpriteFit.Stretch } }`.
- Character's sprite option becomes the same source option; no source still selects Character geometry.
- Read source through its kind discriminator instead of view.sprite/shape/fit.
- Change properties in place instead of removing/re-adding Renderable and its dependents.
- Explicit image color is now tint instead of being ignored. Use white for the old untinted result.

## Image-game follow-up

Preserve immutable sources, Component identity, revision/no-op semantics, latest-generation checks, independent pending/committed leases, retained displays, presentation-scoped readiness and simulation independence. The current URL API needs no migration for sharing. The diagnostic schema adds imageReferences/imageEntries and changes pendingImages to count unique loads.

A future image-based game should exercise independent damage tint on shared sprites, bursts of enemies, sprite replacement during delayed/failed loads, scene handoff and repeated restart on real mobile devices. SpriteSheet frames and SpriteAnimation now build on this acquisition/release boundary; see [sprite contracts](sprites.md). Explicit preloading remains deferred. Do not add Material or general Asset management until a concrete game needs their contracts.

## Shared-image measurements

Baseline 7e288c7 versus shared-image runtime 88b6438; packages/ is unchanged relative to each commit. Node 24.22.1, Chromium 156.0.8078.4, Linux, INTEL(R) XEON(R) PLATINUM 8573C, Vite development serving, WebGL/SwiftShader, 1000×800 viewport/DPR1 and 720×540 canvas, 32×32 data SVGs. Three isolated alternating current/baseline pairs ran without other local tests/builds. Each process uses two warmups and five samples per workload. Values below are medians of the three run medians, before → after. Preparation awaits images; first render CPU submission, Actor creation, Scene disposal and Renderer disposal are separate in raw reports. No steady-state FPS, GPU time or native/GPU memory is measured.

| Workload              | Preparation ms | Image load/Texture/TextureSource count | Prepared JS heap increase KiB | Scene disposal ms |
| --------------------- | -------------- | -------------------------------------- | ----------------------------- | ----------------- |
| same image ×100       | 7.3 → 3.4      | 100 → 1                                | 411.5 → 342.8                 | 1.7 → 1.3         |
| same image ×1000      | 100.4 → 18.8   | 1000 → 1                               | 3711.3 → 2856.4               | 11.8 → 7.1        |
| different images ×100 | 8.6 → 10.1     | 100 → 100                              | 381.9 → 466.0                 | 1.9 → 3.1         |

The 1000-Actor case retains 1000 independent Sprite objects. The JS heap increase is forced-GC performance.memory after preparation/render minus before Actor creation: it includes model/host/tooling state and excludes native decoding/GPU allocations. Do not interpret it as total image memory or leak freedom. Load counts mean calls to the owned Image/Texture loader, not HTTP requests: a browser may separately cache SVG decoding or responses.

Twenty switches between two images kept alive by other Actors took 11.5→3.1ms, with 20→0 additional loads. Preparing a new 100-Actor Scene with the active Scene's image took 5.8→1.6ms and 100→0 additional loads. During overlap the shared runtime had 200 Sprites/leases and one Texture/TextureSource; after old Scene disposal it retained 100 leases and one resource. Independent Renderers each held one resource, and disposing one left the other usable. Every final reference/entry/Texture/presentation counter returned to zero.

The different-image case shows overhead rather than a sharing benefit: preparation 8.6→10.1ms, Scene disposal 1.9→3.1ms, and JS increase 381.9→466.0KiB. URL resolution, Maps, consumer handles/signals/promises add work per unique acquisition. Individual process results vary and sometimes reverse ordering; these measurements do not attribute the full difference to a single operation. Renderer/context teardown also fluctuated: for same-100 it was 142.0→159.7ms, for different-100 139.9→151.4ms. The cached-switch workload's context teardown was much slower in both versions (827.4→866.7ms); raw reports preserve these costs. Do not infer ordinary hardware GPU performance or that every operation became faster.

Raw comparisons: [before 1](../benchmarks/images/before-1.json), [after 1](../benchmarks/images/after-1.json), [before 2](../benchmarks/images/before-2.json), [after 2](../benchmarks/images/after-2.json), [before 3](../benchmarks/images/before-3.json), [after 3](../benchmarks/images/after-3.json).

```sh
CHROMIUM_PATH=/path/to/chrome-headless-shell npm run bench:images -- --out /tmp/images.json
```

For the baseline, use a detached worktree at 7e288c7, npm ci there, and run the current scripts/benchmark-images.mjs by absolute path from that worktree. No legacy API adapter is needed. The report records runtime commit/diff hash, environment, raw per-sample times, resource identity/counts and forced-GC heap observations. Run alone without tests/builds. The production site smoke also creates 100 shared-image Actors in the built Prism Raid bundle and checks independent red/blue pixels, surviving blue after one removal, final reference cleanup and Game disposal on WebGL and forced Canvas2D.

A separate isolated headless Prism Raid pair reproduced 60 wins, 172796 steps, 1439.97 simulated seconds, 1440 kills and the same 18774 created shots/enemies, in 4.920→4.717 seconds. [Before](../benchmarks/images/before-shooter.json) and [after](../benchmarks/images/after-shooter.json) include forced-GC observations. A single pair does not establish a simulation speedup; Core/Action/Random/Replay/fixed-step runtime code is unchanged. The Replay demo still JSON-roundtrips 2707 steps to the same win/3420 score.

## Historical live-update validation

Unit/type fixtures cover validated mutations, frozen source copies, semantic no-ops, unchanged dependencies/Scene structure and invalid API combinations. Browser pixel fixtures cover shapes, image multiplication, fit, depth, retained displays, reordered completions, failure/recovery and Actor/Component/Scene/Game disposal on WebGL and forced Canvas2D at desktop/narrow sizes. A gated acquired resource finishes after its successor to exercise stale-result release independently of successful network abortion.

The isolated comparison used baseline 3442f43 and the current runtime from 7098dcf, Node v24.22.1, Chromium 156.0.8078.4, linux, INTEL(R) XEON(R) PLATINUM 8573C, Vite development serving, WebGL/SwiftShader, 1000×800 DPR1. Three alternating baseline/current pairs ran alone without other local tests/builds. Each shape case warms 20 iterations and measures 100 iterations for 1000 Actors; image cases measure 20 replacements for 16 Actors. Thirty preparation/disposal cycles use 100 visuals. Timings include mutation and CPU submission; image cases include readiness, RAF yields are outside timing.

| Operation                         | Median of baseline p50 | Median of current p50 |
| --------------------------------- | ---------------------- | --------------------- |
| static                            | 0.30ms                 | 0.30ms                |
| color                             | 29.50ms                | 8.40ms                |
| dimensions                        | 32.10ms                | 8.80ms                |
| images                            | 2.40ms                 | 1.90ms                |
| 100-visual prepare/render/dispose | 3.50ms                 | 2.80ms                |

Baseline dynamic workloads use documented remove/add; current uses live setters. This compares practical operations, not identical renderer-only instructions. Baseline color/dimension cases created 100000 display objects each; current created zero. Image cases still loaded 320 resources in both versions, while new Sprite objects fell from 320 to zero. These historical results predate the shared-image implementation described above. All disposal counters returned to zero. Shared-host noise and coarse clocks affect tails; static/image/Scene differences do not establish a general speedup. No GPU time, native-memory usage or leak-freedom result is claimed.

Raw pairs: [before 1](../benchmarks/renderable/before-1.json), [after 1](../benchmarks/renderable/after-1.json), [before 2](../benchmarks/renderable/before-2.json), [after 2](../benchmarks/renderable/after-2.json), [before 3](../benchmarks/renderable/before-3.json), [after 3](../benchmarks/renderable/after-3.json).

A separate isolated Core pair measured the 1000-moving-Character step p50 at 0.0786→0.0800ms (5000 samples). Prism Raid reproduced 60 wins, 172796 steps and 1439.97 simulation seconds in 6.836→5.287s. This single pair does not establish a performance change. [Core before](../benchmarks/renderable/before-core.json), [Core after](../benchmarks/renderable/after-core.json), [shooter before](../benchmarks/renderable/before-shooter.json), [shooter after](../benchmarks/renderable/after-shooter.json) retain timing and GC observations; they do not measure rendering or GPU memory.


```sh
CHROMIUM_PATH=/path/to/chrome-headless-shell npm run bench:renderable -- --out /tmp/renderable.json
```

For the historical side, create a detached worktree at 3442f43, run npm ci there, and invoke the current benchmark script by absolute path from that worktree with `--legacy --out /tmp/before.json`. The legacy switch is benchmark-only, not a supported game API. Reports preserve source commits/runtime-diff hashes and raw samples.
