import {
  Actor,
  Grid,
  Renderable,
  SpriteSheet,
  Tilemap,
  Transform,
} from "@simpludify/web";
import type { Container, Sprite } from "pixi.js";
import { fixture } from "./renderable-fixture";

const url = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><path fill="red" d="M0 0h16v16H0z"/><path fill="blue" d="M16 0h16v16H16z"/></svg>')}`;
const sheet = SpriteSheet.grid(url, {
  frameWidth: 16,
  frameHeight: 16,
  names: { red: 0, blue: 1 },
});
const frame = () => new Promise(requestAnimationFrame);
export async function tiles() {
  const f = await fixture();
  f.actor.dispose();
  let loads = 0;
  const load = f.internal.image.bind(f.internal);
  f.internal.image = (...args) => {
    loads++;
    return load(...args);
  };
  const data = new Grid<number | null>(100, 100, 0);
  const ground = new Tilemap({
    sheet,
    tiles: data,
    tileWidth: 20,
    tileHeight: 10,
    x: 0,
    y: 0,
  }).place(f.game.engine.scene);
  const upper = new Tilemap({
    sheet,
    tiles: [["blue", null]],
    tileWidth: 20,
    tileHeight: 10,
    x: 20,
    y: 10,
    zIndex: 2,
  }).place(f.game.engine.scene);
  const actor = f.game.add(new Actor());
  actor.add(new Transform({ x: 30, y: 15 }));
  const view = actor.add(
    new Renderable({ width: 20, height: 10, color: 0x00ff00, zIndex: 1 }),
  );
  await f.game.whenReady();
  const blue = f.pixel(30, 15),
    red = f.pixel(10, 5),
    before = f.renderer.tilemapDiagnostics;
  f.pixel(10, 5);
  const unchanged =
    f.renderer.tilemapDiagnostics.visitedCells - before.visitedCells;
  view.zIndex = 3;
  await f.game.whenReady();
  const green = f.pixel(30, 15);
  view.visible = false;
  upper.visible = false;
  ground.set(0, 0, "blue");
  const pre = f.renderer.tilemapDiagnostics;
  await f.game.whenReady();
  const edited = f.pixel(10, 5);
  const post = f.renderer.tilemapDiagnostics;
  ground.set(80, 80, "blue");
  const off = f.renderer.tilemapDiagnostics.visitedCells;
  f.pixel(10, 5);
  const offscreen = f.renderer.tilemapDiagnostics.visitedCells - off;
  data.set(0, 0, null);
  const copied = ground.get(0, 0);
  f.game.camera.x = 1600;
  f.game.camera.y = 800;
  f.game.setViewport();
  const moved = f.pixel(1610, 805);
  ground.fill(null);
  await f.game.whenReady();
  const empty = f.pixel(1610, 805);
  const spriteCount = f.renderer.tilemapDiagnostics.sprites;
  upper.visible = true;
  f.game.camera.x = 0;
  f.game.camera.y = 0;
  f.game.element.style.height = "320px";
  f.game.setViewport();
  await f.game.whenReady();
  const resized = f.pixel(30, 15);
  const counts = f.renderer.diagnostics;
  ground.dispose();
  upper.dispose();
  actor.dispose();
  const after = f.renderer.diagnostics,
    tilesAfter = f.renderer.tilemapDiagnostics;
  f.game.dispose();
  return {
    blue,
    red,
    green,
    edited,
    moved,
    empty,
    resized,
    unchanged,
    offscreen,
    copied,
    visits: post.visitedCells - pre.visitedCells,
    updates: post.updatedTiles - pre.updatedTiles,
    before,
    spriteCount,
    loads,
    counts,
    after,
    tilesAfter,
    errors: f.errors,
  };
}
export async function lifecycle() {
  const f = await fixture();
  f.actor.dispose();
  let loads = 0;
  const load = f.internal.image.bind(f.internal);
  f.internal.image = (...args) => {
    loads++;
    return load(...args);
  };
  const maps: Tilemap<"red" | "blue">[] = [];
  for (const id of ["shared", "broken"] as const)
    f.game.scene(id, ({ scene }) => {
      maps.push(
        new Tilemap({
          sheet,
          tiles: [[0, 1]],
          tileWidth: 20,
          tileHeight: 20,
          x: 190,
          y: 140,
        }).place(scene),
      );
    });
  await f.game.goTo("shared");
  for (let i = 0; i < 8; i++) await f.game.goTo(i % 2 ? "shared" : "broken");
  const pixel = f.pixel(200, 150),
    oldDisposed = maps.slice(0, -1).every((m) => m.disposed),
    sharedLoads = loads;
  await f.game.goTo("empty");
  const released = f.renderer.diagnostics;
  await f.game.goTo("shared");
  const reloaded = loads;
  f.game.dispose();
  return {
    pixel,
    oldDisposed,
    sharedLoads,
    reloaded,
    released,
    after: f.renderer.diagnostics,
    tileAfter: f.renderer.tilemapDiagnostics,
    errors: f.errors,
  };
}
export async function pending() {
  const f = await fixture();
  f.actor.dispose();
  const load = f.internal.image.bind(f.internal);
  const gates: (() => void)[] = [],
    signals: AbortSignal[] = [];
  let completed = 0;
  f.internal.image = async (url, signal) => {
    signals.push(signal);
    await new Promise<void>((resolve) => gates.push(resolve));
    const r = await load(url, new AbortController().signal);
    completed++;
    return r;
  };
  const a = new Tilemap({
    sheet,
    tiles: [[0]],
    tileWidth: 20,
    tileHeight: 20,
  }).place(f.game.engine.scene);
  const b = new Tilemap({
    sheet,
    tiles: [[0]],
    tileWidth: 20,
    tileHeight: 20,
    x: 190,
    y: 140,
  }).place(f.game.engine.scene);
  const wait = f.game.whenReady();
  while (gates.length < 1) await frame();
  a.dispose();
  b.set(0, 0, 1);
  const sharedContinues = !signals[0]?.aborted;
  gates[0]?.();
  await wait;
  const latest = f.pixel(200, 150);
  b.dispose();
  const c = new Tilemap({
    sheet,
    tiles: [[0]],
    tileWidth: 20,
    tileHeight: 20,
  }).place(f.game.engine.scene);
  const abandoned = f.game.whenReady();
  while (gates.length < 2) await frame();
  c.dispose();
  await abandoned;
  const aborted = signals[1]?.aborted;
  const d = new Tilemap({
    sheet,
    tiles: [[1]],
    tileWidth: 20,
    tileHeight: 20,
    x: 190,
    y: 140,
  }).place(f.game.engine.scene);
  const replacement = f.game.whenReady();
  while (gates.length < 3) await frame();
  gates[2]?.();
  await replacement;
  gates[1]?.();
  while (completed < 3) await frame();
  await frame();
  const afterLate = f.pixel(200, 150);
  d.dispose();
  new Tilemap({ sheet, tiles: [[0]], tileWidth: 20, tileHeight: 20 }).place(
    f.game.engine.scene,
  );
  const disposed = f.game.whenReady().then(
    () => "unexpected",
    (e: { code: string }) => e.code,
  );
  while (gates.length < 4) await frame();
  f.game.dispose();
  const disposedError = await disposed;
  gates[3]?.();
  while (completed < 4) await frame();
  await frame();
  return {
    sharedContinues,
    latest,
    aborted,
    afterLate,
    disposedError,
    after: f.renderer.diagnostics,
    tileAfter: f.renderer.tilemapDiagnostics,
    errors: f.errors,
  };
}
export async function bounds() {
  const f = await fixture();
  f.actor.dispose();
  const map = new Tilemap({
    sheet,
    tiles: [[0]],
    tileWidth: 20,
    tileHeight: 20,
    x: 190,
    y: 140,
  }).place(f.game.engine.scene);
  await f.game.whenReady();
  map.set(0, 0, 99);
  let error = "";
  try {
    await f.game.whenReady();
  } catch (e) {
    error = (e as { code: string }).code;
  }
  const retained = f.pixel(200, 150);
  map.set(0, 0, 1);
  await f.game.whenReady();
  const recovered = f.pixel(200, 150);
  f.game.scene("broken", ({ scene }) => {
    new Tilemap({ sheet, tiles: [[99]], tileWidth: 16, tileHeight: 16 }).place(
      scene,
    );
  });
  let staged = "";
  try {
    await f.game.goTo("broken");
  } catch (e) {
    staged = (e as { code: string }).code;
  }
  const active = f.pixel(200, 150),
    references = f.renderer.diagnostics.imageReferences;
  f.game.dispose();
  return {
    error,
    retained,
    recovered,
    staged,
    active,
    references,
    after: f.renderer.diagnostics,
  };
}
export async function sampleState(game: import("@simpludify/web").Game) {
  const p = game.engine.scene.find("explorer");
  return { x: p?.require(Transform.type).x, camera: game.camera.x };
}
export async function measure(
  size: number,
  partial: boolean,
  dynamic: boolean,
) {
  const f = await fixture();
  f.actor.dispose();
  const t0 = performance.now();
  const map = new Tilemap({
    sheet,
    tiles: new Grid<number | null>(size, size, 0),
    tileWidth: 16,
    tileHeight: 16,
  }).place(f.game.engine.scene);
  const construction = performance.now() - t0;
  f.game.camera.zoom = partial
    ? 1
    : Math.min(400 / (size * 16), 300 / (size * 16));
  f.game.camera.x = partial ? 0 : size * 8 - 200;
  f.game.camera.y = partial ? 0 : size * 8 - 150;
  const t1 = performance.now();
  await f.game.whenReady();
  const preparation = performance.now() - t1;
  const initial = f.renderer.tilemapDiagnostics;
  const samples: number[] = [];
  const start = { ...initial };
  for (let i = 0; i < 5; i++) {
    if (dynamic) map.set(i % 10, 0, i % 2);
    f.game.setViewport();
  }
  const before = f.renderer.tilemapDiagnostics;
  for (let i = 0; i < 20; i++) {
    const t = performance.now();
    if (dynamic) for (let j = 0; j < 8; j++) map.set(j, 1, (i + 1) % 2);
    f.game.setViewport();
    samples.push(performance.now() - t);
  }
  const after = f.renderer.tilemapDiagnostics,
    resources = f.renderer.diagnostics;
  const container = f.internal.app.stage.children[0]?.children[0]
    ?.children[0] as Container | undefined;
  if (!container) throw Error("Missing map container");
  const sprites = container.children as Sprite[];
  const frameTextures = new Set(sprites.map((s) => s.texture)).size,
    textureSources = new Set(sprites.map((s) => s.texture.source)).size;
  const actorCount = f.game.engine.scene.actors.length;
  const t2 = performance.now();
  map.dispose();
  const disposal = performance.now() - t2;
  const final = f.renderer.diagnostics;
  f.game.dispose();
  samples.sort((a, b) => a - b);
  const lower = samples[9],
    upper = samples[10],
    p95 = samples[18];
  if (lower === undefined || upper === undefined || p95 === undefined)
    throw Error("Missing timing samples");
  return {
    size,
    partial,
    dynamic,
    construction,
    preparation,
    disposal,
    initial: start,
    after,
    visited: after.visitedCells - before.visitedCells,
    updated: after.updatedTiles - before.updatedTiles,
    samples,
    p50: (lower + upper) / 2,
    p95,
    resources,
    frameTextures,
    textureSources,
    final,
    actorCount,
    errors: f.errors,
  };
}
