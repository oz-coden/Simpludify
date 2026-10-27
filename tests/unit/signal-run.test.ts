import {
  Collider,
  CollisionShape,
  ContactEnter,
  ContactExit,
  ContactStay,
  Engine,
  Scene,
  Transform,
  worldPoint,
} from "@simpludify/core";
import { expect, it } from "vitest";
import {
  Round,
  RoundChanged,
  RoundFinished,
  RoundStatus,
} from "../../examples/signal-run/logic";
import { keyboard } from "../helpers/keyboard";

it("collects signals through contacts and freezes terminal motion", () => {
  const engine = new Engine(),
    round = new Round(engine.scene, engine.input, { hazards: false });
  const ended: string[] = [];
  engine.scene.events.on(RoundFinished, (state) => ended.push(state.status));
  for (const actor of [...round.pickups]) {
    const t = actor.require(Transform.type);
    round.player.x = t.x;
    round.player.y = t.y;
    engine.step(0);
  }
  expect(round.snapshot()).toMatchObject({
    status: RoundStatus.Won,
    hp: 3,
    score: 6,
  });
  expect(ended).toEqual(["won"]);
  expect(round.world.disposed).toBe(true);
  const x = round.player.x;
  keyboard(engine).set("KeyD", true);
  engine.step(1);
  expect(round.player.x).toBe(x);
  engine.dispose();
});
it("applies contact cooldown and game over with a rotated obstacle", () => {
  const engine = new Engine(),
    round = new Round(engine.scene, engine.input),
    hazard = [...round.hazards].find(
      (actor) => actor.require(Collider.type).shape === CollisionShape.Box,
    );
  if (!hazard) throw new Error("No obstacle");
  const t = hazard.require(Transform.type);
  round.player.x = t.x;
  round.player.y = t.y;
  engine.step(0);
  expect(round.health.hp).toBe(2);
  engine.step(0.5);
  expect(round.health.hp).toBe(2);
  engine.step(0.51);
  expect(round.health.hp).toBe(1);
  engine.step(1.01);
  expect(round.status).toBe(RoundStatus.Lost);
  engine.dispose();
});
it("times out before late pickup delivery", () => {
  const engine = new Engine(),
    round = new Round(engine.scene, engine.input, {
      hazards: false,
      duration: 1,
      goal: 1,
    }),
    item = [...round.pickups][0];
  if (!item) throw new Error("No pickup");
  const t = item.require(Transform.type);
  round.player.x = t.x;
  round.player.y = t.y;
  engine.step(1);
  expect(round.status).toBe(RoundStatus.Timeout);
  expect(round.score).toBe(0);
  engine.dispose();
});
it("supports target movement, keyboard override, bounds and pause", () => {
  const engine = new Engine(),
    round = new Round(engine.scene, engine.input, { hazards: false });
  round.setTarget(worldPoint(220, 225));
  engine.step(0.5);
  expect(round.player.x).toBe(175);
  engine.pause();
  engine.step(10);
  expect(round.elapsed).toBe(0.5);
  engine.resume();
  keyboard(engine).set("KeyA", true);
  engine.step(0.1);
  expect(round.player.x).toBe(156);
  engine.input.clear();
  engine.step(0.1);
  expect(round.player.x).toBe(156);
  round.setTarget(worldPoint(-500, -500));
  engine.step(2);
  expect(round.player.x).toBeGreaterThanOrEqual(16);
  expect(round.player.y).toBeGreaterThanOrEqual(28);
  engine.dispose();
});
it("publishes coarse UI changes and cleans round resources on restart", () => {
  const engine = new Engine(),
    round = new Round(engine.scene, engine.input);
  let updates = 0;
  engine.scene.events.on(RoundChanged, () => updates++);
  for (let i = 0; i < 60; i++) engine.step(1 / 60);
  expect(updates).toBeLessThan(5);
  const fresh = new Scene("restart");
  engine.activate(fresh);
  const next = new Round(fresh, engine.input, { hazards: false });
  engine.step(0);
  expect(round.world.disposed).toBe(true);
  expect(round.pickups.size).toBe(0);
  expect(next.score).toBe(0);
  engine.dispose();
});
it("replays controlled input deterministically", () => {
  const run = () => {
    const engine = new Engine({ seed: 42 }),
      round = new Round(engine.scene, engine.input);
    keyboard(engine).set("KeyD", true);
    for (let i = 0; i < 240; i++) {
      if (i === 60) keyboard(engine).set("KeyS", true);
      if (i === 120) engine.input.clear();
      engine.step(1 / 60);
    }
    const state = { world: engine.snapshot(), round: round.snapshot() };
    engine.dispose();
    return state;
  };
  expect(run()).toEqual(run());
});

it("completes the route through ordinary movement before the deadline", () => {
  const engine = new Engine(),
    round = new Round(engine.scene, engine.input);
  for (const target of [
    [220, 225],
    [340, 90],
    [480, 90],
    [660, 225],
    [480, 360],
    [340, 360],
  ]) {
    round.setTarget(worldPoint(target[0] ?? 0, target[1] ?? 0));
    for (let step = 0; step < 120; step++) engine.step(1 / 60);
  }
  expect(round.status).toBe(RoundStatus.Won);
  expect(round.score).toBe(6);
  expect(round.health.hp).toBeGreaterThan(0);
  expect(round.elapsed).toBeLessThan(round.duration);
  engine.dispose();
});

it("blocks continuous player movement with solid walls while pickups remain triggers", () => {
  const engine = new Engine(),
    round = new Round(engine.scene, engine.input, { hazards: false });
  const wall = [...round.walls].find(
    (a) => a.require(Transform.type).x === 270,
  );
  if (!wall) throw Error("No wall");
  let enters = 0,
    stays = 0,
    exits = 0;
  const collider = round.player.require(Collider.type);
  collider.events.on(ContactEnter, (c) => {
    if (c.otherActor === wall) enters++;
  });
  collider.events.on(ContactStay, (c) => {
    if (c.otherActor === wall) stays++;
  });
  collider.events.on(ContactExit, (c) => {
    if (c.otherActor === wall) exits++;
  });
  round.player.x = 270;
  round.player.y = 255;
  keyboard(engine).set("KeyS", true);
  for (let i = 0; i < 60; i++) engine.step(1 / 60);
  expect(round.player.y).toBeCloseTo(273);
  expect(enters).toBe(1);
  expect(stays).toBeGreaterThan(0);
  expect(round.health.hp).toBe(3);
  engine.input.clear();
  keyboard(engine).set("KeyD", true);
  for (let i = 0; i < 60; i++) engine.step(1 / 60);
  expect(exits).toBe(1);
  engine.dispose();
  expect(round.walls.size).toBe(0);
});
