function required<T>(value: T | undefined): T {
  if (value === undefined) throw Error("Expected editing session");
  return value;
}

import { CanvasColumn, CanvasSelect, CanvasUI, Scene } from "@simpludify/core";
import { describe, expect, it } from "vitest";

const options = [
  { label: "Easy", value: "easy" },
  { label: "Normal", value: "normal" },
  { label: "Locked", value: "hard", disabled: true },
];
describe("CanvasSelect", () => {
  it("copies labeled options and keeps typed values", () => {
    const select = CanvasSelect(options, { value: "normal" });
    expect(select.value).toBe("normal");
    expect(select.options).not.toBe(options);
    expect(select.control.model.kind).toBe("select");
    const object = { id: 1 };
    expect(CanvasSelect([{ label: "One", value: object }]).value).toBe(object);
  });
  it("publishes one accepted change and commit per transaction", () => {
    const select = CanvasSelect(options),
      changes: unknown[] = [],
      commits: unknown[] = [];
    select.onChange((e) => changes.push([e.previous, e.value, e.source]));
    select.onCommit((e) => commits.push([e.previous, e.value, e.source]));
    const session = required(select.beginSelection("pointer"));
    session.update(1);
    expect(select.value).toBe("easy");
    session.commit();
    expect(changes).toEqual([["easy", "normal", "pointer"]]);
    expect(commits).toEqual(changes);
    expect(session.active).toBe(false);
    expect(session.update(0)).toBe(false);
  });
  it("cancels Escape drafts without changing accepted values", () => {
    const select = CanvasSelect(options),
      cancels: string[] = [];
    select.onCancel((e) => cancels.push(e.source));
    const session = required(select.beginSelection());
    session.update(1);
    session.cancel();
    session.cancel();
    expect(select.value).toBe("easy");
    expect(cancels).toEqual(["keyboard"]);
  });
  it("invalidates old sessions on equal program writes and options replacement", () => {
    const select = CanvasSelect(options),
      first = required(select.beginSelection());
    select.value = "easy";
    expect(first.update(1)).toBe(false);
    const second = required(select.beginSelection());
    select.setOptions([{ label: "New", value: "new" }]);
    expect(second.commit()).toBe(false);
    expect(select.value).toBe("new");
    select.setOptions([]);
    expect(select.value).toBeUndefined();
  });
  it("rejects unknown/ambiguous values and disabled user choices atomically", () => {
    const select = CanvasSelect(options);
    expect(() => {
      select.value = "absent";
    }).toThrow();
    expect(() =>
      select.setOptions([
        { label: "a", value: "a" },
        { label: "b", value: "a" },
      ]),
    ).toThrow();
    const session = required(select.beginSelection());
    expect(() => session.update(2)).toThrow();
    expect(() => session.update(1.5)).toThrow();
    expect(select.value).toBe("easy");
    select.value = "hard";
    expect(select.value).toBe("hard");
  });
  it.each(["readOnly", "enabled", "visible"] as const)(
    "ends sessions on %s change",
    (flag) => {
      const select = CanvasSelect(options),
        session = required(select.beginSelection());
      select[flag] = flag === "readOnly";
      expect(session.active).toBe(false);
      expect(session.update(1)).toBe(false);
    },
  );
  it("reuses logical focus, blur acceptance and Scene disposal", () => {
    const scene = new Scene("native"),
      a = CanvasSelect(options),
      b = CanvasSelect(options),
      ui = new CanvasUI(scene, CanvasColumn([a, b]));
    ui.layout(400, 400, () => ({ width: 40, height: 20 }));
    ui.focus(a);
    const session = required(a.beginSelection());
    session.update(1);
    ui.focus(b);
    expect(a.value).toBe("normal");
    const next = required(b.beginSelection());
    scene.dispose();
    expect(next.active).toBe(false);
    expect(next.update(1)).toBe(false);
    expect(b.events.listenerCount()).toBe(0);
  });
  it("does not mutate disposed controls or resurrect subscriptions", () => {
    const select = CanvasSelect(options);
    select.dispose();
    expect(select.beginSelection()).toBeUndefined();
    expect(() => select.setOptions(options)).toThrow();
    expect(() => {
      select.value = "normal";
    }).toThrow();
  });
});

import { CanvasTextInput, type CanvasTextSnapshot } from "@simpludify/core";

