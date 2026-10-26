import {
  Component,
  ComponentPhase,
  type ComponentType,
  defineComponent,
  type UpdateContext,
} from "./component";
import { EngineError, positive } from "./diagnostics";
import { type Direction, type KeyMap, KeyMaps } from "./input";

function finite(value: number, field: string): number {
  if (!Number.isFinite(value))
    throw new EngineError("INVALID_VALUE", `${field} must be finite`, {
      field,
    });
  return value;
}
export class Transform extends Component {
  static readonly type: ComponentType<Transform> =
    defineComponent<Transform>("Transform");
  readonly type: ComponentType<Transform> = Transform.type;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  constructor(
    options: {
      x?: number;
      y?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    } = {},
  ) {
    super();
    this.x = finite(options.x ?? 0, "x");
    this.y = finite(options.y ?? 0, "y");
    this.rotation = finite(options.rotation ?? 0, "rotation");
    this.scaleX = finite(options.scaleX ?? 1, "scaleX");
    this.scaleY = finite(options.scaleY ?? 1, "scaleY");
  }
}
export const Shape = {
  Box: "box",
  Character: "character",
  Circle: "circle",
} as const;
export const SpriteFit = { Contain: "contain", Stretch: "stretch" } as const;
export type SpriteFit = (typeof SpriteFit)[keyof typeof SpriteFit];
export function imageSize(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  fit: SpriteFit = SpriteFit.Contain,
) {
  positive(sourceWidth, "sourceWidth");
  positive(sourceHeight, "sourceHeight");
  positive(width, "width");
  positive(height, "height");
  if (fit === SpriteFit.Stretch) return { width, height };
  if (fit !== SpriteFit.Contain)
    throw new EngineError("INVALID_VALUE", "Unknown sprite fit");
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}
export type Shape = (typeof Shape)[keyof typeof Shape];
export class Renderable extends Component {
  static readonly type: ComponentType<Renderable> = defineComponent<Renderable>(
    "Renderable",
    [Transform.type],
  );
  readonly type: ComponentType<Renderable> = Renderable.type;
  readonly width: number;
  readonly height: number;
  readonly color: number;
  readonly sprite: string | undefined;
  readonly shape: Shape;
  readonly fit: SpriteFit;
  visible: boolean;
  private alpha: number;
  private depth: number;
  get opacity(): number {
    return this.alpha;
  }
  set opacity(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new EngineError("INVALID_VALUE", "opacity must be between 0 and 1");
    this.alpha = value;
  }
  get zIndex(): number {
    return this.depth;
  }
  set zIndex(value: number) {
    this.depth = finite(value, "zIndex");
  }
  constructor(
    options: {
      width?: number;
      height?: number;
      color?: number;
      sprite?: string;
      shape?: Shape;
      fit?: SpriteFit;
      opacity?: number;
      visible?: boolean;
      zIndex?: number;
    } = {},
  ) {
    super();
    this.width = positive(options.width ?? 32, "width");
    this.height = positive(options.height ?? 32, "height");
    this.color = options.color ?? 0x73e3c0;
    if (
      !Number.isInteger(this.color) ||
      this.color < 0 ||
      this.color > 0xffffff
    )
      throw new EngineError(
        "INVALID_VALUE",
        "color must be a 24-bit RGB integer",
      );
    this.sprite = options.sprite;
    this.fit = options.fit ?? SpriteFit.Contain;
    if (!Object.values(SpriteFit).includes(this.fit))
      throw new EngineError("INVALID_VALUE", "Unknown sprite fit");
    this.alpha = 1;
    this.depth = 0;
    this.opacity = options.opacity ?? 1;
    this.zIndex = options.zIndex ?? 0;
    this.visible = options.visible ?? true;
    this.shape = options.shape ?? Shape.Box;
    if (!Object.values(Shape).includes(this.shape))
      throw new EngineError("INVALID_VALUE", "Unknown shape");
  }
}
export class Motion extends Component {
  static readonly type: ComponentType<Motion> = defineComponent<Motion>(
    "Motion",
    [Transform.type],
  );
  readonly type: ComponentType<Motion> = Motion.type;
  readonly direction: Direction = { x: 0, y: 0 };
  readonly speed: number;
  private transform: Transform | undefined;
  constructor(options: { speed?: number; x?: number; y?: number } = {}) {
    super();
    this.speed = positive(options.speed ?? 180, "speed");
    this.direction.x = finite(options.x ?? 0, "direction.x");
    this.direction.y = finite(options.y ?? 0, "direction.y");
  }
  protected onAttach(): void {
    this.transform = this.actor.require(Transform.type);
  }
  update(context: UpdateContext): void {
    if (!this.transform) return;
    this.transform.x += this.direction.x * this.speed * context.delta;
    this.transform.y += this.direction.y * this.speed * context.delta;
  }
  protected onDestroy(): void {
    this.transform = undefined;
  }
}
export class KeyboardController extends Component {
  static readonly type: ComponentType<KeyboardController> =
    defineComponent<KeyboardController>("KeyboardController", [Motion.type]);
  readonly type: ComponentType<KeyboardController> = KeyboardController.type;
  readonly phase = ComponentPhase.Input;
  readonly keys: KeyMap;
  private motion: Motion | undefined;
  constructor(keys: KeyMap = KeyMaps.wasd) {
    super();
    this.keys = {
      up: [...keys.up],
      down: [...keys.down],
      left: [...keys.left],
      right: [...keys.right],
    };
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
    if (this.motion)
      context.input.writeDirection(this.keys, this.motion.direction);
  }
  protected onDestroy(): void {
    this.onDisable();
    this.motion = undefined;
  }
}
