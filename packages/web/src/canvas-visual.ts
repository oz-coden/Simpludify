import type {
  CanvasNode,
  CanvasUI,
  PointerRouting,
  UIBounds,
} from "@simpludify/core";
import {
  canvasControlText,
  canvasHoverHighlight,
  canvasScrollbars,
  canvasSliderGeometry,
  cleanupAll,
  EngineError,
  intersectUI,
  wrapCanvasText,
} from "@simpludify/core";
import {
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import {
  CanvasNativeSelect,
  CanvasNativeText,
  clipNativeRegions,
} from "./canvas-native";
import { registerGameButton } from "./ui-keyboard";

export interface CanvasPresentation {
  update(width: number, height: number): void;
  focus(node: CanvasNode): void;
  dispose(): void;
}
interface Entry {
  display: Container;
  background: Graphics;
  text?: Text;
  mask: Graphics;
  button?: HTMLButtonElement | HTMLSelectElement | HTMLInputElement;
  native?: CanvasNativeSelect | CanvasNativeText;
  abort: AbortController;
  signature?: string;
  paintSignature?: string;
  maskSignature?: string;
  scrollbar?: Graphics;
  scrollbarSignature?: string;
  textStyleKey?: string;
}
/** Pixi rendering and a small native focus mirror share the same resolved boxes. */
export class CanvasVisual implements CanvasPresentation {
  readonly display = new Container();
  private readonly element = document.createElement("div");
  private readonly entries = new Map<CanvasNode, Entry>();
  private readonly metrics = new Map<
    CanvasNode,
    {
      key: string;
      values: Map<number, { text: string; width: number; height: number }>;
    }
  >();
  private dirty = true;
  private dead = false;
  private active = false;
  private mirroredFocus: CanvasNode | undefined;
  private readonly subscriptions: Array<() => void> = [];
  private syncs = 0;
  constructor(
    private readonly ui: CanvasUI,
    private readonly host: HTMLElement,
    private readonly routing: PointerRouting,
    private readonly resources: {
      graphics(graphics: Graphics, context: number | undefined): void;
      text(text: Text, key: string | undefined): void;
      changedText(key: string): void;
    },
  ) {
    this.display.eventMode = "none";
    this.display.zIndex = 1;
    this.element.className = "s-canvas-accessibility";
    this.element.setAttribute("aria-label", "Game controls");
    const nativeEvents = new AbortController();
    const interrupt = () => {
      try {
        cleanupAll(
          [
            ...[...this.entries.values()]
              .filter((e) => e.native)
              .map((entry) => () => {
                try {
                  entry.native?.dispose();
                } finally {
                  entry.button?.blur();
                }
              }),
            () => {
              if (!this.ui.disposed) this.ui.focus();
            },
          ],
          "Native controls interruption failed",
        );
      } catch (error) {
        this.ui.report(error);
      } finally {
        this.dirty = true;
      }
    };
    window.addEventListener(
      "blur",
      (event) => {
        if (event.target === window) interrupt();
      },
      { signal: nativeEvents.signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) interrupt();
      },
      { signal: nativeEvents.signal },
    );
    this.host.addEventListener(
      "keydown",
      (event) => {
        if (
          !this.active ||
          event.target !== this.host ||
          event.code !== "Tab" ||
          event.shiftKey ||
          event.isComposing ||
          event.keyCode === 229
        )
          return;
        this.update(this.host.clientWidth, this.host.clientHeight);
        const next = this.ui.focusNext();
        if (next) {
          event.preventDefault();
          this.update(this.host.clientWidth, this.host.clientHeight);
          this.focus(next);
        }
      },
      { signal: nativeEvents.signal },
    );
    this.subscriptions.push(() => nativeEvents.abort());
    this.subscriptions.push(
      ui.subscribe(() => {
        this.dirty = true;
      }),
      ui.onDispose(() => this.dispose()),
    );
  }
  get diagnostics() {
    return {
      nodes: this.entries.size,
      buttons: [...this.entries.values()].filter((e) => e.button).length,
      syncs: this.syncs,
      textMetrics: this.metrics.size,
    };
  }
  private measure = (node: CanvasNode, contentWidth = Infinity) => {
    const { fontSize, fontFamily, textWrap } = node.style;
    const content = canvasControlText(node);
    const adornment = node.control?.model.kind === "checkbox" ? 30 : 0;
    const key = JSON.stringify([
      content,
      fontSize,
      fontFamily,
      textWrap,
      adornment,
    ]);
    let cache = this.metrics.get(node);
    if (cache?.key !== key) {
      cache = { key, values: new Map() };
      this.metrics.set(node, cache);
    }
    const width = textWrap ? Math.max(0, contentWidth - adornment) : Infinity;
    const previous = cache.values.get(width);
    if (previous) return previous;
    const style = new TextStyle({ fontSize, fontFamily, wordWrap: false });
    const text = Number.isFinite(width)
      ? wrapCanvasText(
          content,
          width,
          (value) => CanvasTextMetrics.measureText(value || " ", style).width,
        )
      : content.replace(/\r\n?/g, "\n");
    const measured = CanvasTextMetrics.measureText(text || " ", style);
    const result = {
      text,
      width: (text ? measured.width : 0) + adornment,
      height: measured.height,
    };
    if (cache.values.size >= 8)
      cache.values.delete(cache.values.keys().next().value as number);
    cache.values.set(width, result);
    return result;
  };
  beforeResolutionChange(): void {
    for (const entry of this.entries.values())
      if (entry.text && !entry.text.destroyed)
        this.resources.changedText(entry.text.styleKey);
  }
  focus(node: CanvasNode): void {
    if (node.available)
      this.entries.get(node)?.button?.focus({ preventScroll: true });
  }
  private native(
    node: CanvasNode,
    signal: AbortSignal,
  ): CanvasNativeSelect | CanvasNativeText {
    const host = {
      traverse: (reverse: boolean) => {
        const next = this.ui.focusNext(reverse);
        if (!next) return false;
        this.update(this.host.clientWidth, this.host.clientHeight);
        this.focus(next);
        return true;
      },
      wheel: (event: WheelEvent) => {
        const rect = this.host.getBoundingClientRect();
        const unit =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? this.host.clientHeight
              : 1;
        if (
          this.routing.scroll(
            ((event.clientX - rect.x) * this.host.clientWidth) / rect.width,
            ((event.clientY - rect.y) * this.host.clientHeight) / rect.height,
            event.deltaX * unit,
            event.deltaY * unit,
          )
        )
          event.preventDefault();
      },
    };
    return node.control?.native?.kind === "select"
      ? new CanvasNativeSelect(node, this.ui, signal, host)
      : new CanvasNativeText(node, this.ui, signal, host);
  }
  private button(node: CanvasNode): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    const signal = this.entries.get(node)?.abort.signal;
    if (!signal)
      throw new EngineError("INVALID_UI", "Missing Canvas button entry");
    const options = { signal };
    registerGameButton(button, signal);
    const run = (task: () => void) => {
      try {
        task();
      } catch (error) {
        this.ui.report(error);
      }
    };
    button.addEventListener(
      "focus",
      () =>
        run(() => {
          this.ui.focus(node);
        }),
      options,
    );
    button.addEventListener(
      "blur",
      () =>
        run(() => {
          if (this.ui.focusedNode === node) this.ui.focus();
          this.routing.releaseKeys(node);
        }),
      options,
    );
    button.addEventListener(
      "keydown",
      (event) => {
        if (event.isComposing || event.keyCode === 229) return;
        if (node.control?.keys.includes(event.code)) {
          event.preventDefault();
          run(() => {
            this.routing.controlKey(node, event.code);
          });
          return;
        }
        if (this.ui.scrollKey(node, event.code)) {
          event.preventDefault();
          return;
        }
        if (event.code === "Tab") {
          run(() => {
            const next = this.ui.focusNext(event.shiftKey);
            if (next) {
              event.preventDefault();
              this.update(this.host.clientWidth, this.host.clientHeight);
              this.focus(next);
            }
          });
          return;
        }
        if (event.code !== "Enter" && event.code !== "Space") return;
        event.preventDefault();
        if (!event.repeat)
          run(() => {
            this.routing.key(node, event.code, true);
          });
      },
      options,
    );
    button.addEventListener(
      "keyup",
      (event) => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.code !== "Enter" && event.code !== "Space") return;
        event.preventDefault();
        run(() => {
          this.routing.key(node, event.code, false);
        });
      },
      options,
    );
    // AT/automation can activate the semantic control without a physical key.
    button.addEventListener(
      "click",
      () =>
        run(() => {
          if (node.kind !== "hold-button" && node.available)
            node.activate("accessibility");
        }),
      options,
    );
    return button;
  }
  private updateButton(entry: Entry, node: CanvasNode, clip: UIBounds): void {
    if (entry.native) {
      entry.native.update(clip);
      return;
    }
    if (!entry.button) return;
    const button = entry.button,
      b = node.bounds,
      s = this.ui.scale,
      c = intersectUI(b, clip);
    if (button.textContent !== node.text) button.textContent = node.text;
    button.disabled =
      !node.available ||
      c.width <= 0 ||
      c.height <= 0 ||
      node.style.pointerEvents !== "auto";
    if (node.kind === "hold-button")
      button.setAttribute("aria-pressed", String(node.held));
    const model = node.control?.model;
    if (model) {
      button.setAttribute("role", model.kind);
      button.setAttribute("aria-label", node.text);
      button.setAttribute("aria-readonly", String(model.readOnly));
      if (model.kind === "checkbox")
        button.setAttribute("aria-checked", String(model.checked));
      else if (model.kind === "slider") {
        button.setAttribute("aria-orientation", "horizontal");
        button.setAttribute("aria-valuemin", String(model.min));
        button.setAttribute("aria-valuemax", String(model.max));
        button.setAttribute("aria-valuenow", String(model.value));
      }
    }
    button.setAttribute("aria-busy", String(node.busy));
    button.style.cssText = `left:${c.x * s}px;top:${c.y * s}px;width:${c.width * s}px;height:${c.height * s}px;`;
    if (button.disabled && document.activeElement === button) button.blur();
  }
  update(width: number, height: number): void {
    if (this.dead || this.ui.disposed) return;
    const layout = this.ui.layout(width, height, this.measure);
    if (!this.active) {
      this.host.append(this.element);
      this.active = true;
    }
    if (!this.dirty && !layout) return;
    this.dirty = false;
    this.syncs++;
    this.display.scale.set(this.ui.scale);
    const visited = new Set<CanvasNode>(),
      buttons: (HTMLButtonElement | HTMLSelectElement | HTMLInputElement)[] =
        [];
    const paint: {
      node?: CanvasNode;
      box: UIBounds;
      native?: CanvasNativeSelect | CanvasNativeText;
      clip?: UIBounds;
    }[] = [];
    let order = 0;
    let restoreNativeFocus: CanvasNode | undefined;
    this.ui.walk(
      (node, parentClip) => {
        const measuredText =
          node.kind === "panel"
            ? undefined
            : this.measure(
                node,
                Math.max(0, node.bounds.width - node.style.padding * 2),
              );
        const clip =
          measuredText &&
          (measuredText.width > node.bounds.width - node.style.padding * 2 ||
            measuredText.height > node.bounds.height - node.style.padding * 2)
            ? intersectUI(parentClip, node.bounds)
            : parentClip;
        visited.add(node);
        let entry = this.entries.get(node);
        if (!entry) {
          const display = new Container(),
            background = new Graphics(),
            mask = new Graphics();
          display.addChild(background);
          this.display.addChild(display, mask);
          mask.renderable = false;
          entry = { display, background, mask, abort: new AbortController() };
          this.entries.set(node, entry);
          if (node.interactive) {
            if (node.control?.native) {
              entry.native = this.native(node, entry.abort.signal);
              entry.button = entry.native.element;
            } else entry.button = this.button(node);
            this.element.append(entry.button);
          }
          if (node.kind !== "panel") {
            entry.text = new Text({ text: node.text });
            display.addChild(entry.text);
          }
        }
        if (
          entry.native &&
          (entry.native.disposed ||
            entry.native.revision !== node.control?.revision)
        ) {
          if (document.activeElement === entry.button)
            restoreNativeFocus = node;
          entry.native.dispose();
          entry.native = this.native(node, entry.abort.signal);
          entry.button = entry.native.element;
          this.element.append(entry.button);
          delete entry.signature;
        }
        this.display.setChildIndex(entry.display, order++);
        this.display.setChildIndex(entry.mask, order++);
        if (node.style.pointerEvents === "auto")
          paint.push({
            node,
            box: intersectUI(node.bounds, clip),
            ...(entry.native ? { native: entry.native, clip } : {}),
          });
        if (entry.button) buttons.push(entry.button);
        const b = node.bounds,
          s = node.style;
        let enabled = !node.busy;
        for (let p: CanvasNode | undefined = node; p; p = p.parent)
          enabled &&= p.enabled;
        const signature = JSON.stringify([
          node.paintRevision,
          b.x,
          b.y,
          b.width,
          b.height,
          clip.x,
          clip.y,
          clip.width,
          clip.height,
          node.available,
          enabled,
          this.ui.scale,
        ]);
        if (entry.signature === signature) return;
        entry.signature = signature;
        entry.display.position.set(b.x, b.y);
        const clipped =
          clip.x !== 0 ||
          clip.y !== 0 ||
          clip.width !== width / this.ui.scale ||
          clip.height !== height / this.ui.scale;
        entry.display.mask = clipped ? entry.mask : null;
        // StencilMaskPipe collects renderables; includeInBuild is managed by Pixi.
        entry.mask.renderable = clipped;
        const maskSignature = JSON.stringify([
          clipped,
          clip.x,
          clip.y,
          clip.width,
          clip.height,
        ]);
        if (clipped && entry.maskSignature !== maskSignature)
          entry.mask
            .clear()
            .rect(clip.x, clip.y, clip.width, clip.height)
            .fill(0xffffff);
        entry.maskSignature = maskSignature;
        const paintSignature = JSON.stringify([
          node.paintRevision,
          b.width,
          b.height,
          enabled,
        ]);
        if (entry.paintSignature !== paintSignature) {
          entry.paintSignature = paintSignature;
          entry.background.visible =
            s.background !== undefined || node.interactive;
          entry.background.clear();
          if (s.background !== undefined || node.interactive) {
            entry.background
              .roundRect(
                0,
                0,
                b.width,
                b.height,
                Math.min(s.radius, b.width / 2, b.height / 2),
              )
              .fill(s.background ?? 0x23594e);
            if (node.held)
              entry.background
                .roundRect(0, 0, b.width, b.height, s.radius)
                .fill({ color: 0xffffff, alpha: 0.18 });
            else if (canvasHoverHighlight(node))
              entry.background
                .roundRect(0, 0, b.width, b.height, s.radius)
                .fill({ color: 0xffffff, alpha: 0.08 });
            if (node.focused)
              entry.background
                .roundRect(
                  2,
                  2,
                  Math.max(0, b.width - 4),
                  Math.max(0, b.height - 4),
                  s.radius,
                )
                .stroke({ color: 0xffd36b, width: 3 });
          }
          const model = node.control?.model;
          if (model?.kind === "checkbox") {
            const size = Math.min(
                20,
                Math.max(0, b.height - 8),
                Math.max(0, b.width - 8),
              ),
              x = Math.min(s.padding, b.width - size),
              y = (b.height - size) / 2;
            entry.background
              .rect(x, y, size, size)
              .fill({ color: s.color, alpha: 0.15 })
              .stroke({ color: s.color, width: 2 });
            if (model.checked)
              entry.background
                .moveTo(x + size * 0.2, y + size * 0.5)
                .lineTo(x + size * 0.43, y + size * 0.75)
                .lineTo(x + size * 0.83, y + size * 0.22)
                .stroke({ color: s.color, width: 3 });
          } else if (model?.kind === "slider") {
            const geometry = canvasSliderGeometry(node);
            if (geometry) {
              const t = geometry.track,
                thumb = geometry.thumb;
              entry.background
                .rect(t.x - b.x, t.y - b.y, t.width, t.height)
                .fill({ color: s.color, alpha: 0.25 });
              entry.background
                .rect(t.x - b.x, t.y - b.y, t.width * model.ratio, t.height)
                .fill(s.color);
              entry.background
                .circle(
                  thumb.x - b.x + thumb.width / 2,
                  thumb.y - b.y + thumb.height / 2,
                  thumb.width / 2,
                )
                .fill(s.color);
            }
          }
          entry.display.alpha = enabled ? (model?.readOnly ? 0.7 : 1) : 0.45;
          if (entry.text) {
            entry.text.visible =
              !entry.native ||
              (node.control?.model.kind === "text" && !node.focused);
            const m = measuredText ?? this.measure(node);
            if (entry.text.text !== m.text) {
              this.resources.changedText(entry.text.styleKey);
              entry.text.text = m.text;
            }
            const textStyleKey = JSON.stringify([
              s.fontFamily,
              s.fontSize,
              s.color,
            ]);
            if (entry.textStyleKey !== textStyleKey) {
              this.resources.changedText(entry.text.styleKey);
              entry.textStyleKey = textStyleKey;
              entry.text.style = {
                fontFamily: s.fontFamily,
                fontSize: s.fontSize,
                fill: s.color,
              };
            }
            entry.text.position.set(
              model?.kind === "checkbox"
                ? s.padding + 30
                : model?.kind === "slider"
                  ? s.padding
                  : node.interactive
                    ? Math.max(s.padding, (b.width - m.width) / 2)
                    : s.padding,
              model?.kind === "slider"
                ? s.padding
                : node.interactive
                  ? Math.max(s.padding, (b.height - m.height) / 2)
                  : s.padding,
            );
          }
        }
        this.updateButton(entry, node, clip);
      },
      (node, clip) => {
        const entry = this.entries.get(node);
        if (!entry) return;
        const bars = canvasScrollbars(node);
        for (const bar of bars)
          paint.push({ box: intersectUI(bar.track, clip) });
        if (!entry.scrollbar && bars.length) {
          entry.scrollbar = new Graphics();
          entry.scrollbar.eventMode = "none";
          this.display.addChild(entry.scrollbar);
        }
        const display = entry.scrollbar;
        if (!display) return;
        this.display.setChildIndex(display, order++);
        display.visible = bars.length > 0;
        display.mask = entry.display.mask;
        const signature = JSON.stringify([
          node.style.color,
          clip.x,
          clip.y,
          clip.width,
          clip.height,
          ...bars.map((b) => [b.axis, b.track, b.thumb, b.enabled]),
        ]);
        if (entry.scrollbarSignature === signature) return;
        entry.scrollbarSignature = signature;
        display.clear();
        for (const bar of bars) {
          const t = bar.track,
            b = bar.thumb;
          if (t.width <= 0 || t.height <= 0) continue;
          display
            .roundRect(
              t.x,
              t.y,
              t.width,
              t.height,
              Math.min(4, t.width / 2, t.height / 2),
            )
            .fill({ color: node.style.color, alpha: 0.13 });
          display
            .roundRect(
              b.x,
              b.y,
              b.width,
              b.height,
              Math.min(4, b.width / 2, b.height / 2),
            )
            .fill({ color: node.style.color, alpha: bar.enabled ? 0.7 : 0.25 });
        }
      },
    );
    for (let i = 0; i < paint.length; i++) {
      const item = paint[i];
      if (item?.native && item.node && item.clip)
        clipNativeRegions(
          item.native.element,
          item.node,
          this.ui,
          item.clip,
          paint.slice(i + 1).map((p) => p.box),
        );
    }
    for (const [node, entry] of this.entries)
      if (!visited.has(node)) {
        this.entries.delete(node);
        this.metrics.delete(node);
        this.releaseEntry(entry);
      }
    // Move siblings around the active element: detaching it would end selection/IME.
    let anchor: Element | null = null;
    for (let i = buttons.length - 1; i >= 0; i--) {
      const button = buttons[i];
      if (!button) continue;
      if (
        button !== document.activeElement &&
        button.nextElementSibling !== anchor
      )
        this.element.insertBefore(button, anchor);
      anchor = button;
    }
    const focused = this.ui.focusedNode;
    const button = focused ? this.entries.get(focused)?.button : undefined;
    if (
      (focused !== this.mirroredFocus || focused === restoreNativeFocus) &&
      button &&
      !button.disabled &&
      document.activeElement !== button
    )
      button.focus({ preventScroll: true });
    this.mirroredFocus = this.ui.focusedNode;
  }
  private releaseEntry(entry: Entry): void {
    const backgroundContext = entry.background.context?.uid,
      maskContext = entry.mask.context?.uid;
    const scrollbarContext = entry.scrollbar?.context?.uid;
    const textKey =
      entry.text && !entry.text.destroyed ? entry.text.styleKey : undefined;
    cleanupAll(
      [
        () => entry.abort.abort(),
        () => entry.native?.dispose(),
        () => entry.button?.remove(),
        // These Graphics contexts and Text styles are private to this presentation.
        // An options object with only children:true does not destroy owned GraphicsContext in Pixi8.
        () => entry.background.destroy({ context: true }),
        () => entry.scrollbar?.destroy({ context: true }),
        () => entry.text?.destroy({ style: true }),
        () => entry.display.destroy({ children: true }),
        () => entry.mask.destroy({ context: true }),
        () => this.resources.graphics(entry.background, backgroundContext),
        () => this.resources.graphics(entry.mask, maskContext),
        () => {
          if (entry.scrollbar)
            this.resources.graphics(entry.scrollbar, scrollbarContext);
        },
        () => {
          if (entry.text) this.resources.text(entry.text, textKey);
        },
      ],
      "Canvas visual entry cleanup failed",
    );
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const entries = [...this.entries.values()];
    this.entries.clear();
    this.metrics.clear();
    cleanupAll(
      [
        ...this.subscriptions.splice(0),
        ...entries.map((e) => () => this.releaseEntry(e)),
        () => this.display.destroy({ children: true }),
        () => this.element.remove(),
      ],
      "Canvas visual cleanup failed",
    );
  }
}
