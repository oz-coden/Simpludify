# Sprite sheets and animation

SpriteSheet is immutable DOM-free metadata; SpriteAnimation is an Actor-owned playback Component. Web realizes frames using the existing Renderable image-sharing/readiness boundary. Import either API from `@simpludify/core` or `@simpludify/web`.

## Minimal animation

```ts verify
import { Character, Game, SpriteAnimation, SpriteSheet } from "@simpludify/web";
const sheet = SpriteSheet.grid("hero.png", { frameWidth: 32, frameHeight: 32 });
const game = new Game();
const actor = game.add(Character({ source: sheet.get(0) }));
const animation = actor.add(
  new SpriteAnimation({
    sheet,
    clips: {
      idle: { frames: [0, 1], fps: 4 },
      walk: { frames: [2, 3, 4, 5], fps: 8 },
      wave: { frames: [6, 7], frameSeconds: 0.2, loop: false },
    },
    initial: "idle",
    onComplete: (name) => console.log(name),
  }),
);
animation.play("walk");
await game.run();
```

Use an actual eight-cell image for this snippet. No per-frame Texture lookup or Renderable assignment is needed. An Actor composed manually must have Transform and Renderable before SpriteAnimation. Character's initial image source gives the existing default white tint. If adding animation to a placeholder Renderable, choose `color: 0xffffff` explicitly to avoid retaining its placeholder tint. Animation does not silently change appearance settings.

## Frames and coordinates

`SpriteSheet.grid(url, { frameWidth, frameHeight, names? })` splits the decoded image left to right, then top to bottom, starting at index 0. Dimensions are positive safe integers in natural decoded image pixels. Images must divide exactly into whole cells; partial edge cells are rejected. There is no margin or spacing option.

```ts verify
import { SpriteSheet } from "@simpludify/core";
const grid = SpriteSheet.grid("hero.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { idle: 0, walk: 2 },
});
grid.get("idle"); // named aliases infer without explicit generic arguments
grid.get(3);
const atlas = SpriteSheet.rects("atlas.png", {
  idle: { x: 0, y: 0, width: 24, height: 32 },
  face: { x: 40, y: 8, width: 16, height: 16 },
} as const);
atlas.get("face");
atlas.get(1); // object insertion order
const numbered = SpriteSheet.rects("atlas.png", [
  { x: 0, y: 0, width: 24, height: 32 },
]);
numbered.get(0);
```

Rectangles use a top-left origin, x right and y down. x/y are nonnegative safe integers, width/height positive safe integers. Overlapping rectangles are allowed; rotation/trim/pivot metadata is not supported. `count` is defined for rects and undefined for grid, whose image has not been decoded. Numeric indices are nonnegative safe integers. Unknown names/known rect indices fail synchronously. For a grid, the maximum index and image/rectangle bounds can only be checked once Web decodes the image. Only requested frames are checked against image dimensions; construction does not validate unused clips against an unloaded image.

`get()` returns a reusable frozen image source directly assignable to `Renderable.source`. It adds `frame?: SpriteFrame` to the existing image source. Direct frame descriptions can also use `{kind:"rect",x,y,width,height}` or `{kind:"grid",index,frameWidth,frameHeight}`. Renderable copies/validates/freezes frames; equal descriptions remain revision no-ops. Frame Contain/Stretch fitting uses the cropped dimensions. Actor position, radians rotation, scales, tint, opacity, visibility, size and depth retain their existing behavior.

Invalid definitions throw SPRITE_FRAME_INVALID; missing references and image-boundary mismatches throw SPRITE_FRAME_BOUNDS. Web reports a current invalid frame through onError and rejects `whenReady()`, retaining the previously committed display. Replace the source with a valid request to recover, including after the first frame failed. Failed candidate Scene preparation leaves the active Scene in place.

## Playback contract

Clip definitions contain a nonempty readonly `frames` array of sheet indices/names, either `fps` or `frameSeconds`, and `loop`. Defaults: 8fps, loop=true, first registered clip, immediately playing. Timing must be finite and positive, including finite total clip duration. Definitions and frame arrays are copied at construction; there is no mutable clip registry. Define the required clips together.

