import {
  CanvasCheckbox,
  CanvasColumn,
  CanvasLabel,
  type CanvasNode,
  CanvasScroll,
  CanvasSlider,
  CanvasUI,
  canvasControlText,
  canvasSliderGeometry,
  Lifetime,
  PointerClick,
  PointerDown,
  PointerRouting,
  Scene,
  ScenePointer,
  screenPoint,
  worldPoint,
} from "@simpludify/core";
import { expect, it } from "vitest";

const p = (x: number, y: number, pointerId = 1, button = 0) => ({
  pointerId,
  button,
  buttons: 1,
  pointerType: "touch",
  inside: true,
  screen: screenPoint(x, y),
  world: worldPoint(x, y),
});
const measure = (n: CanvasNode) => ({
  width: canvasControlText(n).length * 7 + (n.kind === "checkbox" ? 30 : 0),
  height: 20,
});
function fixture(scale = 1) {
  const scene = new Scene("controls"),
    checkbox = CanvasCheckbox("音声 / Sound", { checked: true }),
    slider = CanvasSlider({ label: "音量 / Volume", value: 50 });
  const root = CanvasScroll(
    [
      checkbox,
      slider,
      ...Array.from({ length: 8 }, () =>
        CanvasLabel("content", { height: 50 }),
      ),
    ],
    { width: 300, height: 150, gap: 8, inertia: false },
  );
  const ui = new CanvasUI(scene, root, { scale }),
    routing = new PointerRouting(),
    channel = new ScenePointer(scene);
  routing.setScene(channel, ui);
  const flush = () => ui.layout(300 * scale, 150 * scale, measure);
  flush();
  const point = (n: CanvasNode, ratio = 0.5, id = 1) =>
    p(
      (n.bounds.x + n.bounds.width * ratio) * scale,
      (n.bounds.y + n.bounds.height / 2) * scale,
      id,
    );
  return { scene, checkbox, slider, root, ui, routing, channel, flush, point };
}
it("validates checkbox flags and notifies changed program values with typed snapshots", () => {
  const c = CanvasCheckbox("音声", { checked: true }),
    events: unknown[] = [];
  c.onChange((e) => events.push([e.previous, e.value, e.source]));
  c.checked = false;
  c.value = false;
  c.setValue(true);
  expect(events).toEqual([
    [true, false, "program"],
    [false, true, "program"],
  ]);
  expect(c.checked).toBe(true);
  expect(c.text).toBe("音声");
  expect(() => c.setValue(1 as unknown as boolean)).toThrow();
  expect(c.value).toBe(true);
  expect(() =>
    CanvasCheckbox("x", { checked: "yes" as unknown as boolean }),
  ).toThrow();
  expect(() =>
    CanvasCheckbox("x", { readOnly: 1 as unknown as boolean }),
  ).toThrow();
  c.dispose();
  expect(() => c.setValue(false)).toThrow();
  expect(() => {
    c.readOnly = true;
  }).toThrow();
});
it("toggles Checkbox on valid primary release and ignores cancelled/outside/secondary presses", () => {
  const f = fixture(),
    q = f.point(f.checkbox),
    commits: string[] = [];
  f.checkbox.onCommit((e) => commits.push(e.source));
  f.routing.down(q);
  expect(f.checkbox.checked).toBe(true);
  f.routing.up(q);
  expect(f.checkbox.checked).toBe(false);
  f.routing.down(q);
  f.routing.cancel(1);
  f.routing.up(q);
  expect(f.checkbox.checked).toBe(false);
  f.routing.down({ ...q, button: 2 });
  f.routing.up({ ...q, button: 2 });
  expect(f.checkbox.checked).toBe(false);
  f.routing.down(q);
  f.routing.up(p(500, 10));
  expect(f.checkbox.checked).toBe(false);
  expect(commits).toEqual(["pointer"]);
  f.scene.dispose();
});
it("handles Enter/Space once and cancels pending checkbox key input on program/read-only commands", () => {
  const f = fixture(),
    c = f.checkbox;
  f.ui.focus(c);
  f.routing.key(c, "Space", true);
  f.routing.key(c, "Space", true);
  f.routing.key(c, "Space", false);
  expect(c.value).toBe(false);
  f.routing.key(c, "Enter", true);
  c.setValue(false);
  f.routing.key(c, "Enter", false);
  expect(c.value).toBe(false);
  f.routing.key(c, "Space", true);
  c.readOnly = true;
  c.readOnly = false;
  f.routing.key(c, "Space", false);
  expect(c.value).toBe(false);
  f.routing.key(c, "Enter", true);
  f.routing.releaseKeys(c);
  f.routing.key(c, "Enter", false);
  expect(c.value).toBe(false);
  f.scene.dispose();
});
it("read-only keeps focus/program updates but blocks user changes; disabled ancestors release focus", () => {
  const f = fixture();
  f.checkbox.readOnly = true;
  f.ui.focus(f.checkbox);
  f.checkbox.activate();
  expect(f.checkbox.value).toBe(true);
  f.checkbox.value = false;
  expect(f.checkbox.value).toBe(false);
  expect(f.ui.focusedNode).toBe(f.checkbox);
  f.root.enabled = false;
  expect(f.ui.focusedNode).toBeUndefined();
  expect(f.routing.controlKey(f.slider, "End")).toBe(false);
  f.scene.dispose();
});
it("scopes subscriptions to owners and continues delivery/commit after a listener throws", () => {
  const c = CanvasCheckbox("c"),
    owner = new Lifetime();
  let calls = 0,
    commits = 0;
  c.onChange(() => {
    throw Error("listener");
  }, owner);
  c.onChange(() => calls++);
  c.onCommit(() => commits++);
  expect(() => c.activate()).toThrow();
  expect(c.value).toBe(true);
  expect(calls).toBe(1);
  expect(commits).toBe(1);
  owner.dispose();
  c.activate();
  expect(c.value).toBe(false);
  expect(c.events.listenerCount()).toBe(2);
  c.dispose();
  expect(c.events.listenerCount()).toBe(0);
});
it("Slider clamps, snaps decimals and keeps both non-grid endpoints reachable", () => {
  const s = CanvasSlider({ min: 0, max: 1, step: 0.1, value: 0.31 });
  expect(s.value).toBe(0.3);
  s.value = -5;
  expect(s.value).toBe(0);
  s.value = 5;
  expect(s.value).toBe(1);
  s.setRange({ max: 0.95 });
  s.value = 0.95;
  expect(s.value).toBe(0.95);
  s.value = 0.54;
  expect(s.value).toBe(0.5);
  const huge = CanvasSlider({ min: 1e15, max: 1e15 + 10, value: 1e15 + 1 });
  expect(huge.value).toBe(1e15 + 1);
  for (const value of [NaN, Infinity, -Infinity])
    expect(() => s.setValue(value)).toThrow();
  expect(s.value).toBe(0.5);
});
it.each([
  { min: 1, max: 1 },
  { min: 2, max: 1 },
  { step: 0 },
  { step: -1 },
  { max: Infinity },
  { min: -1e308, max: 1e308 },
  { step: Number.MIN_VALUE },
])("rejects invalid slider ranges atomically: %o", (patch) => {
  const s = CanvasSlider({ value: 50 });
  expect(() => s.setRange(patch)).toThrow();
  expect([s.min, s.max, s.step, s.value]).toEqual([0, 100, 1, 50]);
});
it("Slider keys own range adjustment before ancestor scroll and do not repeat Flex layout", () => {
  const f = fixture();
  f.ui.focus(f.slider);
  const layouts = f.ui.diagnostics.layouts;
  for (const key of ["ArrowRight", "ArrowUp", "PageUp"])
    expect(f.routing.controlKey(f.slider, key)).toBe(true);
  expect(f.slider.value).toBe(62);
  f.routing.controlKey(f.slider, "Home");
  expect(f.slider.value).toBe(0);
  f.routing.controlKey(f.slider, "End");
  expect(f.slider.value).toBe(100);
  f.slider.readOnly = true;
  f.routing.controlKey(f.slider, "ArrowLeft");
  expect(f.slider.value).toBe(100);
  expect(f.routing.controlKey(f.slider, "KeyA")).toBe(false);
  f.flush();
  expect(f.ui.diagnostics.layouts).toBe(layouts);
  expect(f.root.scrollY).toBe(0);
  f.scene.dispose();
});
it("commits a Slider pointer edit once and preserves immediate value without commit on cancellation", () => {
  const f = fixture(),
    commits: number[] = [],
    cancels: number[] = [];
  f.slider.onCommit((e) => commits.push(e.value));
  f.slider.onCancel((e) => cancels.push(e.value));
  const q = f.point(f.slider, 0.3);
  f.routing.down(q);
  expect(f.slider.editing).toBe(true);
  f.routing.move({ ...q, screen: screenPoint(240, q.screen.y) });
  const value = f.slider.value;
  f.routing.up({ ...q, screen: screenPoint(240, q.screen.y) });
  expect(value).toBeGreaterThan(50);
  expect(commits).toEqual([value]);
  expect(f.slider.editing).toBe(false);
  f.routing.down(q);
  const current = f.slider.value;
  f.routing.cancel(1);
  f.routing.cancel(1);
  expect(f.slider.value).toBe(current);
  expect(cancels).toEqual([current]);
  expect(commits).toHaveLength(1);
  expect(f.routing.diagnostics.controlDrags).toBe(0);
  f.scene.dispose();
});
it.each([1, 2])(
  "vertical scrolling cancels a pending Slider/Checkbox without activation at UI scale %d",
  (scale) => {
    const f = fixture(scale);
    let commits = 0,
      cancels = 0,
      world = 0;
    f.slider.onCommit(() => commits++);
    f.slider.onCancel(() => cancels++);
    f.channel.events.on(PointerClick, () => world++);
    const q = f.point(f.slider);
    f.routing.down(q);
    f.routing.move(p(q.screen.x, q.screen.y - 40 * scale));
    expect(f.slider.editing).toBe(false);
    expect(f.root.scrollY).toBeGreaterThan(0);
    f.routing.up(p(q.screen.x, q.screen.y - 40 * scale));
    expect(commits).toBe(0);
    expect(cancels).toBe(1);
    expect(world).toBe(0);
    f.root.scrollTo(0, 0);
    f.flush();
    const c = f.point(f.checkbox);
    f.routing.down(c);
    f.routing.move(p(c.screen.x, c.screen.y - 40 * scale));
    f.routing.up(p(c.screen.x, c.screen.y - 40 * scale));
    expect(f.checkbox.checked).toBe(true);
    f.scene.dispose();
  },
);
it("locks horizontal slider intent even when later motion crosses a vertical-scroll threshold", () => {
  const f = fixture(),
    q = f.point(f.slider, 0.3);
  f.routing.down(q);
  f.routing.move(p(q.screen.x + 40, q.screen.y));
  f.routing.move(p(q.screen.x + 70, q.screen.y - 80));
  expect(f.root.scrollY).toBe(0);
  expect(f.slider.editing).toBe(true);
  f.routing.up(p(q.screen.x + 70, q.screen.y - 80));
  expect(f.slider.editing).toBe(false);
  f.scene.dispose();
});
it("owns one pointer per continuous control while separate sliders remain independent", () => {
  const scene = new Scene("two"),
    a = CanvasSlider({ value: 10 }),
    b = CanvasSlider({ value: 20 }),
    ui = new CanvasUI(scene, CanvasColumn([a, b], { gap: 10 })),
    r = new PointerRouting();
  r.setScene(new ScenePointer(scene), ui);
  ui.layout(300, 300, measure);
  const q = p(80, 30),
    t = p(100, 120, 2);
  r.down(q);
  const first = a.value;
  r.down(p(240, 30, 3));
  r.move(p(250, 30, 3));
  expect(a.value).toBe(first);
  r.down(t);
  expect(r.diagnostics.controlDrags).toBe(2);
  r.up(q);
  r.up(t);
  r.up(p(250, 30, 3));
  expect(r.diagnostics.controlDrags).toBe(0);
  scene.dispose();
});
it.each([
  "program",
  "equal",
  "range",
  "readOnly",
  "disabled",
  "hidden",
  "scale",
  "remove",
])(
  "invalidates active editing on %s without a late commit/world click",
  (command) => {
    const f = fixture();
    let commits = 0,
      cancels = 0;
    f.slider.onCommit(() => commits++);
    f.slider.onCancel(() => cancels++);
    const q = f.point(f.slider);
    f.routing.down(q);
    if (command === "program") f.slider.value = 80;
    if (command === "equal") f.slider.setValue(f.slider.value);
    if (command === "range") f.slider.setRange({ max: 60 });
    if (command === "readOnly") f.slider.readOnly = true;
    if (command === "disabled") f.root.enabled = false;
    if (command === "hidden") f.root.visible = false;
    if (command === "scale") f.ui.scale = 2;
    if (command === "remove") f.root.remove(f.slider);
    expect(f.slider.editing).toBe(false);
    expect(f.routing.diagnostics.controlDrags).toBe(0);
    f.routing.up(q);
    expect(commits).toBe(0);
    expect(cancels).toBe(1);
    f.scene.dispose();
  },
);
it("cleans input ownership despite throwing callbacks and disposal inside a change callback", () => {
  const f = fixture(),
    q = f.point(f.slider, 0.2);
  f.slider.onChange(() => {
    throw Error("value");
  });
  f.slider.onCancel(() => {
    throw Error("cancel");
  });
  expect(() => f.routing.down(q)).toThrow();
  expect(() => f.routing.cancel(1)).toThrow();
  expect(f.routing.diagnostics.controlDrags).toBe(0);
  expect(f.slider.editing).toBe(false);
  expect(f.slider.held).toBe(false);
  f.scene.dispose();
  const g = fixture();
  let downs = 0;
  g.slider.onChange(() => g.slider.dispose());
  g.slider.events.on(PointerDown, () => downs++);
  g.routing.down(g.point(g.slider, 0.2));
  expect(downs).toBe(0);
  expect(g.routing.diagnostics.controlDrags).toBe(0);
  g.scene.dispose();
});
it("disposes focused/active controls with their Scene and releases every subscription", () => {
  const f = fixture();
  f.ui.focus(f.slider);
  f.routing.down(f.point(f.slider, 0.3));
  expect(() => f.scene.dispose()).not.toThrow();
  expect(f.slider.editing).toBe(false);
  expect(f.slider.events.listenerCount()).toBe(0);
  expect(f.ui.diagnostics.subscriptions).toBe(0);
  expect(f.routing.diagnostics.controlDrags).toBe(0);
  expect(f.ui.focusedNode).toBeUndefined();
});
it("keeps shared geometry finite at tiny sizes and ignores zero-travel pointer edits", () => {
  const f = fixture();
  f.slider.setStyle({ width: 1, height: 1, minHeight: 0, padding: 0 });
  f.flush();
  const geometry = canvasSliderGeometry(f.slider);
  expect(geometry).toBeDefined();
  if (!geometry) throw Error("Missing slider geometry");
  expect(Object.values(geometry.thumb).every(Number.isFinite)).toBe(true);
  const value = f.slider.value;
  f.routing.down(f.point(f.slider));
  f.routing.up(f.point(f.slider));
  expect(f.slider.value).toBe(value);
  f.scene.dispose();
});
