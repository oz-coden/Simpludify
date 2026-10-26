import type { CharacterState } from "./character";
import { EngineError } from "./diagnostics";
export class Scene {
  private readonly entities: CharacterState[] = [];
  private readonly cleanup: Array<() => void> = [];
  private readonly updates: Array<(seconds: number) => void> = [];
  private dead = false;
  private sealed = false;
  constructor(readonly id: string) {}
  get characters(): readonly CharacterState[] {
    return this.entities;
  }
  get disposed(): boolean {
    return this.dead;
  }
  private assertAlive(): void {
    if (this.dead)
      throw new EngineError("SCENE_DISPOSED", "Scene has been disposed", {
        sceneId: this.id,
      });
  }
  seal(): void {
    this.assertAlive();
    this.sealed = true;
  }
  add(character: CharacterState): CharacterState {
    this.assertAlive();
    if (this.sealed)
      throw new EngineError(
        "SCENE_SEALED",
        "Entities must be added during scene setup",
        { sceneId: this.id },
      );
    if (
      this.entities.includes(character) ||
      (character.id !== undefined &&
        this.entities.some((item) => item.id === character.id))
    )
      throw new EngineError(
        "DUPLICATE_ENTITY",
        "Entity or id already belongs to this scene",
        { sceneId: this.id },
      );
    this.entities.push(character);
    return character;
  }
  onUpdate(callback: (seconds: number) => void): void {
    this.assertAlive();
    this.updates.push(callback);
  }
  onDispose(callback: () => void): void {
    this.assertAlive();
    this.cleanup.push(callback);
  }
  update(seconds: number): void {
    this.assertAlive();
    for (const callback of this.updates) callback(seconds);
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const errors: unknown[] = [];
    for (const callback of this.cleanup.reverse()) {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    }
    this.cleanup.length = 0;
    this.updates.length = 0;
    this.entities.length = 0;
    if (errors.length) throw new AggregateError(errors, "Scene cleanup failed");
  }
}