| Operation / observation              | Behavior                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `play(name)`                         | Different clip starts immediately at frame 0. Same playing or paused clip is a no-op, suitable for movement checks every step. Stopped/completed clips restart.          |
| `play(name, {restart:true})`         | Explicitly starts at frame 0, including the same clip.                                                                                                                   |
| `pause()` / `resume()`               | Pauses current time/frame; resume affects only paused playback.                                                                                                          |
| `stop()`                             | Stops and displays the selected clip's first frame; resets elapsed time, without completion notification.                                                                |
| `state`                              | playing, paused, stopped or completed.                                                                                                                                   |
| `current` / `frameIndex` / `elapsed` | Selected clip name, index within that clip, and elapsed simulation seconds (wrapped for loops, total duration on completion).                                            |
| one-shot completion                  | Last frame remains visible after its full interval; onComplete(name) fires once per playback, after state/source commit. It may start another clip or dispose the Actor. |

SpriteAnimation runs in LateUpdate and uses Engine delta in seconds, including fixed-step/replay stepping. Game pause and Actor/Component disabling freeze progress; enabled is separate from playback state. It does not use Pixi's ticker, RAF timestamps or host timers. A large delta skips directly to the resulting frame in bounded work; loops emit no catch-up callbacks, and one-shots complete once. Tiny floating-point boundary differences are tolerated. Web's existing maxDelta policy still caps/drops stalled host time.

A playing animation writes only `Renderable.source`. External tint, dimensions and other appearance changes remain intact. A manual source change during playback is replaced on the next animation update, even if that update remains in the same frame. Pause/stop/disable/remove the animation before manually controlling source. Paused/stopped/completed playback does not reassert source. Removing SpriteAnimation leaves the last source on Renderable; remove the Actor/Renderable or choose another source to release its image. Dependencies prevent removing Renderable while its animation remains attached. Disposal stops playback without completion and adds no host work/subscriptions to clean up.

Names infer from object keys, including clip names and optional named sheet frames. Use `as const` for separately declared readonly definitions. `SpriteClip` and `SpriteAnimationState` are exported. Unknown clip names, frame names, initial clips, timing alternatives and option types have compile-time fixtures. Missing names/invalid runtime values also throw SPRITE_CLIP_INVALID. Direct calls after disposal reject COMPONENT_DISPOSED. Completion callback errors follow ordinary synchronous Component update error handling; use synchronous callbacks.

## Shared resources

All full images and sheet frames for a resolved URL share one existing SharedImages entry/TextureSource per Renderer. Independent Actors retain their own Sprites, appearance and playback cursors. Frame changes retain the current image lease and make no acquisition/load. Crop Textures are cached by rectangle in the shared entry (equivalent grid/rect requests share). Sprite destruction never destroys the shared source. Final entry release destroys cached crop Textures without their source, then releases the base Texture/TextureSource exactly once. Pending consumers, stale generations and overlapping Scene presentations keep existing cancellation/readiness contracts.

Metadata alone owns no images and needs no disposal. Hidden/disabled Renderables retain image leases. Cached crops remain until the final image lease is released; continuously generating new rectangles on a permanently referenced image can grow that cache. Ordinary finite SpriteSheets bound it to the used rectangles. Diagnostics `textures` continues to count base image resources/TextureSources, not crop views or GPU bytes. Native/GPU retained memory, long mobile soaks and throughput have not been measured for this change.

## Executable example and checks

```sh
npm run dev -- --example sprites
npm run check:sprite-completions
npm run build -- --target web --example sprites --base /Simpludify/
```

[Sprite garden](../examples/sprites/README.md) supplies original MIT artwork, WASD idle/walk switching, an independently animated tinted friend, playback buttons and Scene round trips. No extra runtime dependency or editor is required. See `tests/unit/sprite-sheet.test.ts`, `tests/unit/sprite-animation.test.ts`, `tests/types/sprites.ts`, and `tests/browser/sprites.spec.ts`. Browser fixtures check actual crop pixels, changing frames, Contain/Stretch/Transform, independent playback, one underlying load, crop/source destruction, invalid-bound recovery, late loads, pending disposal and repeated transitions on WebGL/forced Canvas2D at desktop/narrow sizes.

Not included: atlas file parsers, per-frame durations, trimming/rotation metadata, preload handles, animation GUI, generic state machines/control rights, tilemaps or renderer redesign. Choose clips using normal game code.
