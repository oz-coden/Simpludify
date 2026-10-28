import type { Texture } from "pixi.js";
import { expect, it, vi } from "vitest";
import {
  type ImageResource,
  SharedImages,
} from "../../packages/web/src/shared-images";

function fixture() {
  const requests: Array<{
    url: string;
    signal: AbortSignal;
    resolve(resource: ImageResource): void;
    reject(error: unknown): void;
  }> = [];
  const pool = new SharedImages(
    (url, signal) =>
      new Promise((resolve, reject) => {
        requests.push({ url, signal, resolve, reject });
      }),
  );
  const resource = () => ({ texture: {} as Texture, release: vi.fn() });
  const acquire = (url = "hero") => {
    const controller = new AbortController();
    const promise = pool.acquire(url, controller.signal);
    return { controller, promise };
  };
  return { pool, requests, resource, acquire };
}
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const empty = { imageReferences: 0, imageEntries: 0, pendingImages: 0 };

it("coalesces 100 pending consumers and keeps one resource until the last lease", async () => {
  const f = fixture();
  const users = Array.from({ length: 100 }, () => f.acquire());
  await tick();
  expect(f.requests).toHaveLength(1);
  expect(f.pool.diagnostics).toEqual({
    imageReferences: 100,
    imageEntries: 1,
    pendingImages: 1,
  });
  const image = f.resource();
  f.requests[0]?.resolve(image);
  const leases = await Promise.all(users.map((u) => u.promise));
  expect(new Set(leases.map((lease) => lease.texture)).size).toBe(1);
  for (const lease of leases.slice(0, 99)) {
    lease.release();
    lease.release();
  }
  expect(image.release).not.toHaveBeenCalled();
  const cached = await f.acquire().promise;
  expect(cached.texture).toBe(image.texture);
  expect(f.requests).toHaveLength(1);
  leases[99]?.release();
  expect(image.release).not.toHaveBeenCalled();
  cached.release();
  expect(image.release).toHaveBeenCalledTimes(1);
  expect(f.pool.diagnostics).toEqual(empty);
  const again = f.acquire();
  await tick();
  expect(f.requests).toHaveLength(2);
  again.controller.abort();
  await expect(again.promise).rejects.toMatchObject({ code: "GAME_DISPOSED" });
  f.pool.dispose();
});

it("cancels only the removed waiter and aborts loading only at the last reference", async () => {
  const f = fixture(),
    a = f.acquire(),
    b = f.acquire();
  const cancelled = expect(a.promise).rejects.toMatchObject({
    code: "GAME_DISPOSED",
  });
  await tick();
  a.controller.abort();
  await cancelled;
  expect(f.requests[0]?.signal.aborted).toBe(false);
  const image = f.resource();
  f.requests[0]?.resolve(image);
  const lease = await b.promise;
  expect(lease.texture).toBe(image.texture);
  // A settled request is now an explicit lease, not a pending signal subscription.
  b.controller.abort();
  expect(image.release).not.toHaveBeenCalled();
  lease.release();
  expect(image.release).toHaveBeenCalledTimes(1);
  expect(f.pool.diagnostics).toEqual(empty);
});

it("settles cancelled waits promptly, disposes late resources and isolates a replacement entry", async () => {
  const f = fixture(),
    old = f.acquire();
  const rejected = expect(old.promise).rejects.toMatchObject({
    code: "GAME_DISPOSED",
  });
  await tick();
  old.controller.abort();
  await rejected;
  expect(f.requests[0]?.signal.aborted).toBe(true);
  expect(f.pool.diagnostics).toEqual(empty);
  const next = f.acquire();
  await tick();
  const stale = f.resource(),
    current = f.resource();
  f.requests[1]?.resolve(current);
  const lease = await next.promise;
  f.requests[0]?.resolve(stale);
  await tick();
  expect(stale.release).toHaveBeenCalledTimes(1);
  expect(current.release).not.toHaveBeenCalled();
  expect(f.pool.diagnostics.imageReferences).toBe(1);
  lease.release();
  expect(current.release).toHaveBeenCalledTimes(1);
});

it("propagates one failure to all current waiters, evicts it, and allows an explicit new acquisition", async () => {
  const f = fixture(),
    a = f.acquire(),
    b = f.acquire();
  const results = Promise.allSettled([a.promise, b.promise]);
  await tick();
  const failure = new Error("decode failed");
  f.requests[0]?.reject(failure);
  expect(await results).toEqual([
    { status: "rejected", reason: failure },
    { status: "rejected", reason: failure },
  ]);
  expect(f.pool.diagnostics).toEqual(empty);
  const retry = f.acquire();
  await tick();
  expect(f.requests).toHaveLength(2);
  f.requests[1]?.resolve(f.resource());
  (await retry.promise).release();
  expect(f.pool.diagnostics).toEqual(empty);
});

it("does not conflate different keys and does not let an old rejection evict a new entry", async () => {
  const f = fixture(),
    a = f.acquire("a"),
    b = f.acquire("b");
  const cancelled = a.promise.catch(() => {});
  await tick();
  a.controller.abort();
  await cancelled;
  const next = f.acquire("a");
  await tick();
  f.requests[0]?.reject(new Error("late abort"));
  await tick();
  expect(f.pool.diagnostics).toEqual({
    imageReferences: 2,
    imageEntries: 2,
    pendingImages: 2,
  });
  f.requests[1]?.resolve(f.resource());
  f.requests[2]?.resolve(f.resource());
  (await b.promise).release();
  (await next.promise).release();
  expect(f.pool.diagnostics).toEqual(empty);
});

it("disposes committed and pending uses, rejects future work and tolerates late completion", async () => {
  const f = fixture(),
    a = f.acquire("ready"),
    b = f.acquire("pending");
  const cancelled = expect(b.promise).rejects.toMatchObject({
    code: "GAME_DISPOSED",
  });
  await tick();
  const ready = f.resource(),
    late = f.resource();
  f.requests[0]?.resolve(ready);
  const lease = await a.promise;
  f.pool.dispose();
  f.pool.dispose();
  await cancelled;
  expect(ready.release).toHaveBeenCalledTimes(1);
  expect(f.requests[1]?.signal.aborted).toBe(true);
  f.requests[1]?.resolve(late);
  await tick();
  lease.release();
  expect(late.release).toHaveBeenCalledTimes(1);
  await expect(f.acquire().promise).rejects.toMatchObject({
    code: "GAME_DISPOSED",
  });
  expect(f.pool.diagnostics).toEqual(empty);
});

it("handles a synchronous loader error and already-aborted consumers without leaking", async () => {
  const failure = new Error("sync load failure"),
    load = vi.fn(() => {
      throw failure;
    });
  const pool = new SharedImages(load),
    controller = new AbortController();
  await expect(pool.acquire("a", controller.signal)).rejects.toBe(failure);
  expect(pool.diagnostics).toEqual(empty);
  controller.abort();
  await expect(pool.acquire("a", controller.signal)).rejects.toMatchObject({
    code: "GAME_DISPOSED",
  });
  expect(load).toHaveBeenCalledTimes(1);
});
