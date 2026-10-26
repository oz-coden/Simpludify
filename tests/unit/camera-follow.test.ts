import { Camera, CameraFollow } from "@simpludify/core";
import { expect, it } from "vitest";

it("tracks world positions independently of pixel density", () => {
  const camera = new Camera(),
    follow = new CameraFollow(camera);
  follow.update({ x: 600, y: 400 }, 0);
  expect([camera.x, camera.y]).toEqual([200, 175]);
});
it("clamps zoomed view bounds and centers undersized worlds", () => {
  const camera = new Camera({ zoom: 2 }),
    follow = new CameraFollow(camera, {
      bounds: { x: 0, y: 0, width: 800, height: 450 },
    });
  follow.update({ x: 0, y: 0 }, 0);
  expect([camera.x, camera.y]).toEqual([-200, -112.5]);
  follow.update({ x: 800, y: 450 }, 0);
  expect([camera.x, camera.y]).toEqual([200, 112.5]);
  camera.zoom = 0.5;
  follow.update({ x: -1000, y: 1000 }, 0);
  expect([camera.x, camera.y]).toEqual([0, 0]);
});
it("makes exponential smoothing independent of step subdivision", () => {
  const a = new Camera(),
    b = new Camera();
  const fa = new CameraFollow(a, { responsiveness: 8 }),
    fb = new CameraFollow(b, { responsiveness: 8 });
  fa.update({ x: 1000, y: 1000 }, 1);
  for (let i = 0; i < 60; i++) fb.update({ x: 1000, y: 1000 }, 1 / 60);
  expect(a.x).toBeCloseTo(b.x, 10);
  expect(a.y).toBeCloseTo(b.y, 10);
});
it("rejects invalid parameters and does not partially move on invalid targets", () => {
  const camera = new Camera(),
    follow = new CameraFollow(camera);
  expect(() => new CameraFollow(camera, { responsiveness: -1 })).toThrow();
  expect(() => follow.update({ x: 200, y: NaN }, 1)).toThrow();
  expect(() => follow.update({ x: 1, y: 1 }, -1)).toThrow();
  expect(camera.x).toBe(0);
});
