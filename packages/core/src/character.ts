import { Actor } from "./actor";
import {
  KeyboardController,
  Motion,
  Renderable,
  Shape,
  Transform,
} from "./components";
import { EngineError } from "./diagnostics";
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
export class CharacterActor extends Actor {
  get x(): number {
    return this.require(Transform.type).x;
  }
  set x(value: number) {
    this.require(Transform.type).x = value;
  }
  get y(): number {
    return this.require(Transform.type).y;
  }
  set y(value: number) {
    this.require(Transform.type).y = value;
  }
}
/** Composition preset; the simulation has no knowledge of characters. */
export function Character(options: CharacterOptions = {}): CharacterActor {
  const keys = options.keys ?? KeyMaps[options.movement ?? Movement.None];
  if (!keys) throw new EngineError("INVALID_MOVEMENT", "Unknown movement mode");
  const actor = new CharacterActor(
    options.id === undefined ? {} : { id: options.id },
  );
  try {
    actor.add(new Transform({ x: options.x ?? 400, y: options.y ?? 225 }));
    actor.add(
      new Renderable({
        width: options.size ?? 32,
        height: options.size ?? 32,
        color: options.color ?? 0x73e3c0,
        shape: Shape.Character,
        ...(options.sprite === undefined ? {} : { sprite: options.sprite }),
      }),
    );
    actor.add(new Motion({ speed: options.speed ?? 180 }));
    actor.add(new KeyboardController(keys));
    return actor;
  } catch (error) {
    actor.dispose();
    throw error;
  }
}
