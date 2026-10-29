import {
  Action,
  CameraFollow,
  CanvasButton,
  CanvasColumn,
  CanvasHoldButton,
  CanvasLabel,
  type CanvasNode,
  CanvasPanel,
  CanvasRow,
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
  KeyCode,
  PointerClick,
  Renderable,
  SpriteAnimation,
  SpriteSheet,
  TileContactEnter,
  Tilemap,
} from "@simpludify/web";
import { startExample } from "../shared/start";

const terrainSheet = SpriteSheet.grid(
  new URL("../tilemap/terrain.svg", import.meta.url).href,
  {
    frameWidth: 32,
    frameHeight: 32,
    names: { grass: 0, water: 1, path: 2, tree: 3, flower: 4, stone: 5 },
  },
);
const hero = SpriteSheet.grid(
  new URL("../sprites/hero.svg", import.meta.url).href,
  { frameWidth: 32, frameHeight: 32 },
);
const Actions = defineActions({
  Move: Action.axis2D(),
  Pause: Action.button(),
});
export const game = new Game<"title" | "field">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
export let terrain:
  | Tilemap<"grass" | "water" | "path" | "tree" | "flower" | "stone">
  | undefined;
export let world: CollisionWorld | undefined;
export const buttons: Record<string, CanvasNode> = {};
const button = (name: string, click: () => void | Promise<void>) =>
  (buttons[name] = CanvasButton(name, click, { fontSize: 16 }));
game.scene("title", ({ canvasUI }) => {
  terrain = undefined;
  world = undefined;
  game.resume();
  canvasUI(
    CanvasColumn(
      [
        CanvasLabel("Canvas trail", { fontSize: 30 }),
        CanvasLabel(
          "WASD or hold the arrows\nStone walls stop you; water is a Trigger.",
          { fontSize: 14 },
        ),
        button("Start", () => game.goTo("field")),
      ],
      {
        padding: 16,
        gap: 20,
        align: "center",
        justify: "center",
        background: 0x101922,
        pointerEvents: "auto",
      },
    ),
  );
});
game.scene("field", ({ scene, add, actions, canvasUI, pointer, onUpdate }) => {
  game.resume();
  world = new CollisionWorld(scene);
  const ground = new Tilemap({
    sheet: terrainSheet,
    tiles: Grid.generate(48, 32, (x, y) =>
      x === 14 && y >= 4 && y <= 20
        ? "stone"
        : x < 2 || y < 2
          ? "water"
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
  const controls = actions(Actions, {
    Move: KeyboardBindings.WASD,
    Pause: { keys: [KeyCode.P, KeyCode.Escape] },
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
    bounds: { x: 0, y: 0, width: 1536, height: 1024 },
  });
  const position = CanvasLabel("Tile (7, 7)", { fontSize: 15 }),
    status = CanvasLabel("Select a world tile", { fontSize: 14 });
  const pause = button("Pause", () => {
    if (game.paused) game.resume();
    else game.pause();
    pause.setText(game.paused ? "Resume" : "Pause");
  });
  controls.onPressed(Actions.Pause, () => {
    if (game.paused) game.resume();
    else game.pause();
    pause.setText(game.paused ? "Resume" : "Pause");
  });
  const edit = button("Wall", () =>
    ground.set(14, 7, ground.get(14, 7) === "stone" ? "grass" : "stone"),
  );
  const holds = (
    [
      ["Left", -1, 0],
      ["Up", 0, -1],
      ["Down", 0, 1],
      ["Right", 1, 0],
    ] as const
  ).map(([name, x, y]) => {
    // Each independent control owns its contribution; keyboard and touches compose in Core.
    const node = CanvasHoldButton(
      name,
      (held) => source.set(Actions.Move, held ? { x, y } : { x: 0, y: 0 }),
      { width: 70, height: 48, fontSize: 15, padding: 8 },
    );
    const source = controls.createSource(node);
    buttons[name] = node;
    return node;
  });
  canvasUI(
    CanvasColumn(
      [
        CanvasColumn(
          [
            CanvasRow(
              [position, pause, edit, button("Menu", () => game.goTo("title"))],
              { wrap: true, gap: 8, align: "center" },
            ),
            status,
          ],
          {
            padding: 10,
            gap: 8,
            background: 0x172630,
            shrink: 0,
            pointerEvents: "auto",
          },
        ),
        CanvasPanel([], { grow: 1 }),
        CanvasRow(holds, { wrap: true, gap: 8, justify: "center", shrink: 0 }),
      ],
      { padding: 12, gap: 10 },
    ),
  );
  collider.events.on(TileContactEnter, (c) =>
    status.setText(`${c.response} (${c.tileX}, ${c.tileY})`),
  );
  pointer.events.on(PointerClick, (event) => {
    const tile = ground.worldToTile(event.world.x, event.world.y);
    if (tile) status.setText(`Selected (${tile.x}, ${tile.y})`);
  });
  onUpdate((seconds) => {
    const move = controls.value(Actions.Move);
    animation.play(move.x || move.y ? "walk" : "idle");
    player.x = Math.max(16, Math.min(1520, player.x));
    player.y = Math.max(16, Math.min(1008, player.y));
    follow.update(player, seconds);
    const tile = ground.worldToTile(player.x, player.y);
    if (tile) position.setText(`Tile (${tile.x}, ${tile.y})`);
  });
});
declare global {
  interface Window {
    canvasDemo: {
      game: typeof game;
      readonly terrain: typeof terrain;
      readonly world: typeof world;
      buttons: typeof buttons;
    };
  }
}
window.canvasDemo = {
  game,
  buttons,
  get terrain() {
    return terrain;
  },
  get world() {
    return world;
  },
};
await startExample(game, "title");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
