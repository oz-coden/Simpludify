import { Easing, Lifetime, Tween, TweenScheduler } from "@simpludify/core";
import { expect, it } from "vitest";

function fixture() {
  const state = { x: 0, y: 0 },
    clock = new TweenScheduler(),
    x = Tween.property(state, "x"),
    y = Tween.property(state, "y");
  return { state, clock, x, y };
}
it.each(Object.entries(Easing))(
  "%s easing has finite bounded exact endpoints",
  (_, ease) => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = ease(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  },
);
it("uses explicit time, delay, easing, exact endpoints and deferred completion", () => {
  const f = fixture();
  let complete = 0;
  const p = f.clock.play(
    Tween.to(f.x, 8, { duration: 1, delay: 0.5, easing: Easing.InCubic }),
    {
      onComplete: () => {
        complete++;
      },
    },
  );
  expect(f.state.x).toBe(0);
  f.clock.advance(0.25);
  expect(f.state.x).toBe(0);
  f.clock.advance(0.75);
  expect(f.state.x).toBe(1);
  f.clock.advance(0.5);
  expect(f.state.x).toBe(8);
  expect(p.state).toBe("completed");
  expect(complete).toBe(1);
  expect(f.clock.diagnostics.active).toBe(0);
  p.finish();
  p.cancel();
  f.clock.advance(1);
  expect(complete).toBe(1);
});
it("pause, resume and clock speed preserve elapsed time and ownership", () => {
  const f = fixture(),
    p = f.clock.play(Tween.to(f.x, 10, { duration: 1 }));
  f.clock.speed = 2;
  f.clock.advance(0.25);
  expect(f.state.x).toBe(5);
  p.pause();
  f.clock.advance(1);
  expect(p.elapsed).toBe(0.5);
  p.resume();
  f.clock.speed = 0;
  f.clock.advance(1);
  expect(f.state.x).toBe(5);
  f.clock.speed = 1;
  f.clock.advance(0.5);
  expect(f.state.x).toBe(10);
});
it("cancel and stop retain values, finish skips finite delay and notifies once", () => {
  const f = fixture(),
    events: string[] = [];
  const a = f.clock.play(Tween.to(f.x, 10, { duration: 1 }), {
    onCancel: (r) => events.push(r),
    onComplete: () => events.push("complete"),
  });
  f.clock.advance(0.2);
  a.cancel();
  a.cancel();
  expect(f.state.x).toBe(2);
  expect(events).toEqual(["cancelled"]);
  const b = f.clock.play(Tween.to(f.x, 20, { duration: 1 }), {
    onCancel: (r) => events.push(r),
  });
  b.stop();
  expect(events.at(-1)).toBe("stopped");
  const c = f.clock.play(Tween.to(f.x, 30, { duration: 1, delay: 10 }), {
    onComplete: () => events.push("complete"),
  });
  c.pause();
  c.finish();
  expect(f.state.x).toBe(30);
  expect(c.state).toBe("completed");
  expect(events.filter((v) => v === "complete")).toHaveLength(1);
});
it("zero duration performs one deferred terminal write even with finite repeat", () => {
  const f = fixture();
  let complete = 0;
  const p = f.clock.play(
    Tween.to(f.x, 10, { duration: 0, repeat: 200, yoyo: true }),
    {
      onComplete: () => {
        complete++;
      },
    },
  );
  expect(f.state.x).toBe(0);
  f.clock.advance(0);
  expect(f.state.x).toBe(10);
  expect(p.state).toBe("completed");
  expect(complete).toBe(1);
});
it("repeat resets at cycle boundaries while yoyo reverses and finishes at parity endpoint", () => {
  const f = fixture();
  f.clock.play(Tween.to(f.x, 10, { duration: 1, repeat: 1 }));
  f.clock.advance(1);
  expect(f.state.x).toBe(0);
  f.clock.advance(1);
  expect(f.state.x).toBe(10);
  f.state.x = 0;
  f.clock.play(Tween.to(f.x, 10, { duration: 1, repeat: 1, yoyo: true }));
  for (const value of [5, 10, 5, 0]) {
    f.clock.advance(0.5);
    expect(f.state.x).toBe(value);
  }
});
it("infinite cycles and huge deltas use bounded arithmetic and reject impossible finish", () => {
  const f = fixture(),
    p = f.clock.play(
      Tween.to(f.x, 1, { duration: 1, repeat: Infinity, yoyo: true }),
    );
  f.clock.advance(10_000_000.25);
  expect(f.state.x).toBe(0.25);
  expect(() => p.finish()).toThrow();
  p.cancel();
  const h = f.clock.play(Tween.to(f.x, 1e308, { from: -1e308, duration: 1 }));
  f.clock.advance(0.5);
  expect(f.state.x).toBe(0);
  h.finish();
  expect(f.state.x).toBe(1e308);
});
it("sequence uses leftover time and captures implicit starts on entry; parallel uses longest duration", () => {
  const f = fixture(),
    p = f.clock.play(
      Tween.sequence(
        Tween.to(f.x, 10, { duration: 1 }),
        Tween.delay(0.5),
        Tween.parallel(
          Tween.to(f.x, 20, { duration: 1 }),
          Tween.to(f.y, 6, { duration: 2 }),
        ),
      ),
    );
  f.clock.advance(2);
  expect(f.state).toEqual({ x: 15, y: 1.5 });
  f.clock.advance(1.5);
  expect(f.state).toEqual({ x: 20, y: 6 });
  expect(p.state).toBe("completed");
});
it("composition finish/cancel owns every child and disallows overlapping parallel channels", () => {
  const f = fixture();
  expect(() =>
    f.clock.play(
      Tween.parallel(
        Tween.to(f.x, 1, { duration: 1 }),
        Tween.sequence(
          Tween.delay(2),
          Tween.to(Tween.property(f.state, "x"), 2, { duration: 1 }),
        ),
      ),
    ),
  ).toThrow();
  const p = f.clock.play(
    Tween.sequence(
      Tween.to(f.x, 5, { duration: 1 }),
      Tween.to(f.x, 9, { duration: 1 }),
    ),
  );
  p.finish();
  expect(f.state.x).toBe(9);
  expect(f.clock.diagnostics.active).toBe(0);
  const q = f.clock.play(
    Tween.parallel(
      Tween.to(f.x, 1, { duration: 1 }),
      Tween.to(f.y, 1, { duration: 1 }),
    ),
  );
  q.cancel();
  f.clock.advance(1);
  expect(f.state).toEqual({ x: 9, y: 0 });
});
it("replacement is global across schedulers and conflict-error does not cancel existing playback", () => {
  const f = fixture(),
    other = new TweenScheduler(),
    a = f.clock.play(Tween.to(f.x, 10, { duration: 1 }));
  expect(() =>
    other.play(Tween.to(f.x, 20, { duration: 1 }), { conflict: "error" }),
  ).toThrow();
  expect(a.state).toBe("playing");
  const b = other.play(
    Tween.to(Tween.property(f.state, "x"), 20, { duration: 1 }),
  );
  expect(a.reason).toBe("replaced");
  f.clock.advance(1);
  expect(f.state.x).toBe(0);
  other.advance(1);
  expect(f.state.x).toBe(20);
  expect(b.state).toBe("completed");
});
it("newer reentrant replacement wins without resurrecting the intermediate playback", () => {
  const f = fixture();
  let newest: ReturnType<TweenScheduler["play"]> | undefined;
  f.clock.play(Tween.to(f.x, 1, { duration: 1 }), {
    onCancel: () => {
      newest = f.clock.play(Tween.to(f.x, 3, { duration: 1 }));
    },
  });
  const intermediate = f.clock.play(Tween.to(f.x, 2, { duration: 1 }));
  expect(intermediate.state).toBe("cancelled");
  f.clock.advance(1);
  expect(f.state.x).toBe(3);
  expect(newest?.state).toBe("completed");
});
it("external writes cancel before overwrite; active callbacks can cancel without later parallel writes", () => {
  const f = fixture(),
    p = f.clock.play(Tween.to(f.x, 10, { duration: 1 }));
  f.state.x = 7;
  f.clock.advance(0.5);
  expect(p.reason).toBe("external-write");
  expect(f.state.x).toBe(7);
  let q: ReturnType<TweenScheduler["play"]>;
  const binding = Tween.bind({
    target: f.state,
    key: "x",
    read: () => f.state.x,
    write: (v) => {
      f.state.x = v;
      q.cancel();
    },
  });
  q = f.clock.play(
    Tween.parallel(
      Tween.to(binding, 10, { duration: 1 }),
      Tween.to(f.y, 10, { duration: 1 }),
    ),
  );
  f.clock.advance(0.5);
  expect(q.state).toBe("cancelled");
  expect(f.state.y).toBe(0);
});
it("setter changes to a later channel are never overwritten", () => {
  const f = fixture(),
    b = Tween.bind({
      target: f.state,
      key: "x",
      read: () => f.state.x,
      write: (v) => {
        f.state.x = v;
        f.state.y = 99;
      },
    });
  const p = f.clock.play(
    Tween.parallel(
      Tween.to(b, 1, { duration: 1 }),
      Tween.to(f.y, 1, { duration: 1 }),
    ),
  );
  f.clock.advance(0.5);
  expect(p.reason).toBe("external-write");
  expect(f.state.y).toBe(99);
});
it("owner and scheduler disposal cancel once and clear all claims; finish cannot write during owner destruction", () => {
  const f = fixture(),
    owner = new Lifetime(),
    clock = new TweenScheduler({ owner });
  let cancelled = 0;
  const p = clock.play(Tween.to(f.x, 1, { duration: 1 }), {
    onCancel: () => {
      cancelled++;
    },
  });
  owner.onDispose(() => p.finish());
  owner.dispose();
  expect(f.state.x).toBe(0);
  expect(p.state).toBe("cancelled");
  expect(cancelled).toBe(1);
  expect(clock.diagnostics.active).toBe(0);
  expect(() =>
    f.clock.play(Tween.to(f.x, 2, { duration: 0 }), { conflict: "error" }),
  ).not.toThrow();
});
it("callback failures release resources, run other due work, and additions wait until next clock boundary", () => {
  const f = fixture();
  let extra: ReturnType<TweenScheduler["play"]> | undefined;
  f.clock.play(Tween.to(f.x, 1, { duration: 0 }), {
    onComplete: () => {
      extra = f.clock.play(Tween.to(f.x, 3, { duration: 0 }));
      throw Error("observer");
    },
  });
  f.clock.play(Tween.to(f.y, 2, { duration: 0 }));
  expect(() => f.clock.advance(0)).toThrow(AggregateError);
  expect(f.state).toEqual({ x: 1, y: 2 });
  expect(extra?.state).toBe("playing");
  f.clock.advance(0);
  expect(f.state.x).toBe(3);
});
it("recursive advance/finish is rejected and async callbacks are diagnosed after cleanup", () => {
  const f = fixture();
  f.clock.play(Tween.to(f.x, 1, { duration: 0 }), {
    onComplete: () => f.clock.advance(0),
  });
  expect(() => f.clock.advance(0)).toThrow();
  expect(f.clock.diagnostics.active).toBe(0);
  f.clock.play(Tween.to(f.x, 2, { duration: 0 }), {
    onComplete: async () => {},
  });
  expect(() => f.clock.advance(0)).toThrow();
  expect(f.clock.diagnostics.active).toBe(0);
});
it("paused callbacks suppress remaining tracks until resume", () => {
  const f = fixture();
  let p: ReturnType<TweenScheduler["play"]>;
  const b = Tween.bind({
    target: f.state,
    key: "x",
    read: () => f.state.x,
    write: (v) => {
      f.state.x = v;
      p.pause();
    },
  });
  p = f.clock.play(
    Tween.parallel(
      Tween.to(b, 1, { duration: 1 }),
      Tween.to(f.y, 1, { duration: 1 }),
    ),
  );
  f.clock.advance(1);
  expect(f.state.y).toBe(0);
  expect(p.state).toBe("paused");
  p.resume();
  f.clock.advance(0);
  expect(f.state.y).toBe(1);
  expect(p.state).toBe("completed");
});
it.each([-1, NaN, Infinity, -Infinity])(
  "rejects invalid duration/delay/delta/speed %s atomically",
  (value) => {
    const f = fixture(),
      p = f.clock.play(Tween.to(f.x, 1, { duration: 1 }));
    expect(() => Tween.to(f.x, 1, { duration: value })).toThrow();
    expect(() => Tween.delay(value)).toThrow();
    expect(() => f.clock.advance(value)).toThrow();
    expect(() => {
      f.clock.speed = value;
    }).toThrow();
    expect(p.elapsed).toBe(0);
    expect(f.state.x).toBe(0);
  },
);
it("rejects unsafe data, unknown recipes/settings, nonfinite easing and out-of-scope bindings", () => {
  const f = fixture();
  for (const target of [
    new Date(),
    Object.freeze({ x: 1 }),
    {
      get x() {
        return 1;
      },
    },
  ])
    expect(() => Tween.property(target, "x" as never)).toThrow();
  expect(() => Tween.to(f.x, Infinity, { duration: 1 })).toThrow();
  expect(() => Tween.to(f.x, 1, { duration: 0, repeat: Infinity })).toThrow();
  expect(() => f.clock.play({ kind: "delay", duration: 1 })).toThrow();
  expect(() =>
    f.clock.play(
      Tween.sequence(
        Tween.to(f.x, 1, { duration: 1, repeat: Infinity }),
        Tween.delay(1),
      ),
    ),
  ).toThrow();
  const b = Tween.bind({
    target: f.state,
    key: "x",
    read: () => f.state.x,
    write: (v) => {
      f.state.x = v;
    },
    scope: () => ({}),
  });
  expect(() =>
    new TweenScheduler({ scope: {} }).play(Tween.to(b, 1, { duration: 1 })),
  ).toThrow();
  const p = f.clock.play(Tween.to(f.x, 1, { duration: 1, easing: () => NaN }));
  expect(() => f.clock.advance(0.5)).toThrow();
  expect(p.reason).toBe("error");
  expect(f.state.x).toBe(0);
});
it("identical explicit step inputs produce identical results across clocks", () => {
  const runs = () => {
    const f = fixture();
    f.clock.play(
      Tween.sequence(
        Tween.to(f.x, 10, { duration: 0.3, easing: Easing.OutCubic }),
        Tween.to(f.x, -3, { duration: 0.7, repeat: 2, yoyo: true }),
      ),
    );
    return [0.1, 0.07, 0.13, 0.3, 0.2, 0.4, 0.8, 0.4].map((dt) => {
      f.clock.advance(dt);
      return f.state.x;
    });
  };
  expect(runs()).toEqual(runs());
});
