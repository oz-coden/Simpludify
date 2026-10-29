import { EngineError } from "@simpludify/core";
import type { CanvasNode, UIBounds, UISize } from "./canvas-node";
export interface UISizeValue {
  width: number;
  height: number;
}
export type MeasureText = (node: CanvasNode) => UISizeValue;
const finite = (v: number) => {
  if (!Number.isFinite(v) || v < 0)
    throw new EngineError("INVALID_UI", "UI layout overflow");
  return v;
};
const size = (v: UISize | undefined, parent: number): number | undefined =>
  v === undefined
    ? undefined
    : finite(
        typeof v === "number" ? v : (Number(v.slice(0, -1)) / 100) * parent,
      );
interface Item {
  node: CanvasNode;
  main: number;
  cross: number;
  explicitCross: boolean;
}
interface Line {
  items: Item[];
  main: number;
  cross: number;
}
/** A deliberately bounded Flex subset: no min/max, basis, margins, reverse or implicit text wrapping. */
export function layoutCanvas(
  root: CanvasNode,
  width: number,
  height: number,
  measure: MeasureText,
): number {
  finite(width);
  finite(height);
  let visited = 0;
  const naturalCache = new Map<CanvasNode, UISizeValue>();
  const natural = (node: CanvasNode, depth: number): UISizeValue => {
    if (depth > 64)
      throw new EngineError(
        "INVALID_UI",
        "UI trees support at most 64 nested levels",
      );
    const previous = naturalCache.get(node);
    if (previous) return previous;
    const s = node.style,
      pad = s.padding * 2;
    let w = 0,
      h = 0;
    if (node.kind !== "panel") ({ width: w, height: h } = measure(node));
    else {
      const children = node.children.filter((n) => n.visible && !n.disposed),
        row = s.direction === "row";
      for (const c of children) {
        const n = natural(c, depth + 1),
          cw = typeof c.style.width === "number" ? c.style.width : n.width,
          ch = typeof c.style.height === "number" ? c.style.height : n.height;
        w = row ? w + cw : Math.max(w, cw);
        h = row ? Math.max(h, ch) : h + ch;
      }
      if (row) w += Math.max(0, children.length - 1) * s.gap;
      else h += Math.max(0, children.length - 1) * s.gap;
    }
    const result = {
      width: finite(typeof s.width === "number" ? s.width : w + pad),
      height: finite(typeof s.height === "number" ? s.height : h + pad),
    };
    naturalCache.set(node, result);
    return result;
  };
  // Auto cross size of a wrapped container depends on its constrained main size.
  const constrained = (
    node: CanvasNode,
    aw: number,
    ah: number,
    stretchWidth: boolean,
    stretchHeight: boolean,
    depth: number,
  ): UISizeValue => {
    if (depth > 64)
      throw new EngineError(
        "INVALID_UI",
        "UI trees support at most 64 nested levels",
      );
    const s = node.style,
      n = natural(node, depth),
      row = s.direction === "row";
    let w = size(s.width, aw) ?? (stretchWidth ? aw : n.width),
      h = size(s.height, ah) ?? (stretchHeight ? ah : n.height);
    if (node.kind !== "panel") return { width: w, height: h };
    const cw = Math.max(0, w - s.padding * 2),
      ch = Math.max(0, h - s.padding * 2),
      main = row ? cw : ch;
    let used = 0,
      lineCross = 0,
      totalCross = 0,
      count = 0;
    for (const child of node.children) {
      if (!child.visible || child.disposed) continue;
      const align = child.style.alignSelf ?? s.align;
      const c = constrained(
        child,
        cw,
        ch,
        !row && align === "stretch" && child.style.width === undefined,
        row && align === "stretch" && child.style.height === undefined,
        depth + 1,
      );
      const m = row ? c.width : c.height,
        k = row ? c.height : c.width;
      if (s.wrap && count && used + s.gap + m > main) {
        totalCross += lineCross + s.gap;
        used = 0;
        lineCross = 0;
        count = 0;
      }
      used += (count ? s.gap : 0) + m;
      lineCross = Math.max(lineCross, k);
      count++;
    }
    if (s.wrap) {
      totalCross += lineCross + s.padding * 2;
      if (row && s.height === undefined && !stretchHeight) h = totalCross;
      if (!row && s.width === undefined && !stretchWidth) w = totalCross;
    } else if (!row && s.height === undefined && !stretchHeight) {
      h = used + s.padding * 2;
    }
    return { width: finite(w), height: finite(h) };
  };
  const arrange = (
    node: CanvasNode,
    x: number,
    y: number,
    w: number,
    h: number,
    depth: number,
  ) => {
    if (depth > 64)
      throw new EngineError(
        "INVALID_UI",
        "UI trees support at most 64 nested levels",
      );
    visited++;
    const s = node.style;
    node.boundsValue = Object.freeze({
      x: finite(x),
      y: finite(y),
      width: finite(w),
      height: finite(h),
    });
    if (node.kind !== "panel") return;
    const row = s.direction === "row",
      cw = Math.max(0, w - 2 * s.padding),
      ch = Math.max(0, h - 2 * s.padding),
      main = row ? cw : ch,
      cross = row ? ch : cw;
    const lines: Line[] = [{ items: [], main: 0, cross: 0 }];
    for (const child of node.children) {
      if (!child.visible || child.disposed) continue;
      const align = child.style.alignSelf ?? s.align;
      const n = constrained(
          child,
          cw,
          ch,
          !row && align === "stretch" && child.style.width === undefined,
          row &&
            !s.wrap &&
            align === "stretch" &&
            child.style.height === undefined,
          depth + 1,
        ),
        a = n.width,
        b = n.height;
      const item: Item = {
        node: child,
        main: row ? a : b,
        cross: row ? b : a,
        explicitCross:
          (row ? child.style.height : child.style.width) !== undefined,
      };
      let line = lines[lines.length - 1] as Line;
      if (s.wrap && line.items.length && line.main + s.gap + item.main > main) {
        line = { items: [], main: 0, cross: 0 };
        lines.push(line);
      }
      if (line.items.length) line.main += s.gap;
      line.items.push(item);
      line.main += item.main;
      line.cross = Math.max(line.cross, item.cross);
    }
    if (!s.wrap) (lines[0] as Line).cross = cross;
    let lineOffset = 0;
    for (const line of lines) {
      const free = main - line.main;
      if (free >= 0) {
        const weight = line.items.reduce(
          (sum, i) => sum + i.node.style.grow,
          0,
        );
        if (weight > 0)
          for (const i of line.items)
            i.main = finite(i.main + (free * i.node.style.grow) / weight);
      } else {
        // Freeze zero-size items and redistribute the remaining deficit.
        let deficit = -free;
        let remaining = line.items.filter(
          (i) => i.node.style.shrink > 0 && i.main > 0,
        );
        while (deficit > 1e-9 && remaining.length) {
          const weight = remaining.reduce(
            (sum, i) => sum + i.node.style.shrink * i.main,
            0,
          );
          let removed = 0;
          for (const i of remaining) {
            const amount = Math.min(
              i.main,
              (deficit * i.node.style.shrink * i.main) / weight,
            );
            i.main -= amount;
            removed += amount;
          }
          deficit -= removed;
          remaining = remaining.filter((i) => i.main > 1e-9);
          if (removed < 1e-9) break;
        }
      }
      const left = Math.max(
        0,
        main -
          line.items.reduce((sum, i) => sum + i.main, 0) -
          s.gap * Math.max(0, line.items.length - 1),
      );
      let gap = s.gap,
        offset = 0;
      if (s.justify === "end") offset = left;
      if (s.justify === "center") offset = left / 2;
      if (s.justify === "space-between" && line.items.length > 1)
        gap += left / (line.items.length - 1);
      if (s.justify === "space-around" && line.items.length) {
        gap += left / line.items.length;
        offset = left / line.items.length / 2;
      }
      for (const i of line.items) {
        const align = i.node.style.alignSelf ?? s.align;
        if (!i.explicitCross && align === "stretch") i.cross = line.cross;
        let c =
          align === "end"
            ? line.cross - i.cross
            : align === "center"
              ? (line.cross - i.cross) / 2
              : 0;
        c = Math.max(0, c);
        arrange(
          i.node,
          x + s.padding + (row ? offset : lineOffset + c),
          y + s.padding + (row ? lineOffset + c : offset),
          row ? i.main : i.cross,
          row ? i.cross : i.main,
          depth + 1,
        );
        offset += i.main + gap;
      }
      lineOffset += line.cross + s.gap;
    }
  };
  natural(root, 0);
  arrange(
    root,
    0,
    0,
    size(root.style.width, width) ?? width,
    size(root.style.height, height) ?? height,
    0,
  );
  return visited;
}
export function containsUI(box: UIBounds, x: number, y: number): boolean {
  return (
    x >= box.x && y >= box.y && x < box.x + box.width && y < box.y + box.height
  );
}
export function intersectUI(a: UIBounds, b: UIBounds): UIBounds {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
}
