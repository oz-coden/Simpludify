import { EngineError, positive } from "../foundation/diagnostics";
import {
  cleanupAll,
  Lifetime,
  type LifetimeOwner,
} from "../foundation/lifetime";
import {
  containsUI,
  intersectUI,
  layoutCanvas,
  type MeasureText,
} from "./canvas-layout";
import type { CanvasNode, UIBounds } from "./canvas-node";
export interface CanvasUIOptions {
  /** Host CSS pixels per UI unit, independent of Camera and DPR. Default 1. */ scale?: number;
}
/** A single Scene-owned screen UI tree, prepared detached and mounted at Scene commit. */
export class CanvasUI implements LifetimeOwner {
  private readonly lifetime = new Lifetime();
  private focusNode: CanvasNode | undefined;
  private factor: number;
  private dirty = true;
  private width = -1;
  private height = -1;
  private readonly listeners = new Set<() => void>();
  private removeScene: (() => void) | undefined;
  private visits = 0;
  private layouts = 0;
  private intrinsicVisits = 0;
  private constrainVisits = 0;
  private hits = 0;
  private hitVisits = 0;
  private nodes = 0;
  private errors: (error: unknown) => void = () => {};
  constructor(
    readonly scene: LifetimeOwner,
    readonly root: CanvasNode,
    options: CanvasUIOptions = {},
  ) {
    this.factor = positive(options.scale ?? 1, "ui.scale");
    if (scene.disposed || root.disposed || root.parent || root.owner)
      throw new EngineError(
        "UI_OWNERSHIP",
        "UI root must be alive and unowned",
      );
    root.owner = this;
    try {
      this.removeScene = scene.onDispose(() => this.dispose());
    } catch (error) {
      root.owner = undefined;
      throw error;
    }
  }
  get disposed(): boolean {
    return this.lifetime.disposed;
  }
  get scale(): number {
    return this.factor;
  }
  set scale(value: number) {
    if (this.disposed)
      throw new EngineError("OWNER_DISPOSED", "UI has been disposed");
    const next = positive(value, "ui.scale");
    if (next !== this.factor) {
      this.factor = next;
      this.invalidate(true);
    }
  }
  get diagnostics() {
    return {
      layouts: this.layouts,
      layoutVisits: this.visits,
      intrinsicVisits: this.intrinsicVisits,
      constrainVisits: this.constrainVisits,
      nodes: this.nodes,
      hitTests: this.hits,
      hitVisits: this.hitVisits,
      subscriptions: this.listeners.size,
    };
  }
  onDispose(callback: () => void): () => void {
    return this.lifetime.onDispose(callback);
  }
  /** @internal */ setErrorHandler(handler: (error: unknown) => void): void {
    this.errors = handler;
  }
  /** @internal */ report(error: unknown): void {
    try {
      this.errors(error);
    } catch {
      /* Observers cannot block release. */
    }
  }
  /** @internal */ subscribe(listener: () => void): () => void {
    if (this.disposed)
      throw new EngineError("OWNER_DISPOSED", "UI has been disposed");
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  get focusedNode(): CanvasNode | undefined {
    return this.focusNode;
  }
  /** Logical focus; Hosts mirror it to native controls where available. */
  focus(node?: CanvasNode): void {
    if (this.disposed)
      throw new EngineError("OWNER_DISPOSED", "UI has been disposed");
    if (
      node &&
      (node.ui !== this ||
        !node.available ||
        !node.interactive ||
        node.style.pointerEvents !== "auto")
    )
      throw new EngineError(
        "UI_OWNERSHIP",
        "Focus requires an available interactive node in this UI",
      );
    if (this.focusNode === node) return;
    const previous = this.focusNode;
    this.focusNode = node;
    if (previous) {
      previous.focused = false;
      previous.changed();
    }
    if (node) {
      node.focused = true;
      this.reveal(node);
      node.changed();
    }
  }
  /** Ordered traversal, including offscreen controls. Undefined leaves focus at the boundary. */
  focusNext(reverse = false): CanvasNode | undefined {
    const order: CanvasNode[] = [];
    this.walk((node) => {
      if (
        node.available &&
        node.interactive &&
        node.style.pointerEvents === "auto"
      )
        order.push(node);
    });
    const index = this.focusNode ? order.indexOf(this.focusNode) : -1;
    const node =
      order[
        index < 0
          ? reverse
            ? order.length - 1
            : 0
          : index + (reverse ? -1 : 1)
      ];
    if (node) this.focus(node);
    return node;
  }
  /** Scroll ancestors just enough to reveal a focused descendant. */
  private reveal(node: CanvasNode): void {
    let x = node.bounds.x,
      y = node.bounds.y;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (!parent.style.scroll) continue;
      const b = parent.bounds,
        pad = parent.style.padding;
      const dx =
        x < b.x + pad
          ? x - b.x - pad
          : Math.max(0, x + node.bounds.width - b.x - b.width + pad);
      const dy =
        y < b.y + pad
          ? y - b.y - pad
          : Math.max(0, y + node.bounds.height - b.y - b.height + pad);
      const oldX = parent.scrollX,
        oldY = parent.scrollY;
      parent.scrollBy(dx, dy);
      x -= parent.scrollX - oldX;
      y -= parent.scrollY - oldY;
    }
  }
  /** UI units. Nested scrollers consume only when their offset can change. */
  scrollAt(x: number, y: number, dx: number, dy: number): boolean {
    const targets: CanvasNode[] = [];
    this.walk((node, clip) => {
      if (
        node.available &&
        node.style.scroll &&
        containsUI(intersectUI(clip, node.bounds), x, y)
      )
        targets.push(node);
    });
    for (const node of targets.reverse())
      if (node.scrollBy(dx, dy)) return true;
    return false;
  }
  /** @internal */ invalidate(layout = false): void {
    if (
      this.focusNode &&
      (this.focusNode.ui !== this || !this.focusNode.available)
    )
      this.focus();
    if (layout) this.dirty = true;
    cleanupAll([...this.listeners], "UI invalidation failed");
  }
  /** @internal Rendering supplies exact text metrics; unchanged frames do no layout. */
  layout(width: number, height: number, measure: MeasureText): boolean {
    if (this.disposed) return false;
    if (!this.dirty && this.width === width && this.height === height)
      return false;
    const visits = layoutCanvas(
      this.root,
      width / this.factor,
      height / this.factor,
      measure,
    );
    this.applyScroll(this.root, 0, 0);
    this.width = width;
    this.height = height;
    this.dirty = false;
    this.layouts++;
    this.visits += visits.nodes;
    this.intrinsicVisits += visits.intrinsicVisits;
    this.constrainVisits += visits.constrainVisits;
    this.nodes = visits.nodes;
    return true;
  }
  private applyScroll(node: CanvasNode, dx: number, dy: number): void {
    const b = node.bounds;
    const children = node.children.filter((n) => n.visible && !n.disposed);
    let maxX = 0,
      maxY = 0;
    if (node.style.scroll)
      for (const child of children) {
        maxX = Math.max(
          maxX,
          child.bounds.x +
            child.bounds.width -
            b.x -
            b.width +
            node.style.padding,
        );
        maxY = Math.max(
          maxY,
          child.bounds.y +
            child.bounds.height -
            b.y -
            b.height +
            node.style.padding,
        );
      }
    node.setScrollRange(
      node.style.scroll && node.style.scroll !== "vertical" ? maxX : 0,
      node.style.scroll && node.style.scroll !== "horizontal" ? maxY : 0,
    );
    if (dx || dy)
      node.boundsValue = Object.freeze({ ...b, x: b.x - dx, y: b.y - dy });
    for (const child of children)
      this.applyScroll(child, dx + node.scrollX, dy + node.scrollY);
  }
  /** @internal Same clipped paint order as Pixi and keyboard mirror. */
  walk(visit: (node: CanvasNode, clip: UIBounds) => void): void {
    if (this.disposed) return;
    const walk = (node: CanvasNode, clip: UIBounds) => {
      if (node.disposed || !node.visible) return;
      const c =
        node.style.clip || node.style.scroll
          ? intersectUI(clip, node.bounds)
          : clip;
      visit(node, c);
      for (const child of node.children) walk(child, c);
    };
    walk(this.root, {
      x: 0,
      y: 0,
      width: Math.max(0, this.width / this.factor),
      height: Math.max(0, this.height / this.factor),
    });
  }
  hitTest(x: number, y: number): CanvasNode | undefined {
    this.hits++;
    let result: CanvasNode | undefined;
    const walk = (node: CanvasNode, clip: UIBounds) => {
      this.hitVisits++;
      if (
        node.disposed ||
        !node.visible ||
        !node.enabled ||
        node.busy ||
        node.style.pointerEvents === "none" ||
        !containsUI(clip, x, y)
      )
        return;
      const c =
        node.style.clip || node.style.scroll
          ? intersectUI(clip, node.bounds)
          : clip;
      if (!containsUI(c, x, y)) return;
      if (node.style.pointerEvents === "auto" && containsUI(node.bounds, x, y))
        result = node;
      for (const child of node.children) walk(child, c);
    };
    if (!this.disposed)
      walk(this.root, {
        x: 0,
        y: 0,
        width: Math.max(0, this.width / this.factor),
        height: Math.max(0, this.height / this.factor),
      });
    return result;
  }
  dispose(): void {
    if (this.disposed) return;
    cleanupAll(
      [
        () => this.lifetime.dispose(),
        () => {
          if (this.focusNode) this.focusNode.focused = false;
          this.focusNode = undefined;
        },
        () => this.root.dispose(),
        () => this.removeScene?.(),
        () => {
          this.listeners.clear();
          this.removeScene = undefined;
          this.nodes = 0;
          this.errors = () => {};
        },
      ],
      "Canvas UI cleanup failed",
    );
  }
}
