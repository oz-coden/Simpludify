import {
  cleanupAll,
  type VirtualControl,
  type VirtualInput,
} from "@simpludify/core";
import { Container, Graphics } from "pixi.js";

export interface VirtualInputPresentation {
  update(): void;
  dispose(): void;
}
/** Screen-space presentation only. The existing BrowserPointer is the sole event adapter. */
export class VirtualInputVisual implements VirtualInputPresentation {
  readonly display = new Container();
  private readonly entries = new Map<
    VirtualControl,
    { graphics: Graphics; signature: string }
  >();
  private dead = false;
  private readonly off: () => void;
  constructor(
    private readonly input: VirtualInput,
    private readonly release: (graphics: Graphics) => void,
  ) {
    this.display.eventMode = "none";
    this.display.sortableChildren = true;
    this.display.zIndex = 0.5;
    this.off = input.onDispose(() => this.dispose());
  }
  get diagnostics() {
    return {
      controls: this.entries.size,
      visible: [...this.entries.values()].filter((e) => e.graphics.visible)
        .length,
    };
  }
  update(): void {
    if (this.dead) return;
    const live = new Set(this.input.controls);
    for (const [control, entry] of this.entries)
      if (!live.has(control)) {
        this.entries.delete(control);
        this.release(entry.graphics);
      }
    this.display.visible = this.input.visible;
    for (const control of live) {
      let entry = this.entries.get(control);
      if (!entry) {
        entry = { graphics: new Graphics(), signature: "" };
        entry.graphics.zIndex = control.kind === "button" ? 1 : 0;
        this.entries.set(control, entry);
        this.display.addChild(entry.graphics);
      }
      entry.graphics.visible = control.visible;
      if (!control.visible || !this.input.visible) continue;
      const center = control.center,
        knob = control.knob,
        radius = control.radius;
      const signature = JSON.stringify([
        center,
        knob,
        radius,
        control.color,
        control.enabled,
        this.input.enabled,
        control.pressed,
        control.kind,
      ]);
      if (signature === entry.signature) continue;
      entry.signature = signature;
      const g = entry.graphics;
      g.clear();
      g.alpha = control.enabled && this.input.enabled ? 1 : 0.35;
      g.circle(center.x, center.y, radius)
        .fill({ color: control.color, alpha: 0.12 })
        .stroke({ color: control.color, alpha: 0.75, width: 2 });
      if (control.kind === "stick") {
        g.moveTo(center.x, center.y)
          .lineTo(knob.x, knob.y)
          .stroke({ color: control.color, alpha: 0.5, width: 3 });
        g.circle(knob.x, knob.y, radius * 0.36).fill({
          color: control.color,
          alpha: control.pressed ? 0.85 : 0.45,
        });
      } else {
        if (control.pressed)
          g.circle(center.x, center.y, radius * 0.7).fill({
            color: control.color,
            alpha: 0.65,
          });
        if (control.directional && control.pressed)
          g.moveTo(center.x, center.y)
            .lineTo(knob.x, knob.y)
            .stroke({ color: control.color, width: 4 });
      }
    }
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const entries = [...this.entries.values()];
    this.entries.clear();
    cleanupAll(
      [
        this.off,
        ...entries.map((e) => () => this.release(e.graphics)),
        () => this.display.destroy({ children: true }),
      ],
      "Virtual input presentation cleanup failed",
    );
  }
}
