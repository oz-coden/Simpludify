import { CollisionResponse as R, SpriteSheet, Tilemap } from "@simpludify/core";
import { describe, expect, it } from "vitest";
import { CellContactProbe, PolicyProbe } from "../prototypes/cell-policy";

const self = { response: R.Solid, layer: 1, mask: 0xffffffff };
function setup() {
  const map = new Tilemap({
    sheet: SpriteSheet.grid("unused.svg", {
      frameWidth: 16,
      frameHeight: 16,
      names: { wall: 0, stone: 1, water: 2 },
    }),
    tiles: [["wall", "stone", "water", null]],
    tileWidth: 32,
    tileHeight: 16,
  });
  const policies = new PolicyProbe(map, [
    { tile: "wall", response: R.Solid },
    { tile: "stone", response: R.Solid },
    { tile: "water", response: R.Trigger },
  ]);
  return { map, policies };
}
describe("isolated effective policy and stable identity proposal", () => {
  it("distinguishes inheritance, explicit none, Solid and Trigger even for empty images", () => {
    const { map, policies } = setup();
    expect(policies.get(0, 0)?.response).toBe(R.Solid);
    policies.set(0, 0, null);
    expect(policies.get(0, 0)).toBeNull();
    policies.reset(0, 0);
    expect(policies.get(0, 0)?.response).toBe(R.Solid);
    policies.set(0, 0, { response: R.Trigger });
    expect(policies.get(0, 0)?.response).toBe(R.Trigger);
    expect(policies.get(3, 0)).toBeNull();
    policies.set(3, 0, { response: R.Solid });
    expect(policies.get(3, 0)?.response).toBe(R.Solid);
    map.dispose();
  });
  it("keeps an image-only edit and equal pair policy as Stay, changing response exits then enters", () => {
    const { map, policies } = setup();
    const tracker = new CellContactProbe();
    const sample = () => {
      const response = policies.response(0, 0, self);
      return tracker.sample(response ? [{ index: 0, response }] : []);
    };
    expect(sample().map((c) => c.phase)).toEqual(["enter"]);
    map.set(0, 0, "stone");
    expect(sample().map((c) => c.phase)).toEqual(["stay"]);
    policies.setDefault("stone", { response: R.Solid, layer: 2 });
    expect(sample().map((c) => c.phase)).toEqual(["stay"]);
    policies.set(0, 0, { response: R.Trigger });
    expect(sample().map((c) => c.phase)).toEqual(["exit", "enter"]);
    policies.set(0, 0, null);
    expect(sample().map((c) => c.phase)).toEqual(["exit"]);
    map.dispose();
  });
  it("uses exact typed IDs and copies policies; aliases do not implicitly share collision defaults", () => {
    const { map, policies } = setup();
    const value = { response: R.Solid, layer: 2 };
    policies.set(1, 0, value);
    value.layer = 4;
    expect(policies.get(1, 0)?.layer).toBe(2);
    map.set(0, 0, 0);
    expect(policies.get(0, 0)).toBeNull();
    expect(() => policies.set(-1, 0, null)).toThrow();
    map.dispose();
  });
  it("retains Trigger observations if the effective pair response does not change", () => {
    const { map, policies } = setup();
    const tracker = new CellContactProbe();
    const trigger = { ...self, response: R.Trigger };
    const first = policies.response(0, 0, trigger);
    expect(first).toBe(R.Trigger);
    tracker.sample([{ index: 0, response: first as typeof R.Trigger }]);
    policies.set(0, 0, { response: R.Trigger });
    expect(
      tracker.sample([
        {
          index: 0,
          response: policies.response(0, 0, trigger) as typeof R.Trigger,
        },
      ])[0]?.phase,
    ).toBe("stay");
    policies.set(0, 0, { response: R.Solid, mask: 0 });
    expect(policies.response(0, 0, self)).toBeNull();
    map.dispose();
  });
  it("orders simultaneous cells row-major and is independent of geometry rebuild identity", () => {
    const tracker = new CellContactProbe();
    expect(
      tracker
        .sample([
          { index: 3, response: R.Solid },
          { index: 1, response: R.Trigger },
        ])
        .map((c) => c.index),
    ).toEqual([1, 3]);
    expect(
      tracker
        .sample([
          { index: 1, response: R.Trigger },
          { index: 3, response: R.Solid },
        ])
        .map((c) => c.phase),
    ).toEqual(["stay", "stay"]);
    tracker.clear();
    expect(tracker.sample([])).toEqual([]);
  });
});
