import { EngineError } from "../foundation/diagnostics";
import { defineEvent, EventBus } from "../foundation/events";
import {
  cleanupAll,
  Lifetime,
  type LifetimeOwner,
} from "../foundation/lifetime";
import type { ScreenPoint, WorldPoint } from "../graphics/coordinates";
import type { Scene } from "../scene/scene";
import type { CanvasNode } from "../ui/canvas-node";
import type { CanvasUI } from "../ui/canvas-ui";
import {
  type CanvasScrollbar,
  canvasScrollbars,
  scrollbarContains,
} from "../ui/scrollbar";
/** Snapshot coordinates at DOM delivery. Screen is host CSS units; world includes the current Camera. */
export interface PointerInfo {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly button: number;
  readonly buttons: number;
  readonly screen: ScreenPoint;
  readonly world: WorldPoint;
  /** Inside the original UI target's current clipped hit area, or the world viewport clip. */
  readonly inside: boolean;
  /** Monotonic Host seconds; omit when unavailable (momentum then stays off). */
  readonly time?: number;
}
export const PointerDown = defineEvent<PointerInfo>("PointerDown");
export const PointerMove = defineEvent<PointerInfo>("PointerMove");
export const PointerUp = defineEvent<PointerInfo>("PointerUp");
export const PointerCancel = defineEvent<PointerInfo>("PointerCancel");
export const PointerEnter = defineEvent<PointerInfo>("PointerEnter");
export const PointerLeave = defineEvent<PointerInfo>("PointerLeave");
export const PointerClick = defineEvent<PointerInfo>("PointerClick");
/** Scene-scoped world input. UI gestures are never delivered here. */
export class ScenePointer implements LifetimeOwner {
  private readonly lifetime = new Lifetime();
  readonly events = new EventBus();
  private readonly removeScene: () => void;
  constructor(readonly scene: Scene) {
    this.removeScene = scene.onDispose(() => this.dispose());
  }
  get disposed(): boolean {
    return this.lifetime.disposed;
  }
  onDispose(callback: () => void): () => void {
    return this.lifetime.onDispose(callback);
  }
  dispose(): void {
    if (this.disposed) return;
    cleanupAll(
      [
        () => this.lifetime.dispose(),
        () => this.events.dispose(),
        this.removeScene,
      ],
      "Scene pointer cleanup failed",
    );
  }
}
interface Gesture {
  channel: ScenePointer;
  node?: CanvasNode;
  ui?: CanvasUI;
  last: PointerInfo;
  primary: boolean;
  off?: () => void;
  start: PointerInfo;
  scale: number;
  candidates: readonly CanvasNode[];
  scroll?: CanvasNode;
  axis?: "vertical" | "horizontal" | "both";
  revision?: number;
  bar?: { axis: CanvasScrollbar["axis"]; grab: number; thumb: boolean };
  vx: number;
  vy: number;
}
/** @internal Device-independent routing state; DOM is only an adapter. */
export class PointerRouting {
  private readonly scrollOwners = new Map<CanvasNode, number>();
  private readonly suppressed = new Set<number>();
  private readonly gestures = new Map<number, Gesture>();
  private readonly hovering = new Map<
    number,
    { node: CanvasNode; info: PointerInfo }
  >();
  private readonly holds = new Map<CanvasNode, Set<number | string>>();
  private readonly keys = new Map<CanvasNode, Set<string>>();
  private channel: ScenePointer | undefined;
  private ui: CanvasUI | undefined;
  private subscriptions: Array<() => void> = [];
  private deliveries = 0;
  constructor(private readonly released: (id: number) => void = () => {}) {}
  get diagnostics() {
    return {
      captures: this.gestures.size,
      suppressedPointers: this.suppressed.size,
      hoverPointers: this.hovering.size,
      heldNodes: this.holds.size,
      keyboardNodes: this.keys.size,
      deliveries: this.deliveries,
      scrollDrags: this.scrollOwners.size,
    };
  }
  setScene(channel: ScenePointer, ui?: CanvasUI): void {
    this.reset();
    this.channel = channel;
    this.ui = ui;
    this.subscriptions.push(channel.onDispose(() => this.reset()));
    if (ui) {
      this.subscriptions.push(ui.onDispose(() => this.reset()));
      this.subscriptions.push(ui.subscribe(() => this.prune()));
    }
  }
  private hold(node: CanvasNode, key: number | string, down: boolean): void {
    const set = this.holds.get(node) ?? new Set<number | string>();
    if (down) set.add(key);
    else set.delete(key);
    if (set.size) this.holds.set(node, set);
    else this.holds.delete(node);
    if (node.kind === "hold-button") node.setHeld(set.size > 0);
    else if (node.held !== set.size > 0) {
      node.held = set.size > 0;
      node.changed();
    }
  }
  private emit(
    gesture: Gesture,
    type: typeof PointerDown,
    info: PointerInfo,
  ): void {
    if (gesture.channel.disposed || gesture.node?.disposed) return;
    this.deliveries++;
    (gesture.node?.events ?? gesture.channel.events).emit(type, info);
  }
  private inside(g: Gesture, data: PointerInfo): PointerInfo {
    return Object.freeze({
      ...data,
      inside:
        g.scroll && g.ui
          ? g.ui.containsNode(
              g.scroll,
              data.screen.x / g.ui.scale,
              data.screen.y / g.ui.scale,
            )
          : g.node
            ? g.ui?.hitTest(
                data.screen.x / g.ui.scale,
                data.screen.y / g.ui.scale,
              ) === g.node
            : data.inside,
    });
  }
  down(data: PointerInfo): CanvasNode | undefined {
    this.validate(data);
    if (!this.channel || this.channel.disposed) return;
    if (this.gestures.has(data.pointerId)) this.cancel(data.pointerId);
    this.suppressed.delete(data.pointerId);
    const pick = this.ui?.pick(
      data.screen.x / this.ui.scale,
      data.screen.y / this.ui.scale,
    );
    const node = pick?.node,
      bar = pick?.bar;
    if (
      bar &&
      data.button === 0 &&
      (!bar.enabled || this.scrollOwners.has(bar.node))
    ) {
      this.suppressed.add(data.pointerId);
      return node;
    }
    if (!node && !data.inside) return;
    const g: Gesture = {
      channel: this.channel,
      last: data,
      primary: data.button === 0,
      start: data,
      scale: this.ui?.scale ?? 1,
      candidates:
        this.ui?.scrollTargets(
          data.screen.x / this.ui.scale,
          data.screen.y / this.ui.scale,
        ) ?? [],
      vx: 0,
      vy: 0,
      ...(node ? { node, ui: this.ui as CanvasUI } : {}),
    };
    for (const candidate of g.candidates) candidate.stopScroll();
    if (bar && this.ui && g.primary) {
      const pos =
        (bar.axis === "vertical" ? data.screen.y : data.screen.x) /
        this.ui.scale;
      const thumb = scrollbarContains(
        bar,
        data.screen.x / this.ui.scale,
        data.screen.y / this.ui.scale,
        this.ui.scale,
        bar.node.bounds,
        true,
      );
      const length =
          bar.axis === "vertical" ? bar.thumb.height : bar.thumb.width,
        start = bar.axis === "vertical" ? bar.thumb.y : bar.thumb.x;
      g.scroll = bar.node;
      g.axis = bar.node.style.scroll ?? bar.axis;
      g.revision = bar.node.scrollRevision;
      g.bar = {
        axis: bar.axis,
        grab: length > 0 ? (pos - start) / length : 0,
        thumb,
      };
      this.scrollOwners.set(bar.node, data.pointerId);
    }
    this.gestures.set(data.pointerId, g);
    if (node) g.off = node.onDispose(() => this.cancel(data.pointerId));
    cleanupAll(
      [
        () => {
          if (node?.interactive && g.primary)
            this.hold(node, data.pointerId, true);
        },
        () => {
          if (!node || node.available)
            this.emit(g, PointerDown, this.inside(g, data));
        },
        () => {
          if (
            bar &&
            g.bar &&
            !g.bar.thumb &&
            this.gestures.get(data.pointerId) === g
          ) {
            const vertical = bar.axis === "vertical",
              pos =
                (vertical ? data.screen.y : data.screen.x) / (g.ui?.scale ?? 1),
              start = vertical ? bar.thumb.y : bar.thumb.x;
            const direction = pos < start ? -1 : 1;
            bar.node.setScrollPosition(
              bar.node.scrollX +
                (!vertical ? direction * bar.node.bounds.width * 0.9 : 0),
              bar.node.scrollY +
                (vertical ? direction * bar.node.bounds.height * 0.9 : 0),
            );
          }
        },
      ],
      "Pointer down handlers failed",
    );
    return node;
  }
  private validate(data: PointerInfo): void {
    if (
      !Number.isInteger(data.pointerId) ||
      !Number.isFinite(data.screen.x) ||
      !Number.isFinite(data.screen.y)
    ) {
      this.cancel(data.pointerId, false);
      throw new EngineError(
        "INVALID_UI",
        "Pointer identity and coordinates must be finite",
      );
    }
  }
  /** Host-local screen units, normalized by the UI scale. */
  scroll(x: number, y: number, dx: number, dy: number): boolean {
    const ui = this.ui;
    return (
      ui?.scrollAt(x / ui.scale, y / ui.scale, dx / ui.scale, dy / ui.scale) ??
      false
    );
  }
  hasHover(id: number): boolean {
    return this.hovering.has(id);
  }
  has(id: number): boolean {
    return this.gestures.has(id);
  }
  owns(id: number): boolean {
    return this.gestures.has(id) || this.suppressed.has(id);
  }
  move(data: PointerInfo): void {
    this.validate(data);
    if (this.suppressed.has(data.pointerId)) return;
    const g = this.gestures.get(data.pointerId);
    if (g) {
      if (!g.scroll && g.primary) this.claimScroll(g, data);
      if (this.gestures.get(data.pointerId) !== g) return;
      if (g.bar && g.scroll && g.ui) {
        const bar = canvasScrollbars(g.scroll).find(
          (b) => b.axis === g.bar?.axis,
        );
        if (!bar) {
          this.cancel(data.pointerId);
          return;
        }
        if (g.bar.thumb && bar.enabled) {
          const vertical = bar.axis === "vertical",
            position = (vertical ? data.screen.y : data.screen.x) / g.ui.scale;
          const start = vertical ? bar.track.y : bar.track.x,
            thumb = vertical ? bar.thumb.height : bar.thumb.width,
            travel = (vertical ? bar.track.height : bar.track.width) - thumb;
          const offset =
            ((position - start - g.bar.grab * thumb) / travel) *
            (vertical ? g.scroll.maxScrollY : g.scroll.maxScrollX);
          g.scroll.setScrollPosition(
            vertical ? g.scroll.scrollX : offset,
            vertical ? offset : g.scroll.scrollY,
          );
        }
        g.last = data;
      } else if (g.scroll && g.ui) {
        const dx = (g.last.screen.x - data.screen.x) / g.ui.scale,
          dy = (g.last.screen.y - data.screen.y) / g.ui.scale;
        this.sampleVelocity(g, data, dx, dy);
        g.last = data;
        g.scroll.setScrollPosition(
          g.scroll.scrollX + dx,
          g.scroll.scrollY + dy,
        );
      } else g.last = data;
      if (this.gestures.get(data.pointerId) === g)
        this.emit(g, PointerMove, this.inside(g, data));
      return;
    }
    if (!this.channel || this.channel.disposed) return;
    const node = this.ui?.hitTest(
      data.screen.x / this.ui.scale,
      data.screen.y / this.ui.scale,
    );
    this.hover(data.pointerId, node, data);
    if (node?.available) {
      this.deliveries++;
      node.events.emit(PointerMove, Object.freeze({ ...data, inside: true }));
    } else if (!node && data.inside) {
      this.deliveries++;
      this.channel.events.emit(PointerMove, data);
    }
  }
  private sampleVelocity(
    g: Gesture,
    data: PointerInfo,
    dx: number,
    dy: number,
  ): void {
    const dt =
      data.time !== undefined && g.last.time !== undefined
        ? data.time - g.last.time
        : 0;
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.15) {
      g.vx = 0;
      g.vy = 0;
      return;
    }
    const a = 1 - Math.exp(-dt / 0.045);
    g.vx += (Math.max(-3000, Math.min(3000, dx / dt)) - g.vx) * a;
    g.vy += (Math.max(-3000, Math.min(3000, dy / dt)) - g.vy) * a;
  }
  private claimScroll(g: Gesture, data: PointerInfo): void {
    const ui = this.ui;
    if (!ui) return;
    const dx = (g.start.screen.x - data.screen.x) / ui.scale,
      dy = (g.start.screen.y - data.screen.y) / ui.scale;
    const candidate = g.candidates.find((n) => {
      if (n.ui !== ui || !n.available || !n.style.dragScroll) return false;
      const x =
        n.style.scroll !== "vertical" &&
        n.maxScrollX > 0 &&
        Math.abs(dx) * ui.scale >= n.style.dragThreshold;
      const y =
        n.style.scroll !== "horizontal" &&
        n.maxScrollY > 0 &&
        Math.abs(dy) * ui.scale >= n.style.dragThreshold;
      return (
        (x &&
          ((dx < 0 && n.scrollX > 0) ||
            (dx > 0 && n.scrollX < n.maxScrollX))) ||
        (y &&
          ((dy < 0 && n.scrollY > 0) || (dy > 0 && n.scrollY < n.maxScrollY)))
      );
    });
    const axis = candidate?.style.scroll;
    if (!candidate || !axis) return;
    if (this.scrollOwners.has(candidate)) {
      this.cancel(data.pointerId);
      return;
    }
    const previous = { ...g };
    g.off?.();
    g.scroll = candidate;
    g.node = candidate;
    g.ui = ui;
    g.axis = axis;
    g.revision = candidate.scrollRevision;
    this.scrollOwners.set(candidate, data.pointerId);
    g.off = candidate.onDispose(() => this.cancel(data.pointerId));
    cleanupAll(
      [
        () => {
          if (previous.node?.interactive)
            this.hold(previous.node, data.pointerId, false);
        },
        () =>
          this.emit(
            previous,
            PointerCancel,
            Object.freeze({ ...data, inside: false }),
          ),
        () => {
          if (this.gestures.get(data.pointerId) === g)
            this.emit(g, PointerDown, this.inside(g, data));
        },
      ],
      "Scroll ownership transfer failed",
    );
  }
  leave(data: PointerInfo): void {
    if (!this.gestures.has(data.pointerId))
      this.hover(data.pointerId, undefined, data);
  }
  private hover(
    id: number,
    node: CanvasNode | undefined,
    info: PointerInfo,
  ): void {
    const previous = this.hovering.get(id);
    if (previous?.node === node) {
      if (node) this.hovering.set(id, { node, info });
      return;
    }
    this.hovering.delete(id);
    if (node) this.hovering.set(id, { node, info });
    cleanupAll(
      [
        () => {
          if (previous) {
            previous.node.hovered = [...this.hovering.values()].some(
              (h) => h.node === previous.node,
            );
            previous.node.changed();
            if (!previous.node.disposed)
              previous.node.events.emit(
                PointerLeave,
                Object.freeze({ ...info, inside: false }),
              );
          }
        },
        () => {
          if (node?.available) {
            node.hovered = true;
            node.changed();
            node.events.emit(
              PointerEnter,
              Object.freeze({ ...info, inside: true }),
            );
          }
        },
      ],
      "Pointer hover handlers failed",
    );
  }
  up(data: PointerInfo): void {
    this.validate(data);
    if (this.suppressed.delete(data.pointerId)) return;
    let g = this.gestures.get(data.pointerId);
    if (!g) return;
    if (data.screen.x !== g.last.screen.x || data.screen.y !== g.last.screen.y)
      this.move(data);
    g = this.gestures.get(data.pointerId);
    if (!g) return;
    this.gestures.delete(data.pointerId);
    if (g.scroll) {
      this.scrollOwners.delete(g.scroll);
      const fresh =
        data.time !== undefined &&
        g.last.time !== undefined &&
        Number.isFinite(data.time) &&
        data.time >= g.last.time &&
        data.time - g.last.time <= 0.08;
      if (fresh && !g.bar) g.scroll.startScroll(g.vx, g.vy);
    }
    const info = this.inside(g, data);
    cleanupAll(
      [
        () => g.off?.(),
        () => this.released(data.pointerId),
        () => {
          if (g.node?.interactive) this.hold(g.node, data.pointerId, false);
        },
        () => {
          if (!g.node || g.node.available) this.emit(g, PointerUp, info);
        },
        () => {
          if (
            !g.scroll &&
            g.primary &&
            info.inside &&
            (!g.node || g.node.available)
          )
            this.emit(g, PointerClick, info);
        },
        () => {
          if (!g.scroll && g.primary && info.inside && g.node?.available)
            g.node.activate();
        },
      ],
      "Pointer up handlers failed",
    );
  }
  cancel(id: number, retainOwnership = true): void {
    if (!retainOwnership) this.suppressed.delete(id);
    const g = this.gestures.get(id);
    if (!g) return;
    this.gestures.delete(id);
    if (g.scroll) {
      this.scrollOwners.delete(g.scroll);
      g.scroll.stopScroll();
    }
    if (retainOwnership) this.suppressed.add(id);
    cleanupAll(
      [
        () => g.off?.(),
        () => this.released(id),
        () => {
          if (g.node?.interactive) this.hold(g.node, id, false);
        },
        () =>
          this.emit(
            g,
            PointerCancel,
            Object.freeze({ ...g.last, inside: false }),
          ),
      ],
      "Pointer cancel handlers failed",
    );
  }
  hasKey(node: CanvasNode, code: string): boolean {
    return this.keys.get(node)?.has(code) ?? false;
  }
  key(node: CanvasNode, code: string, down: boolean): void {
    if (code !== "Space" && code !== "Enter") return;
    if (down && !node.available) return;
    const set = this.keys.get(node) ?? new Set<string>();
    const activate = !down && set.has(code);
    if (down) {
      set.add(code);
      this.keys.set(node, set);
    } else {
      set.delete(code);
      if (!set.size) this.keys.delete(node);
    }
    cleanupAll(
      [
        () => this.hold(node, `key:${code}`, down),
        () => {
          if (activate && node.kind === "button" && node.available)
            node.activate();
        },
      ],
      "UI keyboard handlers failed",
    );
  }
  releaseKeys(node: CanvasNode): void {
    const keys = [...(this.keys.get(node) ?? [])];
    this.keys.delete(node);
    cleanupAll(
      keys.map((code) => () => this.hold(node, `key:${code}`, false)),
      "Keyboard hold cleanup failed",
    );
  }
  private prune(): void {
    cleanupAll(
      [
        ...[...this.gestures]
          .filter(
            ([, g]) =>
              (g.node && !g.node.available) ||
              (g.ui && g.scale !== g.ui.scale) ||
              (g.scroll &&
                ((!g.bar && !g.scroll.style.dragScroll) ||
                  (g.bar &&
                    !canvasScrollbars(g.scroll).some(
                      (b) => b.axis === g.bar?.axis && b.enabled,
                    )) ||
                  g.axis !== g.scroll.style.scroll ||
                  g.revision !== g.scroll.scrollRevision)),
          )
          .map(
            ([id]) =>
              () =>
                this.cancel(id),
          ),
        ...[...this.hovering]
          .filter(([, h]) => !h.node.available)
          .map(
            ([id, h]) =>
              () =>
                this.hover(id, undefined, h.info),
          ),
        ...[...this.keys.keys()]
          .filter((n) => !n.available)
          .map((n) => () => this.releaseKeys(n)),
      ],
      "Invalid pointer cleanup failed",
    );
  }
  release(): void {
    this.ui?.stopMotion();
    cleanupAll(
      [
        ...[...this.gestures.keys()].map((id) => () => this.cancel(id)),
        ...[...this.hovering].map(
          ([id, h]) =>
            () =>
              this.hover(id, undefined, h.info),
        ),
        ...[...this.keys.keys()].map((n) => () => this.releaseKeys(n)),
      ],
      "Pointer release failed",
    );
  }
  dispose(): void {
    try {
      this.reset();
    } finally {
      this.suppressed.clear();
    }
  }
  reset(): void {
    const off = this.subscriptions.splice(0);
    this.ui?.stopMotion();
    this.channel = undefined;
    this.ui = undefined;
    cleanupAll(
      [...off, () => this.release()],
      "Pointer routing cleanup failed",
    );
  }
}
