import {
  type Actor,
  cleanupAll,
  EngineError,
  imageSize,
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
  depth: number;
  scaleX: number;
  scaleY: number;
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
  private textureCount = 0;
  get diagnostics() {
    return {
      presentations: this.scenes.size,
      visuals: this.visualCount,
      textures: this.textureCount,
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
    const drawOrder: Visual[] = [];
    let depthDirty = true;
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
        depth: NaN,
        scaleX: 1,
        scaleY: 1,
        actor,
        component,
        transform: actor.require(Transform.type),
        controller,
        promise: Promise.resolve(),
        dispose: () => {
          if (dead) return;
          dead = true;
          this.visualCount--;
          depthDirty = true;
          drawOrder.length = 0;
          controller.abort();
          this.pending.delete(controller);
          if (entry.texture) this.textureCount--;
          const display = entry.display,
            texture = entry.texture;
          delete entry.display;
          delete entry.texture;
          cleanupAll(
            [
              removeActorCleanup,
              removeComponentCleanup,
              () => display?.destroy(),
              () => texture?.destroy(true),
            ],
            "Visual cleanup failed",
          );
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
            this.textureCount++;
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            const size = imageSize(
              texture.width,
              texture.height,
              component.width,
              component.height,
              component.fit,
            );
            entry.scaleX = size.width / texture.width;
            entry.scaleY = size.height / texture.height;
            entry.display = sprite;
            depthDirty = true;
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
        const graphics = new Graphics();
        if (component.shape === Shape.Circle)
          graphics
            .circle(0, 0, Math.min(width, height) / 2)
            .fill(component.color);
        else if (component.shape === Shape.Triangle)
          graphics
            .poly(
              [0, -height / 2, width / 2, height / 2, -width / 2, height / 2],
              true,
            )
            .fill(component.color);
        else
          graphics
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
      depthDirty = true;
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
              entry.actor.enabled &&
              entry.component.enabled &&
              entry.component.visible;
            entry.display.alpha = entry.component.opacity;
            if (entry.depth !== entry.component.zIndex) {
              entry.depth = entry.component.zIndex;
              depthDirty = true;
            }
            entry.display.position.set(t.x, t.y);
            entry.display.rotation = t.rotation;
            entry.display.scale.set(
              entry.scaleX * t.scaleX,
              entry.scaleY * t.scaleY,
            );
          }
        if (depthDirty) {
          drawOrder.length = 0;
          for (const entry of visuals.values())
            if (entry.display) drawOrder.push(entry);
          drawOrder.sort(
            (a, b) =>
              a.component.zIndex - b.component.zIndex || a.order - b.order,
          );
          for (let i = 0; i < drawOrder.length; i++) {
            const entry = drawOrder[i];
            if (entry?.display) entry.display.zIndex = i;
          }
          depthDirty = false;
        }
        this.app.render();
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.scenes.delete(prepared);
        const entries = [...visuals.values()];
        visuals.clear();
        drawOrder.length = 0;
        cleanupAll(
          [
            () => removeSceneCleanup?.(),
            ...entries.map((entry) => entry.dispose),
            () => root.destroy({ children: true, context: true }),
          ],
          "Presentation cleanup failed",
        );
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
      this.app.destroy({ removeView: true }, { children: true, context: true });
    }
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
    const scenes = [...this.scenes];
    this.scenes.clear();
    cleanupAll(
      [...scenes.map((scene) => scene.dispose), () => this.destroyApp()],
      "Renderer cleanup failed",
    );
  }
}
