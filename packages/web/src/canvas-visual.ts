import { cleanupAll, EngineError } from "@simpludify/core";
import {
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import { intersectUI } from "./canvas-layout";
import type { CanvasNode, UIBounds } from "./canvas-node";
import type { CanvasUI } from "./canvas-ui";
import type { PointerRouting } from "./pointer-routing";
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
  button?: HTMLButtonElement;
  abort: AbortController;
}
/** Pixi rendering and a small native focus mirror share the same resolved boxes. */
export class CanvasVisual implements CanvasPresentation {
  readonly display = new Container();
  private readonly element = document.createElement("div");
  private readonly entries = new Map<CanvasNode, Entry>();
  private readonly metrics = new Map<
    CanvasNode,
    { key: string; width: number; height: number }
  >();
  private dirty = true;
  private dead = false;
  private active = false;
  private readonly subscriptions: Array<() => void> = [];
  private syncs = 0;
  private readonly fonts = () => {
    this.metrics.clear();
    this.ui.invalidate(true);
  };
  constructor(
    private readonly ui: CanvasUI,
    private readonly host: HTMLElement,
    private readonly routing: PointerRouting,
  ) {
    this.display.eventMode = "none";
    this.display.zIndex = 1;
    this.element.className = "s-canvas-accessibility";
    this.element.setAttribute("aria-label", "Game controls");
    this.subscriptions.push(
      ui.subscribe(() => {
        this.dirty = true;
      }),
      ui.onDispose(() => this.dispose()),
    );
    document.fonts?.addEventListener("loadingdone", this.fonts);
  }
  get diagnostics() {
    return {
      nodes: this.entries.size,
      buttons: [...this.entries.values()].filter((e) => e.button).length,
      syncs: this.syncs,
      textMetrics: this.metrics.size,
    };
  }
  private measure = (node: CanvasNode) => {
    const { fontSize, fontFamily } = node.style,
      key = JSON.stringify([node.text, fontSize, fontFamily]);
    const previous = this.metrics.get(node);
    if (previous?.key === key) return previous;
    const measured = CanvasTextMetrics.measureText(
      node.text || " ",
      new TextStyle({ fontSize, fontFamily }),
    );
    const result = {
      key,
      width: node.text ? measured.width : 0,
      height: measured.height,
    };
    this.metrics.set(node, result);
    return result;
  };
  focus(node: CanvasNode): void {
    if (node.available)
      this.entries.get(node)?.button?.focus({ preventScroll: true });
  }
  private button(node: CanvasNode): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    const signal = this.entries.get(node)?.abort.signal;
    if (!signal)
      throw new EngineError("INVALID_UI", "Missing Canvas button entry");
    const options = { signal };
    button.addEventListener(
      "focus",
      () => {
        node.focused = true;
        node.changed();
      },
      options,
    );
    button.addEventListener(
      "blur",
      () => {
        node.focused = false;
        node.changed();
        this.routing.releaseKeys(node);
      },
      options,
    );
    button.addEventListener(
      "keydown",
      (event) => {
        if (event.code !== "Enter" && event.code !== "Space") return;
        event.preventDefault();
        if (!event.repeat) this.routing.key(node, event.code, true);
      },
      options,
    );
    button.addEventListener(
      "keyup",
      (event) => {
        if (event.code !== "Enter" && event.code !== "Space") return;
        event.preventDefault();
        this.routing.key(node, event.code, false);
        if (node.kind === "button" && node.available)
          try {
            node.activate();
          } catch (error) {
            this.ui.report(error);
          }
      },
      options,
    );
    // AT/automation can activate the semantic control without a physical key.
    button.addEventListener(
      "click",
      () => {
        if (node.kind === "button" && node.available)
          try {
            node.activate();
          } catch (error) {
            this.ui.report(error);
          }
      },
      options,
    );
    return button;
  }
  private updateButton(entry: Entry, node: CanvasNode, clip: UIBounds): void {
    if (!entry.button) return;
    const button = entry.button,
      b = node.bounds,
      s = this.ui.scale,
      c = intersectUI(b, clip);
    button.textContent = node.text;
    button.disabled =
      !node.available ||
      c.width <= 0 ||
      c.height <= 0 ||
      node.style.pointerEvents === "none";
    button.setAttribute("aria-pressed", String(node.held));
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
    const visited = new Set<CanvasNode>();
    let order = 0;
    this.ui.walk((node, clip) => {
      visited.add(node);
      let entry = this.entries.get(node);
      if (!entry) {
        const display = new Container(),
          background = new Graphics(),
          mask = new Graphics();
        display.addChild(background);
        this.display.addChild(display, mask);
        display.mask = mask;
        entry = { display, background, mask, abort: new AbortController() };
        this.entries.set(node, entry);
        if (node.interactive) {
          entry.button = this.button(node);
          this.element.append(entry.button);
        }
        if (node.kind !== "panel") {
          entry.text = new Text({ text: node.text });
          display.addChild(entry.text);
        }
      }
      this.display.setChildIndex(entry.display, order++);
      this.display.setChildIndex(entry.mask, order++);
      const b = node.bounds,
        s = node.style;
      entry.display.position.set(b.x, b.y);
      entry.mask
        .clear()
        .rect(clip.x, clip.y, clip.width, clip.height)
        .fill(0xffffff);
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
        else if (node.hovered)
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
      entry.display.alpha = node.enabled ? 1 : 0.45;
      if (entry.text) {
        entry.text.text = node.text;
        entry.text.style = {
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fill: s.color,
        };
        const m = this.measure(node);
        entry.text.position.set(
          node.interactive
            ? Math.max(s.padding, (b.width - m.width) / 2)
            : s.padding,
          node.interactive
            ? Math.max(s.padding, (b.height - m.height) / 2)
            : s.padding,
        );
      }
      this.updateButton(entry, node, clip);
    });
    for (const [node, entry] of this.entries)
      if (!visited.has(node)) {
        this.entries.delete(node);
        this.metrics.delete(node);
        this.releaseEntry(entry);
      }
  }
  private releaseEntry(entry: Entry): void {
    cleanupAll(
      [
        () => entry.abort.abort(),
        () => entry.button?.remove(),
        () => entry.display.destroy({ children: true }),
        () => entry.mask.destroy(),
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
        () => document.fonts?.removeEventListener("loadingdone", this.fonts),
        ...entries.map((e) => () => this.releaseEntry(e)),
        () => this.display.destroy({ children: true }),
        () => this.element.remove(),
      ],
      "Canvas visual cleanup failed",
    );
  }
}
