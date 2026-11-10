import {
  type Diagnostic,
  EngineError,
  Lifetime,
  Logger,
} from "@simpludify/core";
import { expect, it, vi } from "vitest";
import {
  type AssetAdapter,
  type AssetResource,
  AssetScope,
  AssetStore,
} from "../../packages/web/src/assets";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function resource(value: unknown) {
  return { value, release: vi.fn() };
}
function fixture(adapter: AssetAdapter, options = {}) {
  const logger = new Logger();
  const diagnostics: Diagnostic[] = [];
  logger.subscribe((entry) => diagnostics.push(entry));
  const store = new AssetStore(
    adapter,
    logger,
    "https://game.example/",
    options,
  );
  return { store, assets: new AssetScope(store, undefined, true), diagnostics };
}

it("shares work across scopes, cancels only the released owner and evicts idle entries", async () => {
  const pending = deferred<AssetResource>();
  const first = resource(1);
  const second = resource(2);
  const load = vi.fn<AssetAdapter["load"]>((_kind, url) =>
    url.endsWith("data") ? pending.promise : Promise.resolve(second),
  );
  const { assets, store } = fixture(
    { load, fallback: async () => undefined },
    { cacheEntries: 1 },
  );
  const owner = new Lifetime();
  const scene = assets.scope(owner);
  const a = scene.load({ kind: "json", url: "./data" });
  const b = assets.load({ kind: "json", url: "https://game.example/data" });
  const scopes: number[] = [];
  assets.onProgress((value) => scopes.push(value.completed));
  expect(a.id).toBe(b.id);
  expect(assets.progress).toMatchObject({ total: 1, loading: 1, completed: 0 });
  expect(scene.load({ kind: "json", url: "/data" })).toBe(a);
  owner.dispose();
  await expect(a.ready).rejects.toMatchObject({ code: "ASSET_CANCELLED" });
  pending.resolve(first);
  await b.ready;
  expect(b.value).toBe(1);
  expect(load).toHaveBeenCalledTimes(1);
  b.release();
  const cached = assets.load({ kind: "json", url: "/data" });
  await cached.ready;
  expect(cached.id).toBe(b.id);
  expect(load).toHaveBeenCalledTimes(1);
  cached.release();
  const another = await assets.load({ kind: "json", url: "/other" }).ready;
  expect(first.release).not.toHaveBeenCalled();
  another.release();
  expect(first.release).toHaveBeenCalledTimes(1);
  expect(scopes).toContain(1);
  store.dispose();
  expect(second.release).toHaveBeenCalledTimes(1);
  expect(assets.disposed).toBe(true);
});

it("keeps the built-in fallback during an event retry and keeps healthy data on a failed reload", async () => {
  const event = deferred<void>();
  const fallback = resource({ width: 2, height: 2 });
  const real = resource({ width: 8, height: 8 });
  const load = vi
    .fn<AssetAdapter["load"]>()
    .mockRejectedValueOnce(new Error("bad image"))
    .mockResolvedValueOnce(real)
    .mockRejectedValueOnce(new Error("failed replacement"));
  const useFallback = vi
    .fn<AssetAdapter["fallback"]>()
    .mockRejectedValueOnce(new Error("bad custom fallback"))
    .mockResolvedValueOnce(fallback);
  const { assets, store, diagnostics } = fixture(
    { load, fallback: useFallback },
    { fallback: { image: "/custom" } },
  );
  const handle = assets.load({
    kind: "image",
    url: "/hero",
    retry: { once: { until: event.promise } },
  });
  await handle.ready;
  expect(handle.status).toBe("fallback");
  expect(handle.loading).toBe(true);
  expect(handle.value).toEqual({ width: 2, height: 2 });
  expect(assets.progress).toMatchObject({
    completed: 1,
    fallback: 1,
    loading: 1,
  });
  const recoveredErrors: unknown[] = [];
  handle.onChange((asset) => {
    if (asset.status === "ready") recoveredErrors.push(asset.error);
  });
  const completed = deferred<void>();
  assets.onProgress((p) => {
    if (p.loading === 0) completed.resolve();
  });
  event.resolve();
  await completed.promise;
  expect(handle.status).toBe("ready");
  expect(handle.value).toEqual({ width: 8, height: 8 });
  expect(recoveredErrors).toEqual([undefined]);
  expect(fallback.release).toHaveBeenCalledTimes(1);
  expect(diagnostics.some((entry) => entry.code === "ASSET_FALLBACK")).toBe(
    true,
  );
  await expect(handle.reload()).rejects.toThrow("failed replacement");
  expect(handle.value).toEqual({ width: 8, height: 8 });
  expect(real.release).not.toHaveBeenCalled();
  store.dispose();
  expect(real.release).toHaveBeenCalledTimes(1);
});

