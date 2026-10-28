import {
  Actor,
  type Game,
  Renderable,
  SpriteAnimation,
  SpriteFit,
  SpriteSheet,
  Transform,
} from "@simpludify/web";
import type { Sprite } from "pixi.js";
import { fixture } from "./renderable-fixture";

const colors = [
  "red",
  "blue",
  "lime",
  "yellow",
  "cyan",
  "magenta",
  "white",
  "orange",
];
const url = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32">${colors.map((c, i) => `<rect x="${(i % 4) * 16}" y="${Math.floor(i / 4) * 16}" width="16" height="16" fill="${c}"/>`).join("")}</svg>`)}`;
const sheet = SpriteSheet.grid(url, { frameWidth: 16, frameHeight: 16 });
const clips = {
  idle: { frames: [0, 1, 2, 3], fps: 4 },
  once: { frames: [4, 5], fps: 2, loop: false },
} as const;
const frame = () => new Promise(requestAnimationFrame);
function spawn(game: Awaited<ReturnType<typeof fixture>>["game"], x = 100) {
  const actor = game.add(new Actor());
  actor.add(new Transform({ x, y: 150 }));
  actor.add(new Renderable({ source: sheet.get(0), width: 80, height: 40 }));
  const animation = actor.add(new SpriteAnimation({ sheet, clips }));
  return { actor, animation };
}
export async function pixels() {
  const f = await fixture();
  let loads = 0;
  const load = f.internal.image.bind(f.internal);
  f.internal.image = (...args) => {
    loads++;
    return load(...args);
  };
  f.view.source = sheet.get(0);
  f.view.color = 0xffffff;
  const a = f.actor.add(new SpriteAnimation({ sheet, clips }));
  const b = spawn(f.game);
  b.animation.pause();
  await f.game.whenReady();
  const red = f.pixel(),
    original = f.display() as Sprite;
  const texture = original.texture,
    source = texture.source;
  const sharedFrame =
    (
      f.internal.app.stage.children[0]?.children[0]?.children[1] as
        | Sprite
        | undefined
    )?.texture === texture;
  f.game.engine.step(0.25);
  await f.game.whenReady();
  const blue = f.pixel(),
    independent = f.pixel(100, 150);
  f.view.width = 100;
  f.view.opacity = 0.5;
  f.view.color = 0x8080ff;
  f.game.engine.step(0.25);
  await f.game.whenReady();
  const retainedAppearance =
    f.view.width === 100 && f.view.opacity === 0.5 && f.view.color === 0x8080ff;
  const sameSprite = f.display() === original;
  f.view.opacity = 1;
  f.view.color = 0xffffff;
  a.play("once");
  f.game.engine.step(100);
  await f.game.whenReady();
  const last = f.pixel(),
    completed = a.state;
  a.stop();
  a.pause(); // stop resets first frame; pause of a stopped clip is a no-op
  const atlas = SpriteSheet.rects(url, {
    wide: { x: 16, y: 0, width: 32, height: 16 },
  });
  f.view.width = 80;
  f.view.height = 80;
  f.view.source = atlas.get("wide");
  await f.game.whenReady();
  const rectBlue = f.pixel(180, 150),
    rectGreen = f.pixel(220, 150),
    contain = f.pixel(200, 115);
  f.view.source = { ...atlas.get("wide"), fit: SpriteFit.Stretch };
  await f.game.whenReady();
  const stretch = f.pixel(180, 115);
  const t = f.actor.require(Transform.type);
  t.x = 250;
  t.rotation = Math.PI / 2;
  t.scaleX = 0.5;
  await f.game.whenReady();
  const transformed = {
    x: original.x,
    rotation: original.rotation,
    scale: original.scale.x,
  };
  f.actor.dispose();
  const alive = !texture.destroyed && !source.destroyed;
  b.actor.dispose();
  const freed = texture.destroyed && source.destroyed;
  const afterLast = f.renderer.diagnostics;
  f.game.dispose();
  return {
    red,
    blue,
    independent,
    sharedFrame,
    sameSprite,
    retainedAppearance,
    last,
    completed,
    rectBlue,
    rectGreen,
    contain,
    stretch,
    transformed,
    loads,
    alive,
    freed,
    afterLast,
    errors: f.errors,
    disposed: f.renderer.diagnostics,
  };
}
export async function invalid() {
  const f = await fixture();
  f.view.color = 0xffffff;
  f.view.source = sheet.get(1);
  await f.game.whenReady();
  f.view.source = sheet.get(99);
  let error = "";
  try {
    await f.game.whenReady();
  } catch (e) {
    error = (e as { code: string }).code;
  }
  const retained = f.pixel();
  f.view.source = sheet.get(2);
  await f.game.whenReady();
  const recovered = f.pixel();
  f.view.source = SpriteSheet.grid(url, {
    frameWidth: 17,
    frameHeight: 16,
  }).get(0);
  let mismatch = "";
  try {
    await f.game.whenReady();
  } catch (e) {
    mismatch = (e as { code: string }).code;
  }
  const stillGreen = f.pixel();
  const other = SpriteSheet.grid(`${url}#other`, {
    frameWidth: 16,
    frameHeight: 16,
  });
  f.view.source = other.get(99);
  try {
    await f.game.whenReady();
  } catch {
    /* Retain a different image's lease. */
  }
  f.view.source = other.get(3);
  await f.game.whenReady();
  const replacementRecovery = f.pixel();
  f.game.dispose();
  const g = await fixture();
  g.view.source = sheet.get(99);
  try {
    await g.game.whenReady();
  } catch {
    /* No frame has committed yet. */
  }
  g.view.color = 0xffffff;
  g.view.source = sheet.get(1);
  await g.game.whenReady();
  const initialRecovery = g.pixel();
  g.game.dispose();
  return {
    error,
    retained,
    recovered,
    mismatch,
    stillGreen,
    initialRecovery,
    replacementRecovery,
    disposed: g.renderer.diagnostics,
  };
}
export async function pending() {
  const f = await fixture();
  f.actor.dispose();
  const load = f.internal.image.bind(f.internal);
  const gates: Array<() => void> = [],
    signals: AbortSignal[] = [];
  let completions = 0;
  f.internal.image = async (url, signal) => {
    signals.push(signal);
    await new Promise<void>((resolve) => gates.push(resolve));
    const result = await load(url, new AbortController().signal);
    completions++;
    return result;
  };
  const a = spawn(f.game, 100),
    b = spawn(f.game, 200);
  const waiting = f.game.whenReady();
  while (gates.length < 1) await frame();
  a.actor.dispose();
  const sharedContinues = signals[0]?.aborted === false;
  // Change frames while the source is loading. Only the latest one may commit.
  f.game.engine.step(0.25);
  gates[0]?.();
  await waiting;
  const latest = f.pixel();
  b.actor.dispose();
  const c = spawn(f.game, 200);
  const removed = f.game.whenReady();
  while (gates.length < 2) await frame();
  c.actor.dispose();
  await removed;
  const cancelled = signals[1]?.aborted === true;
  const d = spawn(f.game, 200);
  const replacement = f.game.whenReady();
  while (gates.length < 3) await frame();
  gates[2]?.();
  await replacement;
  const current = f.pixel();
  gates[1]?.();
  while (completions < 3) await frame();
  await frame();
  const afterLate = f.pixel();
  const references = f.renderer.diagnostics.imageReferences;
  d.actor.dispose();
  spawn(f.game);
  const disposedWait = f.game.whenReady().then(
    () => "unexpected",
    (e: { code: string }) => e.code,
  );
  while (gates.length < 4) await frame();
  f.game.dispose();
  const disposedError = await disposedWait;
  gates[3]?.();
  while (completions < 4) await frame();
  await frame();
  return {
    sharedContinues,
    latest,
    cancelled,
    current,
    afterLate,
    references,
    disposedError,
    disposed: f.renderer.diagnostics,
    errors: f.errors,
  };
}
export async function scenes() {
  const f = await fixture();
  f.actor.dispose();
  let loads = 0;
  const load = f.internal.image.bind(f.internal);
  f.internal.image = (...args) => {
    loads++;
    return load(...args);
  };
  const animations: SpriteAnimation<"idle" | "once">[] = [];
  for (const id of ["shared", "broken"] as const)
    f.game.scene(id, ({ add }) => {
      const actor = add(new Actor());
      actor.add(new Transform({ x: 200, y: 150 }));
      actor.add(new Renderable({ source: sheet.get(0), color: 0xffffff }));
      animations.push(actor.add(new SpriteAnimation({ sheet, clips })));
    });
  await f.game.goTo("shared");
  const first = (f.display() as Sprite).texture,
    source = first.source;
  for (let i = 0; i < 8; i++) await f.game.goTo(i % 2 ? "shared" : "broken");
  const overlapLoads = loads,
    sharedAlive = !first.destroyed && !source.destroyed;
  const oldStopped = animations
    .slice(0, -1)
    .every((a) => a.disposed && a.state === "stopped");
  f.game.engine.step(0.25);
  await f.game.whenReady();
  const blue = f.pixel();
  await f.game.goTo("empty");
  const released = first.destroyed && source.destroyed;
  await f.game.goTo("shared");
  f.game.engine.step(0.5);
  await f.game.whenReady();
  const green = f.pixel();
  const reloaded = loads;
  f.game.dispose();
  return {
    overlapLoads,
    sharedAlive,
    oldStopped,
    blue,
    released,
    green,
    reloaded,
    disposed: f.renderer.diagnostics,
    errors: f.errors,
  };
}

export function sampleState<Id extends string>(game: Game<Id>) {
  const player = game.engine.scene.actors.find((a) => a.id === "sprite-player");
  return {
    x: player?.require(Transform.type).x,
    current: player?.require(SpriteAnimation.type).current,
    frame: player?.require(SpriteAnimation.type).frameIndex,
    actors: game.engine.scene.actors.length,
  };
}
