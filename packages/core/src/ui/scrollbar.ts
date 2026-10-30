import { containsUI, intersectUI } from "./canvas-layout";
import type { CanvasNode, UIBounds } from "./canvas-node";
export type ScrollbarAxis = "vertical" | "horizontal";
export interface CanvasScrollbar {
  readonly node: CanvasNode;
  readonly axis: ScrollbarAxis;
  readonly track: UIBounds;
  readonly thumb: UIBounds;
  readonly enabled: boolean;
}
const empty: readonly CanvasScrollbar[] = Object.freeze([]);
/** Overlay geometry, independent of layout metrics and Renderer objects. */
export function canvasScrollbars(node: CanvasNode): readonly CanvasScrollbar[] {
  const s = node.style,
    b = node.bounds;
  if (!s.scroll || s.scrollbar === "hidden") return empty;
  for (let p: CanvasNode | undefined = node; p; p = p.parent)
    if (p.disposed || !p.visible) return empty;
  const axes: ScrollbarAxis[] =
    s.scroll === "both" ? ["vertical", "horizontal"] : [s.scroll];
  const result: CanvasScrollbar[] = [];
  for (const axis of axes) {
    const vertical = axis === "vertical",
      maximum = vertical ? node.maxScrollY : node.maxScrollX;
    if (maximum === 0 && s.scrollbar !== "always") continue;
    const corner = s.scroll === "both" ? 10 : 0;
    const track = vertical
      ? {
          x: b.x + Math.max(0, b.width - 10),
          y: b.y + 2,
          width: Math.min(8, b.width),
          height: Math.max(0, b.height - 4 - corner),
        }
      : {
          x: b.x + 2,
          y: b.y + Math.max(0, b.height - 10),
          width: Math.max(0, b.width - 4 - corner),
          height: Math.min(8, b.height),
        };
    const length = vertical ? track.height : track.width,
      viewport = vertical ? b.height : b.width;
    const thumbLength =
      maximum > 0
        ? Math.min(
            length,
            Math.max(24, (length * viewport) / (viewport + maximum)),
          )
        : length;
    const offset =
      (maximum > 0 ? (vertical ? node.scrollY : node.scrollX) / maximum : 0) *
      (length - thumbLength);
    const thumb = vertical
      ? { ...track, y: track.y + offset, height: thumbLength }
      : { ...track, x: track.x + offset, width: thumbLength };
    result.push({
      node,
      axis,
      track,
      thumb,
      enabled: node.available && maximum > 0 && length > thumbLength,
    });
  }
  return result;
}
/** Minimum 24 Host-unit cross-axis hit region, intersected with the node/ancestor clip. */
export function scrollbarContains(
  bar: CanvasScrollbar,
  x: number,
  y: number,
  scale: number,
  clip: UIBounds,
  thumb = false,
): boolean {
  const b = thumb ? bar.thumb : bar.track;
  const pad =
    bar.axis === "vertical"
      ? Math.max(0, (24 / scale - b.width) / 2)
      : Math.max(0, (24 / scale - b.height) / 2);
  const hit =
    bar.axis === "vertical"
      ? { x: b.x - pad, y: b.y, width: b.width + 2 * pad, height: b.height }
      : { x: b.x, y: b.y - pad, width: b.width, height: b.height + 2 * pad };
  return containsUI(intersectUI(hit, clip), x, y);
}
