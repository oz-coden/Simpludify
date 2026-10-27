import { EngineError } from "./diagnostics";
import type { KeyCode } from "./key-code";
import { cleanupAll, type LifetimeOwner } from "./lifetime";
export const Movement = {
  WASD: "wasd",
  Arrows: "arrows",
  None: "none",
} as const;
export type Movement = (typeof Movement)[keyof typeof Movement];
export interface KeyMap {
  readonly up: readonly KeyCode[];
  readonly down: readonly KeyCode[];
  readonly left: readonly KeyCode[];
  readonly right: readonly KeyCode[];
}
export const KeyMaps: Readonly<Record<Movement, KeyMap>> = {
  wasd: { up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"] },
  arrows: {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
  },
  none: { up: [], down: [], left: [], right: [] },
};
export interface Direction {
  x: number;
  y: number;
}
export interface InputReader {
  isPressed(code: string): boolean;
  direction(map: KeyMap): Direction;
  writeDirection(map: KeyMap, output: Direction): void;
  snapshot(): string[];
}
class InputFrame implements InputReader {
  constructor(private readonly keys: ReadonlySet<string>) {}
  isPressed(code: string): boolean {
    return this.keys.has(code);
  }
  snapshot(): string[] {
    return [...this.keys].sort();
  }
  direction(map: KeyMap): Direction {
    const value = { x: 0, y: 0 };
    this.writeDirection(map, value);
    return value;
  }
  writeDirection(map: KeyMap, output: Direction): void {
    let up = false,
      down = false,
      left = false,
      right = false;
    for (const code of map.up)
      if (this.keys.has(code)) {
        up = true;
        break;
      }
    for (const code of map.down)
      if (this.keys.has(code)) {
        down = true;
        break;
      }
    for (const code of map.left)
      if (this.keys.has(code)) {
        left = true;
        break;
      }
    for (const code of map.right)
      if (this.keys.has(code)) {
        right = true;
        break;
      }
    const x = Number(right) - Number(left),
      y = Number(down) - Number(up),
      diagonal = x !== 0 && y !== 0;
    output.x = diagonal ? x * Math.SQRT1_2 : x;
    output.y = diagonal ? y * Math.SQRT1_2 : y;
  }
}

export class InputSource {
  private dead = false;
  private removeOwner: (() => void) | undefined;
  constructor(
    private readonly state: InputState,
    private readonly id: symbol,
  ) {}
  get disposed(): boolean {
    return this.dead;
  }
  set(code: string, pressed: boolean): void {
    if (this.dead) {
      if (!pressed) return;
      throw new EngineError("OWNER_DISPOSED", "Input source has been disposed");
    }
    this.state.setSource(this.id, code, pressed);
  }
  clear(): void {
    if (!this.dead) this.state.clearSource(this.id);
  }
  /** @internal */ own(owner: LifetimeOwner): void {
    this.removeOwner = owner.onDispose(() => this.dispose());
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const remove = this.removeOwner;
    this.removeOwner = undefined;
    cleanupAll(
      [() => this.state.removeSource(this.id), () => remove?.()],
      "Input source cleanup failed",
    );
  }
}
/** @internal Host-independent logical input sampling and keyboard routing. */
export interface ActionInputPort {
  readonly active: boolean;
  readonly sourceCount: number;
  accepts(code: string): boolean;
  keyChanged(): void;
  capture(): void;
  dispatch(): void;
  reset(): void;
  dispose(): void;
}
export class InputState implements InputReader {
  private readonly actions = new Set<ActionInputPort>();
  private readonly keys = new Set<string>();
  private readonly counts = new Map<string, number>();
  private readonly sources = new Map<
    symbol,
    { keys: Set<string>; handle?: InputSource }
  >();
  private readonly defaultSource = Symbol("scripted-input");
  private dead = false;
  private cached: InputReader | undefined;
  get sourceCount(): number {
    let count =
      this.sources.size - Number(this.sources.has(this.defaultSource));
    for (const actions of this.actions) count += actions.sourceCount;
    return count;
  }
  /** @internal */ registerActions(actions: ActionInputPort): () => void {
    if (this.dead)
      throw new EngineError("OWNER_DISPOSED", "Input has been disposed");
    this.actions.add(actions);
    return () => {
      this.actions.delete(actions);
    };
  }
  acceptsKey(code: string): boolean {
    for (const actions of this.actions) if (actions.accepts(code)) return true;
    return false;
  }
  private notifyActions(): void {
    for (const actions of this.actions) actions.keyChanged();
  }
  /** @internal Captures all controllers before delivering any input callbacks. */
  beginStep(): InputReader {
    const frame = this.capture();
    if (!this.actions.size) return frame;
    const plan = [...this.actions].filter((actions) => actions.active);
    for (const actions of plan) actions.capture();
    const errors: unknown[] = [];
    for (const actions of plan) {
      if (!this.actions.has(actions) || !actions.active) continue;
      try {
        actions.dispatch();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Input callbacks failed");
    return frame;
  }
  createSource(owner?: LifetimeOwner): InputSource {
    if (this.dead || owner?.disposed)
      throw new EngineError("OWNER_DISPOSED", "Input owner has been disposed");
    const id = Symbol("input-source"),
      handle = new InputSource(this, id);
    this.sources.set(id, { keys: new Set(), handle });
    try {
      if (owner) handle.own(owner);
    } catch (error) {
      handle.dispose();
      throw error;
    }
    return handle;
  }
  set(code: string, pressed: boolean): void {
    this.setSource(this.defaultSource, code, pressed);
  }
  /** @internal */ setSource(id: symbol, code: string, pressed: boolean): void {
    if (this.dead)
      throw new EngineError("OWNER_DISPOSED", "Input has been disposed");
    let source = this.sources.get(id);
    if (!source) {
      source = { keys: new Set() };
      this.sources.set(id, source);
    }
    if (source.keys.has(code) === pressed) return;
    if (pressed) {
      source.keys.add(code);
      const count = this.counts.get(code) ?? 0;
      this.counts.set(code, count + 1);
      if (count === 0) {
        this.keys.add(code);
        this.cached = undefined;
        this.notifyActions();
      }
    } else {
      source.keys.delete(code);
      const count = this.counts.get(code) ?? 0;
      if (count <= 1) {
        this.counts.delete(code);
        this.keys.delete(code);
        this.cached = undefined;
        this.notifyActions();
      } else this.counts.set(code, count - 1);
    }
  }
  /** @internal */ clearSource(id: symbol): void {
    const source = this.sources.get(id);
    if (source)
      for (const code of [...source.keys]) this.setSource(id, code, false);
  }
  /** @internal */ removeSource(id: symbol): void {
    const source = this.sources.get(id);
    if (!source) return;
    for (const code of source.keys) {
      const count = this.counts.get(code) ?? 0;
      if (count <= 1) {
        this.counts.delete(code);
        this.keys.delete(code);
        this.cached = undefined;
        this.notifyActions();
      } else this.counts.set(code, count - 1);
    }
    this.sources.delete(id);
  }
  clear(): void {
    for (const source of this.sources.values()) source.keys.clear();
    this.counts.clear();
    if (this.keys.size) {
      this.keys.clear();
      this.cached = undefined;
    }
    for (const actions of this.actions) actions.reset();
  }
  capture(): InputReader {
    this.cached ??= new InputFrame(new Set(this.keys));
    return this.cached;
  }
  isPressed(code: string): boolean {
    return this.keys.has(code);
  }
  snapshot(): string[] {
    return this.capture().snapshot();
  }
  direction(map: KeyMap): Direction {
    return this.capture().direction(map);
  }
  writeDirection(map: KeyMap, output: Direction): void {
    this.capture().writeDirection(map, output);
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const sources = [...this.sources.values()];
    try {
      cleanupAll(
        [
          ...[...this.actions].map((actions) => () => actions.dispose()),
          ...sources.map((source) => () => source.handle?.dispose()),
        ],
        "Input cleanup failed",
      );
    } finally {
      for (const actions of this.actions) actions.reset();
      this.actions.clear();
      this.sources.clear();
      this.keys.clear();
      this.counts.clear();
      this.cached = undefined;
    }
  }
}
