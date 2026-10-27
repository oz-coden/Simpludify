import {
  type Actor,
  Aspect,
  Camera,
  createViewTransform,
  Engine,
  EngineError,
  type FrameDriver,
  KeyboardController,
  type LogicalResolution,
  type PreparedScene,
  positive,
  type RendererPort,
  Scene,
  SceneState,
  type ScreenPoint,
  screenPoint,
  screenToWorld,
  type Viewport,
  type ViewTransform,
  type WorldPoint,
  worldToScreen,
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
  readonly signal: AbortSignal;
  add<T extends Actor>(actor: T): T;
  ui(...nodes: UINode[]): void;
  onUpdate(callback: (seconds: number) => void): () => void;
  onActivate(callback: () => void): () => void;
  onDeactivate(callback: () => void): () => void;
  onDispose(callback: () => void): () => void;
}
export type SceneSetup = (context: SceneContext) => void | Promise<void>;
export interface GameOptions {
  parent?: HTMLElement;
  resolution?: LogicalResolution;
  aspect?: Aspect;
  camera?: Camera;
  viewport?: Viewport;
  pixelRatio?: number;
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
  readonly camera: Camera;
  private readonly renderer: RendererPort;
  private readonly keyboard: BrowserInput;
  private readonly observer: ResizeObserver;
  private readonly frames: FrameDriver;
  private readonly options: GameOptions;
  private readonly resolution: LogicalResolution;
  private readonly aspect: Aspect;
  private readonly maxDelta: number;
  private requestedViewport: Viewport | undefined;
  private projection: ViewTransform;
  private projectionDirty = true;
  private cameraX = NaN;
  private cameraY = NaN;
  private cameraZoom = NaN;
  private width = 800;
  private height = 450;
  private ratio = 1;
  private readonly scenes = new Map<SceneId, SceneSetup>();
  private readonly pendingScenes = new Map<SceneId, Promise<void>>();
  private readonly defaultUI: UINode[] = [];
  private ui: MountedUI | undefined;
  private prepared: PreparedScene | undefined;
  private startPromise: Promise<void> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private frame: number | undefined;
  private previousTime: number | undefined;
  private dead = false;
  private ready = false;
  private rendererReady = false;
  private rendererSized = false;
  private staging: Scene | undefined;
  private readonly shutdown = new AbortController();
  private readonly errorBox: HTMLParagraphElement;
  constructor(options: GameOptions = {}) {
    this.options = options;
    this.engine = new Engine(options.seed);
    this.camera = options.camera ?? new Camera();
    this.maxDelta = positive(options.maxDelta ?? 0.05, "maxDelta");
    this.resolution = {
      width: positive(options.resolution?.width ?? 800, "resolution.width"),
      height: positive(options.resolution?.height ?? 450, "resolution.height"),
    };
    this.aspect = options.aspect ?? Aspect.Fit;
    this.requestedViewport = options.viewport
      ? { ...options.viewport }
      : undefined;
    this.projection = createViewTransform({
      viewport: this.requestedViewport ?? {
        x: 0,
        y: 0,
        width: this.width,
        height: this.height,
      },
      resolution: this.resolution,
      aspect: this.aspect,
      camera: this.camera,
    });
    if (options.pixelRatio !== undefined)
      positive(options.pixelRatio, "pixelRatio");
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
        new PixiRenderer(this.element, tokens.background, (error) =>
          this.report(error),
        );
    } catch (error) {
      this.element.remove();
      this.engine.dispose();
      throw error;
    }
    this.frames = options.frames ?? {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    };
    this.keyboard = new BrowserInput(
      this.element,
      this.engine.input,
      (code) => {
        if (this.engine.input.acceptsKey(code)) return true;
        for (const actor of this.engine.scene.actors) {
          const controller = actor.get(KeyboardController.type);
          if (
            actor.enabled &&
            controller?.enabled &&
            Object.values(controller.keys).some((codes) => codes.includes(code))
          )
            return true;
        }
        return false;
      },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        this.previousTime = undefined;
        this.engine.input.clear();
      },
      { signal: this.shutdown.signal },
    );
    this.observer = new ResizeObserver(() => {
      try {
        this.resize();
      } catch (error) {
        this.report(error);
        this.dispose();
      }
    });
    this.observer.observe(this.element);
  }
  private assertAlive(): void {
    if (this.dead)
      throw new EngineError("GAME_DISPOSED", "Game has been disposed");
  }
  get paused(): boolean {
    return this.engine.paused;
  }
  pause(): void {
    this.assertAlive();
    this.engine.pause();
    this.previousTime = undefined;
  }
  resume(): void {
    this.assertAlive();
    this.engine.resume();
    this.previousTime = undefined;
  }
  add<T extends Actor>(actor: T): T {
    this.assertAlive();
    return this.engine.scene.add(actor);
  }
  remove(actor: Actor | string): boolean {
    this.assertAlive();
    return this.engine.scene.remove(actor);
  }
  uiOverlay(...nodes: UINode[]): void {
    this.assertAlive();
    if (this.startPromise)
      throw new EngineError(
        "UI_ALREADY_STARTED",
        "Define default UI before run",
      );
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
  private wait<T>(promise: Promise<T>): Promise<T> {
    if (this.dead)
      return Promise.reject(
        new EngineError("GAME_DISPOSED", "Game has been disposed"),
      );
    const signal = this.shutdown.signal;
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        signal.removeEventListener("abort", abort);
        reject(new EngineError("GAME_DISPOSED", "Game has been disposed"));
      };
      signal.addEventListener("abort", abort, { once: true });
      promise
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", abort));
    });
  }
  run(initialScene?: SceneId): Promise<void> {
    if (this.dead)
      return Promise.reject(
        new EngineError("GAME_DISPOSED", "Game has been disposed"),
      );
    if (this.startPromise) return this.startPromise;
    this.startPromise = (async () => {
      try {
        await this.wait(this.renderer.init());
        this.assertAlive();
        this.rendererReady = true;
        if (initialScene !== undefined) await this.navigate(initialScene);
        else await this.present(this.engine.scene, this.defaultUI);
        this.assertAlive();
        this.ready = true;
        this.resize();
        this.render();
        this.assertAlive();
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
    if (!this.ready)
      return Promise.reject(
        new EngineError("GAME_NOT_READY", "Await run before navigating"),
      );
    return this.navigate(id);
  }
  private navigate(id: SceneId): Promise<void> {
    const setup = this.scenes.get(id);
    if (!setup)
      return Promise.reject(
        new EngineError("SCENE_NOT_FOUND", "Unknown scene", { sceneId: id }),
      );
    const existing = this.pendingScenes.get(id);
    if (existing) return existing;
    const task = this.queue
      .then(async () => {
        this.assertAlive();
        const scene = new Scene(id),
          nodes: UINode[] = [],
          controller = new AbortController();
        this.staging = scene;
        scene.onDispose(() => controller.abort());
        try {
          await this.wait(
            Promise.resolve(
              setup({
                scene,
                signal: controller.signal,
                add: (actor) => scene.add(actor),
                ui: (...items) => nodes.push(...items),
                onUpdate: (callback) => scene.onUpdate(callback),
                onActivate: (callback) => scene.onActivate(callback),
                onDeactivate: (callback) => scene.onDeactivate(callback),
                onDispose: (callback) => scene.onDispose(callback),
              }),
            ),
          );
          this.assertAlive();
          await this.present(scene, nodes);
        } catch (error) {
          try {
            scene.dispose();
          } catch (cleanupError) {
            this.report(cleanupError);
          }
          throw error;
        } finally {
          if (this.staging === scene) this.staging = undefined;
        }
      })
      .finally(() => {
        if (this.pendingScenes.get(id) === task) this.pendingScenes.delete(id);
      });
    this.pendingScenes.set(id, task);
    this.queue = task.catch(() => {});
    return task;
  }
  private async present(scene: Scene, nodes: readonly UINode[]): Promise<void> {
    let prepared: PreparedScene | undefined,
      ui: MountedUI | undefined,
      committed = false;
    try {
      const preparing = this.renderer.prepare(scene);
      void preparing.then(
        (value) => {
          if (this.dead || scene.disposed) {
            try {
              value.dispose();
            } catch (error) {
              this.report(error);
            }
          }
        },
        () => {},
      );
      prepared = await this.wait(preparing);
      this.assertAlive();
      ui = mountUI(nodes, this.report);
      scene.onDispose(ui.dispose);
      scene.markReady();
      this.errorBox.hidden = true;
      try {
        this.engine.activate(scene);
      } catch (error) {
        if (this.engine.scene !== scene || scene.state !== SceneState.Active)
          throw error;
        this.report(error);
      }
      this.assertAlive();
      const oldPrepared = this.prepared,
        oldUI = this.ui;
      this.prepared = prepared;
      this.ui = ui;
      committed = true;
      this.element.append(ui.element);
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
      this.previousTime = undefined;
      this.updateProjection();
      this.render();
      this.assertAlive();
    } catch (error) {
      if (!committed)
        for (const cleanup of [
          () => prepared?.dispose(),
          () => ui?.dispose(),
        ]) {
          try {
            cleanup();
          } catch (cleanupError) {
            this.report(cleanupError);
          }
        }
      if (committed) this.dispose();
      throw error;
    }
  }
  get viewport(): Viewport {
    this.updateProjection();
    return this.projection.viewport;
  }
  get view(): ViewTransform {
    this.updateProjection();
    return this.projection;
  }
  setViewport(viewport?: Viewport): void {
    this.assertAlive();
    const next = viewport ? { ...viewport } : undefined;
    createViewTransform({
      viewport: next ?? { x: 0, y: 0, width: this.width, height: this.height },
      resolution: this.resolution,
      aspect: this.aspect,
      camera: this.camera,
    });
    this.requestedViewport = next;
    this.projectionDirty = true;
    this.updateProjection();
    if (this.ready) this.render();
  }
  worldToScreen(point: WorldPoint): ScreenPoint {
    return worldToScreen(this.view, point);
  }
  screenToWorld(point: ScreenPoint): WorldPoint {
    return screenToWorld(this.view, point);
  }
  pointerToWorld(pointer: {
    readonly clientX: number;
    readonly clientY: number;
  }): WorldPoint {
    const rect = this.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0)
      throw new EngineError(
        "VIEWPORT_UNAVAILABLE",
        "Game has no visible bounds",
      );
    return this.screenToWorld(
      screenPoint(
        ((pointer.clientX - rect.left) * this.width) / rect.width,
        ((pointer.clientY - rect.top) * this.height) / rect.height,
      ),
    );
  }
  async whenReady(): Promise<void> {
    if (!this.startPromise)
      throw new EngineError(
        "GAME_NOT_READY",
        "Call run before waiting for resources",
      );
    await this.startPromise;
    this.assertAlive();
    this.render();
    await this.wait(this.prepared?.ready?.() ?? Promise.resolve());
  }
  private updateProjection(): void {
    const v = this.requestedViewport,
      c = this.camera;
    if (
      !this.projectionDirty &&
      this.cameraX === c.x &&
      this.cameraY === c.y &&
      this.cameraZoom === c.zoom
    )
      return;
    this.projectionDirty = false;
    this.cameraX = c.x;
    this.cameraY = c.y;
    this.cameraZoom = c.zoom;
    this.projection = createViewTransform({
      viewport: v ?? { x: 0, y: 0, width: this.width, height: this.height },
      resolution: this.resolution,
      aspect: this.aspect,
      camera: c,
    });
  }
  private resize(): void {
    if (this.dead || !this.rendererReady) return;
    const width = this.element.clientWidth,
      height = this.element.clientHeight;
    if (width <= 0 || height <= 0) return;
    const ratio =
      this.options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
    if (
      this.rendererSized &&
      this.width === width &&
      this.height === height &&
      this.ratio === ratio
    )
      return;
    this.rendererSized = true;
    if (this.width !== width || this.height !== height)
      this.projectionDirty = true;
    this.width = width;
    this.height = height;
    this.ratio = ratio;
    this.renderer.resize(width, height, this.ratio);
    this.updateProjection();
    if (this.ready) this.render();
  }
  private render(): void {
    this.updateProjection();
    this.prepared?.render(this.projection);
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
        if (
          this.ratio !==
          (this.options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2))
        )
          this.resize();
        this.render();
      }
      if (!this.dead) this.frame = this.frames.request(this.tick);
    } catch (error) {
      this.report(error);
      this.dispose();
    }
  };
  private readonly report = (error: unknown): void => {
    this.errorBox.textContent =
      error instanceof Error ? error.message : String(error);
    this.errorBox.hidden = false;
    try {
      if (this.options.onError) this.options.onError(error);
      else console.error(error);
    } catch {
      /* Observers must not prevent cleanup. */
    }
  };
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.shutdown.abort();
    if (this.frame !== undefined) this.frames.cancel(this.frame);
    for (const cleanup of [
      () => this.staging?.dispose(),
      () => this.keyboard.dispose(),
      () => this.observer.disconnect(),
      () => this.ui?.dispose(),
      () => this.prepared?.dispose(),
      () => this.renderer.dispose(),
      () => this.engine.dispose(),
      () => this.element.remove(),
    ]) {
      try {
        cleanup();
      } catch (error) {
        this.report(error);
      }
    }
    this.ui = undefined;
    this.prepared = undefined;
    this.staging = undefined;
    this.defaultUI.length = 0;
    this.scenes.clear();
    this.pendingScenes.clear();
  }
}
