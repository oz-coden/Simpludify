import {
  Aspect,
  type CharacterState,
  Engine,
  EngineError,
  type FrameDriver,
  type PreparedScene,
  positive,
  type RendererPort,
  Scene,
  type WorldView,
} from "@simpludify/core";
import { BrowserInput } from "./input";
import { PixiRenderer } from "./renderer";
import {
  type MountedUI,
  mountUI,
  Theme,
  Themes,
  type ThemeTokens,
  type UINode,
} from "./ui";
export interface SceneContext {
  readonly scene: Scene;
  add(character: CharacterState): CharacterState;
  ui(...nodes: UINode[]): void;
  onUpdate(callback: (seconds: number) => void): void;
  onDispose(callback: () => void): void;
}
export type SceneSetup = (context: SceneContext) => void | Promise<void>;
export interface GameOptions {
  parent?: HTMLElement;
  world?: Partial<WorldView>;
  theme?: Theme;
  tokens?: Partial<ThemeTokens>;
  seed?: number;
  maxDelta?: number;
  renderer?: (host: HTMLElement) => RendererPort;
  frames?: FrameDriver;
  onError?: (error: unknown) => void;
}
export class Game<SceneId extends string = string> {
  readonly engine: Engine;
  readonly element: HTMLDivElement;
  private readonly renderer: RendererPort;
  private readonly keyboard: BrowserInput;
  private readonly observer: ResizeObserver;
  private readonly frames: FrameDriver;
  private readonly view: WorldView;
  private readonly maxDelta: number;
  private readonly options: GameOptions;
  private readonly scenes = new Map<SceneId, SceneSetup>();
  private readonly defaultUI: UINode[] = [];
  private ui: MountedUI | undefined;
  private prepared: PreparedScene | undefined;
  private startPromise: Promise<void> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private frame: number | undefined;
  private previousTime: number | undefined;
  private dead = false;
  private started = false;
  private staging: Scene | undefined;
  private readonly errorBox: HTMLParagraphElement;
  constructor(options: GameOptions = {}) {
    this.options = options;
    this.engine = new Engine(options.seed);
    this.maxDelta = positive(options.maxDelta ?? 0.05, "maxDelta");
    this.view = {
      width: positive(options.world?.width ?? 800, "world.width"),
      height: positive(options.world?.height ?? 450, "world.height"),
      aspect: options.world?.aspect ?? Aspect.Fit,
    };
    if (!Object.values(Aspect).includes(this.view.aspect))
      throw new EngineError("INVALID_ASPECT", "Unknown aspect policy");
    const theme = Themes[options.theme ?? Theme.Dark];
    if (!theme) throw new EngineError("INVALID_THEME", "Unknown theme");
    const tokens = { ...theme, ...options.tokens };
    this.element = document.createElement("div");
    this.element.className = "simpludify";
    this.element.tabIndex = 0;
    this.element.setAttribute(
      "aria-label",
      "Game. Focus this area to use movement keys.",
    );
    for (const [name, value] of Object.entries(tokens))
      this.element.style.setProperty(`--s-${name}`, value);
    this.errorBox = document.createElement("p");
    this.errorBox.className = "s-error";
    this.errorBox.setAttribute("role", "alert");
    this.errorBox.hidden = true;
    this.element.append(this.errorBox);
    (options.parent ?? document.body).append(this.element);
    try {
      this.renderer =
        options.renderer?.(this.element) ??
        new PixiRenderer(this.element, tokens.background);
    } catch (error) {
      this.element.remove();
      this.engine.dispose();
      throw error;
    }
    this.frames = options.frames ?? {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    };
    this.keyboard = new BrowserInput(this.element, this.engine.input, () =>
      this.engine.scene.characters.map((c) => c.keys),
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.element);
  }
  private assertAlive(): void {
    if (this.dead)
      throw new EngineError("GAME_DISPOSED", "Game has been disposed");
  }
  add(character: CharacterState): CharacterState {
    this.assertAlive();
    if (this.startPromise)
      throw new EngineError(
        "SCENE_SEALED",
        "Add entities in scene setup before readiness",
      );
    return this.engine.scene.add(character);
  }
  uiOverlay(...nodes: UINode[]): void {
    this.assertAlive();
    if (this.startPromise)
      throw new EngineError("SCENE_SEALED", "Define UI before run");
    this.defaultUI.push(...nodes);
  }
  scene(id: SceneId, setup: SceneSetup): this {
    this.assertAlive();
    if (this.scenes.has(id))
      throw new EngineError(
        "DUPLICATE_SCENE",
        "Scene id is already registered",
        { sceneId: id },
      );
    this.scenes.set(id, setup);
    return this;
  }
  run(initialScene?: SceneId): Promise<void> {
    if (this.dead)
      return Promise.reject(
        new EngineError("GAME_DISPOSED", "Game has been disposed"),
      );
    if (this.startPromise) return this.startPromise;
    this.startPromise = (async () => {
      try {
        await this.renderer.init();
        this.assertAlive();
        this.started = true;
        if (initialScene !== undefined) await this.goTo(initialScene);
        else {
          this.engine.scene.seal();
          const prepared = await this.renderer.prepare(
            this.engine.scene.characters,
          );
          if (this.dead) {
            prepared.dispose();
            this.assertAlive();
          }
          this.prepared = prepared;
          this.assertAlive();
          this.ui = mountUI(this.defaultUI, (error) => this.report(error));
          this.element.append(this.ui.element);
        }
        this.assertAlive();
        this.resize();
        this.prepared?.render();
        this.frame = this.frames.request(this.tick);
      } catch (error) {
        this.dispose();
        throw error;
      }
    })();
    return this.startPromise;
  }
  goTo(id: SceneId): Promise<void> {
    if (this.dead)
      return Promise.reject(
        new EngineError("GAME_DISPOSED", "Game has been disposed"),
      );
    if (!this.started)
      return Promise.reject(
        new EngineError("GAME_NOT_READY", "Call run before navigating"),
      );
    const setup = this.scenes.get(id);
    if (!setup)
      return Promise.reject(
        new EngineError("SCENE_NOT_FOUND", "Unknown scene", { sceneId: id }),
      );
    const task = this.queue.then(async () => {
      this.assertAlive();
      const scene = new Scene(id);
      this.staging = scene;
      const nodes: UINode[] = [];
      let prepared: PreparedScene | undefined;
      let ui: MountedUI | undefined;
      let committed = false;
      try {
        await setup({
          scene,
          add: (character) => scene.add(character),
          ui: (...items) => nodes.push(...items),
          onUpdate: (callback) => scene.onUpdate(callback),
          onDispose: (callback) => scene.onDispose(callback),
        });
        this.assertAlive();
        scene.seal();
        prepared = await this.renderer.prepare(scene.characters);
        this.assertAlive();
        ui = mountUI(nodes, (error) => this.report(error));
        const oldPrepared = this.prepared,
          oldUI = this.ui;
        this.prepared = prepared;
        this.ui = ui;
        committed = true;
        this.staging = undefined;
        this.errorBox.hidden = true;
        try {
          this.engine.activate(scene);
        } catch (error) {
          this.report(error);
        }
        for (const cleanup of [
          () => oldPrepared?.dispose(),
          () => oldUI?.dispose(),
        ]) {
          try {
            cleanup();
          } catch (error) {
            this.report(error);
          }
        }
        this.assertAlive();
        this.element.append(ui.element);
        this.previousTime = undefined;
        this.resize();
        prepared.render();
      } catch (error) {
        if (!committed) {
          prepared?.dispose();
          ui?.dispose();
          try {
            scene.dispose();
          } catch (cleanupError) {
            this.report(cleanupError);
          }
        }
        if (this.staging === scene) this.staging = undefined;
        throw error;
      }
    });
    this.queue = task.catch(() => {});
    return task;
  }
  private resize(): void {
    if (!this.started || this.dead) return;
    const { width, height } = this.element.getBoundingClientRect();
    if (width > 0 && height > 0) {
      this.renderer.resize(width, height, this.view);
      this.prepared?.render();
    }
  }
  private readonly tick = (time: number): void => {
    if (this.dead) return;
    try {
      if (document.hidden) {
        this.previousTime = undefined;
        this.engine.input.clear();
      } else {
        const seconds =
          this.previousTime === undefined
            ? 0
            : Math.min(
                this.maxDelta,
                Math.max(0, (time - this.previousTime) / 1000),
              );
        this.previousTime = time;
        this.engine.step(seconds);
        this.prepared?.render();
      }
      this.frame = this.frames.request(this.tick);
    } catch (error) {
      this.report(error);
      this.dispose();
    }
  };
  private report(error: unknown): void {
    this.errorBox.textContent =
      error instanceof Error ? error.message : String(error);
    this.errorBox.hidden = false;
    try {
      this.options.onError?.(error);
    } catch {
      /* Diagnostic observers must not prevent cleanup. */
    }
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    if (this.frame !== undefined) this.frames.cancel(this.frame);
    const cleanup = [
      () => this.staging?.dispose(),
      () => this.keyboard.dispose(),
      () => this.observer.disconnect(),
      () => this.ui?.dispose(),
      () => this.prepared?.dispose(),
      () => this.renderer.dispose(),
      () => this.engine.dispose(),
      () => this.element.remove(),
    ];
    for (const action of cleanup) {
      try {
        action();
      } catch (error) {
        this.report(error);
      }
    }
  }
}
