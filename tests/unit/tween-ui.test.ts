import {
  CanvasButton,
  CanvasColumn,
  CanvasPanel,
  CanvasScroll,
  CanvasSlider,
  CanvasUI,
  canvasOpacity,
  canvasSliderGeometry,
  canvasTween,
  Engine,
  Scene,
  sliderTween,
  Tween,
  TweenScheduler,
} from "@simpludify/core";
import { expect, it } from "vitest";

function fixture() {
  const e = new Engine(),
    button = CanvasButton("moving", () => {}, {
      width: 100,
      height: 40,
      shrink: 0,
    }),
    sibling = CanvasButton("stable", () => {}, { height: 40, shrink: 0 }),
    panel = CanvasColumn([button], { height: 60, shrink: 0 }),
    ui = new CanvasUI(e.scene, CanvasColumn([panel, sibling], { gap: 10 }));
  const layout = () => ui.layout(400, 300, () => ({ width: 60, height: 20 }));
  layout();
  e.step(0);
  return { e, button, sibling, panel, ui, layout };
}
it("presentation translation moves descendants, hit/focus and clipping without Flex reallocation", () => {
  const f = fixture(),
    initial = { ...f.button.bounds },
    sibling = { ...f.sibling.bounds },
    layouts = f.ui.diagnostics.layouts;
  f.e.scene.presentationTweens.play(
    Tween.to(canvasTween(f.panel).offsetX, 100, { duration: 1 }),
  );
  f.e.scene.advancePresentation(0.5);
  f.layout();
  expect(f.button.bounds.x).toBe(initial.x + 50);
  expect(f.sibling.bounds).toEqual(sibling);
  expect(f.ui.hitTest(initial.x + 5, initial.y + 5)).not.toBe(f.button);
  expect(f.ui.hitTest(initial.x + 55, initial.y + 5)).toBe(f.button);
  f.ui.focus(f.button);
  expect(f.ui.focusedNode).toBe(f.button);
  expect(f.ui.diagnostics.layouts).toBe(layouts);
  f.e.dispose();
});
it("nested scroll projection and presentation are composed once and retain unshifted ranges", () => {
  const e = new Engine(),
    b = CanvasButton("child", () => {}, { height: 40, width: 100, shrink: 0 }),
    scroll = CanvasScroll([b, CanvasPanel([], { height: 200, shrink: 0 })], {
      height: 60,
      width: 140,
    }),
    ui = new CanvasUI(e.scene, CanvasColumn([scroll]));
  const layout = () => ui.layout(300, 200, () => ({ width: 40, height: 20 }));
  layout();
  const range = scroll.maxScrollY;
  scroll.setPresentation({ offsetX: 40 });
  scroll.scrollTo(0, 10);
  layout();
  expect(b.bounds.x).toBe(40);
  expect(b.bounds.y).toBe(-10);
  expect(scroll.maxScrollY).toBe(range);
  expect(ui.hitTest(50, 5)).toBe(b);
  expect(ui.hitTest(10, 5)).toBeUndefined();
  e.dispose();
});
it("opacity is inherited, paint-only, and zero opacity releases focus and input availability", () => {
  const f = fixture(),
    layouts = f.ui.diagnostics.layouts;
  f.ui.focus(f.button);
  f.panel.setPresentation({ opacity: 0.5 });
  f.button.setPresentation({ opacity: 0.5 });
  expect(canvasOpacity(f.button)).toBe(0.25);
  f.layout();
  expect(f.ui.diagnostics.layouts).toBe(layouts);
  f.panel.setPresentation({ opacity: 0 });
  expect(f.button.available).toBe(false);
  expect(f.ui.focusedNode).toBeUndefined();
  expect(f.ui.hitTest(5, 5)).not.toBe(f.button);
  f.e.scene.presentationTweens.play(
    Tween.to(canvasTween(f.panel).opacity, 1, { duration: 1 }),
  );
  f.e.scene.advancePresentation(1);
  expect(f.button.available).toBe(true);
  f.e.dispose();
});
it("UI removal cancels node-owned playback; new UI cannot inherit stale writes", () => {
  const f = fixture(),
    clock = f.e.scene.presentationTweens,
    p = clock.play(
      Tween.to(canvasTween(f.button).offsetX, 100, { duration: 1 }),
    );
  f.button.dispose();
  expect(p.state).toBe("cancelled");
  clock.advance(1);
  expect(f.button.presentation.offsetX).toBe(0);
  f.e.dispose();
});
it("invalid presentation is atomic and composed overflow never reaches projected bounds", () => {
  const f = fixture();
  for (const patch of [
    { offsetX: Infinity },
    { offsetY: NaN },
    { opacity: 2 },
    { opacity: -1 },
  ])
    expect(() => f.button.setPresentation(patch)).toThrow();
  expect(f.button.presentation).toEqual({ offsetX: 0, offsetY: 0, opacity: 1 });
  f.panel.setPresentation({ offsetX: 1e308 });
  f.button.setPresentation({ offsetX: 1e308 });
  expect(() => f.layout()).toThrow();
  f.e.dispose();
});
function sliderFixture(readOnly = false) {
  const s = CanvasSlider({ value: 50, readOnly }),
    clock = new TweenScheduler(),
    sources: string[] = [],
    commits: string[] = [];
  s.onChange((e) => sources.push(e.source));
  s.onCommit((e) => commits.push(e.source));
  return { s, clock, sources, commits };
}
it("logical Slider Tween uses normalization and program change, never user commit", () => {
  const f = sliderFixture(),
    p = f.clock.play(Tween.to(sliderTween(f.s), 80, { duration: 1 }));
  f.clock.advance(0.5);
  expect(f.s.value).toBe(65);
  expect(f.s.displayValue).toBe(65);
  f.clock.advance(0.5);
  expect(f.s.value).toBe(80);
  expect(f.sources).toEqual(["program", "program"]);
  expect(f.commits).toEqual([]);
  expect(p.state).toBe("completed");
  f.s.dispose();
});
it("display Tween keeps logical value and semantic label immediate while bar ratio interpolates", () => {
  const f = sliderFixture(true);
  f.s.value = 20;
  f.s.displayValue = 100;
  f.sources.length = 0;
  f.clock.play(Tween.to(sliderTween(f.s, "display"), 20, { duration: 1 }));
  f.clock.advance(0.5);
  expect(f.s.value).toBe(20);
  expect(f.s.displayValue).toBe(60);
  expect(f.s.control.model.kind === "slider" && f.s.control.model.ratio).toBe(
    0.6,
  );
  expect(f.sources).toEqual([]);
  expect(f.commits).toEqual([]);
  f.s.dispose();
});
it("read-only Slider still accepts explicit logical program animation", () => {
  const f = sliderFixture(true);
  f.clock.play(Tween.to(sliderTween(f.s), 80, { duration: 1 }));
  f.clock.advance(1);
  expect(f.s.value).toBe(80);
  expect(f.commits).toEqual([]);
  f.s.dispose();
});
it.each([
  "equal-program",
  "range",
  "readOnly",
  "disable",
  "hide",
  "parent-disable",
] as const)(
  "Slider %s command immediately cancels owned animation",
  (command) => {
    const f = sliderFixture(),
      parent = CanvasColumn([f.s]),
      scene = new Scene("ui"),
      ui = new CanvasUI(scene, parent);
    ui.layout(400, 300, () => ({ width: 60, height: 20 }));
    const p = f.clock.play(Tween.to(sliderTween(f.s), 80, { duration: 1 }));
    if (command === "equal-program") f.s.value = 50;
    else if (command === "range") f.s.setRange({ max: 200 });
    else if (command === "readOnly") f.s.readOnly = true;
    else if (command === "disable") f.s.enabled = false;
    else if (command === "hide") f.s.visible = false;
    else parent.enabled = false;
    expect(p.state).toBe("cancelled");
    f.clock.advance(1);
    expect(f.s.value).toBe(50);
    expect(f.clock.diagnostics.active).toBe(0);
    scene.dispose();
  },
);
it("pointer begin at equal value cancels before any value change and dragging never fights back", () => {
  const f = sliderFixture(),
    scene = new Scene("slider"),
    ui = new CanvasUI(scene, CanvasColumn([f.s]));
  ui.layout(400, 300, () => ({ width: 50, height: 20 }));
  const g = canvasSliderGeometry(f.s);
  if (!g) throw Error("geometry");
  const p = f.clock.play(Tween.to(sliderTween(f.s), 80, { duration: 1 }));
  f.s.control.beginPointer(g.track.x + g.track.width * 0.5, g.track.y);
  expect(p.state).toBe("cancelled");
  expect(f.s.value).toBe(50);
  f.s.control.movePointer(g.track.x + g.track.width * 0.25, g.track.y);
  f.clock.advance(1);
  expect(f.s.value).toBe(25);
  f.s.control.endPointer(false);
  expect(f.commits).toEqual(["pointer"]);
  scene.dispose();
});
it("keyboard and reentrant program observers override Tween writes and suppress completion", () => {
  const f = sliderFixture();
  let completed = 0;
  const p = f.clock.play(Tween.to(sliderTween(f.s), 80, { duration: 1 }), {
    onComplete: () => {
      completed++;
    },
  });
  f.s.onChange(({ value }) => {
    f.s.value = value;
  }, f.s);
  f.clock.advance(0.5);
  expect(p.state).toBe("cancelled");
  expect(f.s.value).toBe(65);
  expect(completed).toBe(0);
  const q = f.clock.play(Tween.to(sliderTween(f.s), 60, { duration: 1 }));
  f.s.control.key("ArrowRight");
  expect(q.state).toBe("cancelled");
  f.clock.advance(1);
  expect(completed).toBe(0);
  f.s.dispose();
});
it("logical/display tweens conflict and canceled/finished subscriptions are released", () => {
  const f = sliderFixture(),
    scene = new Scene("scope"),
    parent = CanvasColumn([f.s]),
    ui = new CanvasUI(scene, parent);
  ui.layout(400, 300, () => ({ width: 60, height: 20 }));
  const p = f.clock.play(Tween.to(sliderTween(f.s), 80, { duration: 1 }));
  const q = f.clock.play(
    Tween.to(sliderTween(f.s, "display"), 20, { duration: 1 }),
  );
  expect(p.reason).toBe("replaced");
  q.finish();
  expect(f.clock.diagnostics.active).toBe(0);
  const observed = f.s as unknown as {
    intentObservers: Set<() => void>;
    mutationObservers: Set<() => void>;
  };
  expect(observed.intentObservers.size).toBe(0);
  expect(observed.mutationObservers.size).toBe(0);
  scene.dispose();
});

