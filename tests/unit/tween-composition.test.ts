import { Lifetime, Tween, TweenScheduler } from "@simpludify/core";
import { expect, it } from "vitest";

it("disposing one future child owner cancels the entire composite and releases all claims", () => {
  const a = new Lifetime(),
    b = new Lifetime(),
    clock = new TweenScheduler(),
    state = { x: 0, y: 0 };
  let completed = 0;
  const x = Tween.bind({
      target: state,
      key: "x",
      owner: a,
      read: () => state.x,
      write: (v) => {
        state.x = v;
      },
    }),
    y = Tween.bind({
      target: state,
      key: "y",
      owner: b,
      read: () => state.y,
      write: (v) => {
        state.y = v;
      },
    });
  const p = clock.play(
    Tween.sequence(
      Tween.to(x, 1, { duration: 1 }),
      Tween.to(y, 1, { duration: 1 }),
    ),
    {
      onComplete: () => {
        completed++;
      },
    },
  );
  clock.advance(0.5);
  b.dispose();
  clock.advance(2);
  expect(state).toEqual({ x: 0.5, y: 0 });
  expect(p.state).toBe("cancelled");
  expect(completed).toBe(0);
  expect(clock.diagnostics.active).toBe(0);
  a.dispose();
});
it("replacement observer errors do not strand the new reservation", () => {
  const clock = new TweenScheduler(),
    state = { x: 0 },
    b = Tween.property(state, "x");
  const old = clock.play(Tween.to(b, 1, { duration: 1 }), {
    onCancel: () => {
      throw Error("observer");
    },
  });
  expect(() => clock.play(Tween.to(b, 2, { duration: 1 }))).toThrow(
    AggregateError,
  );
  expect(old.state).toBe("cancelled");
  expect(clock.diagnostics.active).toBe(0);
  const next = clock.play(Tween.to(b, 3, { duration: 0 }), {
    conflict: "error",
  });
  clock.advance(0);
  expect(next.state).toBe("completed");
  expect(state.x).toBe(3);
});
it("recursive finish is rejected without interrupting independent due work", () => {
  const clock = new TweenScheduler(),
    state = { x: 0, y: 0 };
  let p: ReturnType<TweenScheduler["play"]>;
  const b = Tween.bind({
    target: state,
    key: "x",
    read: () => state.x,
    write: (v) => {
      state.x = v;
      p.finish();
    },
  });
  p = clock.play(Tween.to(b, 1, { duration: 1 }));
  clock.play(Tween.to(Tween.property(state, "y"), 2, { duration: 1 }));
  expect(() => clock.advance(0.5)).toThrow();
  expect(p.reason).toBe("error");
  expect(state.y).toBe(1);
});
it("an easing callback cannot overwrite an externally replaced current channel", () => {
  const clock = new TweenScheduler(),
    state = { x: 0 };
  const p = clock.play(
    Tween.to(Tween.property(state, "x"), 1, {
      duration: 1,
      easing: () => {
        state.x = 77;
        return 0.5;
      },
    }),
  );
  clock.advance(0.5);
  expect(state.x).toBe(77);
  expect(p.reason).toBe("external-write");
});
it("depth, node count and duration overflow reject before claiming a target", () => {
  const clock = new TweenScheduler(),
    state = { x: 0 };
  let deep = Tween.to(Tween.property(state, "x"), 1, { duration: 1 });
  for (let i = 0; i < 65; i++) deep = Tween.sequence(deep);
  expect(() => clock.play(deep)).toThrow();
  expect(() =>
    clock.play(
      Tween.parallel(...Array.from({ length: 4097 }, () => Tween.delay(1))),
    ),
  ).toThrow();
  expect(() =>
    clock.play(Tween.sequence(Tween.delay(1e308), Tween.delay(1e308))),
  ).toThrow();
  expect(clock.diagnostics.active).toBe(0);
});
it("finite group finish respects final yoyo parity and nested delay endpoints", () => {
  const clock = new TweenScheduler(),
    state = { x: 0, y: 0 };
  const p = clock.play(
    Tween.sequence(
      Tween.delay(3),
      Tween.parallel(
        Tween.to(Tween.property(state, "x"), 10, {
          duration: 1,
          repeat: 1,
          yoyo: true,
        }),
        Tween.to(Tween.property(state, "y"), 20, { duration: 2 }),
      ),
      Tween.to(Tween.property(state, "x"), 5, { duration: 1 }),
    ),
  );
  p.finish();
  expect(state).toEqual({ x: 5, y: 20 });
  expect(p.state).toBe("completed");
  expect(clock.diagnostics.active).toBe(0);
});
it("finished batches unsubscribe from their owner and release all distinct channels", () => {
  const owner = new Lifetime(),
    clock = new TweenScheduler({ owner }),
    states = Array.from({ length: 1000 }, () => ({ value: 0 }));
  for (const state of states)
    clock.play(Tween.to(Tween.property(state, "value"), 1, { duration: 1 }));
  clock.advance(1);
  expect(states.every((s) => s.value === 1)).toBe(true);
  expect(clock.diagnostics.active).toBe(0);
  const callbacks = (owner as unknown as { callbacks: Set<() => void> })
    .callbacks;
  expect(callbacks.size).toBe(1);
  clock.dispose();
  expect(callbacks.size).toBe(0);
  owner.dispose();
});
it("asynchronous setters are diagnosed and claims are released before completion", () => {
  const clock = new TweenScheduler(),
    state = { x: 0 };
  let completed = 0;
  const b = Tween.bind({
      target: state,
      key: "x",
      read: () => state.x,
      write: async () => {},
    }),
    p = clock.play(Tween.to(b, 1, { duration: 1 }), {
      onComplete: () => {
        completed++;
      },
    });
  expect(() => clock.advance(0.5)).toThrow();
  expect(p.reason).toBe("error");
  expect(completed).toBe(0);
  expect(clock.diagnostics.active).toBe(0);
});
it("consumes and rejects asynchronous capability hooks, easing and watch setup without leaked claims", async () => {
  const rejected = () => Promise.reject(Error("unsupported async hook"));
  for (const hook of ["read", "valid", "scope", "stamp", "watch"] as const) {
    const clock = new TweenScheduler({ scope: {} }),
      state = { x: 0 };
    const binding = Tween.bind({
      target: state,
      key: "x",
      read: () => state.x,
      write: (v) => {
        state.x = v;
      },
      ...({ [hook]: rejected } as object),
    });
    expect(() => clock.play(Tween.to(binding, 1, { duration: 1 }))).toThrow();
    expect(clock.diagnostics.active).toBe(0);
    clock.dispose();
  }
  const clock = new TweenScheduler(),
    state = { x: 0 };
  const p = clock.play(
    Tween.to(Tween.property(state, "x"), 1, {
      duration: 1,
      easing: rejected as unknown as (x: number) => number,
    }),
  );
  expect(() => clock.advance(0.5)).toThrow();
  expect(p.reason).toBe("error");
  expect(clock.diagnostics.active).toBe(0);
  await Promise.resolve();
  clock.dispose();
});
