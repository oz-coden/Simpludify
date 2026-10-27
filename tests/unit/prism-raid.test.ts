import {
  Actor,
  Collider,
  CollisionShape,
  ContactExit,
  Engine,
  Scene,
  Transform,
} from "@simpludify/core";
import { expect, it } from "vitest";
import { autopilot } from "../../examples/prism-raid/autoplay";
import {
  arena,
  Raid,
  RaidActions,
  type RaidOptions,
  Unit,
} from "../../examples/prism-raid/logic";

function fixture(
  options: RaidOptions = { spawnInterval: 100, duration: 100 },
  seed = 42,
) {
  const engine = new Engine(seed),
    round = new Raid(
      engine.scene,
      engine.input,
      () => engine.random(),
      options,
    );
  return { engine, round };
}
it("moves through normal input, normalizes diagonals, clamps bounds and fires while held", () => {
  const { engine, round } = fixture();
  const t = round.player.require(Transform.type);
  engine.input.set("KeyD", true);
  engine.step(0.1);
  expect(t.x).toBe(202);
  engine.input.set("KeyW", true);
  engine.step(0.1);
  expect(t.x - 202).toBeCloseTo(22 * Math.SQRT1_2);
  engine.input.clear();
  expect(round.shotsFired).toBe(0);
  engine.input.set("Space", true);
  engine.step(0.01);
  expect(round.shotsFired).toBe(2);
  const shot = [...round.playerShots][0];
  if (!shot) throw new Error("No shot");
  const y = shot.require(Transform.type).y;
  engine.step(0.1);
  expect(shot.require(Transform.type).y).toBeCloseTo(y - 30);
  for (let i = 0; i < 10; i++) engine.step(0.1);
  expect(round.shotsFired).toBeGreaterThan(10);
  engine.input.clear();
  engine.input.set("ArrowLeft", true);
  engine.step(5);
  expect(t.x).toBe(18);
  engine.input.clear();
  engine.input.set("ArrowDown", true);
  engine.step(5);
  expect(t.y).toBe(arena.height - 22);
  engine.dispose();
});
it("consumes a projectile once during simultaneous contacts and awards one kill", () => {
  const { engine, round } = fixture();
  round.spawnEnemy({ x: 180, y: 150, kind: "scout", shoots: false });
  round.spawnEnemy({ x: 180, y: 150, kind: "scout", shoots: false });
  const shot = round.spawnPlayerShot(180, 150);
  engine.step(0);
  expect(shot.disposed).toBe(true);
  expect(round.enemies.size).toBe(1);
  expect(round.score).toBe(100);
  expect(round.kills).toBe(1);
  engine.step(0);
  expect(round.score).toBe(100);
  engine.dispose();
});
it("does not duplicate score when multiple bullets kill the same enemy", () => {
  const { engine, round } = fixture();
  const enemy = round.spawnEnemy({
    x: 180,
    y: 150,
    kind: "scout",
    shoots: false,
  });
  round.spawnPlayerShot(180, 150);
  round.spawnPlayerShot(180, 150);
  engine.step(0);
  expect(enemy.disposed).toBe(true);
  expect(round.score).toBe(100);
  expect(round.playerShots.size).toBe(1);
  engine.dispose();
});
it("applies enemy HP and score, then removes defeated Actors and Components", () => {
  const { engine, round } = fixture();
  const enemy = round.spawnEnemy({
    x: 180,
    y: 150,
    kind: "gunner",
    hp: 3,
    shoots: false,
  });
  const unit = enemy.require(Unit.type);
  engine.step(0);
  for (let i = 0; i < 3; i++) {
    round.spawnPlayerShot(enemy.require(Transform.type).x, 150);
    engine.step(0);
  }
  expect(unit.disposed).toBe(true);
  expect(enemy.disposed).toBe(true);
  expect(round.score).toBe(220);
  expect(round.enemies.size).toBe(0);
  engine.dispose();
});
it("merges same-frame damage under invulnerability and consumes enemy shots", () => {
  const { engine, round } = fixture();
  const t = round.player.require(Transform.type);
  for (let i = 0; i < 5; i++) round.spawnEnemyShot(t.x, t.y);
  engine.step(0);
  expect(round.hp).toBe(4);
  expect(round.enemyShots.size).toBe(0);
  expect(round.hit()).toBe(false);
  engine.step(0.99);
  expect(round.hit()).toBe(false);
  engine.step(0.02);
  expect(round.hit()).toBe(true);
  expect(round.hp).toBe(3);
  engine.dispose();
});
it("handles body contact, offscreen removal and breaches with clear game rules", () => {
  const { engine, round } = fixture();
  const t = round.player.require(Transform.type);
  const enemy = round.spawnEnemy({
    x: t.x,
    y: t.y,
    kind: "scout",
    shoots: false,
  });
  engine.step(0);
  expect(round.hp).toBe(4);
  expect(enemy.disposed).toBe(true);
  expect(round.score).toBe(0);
  const escapedEnemy = round.spawnEnemy({
    x: 50,
    y: arena.height + 40,
    kind: "scout",
    shoots: false,
  });
  engine.step(0);
  expect(escapedEnemy.disposed).toBe(true);
  expect(round.breaches).toBe(1);
  expect(round.hp).toBe(3);
  const shot = round.spawnPlayerShot(100, -80);
  engine.step(0);
  expect(shot.disposed).toBe(true);
  engine.dispose();
});
it("delivers Exit only to a previously notified surviving collider after projectile removal", () => {
  const { engine, round } = fixture();
  const observer = new Actor();
  observer.add(new Transform({ x: 100, y: 150 }));
  const sensor = observer.add(
    new Collider({
      shape: CollisionShape.Circle,
      radius: 20,
      layer: 4,
      mask: 2,
    }),
  );
  engine.scene.add(observer);
  const shot = round.spawnPlayerShot(100, 150);
  let exits = 0;
  sensor.events.on(ContactExit, () => exits++, observer);
  engine.step(0);
  expect(round.world.contactsFor(sensor)).toHaveLength(1);
  shot.dispose();
  engine.step(0);
  expect(exits).toBe(1);
  expect(round.world.contactsFor(sensor)).toEqual([]);
  engine.dispose();
});
it("shows discrete high-speed tunneling and catches the same path with bounded substeps", () => {
  const miss = fixture();
  const enemy = miss.round.spawnEnemy({
    x: 180,
    y: 150,
    kind: "scout",
    shoots: false,
    speed: 1,
  });
  miss.round.spawnPlayerShot(180, 450, 1200);
  miss.engine.step(0.5);
  expect(enemy.disposed).toBe(false);
  miss.engine.dispose();
  const hit = fixture();
  const target = hit.round.spawnEnemy({
    x: 180,
    y: 150,
    kind: "scout",
    shoots: false,
    speed: 1,
  });
  hit.round.spawnPlayerShot(180, 450, 1200);
  for (let i = 0; i < 60; i++) hit.engine.step(1 / 120);
  expect(target.disposed).toBe(true);
  expect(hit.round.score).toBe(100);
  hit.engine.dispose();
});
it("keeps the shipped bullet speeds effective at the Web delta cap", () => {
  const { engine, round } = fixture();
  const enemy = round.spawnEnemy({
    x: 180,
    y: 150,
    kind: "scout",
    shoots: false,
    speed: 1,
  });
  round.spawnPlayerShot(180, 450);
  for (let i = 0; i < 40; i++) engine.step(1 / 30);
  expect(enemy.disposed).toBe(true);
  engine.dispose();
});
it("freezes simulation and timers while paused and initializes a fresh Scene on restart", () => {
  const { engine, round } = fixture({});
  engine.input.set("Space", true);
  engine.step(0.4);
  engine.pause();
  const frozen = round.snapshot();
  engine.step(50);
  expect(round.snapshot()).toEqual(frozen);
  engine.resume();
  engine.step(0.4);
  expect(round.elapsed).toBeGreaterThan(frozen.elapsed);
  const old = engine.scene;
  const source = engine.input.createSource(old);
  const next = new Scene("retry");
  const fresh = new Raid(next, engine.input, () => engine.random());
  engine.activate(next);
  expect(old.disposed).toBe(true);
  expect(round.world.disposed).toBe(true);
  expect(round.units.size).toBe(0);
  expect(source.disposed).toBe(true);
  expect(fresh.hp).toBe(5);
  expect(fresh.score).toBe(0);
  engine.dispose();
  engine.dispose();
  expect(fresh.units.size).toBe(0);
});
it("reaches loss through normal no-input play and freezes the terminal state", () => {
  const { engine, round } = fixture({});
  for (let i = 0; i < 120 * 76 && round.status === "playing"; i++)
    engine.step(1 / 120);
  expect(round.status).toBe("lost");
  expect(round.world.disposed).toBe(true);
  const before = round.snapshot();
  engine.input.set("Space", true);
  engine.step(1);
  expect(round.snapshot()).toEqual(before);
  engine.dispose();
});
for (const seed of [1, 42, 2026])
  it(`wins all waves using only public input (seed ${seed})`, () => {
    const { engine, round } = fixture({}, seed);
    for (let i = 0; i < 120 * 76 && round.status === "playing"; i++) {
      if (i % 6 === 0) autopilot(round);
      engine.step(1 / 120);
    }
    expect(round.status).toBe("won");
    expect(round.hp).toBeGreaterThan(0);
    expect(round.kills).toBe(24);
    expect(round.score).toBe(3420);
    engine.dispose();
  });
