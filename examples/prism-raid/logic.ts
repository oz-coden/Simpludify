import {
  Action,
  ActionController,
  ActionMovement,
  type ActionReader,
  type ActionSource,
  Actor,
  Collider,
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
  KeyCode,
  Motion,
  type Scene,
  Transform,
  type UpdateContext,
} from "@simpludify/core";

export const arena = { width: 360, height: 540 } as const;
export const RaidActions = defineActions({
  Move: Action.axis2D(),
  Fire: Action.button(),
  Sprint: Action.button(),
  Pause: Action.button(),
});
export const Layers = {
  Player: 1,
  PlayerShot: 2,
  Enemy: 4,
  EnemyShot: 8,
} as const;
export type Kind =
  | "player"
  | "scout"
  | "drifter"
  | "gunner"
  | "player-shot"
  | "enemy-shot";
export type Status = "playing" | "won" | "lost";
export class Unit extends Component {
  static readonly type: ComponentType<Unit> = defineComponent<Unit>("RaidUnit");
  readonly type = Unit.type;
  age = 0;
  constructor(
    readonly kind: Kind,
    public hp = 1,
  ) {
    super();
  }
}
export const RaidChanged = defineEvent<{
  hp: number;
  score: number;
  wave: number;
  status: Status;
}>("RaidChanged");
export const RaidFinished = defineEvent<Status>("RaidFinished");

class Clock extends Component {
  static readonly type: ComponentType<Clock> =
    defineComponent<Clock>("RaidClock");
  readonly type = Clock.type;
  constructor(private readonly round: Raid) {
    super();
  }
  update({ delta }: UpdateContext): void {
    this.round.advance(delta);
  }
}
/** Game-owned policy; the standard adapter still owns the only Motion direction writes. */
class SprintScale extends Component {
  static readonly type: ComponentType<SprintScale> =
    defineComponent<SprintScale>("RaidSprint", [ActionMovement.type]);
  readonly type = SprintScale.type;
  readonly phase = ComponentPhase.Input;
  private movement: ActionMovement | undefined;
  constructor(private readonly input: ActionReader<"button">) {
    super();
  }
  protected onAttach(): void {
    this.movement = this.actor.require(ActionMovement.type);
  }
  protected onDisable(): void {
    if (this.movement) this.movement.scale = 1;
  }
  protected onDestroy(): void {
    this.onDisable();
    this.movement = undefined;
  }
  update({ scene }: UpdateContext): void {
    if (this.input.scene !== scene)
      throw new Error("Sprint Action belongs to another Scene");
    if (this.movement)
      this.movement.scale = !this.input.disposed && this.input.value() ? 2 : 1;
  }
}
class Pilot extends Component {
  static readonly type: ComponentType<Pilot> = defineComponent<Pilot>(
    "RaidPilot",
    [Transform.type],
  );
  readonly type = Pilot.type;
  readonly phase = ComponentPhase.LateUpdate;
  cooldown = 0;
  constructor(private readonly round: Raid) {
    super();
  }
  update({ delta }: UpdateContext): void {
    const t = this.actor.require(Transform.type);
    t.x = Math.max(18, Math.min(arena.width - 18, t.x));
    t.y = Math.max(40, Math.min(arena.height - 22, t.y));
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (
      (this.round.controls.value(RaidActions.Fire) ||
        this.round.controls.pressed(RaidActions.Fire)) &&
      this.cooldown <= 1e-9 &&
      this.round.status === "playing"
    ) {
      this.cooldown = 0.16;
      this.round.spawnPlayerShot(t.x - 7, t.y - 23);
      this.round.spawnPlayerShot(t.x + 7, t.y - 23);
    }
  }
}
export class Flight extends Component {
  static readonly type: ComponentType<Flight> = defineComponent<Flight>(
    "RaidFlight",
    [Transform.type, Motion.type, Unit.type],
  );
  readonly type = Flight.type;
  readonly phase = ComponentPhase.Input;
  age = 0;
  cooldown: number;
  constructor(
    readonly baseX: number,
    readonly amplitude: number,
    readonly omega: number,
    readonly offset: number,
    readonly shoots: boolean,
    private readonly round: Raid,
  ) {
    super();
    this.cooldown = 1.1 + offset / 6;
  }
  update({ delta }: UpdateContext): void {
    this.age += delta;
    const t = this.actor.require(Transform.type);
    t.x = Math.max(
      20,
      Math.min(
        arena.width - 20,
        this.baseX +
          Math.sin(this.age * this.omega + this.offset) * this.amplitude,
      ),
    );
    t.rotation = Math.PI + Math.cos(this.age * this.omega + this.offset) * 0.18;
    this.cooldown -= delta;
    if (
      this.shoots &&
      this.cooldown <= 0 &&
      t.y > 20 &&
      t.y < arena.height - 90
    ) {
      this.cooldown =
        this.actor.require(Unit.type).kind === "gunner" ? 1.5 : 2.2;
      const player = this.round.player.require(Transform.type);
      const dx = player.x - t.x,
        dy = Math.max(50, player.y - t.y),
        length = Math.hypot(dx, dy);
      this.round.spawnEnemyShot(t.x, t.y + 20, dx / length, dy / length);
      if (this.actor.require(Unit.type).kind === "gunner") {
        this.round.spawnEnemyShot(t.x, t.y + 20, -0.35, 1);
        this.round.spawnEnemyShot(t.x, t.y + 20, 0.35, 1);
      }
    }
  }
}
class Lifetime extends Component {
  static readonly type: ComponentType<Lifetime> = defineComponent<Lifetime>(
    "RaidLifetime",
    [Transform.type, Unit.type],
  );
  readonly type = Lifetime.type;
  readonly phase = ComponentPhase.LateUpdate;
  constructor(
    private readonly round: Raid,
    private readonly ttl: number,
  ) {
    super();
  }
  update({ delta }: UpdateContext): void {
    const unit = this.actor.require(Unit.type);
    unit.age += delta;
    const t = this.actor.require(Transform.type);
    if (
      unit.age > this.ttl ||
      t.x < -60 ||
      t.x > arena.width + 60 ||
      t.y < -70 ||
      t.y > arena.height + 35
    ) {
      if (
        unit.kind === "scout" ||
        unit.kind === "drifter" ||
        unit.kind === "gunner"
      )
        this.round.breach();
      this.actor.dispose();
    }
  }
}