const draft = (text: string, composing = false): CanvasTextSnapshot => ({
  text,
  selectionStart: text.length,
  selectionEnd: text.length,
  direction: "none",
  composing,
});
describe("CanvasTextInput native sessions", () => {
  it("separates accepted values from drafts and sends one change/commit", () => {
    const node = CanvasTextInput({ value: "old" }),
      changes: string[] = [],
      commits: string[] = [],
      drafts: string[] = [];
    node.onChange((e) => changes.push(e.value));
    node.onCommit((e) => commits.push(e.value));
    node.onDraftChange((e) => drafts.push(e.draft.text));
    const session = required(node.beginTextEdit());
    session.update(draft("new"));
    session.update(draft("new"));
    expect(node.value).toBe("old");
    expect(node.draft.text).toBe("new");
    expect(changes).toEqual([]);
    expect(drafts).toEqual(["new"]);
    expect(session.commit()).toBe(true);
    expect(changes).toEqual(["new"]);
    expect(commits).toEqual(["new"]);
    expect(session.commit()).toBe(false);
  });
  it("preserves Japanese, emoji and combining text with native UTF-16 selection", () => {
    const node = CanvasTextInput(),
      text = "日本語A😀e\u0301";
    const session = required(node.beginTextEdit());
    session.update({
      ...draft(text),
      selectionStart: 3,
      selectionEnd: 6,
      direction: "backward",
    });
    expect(node.draft.selectionEnd).toBe(6);
    expect(node.draft.direction).toBe("backward");
    session.commit();
    expect(node.value).toBe(text);
  });
  it("reports composition without publishing an accepted value and cancels on blur", () => {
    const a = CanvasTextInput({ value: "start" }),
      b = CanvasTextInput(),
      scene = new Scene("ime"),
      ui = new CanvasUI(scene, CanvasColumn([a, b]));
    ui.layout(400, 400, () => ({ width: 40, height: 20 }));
    ui.focus(a);
    const session = required(a.beginTextEdit());
    session.update(draft("にほん", true));
    expect(a.value).toBe("start");
    expect(a.draft.composing).toBe(true);
    ui.focus(b);
    expect(session.active).toBe(false);
    expect(a.value).toBe("start");
    expect(a.draft.text).toBe("start");
    scene.dispose();
  });
  it("compositionend updates can be repeated without duplicate form commits", () => {
    const node = CanvasTextInput(),
      changes: string[] = [];
    node.onChange((e) => changes.push(e.value));
    const session = required(node.beginTextEdit());
    session.update(draft("に", true));
    session.update(draft("日本", false));
    session.update(draft("日本", false));
    expect(changes).toEqual([]);
    session.commit();
    expect(changes).toEqual(["日本"]);
  });
  it("Escape restores accepted text and program supersession rejects late callbacks", () => {
    const node = CanvasTextInput({ value: "a" });
    let cancels = 0;
    node.onCancel(() => cancels++);
    const first = required(node.beginTextEdit());
    first.update(draft("b"));
    first.cancel();
    expect(node.draft.text).toBe("a");
    expect(cancels).toBe(1);
    const second = required(node.beginTextEdit());
    second.update(draft("変換", true));
    node.value = "program";
    const third = required(node.beginTextEdit());
    expect(second.update(draft("late"))).toBe(false);
    expect(second.commit()).toBe(false);
    expect(third.id).toBeGreaterThan(second.id);
    expect(node.value).toBe("program");
  });
  it("validates constraints atomically and never accepts overlong composition", () => {
    const node = CanvasTextInput({ value: "😀", maxLength: 2 });
    expect(() => node.setMaxLength(1)).toThrow();
    expect(node.maxLength).toBe(2);
    expect(() => {
      node.value = "abc";
    }).toThrow();
    const session = required(node.beginTextEdit());
    session.update(draft("日本語", true));
    session.update(draft("日本語"));
    expect(session.commit()).toBe(false);
    expect(node.value).toBe("😀");
    expect(node.editing).toBe(false);
    node.setMaxLength(undefined);
    node.value = "longer";
    expect(node.value).toBe("longer");
    expect(() => CanvasTextInput({ maxLength: -1 })).toThrow();
    expect(() => CanvasTextInput({ value: "a\nb" })).toThrow();
  });
  it("rejects malformed snapshots without corrupting the editor", () => {
    const node = CanvasTextInput(),
      session = required(node.beginTextEdit());
    for (const invalid of [
      { ...draft("x"), selectionStart: -1 },
      { ...draft("x"), selectionEnd: 2 },
      { ...draft("x"), selectionStart: 0.5 },
      draft("x\ny"),
    ])
      expect(() => session.update(invalid)).toThrow();
    expect(node.draft.text).toBe("");
  });
  it.each(["readOnly", "enabled", "visible"] as const)(
    "invalidates text editing on %s",
    (flag) => {
      const node = CanvasTextInput({ value: "a" }),
        session = required(node.beginTextEdit());
      session.update(draft("b"));
      node[flag] = flag === "readOnly";
      expect(session.active).toBe(false);
      expect(node.value).toBe("a");
      expect(node.editing).toBe(false);
    },
  );
  it("reentrant program replacement wins over a commit callback", () => {
    const node = CanvasTextInput({ value: "a" }),
      commits: string[] = [];
    node.onChange((e) => {
      if (e.source !== "program") node.value = "replacement";
    });
    node.onCommit((e) => commits.push(e.value));
    const session = required(node.beginTextEdit());
    session.update(draft("b"));
    expect(() => session.commit()).toThrow();
    expect(node.value).toBe("replacement");
    expect(commits).toEqual([]);
  });
  it("disposal cancels drafts, listeners and late session writes", () => {
    const node = CanvasTextInput(),
      session = required(node.beginTextEdit());
    session.update(draft("に", true));
    node.onDraftChange(() => {});
    node.dispose();
    expect(session.update(draft("late"))).toBe(false);
    expect(node.events.listenerCount()).toBe(0);
    expect(node.editing).toBe(false);
  });
});

