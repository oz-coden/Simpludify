import {
  Actor,
  Component,
  type ComponentType,
  defineComponent,
  Game,
  PixiRenderer,
  Renderable,
  Shape,
  SpriteFit,
  Transform,
  worldPoint,
} from "@simpludify/web";
import type { Application, Graphics, Sprite } from "pixi.js";

export { Actor, Renderable, Shape, SpriteFit, Transform };

export const imageURL = (color: string, width = 80, height = 40) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`)}`;

class Observer extends Component {
  static readonly type: ComponentType<Observer> = defineComponent<Observer>(
    "VisualObserver",
    [Renderable.type],
  );
  readonly type = Observer.type;
  readonly view: Renderable;
  constructor(view: Renderable) {
    super();
    this.view = view;
  }
}
export async function fixture() {
  window.demo.dispose();
  let renderer!: PixiRenderer;
  const errors: string[] = [];
  const game = new Game<"empty" | "broken">({
    pixelRatio: 1,
    resolution: { width: 400, height: 300 },
    frames: { request: () => 1, cancel() {} },
    renderer: (host) =>
      (renderer = new PixiRenderer(host, "#000000", (error) =>
        errors.push((error as { code: string }).code),
      )),
  });
  game.element.style.height = "450px";
  game.scene("empty", () => {});
  const actor = game.add(new Actor());
  actor.add(new Transform({ x: 200, y: 150 }));
  const view = actor.add(
    new Renderable({ width: 80, height: 40, color: 0xff0000 }),
  );
  const observer = actor.add(new Observer(view));
  await game.run();
  const internal = renderer as unknown as {
    app: Application;
    image(
      url: string,
      signal: AbortSignal,
    ): Promise<{ texture: import("pixi.js").Texture; release(): void }>;
  };
  const display = () =>
    internal.app.stage.children[0]?.children[0]?.children[0] as
      | Graphics
      | Sprite;
  const pixel = (x = 200, y = 150) => {
    game.setViewport();
    const canvas = game.element.querySelector("canvas");
    if (!canvas) throw new Error("Missing canvas");
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d");
    if (!context) throw new Error("Missing Canvas2D copy context");
    context.drawImage(canvas, 0, 0);
    const p = game.worldToScreen(worldPoint(x, y));
    return [
      ...context.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data,
    ].slice(0, 3);
  };
  return {
    game,
    renderer,
    actor,
    view,
    observer,
    errors,
    internal,
    display,
    pixel,
  };
}
