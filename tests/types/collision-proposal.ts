import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  SpriteSheet,
  Transform,
} from "@simpludify/core";
import {
  ProposedContactEnter,
  ProposedTilemap,
} from "../prototypes/collision-api";

const sheet = SpriteSheet.grid("terrain.svg", {
  frameWidth: 32,
  frameHeight: 32,
  names: { wall: 0, water: 1, grass: 2 },
});
const map = new ProposedTilemap({
  sheet,
  tiles: [["wall", "water", "grass", null]],
  tileWidth: 32,
  tileHeight: 16,
  collision: {
    tiles: [
      { tile: "wall", response: CollisionResponse.Solid },
      { tile: "water", response: CollisionResponse.Trigger, layer: 2, mask: 1 },
    ],
  },
});
map.setCollision(0, 0, null); // Explicit none, not inheritance.
map.resetCollision(0, 0); // Inherit the wall default again.
map.setCollision(3, 0, { response: CollisionResponse.Solid }); // Invisible static terrain is explicit.
map.setTileCollision("wall", { response: CollisionResponse.Trigger });
// @ts-expect-error typo must not widen names inferred from sheet
map.setTileCollision("wal", { response: CollisionResponse.Solid });
// @ts-expect-error undefined is not an override; use resetCollision
map.setCollision(0, 0, undefined);
// @ts-expect-error no implicit Solid policy
map.setCollision(0, 0, {});
// @ts-expect-error no boolean policy alias
map.setCollision(0, 0, { response: true });
new ProposedTilemap({
  sheet,
  tiles: [[0]],
  tileWidth: 32,
  tileHeight: 32,
  collision: {
    // @ts-expect-error typo cannot change sheet's inferred names
    tiles: [{ tile: "watre", response: CollisionResponse.Trigger }],
  },
});
const actor = new Actor();
actor.add(new Transform());
actor.add(new CollisionBody());
const collider = actor.add(new Collider({ response: CollisionResponse.Solid }));
collider.events.on(ProposedContactEnter, (contact) => {
  if (contact.other.kind === "tile") {
    const x: number = contact.other.tileX;
    contact.other.map.get(x, contact.other.tileY);
    // @ts-expect-error tile targets do not pretend to be Actors
    contact.other.actor.dispose();
  } else {
    contact.other.actor.get(Collider.type);
    contact.other.collider.enabled = false;
    // @ts-expect-error Actor targets have no tile coordinates
    contact.other.tileX;
  }
  const world: "world" = contact.selfPosition.space;
  void world;
  // @ts-expect-error old unconditional Actor assumption requires migration
  contact.otherActor.dispose();
});
