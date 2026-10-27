import {
  DEFAULT_RANDOM_STREAM,
  deriveStreamSeed,
  Engine,
  RandomManager,
  Scene,
} from "@simpludify/core";
import { expect, it, vi } from "vitest";

it("preserves the specified LCG sequence and distinguishes seed from state", () => {
  const random = new RandomManager(42);
  expect(random.next()).toBe(1083814273 / 4294967296);
  expect(random.next()).toBe(378494188 / 4294967296);
  expect(random.seed).toBe(42);
  expect(random.stream(DEFAULT_RANDOM_STREAM).state).toBe(378494188);
  expect(random.snapshot().streams[0]?.calls).toBe(2);
});
it("uses exact UTF-16 LE FNV seed derivation with independent named consumption", () => {
  const a = new RandomManager(123),
    b = new RandomManager(123);
  const enemy = a.stream("enemy"),
    loot = a.stream("loot");
  const otherLoot = b.stream("loot"),
    otherEnemy = b.stream("enemy");
  expect(a.stream("enemy")).toBe(enemy);
  expect(enemy.seed).toBe(deriveStreamSeed(123, "enemy"));
  for (let i = 0; i < 100; i++) expect(enemy.next()).toBe(otherEnemy.next());
  expect(loot.next()).toBe(otherLoot.next());
  expect(a.next()).toBe(b.next());
  expect(a.stream("日本語🙂").next()).toBe(b.stream("日本語🙂").next());
  const saved = a.snapshot();
  a.next();
  expect(saved).not.toEqual(a.snapshot());
});
it("reproduces automatically generated seeds and supports portable fallback", () => {
  const generated = new RandomManager();
  expect(new RandomManager(generated.seed).next()).toBe(generated.next());
  vi.stubGlobal("crypto", undefined);
  const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
  try {
    expect(new RandomManager().seed).toBe(2147483648);
  } finally {
    spy.mockRestore();
    vi.unstubAllGlobals();
  }
});
it("uses the host Crypto capability when available and falls back after a host failure", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: (a: Uint32Array) => {
      a[0] = 123;
      return a;
    },
  });
  try {
    expect(new RandomManager().seed).toBe(123);
  } finally {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("crypto", {
    getRandomValues: () => {
      throw Error("unavailable");
    },
  });
  try {
    expect(new RandomManager().seed).toBeGreaterThanOrEqual(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps Engine streams across Scenes and disposes retained handles", () => {
  const engine = new Engine({ seed: 7 }),
    reference = new RandomManager(7),
    stream = engine.random.stream("enemy");
  expect(stream.next()).toBe(reference.stream("enemy").next());
  engine.activate(new Scene("next"));
  expect(engine.random.stream("enemy")).toBe(stream);
  expect(stream.next()).toBe(reference.stream("enemy").next());
  engine.dispose();
  expect(engine.random.seed).toBe(7);
  expect(() => stream.next()).toThrow(/disposed/);
  expect(() => engine.random.next()).toThrow();
  expect(() => engine.random.stream("new")).toThrow();
  expect(engine.snapshot().random.seed).toBe(7);
  engine.dispose();
});
it("rejects ambiguous seeds and invalid stream names", () => {
  for (const seed of [-1, 2 ** 32, 0.1, NaN, Infinity])
    expect(() => new RandomManager(seed)).toThrow();
  const random = new RandomManager(0);
  expect(() => random.stream("")).toThrow();
  expect(() => random.stream("a".repeat(257))).toThrow();
});

it("pins cross-host named seed fixtures independently of the implementation", () => {
  expect(deriveStreamSeed(123, "enemy")).toBe(332427948);
  expect(deriveStreamSeed(123, "loot")).toBe(1125229326);
  expect(deriveStreamSeed(123, "日本語🙂")).toBe(4133938996);
  expect(deriveStreamSeed(0, "map")).toBe(3428071641);
});