export interface RaidOptions {
  spawnInterval?: number;
  waveSizes?: readonly number[];
  hp?: number;
  duration?: number;
}
export class Raid {
  readonly controls: ActionController<typeof RaidActions>;
  readonly input: ActionSource<typeof RaidActions>;
  readonly world: CollisionWorld;
  readonly player: Actor;
  readonly units = new Set<Actor>();
  readonly enemies = new Set<Actor>();
  readonly playerShots = new Set<Actor>();
  readonly enemyShots = new Set<Actor>();
  readonly maximumHP: number;
  readonly waveSizes: readonly number[];
  readonly duration: number;
  hp: number;
  score = 0;
  kills = 0;
  shotsFired = 0;
  spawned = 0;
  breaches = 0;
  elapsed = 0;
  invulnerable = 0;
  wave = 1;
  waveSpawned = 0;
  intermission = 0;
  status: Status = "playing";
  private readonly stopSpawning: () => void;
  constructor(
    readonly scene: Scene,
    input: InputSystem,
    private readonly random: () => number,
    options: RaidOptions = {},
  ) {
    this.maximumHP = options.hp ?? 5;
    this.hp = this.maximumHP;
    this.waveSizes = [...(options.waveSizes ?? [6, 8, 10])];
    this.duration = options.duration ?? 75;
    const interval = options.spawnInterval ?? 0.7;
    if (
      !Number.isInteger(this.hp) ||
      this.hp < 1 ||
      !this.waveSizes.length ||
      this.waveSizes.some((n) => !Number.isInteger(n) || n < 1) ||
      !Number.isFinite(interval) ||
      interval <= 0 ||
      !Number.isFinite(this.duration) ||
      this.duration <= 0
    )
      throw new Error(
        "Raid needs positive HP, wave sizes, interval and duration",
      );
    this.controls = new ActionController(RaidActions, {
      scene,
      input,
      bindings: {
        Move: {
          x: {
            negative: [KeyCode.A, KeyCode.ArrowLeft],
            positive: [KeyCode.D, KeyCode.ArrowRight],
          },
          y: {
            negative: [KeyCode.W, KeyCode.ArrowUp],
            positive: [KeyCode.S, KeyCode.ArrowDown],
          },
        },
        Fire: { keys: [KeyCode.Space] },
        Sprint: { keys: [KeyCode.ShiftLeft, KeyCode.ShiftRight] },
        Pause: { keys: [KeyCode.P, KeyCode.Escape] },
      },
    });
    this.input = this.controls.createSource(scene);
    const clock = new Actor({ id: "raid-clock" });
    clock.add(new Clock(this));
    scene.add(clock);
    this.player = this.create(
      "player",
      arena.width / 2,
      arena.height - 48,
      this.hp,
    );
    this.player.add(new Motion({ speed: 220 }));
    this.player.add(new ActionMovement(this.controls.reader(RaidActions.Move)));
    this.player.add(new SprintScale(this.controls.reader(RaidActions.Sprint)));
    this.player.add(new Pilot(this));
    const collider = this.player.add(
      new Collider({
        shape: CollisionShape.Circle,
        radius: 11,
        layer: Layers.Player,
        mask: Layers.Enemy | Layers.EnemyShot,
        response: CollisionResponse.Trigger,
      }),
    );
    const bodyContact = ({ otherActor }: { otherActor: Actor }) => {
      if (
        !this.enemies.has(otherActor) ||
        otherActor.disposed ||
        this.status !== "playing"
      )
        return;
      this.hit();
      otherActor.dispose();
    };
    collider.events.on(ContactEnter, bodyContact, this.player);
    collider.events.on(ContactStay, bodyContact, this.player);
    this.world = new CollisionWorld(scene);
    this.stopSpawning = scene.every(
      interval,
      () => {
        if (
          this.status !== "playing" ||
          this.intermission > 0 ||
          this.waveSpawned >= (this.waveSizes[this.wave - 1] ?? 0)
        )
          return;
        this.spawnEnemy();
        this.waveSpawned++;
      },
      scene,
    );
    scene.onUpdate(() => this.completeStep());
  }
  private create(kind: Kind, x: number, y: number, hp = 1): Actor {
    const actor = new Actor();
    actor.add(new Transform({ x, y }));
    actor.add(new Unit(kind, hp));
    this.scene.add(actor);
    this.units.add(actor);
    actor.onDispose(() => {
      this.units.delete(actor);
      this.enemies.delete(actor);
      this.playerShots.delete(actor);
      this.enemyShots.delete(actor);
    });
    return actor;
  }
  spawnEnemy(
    options: {
      x?: number;
      y?: number;
      kind?: "scout" | "drifter" | "gunner";
      hp?: number;
      speed?: number;
      shoots?: boolean;
    } = {},
  ): Actor {
    const kind =
      options.kind ??
      (this.wave === 1
        ? "scout"
        : this.wave === 2
          ? this.spawned % 2
            ? "drifter"
            : "scout"
          : this.spawned % 3
            ? "drifter"
            : "gunner");
    const x = options.x ?? 48 + Math.floor(this.random() * 5) * 66;
    const actor = this.create(
      kind,
      x,
      options.y ?? -28,
      options.hp ?? (kind === "scout" ? 1 : kind === "drifter" ? 2 : 3),
    );
    actor.add(
      new Motion({
        speed:
          options.speed ??
          (kind === "gunner" ? 42 : kind === "drifter" ? 55 : 75),
        y: 1,
      }),
    );
    actor.add(
      new Flight(
        x,
        kind === "scout" ? 12 : 28,
        kind === "scout" ? 1.3 : 1.8,
        this.random() * Math.PI * 2,
        options.shoots ?? kind !== "scout",
        this,
      ),
    );
    actor.add(new Lifetime(this, 20));
    actor.add(
      new Collider({
        shape: CollisionShape.Circle,
        radius: kind === "gunner" ? 19 : 14,
        layer: Layers.Enemy,
        mask: Layers.Player | Layers.PlayerShot,
        response: CollisionResponse.Trigger,
      }),
    );
    this.enemies.add(actor);
    this.spawned++;
    return actor;
  }
  spawnPlayerShot(x: number, y: number, speed = 300): Actor {
    const shot = this.create("player-shot", x, y);
    this.playerShots.add(shot);
    this.shotsFired++;
    shot.add(new Motion({ speed, y: -1 }));
    shot.add(new Lifetime(this, 3));
    const collider = shot.add(
      new Collider({
        shape: CollisionShape.Circle,
        radius: 6,
        layer: Layers.PlayerShot,
        mask: Layers.Enemy,
        response: CollisionResponse.Trigger,
      }),
    );
    collider.events.on(
      ContactEnter,
      ({ otherActor }) => {
        if (
          this.status !== "playing" ||
          shot.disposed ||
          otherActor.disposed ||
          !this.enemies.has(otherActor)
        )
          return;
        // Consume first; removal suppresses later contacts from the same projectile.
        shot.dispose();
        const unit = otherActor.require(Unit.type);
        unit.hp--;
        if (unit.hp <= 0) {
          this.score +=
            unit.kind === "gunner" ? 220 : unit.kind === "drifter" ? 160 : 100;
          this.kills++;
          otherActor.dispose();
        }
      },
      shot,
    );
    return shot;
  }
  spawnEnemyShot(x: number, y: number, dx = 0, dy = 1, speed = 165): Actor {
    const shot = this.create("enemy-shot", x, y);
    this.enemyShots.add(shot);
    const length = Math.hypot(dx, dy) || 1;
    shot.add(new Motion({ speed, x: dx / length, y: dy / length }));
    shot.add(new Lifetime(this, 5));
    const collider = shot.add(
      new Collider({
        shape: CollisionShape.Circle,
        radius: 5,
        layer: Layers.EnemyShot,
        mask: Layers.Player,
        response: CollisionResponse.Trigger,
      }),
    );
    collider.events.on(
      ContactEnter,
      ({ otherActor }) => {
        if (
          otherActor !== this.player ||
          shot.disposed ||
          this.status !== "playing"
        )
          return;
        shot.dispose();
        this.hit();
      },
      shot,
    );
    return shot;
  }
  hit(): boolean {
    if (this.status !== "playing" || this.invulnerable > 0 || this.hp <= 0)
      return false;
    this.hp--;
    this.player.require(Unit.type).hp = this.hp;
    this.invulnerable = 1;
    return true;
  }
  breach(): void {
    if (this.status === "playing") {
      this.breaches++;
      this.hp = Math.max(0, this.hp - 1);
      this.player.require(Unit.type).hp = this.hp;
    }
  }
  advance(seconds: number): void {
    if (this.status !== "playing") return;
    this.elapsed += seconds;
    this.invulnerable = Math.max(0, this.invulnerable - seconds);
    this.intermission = Math.max(0, this.intermission - seconds);
  }
  private completeStep(): void {
    if (this.status !== "playing") return;
    if (this.hp <= 0 || this.elapsed >= this.duration) this.finish("lost");
    else if (
      this.waveSpawned >= (this.waveSizes[this.wave - 1] ?? 0) &&
      this.enemies.size === 0
    ) {
      if (this.wave >= this.waveSizes.length) this.finish("won");
      else {
        this.wave++;
        this.waveSpawned = 0;
        this.intermission = 1;
      }
    }
    this.scene.events.emit(RaidChanged, {
      hp: this.hp,
      score: this.score,
      wave: this.wave,
      status: this.status,
    });
  }
  private finish(status: "won" | "lost"): void {
    this.status = status;
    this.stopSpawning();
    this.world.dispose();
    for (const actor of this.units) actor.enabled = false;
    this.scene.events.emit(RaidFinished, status);
  }
  snapshot() {
    return {
      status: this.status,
      hp: this.hp,
      score: this.score,
      kills: this.kills,
      shotsFired: this.shotsFired,
      spawned: this.spawned,
      breaches: this.breaches,
      elapsed: this.elapsed,
      invulnerable: this.invulnerable,
      wave: this.wave,
      waveSpawned: this.waveSpawned,
      intermission: this.intermission,
      units: [...this.units].map((actor) => {
        const t = actor.require(Transform.type),
          u = actor.require(Unit.type),
          flight = actor.get(Flight.type),
          motion = actor.get(Motion.type),
          pilot = actor.get(Pilot.type);
        return {
          id: actor.id,
          kind: u.kind,
          hp: u.hp,
          age: u.age,
          x: t.x,
          y: t.y,
          rotation: t.rotation,
          ...(motion
            ? {
                dx: motion.direction.x,
                dy: motion.direction.y,
                speed: motion.speed,
              }
            : {}),
          ...(flight
            ? {
                baseX: flight.baseX,
                amplitude: flight.amplitude,
                omega: flight.omega,
                offset: flight.offset,
                flightAge: flight.age,
                cooldown: flight.cooldown,
              }
            : {}),
          ...(pilot ? { weaponCooldown: pilot.cooldown } : {}),
        };
      }),
    };
  }
}
