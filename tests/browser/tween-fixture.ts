import {
  Action,
  Aspect,
  CanvasButton,
  CanvasColumn,
  type CanvasNode,
  canvasSliderGeometry,
  canvasTween,
  defineActions,
  Game,
  KeyboardBindings,
  PixiRenderer,
  Renderable,
  Transform,
  Tween,
} from "@simpludify/web";
import { buildTweenLab } from "../../examples/tween/lab";
import { inspectCanvasResources } from "../helpers/canvas-resources";
export async function tweenFixture() {
  window.demo.dispose();
  document.body.replaceChildren();
  document.body.style.cssText = "margin:0;height:100dvh";
  const errors: string[] = [];
  let renderer!: PixiRenderer,
    frame: ((time: number) => void) | undefined,
    time = 0,
    lab!: ReturnType<typeof buildTweenLab>;
  const game = new Game<"lab" | "empty">({
    aspect: Aspect.Adaptive,
    pixelRatio: 1,
    frames: {
      request: (callback) => {
        frame = callback;
        return 1;
      },
      cancel: () => {
        frame = undefined;
      },
    },
    renderer: (host) => (renderer = new PixiRenderer(host, "#000000")),
    onError: (error) => errors.push(String(error)),
  });
  const changes: { value: number; source: string }[] = [],
    commits: number[] = [];
  const A = defineActions({ Move: Action.axis2D() });
  game.scene("lab", (context) => {
    const controls = context.actions(A, { Move: KeyboardBindings.WASD });
    lab = buildTweenLab(context, {
      spriteURL: new URL("../../examples/sprites/hero.svg", import.meta.url)
        .href,
      movement: controls.reader(A.Move),
      paused: () => game.paused,
      pause: () => game.pause(),
      resume: () => game.resume(),
      leave: () => game.goTo("empty"),
      restart: () => game.goTo("lab"),
    });
    lab.volume.onChange((e) =>
      changes.push({ value: e.value, source: e.source }),
    );
    lab.volume.onCommit((e) => commits.push(e.value));
  });
  game.scene("empty", ({ canvasUI }) => {
    canvasUI(
      CanvasColumn([CanvasButton("Return to lab", () => game.goTo("lab"))]),
    );
  });
  await game.run("lab");
  frame?.(0);
  const tick = (seconds = 0) => {
    game.engine.step(seconds);
    if (!game.engine.scene.disposed)
      game.engine.scene.advancePresentation(seconds);
    game.setViewport();
  };
  return {
    game,
    errors,
    get lab() {
      return lab;
    },
    rendererType: inspectCanvasResources(renderer).rendererType,
    tick,
    changes,
    commits,
    linearView() {
      return lab.linear.require(Renderable.type);
    },
    snapshot() {
      const a = (actor: typeof lab.linear) => {
        const v = actor.require(Renderable.type),
          t = actor.require(Transform.type);
        return {
          x: t.x,
          y: t.y,
          offsetX: v.offsetX,
          rotation: v.rotation,
          opacity: v.opacity,
          scaleY: v.scaleY,
        };
      };
      return {
        linear: a(lab.linear),
        cubic: a(lab.cubic),
        sprite: a(lab.sprite),
        frame: lab.animation.frameIndex,
      };
    },
    translate(to = 80) {
      return lab.display.play(
        Tween.to(canvasTween(lab.preview).offsetX, to, { duration: 1 }),
      );
    },
    track() {
      const g = canvasSliderGeometry(lab.volume);
      if (!g) throw Error("Missing Slider geometry");
      const s = lab.ui.scale;
      return {
        x: g.track.x * s,
        y: (g.track.y + g.track.height / 2) * s,
        width: g.track.width * s,
      };
    },
    frame(seconds: number) {
      time += seconds * 1000;
      frame?.(time);
    },
    focus(node: CanvasNode) {
      lab.ui.focus(node);
      game.setViewport();
    },
    center(node: CanvasNode) {
      const b = node.bounds,
        scale = lab.ui.scale;
      return {
        x: (b.x + b.width / 2) * scale,
        y: (b.y + b.height / 2) * scale,
      };
    },
    pixel(x: number, y: number) {
      game.setViewport();
      const canvas = game.element.querySelector("canvas");
      if (!canvas) throw Error("Missing canvas");
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const c = copy.getContext("2d");
      if (!c) throw Error("Missing pixel context");
      c.drawImage(canvas, 0, 0);
      return [...c.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(
        0,
        3,
      );
    },
    dispose() {
      game.dispose();
      return renderer.canvasDiagnostics;
    },
  };
}
declare global {
  interface Window {
    tweenProbe: Awaited<ReturnType<typeof tweenFixture>>;
  }
}
