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
import {
  type CanvasScrollbar,
  canvasScrollbars,
  scrollbarContains,
} from "./scrollbar";
export interface CanvasUIOptions {
  /** Host CSS pixels per UI unit, independent of Camera and DPR. Default 1. */ scale?: number;
}
/** A single Scene-owned screen UI tree, prepared detached and mounted at Scene commit. */
export class CanvasUI implements LifetimeOwner {
  private readonly lifetime = new Lifetime();
  private focusNode: CanvasNode | undefined;
  private factor: number;
  private dirty = true;
  private projectionDirty = true;
  private readonly baseBounds = new WeakMap<CanvasNode, UIBounds>();
  private readonly moving = new Set<CanvasNode>();
  private projections = 0;
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
      scrollProjections: this.projections,
      activeMomentum: this.moving.size,
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
    if (node && !this.canFocus(node))
      throw new EngineError(
        "UI_OWNERSHIP",
        "Focus requires a reachable interactive node in this UI",
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
      if (this.canFocus(node)) order.push(node);
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
  /** Project scroll reveal before testing clips; static clipped controls must not trap Tab. */
  private canFocus(node: CanvasNode): boolean {
    if (
      node.ui !== this ||
      !node.available ||
      !node.interactive ||
      node.style.pointerEvents !== "auto"
    )
      return false;
    let box: UIBounds = node.bounds;
    for (let parent = node.parent; parent; parent = parent.parent) {
      const b = parent.bounds,
        pad = parent.style.padding;
      if (parent.style.scroll) {
        const dx =
          box.x < b.x + pad
            ? box.x - b.x - pad
            : Math.max(0, box.x + box.width - b.x - b.width + pad);
        const dy =
          box.y < b.y + pad
            ? box.y - b.y - pad
            : Math.max(0, box.y + box.height - b.y - b.height + pad);
        const sx =
          Math.max(0, Math.min(parent.maxScrollX, parent.scrollX + dx)) -
          parent.scrollX;
        const sy =
          Math.max(0, Math.min(parent.maxScrollY, parent.scrollY + dy)) -
          parent.scrollY;
        box = { ...box, x: box.x - sx, y: box.y - sy };
      }
      if (parent.style.clip || parent.style.scroll) box = intersectUI(box, b);
      if (box.width <= 0 || box.height <= 0) return false;
    }
    const visible = intersectUI(box, {
      x: 0,
      y: 0,
      width: Math.max(0, this.width / this.factor),
      height: Math.max(0, this.height / this.factor),
    });
    return visible.width > 0 && visible.height > 0;
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
    const targets = this.scrollTargets(x, y);
    for (const node of targets) if (node.scrollBy(dx, dy)) return true;
    return false;
  }
  /** @internal Offset-only invalidation; Flex/text measurements remain cached. */
  scrollChanged(_node: CanvasNode): void {
    this.projectionDirty = true;
    this.invalidate();
  }
  /** @internal Maintain only live animated nodes, never a per-frame scan of the tree. */
  motionChanged(node: CanvasNode, active: boolean): void {
    if (active) this.moving.add(node);
    else this.moving.delete(node);
  }
  stopMotion(): void {
    for (const node of this.moving) node.stopScroll();
    this.moving.clear();
  }
  /** Presentation seconds, independent of simulation timers. Gaps >250ms stop stale motion. */
  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new EngineError(
        "INVALID_UI",
        "UI elapsed time must be finite and nonnegative",
      );
    if (this.disposed) return;
    if (seconds > 0.25) {
      this.stopMotion();
      return;
    }
    if (seconds === 0) return;
    for (const node of this.moving) {
      if (node.ui !== this || !node.available) {
        this.moving.delete(node);
        node.stopScroll();
        continue;
      }
      node.advanceScroll(seconds);
    }
  }
  /** @internal */ invalidate(layout = false): void {
    if (
      this.focusNode &&
      (this.focusNode.ui !== this || !this.focusNode.available)
    )
      this.focus();
    for (const node of this.moving)
      if (node.ui !== this || !node.available || !node.style.inertia) {
        this.moving.delete(node);
        node.stopScroll();
      }
    if (layout) this.dirty = true;
    cleanupAll([...this.listeners], "UI invalidation failed");
  }
  /** @internal Rendering supplies exact text metrics; unchanged frames do no layout. */
  layout(width: number, height: number, measure: MeasureText): boolean {
    if (this.disposed) return false;
    const geometry =
      this.dirty || this.width !== width || this.height !== height;
    if (!geometry && !this.projectionDirty) return false;
    if (geometry) {
      const visits = layoutCanvas(
        this.root,
        width / this.factor,
        height / this.factor,
        measure,
      );
      this.captureLayout(this.root);
      this.width = width;
      this.height = height;
      this.dirty = false;
      this.layouts++;
      this.visits += visits.nodes;
      this.intrinsicVisits += visits.intrinsicVisits;
      this.constrainVisits += visits.constrainVisits;
      this.nodes = visits.nodes;
    }
    this.projectScroll(this.root, 0, 0);
    this.projectionDirty = false;
    this.projections++;
    if (geometry) this.invalidate();
    return true;
  }
  private captureLayout(node: CanvasNode): void {
    const b = node.bounds;
    this.baseBounds.set(node, b);
    let x = 0,
      y = 0;
    for (const child of node.children) {
      if (!child.visible || child.disposed) continue;
      if (node.style.scroll) {
        x = Math.max(
          x,
          child.bounds.x +
            child.bounds.width -
            b.x -
            b.width +
            node.style.padding,
        );
        y = Math.max(
          y,
          child.bounds.y +
            child.bounds.height -
            b.y -
            b.height +
            node.style.padding,
        );
      }
      this.captureLayout(child);
    }
    node.setScrollRange(
      node.style.scroll && node.style.scroll !== "vertical" ? x : 0,
      node.style.scroll && node.style.scroll !== "horizontal" ? y : 0,
    );
  }
  private projectScroll(node: CanvasNode, dx: number, dy: number): void {
    if (node.disposed || !node.visible) return;
    const b = this.baseBounds.get(node);
    if (!b) return;
    const x = b.x - dx,
      y = b.y - dy;
    if (
      node.bounds.x !== x ||
      node.bounds.y !== y ||
      node.bounds.width !== b.width ||
      node.bounds.height !== b.height
    )
      node.boundsValue = Object.freeze({
        x,
        y,
        width: b.width,
        height: b.height,
      });
    for (const child of node.children)
      this.projectScroll(child, dx + node.scrollX, dy + node.scrollY);
  }
  /** Deepest ancestor path for the original hit; overlays cannot scroll content behind them. */
  scrollTargets(x: number, y: number): CanvasNode[] {
    let hit = this.hitTest(x, y);
    if (!hit) return [];
    const targets: CanvasNode[] = [];
    for (; hit; hit = hit.parent)
      if (hit.style.scroll && hit.available) targets.push(hit);
    return targets;
  }
  containsNode(node: CanvasNode, x: number, y: number): boolean {
    let b = node.bounds;
    for (let p: CanvasNode | undefined = node; p; p = p.parent)
      if (p.style.clip || p.style.scroll) b = intersectUI(b, p.bounds);
    return (
      node.available &&
      containsUI(
        intersectUI(b, {
          x: 0,
          y: 0,
          width: this.width / this.factor,
          height: this.height / this.factor,
        }),
        x,
        y,
      )
    );
  }
  /** @internal Same clipped paint order as Pixi and keyboard mirror. */
  walk(
    visit: (node: CanvasNode, clip: UIBounds) => void,
    after?: (node: CanvasNode, clip: UIBounds) => void,
  ): void {
    if (this.disposed) return;
    const walk = (node: CanvasNode, clip: UIBounds) => {
      if (node.disposed || !node.visible) return;
      const c =
        node.style.clip || node.style.scroll
          ? intersectUI(clip, node.bounds)
          : clip;
      visit(node, c);
      for (const child of node.children) walk(child, c);
      after?.(node, c);
    };
    walk(this.root, {
      x: 0,
      y: 0,
      width: Math.max(0, this.width / this.factor),
      height: Math.max(0, this.height / this.factor),
    });
  }
  /** Scroll keyboard commands remain scoped to the focused native/portable control. */
  scrollKey(node: CanvasNode, code: string): boolean {
    for (let p: CanvasNode | undefined = node; p; p = p.parent) {
      if (!p.style.scroll || !p.available) continue;
      const vertical = p.style.scroll !== "horizontal";
      let dx = 0,
        dy = 0;
      if (code === "ArrowDown") dy = 40;
      else if (code === "ArrowUp") dy = -40;
      else if (code === "ArrowRight") dx = 40;
      else if (code === "ArrowLeft") dx = -40;
      else if (code === "PageDown") {
        if (vertical) dy = p.bounds.height * 0.9;
        else dx = p.bounds.width * 0.9;
      } else if (code === "PageUp") {
        if (vertical) dy = -p.bounds.height * 0.9;
        else dx = -p.bounds.width * 0.9;
      } else if (code === "Home") {
        if (vertical) dy = -p.scrollY;
        else dx = -p.scrollX;
      } else if (code === "End") {
        if (vertical) dy = p.maxScrollY - p.scrollY;
        else dx = p.maxScrollX - p.scrollX;
      } else return false;
      if (p.scrollBy(dx, dy)) return true;
    }
    return false;
  }
  hitTest(x: number, y: number): CanvasNode | undefined {
    return this.pick(x, y).node;
  }
  /** One ordered hit pass covers content and post-subtree overlay bars. */
  pick(x: number, y: number): { node?: CanvasNode; bar?: CanvasScrollbar } {
    this.hits++;
    let result: { node?: CanvasNode; bar?: CanvasScrollbar } = {};
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
        result = { node };
      for (const child of node.children) walk(child, c);
      for (const bar of canvasScrollbars(node))
        if (scrollbarContains(bar, x, y, this.factor, c))
          result = { node, bar };
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
        () => this.stopMotion(),
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
