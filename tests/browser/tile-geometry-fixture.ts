import {
  Actor,
  actorTween,
  CanvasButton,
  CanvasPanel,
  GeometryTilemap,
  Grid,
  HexOrientation,
  Renderable,
  Shape,
  TileGeometry,
  Transform,
  Tween,
} from "@simpludify/web";
import { fixture } from "./renderable-fixture";
export async function polygons() {
  const f = await fixture();
  f.actor.dispose();
  const result = [];
  for (const geometry of [
    TileGeometry.square({ width: 30 }),
    TileGeometry.triangle({ width: 40, height: 32 }),
    ...Object.values(HexOrientation).map((orientation) =>
      TileGeometry.hex({ radius: 20, orientation }),
    ),
  ]) {
    const map = new GeometryTilemap({
      geometry,
      tiles: new Grid<number | null>(100, 100, 0xff0000),
      x: 30,
      y: 30,
    }).place(f.game.engine.scene);
    await f.game.whenReady();
    const c = map.tileToWorld(3, 3, { center: true }),
      red = f.pixel(c.x, c.y);
    const before = f.renderer.geometryTilemapDiagnostics;
    f.pixel(c.x, c.y);
    const unchanged =
      f.renderer.geometryTilemapDiagnostics.visitedCells - before.visitedCells;
    map.set(3, 3, 0x00ff00);
    const green = f.pixel(c.x, c.y),
      updates =
        f.renderer.geometryTilemapDiagnostics.updatedTiles -
        before.updatedTiles;
    map.set(90, 90, 0x0000ff);
    const n = f.renderer.geometryTilemapDiagnostics.visitedCells;
    f.pixel(c.x, c.y);
    const offscreen = f.renderer.geometryTilemapDiagnostics.visitedCells - n;
    const actor = f.game.add(new Actor());
    actor.add(new Transform({ x: c.x, y: c.y }));
    const render = actor.add(
      new Renderable({
        width: 12,
        height: 12,
        color: 0x0000ff,
        zIndex: 2,
        source: { kind: "shape", shape: Shape.Hexagon },
      }),
    );
    const actorAbove = f.pixel(c.x, c.y);
    map.zIndex = 3;
    const mapAbove = f.pixel(c.x, c.y);
    map.zIndex = 0;
    f.game.engine.scene.tweens.play(
      Tween.to(actorTween(actor).rotation, Math.PI, { duration: 1 }),
    );
    f.game.engine.step(0.5);
    const rotation = render.rotation;
    actor.dispose();
    f.game.camera.x = 10;
    f.game.camera.y = 5;
    f.game.camera.zoom = 1.25;
    const moved = f.pixel(c.x, c.y),
      p = f.game.worldToScreen(c),
      picked = map.screenToTile(f.game.view, p);
    const bounds = map.tileBounds(3, 3),
      verts = map.tileVertices(3, 3);
    const edgeColors = [];
    // Both sides of shared edges must remain filled, without tile gaps.
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i],
        b = verts[(i + 1) % verts.length];
      if (!a || !b) throw Error();
      for (const t of [0.45, 0.55])
        edgeColors.push(
          f.pixel(
            c.x + (a.x + b.x - 2 * c.x) * t,
            c.y + (a.y + b.y - 2 * c.y) * t,
          ),
        );
    }
    map.set(3, 3, null);
    const hole = f.pixel(c.x, c.y);
    map.visible = false;
    f.pixel(c.x, c.y);
    map.set(3, 3, 0x0000ff);
    map.visible = true;
    const restored = f.pixel(c.x, c.y);
    f.game.camera.x = 0;
    f.game.camera.y = 0;
    f.game.camera.zoom = 1;
    f.game.element.style.height = "320px";
    f.game.setViewport();
    const resized = f.pixel(c.x, c.y);
    const diagnostics = f.renderer.geometryTilemapDiagnostics;
    const app = f.internal.app,
      world = app.stage.children[0]?.children[0];
    const group = world?.children.find(
      (child) => child.position.x === map.x && child.position.y === map.y,
    ) as import("pixi.js").Container | undefined;
    const contexts =
      group?.children.map(
        (child) => (child as import("pixi.js").Graphics).context,
      ) ?? [];
    map.dispose();
    const released = f.renderer.geometryTilemapDiagnostics;
    result.push({
      kind: geometry.kind,
      orientation: geometry.orientation,
      red,
      green,
      unchanged,
      updates,
      offscreen,
      actorAbove,
      mapAbove,
      moved,
      picked,
      hole,
      restored,
      resized,
      rotation,
      bounds,
      edgeColors,
      diagnostics,
      released,
      contextsDestroyed:
        contexts.length > 0 && contexts.every((c) => c.destroyed),
    });
  }
  const hexActor = f.game.add(new Actor());
  const ht = hexActor.add(new Transform({ x: 200, y: 150 }));
  const hv = hexActor.add(
    new Renderable({
      source: { kind: "shape", shape: Shape.Hexagon },
      width: 80,
      height: 120,
      color: 0xff0000,
    }),
  );
  const hex = {
    center: f.pixel(200, 150),
    cutCorner: f.pixel(235, 100),
    side: f.pixel(235, 135),
    rotated: [] as number[],
    scaled: [] as number[],
    outside: [] as number[],
    alpha: [] as number[],
    changed: [] as number[],
  };
  ht.rotation = Math.PI / 2;
  hex.rotated = f.pixel(245, 150);
  ht.rotation = 0;
  ht.scaleX = -2;
  ht.scaleY = 0.5;
  hex.scaled = f.pixel(250, 150);
  hex.outside = f.pixel(200, 200);
  ht.scaleX = ht.scaleY = 1;
  hv.opacity = 0.5;
  hex.alpha = f.pixel(200, 150);
  hv.opacity = 1;
  hv.source = { kind: "shape", shape: Shape.Triangle };
  f.pixel(200, 150);
  hv.source = { kind: "shape", shape: Shape.Hexagon };
  hv.color = 0x0000ff;
  hex.changed = f.pixel(200, 150);
  hexActor.dispose();
  let clicks = 0;
  const state: { ui?: import("@simpludify/core").CanvasUI } = {};
  f.game.scene("shared", ({ scene, canvasUI }) => {
    state.ui = canvasUI(
      CanvasPanel(
        [
          CanvasButton("Coexisting UI", () => {
            clicks++;
          }),
        ],
        { height: 40, width: 160 },
      ),
    );
    new GeometryTilemap({
      geometry: TileGeometry.hex({ radius: 20 }),
      tiles: [[0xff0000]],
    }).place(scene);
  });
  await f.game.changeScene("shared");
  f.game.setViewport();
  const uiMounted =
    !!state.ui &&
    !state.ui.disposed &&
    f.renderer.geometryTilemapDiagnostics.maps === 1;
  await f.game.changeScene("empty");
  const empty = f.renderer.geometryTilemapDiagnostics;
  f.game.dispose();
  return {
    result,
    hex,
    empty,
    disposed: f.renderer.diagnostics,
    errors: f.errors,
    uiMounted,
    uiDisposed: state.ui?.disposed,
    clicks,
  };
}
