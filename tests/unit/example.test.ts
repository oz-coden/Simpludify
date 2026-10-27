import { Engine, Transform } from "@simpludify/core";
import { expect, it } from "vitest";
import {
  BeaconCollected,
  createPlayer,
  Inventory,
  spawnBeacon,
} from "../../examples/composition/logic";

it("plays the composition example headlessly and removes collected actors", () => {
  const engine = new Engine({ seed: 42 }),
    player = createPlayer(engine.scene, engine.input);
  const total: number[] = [];
  engine.scene.events.on(
    BeaconCollected,
    (event) => total.push(event.total),
    engine.scene,
  );
  spawnBeacon(engine.scene, player.x, player.y);
  engine.step(0);
  expect(engine.scene.actors).toHaveLength(1);
  expect(player.require(Inventory.type).total).toBe(1);
  expect(total).toEqual([1]);
  const second = spawnBeacon(engine.scene, 0, 0);
  player.require(Transform.type).x = 0;
  player.y = 0;
  engine.step(0);
  expect(second.disposed).toBe(true);
  expect(total).toEqual([1, 2]);
  engine.dispose();
});
