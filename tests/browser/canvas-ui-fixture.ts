import {
  Action,
  CanvasButton,
  CanvasColumn,
  CanvasHoldButton,
  CanvasLabel,
  type CanvasNode,
  CanvasPanel,
  CanvasRow,
  type CanvasUI,
  defineActions,
  Game,
  KeyboardBindings,
  KeyCode,
  PixiRenderer,
  PointerCancel,
  PointerClick,
  PointerDown,
  PointerMove,
  PointerUp,
} from "@simpludify/web";
import { inspectCanvasResources } from "../helpers/canvas-resources";
export async function canvasFixture() {
  window.demo.dispose();
  document.body.replaceChildren();
  document.body.style.cssText = "margin:0;height:100dvh";
  const errors: string[] = [],
    worldEvents: string[] = [],
    uiEvents: string[] = [],
    holdEvents: boolean[] = [];
  let renderer!: PixiRenderer,
    root!: CanvasUI,
    hold!: CanvasNode,
    click!: CanvasNode,
    label!: CanvasNode;
  let finishSlow = () => {},
    staged: CanvasUI | undefined,
    failed: CanvasUI | undefined;
  const A = defineActions({ Move: Action.axis2D(), Fire: Action.button() });
  const game = new Game<"first" | "empty" | "slow" | "broken">({
    pixelRatio: 2,
    frames: { request: () => 1, cancel() {} },
    renderer: (host) => (renderer = new PixiRenderer(host, "#000000")),
    onError: (e) => errors.push(String(e)),
  });
  let controls!: ReturnType<typeof game.actions<typeof A>>,
    clicks = 0;
  game.scene("first", ({ scene, actions, canvasUI, pointer, ui }) => {
    controls = actions(A, {
      Move: KeyboardBindings.WASD,
      Fire: { keys: [KeyCode.Space] },
    });
    const source = controls.createSource();
    label = CanvasLabel("Canvas title", { fontSize: 20 });
    hold = CanvasHoldButton(
      "Move right",
      (v) => {
        holdEvents.push(v);
        source.set(A.Move, v ? { x: 1, y: 0 } : { x: 0, y: 0 });
      },
      { width: 120, height: 50, background: 0x006600 },
    );
    click = CanvasButton(
      "Count",
      () => {
        clicks++;
        label.setText(`Count ${clicks}`);
      },
      { width: 100, height: 50, background: 0x880000 },
    );
    root = canvasUI(
      CanvasColumn(
        [
          label,
          CanvasRow([hold, click], { gap: 10, height: 50, align: "start" }),
        ],
        { padding: 12, gap: 12, align: "start" },
      ),
    );
    for (const [token, name] of [
      [PointerDown, "down"],
      [PointerMove, "move"],
      [PointerUp, "up"],
      [PointerCancel, "cancel"],
      [PointerClick, "click"],
    ] as const) {
      pointer.events.on(token, (e) =>
        worldEvents.push(`${name}:${e.pointerId}`),
      );
      hold.events.on(token, (e) =>
        uiEvents.push(`${name}:${e.pointerId}:${e.inside}`),
      );
    }
    // Native DOM overlay stays present but empty; Canvas must remain the pointer owner.
    ui();
    scene.onDispose(() => source.dispose());
  });
  game.scene("empty", ({ canvasUI }) => {
    root = canvasUI(
      CanvasPanel([CanvasButton("Return", () => game.goTo("first"))], {
        padding: 20,
        align: "start",
      }),
    );
  });
  game.scene("slow", async ({ canvasUI }) => {
    staged = canvasUI(CanvasPanel([CanvasButton("Staged", () => {})]));
    await new Promise<void>((r) => {
      finishSlow = r;
    });
  });
  game.scene("broken", ({ canvasUI }) => {
    failed = canvasUI(CanvasPanel([CanvasButton("Broken", () => {})]));
    throw Error("expected setup failure");
  });
  await game.run("first");
  game.engine.step(0);
  game.setViewport();
  const pixel = (x: number, y: number) => {
    game.setViewport();
    const canvas = game.element.querySelector("canvas");
    if (!canvas) throw Error("Missing fixture canvas");
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const c = copy.getContext("2d");
    if (!c) throw Error("Missing pixel reader");
    c.drawImage(canvas, 0, 0);
    return [
      ...c.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data,
    ].slice(0, 3);
  };
  return {
    game,
    renderer,
    A,
    errors,
    worldEvents,
    uiEvents,
    holdEvents,
    get root() {
      return root;
    },
    get hold() {
      return hold;
    },
    get click() {
      return click;
    },
    get label() {
      return label;
    },
    get controls() {
      return controls;
    },
    get clicks() {
      return clicks;
    },
    get staged() {
      return staged;
    },
    get failed() {
      return failed;
    },
    finishSlow: () => finishSlow(),
    pixel,
    step: (seconds = 0) => {
      game.engine.step(seconds);
      game.setViewport();
    },
    center: (node: CanvasNode) => ({
      x: (node.bounds.x + node.bounds.width / 2) * root.scale,
      y: (node.bounds.y + node.bounds.height / 2) * root.scale,
    }),
  };
}
declare global {
  interface Window {
    canvasProbe: Awaited<ReturnType<typeof canvasFixture>>;
  }
}
export function clippingAndPaint(f: Awaited<ReturnType<typeof canvasFixture>>) {
  const clipped = CanvasButton("", () => {}, {
    width: 100,
    height: 50,
    shrink: 0,
    padding: 0,
    background: 0x0000ff,
  });
  const back = CanvasButton("", () => {}, {
    width: 100,
    height: 50,
    shrink: 0,
    padding: 0,
    background: 0xaa0000,
  });
  const front = CanvasButton("", () => {}, {
    width: 100,
    height: 50,
    shrink: 0,
    padding: 0,
    background: 0x00aa00,
  });
  f.root.root.add(
    CanvasPanel([clipped], { width: 50, height: 20, clip: true, shrink: 0 }),
    CanvasPanel([back], { height: 0, shrink: 0 }),
    front,
  );
  f.step();
  const c = clipped.bounds,
    b = front.bounds;
  return {
    inside: f.pixel(c.x + 4, c.y + 4),
    outside: f.pixel(c.x + 70, c.y + 4),
    clipInside: f.root.hitTest(c.x + 4, c.y + 4) === clipped,
    clipOutside: f.root.hitTest(c.x + 70, c.y + 4) === clipped,
    front: f.pixel(b.x + 4, b.y + 4),
    frontHit: f.root.hitTest(b.x + 4, b.y + 4) === front,
  };
}
export function throwingHold(f: Awaited<ReturnType<typeof canvasFixture>>) {
  const b = CanvasHoldButton(
    "Fault",
    (held) => {
      if (held) throw Error("expected hold error");
    },
    { width: 100, height: 40 },
  );
  f.root.root.add(b);
  f.step();
  return f.center(b);
}

export async function ownedResourceCycle(
  f: Awaited<ReturnType<typeof canvasFixture>>,
) {
  const active = inspectCanvasResources(f.renderer);
  for (let i = 0; i < 10; i++) {
    await f.game.goTo("empty");
    await f.game.goTo("first");
  }
  await f.game.goTo("empty");
  // The empty Scene has one ordinary world clip plus its Return button.
  const empty = inspectCanvasResources(f.renderer);
  f.game.dispose();
  return { active, empty, counts: f.renderer.canvasDiagnostics };
}
