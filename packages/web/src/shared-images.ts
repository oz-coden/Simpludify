import { EngineError } from "@simpludify/core";
import type { Texture } from "pixi.js";

/** Internal ownership boundary: the loader owns a Texture and its TextureSource. */
export interface ImageResource {
  readonly texture: Texture;
  release(): void;
}
interface Consumer {
  ready(resource: ImageResource): void;
  fail(error: unknown): void;
  release(): void;
}
interface Entry {
  readonly key: string;
  readonly controller: AbortController;
  readonly consumers: Set<Consumer>;
  resource?: ImageResource;
}

/** Renderer-local, live-reference cache. No idle retention or process-global state. */
export class SharedImages {
  private readonly entries = new Map<string, Entry>();
  private references = 0;
  private dead = false;
  constructor(
    private readonly load: (
      url: string,
      signal: AbortSignal,
    ) => Promise<ImageResource>,
  ) {}
  get diagnostics() {
    let pending = 0;
    for (const entry of this.entries.values()) if (!entry.resource) pending++;
    return {
      imageReferences: this.references,
      imageEntries: this.entries.size,
      pendingImages: pending,
    };
  }
  acquire(key: string, signal: AbortSignal): Promise<ImageResource> {
    const cancelled = () =>
      new EngineError("GAME_DISPOSED", "Image use cancelled", { path: key });
    if (this.dead || signal.aborted) return Promise.reject(cancelled());
    let entry = this.entries.get(key);
    const fresh = !entry;
    if (!entry) {
      entry = {
        key,
        controller: new AbortController(),
        consumers: new Set(),
      };
      this.entries.set(key, entry);
    }
    const current = entry;
    const promise = new Promise<ImageResource>((resolve, reject) => {
      let released = false,
        settled = false;
      const release = () => {
        if (released) return;
        released = true;
        signal.removeEventListener("abort", release);
        current.consumers.delete(consumer);
        this.references--;
        if (!settled) {
          settled = true;
          reject(cancelled());
        }
        if (!current.consumers.size) {
          if (this.entries.get(key) === current) this.entries.delete(key);
          current.controller.abort();
          const resource = current.resource;
          delete current.resource;
          resource?.release();
        }
      };
      const consumer: Consumer = {
        ready: (resource) => {
          if (released || settled) return;
          settled = true;
          signal.removeEventListener("abort", release);
          // A resolved lease survives request-controller cleanup. Its owner must
          // explicitly release it after replacing/destroying the displayed image.
          resolve({ texture: resource.texture, release });
        },
        fail: (error) => {
          if (released || settled) return;
          settled = true;
          reject(error);
          release();
        },
        release,
      };
      this.references++;
      current.consumers.add(consumer);
      signal.addEventListener("abort", release, { once: true });
      if (current.resource) consumer.ready(current.resource);
    });
    if (fresh) {
      // Register the first consumer before invoking even a synchronous/throwing
      // loader. Both completion branches handle abandoned entries explicitly.
      void Promise.resolve()
        .then(() => this.load(key, current.controller.signal))
        .then(
          (resource) => {
            if (!current.consumers.size) {
              resource.release();
              return;
            }
            current.resource = resource;
            for (const consumer of current.consumers) consumer.ready(resource);
          },
          (error) => {
            if (this.entries.get(key) === current) this.entries.delete(key);
            for (const consumer of [...current.consumers]) consumer.fail(error);
          },
        );
    }
    return promise;
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    for (const entry of [...this.entries.values()])
      for (const consumer of [...entry.consumers]) consumer.release();
  }
}
