import { Actor, Renderable, Shape, Transform } from "@simpludify/web";
import type { Sprite } from "pixi.js";
import { fixture, imageURL } from "./renderable-fixture";

function add(
  game: Awaited<ReturnType<typeof fixture>>["game"],
  url: string,
  x = 200,
) {
  const actor = game.add(new Actor());
  actor.add(new Transform({ x, y: 150 }));
  const view = actor.add(
    new Renderable({ source: { kind: "image", url }, width: 80, height: 40 }),
  );
  return { actor, view };
}
const frame = () => new Promise(requestAnimationFrame);
const displays = (f: Awaited<ReturnType<typeof fixture>>) =>
  f.internal.app.stage.children[0]?.children[0]?.children as Sprite[];

export async function hundred() {
  const f = await fixture();
  f.actor.dispose();
  let loads = 0;
  const load = f.internal.image.bind(f.internal);
  f.internal.image = (...args) => {
    loads++;
    return load(...args);
  };
  const rows = Array.from({ length: 100 }, (_, i) =>
    add(f.game, imageURL("white"), i === 0 ? 100 : i === 1 ? 300 : 1000),
  );
  const a = rows[0],
    b = rows[1];
  if (!a || !b) throw new Error("Missing actors");
  a.view.color = 0xff0000;
  b.view.color = 0x0000ff;
  await f.game.whenReady();
  const before = f.renderer.diagnostics;
  const sprites = displays(f),
    texture = sprites[0]?.texture;
  if (!texture) throw new Error("Missing texture");
  const source = texture.source;
  const uniqueTextures = new Set(sprites.map((s) => s.texture)).size;
  const uniqueSources = new Set(sprites.map((s) => s.texture.source)).size;
  const red = f.pixel(100, 150),
    blue = f.pixel(300, 150);
  a.view.width = 120;
  a.view.opacity = 0.5;
  a.view.visible = false;
  a.view.zIndex = 7;
  await f.game.whenReady();
  const independent = f.pixel(300, 150);
  a.view.visible = true;
  a.view.opacity = 1;
  a.view.color = 0xffffff;
  a.view.source = { kind: "image", url: imageURL("cyan") };
  await f.game.whenReady();
  const replaced = f.pixel(100, 150),
    otherAfterReplace = f.pixel(300, 150);
  a.view.source = { kind: "shape", shape: Shape.Box };
  f.pixel();
  const sharedAfterShape = f.renderer.diagnostics.textures;
  a.actor.dispose();
  const survivor = f.pixel(300, 150);
  const aliveAfterOne = !texture.destroyed && !source.destroyed;
  for (const row of rows.slice(2)) row.actor.dispose();
  b.view.visible = false;
  f.pixel();
  const hiddenHeld = f.renderer.diagnostics.imageReferences;
  b.view.visible = true;
  b.view.source = { kind: "shape", shape: Shape.Box };
  f.pixel();
  const released = texture.destroyed && source.destroyed;
  const afterLast = f.renderer.diagnostics;
  b.view.source = { kind: "image", url: imageURL("white") };
  await f.game.whenReady();
  const reloaded = loads;
  f.game.dispose();
  return {
    before,
    uniqueTextures,
    uniqueSources,
    red,
    blue,
    independent,
    replaced,
    otherAfterReplace,
    sharedAfterShape,
    survivor,
    aliveAfterOne,
    hiddenHeld,
    released,
    afterLast,
    reloaded,
    disposed: f.renderer.diagnostics,
  };
}

export async function pending() {
  const f = await fixture();
  f.actor.dispose();
  const load = f.internal.image.bind(f.internal);
  const gates: Array<() => void> = [],
    signals: AbortSignal[] = [];
  f.internal.image = async (url, signal) => {
    signals.push(signal);
    await new Promise<void>((resolve) => gates.push(resolve));
    // Deliberately ignore cancellation to exercise a non-abortable late decoder.
    return load(url, new AbortController().signal);
  };
  const a = add(f.game, imageURL("lime"), 100),
    b = add(f.game, imageURL("lime"), 300);
  const waiting = f.game.whenReady();
  while (gates.length < 1) await frame();
  const during = f.renderer.diagnostics;
  a.actor.dispose();
  const oneCancelled = signals[0]?.aborted === false;
  gates[0]?.();
  await waiting;
  const survivor = f.pixel(300, 150);
  b.actor.dispose();
  const c = add(f.game, imageURL("blue"));
  const removed = f.game.whenReady();
  while (gates.length < 2) await frame();
  c.actor.remove(Renderable.type);
  await removed;
  const lastCancelled = signals[1]?.aborted === true;
  const d = add(f.game, imageURL("blue"));
  const replacement = f.game.whenReady();
  while (gates.length < 3) await frame();
  gates[2]?.();
  await replacement;
  const latest = f.pixel();
  gates[1]?.();
  await frame();
  await frame();
  const afterLate = f.pixel(),
    counts = f.renderer.diagnostics;
  d.actor.dispose();
  f.game.dispose();
  return {
    during,
    oneCancelled,
    survivor,
    lastCancelled,
    latest,
    afterLate,
    counts,
    disposed: f.renderer.diagnostics,
  };
}

