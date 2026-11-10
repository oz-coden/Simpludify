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
