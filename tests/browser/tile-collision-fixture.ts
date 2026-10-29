import {
  Actor,
  Collider,
  CollisionBody,
  CollisionShape,
  CollisionWorld,
  Grid,
  Motion,
  CollisionResponse as R,
  Renderable,
  SpriteSheet,
  TileContactEnter,
  Tilemap,
  Transform,
} from "@simpludify/web";
import { runWallScenario } from "../helpers/tile-wall-scenario";
import { fixture } from "./renderable-fixture";

const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><path fill="red" d="M0 0h16v16H0z"/><path fill="blue" d="M16 0h16v16H16z"/></svg>')}`;
const sheet = SpriteSheet.grid(image, { frameWidth: 16, frameHeight: 16 });
export async function terrainPhysics() {
  const f = await fixture();
  f.actor.dispose();
  const scene = f.game.engine.scene,
    world = new CollisionWorld(scene);
  const map = new Tilemap({
    sheet,
    tiles: Grid.generate(16, 12, (x, y) =>
      x === 8 ? 0 : x === 4 && y === 4 ? 1 : null,
    ),
    tileWidth: 32,
    tileHeight: 32,
    collision: {
      tiles: [
        { tile: 0, response: R.Solid },
        { tile: 1, response: R.Trigger },
      ],
    },
  }).place(scene);
  const actor = scene.add(new Actor()),
    t = actor.add(new Transform({ x: 224, y: 112 }));
  const motion = actor.add(new Motion({ x: 1, speed: 120 }));
  const view = actor.add(
    new Renderable({ width: 16, height: 16, color: 0x00ff00 }),
  );
  actor.add(new CollisionBody());
  const collider = actor.add(
    new Collider({
      shape: CollisionShape.Circle,
      radius: 8,
      response: R.Solid,
    }),
  );
  let enters = 0;
  collider.events.on(TileContactEnter, () => enters++);
  await f.game.whenReady();
  for (let i = 0; i < 60; i++) f.game.engine.step(1 / 60);
  const stop = { x: t.x, y: t.y },
    actorPixel = f.pixel(248, 112),
    wallPixel = f.pixel(264, 112);
  map.visible = false;
  t.x = 224;
  for (let i = 0; i < 60; i++) f.game.engine.step(1 / 60);
  const hiddenStop = t.x;
  map.visible = true;
  f.game.camera.x = f.game.camera.y = 10000;
  t.x = 224;
  f.game.setViewport();
  for (let i = 0; i < 60; i++) f.game.engine.step(1 / 60);
  const offscreen = {
    x: t.x,
    candidates: world.tileDiagnostics.candidateCells,
    sprites: f.renderer.tilemapDiagnostics.sprites,
  };
  f.game.camera.x = f.game.camera.y = 0;
  f.game.setViewport();
  const before = f.renderer.tilemapDiagnostics.visitedCells;
  map.setCollision(8, 3, { response: R.Trigger });
  await f.game.whenReady();
  f.game.setViewport();
  const policyOnlyVisits = f.renderer.tilemapDiagnostics.visitedCells - before;
  for (let i = 0; i < 20; i++) f.game.engine.step(1 / 60);
  const triggerPassed = t.x;
  map.resetCollision(8, 3);
  map.set(8, 3, null);
  t.x = 224;
  for (let i = 0; i < 30; i++) f.game.engine.step(1 / 60);
  const destroyedPassed = t.x;
  map.set(8, 3, 0);
  t.x = 224;
  for (let i = 0; i < 30; i++) f.game.engine.step(1 / 60);
  const regeneratedStop = t.x;
  motion.direction.x = 0;
  t.x = t.y = 144;
  f.game.engine.step(0);
  const water = world.tileContactsFor(collider).map((c) => c.response);
  view.visible = false;
  const browserCore = runWallScenario({
    circle: true,
    rotation: 0,
    horizontal: false,
    side: 1,
    tangent: 1,
    tileWidth: 32,
    tileHeight: 32,
  });
  await f.game.goTo("empty");
  const released = {
    world: world.disposed,
    contacts: world.tileDiagnostics.contacts,
    cells: world.tileDiagnostics.retainedCells,
    refs: f.renderer.diagnostics.imageReferences,
  };
  f.game.dispose();
  return {
    stop,
    actorPixel,
    wallPixel,
    hiddenStop,
    offscreen,
    policyOnlyVisits,
    triggerPassed,
    destroyedPassed,
    regeneratedStop,
    water,
    enters,
    browserCore,
    released,
    errors: f.errors,
  };
}
export async function pendingTerrain() {
  const f = await fixture();
  f.actor.dispose();
  const original = f.internal.image.bind(f.internal);
  let unblock: (() => void) | undefined;
  f.internal.image = async (...args) => {
    await new Promise<void>((resolve) => {
      unblock = resolve;
    });
    return original(...args);
  };
  const world = new CollisionWorld(f.game.engine.scene);
  const map = new Tilemap({
    sheet,
    tiles: [[0]],
    tileWidth: 32,
    tileHeight: 32,
    collision: { tiles: [{ tile: 0, response: R.Solid }] },
  }).place(f.game.engine.scene);
  const actor = f.game.add(new Actor()),
    t = actor.add(new Transform({ x: -5, y: 16 }));
  actor.add(
    new Collider({
      shape: CollisionShape.Circle,
      radius: 8,
      response: R.Solid,
    }),
  );
  actor.add(new CollisionBody());
  f.game.setViewport();
  f.game.engine.step(0);
  const during = {
    x: t.x,
    contacts: world.tileDiagnostics.contacts,
    pending: f.renderer.diagnostics.pendingImages,
  };
  map.dispose();
  f.game.engine.step(0);
  unblock?.();
  await f.game.whenReady();
  await new Promise(requestAnimationFrame);
  f.game.dispose();
  return {
    during,
    disposed: world.disposed,
    retained: world.tileDiagnostics.retainedCells,
    refs: f.renderer.diagnostics.imageReferences,
    errors: f.errors,
  };
}

let wallSamples: unknown[] = [];
let stopWallTrace: (() => void) | undefined;
/** Test-only real-RAF observations; does not replace browser keyboard integration. */
export function beginWallTrace() {
  wallSamples = [];
  const { game } = window.tilemapDemo;
  stopWallTrace = game.engine.scene.onUpdate((delta) => {
    if (wallSamples.length >= 500) return;
    const player = game.engine.scene.find("explorer")?.require(Transform.type);
    wallSamples.push({
      now: performance.now(),
      delta,
      step: game.engine.stepCount,
      x: player?.x,
      y: player?.y,
      input: game.engine.input.snapshot(),
      hidden: document.hidden,
      focus: document.activeElement?.className,
      contacts: window.tilemapDemo.world?.tileDiagnostics.contacts,
      response: window.tilemapDemo.world?.responseDiagnostics,
    });
  });
}
export function endWallTrace() {
  stopWallTrace?.();
  stopWallTrace = undefined;
  return {
    samples: wallSamples,
    userAgent: navigator.userAgent,
    fixedStep: false,
    maxDelta: 0.05,
    speed: 180,
    wallLeft: 448,
    radius: 14,
  };
}
