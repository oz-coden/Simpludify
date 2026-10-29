import {
  Actor,
  type Collider,
  CollisionResponse,
  ContactEnter,
  SpriteSheet,
  TileContactEnter,
  Tilemap,
} from "@simpludify/core";

const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 16,
  frameHeight: 16,
  names: { wall: 0, water: 1 },
});
const map = new Tilemap({
  sheet,
  tiles: [["wall", "water"]],
  tileWidth: 32,
  tileHeight: 32,
  collision: { tiles: [{ tile: "wall", response: CollisionResponse.Solid }] },
});
map.setTileCollision("water", { response: CollisionResponse.Trigger });
// @ts-expect-error collision names must come from the sheet
map.setTileCollision("watre", { response: CollisionResponse.Trigger });
// @ts-expect-error undefined is not none or inheritance
map.setCollision(0, 0, undefined);
// @ts-expect-error response must be explicit
map.setCollision(0, 0, {});
// @ts-expect-error filters are numeric bit masks
map.setCollision(0, 0, { response: CollisionResponse.Solid, layer: "wall" });
// @ts-expect-error no boolean policy alias
map.setCollision(0, 0, { response: true });
new Tilemap({
  sheet,
  tiles: [[0]],
  tileWidth: 32,
  tileHeight: 32,
  collision: {
    // @ts-expect-error a rule typo must not widen names
    tiles: [{ tile: "wal", response: CollisionResponse.Solid }],
  },
});
const actor = new Actor();
declare const collider: Collider;
collider.events.on(ContactEnter, (c) => {
  const other: Actor = c.otherActor;
  const otherCollider: Collider = c.other;
  void other;
  void otherCollider;
});
collider.events.on(TileContactEnter, (c) => {
  c.map.get(c.tileX, c.tileY);
  const id: string | number | null = c.tileId;
  void id;
  const self: Actor = c.selfActor;
  void self;
  // @ts-expect-error terrain is not an Actor target
  c.otherActor.dispose();
  // @ts-expect-error observation policies are immutable
  c.policy.layer = 2;
});
void actor;
