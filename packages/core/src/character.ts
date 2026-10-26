import { EngineError, positive } from "./diagnostics";
import { type KeyMap, KeyMaps, Movement } from "./input";
export interface CharacterOptions {
  id?: string;
  x?: number;
  y?: number;
  speed?: number;
  size?: number;
  color?: number;
  movement?: Movement;
  keys?: KeyMap;
  sprite?: string;
}
export interface CharacterState {
  readonly id?: string;
  x: number;
  y: number;
  readonly speed: number;
  readonly size: number;
  readonly color: number;
  readonly keys: KeyMap;
  readonly sprite?: string;
}
export function Character(options: CharacterOptions = {}): CharacterState {
  const x = options.x ?? 400,
    y = options.y ?? 225;
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new EngineError(
      "INVALID_VALUE",
      "Character coordinates must be finite",
    );
  const keys = options.keys ?? KeyMaps[options.movement ?? Movement.None];
  if (!keys) throw new EngineError("INVALID_MOVEMENT", "Unknown movement mode");
  const color = options.color ?? 0x73e3c0;
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff)
    throw new EngineError(
      "INVALID_VALUE",
      "color must be a 24-bit RGB integer",
    );
  return {
    ...(options.id === undefined ? {} : { id: options.id }),
    x,
    y,
    speed: positive(options.speed ?? 180, "speed"),
    size: positive(options.size ?? 32, "size"),
    color,
    keys: {
      up: [...keys.up],
      down: [...keys.down],
      left: [...keys.left],
      right: [...keys.right],
    },
    ...(options.sprite === undefined ? {} : { sprite: options.sprite }),
  };
}
