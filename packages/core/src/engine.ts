import type { UpdateContext } from "./component";
import { Transform } from "./components";
import { EngineError } from "./diagnostics";
import { InputState } from "./input";
import { cleanupAll } from "./lifetime";
import { Scene, SceneState } from "./scene";
export class Engine {
  readonly input = new InputState();
  private active = new Scene("default");
  private dead = false;
  private stepping = false;
  private transitioning = false;
  private suspended = false;
  private elapsed = 0;
  private randomState: number;
  private readonly context: {
    delta: number;
    input: UpdateContext["input"];
    scene: Scene;
  };
  constructor(seed = 1) {
    this.randomState = seed >>> 0;
    this.active.claim(this);
    this.context = {
      delta: 0,
      input: this.input.capture(),
      scene: this.active,
    };
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
  get paused(): boolean {
    return this.suspended;
  }
  pause(): void {
    this.assertAlive();
    if (!this.suspended) {
      this.suspended = true;
      this.input.clear();
    }
  }
  resume(): void {
    this.assertAlive();
    if (this.suspended) {
      this.suspended = false;
      this.input.clear();
    }
  }
  activate(scene: Scene): void {
    this.assertAlive();
    if (this.stepping || this.transitioning)
      throw new EngineError(
        "TRANSITION_REENTRANT",
        "Cannot activate during a synchronous update or transition",
      );
    scene.validateOwner(this);
    if (scene === this.active && scene.state === SceneState.Active) return;
    if (scene.state === SceneState.Preparing) scene.markReady();
    if (scene.state !== SceneState.Ready)
      throw new EngineError("SCENE_STATE", "Only ready scenes can activate", {
        sceneId: scene.id,
      });
    scene.claim(this);
    const previous = this.active;
    this.transitioning = true;
    this.active = scene;
    this.context.scene = scene;
    scene.activateOwned();
    if (previous !== scene) this.input.clear();
    try {
      cleanupAll(
        [
          ...(previous !== scene
            ? [() => previous.deactivateOwned(), () => previous.dispose()]
            : []),
          () => scene.notifyActivated(),
        ],
        "Scene transition callbacks failed",
      );
    } finally {
      this.transitioning = false;
    }
  }
  step(seconds: number): void {
    this.assertAlive();
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new EngineError(
        "INVALID_DELTA",
        "Delta seconds must be finite and nonnegative",
      );
    if (this.stepping || this.transitioning)
      throw new EngineError(
        "STEP_REENTRANT",
        "Cannot step during an update or transition",
      );
    if (this.suspended) return;
    if (
      this.active.state === SceneState.Preparing ||
      this.active.state === SceneState.Ready
    )
      this.activate(this.active);
    this.context.delta = seconds;
    this.context.input = this.input.capture();
    this.context.scene = this.active;
    this.stepping = true;
    try {
      this.elapsed += seconds;
      this.active.step(this.context);
    } finally {
      this.stepping = false;
    }
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
      sceneState: this.active.state,
      elapsed: this.elapsed,
      paused: this.suspended,
      randomState: this.randomState,
      input: this.input.snapshot(),
      actors: this.active.actors.map((actor) => {
        const transform = actor.get(Transform.type);
        return {
          id: actor.id,
          enabled: actor.enabled,
          ...(transform
            ? {
                transform: {
                  x: transform.x,
                  y: transform.y,
                  rotation: transform.rotation,
                  scaleX: transform.scaleX,
                  scaleY: transform.scaleY,
                },
              }
            : {}),
        };
      }),
    };
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    cleanupAll(
      [() => this.input.dispose(), () => this.active.dispose()],
      "Engine cleanup failed",
    );
  }
}
