/** Actor-only, terrain-only and mixed games use the real exported APIs without a target union. */
import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionWorld,
  ContactEnter,
  type Scene,
  SpriteSheet,
  TileContactEnter,
  Tilemap,
  Transform,
} from "@simpludify/core";

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
  new Tilemap({
    sheet,
    tiles: [["wall", "water"]],
    tileWidth: 32,
    tileHeight: 32,
    collision: { tiles: [{ tile: "wall", response: CollisionResponse.Solid }] },
  }).place(scene);
  player(scene).events.on(TileContactEnter, (contact) => {
    console.log(contact.tileX, contact.tileY);
  });
}
export function mixed(scene: Scene) {
  new CollisionWorld(scene);
  const collider = player(scene);
  collider.events.on(ContactEnter, (contact) => {
    console.log(contact.otherActor.id);
  });
  collider.events.on(TileContactEnter, (contact) => {
    console.log(contact.map, contact.tileX);
  });
}