it("a changed program write from onChange keeps its value and reports existing EventBus recursion", () => {
  const f = sliderFixture();
  let complete = 0;
  const p = f.clock.play(Tween.to(sliderTween(f.s), 80, { duration: 1 }), {
    onComplete: () => {
      complete++;
    },
  });
  f.s.onChange(() => {
    f.s.value = 10;
  });
  expect(() => f.clock.advance(0.5)).toThrow();
  expect(p.state).toBe("cancelled");
  expect(f.s.value).toBe(10);
  expect(complete).toBe(0);
  expect(f.clock.diagnostics.active).toBe(0);
  f.s.dispose();
});

it("a transparent presentation can fade in alongside a Slider value sequence", () => {
  const e = new Engine(),
    s = CanvasSlider({ value: 0 }),
    panel = CanvasColumn([s]),
    ui = new CanvasUI(e.scene, panel);
  ui.layout(400, 300, () => ({ width: 50, height: 20 }));
  panel.setPresentation({ opacity: 0 });
  e.step(0);
  const p = e.scene.presentationTweens.play(
    Tween.parallel(
      Tween.to(canvasTween(panel).opacity, 1, { duration: 1 }),
      Tween.sequence(
        Tween.delay(0.25),
        Tween.to(sliderTween(s), 100, { duration: 0.75 }),
      ),
    ),
  );
  e.scene.advancePresentation(0.5);
  expect(panel.presentation.opacity).toBe(0.5);
  expect(s.value).toBe(33);
  e.scene.advancePresentation(0.5);
  expect(p.state).toBe("completed");
  expect(s.value).toBe(100);
  e.dispose();
});
