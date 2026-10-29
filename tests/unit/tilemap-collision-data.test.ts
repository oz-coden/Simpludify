import {
  Actor,
  CollisionResponse as R,
  Scene,
  SpriteSheet,
  Tilemap,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

const sheet = SpriteSheet.grid("not-loaded.png", {
  frameWidth: 16,
  frameHeight: 16,
  names: { wall: 0, stone: 1, water: 2 },
});
const solid = { response: R.Solid };
function map() {
  return new Tilemap({
    sheet,
    tiles: [["wall", "stone", "water", null]],
    tileWidth: 32,
    tileHeight: 16,
    collision: {
      tiles: [
        { tile: "wall", ...solid },
        { tile: "stone", ...solid },
        { tile: "water", response: R.Trigger },
      ],
    },
  });
}
describe("Tilemap collision attributes", () => {
  it("copies and freezes ID defaults and sparse cell overrides, including invisible terrain", () => {
    const options = {
      tile: "wall" as const,
      response: R.Solid,
      layer: 2,
      mask: 1,
    };
    const terrain = new Tilemap({
      sheet,
      tiles: [["wall", null]],
      tileWidth: 32,
      tileHeight: 16,
      collision: { tiles: [options] },
    });
    options.layer = 8;
    expect(terrain.getCollision(0, 0)).toEqual({
      response: R.Solid,
      layer: 2,
      mask: 1,
    });
    expect(Object.isFrozen(terrain.getCollision(0, 0))).toBe(true);
    terrain.setCollision(0, 0, null);
    expect(terrain.getCollision(0, 0)).toBeNull();
    terrain.resetCollision(0, 0);
    expect(terrain.getCollision(0, 0)?.layer).toBe(2);
    terrain.setCollision(1, 0, solid);
    expect(terrain.getCollision(1, 0)?.response).toBe(R.Solid);
    expect(terrain.get(1, 0)).toBeNull();
    terrain.dispose();
  });
  it("keeps image and collision revisions/notifications independent", () => {
    const terrain = map();
    const image: unknown[] = [],
      collision: unknown[] = [];
    terrain.onTilesChanged((change) => image.push(change));
    terrain.onCollisionChanged((change) => collision.push(change));
    terrain.set(0, 0, "stone");
    expect(terrain.collisionRevision).toBe(0);
    terrain.setCollision(0, 0, { response: R.Solid });
    const revision = terrain.collisionRevision;
    terrain.setCollision(0, 0, {
      response: R.Solid,
      layer: 1,
      mask: 0xffffffff,
    });
    expect(terrain.collisionRevision).toBe(revision);
    terrain.set(0, 0, "water");
    expect(terrain.collisionRevision).toBe(revision);
    terrain.resetCollision(0, 0);
    expect(terrain.getCollision(0, 0)?.response).toBe(R.Trigger);
    expect(image).toEqual([0, 0]);
    expect(collision).toHaveLength(2);
    terrain.dispose();
  });
  it("supports late defaults, exact numeric/name IDs, value equality and no-op removals", () => {
    const terrain = new Tilemap({
      sheet,
      tiles: [[0, "wall"]],
      tileWidth: 16,
      tileHeight: 16,
    });
    expect(terrain.hasCollision).toBe(false);
    terrain.setTileCollision("wall", solid);
    expect(terrain.getCollision(0, 0)).toBeNull();
    expect(terrain.getCollision(1, 0)?.response).toBe(R.Solid);
    const revision = terrain.collisionRevision;
    terrain.setTileCollision("wall", solid);
    expect(terrain.collisionRevision).toBe(revision);
    terrain.setTileCollision("wall", null);
    terrain.resetCollision(0, 0);
    expect(terrain.hasCollision).toBe(false);
    terrain.setCollision(0, 0, null);
    expect(terrain.hasCollision).toBe(false);
    terrain.dispose();
  });
  it("has independent visibility, collision gate and placement gate", () => {
    const terrain = map().place(new Scene("s"));
    terrain.visible = false;
    expect(terrain.collisionEnabled).toBe(true);
    expect(terrain.enabled).toBe(true);
    terrain.collisionEnabled = false;
    expect(terrain.visible).toBe(false);
    terrain.enabled = false;
    expect(terrain.scene?.actors).toHaveLength(1);
    expect(terrain.scene?.actors[0]).toBeInstanceOf(Actor);
    terrain.scene?.dispose();
    expect(() => terrain.setCollision(0, 0, solid)).toThrow();
    expect(() => terrain.resetCollision(0, 0)).toThrow();
    expect(() => {
      terrain.collisionEnabled = true;
    }).toThrow();
  });
  it("bulk image edits only invalidate collision when effective values change", () => {
    const terrain = map();
    terrain.fill("stone");
    expect(terrain.collisionRevision).toBe(1);
    terrain.fill("wall");
    expect(terrain.collisionRevision).toBe(1);
    terrain.fill("wall");
    expect(terrain.revision).toBe(2);
    terrain.dispose();
  });
  it.each([
    { response: "bad" },
    { response: R.Solid, layer: 0 },
    { response: R.Solid, layer: 1.5 },
    { response: R.Solid, mask: -1 },
    { response: R.Solid, mask: Infinity },
    {},
    undefined,
  ])("rejects invalid policy %j before mutation", (bad) => {
    const terrain = map();
    expect(() => terrain.setCollision(0, 0, bad as typeof solid)).toThrow();
    expect(terrain.getCollision(0, 0)?.response).toBe(R.Solid);
    expect(terrain.collisionRevision).toBe(0);
    terrain.dispose();
  });
  it("rejects invalid cells, IDs, duplicate rules and invalid gates", () => {
    const terrain = map();
    expect(() => terrain.setCollision(-1, 0, null)).toThrow(
      expect.objectContaining({ code: "GRID_BOUNDS" }),
    );
    expect(() => terrain.setTileCollision("oops" as "wall", solid)).toThrow();
    expect(() => {
      terrain.collisionEnabled = 1 as unknown as boolean;
    }).toThrow();
    expect(
      () =>
        new Tilemap({
          sheet,
          tiles: [[0]],
          tileWidth: 16,
          tileHeight: 16,
          collision: {
            tiles: [
              { tile: "wall", ...solid },
              { tile: "wall", ...solid },
            ],
          },
        }),
    ).toThrow();
    terrain.dispose();
  });
});
