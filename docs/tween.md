# Tween and animation

Tween interpolates **numbers** using explicit seconds. Core contains recipes, easing, playback and schedulers; it has no renderer, browser clock or DOM dependency. Actor, Canvas UI and application records use the same machinery. Try the [Tween lab](../examples/tween/README.md).

## Start with a Scene clock

```ts
import { Tween, Easing } from "@simpludify/web";
const state = { intensity: 0 };
const playback = scene.tweens.play(
  Tween.to(Tween.property(state, "intensity"), 1, {
    duration: 0.4,
    easing: Easing.OutCubic,
  }),
  { owner: scene, onComplete: () => console.log(state.intensity) },
);
playback.pause();
playback.resume();
```

`Tween.property(record, key)` accepts writable own numeric data properties on plain objects. Readonly fields, accessors and class instances require an explicit adapter rather than implicit reflection. Finite start/end values and nonnegative finite duration/delay are required. No string, vector or color coercion is performed.

`scene.tweens` uses simulation seconds, after post-update contacts and before timers. Eligibility is captured before input callbacks, so work started during a step begins on the next step. Engine pause stops this clock. `scene.presentationTweens` uses visible display-frame seconds and continues during simulation pause. Web supplies the existing capped delta; resize/layout does not advance time, and hidden/resumed frames do not catch up missed wall time. Game and SceneContext expose the same two clocks. Display animation is not replay state. SpriteAnimation continues to select image frames in LateUpdate, using simulation time; it can coexist with numeric draw-property Tween.

For headless/custom hosts, create `new TweenScheduler({ owner, scope })` and call `advance(seconds)`. Scene-based hosts call `scene.advancePresentation(seconds)` once per display frame. Do not advance the Web-managed clock a second time. Scheduler `speed` is finite and nonnegative (default 1); zero freezes elapsed time. Explicit identical update inputs produce identical numeric outputs; arbitrary user easing/setters remain the caller's responsibility.

## Playback and easing

`play(recipe, { owner?, conflict?, onComplete?, onCancel? })` returns a Playback with `state`, `elapsed`, `duration` and cancellation `reason`.

| Operation              | Meaning                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `pause()` / `resume()` | Retain current value and channel ownership; freeze/resume elapsed time |
| `cancel()`             | Retain current value; release ownership; notify cancellation once      |
| `stop()`               | Cancel with reason `stopped`; does not rewind                          |
| `finish()`             | Apply finite terminal state and complete once; infinite recipes reject |
| Scheduler `dispose()`  | Cancel live work and release all subscriptions/claims                  |

A fresh `play` starts a recipe; terminal handles cannot restart. Zero-duration work executes on the next advance or explicit finish, not inside play. `repeat` is the number of **additional** iterations (nonnegative integer or Infinity). `yoyo: true` alternates directions. Delay precedes the leaf's playback once. Infinite zero-duration repetition rejects. Large elapsed intervals use bounded arithmetic; no callback fires per skipped cycle.

`Easing.Linear`, `InQuad`, `OutQuad`, `InOutQuad`, `InCubic`, `OutCubic`, `InOutCubic` are functions. Supply a custom synchronous `(progress: number) => number` for other curves. Endpoints remain exact. Custom easing must return a finite normalized value (0–1); overshoot curves are not supported in this numeric revision. Opacity adapters also require 0–1.

Callbacks/hooks are synchronous. Returning a Promise is diagnosed; there is no asynchronous completion API. Callback/setter failures cancel and release affected work and are aggregated after other eligible work. Terminal cleanup precedes notification; callback-created work waits for a new update boundary. Recursive advance/finish is rejected.

## Ownership and competing writes

Scene clocks cancel on Scene disposal. Actor bindings own their Renderable; Canvas bindings own their node. Optional playback owners add another cancellation lifetime. Removing/replacing a Renderable, destroying an Actor or removing/disposing UI cancels associated work. Adapter scope prevents moving Scene-bound capabilities to another Scene's clock. Completed/canceled handles do not retain target references, scheduler entries or owner subscriptions.

Each binding reserves a canonical target/key channel across schedulers. Default `conflict: "replace"` cancels the entire overlapping playback before the newer one runs. `conflict: "error"` rejects atomically. Paused and future sequence channels remain reserved. Additive blending is not implemented. A newer reentrant write/play intent wins.

External changes are checked before writes and cancel with `external-write`. Slider explicit intent is also observed immediately, including equal program writes, edit start and range changes. Ordinary records cannot detect an external write that restores exactly the previous value before the next advance. For external resources, use `Tween.bind({ target, key, read, write, owner?, scope?, valid?, validate?, stamp?, watch? })`: provide finite numeric reads, synchronous safe writes, canonical identities and appropriate invalidation. A setter that returns `false` rejects its write. Custom bindings grant explicit authority; the engine cannot make arbitrary setters transactional or undo their side effects.

## Actors: draw state and physics

```ts
import { actorTween, Tween } from "@simpludify/web";
scene.tweens.play(
  Tween.parallel(
    Tween.to(actorTween(actor).offsetX, 120, { duration: 0.6 }),
    Tween.to(actorTween(actor).rotation, Math.PI, { duration: 0.6 }),
    Tween.to(actorTween(actor).opacity, 0.3, { duration: 0.6 }),
  ),
);
```

