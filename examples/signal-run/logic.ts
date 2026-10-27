import {
  Action,
  ActionController,
  ActionMovement,
  type ActionReader,
  type ActionSource,
  Actor,
  Character,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  Component,
  ComponentPhase,
  type ComponentType,
  ContactEnter,
  ContactStay,
  defineActions,
  defineComponent,
  defineEvent,
  type InputSystem,
  KeyboardBindings,
  Motion,
  Renderable,
  type Scene,
  Shape,
  Transform,
  type UpdateContext,
  type WorldPoint,
  worldPoint,
} from "@simpludify/core";

export const RoundStatus = {
  Playing: "playing",
  Won: "won",
  Lost: "lost",
  Timeout: "timeout",
} as const;
export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];
export interface RoundSnapshot {
  readonly status: RoundStatus;
  readonly hp: number;
  readonly maximumHP: number;
  readonly score: number;
  readonly goal: number;
  readonly secondsRemaining: number;
  readonly elapsed: number;
}
export const RoundChanged = defineEvent<RoundSnapshot>("RoundChanged");
export const RoundFinished = defineEvent<RoundSnapshot>("RoundFinished");
const Layers = { Player: 1, Hazard: 2, Signal: 4, Wall: 8 } as const;
export const SignalActions = defineActions({ Move: Action.axis2D() });
export class Health extends Component {
  static readonly type: ComponentType<Health> =
    defineComponent<Health>("Health");
  readonly type = Health.type;
  private current: number;
  private cooldown = 0;
  constructor(readonly maximum = 3) {
    super();
    if (!Number.isInteger(maximum) || maximum <= 0)
      throw new Error("Health must be a positive integer");
    this.current = maximum;
  }
  get hp(): number {
    return this.current;
  }
  get invulnerable(): boolean {
    return this.cooldown > 0;
  }
  hit(): boolean {
    if (this.current <= 0 || this.cooldown > 0) return false;
    this.current--;
    this.cooldown = 1;
    return true;
  }
  update({ delta }: UpdateContext): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
  }
}
export class Signal extends Component {
  static readonly type: ComponentType<Signal> =
    defineComponent<Signal>("Signal");
  readonly type = Signal.type;
}
export class Danger extends Component {
  static readonly type: ComponentType<Danger> =
    defineComponent<Danger>("Danger");
  readonly type = Danger.type;
}
class PointControl extends Component {
  static readonly type: ComponentType<PointControl> =
    defineComponent<PointControl>("PointControl", [
      Transform.type,
      Motion.type,
      ActionMovement.type,
    ]);
  readonly type = PointControl.type;
  readonly phase = ComponentPhase.Input;
  target: WorldPoint | undefined;
  constructor(private readonly input: ActionReader<"axis2d">) {
    super();
  }
  update({ delta }: UpdateContext): void {
    if (!this.target) return;
    const movement = this.input.value();
    if (movement.x !== 0 || movement.y !== 0) {
      this.target = undefined;
      return;
    }
    const t = this.actor.require(Transform.type),
      motion = this.actor.require(Motion.type),
      dx = this.target.x - t.x,
      dy = this.target.y - t.y,
      distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      motion.direction.x = 0;
      motion.direction.y = 0;
      this.target = undefined;
      return;
    }
    const denominator = Math.max(distance, motion.speed * delta);
    motion.direction.x = dx / denominator;
    motion.direction.y = dy / denominator;
  }
}
class DamageFlash extends Component {
  static readonly type: ComponentType<DamageFlash> =
    defineComponent<DamageFlash>("DamageFlash", [Health.type, Renderable.type]);
  readonly type = DamageFlash.type;
  update(): void {
    this.actor.require(Renderable.type).opacity = this.actor.require(
      Health.type,
    ).invulnerable
      ? 0.45
      : 1;
  }
}
class Patrol extends Component {
  static readonly type: ComponentType<Patrol> = defineComponent<Patrol>(
    "Patrol",
    [Transform.type],
  );
  readonly type = Patrol.type;
  private time = 0;
  constructor(
    private readonly x: number,
    private readonly y: number,
    private readonly vertical: boolean,
  ) {
    super();
  }
  update({ delta }: UpdateContext): void {
    this.time += delta;
    const t = this.actor.require(Transform.type),
      offset = Math.sin(this.time * 1.2) * 110;
    t.x = this.x + (this.vertical ? 0 : offset);
    t.y = this.y + (this.vertical ? offset : 0);
  }
}
class Clock extends Component {
  static readonly type: ComponentType<Clock> = defineComponent<Clock>("Clock");
  readonly type = Clock.type;
  constructor(private readonly tick: (delta: number) => void) {
    super();
  }
  update({ delta }: UpdateContext): void {
    this.tick(delta);
  }
}
export class Round {
  readonly controls: ActionController<typeof SignalActions>;
  readonly input: ActionSource<typeof SignalActions>;
  readonly player: ReturnType<typeof Character>;
  readonly health: Health;
  readonly world: CollisionWorld;
  readonly pickups = new Set<Actor>();
  readonly hazards = new Set<Actor>();
  readonly walls = new Set<Actor>();
  readonly duration: number;
  readonly goal: number;
  private phase: RoundStatus = RoundStatus.Playing;
  private time = 0;
  private points = 0;
  private publishedTime = -1;
  private publishedHP = -1;
  private publishedScore = -1;
  private publishedStatus: RoundStatus | undefined;
  constructor(
    readonly scene: Scene,
    input: InputSystem,
    options: {
      hazards?: boolean;
      duration?: number;
      goal?: number;
      hp?: number;
    } = {},
  ) {
    this.controls = new ActionController(SignalActions, {
      scene,
      input,
      bindings: { Move: KeyboardBindings.WASD },
    });
    this.controls.addBindings(SignalActions.Move, KeyboardBindings.Arrows);
    this.input = this.controls.createSource(scene);
    this.duration = options.duration ?? 30;
    this.goal = options.goal ?? 6;
    if (
      !Number.isFinite(this.duration) ||
      this.duration <= 0 ||
      !Number.isInteger(this.goal) ||
      this.goal < 1 ||
      this.goal > 6
    )
      throw new Error(
        "Round requires a positive duration and a goal between 1 and 6",
      );
    const clock = scene.add(new Actor({ id: "clock" }));
    clock.add(
      new Clock((delta) => {
        if (this.phase === RoundStatus.Playing) this.time += delta;
      }),
    );
    this.player = scene.add(
      Character({
        id: "player",
        x: 80,
        y: 225,
        size: 28,
        speed: 190,
        movement: this.controls.reader(SignalActions.Move),
      }),
    );
    this.player.require(Renderable.type).zIndex = 10;
    this.health = this.player.add(new Health(options.hp ?? 3));
    this.player.add(new PointControl(this.controls.reader(SignalActions.Move)));
    this.player.add(new CollisionBody());
    this.player.add(new DamageFlash());
    const collider = this.player.add(
      new Collider({
        shape: CollisionShape.Circle,
        response: CollisionResponse.Solid,
        radius: 13,
        layer: Layers.Player,
        mask: Layers.Hazard | Layers.Signal | Layers.Wall,
      }),
    );
    const contact = ({ otherActor }: { otherActor: Actor }) => {
      if (
        this.phase !== RoundStatus.Playing ||
        this.time >= this.duration ||
        otherActor.disposed
      )
        return;
      if (otherActor.get(Signal.type) && this.pickups.delete(otherActor)) {
        otherActor.dispose();
        this.points++;
        if (this.points >= this.goal) this.finish(RoundStatus.Won);
        else this.publish();
      } else if (otherActor.get(Danger.type) && this.health.hit()) {
        if (this.health.hp === 0) this.finish(RoundStatus.Lost);
        else this.publish();
      }
    };
    collider.events.on(ContactEnter, contact, scene);
    collider.events.on(ContactStay, contact, scene);
    const points: readonly (readonly [number, number])[] = [
      [220, 225],
      [340, 90],
      [480, 90],
      [660, 225],
      [480, 360],
      [340, 360],
    ];
    for (const [x, y] of points.slice(0, this.goal)) this.addSignal(x, y);
    if (options.hazards !== false) {
      this.addHazard(560, 120, false);
      this.addHazard(440, 325, true);
      this.addObstacle(430, 205, Math.PI / 5);
      this.addObstacle(650, 315, -Math.PI / 6);
      scene.every(5, () => {
        if (this.phase === RoundStatus.Playing && this.hazards.size < 6)
          this.addHazard(260 + this.hazards.size * 45, 225, false);
      });
    }
    this.addWall(0, 225, 6, 450);
    this.addWall(800, 225, 6, 450);
    this.addWall(400, 0, 800, 30);
    this.addWall(400, 450, 800, 30);
    this.addWall(270, 295, 70, 18);
    this.addWall(220, 350, 100, 12);
    this.world = new CollisionWorld(scene);
    scene.onUpdate(() => {
      if (this.phase !== RoundStatus.Playing) return;
      if (this.time >= this.duration) this.finish(RoundStatus.Timeout);
      else this.publish();
    });
    scene.onDispose(() => {
      this.pickups.clear();
      this.hazards.clear();
      this.walls.clear();
    });
  }
  get status(): RoundStatus {
    return this.phase;
  }
  get elapsed(): number {
    return this.time;
  }
  get score(): number {
    return this.points;
  }
  setTarget(point: WorldPoint): void {
    if (this.scene.disposed || this.phase !== RoundStatus.Playing) return;
    this.player.require(PointControl.type).target = worldPoint(
      Math.max(16, Math.min(784, point.x)),
      Math.max(28, Math.min(422, point.y)),
    );
  }
  snapshot(): RoundSnapshot {
    return {
      status: this.phase,
      hp: this.health.hp,
      maximumHP: this.health.maximum,
      score: this.points,
      goal: this.goal,
      secondsRemaining: Math.max(0, Math.ceil(this.duration - this.time)),
      elapsed: this.time,
    };
  }
  private publish(): void {
    const seconds = Math.max(0, Math.ceil(this.duration - this.time));
    if (
      seconds === this.publishedTime &&
      this.health.hp === this.publishedHP &&
      this.points === this.publishedScore &&
      this.phase === this.publishedStatus
    )
      return;
    this.publishedTime = seconds;
    this.publishedHP = this.health.hp;
    this.publishedScore = this.points;
    this.publishedStatus = this.phase;
    this.scene.events.emit(RoundChanged, this.snapshot());
  }
  private finish(status: RoundStatus): void {
    if (this.phase !== RoundStatus.Playing) return;
    this.phase = status;
    this.player.require(Motion.type).enabled = false;
    this.player.require(ActionMovement.type).enabled = false;
    this.player.require(PointControl.type).enabled = false;
    for (const actor of this.hazards) {
      const patrol = actor.get(Patrol.type);
      if (patrol) patrol.enabled = false;
    }
    this.world.dispose();
    this.publish();
    this.scene.events.emit(RoundFinished, this.snapshot());
  }
  private addWall(x: number, y: number, width: number, height: number): void {
    const actor = new Actor();
    actor.add(new Transform({ x, y }));
    actor.add(new Renderable({ width, height, color: 0x5294ba }));
    actor.add(
      new Collider({
        width,
        height,
        response: CollisionResponse.Solid,
        layer: Layers.Wall,
        mask: Layers.Player,
      }),
    );
    this.walls.add(this.scene.add(actor));
  }
  private addSignal(x: number, y: number): void {
    const actor = new Actor();
    actor.add(new Transform({ x, y }));
    actor.add(
      new Renderable({ width: 20, height: 20, color: 0xffd37d, zIndex: 2 }),
    );
    actor.add(
      new Collider({
        shape: CollisionShape.Circle,
        radius: 10,
        layer: Layers.Signal,
        mask: Layers.Player,
      }),
    );
    actor.add(new Signal());
    this.pickups.add(this.scene.add(actor));
  }
  private addHazard(x: number, y: number, vertical: boolean): void {
    const actor = new Actor();
    actor.add(new Transform({ x, y }));
    actor.add(
      new Renderable({
        width: 32,
        height: 32,
        shape: Shape.Circle,
        color: 0xf27d86,
      }),
    );
    actor.add(
      new Collider({
        shape: CollisionShape.Circle,
        radius: 16,
        layer: Layers.Hazard,
        mask: Layers.Player,
      }),
    );
    actor.add(new Danger());
    actor.add(new Patrol(x, y, vertical));
    this.hazards.add(this.scene.add(actor));
  }
  private addObstacle(x: number, y: number, rotation: number): void {
    const actor = new Actor();
    actor.add(new Transform({ x, y, rotation }));
    actor.add(new Renderable({ width: 90, height: 18, color: 0xa76b77 }));
    actor.add(
      new Collider({
        width: 90,
        height: 18,
        layer: Layers.Hazard,
        mask: Layers.Player,
      }),
    );
    actor.add(new Danger());
    this.hazards.add(this.scene.add(actor));
  }
}
