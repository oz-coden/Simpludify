import {
  Action,
  ActionController,
  type ActionSource,
  Actor,
  Component,
  type ComponentType,
  defineActions,
  defineComponent,
  type InputSystem,
  KeyCode,
  type Scene,
  type UpdateContext,
} from "@simpludify/core";

export const kinds = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export type Kind = (typeof kinds)[number];
export type Cell = Kind | null;
export interface Piece {
  kind: Kind;
  x: number;
  y: number;
  rotation: number;
}
export type Command = "left" | "right" | "cw" | "ccw" | "drop" | "hold";
const shapes: Record<Kind, readonly string[]> = {
  I: ["0000", "1111", "0000", "0000"],
  O: ["11", "11"],
  T: ["010", "111", "000"],
  S: ["011", "110", "000"],
  Z: ["110", "011", "000"],
  J: ["100", "111", "000"],
  L: ["001", "111", "000"],
};
export function cells(piece: Piece): Array<{ x: number; y: number }> {
  const shape = shapes[piece.kind];
  const size = shape.length;
  const result: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      if (shape[row]?.[column] !== "1") continue;
      let x = column,
        y = row;
      for (let turn = 0; turn < ((piece.rotation % 4) + 4) % 4; turn++)
        [x, y] = [size - 1 - y, x];
      result.push({ x: x + piece.x, y: y + piece.y });
    }
  return result;
}

// Game rules use integer cells only. No rendering, wall clock or host dependency.
export class Puzzle {
  readonly board: Cell[][] = Array.from({ length: 20 }, () =>
    Array<Cell>(10).fill(null),
  );
  readonly next: Kind[] = [];
  active!: Piece;
  held: Kind | null = null;
  holdUsed = false;
  score = 0;
  lines = 0;
  locked = 0;
  over = false;
  private bag: Kind[] = [];
  private gravity = 0;
  private soft = false;
  private grounded = 0;
  private resets = 0;
  constructor(private readonly random: () => number) {
    this.fillNext();
    this.spawn();
  }
  get level(): number {
    return 1 + Math.floor(this.lines / 10);
  }
  private take(): Kind {
    if (!this.bag.length) {
      this.bag = [...kinds];
      for (let index = this.bag.length - 1; index > 0; index--) {
        const other = Math.floor(this.random() * (index + 1));
        const current = this.bag[index],
          replacement = this.bag[other];
        if (current === undefined || replacement === undefined)
          throw new Error("Invalid bag index");
        this.bag[index] = replacement;
        this.bag[other] = current;
      }
    }
    const kind = this.bag.pop();
    if (kind === undefined) throw new Error("Empty piece bag");
    return kind;
  }
  private fillNext(): void {
    while (this.next.length < 5) this.next.push(this.take());
  }
  private spawn(kind?: Kind): void {
    const selected = kind ?? this.next.shift();
    if (selected === undefined) throw new Error("Empty piece queue");
    this.fillNext();
    this.active = {
      kind: selected,
      x: selected === "O" ? 4 : 3,
      y: -1,
      rotation: 0,
    };
    this.gravity = 0;
    this.grounded = 0;
    this.resets = 0;
    if (!this.fits(this.active)) this.over = true;
  }
  fits(piece: Piece): boolean {
    return cells(piece).every(
      ({ x, y }) =>
        x >= 0 &&
        x < 10 &&
        y >= -4 &&
        y < 20 &&
        (y < 0 || this.board[y]?.[x] === null),
    );
  }
  private resetLock(wasGrounded: boolean): void {
    if (wasGrounded && this.resets < 15) {
      this.grounded = 0;
      this.resets++;
    }
  }
  move(dx: number, dy = 0): boolean {
    if (this.over) return false;
    const next = {
      ...this.active,
      x: this.active.x + dx,
      y: this.active.y + dy,
    };
    if (!this.fits(next)) return false;
    const wasGrounded = !this.fits({ ...this.active, y: this.active.y + 1 });
    this.active = next;
    if (dy === 0) this.resetLock(wasGrounded);
    return true;
  }
  rotate(direction: 1 | -1): boolean {
    if (this.over) return false;
    if (this.active.kind === "O") return true;
    const wasGrounded = !this.fits({ ...this.active, y: this.active.y + 1 });
    // Deliberately simple, documented kicks; this is not SRS.
    for (const [dx, dy] of [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
      [-1, -1],
      [1, -1],
      [0, -2],
    ] as const) {
      const candidate = {
        ...this.active,
        x: this.active.x + dx,
        y: this.active.y + dy,
        rotation: (this.active.rotation + direction + 4) % 4,
      };
      if (this.fits(candidate)) {
        this.active = candidate;
        this.resetLock(wasGrounded);
        return true;
      }
    }
    return false;
  }
  ghost(): Piece {
    let ghost = { ...this.active };
    while (this.fits({ ...ghost, y: ghost.y + 1 }))
      ghost = { ...ghost, y: ghost.y + 1 };
    return ghost;
  }
  hardDrop(): void {
    if (this.over) return;
    const ghost = this.ghost();
    this.score += (ghost.y - this.active.y) * 2;
    this.active = ghost;
    this.lock();
  }
  hold(): void {
    if (this.over || this.holdUsed) return;
    const previous = this.held;
    this.held = this.active.kind;
    this.spawn(previous ?? undefined);
    this.holdUsed = true;
  }
  command(command: Command): void {
    switch (command) {
      case "left":
        this.move(-1);
        break;
      case "right":
        this.move(1);
        break;
      case "cw":
        this.rotate(1);
        break;
      case "ccw":
        this.rotate(-1);
        break;
      case "drop":
        this.hardDrop();
        break;
      case "hold":
        this.hold();
        break;
    }
  }
  tick(seconds: number, soft = false): void {
    if (this.over) return;
    if (soft !== this.soft) {
      this.gravity = 0;
      this.soft = soft;
    }
    const interval = soft
      ? 0.035
      : Math.max(0.06, 0.8 * 0.8 ** (this.level - 1));
    this.gravity += seconds;
    while (this.gravity >= interval) {
      this.gravity -= interval;
      if (!this.move(0, 1)) {
        this.gravity = 0;
        break;
      }
      if (soft) this.score++;
    }
    if (this.fits({ ...this.active, y: this.active.y + 1 })) this.grounded = 0;
    else {
      this.grounded += seconds;
      if (this.grounded >= 0.45) this.lock();
    }
  }
  private lock(): void {
    const occupied = cells(this.active);
    if (occupied.some(({ y }) => y < 0)) {
      this.over = true;
      return;
    }
    for (const { x, y } of occupied) {
      const row = this.board[y];
      if (!row) throw new Error("Invalid fixation row");
      row[x] = this.active.kind;
    }
    const remaining = this.board.filter((row) =>
      row.some((cell) => cell === null),
    );
    const cleared = 20 - remaining.length;
    this.score += ([0, 100, 300, 500, 800][cleared] ?? 0) * this.level;
    this.lines += cleared;
    this.board.splice(
      0,
      20,
      ...Array.from({ length: cleared }, () => Array<Cell>(10).fill(null)),
      ...remaining,
    );
    this.locked++;
    this.holdUsed = false;
    this.spawn();
  }
  snapshot() {
    return {
      board: this.board.map((row) => [...row]),
      active: { ...this.active },
      next: [...this.next],
      held: this.held,
      holdUsed: this.holdUsed,
      score: this.score,
      lines: this.lines,
      level: this.level,
      locked: this.locked,
      over: this.over,
      bag: [...this.bag],
      gravity: this.gravity,
      soft: this.soft,
      grounded: this.grounded,
      resets: this.resets,
    };
  }
}