it("enforces retry limits, rejects invalid settings and discards late abandoned work", async () => {
  const abandoned = deferred<AssetResource>();
  const load = vi
    .fn<AssetAdapter["load"]>()
    .mockRejectedValueOnce(new EngineError("ASSET_NETWORK", "first"))
    .mockRejectedValueOnce(new EngineError("ASSET_NETWORK", "second"))
    .mockRejectedValueOnce(new EngineError("ASSET_NETWORK", "last"))
    .mockReturnValueOnce(abandoned.promise);
  const { assets, store } = fixture({ load, fallback: async () => undefined });
  expect(() =>
    assets.load({ kind: "json", url: "javascript:alert(1)" }),
  ).toThrow();
  expect(() =>
    assets.load({ kind: "json", url: "/data", retry: { network: 6 } }),
  ).toThrow();
  const failed = assets.load({
    kind: "json",
    url: "/data",
    retry: { network: 2, networkDelayMs: 0 },
  });
  await expect(failed.ready).rejects.toMatchObject({ code: "ASSET_NETWORK" });
  expect(load).toHaveBeenCalledTimes(3);
  expect(assets.progress.failed).toBe(1);
  const other = assets.load({ kind: "json", url: "/late" });
  await Promise.resolve();
  store.dispose();
  const late = resource("abandoned");
  abandoned.resolve(late);
  await expect(other.ready).rejects.toMatchObject({ code: "ASSET_CANCELLED" });
  await Promise.resolve();
  expect(late.release).toHaveBeenCalledTimes(1);
  expect(other.value).toBeUndefined();
});

it("delivers ordered progress snapshots across reentrant scope updates", async () => {
  const { assets, store, diagnostics } = fixture({
    load: async (_kind, url) => resource(url),
    fallback: async () => undefined,
  });
  const scope = assets.scope();
  const totals: number[] = [];
  scope.onProgress((progress) => {
    if (progress.total === 1 && progress.loading === 1)
      scope.load({ kind: "json", url: "/second" });
  });
  scope.onProgress(async (progress) => {
    totals.push(progress.total);
    if (progress.total === 1) throw new Error("progress observer failed");
  });
  await scope.load({ kind: "json", url: "/first" }).ready;
  expect(totals[0]).toBe(1);
  expect(totals.slice(1)).not.toContain(1);
  expect(totals).toContain(2);
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ message: "Asset observer failed" }),
  );
  store.dispose();
});

it("preempts a pending background retry on reload, validates reload options and rejects when reload fails on fallback", async () => {
  const stalled = deferred<void>();
  const fallback = resource({ width: 2, height: 2 });
  const load = vi
    .fn<AssetAdapter["load"]>()
    .mockRejectedValueOnce(new Error("initial failure"))
    .mockRejectedValueOnce(new Error("reload failure"));
  const { assets, store } = fixture({
    load,
    fallback: async () => fallback,
  });
  const handle = assets.load({
    kind: "image",
    url: "/hero",
    retry: { once: { until: stalled.promise } },
  });
  await handle.ready;
  expect(handle.status).toBe("fallback");
  expect(handle.loading).toBe(true);
  await expect(handle.reload({ timeoutMs: 0 })).rejects.toMatchObject({
    code: "INVALID_VALUE",
  });
  await expect(handle.reload()).rejects.toThrow("reload failure");
  expect(load).toHaveBeenLastCalledWith(
    "image",
    "https://game.example/hero",
    expect.any(AbortSignal),
    true,
  );
  expect(handle.status).toBe("fallback");
  expect(handle.value).toEqual({ width: 2, height: 2 });
  store.dispose();
});

