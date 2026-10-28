import {
  Action,
  ActionController,
  Button,
  CameraFollow,
  Character,
  defineActions,
  Game,
  Grid,
  KeyboardBindings,
  Label,
  Panel,
  Renderable,
  SpriteAnimation,
  SpriteSheet,
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
const Actions = defineActions({ Move: Action.axis2D() });
game.scene("field", ({ scene, add, ui }) => {
  const ground = new Tilemap({
    sheet,
    tiles: Grid.generate(64, 48, (x, y) =>
      x < 2 || y < 2 || x > 61 || y > 45
        ? "water"
        : x % 12 === 7 || y % 10 === 8
          ? "path"
          : "grass",
    ),
    tileWidth: 32,
    tileHeight: 32,
  }).place(scene);
  terrain = ground;
  new Tilemap({
    sheet,
    tiles: Grid.generate(20, 14, (x, y) =>
      x === 0 || y === 0 ? "tree" : null,
    ),
    tileWidth: 32,
    tileHeight: 32,
    x: 480,
    y: 300,
    zIndex: 2,
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
      y: 250,
      size: 40,
      source: hero.get(0),
      movement: controls.reader(Actions.Move),
    }),
  );
  player.require(Renderable.type).zIndex = 1;
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
    status = Label("Decorative terrain; tile collision is not enabled.", {
      muted: true,
    });
  scene.onUpdate((seconds) => {
    const move = controls.value(Actions.Move);
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
        Button("Leave field →", () => game.goTo("rest")),
      ],
      { title: "Tile trail" },
    ),
  );
});
game.scene("rest", ({ ui }) => {
  terrain = undefined;
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
    tilemapDemo: { game: typeof game; readonly terrain: typeof terrain };
  }
}
window.tilemapDemo = {
  game,
  get terrain() {
    return terrain;
  },
};
await startExample(game, "field");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
