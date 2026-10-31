import { CanvasUI, Engine } from "@simpludify/core";
import { expect, it } from "vitest";
import { buildTweenLab } from "../../examples/tween/lab";

it("public lab composes display sequences through fractional paused updates and releases all owners", () => {
  const engine = new Engine(),
    scene = engine.scene;
  const lab = buildTweenLab(
    {
      scene,
      tweens: scene.tweens,
      presentationTweens: scene.presentationTweens,
      add: (a) => scene.add(a),
      canvasUI: (root) => new CanvasUI(scene, root),
    },
    {
      spriteURL: "sheet.svg",
      movement: {
        kind: "axis2d",
        scene,
        disposed: false,
        value: () => ({ x: 0, y: 0 }),
      },
      paused: () => engine.paused,
      pause: () => engine.pause(),
      resume: () => engine.resume(),
      leave: async () => {},
      restart: async () => {},
    },
  );
  engine.step(0);
  engine.pause();
  const ui = lab.animateUI(),
    value = lab.animateValue(),
    hp = lab.damage();
  for (let i = 0; i < 180; i++) {
    engine.step(1 / 60);
    scene.advancePresentation(1 / 60);
  }
  expect(ui.state).toBe("completed");
  expect(value.state).toBe("completed");
  expect(hp.state).toBe("completed");
  expect(lab.preview.presentation).toEqual({
    offsetX: 0,
    offsetY: 0,
    opacity: 1,
  });
  expect(lab.volume.value).toBe(80);
  expect(lab.hp.value).toBe(75);
  expect(lab.hp.displayValue).toBe(75);
  expect(scene.tweens.diagnostics.active).toBe(4);
  expect(scene.presentationTweens.diagnostics.active).toBe(0);
  engine.dispose();
  expect(lab.handles.size).toBe(0);
  expect(lab.root.disposed).toBe(true);
});
