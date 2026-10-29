import {
  CanvasButton,
  CanvasLabel,
  CanvasPanel,
  type CanvasPresentation,
  CanvasRow,
  type CanvasUI,
  Game,
  PixiRenderer,
} from "@simpludify/web";
import { inspectCanvasResources } from "../helpers/canvas-resources";

const summarize = (raw: number[]) => {
  const v = [...raw].sort((a, b) => a - b);
  return {
    p50:
      ((v[Math.floor((v.length - 1) / 2)] ?? 0) +
        (v[Math.floor(v.length / 2)] ?? 0)) /
      2,
    p95: v[Math.ceil(v.length * 0.95) - 1],
    raw,
  };
};
function profileDisposal(game: Game, renderer: PixiRenderer) {
  const phases: Record<string, { calls: number; ms: number }> = {};
  const wrap = (target: object | undefined, key: string, label: string) => {
    const methods = target as
      | Record<string, (...args: unknown[]) => unknown>
      | undefined;
    const original = methods?.[key];
    if (!methods || typeof original !== "function") return;
    methods[key] = function (...args: unknown[]) {
      const start = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        phases[label] ??= { calls: 0, ms: 0 };
        const value = phases[label];
        value.calls++;
        value.ms += performance.now() - start;
      }
    };
  };
  const host = game as unknown as Record<string, object>;
  for (const key of [
    "canvasPresentation",
    "canvas",
    "pointers",
    "keyboard",
    "ui",
    "prepared",
    "renderer",
    "engine",
  ])
    wrap(host[key], "dispose", key);
  wrap(game.element, "remove", "DOM removal");
  const internal = renderer as unknown as {
    images: object;
    app: {
      destroy(): void;
      renderer: { destroy(): void; type: number; gl?: WebGL2RenderingContext };
    };
  };
  wrap(internal.images, "dispose", "shared images");
  wrap(internal.app, "destroy", "Pixi Application.destroy");
  wrap(internal.app.renderer, "destroy", "Pixi Renderer.destroy");
  const gl = internal.app.renderer.gl;
  if (gl) {
    for (const key of [
      "deleteBuffer",
      "deleteTexture",
      "deleteProgram",
      "deleteShader",
      "deleteVertexArray",
      "deleteFramebuffer",
      "deleteRenderbuffer",
      "useProgram",
      "finish",
    ])
      wrap(gl, key, `WebGL.${key}`);
    wrap(
      gl.getExtension("WEBGL_lose_context") ?? undefined,
      "loseContext",
      "WEBGL_lose_context.loseContext",
    );
  }
  return phases;
}
export async function browserWorkload(count: number) {
  let renderer!: PixiRenderer, ui!: CanvasUI;
  const game = new Game({
    pixelRatio: 1,
    frames: { request: () => 1, cancel() {} },
    renderer: (host) => (renderer = new PixiRenderer(host, "#000000")),
  });
  const label = CanvasLabel(
      "Dynamic text 日本語と English を折り返して表示する。",
      { maxWidth: 200, minHeight: 20, shrink: 0 },
    ),
    buttons = Array.from({ length: count }, (_, i) =>
      CanvasButton(String(i), () => {}, {
        width: 60,
        minWidth: 40,
        maxWidth: 80,
        height: 28,
        padding: 0,
        fontSize: 14,
        shrink: 0,
      }),
    );
  game.canvasUI(
    CanvasPanel([label, CanvasRow(buttons, { wrap: true, gap: 4 })], {
      gap: 8,
    }),
  );
  const start = performance.now();
  await game.run();
  const mountMs = performance.now() - start;
  ui = (game as unknown as { canvas: CanvasUI }).canvas;
  const presentation = (
    game as unknown as { canvasPresentation: CanvasPresentation }
  ).canvasPresentation;
  const width = game.element.clientWidth,
    height = game.element.clientHeight;
  for (let i = 0; i < 5; i++) game.setViewport();
  const idle: number[] = [],
    edit: number[] = [],
    resize: number[] = [],
    draw: number[] = [],
    pointer: number[] = [];
  const beforeIdle = { ...ui.diagnostics },
    syncs = renderer.canvasDiagnostics.syncs;
  let idleExtraLayouts = 0,
    idleExtraSyncs = 0;
  for (let i = 0; i < 20; i++) {
    const idleBefore = ui.diagnostics.layouts,
      syncBefore = renderer.canvasDiagnostics.syncs;
    let start = performance.now();
    for (let j = 0; j < 100; j++) presentation.update(width, height);
    idle.push((performance.now() - start) / 100);
    idleExtraLayouts += ui.diagnostics.layouts - idleBefore;
    idleExtraSyncs += renderer.canvasDiagnostics.syncs - syncBefore;
    start = performance.now();
    label.setText(`Dynamic text ${i} 日本語と English を折り返して表示する。`);
    presentation.update(width, height);
    edit.push(performance.now() - start);
    start = performance.now();
    presentation.update(width - 10, height);
    presentation.update(width, height);
    resize.push((performance.now() - start) / 2);
    start = performance.now();
    game.setViewport();
    draw.push(performance.now() - start);
  }
  const beforeDeliveries = game.pointerDiagnostics.deliveries;
  const beforePointer = ui.diagnostics,
    button = buttons[0];
  if (!button) throw Error("Missing benchmark button");
  const b = button.bounds,
    canvas = game.element.querySelector("canvas");
  if (!canvas) throw Error("Missing benchmark canvas");
  const p = {
    pointerId: 50_001,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: b.x + 10,
    clientY: b.y + 10,
    bubbles: true,
    cancelable: true,
  };
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    canvas.dispatchEvent(new PointerEvent("pointerdown", p));
    for (let j = 0; j < 5; j++)
      window.dispatchEvent(new PointerEvent("pointermove", p));
    window.dispatchEvent(new PointerEvent("pointerup", { ...p, buttons: 0 }));
    if (i >= 10) pointer.push(performance.now() - start);
  }
  if (game.pointerDiagnostics.deliveries - beforeDeliveries !== 30 * 8)
    throw Error("Synthetic benchmark did not route all pointer events");
  if (ui.diagnostics.hitTests - beforePointer.hitTests !== 30 * 8)
    throw Error("Synthetic benchmark did not hit UI for all pointer events");
  const afterPointer = ui.diagnostics,
    counts = renderer.canvasDiagnostics;
  const rendererType = inspectCanvasResources(renderer).rendererType;
  const disposalPhases = profileDisposal(game, renderer);
  const end = performance.now();
  game.dispose();
  const disposeMs = performance.now() - end;
  const released = {
    ...renderer.canvasDiagnostics,
    mirrors: document.querySelectorAll(".s-canvas-accessibility").length,
    input: game.engine.input.sourceCount,
    ...game.pointerDiagnostics,
  };
  if (
    released.nodes ||
    released.presentations ||
    released.mirrors ||
    released.input ||
    released.captures ||
    released.suppressedPointers
  )
    throw Error("Browser benchmark retained owners");
  return {
    count,
    rendererType,
    width,
    height,
    pixelRatio: 1,
    mountMs,
    idleUpdateMs: summarize(idle),
    editLayoutSyncMs: summarize(edit),
    resizeLayoutSyncMs: summarize(resize),
    drawSubmissionMs: summarize(draw),
    gesture7SyntheticEventsMs: summarize(pointer),
    beforeIdle,
    idleExtraLayouts,
    idleExtraSyncs,
    syncs,
    counts,
    candidatesPerGesture:
      (afterPointer.hitVisits - beforePointer.hitVisits) / 30,
    hitTestsPerGesture: (afterPointer.hitTests - beforePointer.hitTests) / 30,
    disposeMs,
    disposalPhases,
    released,
  };
}
export async function createCycleProbe() {
  let renderer!: PixiRenderer;
  const game = new Game<"ui" | "empty">({
    pixelRatio: 1,
    frames: { request: () => 1, cancel() {} },
    renderer: (host) => (renderer = new PixiRenderer(host)),
  });
  game.scene("ui", ({ canvasUI }) => {
    canvasUI(
      CanvasRow(
        Array.from({ length: 100 }, (_, i) =>
          CanvasButton(String(i), () => {}),
        ),
        { wrap: true },
      ),
    );
  });
  game.scene("empty", () => {});
  await game.run("empty");
  return {
    baseline: inspectCanvasResources(renderer),
    async cycle() {
      const start = performance.now();
      await game.goTo("ui");
      const mounted = performance.now();
      await game.goTo("empty");
      const removed = performance.now();
      return {
        mountMs: mounted - start,
        removeMs: removed - mounted,
        visuals: renderer.canvasDiagnostics,
        mirrors: document.querySelectorAll(".s-canvas-accessibility").length,
        pointers: game.pointerDiagnostics,
        pixi: inspectCanvasResources(renderer),
      };
    },
    dispose() {
      game.dispose();
      return {
        visuals: renderer.canvasDiagnostics,
        mirrors: document.querySelectorAll(".s-canvas-accessibility").length,
        input: game.engine.input.sourceCount,
      };
    },
  };
}
declare global {
  interface Window {
    canvasCycles: Awaited<ReturnType<typeof createCycleProbe>>;
  }
}