export const PuzzleActions = defineActions({
  Left: Action.button(),
  Right: Action.button(),
  SoftDrop: Action.button(),
  RotateCW: Action.button(),
  RotateCCW: Action.button(),
  Drop: Action.button(),
  Hold: Action.button(),
  Pause: Action.button(),
});
export class PuzzleController extends Component {
  static readonly type: ComponentType<PuzzleController> =
    defineComponent<PuzzleController>("PuzzleController");
  readonly type = PuzzleController.type;
  readonly input: ActionSource<typeof PuzzleActions>;
  private direction = 0;
  private repeat = 0;
  constructor(
    readonly puzzle: Puzzle,
    readonly controls: ActionController<typeof PuzzleActions>,
  ) {
    super();
    this.input = controls.createSource(this);
  }
  resetRepeat(): void {
    this.direction = 0;
    this.repeat = 0;
  }
  update({ delta }: UpdateContext): void {
    const puzzle = this.puzzle,
      controls = this.controls;
    let dropped = false;
    // Preserve the order of short keyboard, touch and scripted commands.
    for (const event of controls.events) {
      if (!event.down) continue;
      const action = event.action;
      if (action === PuzzleActions.Left) puzzle.move(-1);
      else if (action === PuzzleActions.Right) puzzle.move(1);
      else if (action === PuzzleActions.RotateCW) puzzle.rotate(1);
      else if (action === PuzzleActions.RotateCCW) puzzle.rotate(-1);
      else if (action === PuzzleActions.Hold) puzzle.hold();
      else if (action === PuzzleActions.Drop) {
        puzzle.hardDrop();
        dropped = true;
      }
    }
    const direction =
      Number(controls.value(PuzzleActions.Right)) -
      Number(controls.value(PuzzleActions.Left));
    if (direction !== this.direction) {
      this.direction = direction;
      this.repeat = 0.16;
    } else if (direction) {
      this.repeat -= delta;
      while (this.repeat <= 0) {
        puzzle.move(direction);
        this.repeat += 0.055;
      }
    }
    if (!dropped) puzzle.tick(delta, controls.value(PuzzleActions.SoftDrop));
  }
}
export function createPuzzle(
  scene: Scene,
  input: InputSystem,
  random: () => number,
) {
  const puzzle = new Puzzle(random);
  const controls = new ActionController(PuzzleActions, {
    scene,
    input,
    bindings: {
      Left: { keys: [KeyCode.ArrowLeft] },
      Right: { keys: [KeyCode.ArrowRight] },
      SoftDrop: { keys: [KeyCode.ArrowDown] },
      RotateCW: { keys: [KeyCode.ArrowUp, KeyCode.X] },
      RotateCCW: { keys: [KeyCode.Z] },
      Drop: { keys: [KeyCode.Space] },
      Hold: { keys: [KeyCode.C, KeyCode.ShiftLeft, KeyCode.ShiftRight] },
      Pause: { keys: [KeyCode.P, KeyCode.Escape] },
    },
  });
  const actor = new Actor();
  const controller = actor.add(new PuzzleController(puzzle, controls));
  scene.add(actor);
  return { puzzle, controller };
}
