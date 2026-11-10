import {
  EngineError,
  Lifetime,
  type LifetimeOwner,
  type Logger,
  type SpriteFrame,
} from "@simpludify/core";
import type { ImageLease } from "./shared-images";

export interface AssetData {
  image: Readonly<{ width: number; height: number }>;
  audio: AudioBuffer | null;
  font: string;
  json: unknown;
}
export type AssetKind = keyof AssetData;
export type AssetStatus =
  | "loading"
  | "ready"
  | "fallback"
  | "failed"
  | "released";

export interface AssetRetry {
  /** One retry for a non-network failure. A promise can represent a caller-owned event. */
  readonly once?:
    | "immediate"
    | { readonly delayMs: number }
    | { readonly until: PromiseLike<unknown> };
  /** Additional attempts after network failures, from zero to five. */
  readonly network?: number;
  readonly networkDelayMs?: number;
}
export interface AssetLoadOptions {
  readonly retry?: AssetRetry;
  /** Deadline for the load and its retries, including any wait for a signal. */
  readonly timeoutMs?: number;
}
export interface AssetRequest<K extends AssetKind = AssetKind>
  extends AssetLoadOptions {
  readonly kind: K;
  readonly url: string | URL;
}
export interface AssetOptions {
  /** Maximum number of idle, successfully loaded Assets per Game. */
  readonly cacheEntries?: number;
  readonly fallback?: Readonly<
    Partial<Record<Exclude<AssetKind, "json">, string | URL>>
  >;
}
export interface AssetProgress {
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly fallback: number;
  readonly loading: number;
  readonly ratio: number;
  readonly state: "idle" | "loading" | "complete";
}
export interface ImageAssetSource {
  readonly kind: "image";
  readonly url: string;
}

export interface AssetResource {
  readonly value: unknown;
  readonly image?: ImageLease;
  release(): void;
}
export interface AssetAdapter {
  load(
    kind: AssetKind,
    url: string,
    signal: AbortSignal,
    reload: boolean,
  ): Promise<AssetResource>;
  fallback(
    kind: AssetKind,
    url: string | undefined,
    signal: AbortSignal,
  ): Promise<AssetResource | undefined>;
}

interface Entry {
  readonly key: string;
  readonly kind: AssetKind;
  readonly url: string;
  readonly id: string;
  readonly listeners: Set<() => void>;
  readonly validators: Set<(asset: AssetResource) => void>;
  readonly users: Set<() => void>;
  readonly first: Promise<void>;
  usable(): void;
  fail(error: unknown): void;
  status: Exclude<AssetStatus, "released">;
  asset: AssetResource | undefined;
  task:
    | {
        readonly promise: Promise<void>;
        readonly controller: AbortController;
        readonly reload: boolean;
      }
    | undefined;
  error: unknown;
}
const cancelled = () =>
  new EngineError("ASSET_CANCELLED", "Asset use has been released");
const invalid = (field: string) =>
  new EngineError("INVALID_VALUE", `Invalid asset ${field}`);

function timeoutFault(cause: unknown): EngineError {
  if (cause instanceof EngineError && cause.code === "ASSET_TIMEOUT")
    return cause;
  return new EngineError(
    "ASSET_TIMEOUT",
    "Asset load deadline expired",
    {},
    { cause },
  );
}

function numberIn(
  value: number,
  min: number,
  max: number,
  field: string,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw invalid(field);
  return value;
}

function settings(options: AssetLoadOptions) {
  const retry = options.retry;
  const once = retry?.once;
  if (once !== undefined && once !== "immediate") {
    if (!once || typeof once !== "object") throw invalid("retry");
    if ("delayMs" in once) numberIn(once.delayMs, 0, 300000, "retry delay");
    else if (!("until" in once) || typeof once.until?.then !== "function")
      throw invalid("retry event");
  }
  return {
    timeoutMs: numberIn(options.timeoutMs ?? 30000, 1, 300000, "timeout"),
    network: numberIn(retry?.network ?? 0, 0, 5, "network retries"),
    networkDelayMs: numberIn(
      retry?.networkDelayMs ?? 250,
      0,
      300000,
      "network retry delay",
    ),
    once,
  };
}

