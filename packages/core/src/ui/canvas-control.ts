import type { CanvasNode, UIBounds } from "./canvas-node";
import type { CanvasNativeControl } from "./native-edit";

export type CanvasActivation = "pointer" | "keyboard" | "accessibility";
export type CanvasControlModel =
  | {
      readonly kind: "checkbox";
      readonly checked: boolean;
      readonly readOnly: boolean;
    }
  | {
      readonly kind: "slider";
      readonly value: number;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly ratio: number;
      readonly readOnly: boolean;
    }
  | {
      readonly kind: "select";
      readonly options: readonly {
        readonly label: string;
        readonly disabled: boolean;
      }[];
      readonly selectedIndex: number;
      readonly readOnly: boolean;
    }
  | {
      readonly kind: "text";
      readonly text: string;
      readonly placeholder: string;
      readonly maxLength: number | undefined;
      readonly inputMode: "text" | "decimal";
      readonly numeric?: Readonly<{
        value: number;
        min: number;
        max: number;
        step: number;
      }>;
      readonly readOnly: boolean;
    };
/** Core control commands/data consumed by input routing and Host presentations. Coordinates are UI units. */
export interface CanvasControlPort {
  readonly model: CanvasControlModel;
  readonly revision: number;
  readonly keys: readonly string[];
  readonly pointerAxis?: "horizontal";
  readonly native: CanvasNativeControl | undefined;
  key(code: string): void;
  beginPointer(x: number, y: number): boolean;
  movePointer(x: number, y: number): void;
  endPointer(cancelled: boolean): void;
}
/** Shared paint/input geometry; the whole node remains the clipped pointer hit area. */
export function canvasSliderGeometry(
  node: CanvasNode,
): { track: UIBounds; thumb: UIBounds } | undefined {
  const model = node.control?.model;
  if (model?.kind !== "slider") return;
  const b = node.bounds;
  const inset = Math.min(node.style.padding + 8, b.width / 2);
  const width = Math.max(0, b.width - inset * 2);
  const y =
    b.y + Math.max(0, Math.min(b.height, b.height - node.style.padding - 8));
  const radius = Math.min(8, b.height / 2, b.width / 2);
  return {
    track: { x: b.x + inset, y: y - 2, width, height: 4 },
    thumb: {
      x: b.x + inset + width * model.ratio - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2,
    },
  };
}
/** Hosts measure/paint this exact string. Slider size is fixed by style, so value changes are paint-only. */
export function canvasControlText(node: CanvasNode): string {
  const model = node.control?.model;
  return model?.kind === "slider"
    ? `${node.text}: ${model.value}`
    : model?.kind === "select"
      ? (model.options[model.selectedIndex]?.label ?? "")
      : model?.kind === "text"
        ? model.text || model.placeholder
        : node.text;
}