`actorTween` exposes Renderable `offsetX`, `offsetY`, relative `rotation` (radians), `scaleX`, `scaleY` and `opacity`. Defaults are 0/0/0/1/1/1. Draw offsets use world axes and do not rotate with the Actor. Scaling/rotation compose with Transform and image fit. These affect drawing only: Transform, Motion, Body, Collider and contacts stay authoritative. An offset sprite does not move its collision body. Use Motion or explicit gameplay commands for physical movement; do not bind a competing Tween to world position. SpriteAnimation retains source/frame responsibility.

## Canvas UI: layout and display

```ts
import { canvasTween, Tween } from "@simpludify/web";
panel.setPresentation({ offsetX: 60, opacity: 0 });
scene.presentationTweens.play(
  Tween.parallel(
    Tween.to(canvasTween(panel).offsetX, 0, { duration: 0.4 }),
    Tween.to(canvasTween(panel).opacity, 1, { duration: 0.4 }),
  ),
);
```

`node.presentation` is a readonly offsetX/offsetY/opacity snapshot. `setPresentation` validates finite offsets and opacity 0–1. Presentation is independent of Flex style; translations reproject cached bounds without remeasuring layout. Descendants, hit tests, clipping, native editors and focus geometry use the same projected bounds. Offsets do not change sibling allocation or scroll content size. Existing clips still apply. Opacity multiplies through ancestors; zero opacity removes input/focus availability but permits program animation to fade in. Translation/opacity work with UI scale; per-node presentation scale, rotation and color interpolation are not exposed.

## Slider: logical value or display value

```ts
import { sliderTween, Tween } from "@simpludify/web";
// Logical changes: onChange source=program; no user commit.
scene.presentationTweens.play(
  Tween.to(sliderTween(volume), 80, { duration: 0.5 }),
);

// Immediate logical HP; smoothly catching-up read-only bar.
const shown = hp.displayValue;
hp.value = 75;
hp.displayValue = shown;
scene.presentationTweens.play(
  Tween.to(sliderTween(hp, "display"), hp.value, {
    duration: 0.7,
  }),
);
```

Logical values retain existing step/range normalization. `displayValue` is a continuous clamped numeric bar value; labels, accessible values, keyboard/pointer editing and `value` remain logical. Display-only updates emit no value event. Logical and display Tweens share one ownership channel. User pointer/edit start or keyboard change cancels animation; program commands (including equal value), range/readOnly updates, structural hide/disable and disposal also cancel. Authoritative input restores display to logical value. Read-only controls allow explicit program animation. A parent fading from zero does not prevent program animation, while hidden/disabled structures do.

When synchronizing Slider and NumberInput, share the logical value through source-aware onChange handlers; equality checks avoid event loops. A bar animation must not write back an intermediate display value as game state.

## Composition

```ts
scene.presentationTweens.play(
  Tween.sequence(
    Tween.parallel(
      Tween.to(canvasTween(panel).offsetX, 0, { duration: 0.4 }),
      Tween.to(canvasTween(panel).opacity, 1, { duration: 0.3 }),
    ),
    Tween.delay(0.2),
    Tween.to(canvasTween(panel).opacity, 0.5, { duration: 0.3 }),
  ),
);
```

Sequences preserve leftover elapsed time across children and capture implicit starts when each child begins. Parallel children start together. A sequence may reuse a channel; any same-channel parallel overlap rejects, even if delayed. Canceling/replacing/invalidating any child channel cancels the entire composition. Leaf repeat/yoyo is supported; repeating a whole composite and timeline editing are deferred. Definitions are immutable, reusable and bounded to 4,096 nodes / depth 64.

## Validation limits

The sample uses only engine APIs. Automated Chromium tests cover both Pixi WebGL and Canvas2D, desktop/narrow input/rendering, native editor geometry, Slider drag and disposal; see the work report for executed results. Actual OS Japanese IME and physical mobile keyboards require device verification; synthetic composition events are not that guarantee. No universal FPS, GPU/native-memory, physics tween or Unicode shaping guarantee is added by Tween.

## Complete standalone example

```ts verify
import {
  Actor,
  Transform,
  Renderable,
  Scene,
  Engine,
  Tween,
  Easing,
  actorTween,
  CanvasColumn,
  CanvasSlider,
  CanvasUI,
  canvasTween,
  sliderTween,
} from "@simpludify/core";
const engine = new Engine();
const scene = engine.scene;
const actor = scene.add(new Actor());
actor.add(new Transform({ x: 20, y: 20 }));
actor.add(new Renderable({ width: 16, height: 16 }));
const hp = CanvasSlider({ value: 100, readOnly: true });
const panel = CanvasColumn([hp]);
const ui = new CanvasUI(scene, panel);
const state = { intensity: 0 };
scene.tweens.play(
  Tween.parallel(
    Tween.to(actorTween(actor).offsetX, 50, {
      duration: 1,
      easing: Easing.OutCubic,
    }),
    Tween.to(Tween.property(state, "intensity"), 1, { duration: 1 }),
  ),
);
panel.setPresentation({ offsetX: 30 });
scene.presentationTweens.play(
  Tween.sequence(
    Tween.to(canvasTween(panel).offsetX, 0, { duration: 0.3 }),
    Tween.delay(0.1),
    Tween.to(sliderTween(hp, "display"), 75, { duration: 0.5 }),
  ),
);
engine.step(0.25);
scene.advancePresentation(0.25);
ui.dispose();
engine.dispose();
```
