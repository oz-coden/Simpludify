import { EngineError } from "../foundation/diagnostics";
import { Transform } from "../graphics/components";
import type { ActionReader } from "../interaction/actions";
import {
  Component,
  ComponentPhase,
  type ComponentType,
  defineComponent,
  type UpdateContext,
} from "../scene/component";

function finite(value: number, field: string): number {
  if (!Number.isFinite(value))
    throw new EngineError("INVALID_VALUE", `${field} must be finite`, {
      field,
    });
  return value;
}
/** Integrates an input-independent direction × speed after command-producing Components. */
export class Motion extends Component {
  static readonly type: ComponentType<Motion> = defineComponent<Motion>(
    "Motion",
    [Transform.type],
  );
  readonly type: ComponentType<Motion> = Motion.type;
  readonly phase: ComponentPhase = ComponentPhase.Integrate;
  private readonly vector = { x: 0, y: 0 };
  get direction(): { x: number; y: number } {
    return this.vector;
  }
  private rate = 180;
  private transform: Transform | undefined;
  get speed(): number {
    return this.rate;
  }
  set speed(value: number) {
    if (!Number.isFinite(value) || value < 0)
      throw new EngineError(
        "INVALID_VALUE",
        "Motion.speed must be finite and nonnegative",
      );
    this.rate = value;
  }
  constructor(options: { speed?: number; x?: number; y?: number } = {}) {
    super();
    this.speed = options.speed ?? 180;
    this.vector.x = finite(options.x ?? 0, "Motion.direction.x");
    this.vector.y = finite(options.y ?? 0, "Motion.direction.y");
  }
  protected onAttach(): void {
    this.transform = this.actor.require(Transform.type);
  }
  update(context: UpdateContext): void {
    if (!this.transform) return;
    const dx = finite(this.vector.x, "Motion.direction.x"),
      dy = finite(this.vector.y, "Motion.direction.y");
    const x = finite(
        this.transform.x + dx * this.rate * context.delta,
        "Motion result x",
      ),
      y = finite(
        this.transform.y + dy * this.rate * context.delta,
        "Motion result y",
      );
    this.transform.x = x;
    this.transform.y = y;
  }
  protected onDestroy(): void {
    this.transform = undefined;
  }
}
/** Optional Action-to-Motion adapter. Custom Update Components can replace it entirely. */
export class ActionMovement extends Component {
  static readonly type: ComponentType<ActionMovement> =
    defineComponent<ActionMovement>("ActionMovement", [Motion.type]);
  readonly type = ActionMovement.type;
  readonly phase: ComponentPhase = ComponentPhase.Update;
  private motion: Motion | undefined;
  private factor = 1;
  get scale(): number {
    return this.factor;
  }
  set scale(value: number) {
    if (!Number.isFinite(value) || value < 0)
      throw new EngineError(
        "INVALID_VALUE",
        "ActionMovement.scale must be finite and nonnegative",
      );
    this.factor = value;
  }
  constructor(
    readonly input: ActionReader<"axis2d">,
    options: { scale?: number } = {},
  ) {
    super();
    this.scale = options.scale ?? 1;
  }
  protected onAttach(): void {
    this.motion = this.actor.require(Motion.type);
  }
  protected onDisable(): void {
    if (this.motion) {
      this.motion.direction.x = 0;
      this.motion.direction.y = 0;
    }
  }
  update(context: UpdateContext): void {
    if (this.input.scene !== context.scene)
      throw new EngineError(
        "INPUT_SCENE",
        "Movement Action belongs to another Scene",
      );
    if (this.input.disposed) {
      this.onDisable();
      return;
    }
    const value = this.input.value();
    if (this.motion) {
      this.motion.direction.x = value.x * this.factor;
      this.motion.direction.y = value.y * this.factor;
    }
  }
  protected onDestroy(): void {
    this.onDisable();
    this.motion = undefined;
  }
}
