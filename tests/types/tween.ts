import { CanvasPanel, Tween, TweenScheduler } from "@simpludify/core";

const state = { strength: 0, label: "glow" };
const clock = new TweenScheduler();
clock.play(Tween.to(Tween.property(state, "strength"), 1, { duration: 0.5 }));
// @ts-expect-error Only numeric properties can be bound.
Tween.property(state, "label");
const readonlyState: { readonly x: number } = { x: 0 };
// @ts-expect-error Readonly properties cannot be bound for mutation.
Tween.property(readonlyState, "x");
// @ts-expect-error Numeric recipes cannot interpolate booleans.
Tween.to(Tween.property(state, "strength"), true, { duration: 1 });
// @ts-expect-error Unknown playback policy is not accepted.
clock.play(Tween.delay(1), { conflict: "add" });
const panel = CanvasPanel();
// @ts-expect-error Presentation snapshots are immutable; use setPresentation or canvasTween.
panel.presentation.offsetX = 1;
