import { type CanvasNode, canvasSliderGeometry, Game } from "@simpludify/web";
import { RendererType } from "pixi.js";
import { createSettingsScreen } from "../../examples/canvas-ui/settings-screen";
export async function controlsFixture() {
  window.demo.dispose();
  document.body.replaceChildren();
  document.body.style.cssText = "margin:0;height:100dvh";
  let frame: ((time: number) => void) | undefined,
    time = 0;
  const errors: string[] = [],
    commits: number[] = [],
    cancels: number[] = [];
  const game = new Game<"settings" | "empty">({
    frames: {
      request(callback) {
        frame = callback;
        return 1;
      },
      cancel() {
        frame = undefined;
      },
    },
    onError: (e) => errors.push(String(e)),
  });
  const screen = createSettingsScreen(() => game.goTo("empty"));
  screen.volume.onCommit((e) => commits.push(e.value));
  screen.volume.onCancel((e) => cancels.push(e.value));
  let ui: ReturnType<typeof game.canvasUI> | undefined;
  game.scene("settings", (context) => {
    ui = context.canvasUI(screen.root);
  });
  game.scene("empty", () => {});
  await game.run("settings");
  if (!ui) throw Error("No control UI");
  const canvasUI = ui;
  const tick = () => {
    time += 16;
    frame?.(time);
  };
  tick();
  const renderer = (
    game as unknown as { renderer: { app: { renderer: { type: number } } } }
  ).renderer.app.renderer;
  const center = (node: CanvasNode, x = 0.5, y = 0.5) => {
    const b = node.bounds,
      r = game.element.getBoundingClientRect();
    return {
      x: r.x + (b.x + b.width * x) * canvasUI.scale,
      y: r.y + (b.y + b.height * y) * canvasUI.scale,
    };
  };
  const focus = (node: CanvasNode) => {
    canvasUI.focus(node);
    tick();
  };
  const pixel = (x: number, y: number) => {
    // Read the WebGL back buffer in the same task as rendering, before the browser can discard it.
    tick();
    const canvas = game.element.querySelector("canvas");
    if (!canvas) throw Error("No canvas");
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext("2d");
    if (!ctx) throw Error("No context");
    ctx.drawImage(canvas, 0, 0);
    const dpr = canvas.width / canvas.clientWidth;
    return [
      ...ctx.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data,
    ].slice(0, 3);
  };
  const trackPixel = () => {
    const g = canvasSliderGeometry(screen.volume);
    if (!g) throw Error("No geometry");
    return pixel(g.track.x + g.track.width * 0.85, g.track.y + 2);
  };
  return {
    game,
    screen,
    ui: canvasUI,
    errors,
    commits,
    cancels,
    tick,
    center,
    focus,
    pixel,
    trackPixel,
    rendererType: RendererType[renderer.type],
  };
}
declare global {
  interface Window {
    controlsProbe: Awaited<ReturnType<typeof controlsFixture>>;
  }
}
