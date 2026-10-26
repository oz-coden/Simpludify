import { imageSize, Renderable, SpriteFit } from "@simpludify/core";
import { expect, it } from "vitest";

it("preserves image aspect inside requested bounds and offers explicit stretching", () => {
  expect(imageSize(80, 40, 80, 80)).toEqual({ width: 80, height: 40 });
  expect(imageSize(40, 80, 80, 80)).toEqual({ width: 40, height: 80 });
  expect(imageSize(80, 40, 80, 80, SpriteFit.Stretch)).toEqual({
    width: 80,
    height: 80,
  });
  expect(() => imageSize(0, 40, 80, 80)).toThrow();
});
it("validates live opacity and depth without making visibility structural", () => {
  const render = new Renderable();
  expect(render.fit).toBe(SpriteFit.Contain);
  render.opacity = 0.25;
  render.zIndex = -10;
  render.visible = false;
  expect(render.opacity).toBe(0.25);
  expect(() => {
    render.opacity = 1.1;
  }).toThrow();
  expect(() => {
    render.zIndex = Number.NaN;
  }).toThrow();
});
