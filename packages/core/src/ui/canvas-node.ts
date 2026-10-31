import {
  Cancellation,
  type CancellationSignal,
} from "../foundation/cancellation";
import type { CanvasActivation, CanvasControlPort } from "./canvas-control";
export interface CanvasNodeOwner {
  readonly disposed: boolean;
  readonly scene?: LifetimeOwner;
  invalidate(layout?: boolean): void;
  report(error: unknown): void;
  scrollChanged(node: CanvasNode): void;
  motionChanged(node: CanvasNode, active: boolean): void;
}

import { EngineError } from "../foundation/diagnostics";
import { EventBus } from "../foundation/events";
import {
  cleanupAll,
  Lifetime,
  type LifetimeOwner,
} from "../foundation/lifetime";

export type UISize = number | `${number}%`;
export type UIAlign = "start" | "center" | "end" | "stretch";
export type UIJustify =
  | "start"
  | "center"
  | "end"
  | "space-between"
  | "space-around";
export interface CanvasStyle {
  width?: UISize;
  height?: UISize;
  minWidth?: UISize;
  maxWidth?: UISize;
  minHeight?: UISize;
  maxHeight?: UISize;
  /** Wrap text at the allocated content width. Default true. */
  textWrap?: boolean;
  direction?: "row" | "column";
  gap?: number;
  padding?: number;
  grow?: number;
  shrink?: number;
  align?: UIAlign;
  alignSelf?: UIAlign;
  justify?: UIJustify;
  wrap?: boolean;
  clip?: boolean;
  /** Preserve overflowing content on the selected axes; always clips descendants. */
  scroll?: "vertical" | "horizontal" | "both";
  /** Content dragging. Default true; only scroll containers use it. */
  dragScroll?: boolean;
  /** Coast after a content drag. Default true. */
  inertia?: boolean;
  /** Overlay bars; hiding bars does not disable scrolling. Default auto. */
  scrollbar?: "auto" | "always" | "hidden";
  /** Gesture threshold in Host screen units, independent of UI scale and DPR. Default 8. */
  dragThreshold?: number;
  /** auto blocks world input, children permits empty-space pass-through, none excludes subtree. */
  pointerEvents?: "auto" | "children" | "none";
  /** Hover paint only: auto highlights controls; highlight also opts containers in. */
  hoverEffect?: "auto" | "none" | "highlight";
  background?: number;
  color?: number;
  fontSize?: number;
  fontFamily?: string;
  radius?: number;
}
/** Paint-space translation, independent of Flex allocation. Rotation/scaling are not supported here. */
export interface CanvasPresentationStyle {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly opacity: number;
}
export interface UIBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export const defaultCanvasStyle = Object.freeze({
  direction: "column",
  gap: 0,
  padding: 0,
  grow: 0,
  shrink: 1,
  align: "stretch",
  justify: "start",
  wrap: false,
  textWrap: true,
  clip: false,
  dragScroll: true,
  inertia: true,
  scrollbar: "auto",
  dragThreshold: 8,
  pointerEvents: "children",
  hoverEffect: "auto",
  color: 0xeff7f6,
  fontSize: 18,
  fontFamily: "system-ui, sans-serif",
  radius: 6,
} as const);
type OptionalStyle =
  | "width"
  | "height"
  | "minWidth"
  | "maxWidth"
  | "minHeight"
  | "maxHeight"
  | "background"
  | "alignSelf"
  | "scroll";
export type ResolvedCanvasStyle = Readonly<
  Required<Omit<CanvasStyle, OptionalStyle>> & Pick<CanvasStyle, OptionalStyle>
