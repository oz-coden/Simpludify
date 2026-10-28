import { SpriteSheet, spriteFrameBounds } from "@simpludify/core";
import { describe, expect, it } from "vitest";

describe("SpriteSheet", () => {
  it("resolves row-major grids and named aliases without loading", () => {
    const sheet = SpriteSheet.grid("hero.png", {
      frameWidth: 16,
      frameHeight: 8,
      names: { idle: 0, walk: 4 },
    });
    expect(sheet.get("walk")).toBe(sheet.get(4));
    expect(spriteFrameBounds(sheet.get(4).frame, 48, 16)).toEqual({
      x: 16,
      y: 8,
      width: 16,
      height: 8,
    });
    expect(Object.isFrozen(sheet.get(0).frame)).toBe(true);
    expect(sheet.count).toBeUndefined();
  });
  it("copies arbitrary rectangles and supports names and indices", () => {
    const rect = { x: 3, y: 5, width: 7, height: 9 };
    const sheet = SpriteSheet.rects("hero.png", { idle: rect });
    rect.x = 100;
    expect(sheet.count).toBe(1);
    expect(sheet.get("idle")).toBe(sheet.get(0));
    expect(spriteFrameBounds(sheet.get(0).frame, 16, 16)).toEqual({
      kind: "rect",
      x: 3,
      y: 5,
      width: 7,
      height: 9,
    });
    expect(SpriteSheet.rects("hero.png", [rect]).get(0).frame.kind).toBe(
      "rect",
    );
  });
  it("rejects invalid definitions, names, indices and decoded bounds", () => {
    for (const value of [0, -1, NaN, Infinity, 1.5])
      expect(() =>
        SpriteSheet.grid("hero", { frameWidth: value, frameHeight: 8 }),
      ).toThrow();
    expect(() =>
      SpriteSheet.rects("", [{ x: 0, y: 0, width: 1, height: 1 }]),
    ).toThrow();
    expect(() => SpriteSheet.rects("hero", {})).toThrow();
    expect(() =>
      SpriteSheet.rects("hero", [{ x: -1, y: 0, width: 1, height: 1 }]),
    ).toThrow();
    const sheet = SpriteSheet.grid("hero", { frameWidth: 8, frameHeight: 8 });
    for (const index of [-1, 1.1, NaN, Infinity])
      expect(() => sheet.get(index)).toThrow();
    expect(() => sheet.get("missing" as never)).toThrow();
    expect(() => spriteFrameBounds(sheet.get(0).frame, 17, 16)).toThrow();
    expect(() => spriteFrameBounds(sheet.get(4).frame, 16, 16)).toThrow();
    const rect = SpriteSheet.rects("hero", [
      { x: 15, y: 0, width: 2, height: 1 },
    ]);
    expect(() => rect.get(1)).toThrow();
    expect(() => spriteFrameBounds(rect.get(0).frame, 16, 16)).toThrow();
  });
});
