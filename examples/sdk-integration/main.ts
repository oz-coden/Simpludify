import {
  Actor,
  Aspect,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasPanel,
  CanvasRow,
  CanvasTextInput,
  Game,
  PointerClick,
  Renderable,
  Transform,
  worldPoint,
} from "@simpludify/web";
import { createDiscreteDemo } from "./model";

const parent = document.querySelector<HTMLElement>("#app");
if (!parent) throw new Error("Missing app");
const status = document.querySelector<HTMLElement>("#status");
const game = new Game<"play" | "empty">({
  parent,
  resolution: { width: 400, height: 180 },
  aspect: Aspect.Fit,
});
let count = 0;
let probe: ReturnType<typeof setup> | undefined;
function setup(context: Parameters<Parameters<typeof game.scene>[1]>[0]) {
  const views = [0x68dcc5, 0xffcc77].map((color, i) => {
    const actor = context.add(new Actor({ id: `display-${i}` }));
    const transform = actor.add(new Transform({ x: 35, y: 60 + i * 60 }));
    const renderable = actor.add(
      new Renderable({ width: 24, height: 24, color }),
    );
    return { transform, renderable };
  });
  const demo = createDiscreteDemo(context.scene, (display) =>
    display.forEach((value, i) => {
      const view = views[i];
      if (view) {
        view.transform.x = 35 + value.x * 50;
        view.renderable.opacity = value.opacity;
      }
    }),
  );
  const label = CanvasLabel("World step: 0", {
    fontSize: 15,
    height: 28,
    shrink: 0,
  });
  const region = CanvasPanel([], {
    grow: 1,
    minHeight: 100,
    pointerEvents: "children",
  });
  const hud = CanvasColumn(
    [
      CanvasRow(
        [
          CanvasButton(
            "Step",
            () => {
              demo.step();
              label.setText(`World step: ${demo.world.step}`);
            },
            { width: 86, height: 40 },
          ),
          CanvasButton(
            "Restart",
            () => {
              demo.restart();
              label.setText("World step: 0");
            },
            { width: 90, height: 40 },
          ),
          CanvasButton(
            "Pause",
            () => (game.engine.paused ? game.resume() : game.pause()),
            { width: 80, height: 40 },
          ),
          CanvasButton("Scene", () => game.goTo("empty"), {
            width: 80,
            height: 40,
          }),
        ],
        { gap: 6, wrap: true, shrink: 0 },
      ),
      CanvasTextInput(
        { label: "Canvas name", value: "日本語" },
        { height: 40, width: 250, shrink: 0 },
      ),
      label,
    ],
    { padding: 10, gap: 6, shrink: 0, background: 0x204355 },
  );
  const root = CanvasColumn([hud, region], { height: "100%" });
  const ui = context.canvasUI(root);
  const unbind = game.bindViewport(ui, region);
  context.pointer.events.on(
    PointerClick,
    () => {
      count++;
      if (status) status.textContent = `World click: ${count}`;
    },
    context.scene,
  );
  return { demo, region, hud, root, ui, views, unbind, scene: context.scene };
}
game.scene("play", (context) => {
  probe = setup(context);
});
game.scene("empty", (context) => {
  game.resume();
  context.canvasUI(
    CanvasColumn([CanvasButton("Return", () => game.goTo("play"))], {
      padding: 12,
    }),
  );
});
const editor = document.querySelector<HTMLFormElement>("#editor");
const abort = new AbortController();
editor?.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    if (status) status.textContent = "Note saved; focus stays in the form.";
  },
  { signal: abort.signal },
);
const dispose = () => {
  abort.abort();
  game.dispose();
};
window.addEventListener("pagehide", dispose, { once: true });
await game.run("play");
// Public demo diagnostics also support automated checks of the shipped sample.
const integration = {
  game,
  get current() {
    return probe;
  },
  get clicks() {
    return count;
  },
  dispose,
  center: () => game.worldToScreen(worldPoint(200, 90)),
};
declare global {
  interface Window {
    integration: typeof integration;
  }
}
Object.assign(window, { integration });
