/** Pure normalized easing functions. Custom easing must return a finite value in [0,1]. */
export type EasingFunction = (progress: number) => number;
export const Easing = Object.freeze({
  Linear: (t: number) => t,
  InQuad: (t: number) => t * t,
  OutQuad: (t: number) => t * (2 - t),
  InOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  InCubic: (t: number) => t ** 3,
  OutCubic: (t: number) => 1 - (1 - t) ** 3,
  InOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
});