it("replays a seeded input trace with identical game and Engine snapshots", () => {
  const a = fixture({}, 2026),
    b = fixture({}, 2026);
  for (let i = 0; i < 4000; i++) {
    if (i % 6 === 0) {
      autopilot(a.round);
    }
    a.engine.step(1 / 120);
    b.round.input.set(
      RaidActions.Move,
      a.round.controls.value(RaidActions.Move),
    );
    b.round.input.set(
      RaidActions.Fire,
      a.round.controls.value(RaidActions.Fire),
    );
    b.engine.step(1 / 120);
    if (i % 17 === 0) {
      expect(a.round.snapshot()).toEqual(b.round.snapshot());
      expect(a.engine.snapshot()).toEqual(b.engine.snapshot());
    }
  }
  expect(a.round.status).toBe("won");
  a.engine.dispose();
  b.engine.dispose();
});
it("keeps spawn/remove churn bounded during accelerated repeated rounds", () => {
  let steps = 0,
    rounds = 0,
    peak = 0;
  while (steps < 100_000) {
    const { engine, round } = fixture({}, rounds++);
    for (
      let i = 0;
      i < 120 * 76 && round.status === "playing" && steps < 100_000;
      i++, steps++
    ) {
      if (i % 6 === 0) autopilot(round);
      engine.step(1 / 120);
      peak = Math.max(peak, round.units.size);
    }
    engine.dispose();
    expect(round.units.size).toBe(0);
    expect(round.world.diagnostics.colliders).toBe(0);
  }
  expect(rounds).toBeGreaterThan(20);
  expect(peak).toBeLessThan(200);
});
it("supports many active bullets/enemies without reusing destroyed actors", () => {
  const { engine, round } = fixture({
    spawnInterval: 100,
    duration: 100,
    hp: 100,
  });
  for (let i = 0; i < 100; i++)
    round.spawnEnemy({
      x: 20 + (i % 10) * 32,
      y: 50 + Math.floor(i / 10) * 30,
      kind: "gunner",
      shoots: false,
      hp: 100,
    });
  for (let i = 0; i < 1000; i++)
    round.spawnPlayerShot(20 + (i % 10) * 32, 400 + (i % 70));
  for (let i = 0; i < 40; i++) engine.step(1 / 120);
  expect(round.world.diagnostics.colliders).toBeLessThanOrEqual(1101);
  expect(round.score).toBeGreaterThanOrEqual(0);
  engine.dispose();
  expect(round.units.size).toBe(0);
});