import { CanvasNumberInput, CanvasSlider } from "@simpludify/core";

describe("CanvasNumberInput", () => {
  it.each(["", "-", ".", "1e", "NaN", "Infinity", "0x12", "1,2"])(
    "preserves intermediate draft %j until invalid commit",
    (text) => {
      const node = CanvasNumberInput({ value: 5, min: -10, max: 10 }),
        session = required(node.beginTextEdit());
      let cancelled = 0;
      node.onCancel(() => cancelled++);
      session.update(draft(text));
      expect(node.value).toBe(5);
      expect(node.draft.text).toBe(text);
      expect(session.commit()).toBe(false);
      expect(node.value).toBe(5);
      expect(node.draft.text).toBe("5");
      expect(cancelled).toBe(1);
    },
  );
  it("clamps and snaps decimal/exponent drafts using Slider normalization", () => {
    const node = CanvasNumberInput({ min: -2, max: 2, step: 0.1 });
    for (const [text, expected] of [
      [".31", 0.3],
      ["-1.26", -1.3],
      ["1e8", 2],
      ["-3", -2],
    ] as const) {
      const session = required(node.beginTextEdit());
      session.update(draft(text));
      expect(session.commit()).toBe(true);
      expect(node.value).toBe(expected);
    }
  });
  it("rejects nonfinite program values and invalid ranges without ending a draft", () => {
    const node = CanvasNumberInput({ value: 5 }),
      session = required(node.beginTextEdit());
    session.update(draft("-"));
    for (const value of [NaN, Infinity, -Infinity])
      expect(() => {
        node.value = value;
      }).toThrow();
    expect(() => node.setRange({ step: 0 })).toThrow();
    expect(session.active).toBe(true);
    expect(node.value).toBe(5);
  });
  it("applies dynamic ranges atomically and revokes pending sessions", () => {
    const node = CanvasNumberInput({ value: 50 }),
      session = required(node.beginTextEdit());
    session.update(draft("80"));
    node.setRange({ max: 10, step: 0.5 });
    expect(node.value).toBe(10);
    expect(node.draft.text).toBe("10");
    expect(session.update(draft("99"))).toBe(false);
  });
  it("steps with keys, protects composition and saturates large endpoints", () => {
    const node = CanvasNumberInput({ value: 5 });
    node.control.key("ArrowUp");
    expect(node.value).toBe(6);
    const session = required(node.beginTextEdit());
    session.update(draft("7", true));
    node.control.key("ArrowUp");
    expect(node.value).toBe(6);
    expect(session.active).toBe(true);
    session.cancel();
    node.setRange({ max: 1e308, step: 1e308 });
    node.control.key("PageUp");
    expect(node.value).toBe(1e308);
  });
  it("shares numeric state with Slider without duplicate loops and revokes stale text", () => {
    const node = CanvasNumberInput({ value: 50 }),
      slider = CanvasSlider({ value: 50 });
    node.onChange((e) => {
      slider.value = e.value;
    });
    slider.onChange((e) => {
      node.value = e.value;
    });
    const session = required(node.beginTextEdit());
    session.update(draft("25"));
    session.commit();
    expect(slider.value).toBe(25);
    const next = required(node.beginTextEdit());
    next.update(draft("-"));
    slider.value = 75;
    expect(node.value).toBe(75);
    expect(next.active).toBe(false);
  });
});

it("native blur callbacks can redirect focus without leaving multiple focused nodes", () => {
  const scene = new Scene("redirect"),
    a = CanvasTextInput(),
    b = CanvasTextInput(),
    c = CanvasTextInput(),
    ui = new CanvasUI(scene, CanvasColumn([a, b, c]));
  ui.layout(400, 400, () => ({ width: 40, height: 20 }));
  ui.focus(a);
  a.onCommit(() => ui.focus(c));
  const session = required(a.beginTextEdit());
  session.update(draft("accepted"));
  ui.focus(b);
  expect(ui.focusedNode).toBe(c);
  expect([a.focused, b.focused, c.focused]).toEqual([false, false, true]);
  scene.dispose();
});
it("errors in cancellation handlers cannot leave native sessions editing", () => {
  const node = CanvasTextInput({ value: "old" }),
    session = required(node.beginTextEdit());
  node.onCancel(() => {
    throw Error("observer");
  });
  session.update(draft("pending"));
  expect(() => session.cancel()).toThrow();
  expect(session.active).toBe(false);
  expect(node.editing).toBe(false);
  expect(node.value).toBe("old");
  node.dispose();
});
