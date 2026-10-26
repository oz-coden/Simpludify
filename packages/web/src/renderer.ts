import {
  type Actor,
  EngineError,
  type PreparedScene,
  Renderable,
  type RendererPort,
  type Scene,
  Shape,
  Transform,
} from "@simpludify/core";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";

interface Visual {
  actor: Actor;
  component: Renderable;
  transform: Transform;
  controller: AbortController;
  order: number;
  display?: Sprite | Graphics;
  texture?: Texture;
  error?: unknown;
  promise: Promise<void>;
  dispose(): void;
}
export class PixiRenderer implements RendererPort {
  private readonly app = new Application();
  private readonly scenes = new Set<PreparedScene>();
  private readonly pending = new Set<AbortController>();
  private ready = false;
  private dead = false;
  private visualCount = 0;
  get diagnostics() {
    return {
      presentations: this.scenes.size,
      visuals: this.visualCount,
      pendingImages: this.pending.size,
    };
  }
  constructor(
    private readonly host: HTMLElement,
    private readonly background = "#101922",
    private readonly onError: (error: unknown) => void = () => {},
  ) {}
  async init(): Promise<void> {
    await this.app.init({
      width: 800,
      height: 450,
      background: this.background,
      antialias: true,
      autoStart: false,
      sharedTicker: false,
      preference: "webgl",
      resolution: 1,
      autoDensity: true,
    });
    this.ready = true;
    if (this.dead) {
      this.destroyApp();
      throw new EngineError(
        "GAME_DISPOSED",
        "Renderer disposed during initialization",
      );
    }
    this.app.canvas.setAttribute("aria-label", "Game world");
    this.host.prepend(this.app.canvas);
  }
  private async texture(url: string, signal: AbortSignal): Promise<Texture> {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const clear = () => {
        image.onload = null;
        image.onerror = null;
        signal.removeEventListener("abort", abort);
      };
      const abort = () => {
        clear();
        image.src = "";
        reject(
          new EngineError("GAME_DISPOSED", "Image loading cancelled", {
            path: url,
          }),
        );
      };
      image.onload = () => {
        clear();
        resolve();
      };
      image.onerror = () => {
        clear();
        reject(
          new EngineError("ASSET_LOAD_FAILED", "Could not load sprite", {
            path: url,
          }),
        );
      };
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
      image.crossOrigin = "anonymous";
      image.src = url;
    });
    if (signal.aborted)
      throw new EngineError("GAME_DISPOSED", "Image loading cancelled", {
        path: url,
      });
    return Texture.from(image, true);
  }

  async prepare(scene: Scene): Promise<PreparedScene> {
    if (!this.ready || this.dead)
      throw new EngineError("RENDERER_NOT_READY", "Renderer is not available");
    const root = new Container(),
      world = new Container(),
      mask = new Graphics();
    world.sortableChildren = true;
    root.addChild(world, mask);
    root.mask = mask;
    const visuals = new Map<Actor, Visual>();
    let revision = -1,
      disposed = false,
      clipX = NaN,
      clipY = NaN,
      clipWidth = NaN,
      clipHeight = NaN,
      removeSceneCleanup: (() => void) | undefined;
    const valid = (entry: Visual) =>
      !disposed &&
      !scene.disposed &&
      !entry.actor.disposed &&
      entry.actor.scene === scene &&
      entry.actor.get(Renderable.type) === entry.component &&
      !entry.component.disposed;
    const create = (actor: Actor, component: Renderable): Visual => {
      const controller = new AbortController();
      this.pending.add(controller);
      this.visualCount++;
      let dead = false,
        removeActorCleanup = () => {},
        removeComponentCleanup = () => {};
      const entry: Visual = {
        order: 0,
        actor,
        component,
        transform: actor.require(Transform.type),
        controller,
        promise: Promise.resolve(),
        dispose: () => {
          if (dead) return;
          dead = true;
          this.visualCount--;
          controller.abort();
          this.pending.delete(controller);
          removeActorCleanup();
          removeComponentCleanup();
          entry.display?.destroy();
          entry.texture?.destroy(true);
          delete entry.display;
          delete entry.texture;
        },
      };
      removeActorCleanup = actor.onDispose(entry.dispose);
      removeComponentCleanup = component.onDispose(entry.dispose);
      if (component.sprite) {
        entry.promise = this.texture(component.sprite, controller.signal)
          .then((texture) => {
            if (dead || !valid(entry)) {
              texture.destroy(true);
              return;
            }
            entry.texture = texture;
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.width = component.width;
            sprite.height = component.height;
            entry.display = sprite;
            sprite.zIndex = entry.order;
            world.addChild(sprite);
          })
          .catch((error) => {
            if (!dead && valid(entry)) {
              entry.error = error;
              try {
                this.onError(error);
              } catch {
                /* Observers cannot invalidate resource cleanup. */
              }
            }
          })
          .finally(() => this.pending.delete(controller));
      } else {
        const width = component.width,
          height = component.height;
        const graphics = new Graphics()
          .roundRect(
            -width / 2,
            -height / 2,
            width,
            height,
            component.shape === Shape.Character
              ? Math.min(width, height) / 4
              : 2,
          )
          .fill(component.color);
        if (component.shape === Shape.Character)
          graphics
            .circle(-width / 7, -height / 10, Math.min(width, height) / 18)
            .fill(0x102c28)
            .circle(width / 7, -height / 10, Math.min(width, height) / 18)
            .fill(0x102c28);
        entry.display = graphics;
        world.addChild(graphics);
        this.pending.delete(controller);
      }
      return entry;
    };
    const reconcile = () => {
      if (disposed || scene.disposed) return;
      if (revision === scene.revision) return;
      revision = scene.revision;
      for (const [actor, entry] of visuals)
        if (!valid(entry)) {
          entry.dispose();
          visuals.delete(actor);
        }
      let order = 0;
      for (const actor of scene.actors) {
        const component = actor.get(Renderable.type);
        if (component) {
          let entry = visuals.get(actor);
          if (!entry) {
            entry = create(actor, component);
            visuals.set(actor, entry);
          }
          entry.order = order++;
          if (entry.display) entry.display.zIndex = entry.order;
        }
      }
    };
    const prepared: PreparedScene = {
      ready: async () => {
        for (;;) {
          if (disposed || this.dead || scene.disposed)
            throw new EngineError(
              "GAME_DISPOSED",
              "Scene presentation has been disposed",
            );
          reconcile();
          const version = scene.revision;
          await Promise.all(
            [...visuals.values()].map((entry) => entry.promise),
          );
          if (disposed || this.dead || scene.disposed)
            throw new EngineError(
              "GAME_DISPOSED",
              "Scene presentation has been disposed",
            );
          if (version !== scene.revision) continue;
          for (const entry of visuals.values())
            if (entry.error) throw entry.error;
          return;
        }
      },
      render: (view) => {
        if (disposed || this.dead || scene.disposed) return;
        reconcile();
        if (!root.parent) this.app.stage.addChild(root);
        const c = view.clip;
        if (
          c.x !== clipX ||
          c.y !== clipY ||
          c.width !== clipWidth ||
          c.height !== clipHeight
        ) {
          clipX = c.x;
          clipY = c.y;
          clipWidth = c.width;
          clipHeight = c.height;
          mask.clear().rect(c.x, c.y, c.width, c.height).fill(0xffffff);
        }
        world.scale.set(view.scale);
        world.position.set(view.x, view.y);
        for (const entry of visuals.values())
          if (entry.display) {
            const t = entry.transform;
            entry.display.visible =
              entry.actor.enabled && entry.component.enabled;
            entry.display.position.set(t.x, t.y);
            entry.display.rotation = t.rotation;
            // Sprite width/height establish its base scale; apply Transform relative to that size.
            if (entry.display instanceof Sprite)
              entry.display.scale.set(
                (entry.component.width / entry.display.texture.width) *
                  t.scaleX,
                (entry.component.height / entry.display.texture.height) *
                  t.scaleY,
              );
            else entry.display.scale.set(t.scaleX, t.scaleY);
          }
        this.app.render();
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        removeSceneCleanup?.();
        this.scenes.delete(prepared);
        for (const entry of visuals.values()) entry.dispose();
        visuals.clear();
        root.destroy({ children: true });
      },
    };
    removeSceneCleanup = scene.onDispose(prepared.dispose);
    this.scenes.add(prepared);
    try {
      await prepared.ready?.();
      return prepared;
    } catch (error) {
      prepared.dispose();
      throw error;
    }
  }
  resize(width: number, height: number, devicePixelRatio: number): void {
    if (!this.ready || this.dead) return;
    this.app.renderer.resolution = devicePixelRatio;
    this.app.renderer.resize(width, height);
  }
  private destroyApp(): void {
    if (this.ready) {
      this.ready = false;
      this.app.destroy(true, { children: true });
    }
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
    for (const scene of this.scenes) scene.dispose();
    this.scenes.clear();
    this.destroyApp();
  }
}
