import type { CharacterState } from "./character";
import { EngineError, positive } from "./diagnostics";
export const Aspect = {
  Fit: "fit",
  Fill: "fill",
  Adaptive: "adaptive",
} as const;
export type Aspect = (typeof Aspect)[keyof typeof Aspect];
export interface WorldView {
  readonly width: number;
  readonly height: number;
  readonly aspect: Aspect;
}
export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
  worldWidth: number;
  worldHeight: number;
}
export function viewTransform(
  width: number,
  height: number,
  view: WorldView,
): ViewTransform {
  positive(width, "viewport width");
  positive(height, "viewport height");
  positive(view.width, "world width");
  positive(view.height, "world height");
  if (view.aspect === Aspect.Adaptive)
    return { scale: 1, x: 0, y: 0, worldWidth: width, worldHeight: height };
  if (view.aspect !== Aspect.Fit && view.aspect !== Aspect.Fill)
    throw new EngineError("INVALID_ASPECT", "Unknown aspect policy");
  const scale = (view.aspect === Aspect.Fit ? Math.min : Math.max)(
    width / view.width,
    height / view.height,
  );
  return {
    scale,
    x: (width - view.width * scale) / 2,
    y: (height - view.height * scale) / 2,
    worldWidth: view.width,
    worldHeight: view.height,
  };
}
export interface PreparedScene {
  render(): void;
  dispose(): void;
}
/** No host types: a future desktop host supplies these same services. */
export interface RendererPort {
  init(): Promise<void>;
  prepare(characters: readonly CharacterState[]): Promise<PreparedScene>;
  resize(width: number, height: number, view: WorldView): void;
  dispose(): void;
}
export interface FrameDriver {
  request(callback: (milliseconds: number) => void): number;
  cancel(handle: number): void;
}
