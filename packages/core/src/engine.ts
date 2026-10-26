import { EngineError } from "./diagnostics";
import { InputState } from "./input";
import { Scene } from "./scene";
export class Engine {
  readonly input = new InputState();
  private active = new Scene("default");
  private dead = false;
  private elapsed = 0;
  private randomState: number;
  constructor(seed = 1) {
    this.randomState = seed >>> 0;
  }
  get scene(): Scene {
    return this.active;
  }
  get disposed(): boolean {
    return this.dead;
  }
  private assertAlive(): void {
    if (this.dead)
      throw new EngineError("GAME_DISPOSED", "Game has been disposed");
  }
  /** Activates the new scene even if old cleanup throws. */
  activate(scene: Scene): void {
    this.assertAlive();
    if (scene.disposed)
      throw new EngineError(
        "SCENE_DISPOSED",
        "Cannot activate a disposed scene",
        { sceneId: scene.id },
      );
    if (scene === this.active) return;
    const previous = this.active;
    this.active = scene;
    this.input.clear();
    previous.dispose();
  }
  step(seconds: number): void {
    this.assertAlive();
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new EngineError(
        "INVALID_DELTA",
        "Delta seconds must be finite and nonnegative",
      );
    for (const character of this.active.characters) {
      const direction = this.input.direction(character.keys);
      character.x += direction.x * character.speed * seconds;
      character.y += direction.y * character.speed * seconds;
    }
    this.elapsed += seconds;
    this.active.update(seconds);
  }
  random(): number {
    this.assertAlive();
    this.randomState =
      (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  snapshot() {
    return {
      sceneId: this.active.id,
      elapsed: this.elapsed,
      randomState: this.randomState,
      input: this.input.snapshot(),
      characters: this.active.characters.map((c) => ({
        ...(c.id === undefined ? {} : { id: c.id }),
        x: c.x,
        y: c.y,
      })),
    };
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.input.clear();
    this.active.dispose();
  }
}
