import {
  type CanvasNode,
  canvasScrollbars,
  Game,
  type PointerInfo,
  screenPoint,
  worldPoint,
} from "@simpludify/web";
import { createPortableScreen } from "../../examples/canvas-ui/portable-screen";
export async function scrollFixture() {
  window.demo.dispose();
  document.body.replaceChildren();
  document.body.style.cssText = "margin:0;height:100dvh";
  let frame: ((time: number) => void) | undefined,
    time = 0;
  const errors: string[] = [];
  const game = new Game({
    frames: {
      request(callback) {
        frame = callback;
        return 1;
      },
      cancel() {
        frame = undefined;
      },
    },
    onError: (error) => errors.push(String(error)),
  });
  const pointerEvents: Array<{
    type: string;
    id: number;
    button: number;
    x: number;
    y: number;
    holding: boolean;
  }> = [];
  const monitor = new AbortController();
  game.engine.scene.onDispose(() => monitor.abort());
  for (const type of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
  ]) {
    window.addEventListener(
      type,
      (event) => {
        const p = event as PointerEvent;
        pointerEvents.push({
          type,
          id: p.pointerId,
          button: p.button,
          x: p.clientX,
          y: p.clientY,
          holding: screen.holding,
        });
        if (pointerEvents.length > 60) pointerEvents.shift();
      },
      { capture: true, signal: monitor.signal },
    );
  }
  const screen = createPortableScreen(),
    ui = game.canvasUI(screen.root);
  await game.run();
  const tick = (milliseconds = 16) => {
    time += milliseconds;
    frame?.(time);
  };
  tick();
  const center = (node: CanvasNode, x = 0.4, y = 0.5) => {
    const b = node.bounds,
      r = game.element.getBoundingClientRect(),
      sx = r.width / game.element.clientWidth,
      sy = r.height / game.element.clientHeight;
    return {
      x: r.x + (b.x + b.width * x) * ui.scale * sx,
      y: r.y + (b.y + b.height * y) * ui.scale * sy,
    };
  };
  const bar = (node = screen.list) => {
    const b = canvasScrollbars(node)[0];
    if (!b) throw Error("No scrollbar");
    const r = game.element.getBoundingClientRect(),
      s = ui.scale;
    return {
      x: r.x + (b.thumb.x + b.thumb.width / 2) * s,
      y: r.y + (b.thumb.y + b.thumb.height / 2) * s,
      endX: r.x + (b.track.x + b.track.width / 2) * s,
      endY: r.y + (b.track.y + b.track.height) * s,
      paintX: b.thumb.x + b.thumb.width / 2,
      paintY: b.thumb.y + b.thumb.height / 2,
    };
  };
  const pixel = (x: number, y: number) => {
    const canvas = game.element.querySelector("canvas");
    if (!canvas) throw Error("No canvas");
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext("2d");
    if (!ctx) throw Error("No pixel reader");
    ctx.drawImage(canvas, 0, 0);
    const dpr = canvas.width / canvas.clientWidth;
    return [
      ...ctx.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data,
    ].slice(0, 3);
  };
  // Controlled Core input timestamps exercise Web Game's frame bridge without wall-clock FPS assertions.
  const fling = () => {
    screen.list.setStyle({ inertia: true });
    screen.list.scrollTo(0, 0);
    tick();
    const p = center(screen.list, 0.3, 0.7),
      routing = (
        game as unknown as {
          pointers: {
            routing: {
              down(p: PointerInfo): void;
              move(p: PointerInfo): void;
              up(p: PointerInfo): void;
            };
          };
        }
      ).pointers.routing;
    const data = (y: number, t: number): PointerInfo => ({
      pointerId: 91,
      pointerType: "touch",
      button: 0,
      buttons: 1,
      screen: screenPoint(p.x, y),
      world: worldPoint(p.x, y),
      inside: true,
      time: t,
    });
    routing.down(data(p.y, 0));
    for (let i = 1; i <= 6; i++) {
      routing.move(data(p.y - i * 8, i * 0.016));
      tick();
    }
    routing.up(data(p.y - 48, 0.096));
    return screen.list.scrollY;
  };
  return {
    game,
    screen,
    ui,
    errors,
    tick,
    center,
    bar,
    pixel,
    fling,
    pointerEvents,
  };
}
declare global {
  interface Window {
    scrollProbe: Awaited<ReturnType<typeof scrollFixture>>;
  }
}
