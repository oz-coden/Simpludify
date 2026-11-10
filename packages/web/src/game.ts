import type { CanvasNode } from "@simpludify/core";
import {
  type ActionBindings,
  ActionController,
  type ActionSet,
  type Actor,
  Aspect,
  Camera,
  CanvasUI,
  type CanvasUIOptions,
  createViewTransform,
  Engine,
  EngineError,
  type FixedStepOptions,
  FixedStepRunner,
  type FrameDriver,
  type InputCapture,
  type InputCaptureOptions,
  type JsonValue,
  Logger,
  type LoggerOptions,
  type LogicalResolution,
  type PointerRouting,
  type PreparedScene,
  positive,
  type RendererPort,
  type ReplayControllers,
  ReplayPlayer,
  Scene,
  ScenePointer,
  type SceneRetention,
  SceneState,
  type ScreenPoint,
  screenPoint,
  screenToWorld,
  type TweenScheduler,
  type Viewport,
  type ViewTransform,
  VirtualInput,
  type WorldPoint,
  worldToScreen,
} from "@simpludify/core";
import { browserAssetAdapter, createImagePool } from "./asset-loaders";
import { type AssetOptions, AssetScope, AssetStore } from "./assets";
import type { CanvasPresentation } from "./canvas-visual";
import { GamepadInput } from "./gamepads";
import { BrowserInput } from "./input";
import { InputCaptureManager } from "./input-capture";
import { BrowserPointer } from "./pointer";
import { PixiRenderer } from "./renderer";
import {
  type MountedUI,
  mountUI,
  Theme,
  Themes,
  type ThemeTokens,
  type UINode,
} from "./ui";
import { blocksGameKeyboard } from "./ui-keyboard";
import type { VirtualInputPresentation } from "./virtual-input-visual";

