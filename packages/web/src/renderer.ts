import {
  type CharacterState,
  EngineError,
  type PreparedScene,
  type RendererPort,
  viewTransform,
  type WorldView,
} from "@simpludify/core";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
export class PixiRenderer implements RendererPort {
  private readonly app = new Application();
  private readonly scenes = new Set<PreparedScene>();
  private readonly pending = new Set<AbortController>();
  private ready = false;
  private dead = false;
  private transform = {
    scale: 1,
    x: 0,
    y: 0,
    worldWidth: 800,
    worldHeight: 450,
  };
  constructor(
    private readonly host: HTMLElement,
    private readonly background = "#101922",
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
      resolution: Math.min(window.devicePixelRatio || 1, 2),
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
  async prepare(characters: readonly CharacterState[]): Promise<PreparedScene> {
    if (!this.ready || this.dead)
      throw new EngineError("RENDERER_NOT_READY", "Renderer is not available");
    const controller = new AbortController();
    this.pending.add(controller);
    const container = new Container();
    const mask = new Graphics();
    container.addChild(mask);
    container.mask = mask;
    let maskWidth = 0,
      maskHeight = 0;
    const textures: Texture[] = [];
    const visuals: Array<{
      character: CharacterState;
      display: Sprite | Graphics;
    }> = [];
    try {
      for (const character of characters) {
        let display: Sprite | Graphics;
        if (character.sprite) {
          const texture = await this.texture(
            character.sprite,
            controller.signal,
          );
          textures.push(texture);
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.width = character.size;
          sprite.height = character.size;
          display = sprite;
        } else {
          display = new Graphics()
            .roundRect(
              -character.size / 2,
              -character.size / 2,
              character.size,
              character.size,
              character.size / 4,
            )
            .fill(character.color)
            .circle(
              -character.size / 7,
              -character.size / 10,
              character.size / 18,
            )
            .fill(0x102c28)
            .circle(
              character.size / 7,
              -character.size / 10,
              character.size / 18,
            )
            .fill(0x102c28);
        }
        container.addChild(display);
        visuals.push({ character, display });
      }
      if (this.dead)
        throw new EngineError(
          "GAME_DISPOSED",
          "Renderer disposed while preparing scene",
        );
    } catch (error) {
      container.destroy({ children: true });
      for (const texture of textures) texture.destroy(true);
      throw error;
    } finally {
      this.pending.delete(controller);
    }
    let disposed = false;
    const prepared: PreparedScene = {
      render: () => {
        if (disposed || this.dead) return;
        if (!container.parent) this.app.stage.addChild(container);
        if (
          maskWidth !== this.transform.worldWidth ||
          maskHeight !== this.transform.worldHeight
        ) {
          maskWidth = this.transform.worldWidth;
          maskHeight = this.transform.worldHeight;
          mask.clear().rect(0, 0, maskWidth, maskHeight).fill(0xffffff);
        }
        container.scale.set(this.transform.scale);
        container.position.set(this.transform.x, this.transform.y);
        for (const { character, display } of visuals)
          display.position.set(character.x, character.y);
        this.app.render();
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.scenes.delete(prepared);
        container.destroy({ children: true });
        for (const texture of textures) texture.destroy(true);
      },
    };
    this.scenes.add(prepared);
    return prepared;
  }
  resize(width: number, height: number, view: WorldView): void {
    if (!this.ready || this.dead) return;
    this.transform = viewTransform(width, height, view);
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