>;
function checkedStyle(value: CanvasStyle): ResolvedCanvasStyle {
  const result = { ...defaultCanvasStyle, ...value };
  const fields = new Set([
    ...Object.keys(defaultCanvasStyle),
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "background",
    "alignSelf",
    "scroll",
  ]);
  for (const [key, v] of Object.entries(result)) {
    if (!fields.has(key) || v === undefined)
      throw new EngineError(
        "INVALID_UI",
        `Unknown or undefined UI style: ${key}`,
      );
    if (
      [
        "width",
        "height",
        "minWidth",
        "maxWidth",
        "minHeight",
        "maxHeight",
      ].includes(key)
    ) {
      if (
        typeof v === "string" &&
        /^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(v) &&
        Number.isFinite(Number(v.slice(0, -1)))
      )
        continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
        throw new EngineError(
          "INVALID_UI",
          `${key} must be nonnegative or a percentage`,
        );
    } else if (
      [
        "gap",
        "padding",
        "grow",
        "shrink",
        "radius",
        "fontSize",
        "dragThreshold",
        "background",
        "color",
      ].includes(key)
    ) {
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        (key === "fontSize" && v === 0) ||
        (["color", "background"].includes(key) &&
          (!Number.isInteger(v) || v > 0xffffff))
      )
        throw new EngineError("INVALID_UI", `Invalid UI ${key}`);
    } else if (
      ["wrap", "clip", "textWrap", "dragScroll", "inertia"].includes(key)
    ) {
      if (typeof v !== "boolean")
        throw new EngineError("INVALID_UI", `Invalid UI ${key}`);
    } else {
      const choices: Record<string, readonly string[]> = {
        scroll: ["vertical", "horizontal", "both"],
        scrollbar: ["auto", "always", "hidden"],
        direction: ["row", "column"],
        align: ["start", "center", "end", "stretch"],
        alignSelf: ["start", "center", "end", "stretch"],
        justify: ["start", "center", "end", "space-between", "space-around"],
        pointerEvents: ["auto", "children", "none"],
        hoverEffect: ["auto", "none", "highlight"],
      };
      if (
        typeof v !== "string" ||
        (choices[key] ? !choices[key].includes(v) : !v.length)
      )
        throw new EngineError("INVALID_UI", `Invalid UI ${key}`);
    }
  }
  return Object.freeze(result);
}
export type CanvasNodeKind =
  | "panel"
  | "label"
  | "button"
  | "hold-button"
  | "select"
  | "text-input"
  | "number-input"
  | "checkbox"
  | "slider";
