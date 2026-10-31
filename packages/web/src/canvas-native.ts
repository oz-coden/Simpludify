import { type CanvasNode, type CanvasUI, type CanvasNativeSession, intersectUI, type UIBounds } from "@simpludify/core";

/** Host-owned native popup; indices never escape into application values. */
export class CanvasNativeSelect {
  readonly element = document.createElement("select");
  private session: CanvasNativeSession<number> | undefined;
  private signature = "";
  constructor(private readonly node: CanvasNode, private readonly ui: CanvasUI, signal: AbortSignal, traverse: (reverse: boolean) => boolean) {
    const el = this.element;
    el.className = "s-canvas-native";
    const run = (task: () => void) => { try { task(); } catch (error) { ui.report(error); } };
    const begin = (source: "pointer" | "keyboard") => {
      const port = node.control?.native;
      if (port?.kind === "select") this.session = port.begin(source);
    };
    el.addEventListener("focus", () => run(() => { ui.focus(node); }), { signal });
    el.addEventListener("pointerdown", (e) => run(() => {
      if (node.control?.model.readOnly) { e.preventDefault(); return; }
      begin("pointer");
    }), { signal });
    el.addEventListener("keydown", (e) => run(() => {
      if (e.code === "Tab") { if (traverse(e.shiftKey)) e.preventDefault(); return; }
      if (e.code === "Escape") { this.session?.cancel(); this.session = undefined; this.update(); return; }
      if (node.control?.model.readOnly) { e.preventDefault(); return; }
      begin("keyboard");
    }), { signal });
    el.addEventListener("input", () => run(() => {
      if (!this.session?.active) begin("keyboard");
      this.session?.update(el.selectedIndex);
    }), { signal });
    el.addEventListener("change", () => run(() => {
      if (!this.session?.active) begin("keyboard");
      this.session?.update(el.selectedIndex);
      this.session?.commit();
      this.session = undefined;
      this.update();
    }), { signal });
    el.addEventListener("blur", () => run(() => {
      if (!ui.disposed && ui.focusedNode === node) ui.focus();
      this.session = undefined;
    }), { signal });
    signal.addEventListener("abort", () => node.control?.native?.end("interrupt"), { once: true });
  }
  update(clip?: UIBounds): void {
    const model = this.node.control?.model;
    if (model?.kind !== "select") return;
    const el = this.element;
    const key = JSON.stringify(model.options.map((o) => [o.label, o.disabled]));
    if (key !== this.signature) {
      this.signature = key;
      el.replaceChildren(...model.options.map((o, index) => {
        const option = document.createElement("option");
        option.textContent = o.label;
        option.value = String(index);
        option.disabled = o.disabled;
        return option;
      }));
    }
    if (!this.session?.active) el.selectedIndex = model.selectedIndex;
    el.setAttribute("aria-label", this.node.text);
    el.setAttribute("aria-readonly", String(model.readOnly));
    if (clip) nativeGeometry(el, this.node, this.ui, clip);
  }
}
/** Paint/hit bounds follow full node geometry; clipping never shifts native text/caret offsets. */
export function nativeGeometry(el: HTMLInputElement | HTMLSelectElement, node: CanvasNode, ui: CanvasUI, clip: UIBounds): void {
  const b = node.bounds, c = intersectUI(b, clip), scale = ui.scale, style = node.style;
  el.disabled = !node.available || c.width <= 0 || c.height <= 0 || node.style.pointerEvents !== "auto";
  const color = `#${style.color.toString(16).padStart(6, "0")}`;
  el.style.cssText = `left:${b.x * scale}px;top:${b.y * scale}px;width:${b.width * scale}px;height:${b.height * scale}px;padding:${style.padding * scale}px;font-family:${style.fontFamily};font-size:${style.fontSize * scale}px;color:${color};clip-path:inset(${Math.max(0,c.y-b.y)*scale}px ${Math.max(0,b.x+b.width-c.x-c.width)*scale}px ${Math.max(0,b.y+b.height-c.y-c.height)*scale}px ${Math.max(0,c.x-b.x)*scale}px);`;
  if (el.disabled && document.activeElement === el) el.blur();
}