function assetURL(value: string | URL, base: string): string {
  if (typeof value === "string" && !value.trim()) throw invalid("URL");
  if (typeof value !== "string" && !(value instanceof URL))
    throw invalid("URL");
  try {
    const url = new URL(value, base);
    if (
      !["http:", "https:", "data:", "blob:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw invalid("URL");
    return url.href;
  } catch {
    throw invalid("URL");
  }
}

function wait<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (!ms) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function progress(entries: Iterable<Entry>): AssetProgress {
  let total = 0;
  let failed = 0;
  let fallback = 0;
  let loading = 0;
  let completed = 0;
  for (const entry of entries) {
    total++;
    if (entry.task) loading++;
    if (entry.status === "failed") failed++;
    if (entry.status === "fallback") fallback++;
    if (entry.status !== "loading") completed++;
  }
  return Object.freeze({
    total,
    completed,
    failed,
    fallback,
    loading,
    ratio: total ? completed / total : 1,
    state: loading ? "loading" : total ? "complete" : "idle",
  });
}

let nextStore = 0;

export class AssetHandle<K extends AssetKind> {
  readonly ready: Promise<this>;
  private readonly cancelled = new AbortController();
  private readonly imageSource: ImageAssetSource | undefined;

  /** @internal */
  constructor(
    readonly kind: K,
    private readonly entry: Entry,
    private readonly store: AssetStore,
    private readonly remove: () => void,
  ) {
    this.imageSource =
      kind === "image"
        ? Object.freeze({ kind: "image", url: entry.id })
        : undefined;
    this.ready = store.ready(entry, this.cancelled.signal).then(() => this);
    void this.ready.catch(() => {});
  }

  get id(): string {
    return this.entry.id;
  }
  get url(): string {
    return this.entry.url;
  }
  get status(): AssetStatus {
    return this.cancelled.signal.aborted ? "released" : this.entry.status;
  }
  get loading(): boolean {
    return !this.cancelled.signal.aborted && this.entry.task !== undefined;
  }
  get value(): AssetData[K] | undefined {
    return this.status === "released"
      ? undefined
      : (this.entry.asset?.value as AssetData[K] | undefined);
  }
  get error(): unknown {
    return this.status === "released" ? undefined : this.entry.error;
  }
  get progress(): AssetProgress {
    return progress(this.status === "released" ? [] : [this.entry]);
  }
  /** Stable Renderable source. SpriteSheet accepts its URL. */
  get source(): K extends "image" ? ImageAssetSource : undefined {
    return this.imageSource as K extends "image" ? ImageAssetSource : undefined;
  }

  onChange(listener: (asset: this) => void): () => void {
    const signal = this.cancelled.signal;
    signal.throwIfAborted();
    const notify = () => listener(this);
    const off = () => {
      this.entry.listeners.delete(notify);
      signal.removeEventListener("abort", off);
    };
    this.entry.listeners.add(notify);
    signal.addEventListener("abort", off, { once: true });
    return off;
  }

  /** @internal A playback or Game font owns a separate reference. */
  retain(store: AssetStore): AssetHandle<K> {
    this.cancelled.signal.throwIfAborted();
    if (this.store !== store)
      throw new EngineError("ASSET_OWNERSHIP", "Asset belongs to another Game");
    let release = () => {};
    const use = new AssetHandle(this.kind, this.entry, store, () => release());
    release = store.retain(this.entry, () => use.release());
    return use;
  }

  async reload(options: AssetLoadOptions = {}): Promise<this> {
    if (this.cancelled.signal.aborted) throw cancelled();
    await wait(
      this.store.start(this.entry, options, true),
      this.cancelled.signal,
    );
    return this;
  }

  release(): void {
    if (this.cancelled.signal.aborted) return;
    this.cancelled.abort(cancelled());
    this.remove();
  }
}

export class AssetScope implements LifetimeOwner {
  private readonly lifetime = new Lifetime();
  private readonly handles = new Map<Entry, AssetHandle<AssetKind>>();
  private readonly listeners = new Set<(value: AssetProgress) => void>();
  private previous: AssetProgress | undefined;

  /** @internal */
  constructor(
    private readonly store: AssetStore,
    owner?: LifetimeOwner,
    private readonly global = false,
  ) {
    if (owner?.disposed) throw cancelled();
    const unregister = store.register(this);
    let removeOwner: (() => void) | undefined;
    try {
      removeOwner = owner?.onDispose(() => this.dispose());
    } catch (error) {
      unregister();
      throw error;
    }
    const off = store.observe(() => this.notify());
    this.lifetime.onDispose(() => {
      off();
      unregister();
      removeOwner?.();
      this.listeners.clear();
    });
  }

  get disposed(): boolean {
    return this.lifetime.disposed;
  }
  onDispose(callback: () => void): () => void {
    return this.lifetime.onDispose(callback);
  }

  scope(owner: LifetimeOwner = this): AssetScope {
    if (this.disposed) throw cancelled();
    return new AssetScope(this.store, owner);
  }

  load<K extends AssetKind>(request: AssetRequest<K>): AssetHandle<K> {
    if (this.disposed) throw cancelled();
    const entry = this.store.entry(request);
    const existing = this.handles.get(entry);
    if (existing) return existing as AssetHandle<K>;
    let drop: () => void = () => {};
    const handle = new AssetHandle(request.kind, entry, this.store, () => {
      this.handles.delete(entry);
      drop();
    });
    this.handles.set(entry, handle as AssetHandle<AssetKind>);
    drop = this.store.retain(entry, () => handle.release());
    if (entry.status === "loading" && !entry.task) {
      void this.store.start(entry, request, false).catch(() => {});
    } else this.store.changed();
    return handle;
  }

  get progress(): AssetProgress {
    return this.global ? this.store.progress : progress(this.handles.keys());
  }

  onProgress(listener: (value: AssetProgress) => void): () => void {
    if (this.disposed) throw cancelled();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (!this.listeners.size) return;
    const snapshot = this.progress;
    const previous = this.previous;
    if (
      previous &&
      previous.total === snapshot.total &&
      previous.completed === snapshot.completed &&
      previous.failed === snapshot.failed &&
      previous.fallback === snapshot.fallback &&
      previous.loading === snapshot.loading
    )
      return;
    this.previous = snapshot;
    for (const listener of [...this.listeners])
      if (this.listeners.has(listener))
        this.store.deliver(() => listener(snapshot));
  }

  dispose(): void {
    if (this.disposed) return;
    try {
      this.lifetime.dispose();
    } finally {
      for (const handle of [...this.handles.values()]) handle.release();
    }
  }
}

/** @internal One resource directory per Game. The adapter owns decoded resources. */
export class AssetStore {
  private readonly prefix = `simpludify-asset:${++nextStore}:`;
  private readonly entries = new Map<string, Entry>();
  private readonly images = new Map<string, Entry>();
  private readonly idle = new Set<Entry>();
  private readonly listeners = new Set<() => void>();
  private readonly scopes = new Set<AssetScope>();
  private notifying = false;
  private notificationScheduled = false;
  private readonly capacity: number;
  private readonly customFallback: Partial<Record<AssetKind, string>> = {};
  private sequence = 0;
  private dead = false;

  constructor(
    private readonly adapter: AssetAdapter,
    private readonly logger: Logger,
    private readonly base: string,
    options: AssetOptions = {},
  ) {
    this.capacity = numberIn(
      options.cacheEntries ?? 16,
      0,
      1024,
      "cache capacity",
    );
    for (const kind of ["image", "audio", "font"] as const) {
      const custom = options.fallback?.[kind];
      if (custom !== undefined)
        this.customFallback[kind] = assetURL(custom, base);
    }
  }

  register(scope: AssetScope): () => void {
    if (this.dead) throw cancelled();
    this.scopes.add(scope);
    return () => {
      this.scopes.delete(scope);
    };
  }

  observe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  deliver(listener: () => unknown): void {
    const report = (cause: unknown) => {
      this.logger.report(cause, {
        source: "engine.assets",
        message: "Asset observer failed",
        fatal: false,
      });
    };
    try {
      const result = listener();
      if (result != null) void Promise.resolve(result).catch(report);
    } catch (cause) {
      report(cause);
    }
  }

  changed(): void {
    if (this.notifying) {
      if (!this.notificationScheduled) {
        this.notificationScheduled = true;
        queueMicrotask(() => {
          this.notificationScheduled = false;
          this.changed();
        });
      }
      return;
    }
    this.notifying = true;
    try {
      for (const listener of [...this.listeners])
        if (this.listeners.has(listener)) this.deliver(listener);
    } finally {
      this.notifying = false;
    }
  }

  get progress(): AssetProgress {
    return progress(
      [...this.entries.values()].filter((entry) => entry.users.size > 0),
    );
  }

  entry<K extends AssetKind>(request: AssetRequest<K>): Entry {
    if (this.dead) throw cancelled();
    if (!["image", "audio", "font", "json"].includes(request.kind))
      throw invalid("kind");
    settings(request);
    const url = assetURL(request.url, this.base);
    const key = `${request.kind}\0${url}`;
    const existing = this.entries.get(key);
    if (existing) return existing;
    let usable: () => void = () => {};
    let fail: (error: unknown) => void = () => {};
    const first = new Promise<void>((resolve, reject) => {
      usable = resolve;
      fail = reject;
    });
    void first.catch(() => {});
    const entry: Entry = {
      key,
      url,
      kind: request.kind,
      id: this.prefix + ++this.sequence,
      first,
      usable,
      fail,
      users: new Set(),
      listeners: new Set(),
      validators: new Set(),
      status: "loading",
      asset: undefined,
      task: undefined,
      error: undefined,
    };
    this.entries.set(key, entry);
    if (entry.kind === "image") this.images.set(entry.id, entry);
    return entry;
  }

  retain(entry: Entry, dispose: () => void): () => void {
    this.idle.delete(entry);
    entry.users.add(dispose);
    return () => {
      if (!entry.users.delete(dispose)) return;
      if (!entry.users.size) {
        if (
          !this.dead &&
          !entry.task &&
          entry.status === "ready" &&
          this.capacity
        ) {
          this.idle.add(entry);
          if (this.idle.size > this.capacity) {
            const oldest = this.idle.values().next().value;
            if (oldest) this.evict(oldest);
          }
        } else this.evict(entry);
      }
      this.changed();
    };
  }

  private release(resource: AssetResource | undefined): void {
    if (resource) this.deliver(() => resource.release());
  }

  private evict(entry: Entry): void {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
    this.images.delete(entry.id);
    this.idle.delete(entry);
    entry.task?.controller.abort(cancelled());
    entry.fail(cancelled());
    const asset = entry.asset;
    entry.asset = undefined;
    this.release(asset);
  }

  async ready(entry: Entry, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (entry.asset) return;
    await wait(
      entry.status === "failed" && entry.task
        ? entry.task.promise
        : entry.first,
      signal,
    );
    signal.throwIfAborted();
    if (!entry.asset) throw entry.error ?? cancelled();
  }

  start(
    entry: Entry,
    options: AssetLoadOptions,
    reload: boolean,
  ): Promise<void> {
    if (this.dead || !entry.users.size) return Promise.reject(cancelled());
    const policy = settings(options);
    const active = entry.task;
    if (active && (!reload || active.reload)) return active.promise;
    const controller = new AbortController();
    const promise = Promise.resolve().then(async () => {
      try {
        await this.load(entry, policy, reload, controller.signal);
      } finally {
        if (entry.task?.promise === promise) {
          entry.task = undefined;
          this.changed();
        }
      }
    });
    entry.task = { promise, controller, reload };
    active?.controller.abort(cancelled());
    void promise.catch(() => {});
    this.changed();
    return promise;
  }

  private async attempt(
    promise: Promise<AssetResource | undefined>,
    signal: AbortSignal,
  ): Promise<AssetResource | undefined> {
    void promise.then(
      (asset) => {
        if (signal.aborted) this.release(asset);
      },
      () => {},
    );
    return await wait(promise, signal);
  }

  private commit(entry: Entry, asset: AssetResource, fallback: boolean): void {
    try {
      for (const validate of entry.validators) validate(asset);
    } catch (error) {
      this.release(asset);
      throw error;
    }
    const old = entry.asset;
    entry.asset = asset;
    entry.status = fallback ? "fallback" : "ready";
    if (!fallback) entry.error = undefined;
    entry.usable();
    for (const listener of [...entry.listeners])
      if (entry.listeners.has(listener)) this.deliver(listener);
    this.release(old);
    this.changed();
  }

  private async fallback(
    entry: Entry,
    signal: AbortSignal,
    owner: AbortSignal,
    deadline: AbortSignal,
  ): Promise<void> {
    const custom = this.customFallback[entry.kind];
    if (custom && !signal.aborted) {
      try {
        const asset = await this.attempt(
          this.adapter.fallback(entry.kind, custom, signal),
          signal,
        );
        if (asset) {
          if (signal.aborted) {
            this.release(asset);
            throw signal.reason;
          }
          this.commit(entry, asset, true);
          return;
        }
      } catch (cause) {
        if (owner.aborted) throw owner.reason;
        this.logger.warn("Custom asset fallback failed", {
          source: "engine.assets",
          cause,
        });
      }
    }
    owner.throwIfAborted();
    const asset = await this.attempt(
      this.adapter.fallback(entry.kind, undefined, owner),
      owner,
    );
    if (asset) {
      if (owner.aborted) {
        this.release(asset);
        throw owner.reason;
      }
      if (deadline.aborted) entry.error = timeoutFault(entry.error);
      this.commit(entry, asset, true);
    }
  }

  private async load(
    entry: Entry,
    policy: ReturnType<typeof settings>,
    reload: boolean,
    owner: AbortSignal,
  ): Promise<void> {
    const deadline = AbortSignal.timeout(policy.timeoutMs);
    const signal = AbortSignal.any([owner, deadline]);
    let network = policy.network;
    let once = policy.once;
    let failure: unknown;
    try {
      for (;;) {
        try {
          signal.throwIfAborted();
          const asset = await this.attempt(
            this.adapter.load(entry.kind, entry.url, signal, reload),
            signal,
          );
          if (!asset) throw invalid("adapter result");
          if (signal.aborted) {
            this.release(asset);
            throw signal.reason;
          }
          this.commit(entry, asset, false);
          return;
        } catch (cause) {
          owner.throwIfAborted();
          const fault = deadline.aborted ? timeoutFault(cause) : cause;
          failure = fault;
          entry.error = fault;
          if (!entry.asset) {
            await this.fallback(entry, signal, owner, deadline);
            owner.throwIfAborted();
            failure = entry.error;
            if (entry.asset)
              this.logger.warn("Using an asset fallback", {
                source: "engine.assets",
                code: "ASSET_FALLBACK",
                details: { kind: entry.kind, id: entry.id },
                cause: failure,
              });
          }
          if (signal.aborted) break;
          if (fault instanceof EngineError && fault.code === "ASSET_NETWORK") {
            if (!network) break;
            network--;
            await pause(policy.networkDelayMs, signal);
          } else {
            const retry = once;
            once = undefined;
            if (!retry) break;
            if (retry !== "immediate")
              if ("delayMs" in retry) await pause(retry.delayMs, signal);
              else await wait(Promise.resolve(retry.until), signal);
          }
        }
      }
    } catch (cause) {
      owner.throwIfAborted();
      failure = cause;
    }
    owner.throwIfAborted();
    if (deadline.aborted) failure = timeoutFault(failure);
    failure ??= new EngineError(
      "ASSET_LOAD_FAILED",
      "Asset could not be loaded",
    );
    entry.error = failure;
    if (!entry.asset) {
      entry.status = "failed";
      entry.fail(failure);
    }
    this.logger.report(failure, {
      source: "engine.assets",
      message: "Asset loading failed",
      fatal: false,
    });
    if (reload || !entry.asset) throw failure;
  }

  async image(id: string, signal: AbortSignal): Promise<ImageLease> {
    const entry = this.images.get(id);
    if (!entry || this.dead || signal.aborted) throw cancelled();
    const controller = new AbortController();
    const pending = AbortSignal.any([signal, controller.signal]);
    let frames: (() => Iterable<SpriteFrame>) | undefined;
    const subscriptions = new Set<() => void>();
    const validate = (asset: AssetResource) => {
      for (const frame of frames?.() ?? []) asset.image?.textureFor(frame);
    };
    const release = () => {
      if (controller.signal.aborted) return;
      controller.abort(cancelled());
      for (const listener of subscriptions) entry.listeners.delete(listener);
      subscriptions.clear();
      entry.validators.delete(validate);
      drop();
    };
    const drop = this.retain(entry, release);
    try {
      await this.ready(entry, pending);
      pending.throwIfAborted();
      entry.validators.add(validate);
      const current = () => {
        if (controller.signal.aborted || !entry.asset?.image) throw cancelled();
        return entry.asset.image;
      };
      return {
        get texture() {
          return current().texture;
        },
        textureFor: (frame) => {
          const lease = current();
          if (!frame) return lease.texture;
          return entry.status === "fallback"
            ? lease.texture
            : lease.textureFor(frame);
        },
        useFrames: (required) => {
          frames = required;
        },
        onChange: (listener) => {
          if (controller.signal.aborted) return () => {};
          subscriptions.add(listener);
          entry.listeners.add(listener);
          return () => {
            subscriptions.delete(listener);
            entry.listeners.delete(listener);
          };
        },
        release,
      };
    } catch (error) {
      release();
      throw error;
    }
  }

  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.listeners.clear();
    for (const scope of [...this.scopes]) this.deliver(() => scope.dispose());
    for (const entry of [...this.entries.values()]) {
      for (const dispose of [...entry.users]) this.deliver(dispose);
      if (this.entries.get(entry.key) === entry) this.evict(entry);
    }
  }
}

export function isAssetImage(url: string): boolean {
  return url.startsWith("simpludify-asset:");
}