/** Host-independent UI model. Single-parent ownership; removing a child disposes that subtree. */
export class CanvasNode implements LifetimeOwner {
  private readonly lifetime = new Lifetime();
  readonly events = new EventBus();
  readonly signal: CancellationSignal;
  private readonly abort = new Cancellation();
  private list: readonly CanvasNode[] = Object.freeze([]);
  private parentNode: CanvasNode | undefined;
  /** @internal Only a root can be claimed by a Scene UI. */ owner:
    | CanvasNodeOwner
    | undefined;
  private config: ResolvedCanvasStyle;
  private captionValue: string;
  private shown = true;
  private active = true;
  private working = false;
  /** @internal */ hovered = false;
  /** @internal */ focused = false;
  /** @internal */ held = false;
  /** @internal */ paintRevision = 0;
  /** @internal */ boundsValue: UIBounds = Object.freeze({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  private offsetX = 0;
  private offsetY = 0;
  private maximumX = 0;
  private maximumY = 0;
  get scrollX(): number {
    return this.offsetX;
  }
  get scrollY(): number {
    return this.offsetY;
  }
  get maxScrollX(): number {
    return this.maximumX;
  }
  get maxScrollY(): number {
    return this.maximumY;
  }
  private velocityX = 0;
  private velocityY = 0;
  private command = 0;
  /** @internal External commands invalidate an in-flight drag's ownership. */
  get scrollRevision(): number {
    return this.command;
  }
  get coasting(): boolean {
    return this.velocityX !== 0 || this.velocityY !== 0;
  }
  /** UI units; commands stop momentum and invalidate active drag ownership, including no-ops. */
  scrollTo(x: number, y: number): boolean {
    this.assertAlive();
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw new EngineError("INVALID_UI", "Scroll coordinates must be finite");
    this.command++;
    this.stopScroll();
    const changed = this.setScrollPosition(x, y);
    if (!changed) this.ui?.invalidate();
    return changed;
  }
  scrollBy(x: number, y: number): boolean {
    return this.scrollTo(this.offsetX + x, this.offsetY + y);
  }
  /** Stop momentum; explicit position commands also cancel pointer ownership. */
  stopScroll(): void {
    this.velocityX = 0;
    this.velocityY = 0;
    this.ui?.motionChanged(this, false);
  }
  /** @internal Gesture/animation write; does not cancel its own ownership. */
  setScrollPosition(x: number, y: number): boolean {
    if (this.disposed) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw new EngineError("INVALID_UI", "Scroll coordinates must be finite");
    const nx = Math.max(0, Math.min(this.maximumX, x)),
      ny = Math.max(0, Math.min(this.maximumY, y));
    if (nx === this.offsetX && ny === this.offsetY) return false;
    this.offsetX = nx;
    this.offsetY = ny;
    this.ui?.scrollChanged(this);
    return true;
  }
  /** @internal UI units/second. Exponential decay rate 8/s, cutoff 10, cap 3000. */
  startScroll(vx: number, vy: number): void {
    this.stopScroll();
    if (!this.available || !this.config.scroll || !this.config.inertia) return;
    const speed = (v: number) =>
      Number.isFinite(v) && Math.abs(v) >= 10
        ? Math.max(-3000, Math.min(3000, v))
        : 0;
    this.velocityX =
      this.maximumX > 0 && this.config.scroll !== "vertical" ? speed(vx) : 0;
    this.velocityY =
      this.maximumY > 0 && this.config.scroll !== "horizontal" ? speed(vy) : 0;
    this.ui?.motionChanged(this, this.coasting);
  }
  /** @internal Exact integration for a bounded elapsed interval supplied by the Host. */
  advanceScroll(seconds: number): void {
    if (!this.available || !this.config.inertia) {
      this.stopScroll();
      return;
    }
    const tx =
      Math.abs(this.velocityX) > 10
        ? Math.min(seconds, Math.log(Math.abs(this.velocityX) / 10) / 8)
        : 0;
    const ty =
      Math.abs(this.velocityY) > 10
        ? Math.min(seconds, Math.log(Math.abs(this.velocityY) / 10) / 8)
        : 0;
    const dx = (this.velocityX * (1 - Math.exp(-8 * tx))) / 8,
      dy = (this.velocityY * (1 - Math.exp(-8 * ty))) / 8;
    this.velocityX = tx < seconds ? 0 : this.velocityX * Math.exp(-8 * seconds);
    this.velocityY = ty < seconds ? 0 : this.velocityY * Math.exp(-8 * seconds);
    const x = this.offsetX + dx,
      y = this.offsetY + dy;
    if (x <= 0 || x >= this.maximumX || Math.abs(this.velocityX) < 10)
      this.velocityX = 0;
    if (y <= 0 || y >= this.maximumY || Math.abs(this.velocityY) < 10)
      this.velocityY = 0;
    this.setScrollPosition(x, y);
    if (!this.coasting) this.ui?.motionChanged(this, false);
  }
  /** @internal Layout updates ranges/clamps after resize or mutation. */
  setScrollRange(x: number, y: number): void {
    this.maximumX = x;
    this.maximumY = y;
    this.offsetX = Math.min(this.offsetX, x);
    this.offsetY = Math.min(this.offsetY, y);
    if (x === 0) this.velocityX = 0;
    if (y === 0) this.velocityY = 0;
    if (!this.coasting) this.ui?.motionChanged(this, false);
  }
  private click:
    | ((signal: CancellationSignal) => void | Promise<void>)
    | undefined;
  private hold: ((held: boolean) => void) | undefined;
  /** @internal Prefer CanvasPanel/Label/Button/HoldButton. */
  constructor(
    readonly kind: CanvasNodeKind,
    options: {
      text?: string;
      style?: CanvasStyle;
      click?: (signal: CancellationSignal) => void | Promise<void>;
      hold?: (held: boolean) => void;
    } = {},
  ) {
    this.captionValue = options.text ?? "";
    if (typeof this.captionValue !== "string")
      throw new EngineError("INVALID_UI", "UI text must be a string");
    this.config = checkedStyle(options.style ?? {});
    this.click = options.click;
    this.hold = options.hold;
    this.signal = this.abort.signal;
  }
  private presentationValue: CanvasPresentationStyle = Object.freeze({
    offsetX: 0,
    offsetY: 0,
    opacity: 1,
  });
  private mutationObservers: Set<() => void> | undefined;
  get presentation(): CanvasPresentationStyle {
    return this.presentationValue;
  }
  setPresentation(patch: Partial<CanvasPresentationStyle>): void {
    this.assertAlive();
    const next = { ...this.presentationValue, ...patch };
    if (
      !Number.isFinite(next.offsetX) ||
      !Number.isFinite(next.offsetY) ||
      !Number.isFinite(next.opacity) ||
      next.opacity < 0 ||
      next.opacity > 1
    )
      throw new EngineError(
        "INVALID_UI",
        "Presentation offsets must be finite and opacity 0..1",
      );
    const moved =
      next.offsetX !== this.presentationValue.offsetX ||
      next.offsetY !== this.presentationValue.offsetY;
    if (!moved && next.opacity === this.presentationValue.opacity) return;
    this.presentationValue = Object.freeze(next);
    this.changed(false, moved);
  }
  /** @internal Scoped adapter observations; not a second input/event system. */
  observeMutation(callback: () => void): () => void {
    this.assertAlive();
    this.mutationObservers ??= new Set();
    this.mutationObservers.add(callback);
    return () => {
      this.mutationObservers?.delete(callback);
    };
  }
  get disposed(): boolean {
    return this.lifetime.disposed;
  }
  get parent(): CanvasNode | undefined {
    return this.parentNode;
  }
  get children(): readonly CanvasNode[] {
    return this.list;
  }
  get style(): ResolvedCanvasStyle {
    return this.config;
  }
  get text(): string {
    return this.captionValue;
  }
  get bounds(): UIBounds {
    return this.boundsValue;
  }
  get visible(): boolean {
    return this.shown;
  }
  set visible(value: boolean) {
    this.setFlag("visible", value);
  }
  get enabled(): boolean {
    return this.active;
  }
  set enabled(value: boolean) {
    this.setFlag("enabled", value);
  }
  get busy(): boolean {
    return this.working;
  }
  get ui(): CanvasNodeOwner | undefined {
    return this.owner ?? this.parentNode?.ui;
  }
  /** Optional portable control commands and drawing model. */
  get control(): CanvasControlPort | undefined {
    return undefined;
  }
  get interactive(): boolean {
    return (
      this.kind === "button" ||
      this.kind === "hold-button" ||
      this.control !== undefined
    );
  }
  get available(): boolean {
    for (
      let node: CanvasNode | undefined = this;
      node;
      node = node.parentNode
    ) {
      if (
        node.disposed ||
        !node.shown ||
        !node.active ||
        node.working ||
        node.presentationValue.opacity === 0 ||
        node.config.pointerEvents === "none" ||
        node.owner?.disposed
      )
        return false;
    }
    return true;
  }
  onDispose(callback: () => void): () => void {
    return this.lifetime.onDispose(callback);
  }
  private assertAlive(): void {
    if (this.disposed)
      throw new EngineError("OWNER_DISPOSED", "UI node has been disposed");
  }
  private setFlag(key: "visible" | "enabled", value: boolean): void {
    this.assertAlive();
    if (typeof value !== "boolean")
      throw new EngineError("INVALID_UI", `${key} must be boolean`);
    if (this[key] === value) return;
    if (!value) this.stopScroll();
    if (key === "visible") this.shown = value;
    else this.active = value;
    this.changed(key === "visible");
  }
  setStyle(value: CanvasStyle): void {
    this.assertAlive();
    const next = checkedStyle({ ...this.config, ...value });
    if (
      Object.keys(next).every(
        (k) =>
          next[k as keyof CanvasStyle] === this.config[k as keyof CanvasStyle],
      )
    )
      return;
    const geometry: readonly (keyof CanvasStyle)[] = [
      "width",
      "height",
      "minWidth",
      "maxWidth",
      "minHeight",
      "maxHeight",
      "textWrap",
      "direction",
      "gap",
      "padding",
      "grow",
      "shrink",
      "align",
      "alignSelf",
      "justify",
      "wrap",
      "fontSize",
      "fontFamily",
      "scroll",
    ];
    const layout = geometry.some((key) => next[key] !== this.config[key]);
    if (next.scroll !== this.config.scroll || !next.inertia || !next.dragScroll)
      this.stopScroll();
    this.config = next;
    this.changed(layout);
  }
  setText(text: string): void {
    this.assertAlive();
    if (typeof text !== "string")
      throw new EngineError("INVALID_UI", "UI text must be a string");
    if (text === this.captionValue) return;
    this.captionValue = text;
    this.changed(true);
  }
  /** Appending claims and eventually disposes children; nodes cannot belong to two trees. */
  add(...nodes: CanvasNode[]): this {
    this.assertAlive();
    if (this.kind !== "panel")
      throw new EngineError("INVALID_UI", "Only panels contain children");
    const unique = new Set(nodes);
    if (unique.size !== nodes.length)
      throw new EngineError("UI_OWNERSHIP", "Duplicate UI child");
    for (const node of nodes) {
      if (node.disposed || node.parentNode || node.owner)
        throw new EngineError(
          "UI_OWNERSHIP",
          "UI child already owned or disposed",
        );
      for (let p: CanvasNode | undefined = this; p; p = p.parentNode)
        if (p === node) throw new EngineError("UI_OWNERSHIP", "UI tree cycle");
    }
    for (const node of nodes) node.parentNode = this;
    this.list = Object.freeze([...this.list, ...nodes]);
    this.changed(true);
    return this;
  }
  /** Reorder an existing child without disposal, subscriptions or identity changes. */
  move(node: CanvasNode, index: number): this {
    this.assertAlive();
    if (
      node.parentNode !== this ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.list.length
    )
      throw new EngineError(
        "UI_OWNERSHIP",
        "Move requires an existing child and valid final index",
      );
    if (this.list.indexOf(node) === index) return this;
    const next = this.list.filter((n) => n !== node);
    next.splice(index, 0, node);
    this.list = Object.freeze(next);
    this.changed(true);
    return this;
  }
  /** Dispose every child, continuing even when cleanup handlers throw. */
  clear(): void {
    this.assertAlive();
    cleanupAll(
      this.list.map((node) => () => node.dispose()),
      "UI children cleanup failed",
    );
  }
  remove(node: CanvasNode): boolean {
    this.assertAlive();
    if (node.parentNode !== this) return false;
    node.dispose();
    return true;
  }
  /** @internal */ changed(layout = false, projection = false): void {
    this.paintRevision++;
    const invalidate = () => {
      if (projection) this.ui?.scrollChanged(this);
      else this.ui?.invalidate(layout);
    };
    if (this.mutationObservers?.size)
      cleanupAll(
        [invalidate, ...this.mutationObservers],
        "UI mutation observers failed",
      );
    else invalidate();
  }
  /** @internal */ setHeld(value: boolean): void {
    if (value === this.held) return;
    this.held = value;
    this.changed();
    const result: unknown = this.hold?.(value);
    if (
      result &&
      (typeof result === "object" || typeof result === "function") &&
      "then" in result &&
      typeof result.then === "function"
    ) {
      void Promise.resolve(result).catch(() => {});
      throw new EngineError(
        "UI_ASYNC_HOLD",
        "Hold handlers must be synchronous; own asynchronous work separately",
      );
    }
  }
  /** @internal Async callbacks are cancellable and disable this button until settled. */
  activate(_source: CanvasActivation = "accessibility"): void {
    if (!this.available || this.kind !== "button" || !this.click) return;
    const result = this.click(this.signal);
    if (result && typeof result.then === "function") {
      this.working = true;
      this.changed();
      void result
        .catch((error) => {
          if (!this.signal.aborted) this.ui?.report(error);
        })
        .finally(() => {
          this.working = false;
          if (!this.disposed) this.changed();
        });
    }
  }
  dispose(): void {
    if (this.disposed) return;
    const ui = this.ui;
    this.stopScroll();
    const children = this.list;
    this.list = Object.freeze([]);
    if (this.parentNode) {
      this.parentNode.list = Object.freeze(
        this.parentNode.list.filter((n) => n !== this),
      );
      this.parentNode = undefined;
    }
    cleanupAll(
      [
        () => this.lifetime.dispose(),
        () => this.abort.cancel(),
        () => ui?.invalidate(true),
        () => this.setHeld(false),
        ...children.map((n) => () => n.dispose()),
        () => this.events.dispose(),
        () => this.mutationObservers?.clear(),
        () => {
          this.owner = undefined;
          this.click = undefined;
          this.hold = undefined;
        },
      ],
      "Canvas node cleanup failed",
    );
  }
}
export function CanvasPanel(
  children: readonly CanvasNode[] = [],
  style: CanvasStyle = {},
): CanvasNode {
  return new CanvasNode("panel", { style }).add(...children);
}
export function CanvasRow(
  children: readonly CanvasNode[],
  style: CanvasStyle = {},
): CanvasNode {
  return CanvasPanel(children, { ...style, direction: "row" });
}
export function CanvasColumn(
  children: readonly CanvasNode[],
  style: CanvasStyle = {},
): CanvasNode {
  return CanvasPanel(children, { ...style, direction: "column" });
}
export function CanvasLabel(text: string, style: CanvasStyle = {}): CanvasNode {
  return new CanvasNode("label", { text, style });
}
export function CanvasButton(
  text: string,
  click: (signal: CancellationSignal) => void | Promise<void>,
  style: CanvasStyle = {},
): CanvasNode {
  return new CanvasNode("button", {
    text,
    click,
    style: {
      padding: 12,
      background: 0x23594e,
      pointerEvents: "auto",
      ...style,
    },
  });
}
export function CanvasHoldButton(
  text: string,
  hold: (held: boolean) => void,
  style: CanvasStyle = {},
): CanvasNode {
  return new CanvasNode("hold-button", {
    text,
    hold,
    style: {
      padding: 12,
      background: 0x23594e,
      pointerEvents: "auto",
      ...style,
    },
  });
}

/** Clipped overflowing panel. Give the viewport a bounded size or grow allocation. */
export function CanvasScroll(
  children: readonly CanvasNode[] = [],
  style: CanvasStyle = {},
): CanvasNode {
  return CanvasPanel(children, {
    scroll: "vertical",
    pointerEvents: "auto",
    ...style,
    clip: true,
  });
}
