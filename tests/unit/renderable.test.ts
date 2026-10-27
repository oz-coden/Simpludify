import {
  Actor,
  imageSize,
  Renderable,
  Shape,
  SpriteFit,
  Transform,
} from "@simpludify/core";
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

it("accepts Triangle through the same Renderable contract and ownership", () => {
  const actor = new Actor();
  actor.add(new Transform({ rotation: Math.PI / 2, scaleX: -2, scaleY: 0.5 }));
  const render = actor.add(
    new Renderable({
      shape: Shape.Triangle,
      width: 32,
      height: 40,
      color: 0x65a8ed,
      opacity: 0.4,
      zIndex: 3,
    }),
  );
  expect(render.shape).toBe("triangle");
  expect([
    render.width,
    render.height,
    render.color,
    render.opacity,
    render.zIndex,
  ]).toEqual([32, 40, 0x65a8ed, 0.4, 3]);
  render.visible = false;
  expect(render.visible).toBe(false);
  actor.dispose();
  expect(render.disposed).toBe(true);
  expect(() => new Renderable({ shape: Shape.Triangle, width: 0 })).toThrow();
});
