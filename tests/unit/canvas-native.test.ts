import { describe, expect, it } from "vitest";
import { CanvasColumn, CanvasSelect, CanvasUI, Scene } from "@simpludify/core";
const options = [{label: "Easy", value: "easy"}, {label: "Normal", value: "normal"}, {label: "Locked", value: "hard", disabled: true}];
describe("CanvasSelect", () => {
  it("copies labeled options and keeps typed values", () => {
    const select = CanvasSelect(options, {value:"normal"});
    expect(select.value).toBe("normal");
    expect(select.options).not.toBe(options);
    expect(select.control.model.kind).toBe("select");
    const object = {id:1};
    expect(CanvasSelect([{label:"One",value:object}]).value).toBe(object);
  });
  it("publishes one accepted change and commit per transaction", () => {
    const select = CanvasSelect(options), changes: unknown[] = [], commits: unknown[] = [];
    select.onChange((e) => changes.push([e.previous,e.value,e.source]));
    select.onCommit((e) => commits.push([e.previous,e.value,e.source]));
    const session = select.beginSelection("pointer")!;
    session.update(1);
    expect(select.value).toBe("easy");
    session.commit();
    expect(changes).toEqual([["easy","normal","pointer"]]);
    expect(commits).toEqual(changes);
    expect(session.active).toBe(false);
    expect(session.update(0)).toBe(false);
  });
  it("cancels Escape drafts without changing accepted values", () => {
    const select = CanvasSelect(options), cancels: string[] = [];
    select.onCancel((e) => cancels.push(e.source));
    const session = select.beginSelection()!;
    session.update(1); session.cancel(); session.cancel();
    expect(select.value).toBe("easy");
    expect(cancels).toEqual(["keyboard"]);
  });
  it("invalidates old sessions on equal program writes and options replacement", () => {
    const select = CanvasSelect(options), first = select.beginSelection()!;
    select.value = "easy";
    expect(first.update(1)).toBe(false);
    const second = select.beginSelection()!;
    select.setOptions([{label:"New",value:"new"}]);
    expect(second.commit()).toBe(false);
    expect(select.value).toBe("new");
    select.setOptions([]);
    expect(select.value).toBeUndefined();
  });
  it("rejects unknown/ambiguous values and disabled user choices atomically", () => {
    const select = CanvasSelect(options);
    expect(() => {select.value = "absent";}).toThrow();
    expect(() => select.setOptions([{label:"a",value:"a"},{label:"b",value:"a"}])).toThrow();
    const session = select.beginSelection()!;
    expect(() => session.update(2)).toThrow();
    expect(() => session.update(1.5)).toThrow();
    expect(select.value).toBe("easy");
    select.value = "hard";
    expect(select.value).toBe("hard");
  });
  it.each(["readOnly","enabled","visible"] as const)("ends sessions on %s change", (flag) => {
    const select = CanvasSelect(options), session = select.beginSelection()!;
    select[flag] = flag === "readOnly";
    expect(session.active).toBe(false);
    expect(session.update(1)).toBe(false);
  });
  it("reuses logical focus, blur acceptance and Scene disposal", () => {
    const scene = new Scene("native"), a = CanvasSelect(options), b = CanvasSelect(options), ui = new CanvasUI(scene, CanvasColumn([a,b]));
    ui.layout(400,400,() => ({width:40,height:20}));
    ui.focus(a);
    const session = a.beginSelection()!;
    session.update(1);
    ui.focus(b);
    expect(a.value).toBe("normal");
    const next = b.beginSelection()!;
    scene.dispose();
    expect(next.active).toBe(false);
    expect(next.update(1)).toBe(false);
    expect(b.events.listenerCount()).toBe(0);
  });
  it("does not mutate disposed controls or resurrect subscriptions", () => {
    const select = CanvasSelect(options); select.dispose();
    expect(select.beginSelection()).toBeUndefined();
    expect(() => select.setOptions(options)).toThrow();
    expect(() => {select.value="normal";}).toThrow();
  });
});
