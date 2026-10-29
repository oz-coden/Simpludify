import {
  Action,
  ActionController,
  Button,
  CameraFollow,
  Character,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  defineActions,
  Game,
  Grid,
  KeyboardBindings,
  Label,
  Panel,
  Renderable,
  SpriteAnimation,
  SpriteSheet,
  TileContactEnter,
  Tilemap,
} from "@simpludify/web";
import { startExample } from "../shared/start";

const sheet = SpriteSheet.grid(new URL("./terrain.svg", import.meta.url).href, {
  frameWidth: 32,
  frameHeight: 32,
  names: { grass: 0, water: 1, path: 2, tree: 3, flower: 4, stone: 5 },
});
const hero = SpriteSheet.grid(
  new URL("../sprites/hero.svg", import.meta.url).href,
  { frameWidth: 32, frameHeight: 32 },
);
export const game = new Game<"field" | "rest">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
export let terrain:
  | Tilemap<"grass" | "water" | "path" | "tree" | "flower" | "stone">
  | undefined;
export let world: CollisionWorld | undefined;
const Actions = defineActions({ Move: Action.axis2D() });
game.scene("field", ({ scene, add, ui }) => {
  world = new CollisionWorld(scene);
  const ground = new Tilemap({
    sheet,
    tiles: Grid.generate(64, 48, (x, y) =>
      x < 2 ||
      y < 2 ||
      x > 61 ||
      y > 45 ||
      (x >= 9 && x <= 11 && y >= 9 && y <= 11)
        ? "water"
        : x === 14 && y >= 4 && y <= 12
          ? "stone"
          : x % 12 === 7 || y % 10 === 8
            ? "path"
            : "grass",
    ),
    tileWidth: 32,
    tileHeight: 32,
    collision: {
      tiles: [
        { tile: "stone", response: CollisionResponse.Solid },
        { tile: "water", response: CollisionResponse.Trigger },
      ],
    },
  }).place(scene);
  terrain = ground;
  const trees = new Tilemap({
    sheet,
    tiles: Grid.generate(20, 14, (x, y) =>
      x === 0 || y === 0 ? "tree" : null,
    ),
    tileWidth: 32,
    tileHeight: 32,
    x: 480,
    y: 300,
    zIndex: 2,
    collision: { tiles: [{ tile: "tree", response: CollisionResponse.Solid }] },
  }).place(scene);
  new Tilemap({
    sheet,
    tiles: Grid.generate(9, 7, (x, y) => ((x + y) % 3 === 0 ? "flower" : null)),
    tileWidth: 32,
    tileHeight: 32,
    x: 160,
    y: 320,
    zIndex: 0.5,
  }).place(scene);
  const controls = new ActionController(Actions, {
    scene,
    input: game.engine.input,
    bindings: { Move: KeyboardBindings.WASD },
  });
  const player = add(
    Character({
      id: "explorer",
      x: 250,
      y: 240,
      size: 40,
      source: hero.get(0),
      movement: controls.reader(Actions.Move),
    }),
  );
  player.require(Renderable.type).zIndex = 1;
  player.add(new CollisionBody());
  const collider = player.add(
    new Collider({
      shape: CollisionShape.Circle,
      radius: 14,
      response: CollisionResponse.Solid,
    }),
  );
  let facing = { x: 1, y: 0 };

  const animation = player.add(
    new SpriteAnimation({
      sheet: hero,
      clips: {
        idle: { frames: [0, 1], fps: 3 },
        walk: { frames: [2, 3, 4, 5], fps: 8 },
      },
    }),
  );
  const follow = new CameraFollow(game.camera, {
    bounds: { x: 0, y: 0, width: 2048, height: 1536 },
  });
  const position = Label(""),
    status = Label("Stone/trees: Solid. Water: pass-through Trigger.", {
      muted: true,
    });
  collider.events.on(TileContactEnter, (contact) => {
    status.setText(
      `Last tile contact: ${contact.response} (${contact.tileX}, ${contact.tileY}).`,
    );
  });
  scene.onUpdate((seconds) => {
    const move = controls.value(Actions.Move);
    if (move.x || move.y)
      facing =
        Math.abs(move.x) >= Math.abs(move.y)
          ? { x: Math.sign(move.x), y: 0 }
          : { x: 0, y: Math.sign(move.y) };
    animation.play(move.x || move.y ? "walk" : "idle");
    player.x = Math.max(20, Math.min(2028, player.x));
    player.y = Math.max(20, Math.min(1516, player.y));
    follow.update(player, seconds);
    const tile = ground.worldToTile(player.x, player.y);
    if (tile) {
      const world = ground.tileToWorld(tile.x, tile.y);
      position.setText(
        `Tile (${tile.x}, ${tile.y}) / world origin (${world.x}, ${world.y})`,
      );
    }
  });
  ui(
    Panel(
      [
        Label("Focus the field and move with WASD."),
        position,
        status,
        Button("Paint under player", () => {
          const tile = ground.worldToTile(player.x, player.y);
          if (tile)
            ground.set(
              tile.x,
              tile.y,
              ground.get(tile.x, tile.y) === "stone" ? "grass" : "stone",
            );
        }),
        Button("Toggle wall ahead", () => {
          const tile = ground.worldToTile(
            player.x + facing.x * 32,
            player.y + facing.y * 32,
          );
          if (tile)
            ground.set(
              tile.x,
              tile.y,
              ground.get(tile.x, tile.y) === "stone" ? "grass" : "stone",
            );
        }),
        Button("Toggle collision", () => {
          ground.collisionEnabled = !ground.collisionEnabled;
          trees.collisionEnabled = ground.collisionEnabled;
          status.setText(
            `Terrain collision ${ground.collisionEnabled ? "enabled" : "disabled"}; visibility unchanged.`,
          );
        }),
        Button("Leave field →", () => game.goTo("rest")),
      ],
      { title: "Tile trail" },
    ),
  );
});
game.scene("rest", ({ ui }) => {
  terrain = undefined;
  world = undefined;
  ui(
    Panel(
      [
        Label("The old map placements and image leases are disposed."),
        Button("← Return to field", () => game.goTo("field")),
      ],
      { title: "Rest stop" },
    ),
  );
});
// Inspection hook used by production gallery cleanup tests; not an engine API.
declare global {
  interface Window {
    tilemapDemo: {
      game: typeof game;
      readonly terrain: typeof terrain;
      readonly world: typeof world;
    };
  }
}
window.tilemapDemo = {
  game,
  get world() {
    return world;
  },
  get terrain() {
    return terrain;
  },
};
await startExample(game, "field");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
