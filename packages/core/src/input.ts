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
export class InputState {
  private readonly keys = new Set<string>();
  set(code: string, pressed: boolean): void {
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
  }
  clear(): void {
    this.keys.clear();
  }
  isPressed(code: string): boolean {
    return this.keys.has(code);
  }
  snapshot(): string[] {
    return [...this.keys].sort();
  }
  direction(map: KeyMap): { x: number; y: number } {
    const any = (codes: readonly string[]) =>
      codes.some((code) => this.keys.has(code));
    const x = Number(any(map.right)) - Number(any(map.left));
    const y = Number(any(map.down)) - Number(any(map.up));
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }
}
