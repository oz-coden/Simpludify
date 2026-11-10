import { EngineError } from "../foundation/diagnostics";
import { cleanupAll } from "../foundation/lifetime";
import { RandomManager } from "../foundation/random";
import { Transform } from "../graphics/components";
import { InputSystem } from "../interaction/input";
import type { ExecutionPort } from "../scene/execution";
import { Scene, type SceneRetention, SceneState } from "../scene/scene";
export class Engine {
  readonly input = new InputSystem();
  private active = new Scene("default");
  private dead = false;
  private readonly retained = new Map<Scene, () => void>();
  private stepping = false;
  private transitioning = false;
  private suspended = false;
  private elapsed = 0;
  private count = 0;
  private execution: ExecutionPort | undefined;
  get stepCount(): number {
    return this.count;
  }
  /** @internal Replay owns this single optional execution boundary. */
  attachExecution(port: ExecutionPort): () => void {
    this.assertAlive();
    if (this.execution || this.stepping || this.transitioning)
      throw new EngineError(
        "REPLAY_STATE",
        "An execution driver is already attached or Engine is stepping",
      );
    this.execution = port;
    return () => {
      if (this.execution === port) this.execution = undefined;
    };
  }
  readonly random: RandomManager;
  private readonly context: {
    delta: number;
    scene: Scene;
  };
  constructor(options: { seed?: number } = {}) {
    this.random = new RandomManager(options.seed);
    this.active.claim(this);
    this.context = {
      delta: 0,
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
  activate(scene: Scene, options: { previous?: SceneRetention } = {}): void {
    this.assertAlive();
    if (this.stepping || this.transitioning)
      throw new EngineError(
        "TRANSITION_REENTRANT",
        "Cannot activate during a synchronous update or transition",
      );
    if (
      options.previous !== undefined &&
      options.previous !== "dispose" &&
      options.previous !== "retain"
    )
      throw new EngineError("INVALID_VALUE", "Unknown scene retention policy");
    scene.validateOwner(this);
    this.execution?.validateScene(scene);
    if (scene === this.active && scene.state === SceneState.Active) return;
    if (scene.state === SceneState.Preparing) scene.markReady();
    if (scene.state !== SceneState.Ready && !this.retained.has(scene))
      throw new EngineError("SCENE_STATE", "Only ready scenes can activate", {
        sceneId: scene.id,
      });
    scene.claim(this);
    const previous = this.active;
    const retain =
      previous !== scene &&
      previous.state === SceneState.Active &&
      options.previous === "retain";
    if (retain)
      this.retained.set(
        previous,
        previous.onDispose(() => {
          this.retained.delete(previous);
        }),
      );
    this.retained.get(scene)?.();
    this.retained.delete(scene);
    this.transitioning = true;
    this.active = scene;
    this.context.scene = scene;
    scene.activateOwned();
    try {
      const callbacks: (() => void)[] = [];
      if (previous !== scene) {
        callbacks.push(
          () => this.input.clear(),
          () => previous.deactivateOwned(retain),
        );
        if (!retain) callbacks.push(() => previous.dispose());
      }
      callbacks.push(() => scene.notifyActivated());
      cleanupAll(callbacks, "Scene transition callbacks failed");
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
    if (
      !this.suspended &&
      (this.active.state === SceneState.Preparing ||
        this.active.state === SceneState.Ready)
    ) {
      try {
        this.activate(this.active);
      } catch (error) {
        this.execution?.failed(error);
        throw error;
      }
      // Activation hooks may synchronously terminate this first step.
      if (this.dead || this.active.disposed) return;
    }
    this.stepping = true;
    const execution = this.execution;
    try {
      execution?.beforeStep(seconds);
      this.count++;
      if (!this.suspended || this.active.state === SceneState.Active)
        this.active.beginStep();
      this.context.delta = seconds;
      this.input.beginStep(execution?.captured);
      this.context.scene = this.active;
      // Logical input callbacks remain available for pause/resume controls.
      if (!this.dead && !this.suspended && !this.active.disposed) {
        this.elapsed += seconds;
        this.active.step(this.context);
      }
      execution?.afterStep();
    } catch (error) {
      execution?.failed(error);
      throw error;
    } finally {
      this.stepping = false;
    }
  }
  snapshot() {
    return {
      stepCount: this.count,
      sceneId: this.active.id,
      sceneState: this.active.state,
      elapsed: this.elapsed,
      paused: this.suspended,
      random: this.random.snapshot(),
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
    const inactive = [...this.retained.keys()];
    this.retained.clear();
    cleanupAll(
      [
        () => this.execution?.dispose(),
        () => this.input.dispose(),
        () => this.active.dispose(),
        ...inactive.map((scene) => () => scene.dispose()),
        () => this.random.dispose(),
      ],
      "Engine cleanup failed",
    );
  }
}