export interface SceneContext {
  readonly scene: Scene;
  readonly assets: AssetScope;
  readonly signal: AbortSignal;
  readonly tweens: TweenScheduler;
  readonly presentationTweens: TweenScheduler;
  add<T extends Actor>(actor: T): T;
  ui(...nodes: UINode[]): void;
  canvasUI(root: CanvasNode, options?: CanvasUIOptions): CanvasUI;
  readonly pointer: ScenePointer;
  readonly virtualInput: VirtualInput;
  actions<A extends ActionSet>(
    actions: A,
    bindings?: ActionBindings<A>,
  ): ActionController<A>;
  onUpdate(callback: (seconds: number) => void): () => void;
  onActivate(callback: () => void): () => void;
  onDeactivate(callback: () => void): () => void;
  onDispose(callback: () => void): () => void;
}
export type SceneSetup = (context: SceneContext) => void | Promise<void>;
export interface SceneOptions {
  readonly retention?: SceneRetention;
}
interface SceneRegistration {
  readonly setup: SceneSetup;
  readonly retention: SceneRetention;
}
interface SceneSession {
  readonly scene: Scene;
  readonly nodes: readonly UINode[];
  readonly canvas: CanvasUI | undefined;
}
export interface GameLoggingOptions extends Omit<LoggerOptions, "sink"> {
  /** Controls Console output only. Diagnostic subscribers remain active. */
  readonly console?: boolean;
}
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
  fixedStep?: FixedStepOptions;
  renderer?: (host: HTMLElement) => RendererPort;
  frames?: FrameDriver;
  logging?: GameLoggingOptions;
  assets?: AssetOptions;
  sceneRetention?: SceneRetention;
  /** @deprecated Subscribe to Game.logger for structured diagnostics. */
  onError?: (error: unknown) => void;
}
export class Game<SceneId extends string = string> {
  readonly engine: Engine;
  readonly element: HTMLDivElement;
  readonly camera: Camera;
  readonly gamepads: GamepadInput;
  readonly logger: Logger;
  readonly assets: AssetScope;
  private readonly imagePool = createImagePool();
  private readonly assetStore: AssetStore;
  private readonly renderer: RendererPort;
  private readonly keyboard: BrowserInput;
  private readonly captures: InputCaptureManager;
  captureInput(options: InputCaptureOptions = {}): InputCapture {
    this.assertAlive();
    return this.captures.start(options);
  }
  private readonly pointers: BrowserPointer;
  private readonly pointerChannels = new WeakMap<Scene, ScenePointer>();
  private readonly virtualInputs = new WeakMap<Scene, VirtualInput>();
  private virtualPresentation: VirtualInputPresentation | undefined;
  get virtualInput(): VirtualInput {
    this.assertAlive();
    return this.virtualFor(this.engine.scene);
  }
  private virtualFor(scene: Scene): VirtualInput {
    let input = this.virtualInputs.get(scene);
    if (!input) {
      input = new VirtualInput(this.channelFor(scene), this.engine.input);
      this.virtualInputs.set(scene, input);
      const owned = input;
      input.onDispose(() => {
        if (this.virtualInputs.get(scene) === owned)
          this.virtualInputs.delete(scene);
        if (this.engine.scene === scene) {
          this.virtualPresentation?.dispose();
          this.virtualPresentation = undefined;
        }
      });
    }
    return input;
  }
  private prepareVirtual(scene: Scene): VirtualInputPresentation | undefined {
    const input = this.virtualInputs.get(scene);
    if (!input || input.controls.length === 0) return;
    const renderer = this.renderer as RendererPort & {
      prepareVirtualInput?: (input: VirtualInput) => VirtualInputPresentation;
    };
    if (!renderer.prepareVirtualInput)
      throw new EngineError(
        "RENDERER_CAPABILITY",
        "Renderer does not support virtual input presentation",
      );
    const presentation = renderer.prepareVirtualInput(input);
    const off = input.onDispose(() => presentation.dispose());
    return {
      update: () => presentation.update(),
      dispose: () => {
        off();
        presentation.dispose();
      },
    };
  }
  private canvas: CanvasUI | undefined;
  private canvasPresentation: CanvasPresentation | undefined;
  private defaultCanvas: CanvasUI | undefined;
  private readonly ownedCanvas = new WeakSet<CanvasUI>();
  private readonly viewportBindings = new WeakMap<
    CanvasUI,
    { node: CanvasNode; dispose: () => void }
  >();
  get pointer(): ScenePointer {
    this.assertAlive();
    return this.channelFor(this.engine.scene);
  }
  get pointerDiagnostics() {
    return this.pointers.routing.diagnostics;
  }
  private channelFor(scene: Scene): ScenePointer {
    let channel = this.pointerChannels.get(scene);
    if (!channel) {
      channel = new ScenePointer(scene);
      this.pointerChannels.set(scene, channel);
    }
    return channel;
  }
  private readonly observer: ResizeObserver;
  private readonly frames: FrameDriver;
  private readonly options: GameOptions;
  private readonly resolution: LogicalResolution;
  private readonly aspect: Aspect;
  private readonly maxDelta: number;
  private readonly fixed: FixedStepRunner | undefined;
  private playback: ReplayPlayer | undefined;
  private playbackScene: Scene | undefined;
  private removeReplayOwner: (() => void) | undefined;
  private requestedViewport: Viewport | undefined;
  private projection: ViewTransform;
  private projectionDirty = true;
  private cameraX = NaN;
  private cameraY = NaN;
  private cameraZoom = NaN;
  private width = 800;
  private height = 450;
  private ratio = 1;
  private readonly scenes = new Map<SceneId, SceneRegistration>();
  private readonly retainedScenes = new Map<SceneId, SceneSession>();
  private readonly sceneRetention: SceneRetention;
  private activeRetention: SceneRetention = "dispose";
  private detachPresentation: (() => void) | undefined;
  private pendingScene: { id: SceneId; task: Promise<void> } | undefined;
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
    this.sceneRetention = retentionPolicy(options.sceneRetention ?? "dispose");
    const { console: consoleEnabled = !options.onError, ...logging } =
      options.logging ?? {};
    this.logger = new Logger({
      ...logging,
      ...(consoleEnabled
        ? { sink: (entry) => console[entry.level](entry.message) }
        : {}),
    });
    this.engine = new Engine(
      options.seed === undefined ? {} : { seed: options.seed },
    );
    this.fixed = options.fixedStep
      ? new FixedStepRunner(this.engine, options.fixedStep)
      : undefined;
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
    const themeName = options.theme ?? Theme.Dark;
    if (!Object.hasOwn(Themes, themeName))
      throw new EngineError("INVALID_THEME", "Unknown theme");
    const theme = Themes[themeName];
    for (const [name, value] of Object.entries(options.tokens ?? {}))
      if (
        !Object.hasOwn(theme, name) ||
        typeof value !== "string" ||
        (name === "font"
          ? !validFontFamily(value)
          : !value.trim().length ||
            /[;{}<>\r\n\0]|url\s*\(/i.test(value) ||
            !CSS.supports("color", value))
      )
        throw new EngineError("INVALID_THEME_TOKEN", `Invalid token: ${name}`);
    const tokens = { ...theme, ...options.tokens };
    this.assetStore = new AssetStore(
      browserAssetAdapter(this.imagePool),
      this.logger,
      document.baseURI,
      options.assets,
    );
    this.assets = new AssetScope(this.assetStore, undefined, true);
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
        new PixiRenderer(
          this.element,
          tokens.background,
          (error) => this.report(error, "engine.renderer"),
          { store: this.assetStore, images: this.imagePool },
        );
    } catch (error) {
      this.element.remove();
      this.engine.dispose();
      this.assetStore.dispose();
      this.imagePool.dispose();
      throw error;
    }
    this.frames = options.frames ?? {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    };
    this.captures = new InputCaptureManager(
      this.element,
      this.engine.input,
      () => this.engine.scene,
      () => this.pointers.release(),
      (error) => this.report(error, "engine.input"),
    );
    this.keyboard = new BrowserInput(this.element, this.engine.input);
    this.gamepads = new GamepadInput(this.engine.input, {
      observe: (pads) => this.captures.sample(pads),
      active: () =>
        !document.hidden &&
        document.hasFocus() &&
        this.element.contains(document.activeElement) &&
        !blocksGameKeyboard(document.activeElement),
    });
    this.pointers = new BrowserPointer(
      this.element,
      (event) => {
        const rect = this.element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const screen = screenPoint(
          ((event.clientX - rect.left) * this.width) / rect.width,
          ((event.clientY - rect.top) * this.height) / rect.height,
        );
        return { screen, world: this.screenToWorld(screen), view: this.view };
      },
      (error) => this.report(error, "engine.input"),
      () => this.updateProjection(),
      this.engine.input,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        this.previousTime = undefined;
        this.fixed?.reset();
        this.engine.input.clear();
      },
      { signal: this.shutdown.signal },
    );
    this.observer = new ResizeObserver(() => {
      try {
        this.resize();
      } catch (error) {
        this.report(error, "engine.resize", true);
        this.dispose();
      }
    });
    this.observer.observe(this.element);
  }
  private assertAlive(): void {
    if (this.dead)
      throw new EngineError("GAME_DISPOSED", "Game has been disposed");
  }
  get tweens(): TweenScheduler {
    return this.engine.scene.tweens;
  }
  get presentationTweens(): TweenScheduler {
    return this.engine.scene.presentationTweens;
  }
  get paused(): boolean {
    return this.engine.paused;
  }
  pause(): void {
    this.assertAlive();
    this.pointers.release();
    this.engine.pause();
    this.previousTime = undefined;
    this.fixed?.reset();
  }
  resume(): void {
    this.assertAlive();
    this.pointers.release();
    this.engine.resume();
    this.previousTime = undefined;
    this.fixed?.reset();
  }
  /** Configure inside the initial Scene factory after game setup, before the first Engine step. */
  playReplay(
    data: unknown,
    options: {
      scene: Scene;
      controllers: ReplayControllers;
      expectedMetadata?: Readonly<Record<string, JsonValue>>;
    },
  ): ReplayPlayer {
    this.assertAlive();
    if (options.scene !== this.engine.scene && options.scene !== this.staging)
      throw new EngineError(
        "REPLAY_STATE",
        "Replay Scene must be current or staged by this Game",
      );
    if (this.playback)
      throw new EngineError("REPLAY_STATE", "Game already has a Replay player");
    const player = new ReplayPlayer(this.engine, data, options);
    this.playback = player;
    this.playbackScene = options.scene;
    try {
      this.removeReplayOwner = options.scene.onDispose(() => this.stopReplay());
    } catch (error) {
      this.stopReplay();
      throw error;
    }
    return player;
  }
  stopReplay(): void {
    const player = this.playback,
      off = this.removeReplayOwner;
    this.playback = undefined;
    this.playbackScene = undefined;
    this.removeReplayOwner = undefined;
    off?.();
    player?.dispose();
    this.previousTime = undefined;
    this.fixed?.reset();
  }
  add<T extends Actor>(actor: T): T {
    this.assertAlive();
    return this.engine.scene.add(actor);
  }
  /** Scene-owned Actions for the current Scene. In a staged factory use context.actions. */
  actions<A extends ActionSet>(
    actions: A,
    bindings?: ActionBindings<A>,
  ): ActionController<A> {
    this.assertAlive();
    return new ActionController(actions, {
      scene: this.engine.scene,
      input: this.engine.input,
      ...(bindings === undefined ? {} : { bindings }),
    });
  }
  remove(actor: Actor | string): boolean {
    this.assertAlive();
    return this.engine.scene.remove(actor);
  }
  canvasUI(root: CanvasNode, options: CanvasUIOptions = {}): CanvasUI {
    this.assertAlive();
    if (this.startPromise || this.defaultCanvas)
      throw new EngineError(
        "UI_ALREADY_STARTED",
        "Define one default Canvas UI before run",
      );
    this.defaultCanvas = new CanvasUI(this.engine.scene, root, options);
    this.ownedCanvas.add(this.defaultCanvas);
    return this.defaultCanvas;
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
  scene(id: SceneId, setup: SceneSetup, options: SceneOptions = {}): this {
    this.assertAlive();
    if (typeof id !== "string" || !id.length)
      throw new EngineError("INVALID_VALUE", "Scene id must not be empty");
    if (typeof setup !== "function")
      throw new EngineError("INVALID_VALUE", "Scene setup must be a function");
    if (this.scenes.has(id))
      throw new EngineError(
        "DUPLICATE_SCENE",
        "Scene id is already registered",
        { sceneId: id },
      );
    this.scenes.set(id, {
      setup,
      retention: retentionPolicy(options.retention ?? this.sceneRetention),
    });
    return this;
  }
  private wait<T>(promise: Promise<T>): Promise<T> {
    if (this.dead) {
      // A synchronous factory can dispose the Game before returning a Promise.
      void promise.catch(() => {});
      return Promise.reject(
        new EngineError("GAME_DISPOSED", "Game has been disposed"),
      );
    }
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
        else
          await this.present(
            this.engine.scene,
            this.defaultUI,
            this.defaultCanvas,
          );
        this.assertAlive();
        this.defaultCanvas = undefined;
        this.defaultUI.length = 0;
        this.ready = true;
        this.resize();
        this.render();
        this.assertAlive();
        this.frame = this.frames.request(this.tick);
      } catch (error) {
        if (!this.dead)
          this.logger.report(error, {
            source: "engine.startup",
            message: "Simpludify could not start",
            fatal: true,
            standardOutput: false,
          });
        this.dispose();
        throw error;
      }
    })();
    return this.startPromise;
  }
  changeScene(id: SceneId): Promise<void> {
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
    const registration = this.scenes.get(id);
    if (!registration)
      return Promise.reject(
        new EngineError("SCENE_NOT_FOUND", "Unknown scene", { sceneId: id }),
      );
    if (this.pendingScene?.id === id) return this.pendingScene.task;
    const task = this.queue
      .then(async () => {
        this.assertAlive();
        const beforeActivate = () => {
          if (this.pendingScene?.task === task) this.pendingScene = undefined;
        };
        const existing = this.retainedScenes.get(id);
        if (existing) {
          if (
            this.engine.scene === existing.scene &&
            existing.scene.state === SceneState.Active
          )
            return;
          try {
            await this.present(
              existing.scene,
              existing.nodes,
              existing.canvas,
              beforeActivate,
              registration.retention,
            );
          } catch (error) {
            this.reportPreparation(error);
            throw error;
          }
          return;
        }
        const scene = new Scene(id),
          nodes: UINode[] = [],
          controller = new AbortController();
        let canvas: CanvasUI | undefined;
        const pointer = this.channelFor(scene);
        const virtualFor = () => this.virtualFor(scene);
        this.staging = scene;
        scene.onDispose(() => controller.abort());
        try {
          const assets = this.assets.scope(scene);
          await this.wait(
            Promise.resolve(
              registration.setup({
                scene,
                assets,
                get tweens() {
                  return scene.tweens;
                },
                get presentationTweens() {
                  return scene.presentationTweens;
                },
                signal: controller.signal,
                add: (actor) => scene.add(actor),
                ui: (...items) => nodes.push(...items),
                pointer,
                get virtualInput() {
                  return virtualFor();
                },
                canvasUI: (root, options) => {
                  if (canvas)
                    throw new EngineError(
                      "UI_OWNERSHIP",
                      "A Scene has one Canvas UI root",
                    );
                  canvas = new CanvasUI(scene, root, options);
                  this.ownedCanvas.add(canvas);
                  return canvas;
                },
                actions: (actions, bindings) =>
                  new ActionController(actions, {
                    scene,
                    input: this.engine.input,
                    ...(bindings === undefined ? {} : { bindings }),
                  }),
                onUpdate: (callback) => scene.onUpdate(callback),
                onActivate: (callback) => scene.onActivate(callback),
                onDeactivate: (callback) => scene.onDeactivate(callback),
                onDispose: (callback) => scene.onDispose(callback),
              }),
            ),
          );
          this.assertAlive();
          if (registration.retention === "retain") {
            scene.onDispose(() => {
              if (this.retainedScenes.get(id)?.scene === scene)
                this.retainedScenes.delete(id);
            });
          }
          await this.present(
            scene,
            nodes,
            canvas,
            beforeActivate,
            registration.retention,
          );
          if (registration.retention === "retain")
            this.retainedScenes.set(id, { scene, nodes, canvas });
        } catch (error) {
          this.reportPreparation(error);
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
        if (this.pendingScene?.task === task) this.pendingScene = undefined;
      });
    this.pendingScene = { id, task };
    this.queue = task.catch(() => {});
    return task;
  }
  private reportPreparation(error: unknown): void {
    if (this.ready && !this.dead)
      this.logger.report(error, {
        source: "engine.scene",
        message: "Simpludify could not prepare the requested scene",
        fatal: false,
        standardOutput: false,
      });
  }
  private async present(
    scene: Scene,
    nodes: readonly UINode[],
    canvas?: CanvasUI,
    beforeActivate?: () => void,
    retention: SceneRetention = "dispose",
  ): Promise<void> {
    let prepared: PreparedScene | undefined,
      ui: MountedUI | undefined,
      committed = false;
    let canvasPresentation: CanvasPresentation | undefined;
    let virtualPresentation: VirtualInputPresentation | undefined;
    const hooks: (() => void)[] = [];
    const detach = () => {
      for (const off of hooks.splice(0)) off();
    };
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
      hooks.push(scene.onDispose(ui.dispose));
      if (canvas) {
        canvas.setErrorHandler(this.report);
        const renderer = this.renderer as RendererPort & {
          prepareCanvasUI?: (
            ui: CanvasUI,
            routing: PointerRouting,
          ) => CanvasPresentation;
        };
        if (!renderer.prepareCanvasUI)
          throw new EngineError(
            "RENDERER_CAPABILITY",
            "Renderer does not support Canvas UI",
          );
        canvasPresentation = renderer.prepareCanvasUI(
          canvas,
          this.pointers.routing,
        );
        hooks.push(scene.onDispose(() => canvasPresentation?.dispose()));
      }
      virtualPresentation = this.prepareVirtual(scene);
      if (scene.state === SceneState.Preparing) scene.markReady();
      beforeActivate?.();
      this.errorBox.hidden = true;
      try {
        if (this.playback && this.playbackScene !== scene) this.stopReplay();
        this.engine.activate(scene, { previous: this.activeRetention });
      } catch (error) {
        if (this.engine.scene !== scene || scene.state !== SceneState.Active)
          throw error;
        this.report(error, "engine.scene");
      }
      this.assertAlive();
      const oldPrepared = this.prepared,
        oldUI = this.ui,
        oldCanvasUI = this.canvas,
        detachOld = this.detachPresentation,
        oldCanvas = this.canvasPresentation,
        oldVirtual = this.virtualPresentation;
      this.prepared = prepared;
      this.detachPresentation = detach;
      this.activeRetention = retention;
      this.ui = ui;
      this.canvas = canvas;
      this.canvasPresentation = canvasPresentation;
      this.virtualPresentation = virtualPresentation;
      committed = true;
      try {
        this.pointers.routing.setScene(this.channelFor(scene), canvas);
        this.element.append(ui.element);
      } finally {
        for (const cleanup of [
          () => detachOld?.(),
          () => {
            if (oldCanvasUI && !oldCanvasUI.disposed) {
              oldCanvasUI.focus();
              oldCanvasUI.stopMotion();
            }
          },
          () => oldPrepared?.dispose(),
          () => oldUI?.dispose(),
          () => oldCanvas?.dispose(),
          () => oldVirtual?.dispose(),
        ]) {
          try {
            cleanup();
          } catch (error) {
            this.report(error);
          }
        }
      }
      this.assertAlive();
      this.previousTime = undefined;
      this.fixed?.reset();
      this.updateProjection();
      this.render();
      this.assertAlive();
    } catch (error) {
      if (!committed)
        for (const cleanup of [
          detach,
          () => prepared?.dispose(),
          () => ui?.dispose(),
          () => canvasPresentation?.dispose(),
          () => virtualPresentation?.dispose(),
        ]) {
          try {
            cleanup();
          } catch (cleanupError) {
            this.report(cleanupError);
          }
        }
      if (committed && !this.dead) {
        this.logger.report(error, {
          source: "engine.presentation",
          message: "Simpludify could not present the active scene",
          fatal: true,
          standardOutput: false,
        });
        this.dispose();
      }
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
  /** Bind the mounted UI's resolved region to the world viewport. UI units become CSS pixels.
   * One binding per UI; replacement/unbind restores the manual viewport. UI/node disposal unbinds.
   * A collapsed/hidden region clips all world rendering and pointer input. No extra frame/observer.
   */
  bindViewport(ui: CanvasUI, node: CanvasNode): () => void {
    this.assertAlive();
    if (
      !this.ownedCanvas.has(ui) ||
      ui.disposed ||
      node.disposed ||
      node.ui !== ui
    )
      throw new EngineError(
        "UI_OWNERSHIP",
        "Viewport region must belong to this Game's Canvas UI",
      );
    this.viewportBindings.get(ui)?.dispose();
    let removed = false;
    const off: (() => void)[] = [];
    const binding = {
      node,
      dispose: () => {
        if (removed) return;
        removed = true;
        if (this.viewportBindings.get(ui) === binding)
          this.viewportBindings.delete(ui);
        for (const unregister of off) unregister();
        this.projectionDirty = true;
      },
    };
    this.viewportBindings.set(ui, binding);
    off.push(ui.onDispose(binding.dispose), node.onDispose(binding.dispose));
    this.projectionDirty = true;
    return binding.dispose;
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
    const prepared = this.prepared;
    this.render();
    await this.wait(prepared?.ready?.() ?? Promise.resolve());
    this.assertAlive();
    if (prepared !== this.prepared)
      throw new EngineError(
        "GAME_DISPOSED",
        "Scene presentation changed while waiting for resources",
      );
    this.render();
  }
  private updateProjection(): void {
    // Resolve UI before projection so drawing, getters and pointer conversion see one layout.
    this.canvasPresentation?.update(this.width, this.height);
    const ui = this.canvas;
    const region = ui ? this.viewportBindings.get(ui)?.node : undefined;
    let v = this.requestedViewport;
    let empty = false;
    if (ui && region) {
      const b = region.bounds,
        scale = ui.scale;
      const x = Math.max(0, Math.min(this.width, b.x * scale));
      const y = Math.max(0, Math.min(this.height, b.y * scale));
      const right = Math.max(x, Math.min(this.width, (b.x + b.width) * scale));
      const bottom = Math.max(
        y,
        Math.min(this.height, (b.y + b.height) * scale),
      );
      // Input transparency of the slot does not hide its world. Visibility and enable
      // state do; a dedicated slot may use pointerEvents: "none" for pass-through.
      let visible = region.ui === ui;
      for (let node: CanvasNode | undefined = region; node; node = node.parent)
        if (node.disposed || !node.visible || !node.enabled) visible = false;
      empty = !visible || right <= x || bottom <= y;
      v = {
        x,
        y,
        width: empty ? 0 : right - x,
        height: empty ? 0 : bottom - y,
      };
    }
    const viewport = v ?? {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    };
    this.virtualInputs.get(this.engine.scene)?.refresh(viewport);
    const previous = this.projection.viewport;
    const c = this.camera;
    if (
      !this.projectionDirty &&
      previous.x === viewport.x &&
      previous.y === viewport.y &&
      previous.width === viewport.width &&
      previous.height === viewport.height &&
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
      viewport: empty ? { ...viewport, width: 1, height: 1 } : viewport,
      resolution: this.resolution,
      aspect: this.aspect,
      camera: c,
    });
    if (empty)
      this.projection = {
        ...this.projection,
        viewport,
        clip: { ...viewport, width: 0, height: 0 },
      };
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
    this.virtualPresentation ??= this.prepareVirtual(this.engine.scene);
    this.virtualPresentation?.update();
    this.prepared?.render(this.projection);
  }
  private readonly tick = (time: number): void => {
    if (this.dead) return;
    try {
      if (document.hidden) {
        this.canvas?.stopMotion();
        this.previousTime = undefined;
        this.fixed?.reset();
        this.engine.input.clear();
      } else {
        const elapsed =
          this.previousTime === undefined
            ? 0
            : Math.max(0, (time - this.previousTime) / 1000);
        this.previousTime = time;
        if (this.virtualInputs.has(this.engine.scene)) this.updateProjection();
        if (this.playback)
          this.playback.advance(elapsed, this.options.fixedStep?.maxSteps ?? 8);
        else if (this.fixed) this.fixed.advance(elapsed);
        else this.engine.step(Math.min(this.maxDelta, elapsed));
        if (!this.dead && !this.engine.scene.disposed)
          this.engine.scene.advancePresentation(
            Math.min(this.maxDelta, elapsed),
          );
        if (this.engine.paused) this.canvas?.stopMotion();
        else this.canvas?.advance(elapsed);
        this.virtualInputs
          .get(this.engine.scene)
          ?.advance(Math.min(this.maxDelta, elapsed));
        if (
          this.ratio !==
          (this.options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2))
        )
          this.resize();
        this.render();
      }
      if (!this.dead) this.frame = this.frames.request(this.tick);
    } catch (error) {
      this.report(error, "engine.frame", true);
      this.dispose();
    }
  };
  private readonly report = (
    error: unknown,
    source = "engine.runtime",
    fatal = false,
  ): void => {
    const message = fatal
      ? "Simpludify stopped after a runtime error"
      : "Simpludify encountered a runtime error";
    this.logger.report(error, { source, fatal, message });
    this.errorBox.textContent = message;
    this.errorBox.hidden = false;
    try {
      if (this.options.onError) this.options.onError(error);
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
      () => this.stopReplay(),
      () => this.staging?.dispose(),
      () => this.captures.dispose(),
      () => this.pointers.dispose(),
      () => this.gamepads.dispose(),
      () => this.keyboard.dispose(),
      () => this.canvasPresentation?.dispose(),
      () => this.virtualPresentation?.dispose(),
      () => this.canvas?.dispose(),
      () => this.observer.disconnect(),
      () => this.detachPresentation?.(),
      () => this.ui?.dispose(),
      () => this.prepared?.dispose(),
      () => this.renderer.dispose(),
      () => this.engine.dispose(),
      () => this.assetStore.dispose(),
      () => this.imagePool.dispose(),
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
    this.canvas = undefined;
    this.canvasPresentation = undefined;
    this.virtualPresentation = undefined;
    this.defaultCanvas = undefined;
    this.defaultUI.length = 0;
    this.scenes.clear();
    this.retainedScenes.clear();
    this.detachPresentation = undefined;
    this.pendingScene = undefined;
  }
}

function retentionPolicy(value: SceneRetention): SceneRetention {
  if (value !== "dispose" && value !== "retain")
    throw new EngineError("INVALID_VALUE", "Unknown scene retention policy");
  return value;
}

function validFontFamily(value: string): boolean {
  const syntax = value
    .replace(/"(?:\\[^\r\n]|[^"\\])*"|'(?:\\[^\r\n]|[^'\\])*'/g, "family")
    .replace(/\\(?:[0-9a-f]{1,6}[ \t]?|[^\r\n])/gi, "x");
  return (
    value.trim().length > 0 &&
    !/[\r\n\0]/.test(value) &&
    !/[;{}<>\\"']|url\s*\(/i.test(syntax)
  );
}
