import {
  Action,
  Button,
  CanvasButton,
  CanvasCheckbox,
  CanvasColumn,
  CanvasNumberInput,
  CanvasPanel,
  CanvasRow,
  CanvasScroll,
  CanvasSelect,
  CanvasSlider,
  CanvasTextInput,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
  Panel,
  PixiRenderer,
  PointerEnter,
  PointerLeave,
} from "@simpludify/web";
import { RendererType } from "pixi.js";

/** Real native input and pointer delivery with deterministic simulation/presentation frames. */
export async function focusFixture() {
  window.demo.dispose();
  document.body.replaceChildren();
  document.body.style.cssText = "margin:0;height:100dvh";
  const errors: string[] = [],
    hoverEvents: string[] = [];
  let clicks = 0,
    domClicks = 0,
    finish = () => {};
  const A = defineActions({
    Move: Action.axis2D(),
    Fire: Action.button(),
    Right: Action.button(),
  });
  let renderer!: PixiRenderer;
  const game = new Game<"play" | "empty">({
    pixelRatio: 1,
    frames: { request: () => 1, cancel() {} },
    renderer: (host) => (renderer = new PixiRenderer(host, "#000000")),
    onError: (e) => errors.push(String(e)),
  });
  const style = {
    width: 280,
    height: 40,
    shrink: 0,
    background: 0x224466,
  } as const;
  const button = CanvasButton(
      "Canvas action",
      () => {
        clicks++;
      },
      style,
    ),
    check = CanvasCheckbox("Canvas check", {}, style),
    slider = CanvasSlider({ label: "Canvas range", value: 50 }, style),
    text = CanvasTextInput({ label: "Canvas name", value: "Player" }, style),
    number = CanvasNumberInput(
      { label: "Canvas number", value: 5, min: 0, max: 100 },
      style,
    ),
    select = CanvasSelect(
      [
        { label: "Easy", value: "easy" },
        { label: "Hard", value: "hard" },
      ],
      { label: "Canvas choice" },
      style,
    ),
    last = CanvasButton("Last action", () => {}, style),
    scroll = CanvasScroll(
      Array.from({ length: 8 }, (_, i) =>
        CanvasButton(`Entry ${i}`, () => {}, { ...style, width: 260 }),
      ),
      { width: 280, height: 80, shrink: 0, background: 0x224466 },
    ),
    row = CanvasRow([button], { height: 40, shrink: 0 }),
    root = CanvasColumn(
      [row, check, slider, text, number, select, scroll, last],
      {
        width: 310,
        height: 540,
        padding: 10,
        gap: 8,
        pointerEvents: "auto",
        background: 0x183048,
      },
    );
  root.events.on(PointerEnter, () => hoverEvents.push("enter"));
  root.events.on(PointerLeave, () => hoverEvents.push("leave"));
  let ui!: ReturnType<typeof game.canvasUI>,
    player!: ReturnType<typeof Character>,
    controls!: ReturnType<typeof game.actions<typeof A>>;
  game.scene("play", ({ canvasUI, actions, add, ui: dom }) => {
    controls = actions(A, {
      Move: KeyboardBindings.WASD,
      Fire: { keys: ["Space", "Enter"] },
      Right: { keys: ["ArrowRight"] },
    });
    player = add(
      Character({
        id: "focus-player",
        x: 350,
        y: 580,
        movement: controls.reader(A.Move),
      }),
    );
    ui = canvasUI(root);
    // DOM buttons share the browser adapter with Canvas controls and real Tile trail.
    dom(
      Panel(
        [
          Button("DOM action", () => {
            domClicks++;
          }),
          Button(
            "DOM pending",
            () =>
              new Promise<void>((resolve) => {
                finish = resolve;
              }),
          ),
        ],
        { placement: "bottom" },
      ),
    );
  });
  game.scene("empty", ({ canvasUI }) => {
    canvasUI(CanvasPanel([CanvasButton("Recreated", () => {})]));
  });
  await game.run("play");
  const outside = document.createElement("button");
  outside.textContent = "Outside game";
  outside.style.cssText = "position:fixed;right:0;top:0";
  document.body.append(outside);
  const tick = (seconds = 0) => {
    game.engine.step(seconds);
    game.setViewport();
  };
  tick();
  return {
    game,
    ui,
    player,
    controls,
    A,
    root,
    row,
    button,
    check,
    slider,
    text,
    number,
    select,
    scroll,
    last,
    errors,
    hoverEvents,
    rendererType: RendererType[renderer.type],
    counts: () => ({ clicks, domClicks }),
    finish: () => finish(),
    tick,
    move() {
      const before = player.y;
      tick(1 / 60);
      return player.y - before;
    },
    center(node: typeof button) {
      return {
        x: node.bounds.x + node.bounds.width / 2,
        y: node.bounds.y + node.bounds.height / 2,
      };
    },
    pixel(x: number, y: number) {
      tick();
      const canvas = game.element.querySelector("canvas");
      if (!canvas) throw Error("Missing Canvas");
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const context = copy.getContext("2d");
      if (!context) throw Error("Missing pixel reader");
      context.drawImage(canvas, 0, 0);
      return [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
    },
  };
}
declare global {
  interface Window {
    focusProbe: Awaited<ReturnType<typeof focusFixture>>;
  }
}
