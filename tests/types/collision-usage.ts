/** Pre-implementation usability sketches; replaced by real API imports when implemented. */
import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionWorld,
  ContactEnter,
  type EventType,
  type Scene,
  SpriteSheet,
  Transform,
} from "@simpludify/core";
import { ProposedTilemap } from "../prototypes/collision-api";

declare const TileEnter: EventType<{
  self: Collider;
  selfActor: Actor;
  map: ProposedTilemap<string>;
  tileX: number;
  tileY: number;
}>;
const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { wall: 0, water: 1 },
});
function player(scene: Scene) {
  const actor = scene.add(new Actor());
  actor.add(new Transform());
  actor.add(new CollisionBody());
  return actor.add(new Collider({ response: CollisionResponse.Solid }));
}
export function actorOnly(scene: Scene) {
  new CollisionWorld(scene);
  const collider = player(scene);
  collider.events.on(ContactEnter, (contact) => {
    console.log(contact.otherActor.id);
  });
}
export function terrainOnly(scene: Scene) {
  new CollisionWorld(scene);
  new ProposedTilemap({
    sheet,
    tiles: [["wall", "water"]],
    tileWidth: 32,
    tileHeight: 32,
    collision: { tiles: [{ tile: "wall", response: CollisionResponse.Solid }] },
  }).place(scene);
  player(scene).events.on(TileEnter, (contact) => {
    console.log(contact.tileX, contact.tileY);
  });
}
export function mixed(scene: Scene) {
  new CollisionWorld(scene);
  const collider = player(scene);
  collider.events.on(ContactEnter, (contact) => {
    console.log(contact.otherActor.id);
  });
  collider.events.on(TileEnter, (contact) => {
    console.log(contact.map, contact.tileX);
  });
}
