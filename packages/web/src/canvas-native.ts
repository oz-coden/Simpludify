import {
  type CanvasNode, type CanvasUI, type CanvasNativeSession, type CanvasTextSnapshot,
  intersectUI, type UIBounds,
} from "@simpludify/core";
export interface NativeControlHost {
  traverse(reverse: boolean): boolean;
  wheel(event: WheelEvent): void;
}
/** Engine-owned native surfaces share Core focus/generation/lifetime and never route text through keys. */
abstract class NativeControl {
  abstract readonly element: HTMLInputElement | HTMLSelectElement;
  readonly revision: number;
  protected readonly abort = new AbortController();
  private readonly unparent: () => void;
  protected constructor(protected readonly node: CanvasNode, protected readonly ui: CanvasUI,
    parentSignal: AbortSignal, protected readonly host: NativeControlHost) {
    this.revision = node.control?.revision ?? 0;
    const stop = () => this.dispose();
    parentSignal.addEventListener("abort",stop,{once:true});
    this.unparent = () => parentSignal.removeEventListener("abort",stop);
  }
  protected get live(): boolean {
    return !this.abort.signal.aborted && !this.ui.disposed && this.node.available && this.node.control?.revision === this.revision;
  }
  protected run(task: () => void): void {
    if (!this.live) return;
    try { task(); } catch (error) { this.ui.report(error); }
  }
  protected mount(): void {
    const el = this.element, signal = this.abort.signal;
    el.className = "s-canvas-native";
    el.addEventListener("focus", () => this.run(() => this.ui.focus(this.node)),{signal});
    el.addEventListener("blur", () => {
      if (this.ui.disposed) return;
      try { if (this.ui.focusedNode === this.node) this.ui.focus(); }
      catch (error) { this.ui.report(error); }
    },{signal});
    el.addEventListener("wheel",(e) => this.run(() => this.host.wheel(e as WheelEvent)),{signal,passive:false});
  }
  protected tab(event: KeyboardEvent): boolean {
    if (event.code !== "Tab") return false;
    if (this.host.traverse(event.shiftKey)) event.preventDefault();
    return true;
  }
  abstract update(clip?: UIBounds): void;
  dispose(): void {
    if (this.abort.signal.aborted) return;
    this.abort.abort();
    this.unparent();
    this.node.control?.native?.end("interrupt");
    this.element.remove();
  }
}
/** Native browser/OS popup supplies viewport placement, list scrolling and platform key conventions. */
export class CanvasNativeSelect extends NativeControl {
  readonly element = document.createElement("select");
  private session: CanvasNativeSession<number> | undefined;
  private signature = "";
  constructor(node: CanvasNode, ui: CanvasUI, signal: AbortSignal, host: NativeControlHost) {
    super(node,ui,signal,host);
    this.mount();
    const el = this.element, options = {signal:this.abort.signal};
    const begin = (source: "pointer" | "keyboard") => {
      const port = node.control?.native;
      if (port?.kind === "select") this.session = port.begin(source);
    };
    el.addEventListener("pointerdown", (e) => this.run(() => {
      if (node.control?.model.readOnly) { e.preventDefault(); return; }
      begin("pointer");
    }), options);
    el.addEventListener("keydown", (e) => this.run(() => {
      if (this.tab(e)) return;
      if (e.code === "Escape") { this.session?.cancel(); this.session = undefined; this.update(); return; }
      if (node.control?.model.readOnly) { e.preventDefault(); return; }
      begin("keyboard");
    }), options);
    el.addEventListener("input", () => this.run(() => {
      if (!this.session?.active) begin("keyboard");
      this.session?.update(el.selectedIndex);
    }), options);
    el.addEventListener("change", () => this.run(() => {
      if (!this.session?.active) begin("keyboard");
      this.session?.update(el.selectedIndex);
      this.session?.commit();
      this.session = undefined;
      this.update();
    }), options);
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
/** Native caret, selection, clipboard and IME paint replace Canvas text only while focused. */
export class CanvasNativeText extends NativeControl {
  readonly element = document.createElement("input");
  private session: CanvasNativeSession<CanvasTextSnapshot> | undefined;
  private composing = false;
  private source: "pointer" | "keyboard" = "keyboard";
  constructor(node: CanvasNode, ui: CanvasUI, signal: AbortSignal, host: NativeControlHost) {
    super(node,ui,signal,host);
    const el = this.element;
    el.type = "text";
    el.autocomplete = "off";
    el.spellcheck = false;
    this.mount();
    const options = {signal:this.abort.signal};
    el.addEventListener("pointerdown",() => this.run(() => {this.source="pointer";this.begin();}),options);
    el.addEventListener("focus",() => this.run(() => this.begin()),options);
    el.addEventListener("compositionstart",() => this.run(() => {this.composing=true;this.send(true);}),options);
    el.addEventListener("compositionupdate",() => this.run(() => this.send()),options);
    el.addEventListener("compositionend",() => this.run(() => {this.composing=false;this.send();}),options);
    el.addEventListener("input",() => this.run(() => this.send(true)),options);
    for (const event of ["select","keyup","pointerup"] as const)
      el.addEventListener(event,() => this.run(() => this.send()),options);
    el.addEventListener("keydown",(e) => this.run(() => {
      // IME Enter/Escape/Tab remain native; keyCode 229 covers engines with compositionend before keydown.
      if (this.composing || e.isComposing || e.keyCode === 229) return;
      if (this.tab(e)) return;
      if (e.code === "Escape" || e.code === "Enter") {
        e.preventDefault(); e.stopPropagation();
        if (e.code === "Escape") this.session?.cancel();
        else {this.send();this.session?.commit();}
        this.session=undefined;
        this.update();
      } else if (node.control?.keys.includes(e.code)) {
        e.preventDefault(); node.control.key(e.code); this.session=undefined; this.update();
      }
    }),options);
  }
  private begin(): void {
    if (this.session?.active) return;
    const port = this.node.control?.native;
    if (port?.kind === "text") this.session = port.begin(this.source);
  }
  private send(begin = false): void {
    if (document.activeElement !== this.element) return;
    if (begin) this.begin();
    if (!this.session?.active) return;
    const el = this.element;
    this.session?.update({text:el.value,selectionStart:el.selectionStart ?? 0,selectionEnd:el.selectionEnd ?? 0,
      direction:el.selectionDirection ?? "none",composing:this.composing});
  }
  update(clip?: UIBounds): void {
    const model = this.node.control?.model;
    if (model?.kind !== "text") return;
    const el = this.element;
    if (!this.session?.active && el.value !== model.text) el.value=model.text;
    el.placeholder=model.placeholder;
    el.readOnly=model.readOnly;
    el.inputMode=model.inputMode;
    if (model.maxLength === undefined || model.maxLength > 2147483647) el.removeAttribute("maxlength");
    else el.maxLength=model.maxLength;
    el.setAttribute("aria-label",this.node.text);
    el.setAttribute("aria-readonly",String(model.readOnly));
    if (clip) nativeGeometry(el,this.node,this.ui,clip);
  }
}
/** Keep full native geometry; clip without shifting text, selection or the IME anchor. */
export function nativeGeometry(el: HTMLInputElement | HTMLSelectElement, node: CanvasNode, ui: CanvasUI, clip: UIBounds): void {
  const b = node.bounds, c = intersectUI(b, clip), scale = ui.scale, style = node.style;
  el.disabled = !node.available || c.width <= 0 || c.height <= 0 || node.style.pointerEvents !== "auto";
  const color = `#${style.color.toString(16).padStart(6, "0")}`;
  el.style.cssText = `left:${b.x * scale}px;top:${b.y * scale}px;width:${b.width * scale}px;height:${b.height * scale}px;padding:${style.padding * scale}px;font-family:${style.fontFamily};font-size:${style.fontSize * scale}px;color:${color};clip-path:inset(${Math.max(0,c.y-b.y)*scale}px ${Math.max(0,b.x+b.width-c.x-c.width)*scale}px ${Math.max(0,b.y+b.height-c.y-c.height)*scale}px ${Math.max(0,c.x-b.x)*scale}px);`;
  if (el.disabled && document.activeElement === el) el.blur();
}