it("normalizes timeout failures to ASSET_TIMEOUT before fallback notification", async () => {
  const fallback = resource({ width: 2, height: 2 });
  const { assets, store, diagnostics } = fixture({
    load: (_kind, _url, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
    fallback: async () => fallback,
  });
  const observed: unknown[] = [];
  const handle = assets.load({
    kind: "image",
    url: "/slow",
    timeoutMs: 1,
  });
  handle.onChange((asset) => observed.push(asset.error));
  await handle.ready;
  expect(handle.status).toBe("fallback");
  expect(handle.error).toMatchObject({ code: "ASSET_TIMEOUT" });
  expect(observed[0]).toMatchObject({ code: "ASSET_TIMEOUT" });
  expect(
    diagnostics.find((entry) => entry.code === "ASSET_FALLBACK")?.cause,
  ).toMatchObject({ code: "ASSET_TIMEOUT" });
  store.dispose();
});

it("shares an explicit reload across owners without aborting it when one leaves", async () => {
  const replacement = deferred<AssetResource>();
  const original = resource(1);
  const next = resource(2);
  const load = vi
    .fn<AssetAdapter["load"]>()
    .mockResolvedValueOnce(original)
    .mockReturnValue(replacement.promise);
  const { assets, store } = fixture({ load, fallback: async () => undefined });
  try {
    const scope = assets.scope();
    const a = await scope.load({ kind: "json", url: "/shared" }).ready;
    const b = await assets.load({ kind: "json", url: "/shared" }).ready;
    const first = a.reload();
    const released = expect(first).rejects.toMatchObject({
      code: "ASSET_CANCELLED",
    });
    await Promise.resolve();
    const signal = load.mock.calls[1]?.[2];
    await expect(b.reload({ timeoutMs: 0 })).rejects.toMatchObject({
      code: "INVALID_VALUE",
    });
    const joined = b.reload();
    scope.dispose();
    await released;
    const aborted = signal?.aborted;
    replacement.resolve(next);
    await joined;
    expect(aborted).toBe(false);
    expect(b.value).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
    expect(original.release).toHaveBeenCalledTimes(1);
    expect(next.release).not.toHaveBeenCalled();
  } finally {
    store.dispose();
  }
  expect(next.release).toHaveBeenCalledTimes(1);
});

it("reports a failed explicit reload even before the first fallback and releases the superseded result", async () => {
  const abandoned = deferred<AssetResource>();
  const old = resource({ width: 32 });
  const fallback = resource({ width: 2 });
  const load = vi
    .fn<AssetAdapter["load"]>()
    .mockReturnValueOnce(abandoned.promise)
    .mockRejectedValueOnce(new Error("replacement failed"));
  const { assets, store } = fixture({ load, fallback: async () => fallback });
  try {
    const handle = assets.load({ kind: "image", url: "/early" });
    await Promise.resolve();
    const result = handle.reload();
    const rejected = expect(result).rejects.toThrow("replacement failed");
    abandoned.resolve(old);
    await rejected;
    await handle.ready;
    expect(load.mock.calls[0]?.[2].aborted).toBe(true);
    expect(old.release).toHaveBeenCalledTimes(1);
    expect(handle.status).toBe("fallback");
    expect(handle.value).toEqual({ width: 2 });
  } finally {
    store.dispose();
  }
});

it("does not finish a superseded load after a reentrant fallback observer starts a reload", async () => {
  const next = deferred<AssetResource>();
  const fallback = resource({ width: 2 });
  const load = vi
    .fn<AssetAdapter["load"]>()
    .mockRejectedValueOnce(new Error("initial failure"))
    .mockReturnValueOnce(next.promise);
  const { assets, store, diagnostics } = fixture({
    load,
    fallback: async () => fallback,
  });
  try {
    const handle = assets.load({ kind: "image", url: "/reentrant" });
    const started = deferred<PromiseLike<void>>();
    handle.onChange((asset) => {
      if (asset.status === "fallback")
        started.resolve(asset.reload().then(() => {}));
    });
    await handle.ready;
    await Promise.resolve();
    const loading = handle.loading;
    const oldDiagnostics = [...diagnostics];
    next.resolve(resource({ width: 16 }));
    await started.promise;
    expect(loading).toBe(true);
    expect(oldDiagnostics).not.toContainEqual(
      expect.objectContaining({ message: "Asset loading failed" }),
    );
    expect(handle.status).toBe("ready");
    expect(handle.error).toBeUndefined();
    expect(fallback.release).toHaveBeenCalledTimes(1);
  } finally {
    store.dispose();
  }
});

it("normalizes a deadline spent on the custom fallback before committing the built-in fallback", async () => {
  const custom = deferred<AssetResource>();
  const late = resource({ width: 8 });
  const initial = new Error("initial load failed");
  const { assets, store, diagnostics } = fixture(
    {
      load: async () => {
        throw initial;
      },
      fallback: (_kind, url) =>
        url ? custom.promise : Promise.resolve(resource({ width: 2 })),
    },
    { fallback: { image: "/custom" } },
  );
  try {
    const handle = assets.load({
      kind: "image",
      url: "/deadline",
      timeoutMs: 5,
    });
    const observed: unknown[] = [];
    handle.onChange((asset) => observed.push(asset.error));
    await handle.ready;
    expect(observed[0]).toMatchObject({
      code: "ASSET_TIMEOUT",
      cause: initial,
    });
    expect(
      diagnostics.find((entry) => entry.code === "ASSET_FALLBACK")?.cause,
    ).toBe(observed[0]);
    custom.resolve(late);
    await Promise.resolve();
    expect(late.release).toHaveBeenCalledTimes(1);
  } finally {
    store.dispose();
  }
});