export async function scenes() {
  const f = await fixture();
  f.actor.dispose();
  const load = f.internal.image.bind(f.internal);
  let loads = 0;
  f.internal.image = (...args) => {
    loads++;
    return load(...args);
  };
  add(f.game, imageURL("cyan"));
  await f.game.whenReady();
  const texture = displays(f)[0]?.texture;
  f.game.scene("shared", ({ add }) => {
    const actor = add(new Actor());
    actor.add(new Transform({ x: 200, y: 150 }));
    actor.add(
      new Renderable({ source: { kind: "image", url: imageURL("cyan") } }),
    );
  });
  await f.game.goTo("shared");
  const success = f.pixel(),
    sameTexture = displays(f)[0]?.texture === texture;
  const loadsAfterTransition = loads;
  let stagedReferences = 0;
  f.internal.image = (...args) => {
    stagedReferences = f.renderer.diagnostics.imageReferences;
    return load(...args);
  };
  f.game.scene("broken", ({ add }) => {
    for (const url of [
      imageURL("cyan"),
      "./missing-shared.png",
      "./never-shared.svg",
    ]) {
      const actor = add(new Actor());
      actor.add(new Transform());
      actor.add(new Renderable({ source: { kind: "image", url } }));
    }
  });
  let failure = "";
  try {
    await f.game.goTo("broken");
  } catch (e) {
    failure = (e as { code: string }).code;
  }
  const retained = f.pixel(),
    afterFailure = f.renderer.diagnostics;
  const textureAlive = texture?.destroyed === false;
  f.game.dispose();
  return {
    success,
    sameTexture,
    loadsAfterTransition,
    stagedReferences,
    failure,
    retained,
    afterFailure,
    textureAlive,
    disposed: f.renderer.diagnostics,
  };
}

export async function independentGames() {
  const a = await fixture(),
    b = await fixture();
  a.actor.dispose();
  b.actor.dispose();
  const first = add(a.game, imageURL("yellow"));
  add(b.game, imageURL("yellow"));
  await Promise.all([a.game.whenReady(), b.game.whenReady()]);
  const ta = displays(a)[0]?.texture,
    tb = displays(b)[0]?.texture;
  const independent = !!ta && !!tb && ta !== tb && ta.source !== tb.source;
  const before = [a.renderer.diagnostics, b.renderer.diagnostics];
  first.actor.dispose();
  a.game.dispose();
  const survivor = b.pixel(),
    alive = tb?.destroyed === false;
  b.game.dispose();
  return {
    independent,
    before,
    survivor,
    alive,
    disposed: [a.renderer.diagnostics, b.renderer.diagnostics],
  };
}

export async function keysAndFailures() {
  const f = await fixture();
  f.actor.dispose();
  const load = f.internal.image.bind(f.internal),
    urls: string[] = [];
  f.internal.image = (url, signal) => {
    urls.push(url);
    return load(url, signal);
  };
  const relative = "./shared-key.svg",
    absolute = new URL(relative, document.baseURI).href;
  const rows = [
    add(f.game, relative),
    add(f.game, absolute),
    add(f.game, `${absolute}?v=1`),
    add(f.game, `${absolute}#frame`),
  ];
  await f.game.whenReady();
  const keyLoads = urls.length,
    keyCounts = f.renderer.diagnostics;
  for (const row of rows) row.actor.dispose();
  const bad1 = add(f.game, "./missing-shared.png"),
    bad2 = add(f.game, "./missing-shared.png");
  const waits = await Promise.allSettled([
    f.game.whenReady(),
    f.game.whenReady(),
  ]);
  const failures = waits.map((r) =>
    r.status === "rejected" ? (r.reason as { code: string }).code : "ready",
  );
  const failedCounts = f.renderer.diagnostics;
  const requests = urls.length;
  bad1.view.source = { kind: "image", url: "./missing-shared.png" };
  try {
    await f.game.whenReady();
  } catch {}
  const noRetry = urls.length === requests;
  bad1.view.source = { kind: "image", url: imageURL("red") };
  bad2.view.source = { kind: "image", url: imageURL("red") };
  await f.game.whenReady();
  const recovered = f.pixel(),
    recoveredCounts = f.renderer.diagnostics;
  // Removing a failed cohort permits a fresh explicit request to the same key.
  bad1.view.source = { kind: "image", url: "./missing-shared.png" };
  try {
    await f.game.whenReady();
  } catch {}
  const retried = urls.length === requests + 2;
  const oldRetained = f.pixel();
  f.game.dispose();
  return {
    keyLoads,
    keyCounts,
    failures,
    failedCounts,
    noRetry,
    recovered,
    recoveredCounts,
    retried,
    oldRetained,
    disposed: f.renderer.diagnostics,
  };
}