it("emits a survivor Exit after a production hit consumes its projectile", () => {
  const { engine, round } = fixture();
  const enemy = round.spawnEnemy({
    x: 180,
    y: 150,
    kind: "gunner",
    hp: 3,
    shoots: false,
  });
  engine.step(0);
  let exits = 0;
  enemy.require(Collider.type).events.on(ContactExit, () => exits++, enemy);
  const shot = round.spawnPlayerShot(enemy.require(Transform.type).x, 150);
  engine.step(0);
  expect(shot.disposed).toBe(true);
  expect(enemy.require(Unit.type).hp).toBe(2);
  expect(exits).toBe(0);
  engine.step(0);
  expect(exits).toBe(1);
  expect(enemy.disposed).toBe(false);
  engine.dispose();
});

it("uses rebound physical controls and logical AI controls with unchanged combat rules", () => {
  const { engine, round } = fixture();
  round.controls.rebind(RaidActions.Fire, { keys: ["KeyF"] });
  engine.input.set("Space", true);
  engine.step(0.01);
  expect(round.shotsFired).toBe(0);
  engine.input.clear();
  engine.input.set("KeyF", true);
  engine.step(0.01);
  expect(round.shotsFired).toBe(2);
  engine.input.clear();
  round.input.set(RaidActions.Move, { x: -1, y: 0 });
  round.input.set(RaidActions.Fire, true);
  const x = round.player.require(Transform.type).x;
  engine.step(0.2);
  expect(round.player.require(Transform.type).x).toBeLessThan(x);
  expect(round.shotsFired).toBe(4);
  engine.dispose();
});

it("fires a ready weapon for a logical tap completed between simulation steps", () => {
  const { engine, round } = fixture();
  round.input.set(RaidActions.Fire, true);
  round.input.set(RaidActions.Fire, false);
  engine.step(0.01);
  expect(round.shotsFired).toBe(2);
  engine.step(0.2);
  expect(round.shotsFired).toBe(2);
  engine.dispose();
});
