import {
  createViewTransform,
  Scene,
  SpriteSheet,
  Tilemap,
} from "@simpludify/core";
import { Texture, TextureSource } from "pixi.js";
import { expect, it, vi } from "vitest";
import { SharedImages } from "../../packages/web/src/shared-images";
import { TilemapVisual } from "../../packages/web/src/tilemap-visual";

it("releases leases and subscriptions even if Pixi display destruction fails", async () => {
  const source = new TextureSource({ width: 16, height: 16 });
  const texture = new Texture({ source });
  const release = vi.fn(() => texture.destroy(true));
  const pool = new SharedImages(async () => ({ texture, release }));
  const scene = new Scene("map"),
    sheet = SpriteSheet.grid("tiles", { frameWidth: 16, frameHeight: 16 });
  const map = new Tilemap({
    sheet,
    tiles: [[0]],
    tileWidth: 16,
    tileHeight: 16,
  }).place(scene);
  const released = vi.fn();
  const visual = new TilemapVisual(
    map,
    scene,
    (url, signal) => pool.acquire(url, signal),
    () => {},
    () => {},
    released,
  );
  while (visual.controller) await Promise.resolve();
  visual.render(
    createViewTransform({ viewport: { x: 0, y: 0, width: 800, height: 450 } }),
  );
  const destroy = vi
    .spyOn(visual.display, "destroy")
    .mockImplementationOnce(() => {
      throw Error("display cleanup failure");
    });
  expect(() => map.dispose()).toThrow();
  expect(release).toHaveBeenCalledTimes(1);
  expect(source.destroyed).toBe(true);
  expect(released).toHaveBeenCalledTimes(1);
  expect(pool.diagnostics.imageReferences).toBe(0);
  destroy.mockRestore();
  visual.display.destroy({ children: true });
  visual.dispose();
  expect(release).toHaveBeenCalledTimes(1);
});
