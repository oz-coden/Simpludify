/** Executable semantic probe only: no Scene hooks, registration or physics. */
import { CollisionResponse, type Tilemap } from "@simpludify/core";
import type {
  NormalizedTilePolicy,
  TileCollisionPolicy,
} from "./collision-api";

function normalize(
  value: TileCollisionPolicy | null,
): NormalizedTilePolicy | null {
  return value === null
    ? null
    : Object.freeze({
        response: value.response,
        layer: value.layer ?? 1,
        mask: value.mask ?? 0xffffffff,
      });
}
export class PolicyProbe<Name extends string> {
  private readonly defaults = new Map<number | Name, NormalizedTilePolicy>();
  private readonly overrides = new Map<number, NormalizedTilePolicy | null>();
  constructor(
    readonly map: Tilemap<Name>,
    rules: readonly (TileCollisionPolicy & { tile: number | Name })[],
  ) {
    for (const rule of rules) {
      if (this.defaults.has(rule.tile)) throw Error("duplicate tile policy");
      map.sheet.get(rule.tile);
      this.defaults.set(rule.tile, normalize(rule) as NormalizedTilePolicy);
    }
  }
  get(x: number, y: number): NormalizedTilePolicy | null {
    const id = this.map.get(x, y),
      index = y * this.map.width + x;
    if (this.overrides.has(index)) return this.overrides.get(index) ?? null;
    return id === null ? null : (this.defaults.get(id) ?? null);
  }
  set(x: number, y: number, value: TileCollisionPolicy | null): void {
    this.map.get(x, y);
    this.overrides.set(y * this.map.width + x, normalize(value));
  }
  reset(x: number, y: number): void {
    this.map.get(x, y);
    this.overrides.delete(y * this.map.width + x);
  }
  setDefault(tile: number | Name, value: TileCollisionPolicy | null): void {
    this.map.sheet.get(tile);
    if (value === null) this.defaults.delete(tile);
    else this.defaults.set(tile, normalize(value) as NormalizedTilePolicy);
  }
  response(
    x: number,
    y: number,
    self: NormalizedTilePolicy,
  ): CollisionResponse | null {
    const tile = this.get(x, y);
    if (!tile || !(self.mask & tile.layer) || !(tile.mask & self.layer))
      return null;
    return self.response === CollisionResponse.Solid &&
      tile.response === CollisionResponse.Solid
      ? CollisionResponse.Solid
      : CollisionResponse.Trigger;
  }
}
export interface Observation {
  index: number;
  response: CollisionResponse;
}
export interface Transition extends Observation {
  phase: "enter" | "stay" | "exit";
}
/** One collider/map partition; internal rectangle IDs and image IDs are intentionally absent. */
export class CellContactProbe {
  private previous = new Map<number, CollisionResponse>();
  sample(observations: readonly Observation[]): Transition[] {
    const current = new Map<number, CollisionResponse>();
    for (const c of observations) current.set(c.index, c.response);
    const result: Transition[] = [];
    const keys = [
      ...new Set([...this.previous.keys(), ...current.keys()]),
    ].sort((a, b) => a - b);
    for (const index of keys) {
      const old = this.previous.get(index),
        next = current.get(index);
      if (old !== undefined && old !== next)
        result.push({ index, response: old, phase: "exit" });
      if (next !== undefined)
        result.push({
          index,
          response: next,
          phase: old === next ? "stay" : "enter",
        });
    }
    this.previous = current;
    return result;
  }
  clear(): void {
    this.previous.clear();
  }
}
