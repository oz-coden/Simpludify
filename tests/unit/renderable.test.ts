import {
  Actor,
  type ComponentType,
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
  expect(
    new Renderable({ source: { kind: "image", url: "sprite.png" } }).source,
  ).toEqual({ kind: "image", url: "sprite.png", fit: SpriteFit.Contain });
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
      source: { kind: "shape", shape: Shape.Triangle },
      width: 32,
      height: 40,
      color: 0x65a8ed,
      opacity: 0.4,
      zIndex: 3,
    }),
  );
  expect(render.source).toEqual({ kind: "shape", shape: Shape.Triangle });
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
  expect(
    () =>
      new Renderable({
        source: { kind: "shape", shape: Shape.Triangle },
        width: 0,
      }),
  ).toThrow();
});

it("updates validated display state without replacing dependencies or touching Scene structure", async () => {
  const { Component, defineComponent, Engine } = await import(
    "@simpludify/core"
  );
  const engine = new Engine({ seed: 3 });
  const actor = engine.scene.add(new Actor());
  actor.add(new Transform());
  const view = actor.add(new Renderable());
  class Effect extends Component {
    static readonly type: ComponentType<Effect> = defineComponent<Effect>(
      "Effect",
      [Renderable.type],
    );
    readonly type = Effect.type;
    readonly view = view;
    update(): void {
      this.view.color = 0xff4444;
    }
  }
  const effect = actor.add(new Effect());
  const structural = engine.scene.revision;
  engine.step(1 / 60);
  view.width = 48;
  view.height = 24;
  view.opacity = 0.5;
  view.visible = false;
  view.zIndex = 12;
  view.source = { kind: "image", url: "hero.png" };
  expect(view.source).toEqual({
    kind: "image",
    url: "hero.png",
    fit: SpriteFit.Contain,
  });
  expect(view.color).toBe(0xff4444);
  expect(actor.require(Renderable.type)).toBe(view);
  expect(actor.require(Effect.type)).toBe(effect);
  expect(effect.disposed).toBe(false);
  expect(engine.scene.revision).toBe(structural);
  engine.dispose();
});

it("copies and freezes sources, compares semantic values and retains color across switches", () => {
  const source = {
    kind: "image",
    url: "a.png",
    fit: SpriteFit.Contain,
  } as const;
  const view = new Renderable({ source });
  expect(view.color).toBe(0xffffff);
  expect(new Renderable().color).toBe(0x73e3c0);
  expect(view.source).not.toBe(source);
  expect(Object.isFrozen(view.source)).toBe(true);
  const original = view.source;
  view.source = { kind: "image", url: "a.png" };
  view.source = original;
  view.width = 32;
  view.height = 32;
  view.color = 0xffffff;
  view.visible = true;
  view.opacity = 1;
  view.zIndex = 0;
  expect(view.revision).toBe(0);
  expect(view.source).toBe(original);
  view.color = 0x804020;
  view.source = { kind: "shape", shape: Shape.Circle };
  expect(view.revision).toBe(2);
  expect(view.color).toBe(0x804020);
  const supplied = { kind: "image" as const, url: "b.png" };
  view.source = supplied;
  supplied.url = "changed.png";
  expect(view.source).toEqual({
    kind: "image",
    url: "b.png",
    fit: SpriteFit.Contain,
  });
});

for (const [property, values] of Object.entries({
  width: [0, -1, NaN, Infinity, "32", null],
  height: [0, -1, NaN, Infinity, "32", null],
  color: [-1, 0x1000000, 1.5, NaN, Infinity, "red", null],
  opacity: [-0.1, 1.1, NaN, Infinity, "1", null],
  zIndex: [NaN, Infinity, "1", null],
  visible: [0, "true", null],
  source: [
    null,
    "box",
    {},
    { kind: "other" },
    { kind: "shape", shape: "hexagon" },
    { kind: "shape", shape: Shape.Box, url: "a.png" },
    { kind: "image", url: "" },
    { kind: "image", url: " " },
    { kind: "image", url: 123 },
    { kind: "image", url: "a.png", fit: "cover" },
    { kind: "image", url: "a.png", fit: null },
    { kind: "image", url: "a.png", shape: Shape.Box },
  ],
}))
  it(`rejects invalid ${property} atomically`, () => {
    const view = new Renderable();
    for (const value of values) {
      const before = Reflect.get(view, property),
        revision = view.revision;
      expect(() => Reflect.set(view, property, value)).toThrow();
      expect(Reflect.get(view, property)).toBe(before);
      expect(view.revision).toBe(revision);
      expect(() => new Renderable({ [property]: value })).toThrow();
    }
  });
