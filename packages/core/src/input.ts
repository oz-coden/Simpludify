export const Movement = {
  WASD: "wasd",
  Arrows: "arrows",
  None: "none",
} as const;
export type Movement = (typeof Movement)[keyof typeof Movement];
export interface KeyMap {
  readonly up: readonly string[];
  readonly down: readonly string[];
  readonly left: readonly string[];
  readonly right: readonly string[];
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
      length = Math.hypot(x, y) || 1;
    output.x = x / length;
    output.y = y / length;
  }
}
export class InputState implements InputReader {
  private readonly keys = new Set<string>();
  private cached: InputReader | undefined;
  set(code: string, pressed: boolean): void {
    if (this.keys.has(code) === pressed) return;
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
    this.cached = undefined;
  }
  clear(): void {
    if (this.keys.size) {
      this.keys.clear();
      this.cached = undefined;
    }
  }
  /** Immutable view cached until the next actual input change. */
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
}
