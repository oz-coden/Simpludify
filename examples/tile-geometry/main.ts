import "./style.css";
import {
  Action,
  Actor,
  actorTween,
  CanvasLabel,
  CanvasPanel,
  defineActions,
  Game,
  GeometryTilemap,
  Grid,
  HexOrientation,
  KeyboardBindings,
  PointerClick,
  Renderable,
  Shape,
  TileGeometry,
  type TilePoint,
  Transform,
  Tween,
} from "@simpludify/web";
import { startExample } from "../shared/start";

const select = document.querySelector<HTMLSelectElement>("#geometry");
const status = document.querySelector<HTMLElement>("#selection");
export const game = new Game<"lab">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
  pixelRatio: 1,
});
const actions = defineActions({ Pan: Action.axis2D() });
export let terrain: GeometryTilemap;
export let selected: TilePoint | undefined;
const geometries = {
  square: TileGeometry.square({ width: 44 }),
  triangle: TileGeometry.triangle({ width: 52 }),
  pointy: TileGeometry.hex({ radius: 26 }),
  flat: TileGeometry.hex({ radius: 26, orientation: HexOrientation.Flat }),
};
const setStatus = (text: string) => {
  if (status) status.textContent = text;
};
function paint() {
  if (selected)
    terrain.set(
      selected.x,
      selected.y,
      terrain.get(selected.x, selected.y) === 0xea739e ? 0x55d9d1 : 0xea739e,
    );
}
game.scene("lab", ({ scene, add, pointer, canvasUI, actions: bind }) => {
  selected = undefined;
  setStatus("Select a tile.");
  const kind = select?.value as keyof typeof geometries;
  const geometry = geometries[kind] ?? geometries.pointy;
  terrain = new GeometryTilemap({
    geometry,
    tiles: Grid.generate(24, 18, (x, y) => ((x + y) % 2 ? 0x305c70 : 0x397c87)),
    x: 70,
    y: 80,
  }).place(scene);
  const highlight = new GeometryTilemap({
    geometry,
    tiles: new Grid<number | null>(24, 18, null),
    x: 70,
    y: 80,
    zIndex: 1,
  }).place(scene);
  let neighbors: readonly TilePoint[] = [];
  pointer.events.on(
    PointerClick,
    (info) => {
      const tile = terrain.screenToTile(game.view, info.screen);
      if (!tile) return;
      for (const n of neighbors) highlight.set(n.x, n.y, null);
      selected = tile;
      neighbors = terrain.neighbors(tile.x, tile.y);
      for (const n of neighbors) highlight.set(n.x, n.y, 0xd4ac53);
      paint();
      const center = terrain.tileToWorld(tile.x, tile.y, { center: true });
      setStatus(
        `${geometry.kind === "hex" ? "Axial q/r" : "Column/row"} (${tile.x}, ${tile.y}) · center (${center.x.toFixed(1)}, ${center.y.toFixed(1)}) · ${neighbors.length} neighbors`,
      );
    },
    scene,
  );
  const pan = bind(actions, { Pan: KeyboardBindings.WASD });
  scene.onUpdate((seconds) => {
    const p = pan.value(actions.Pan);
    game.camera.x += p.x * 180 * seconds;
    game.camera.y += p.y * 180 * seconds;
  });
  for (const [i, shape] of [Shape.Triangle, Shape.Hexagon].entries()) {
    const actor = add(new Actor());
    actor.add(new Transform({ x: 640 + i * 85, y: 390 }));
    actor.add(
      new Renderable({
        source: { kind: "shape", shape },
        width: 48,
        height: 55,
        color: i ? 0xea739e : 0x55d9d1,
        zIndex: 2,
      }),
    );
    scene.presentationTweens.play(
      Tween.to(actorTween(actor).rotation, Math.PI * 2, {
        duration: 6,
        repeat: Infinity,
      }),
    );
  }
  canvasUI(
    CanvasPanel(
      [CanvasLabel("Color tiles · no polygon physics", { fontSize: 15 })],
      {
        padding: 8,
        height: 36,
        width: 320,
        background: 0x142c38,
        pointerEvents: "none",
      },
    ),
  );
});
const abort = new AbortController();
for (const event of ["pagehide", "simpludify:dispose"])
  window.addEventListener(event, () => abort.abort(), { signal: abort.signal });
for (const [id, action] of Object.entries({
  "zoom-in": () => {
    game.camera.zoom = Math.min(2.5, game.camera.zoom * 1.2);
  },
  "zoom-out": () => {
    game.camera.zoom = Math.max(0.5, game.camera.zoom / 1.2);
  },
  reset: () => {
    game.camera.x = 0;
    game.camera.y = 0;
    game.camera.zoom = 1;
  },
  paint,
  hide: () => {
    if (selected)
      terrain.set(
        selected.x,
        selected.y,
        terrain.get(selected.x, selected.y) === null ? 0x55d9d1 : null,
      );
  },
  rebuild: () => {
    void game.changeScene("lab");
  },
}))
  document
    .querySelector(`#${id}`)
    ?.addEventListener("click", action, { signal: abort.signal });
select?.addEventListener(
  "change",
  () => {
    void game.changeScene("lab");
  },
  { signal: abort.signal },
);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-pan]"))
  button.addEventListener(
    "click",
    () => {
      const [x, y] = button.dataset.pan?.split(",").map(Number) ?? [];
      game.camera.x += x ?? 0;
      game.camera.y += y ?? 0;
    },
    { signal: abort.signal },
  );
window.geometryDemo = {
  game,
  get terrain() {
    return terrain;
  },
  get selected() {
    return selected;
  },
};
declare global {
  interface Window {
    geometryDemo: {
      game: typeof game;
      readonly terrain: GeometryTilemap;
      readonly selected: TilePoint | undefined;
    };
  }
}
void startExample(game, "lab");
