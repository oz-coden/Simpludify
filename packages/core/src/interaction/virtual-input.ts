import { EngineError } from "../foundation/diagnostics";
import { cleanupAll, Lifetime } from "../foundation/lifetime";
import type { Point, Viewport } from "../graphics/coordinates";
import type { ActionController, ActionInputValue, ActionSet } from "./actions";
import type { InputAdapter, InputSystem } from "./input";
import type { PointerInfo, ScenePointer } from "./pointer-routing";
import type { PointerTargetProvider } from "./pointer-target";
import {
  checkVirtualOptions,
  type VirtualBinding,
  VirtualButton,
  type VirtualButtonOptions,
  type VirtualControl,
  type VirtualControlHost,
  VirtualStick,
  type VirtualStickOptions,
} from "./virtual-control";
import {
  type ResolvedVirtualRegion,
  resolveVirtualRegion,
  type VirtualRegion,
  virtualBounds,
  virtualContains,
  virtualFinite,
  virtualOverlap,
  virtualPosition,
} from "./virtual-regions";

/** Scene-scoped virtual devices; all gameplay values flow through existing ActionSources. */
export class VirtualInput implements InputAdapter, PointerTargetProvider {
  private readonly life = new Lifetime();
  private list: readonly VirtualControl[] = Object.freeze([]);
  private regions = new Map<VirtualControl, ResolvedVirtualRegion>();
  private anchors = new Map<VirtualControl, Point>();
  private view: Viewport = Object.freeze({
    x: 0,
    y: 0,
    width: 800,
    height: 450,
  });
  private active = true;
  private shown = true;
  private dirty = true;
  private readonly host: VirtualControlHost;
  constructor(
    readonly pointer: ScenePointer,
    private readonly input: InputSystem,
  ) {
    if (pointer.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Scene pointer has been disposed",
      );
    this.host = {
      available: () => !this.disposed && this.active && input.liveInput,
      center: (control) => this.anchors.get(control) ?? { x: 0, y: 0 },
      contains: (control, data) => {
        const region = this.regions.get(control);
        return region ? virtualContains(region, data.screen, this.view) : false;
      },
      region: (control, region) => {
        const regions = this.resolve(this.view, control, region);
        this.regions = regions;
        this.anchors = this.centers(regions, this.view);
        this.dirty = true;
      },
      remove: (control) => {
        this.list = Object.freeze(this.list.filter((c) => c !== control));
        this.regions.delete(control);
        this.anchors.delete(control);
      },
    };
    try {
      this.life.onDispose(pointer.attachTargets(this));
      this.life.onDispose(input.addAdapter(this));
      this.life.onDispose(pointer.onDispose(() => this.dispose()));
    } catch (error) {
      this.life.dispose();
      throw error;
    }
  }
  get disposed(): boolean {
    return this.life.disposed;
  }
  get controls(): readonly VirtualControl[] {
    return this.list;
  }
  get viewport(): Viewport {
    return this.view;
  }
  get enabled(): boolean {
    return this.active;
  }
  set enabled(value: boolean) {
    this.alive();
    this.flag(value);
    if (this.active === value) return;
    this.active = value;
    this.reset();
  }
  get visible(): boolean {
    return this.shown;
  }
  set visible(value: boolean) {
    this.alive();
    this.flag(value);
    this.shown = value;
  }
  onDispose(callback: () => void): () => void {
    return this.life.onDispose(callback);
  }
  private flag(value: boolean): void {
    if (typeof value !== "boolean")
      throw new EngineError(
        "INVALID_VIRTUAL_INPUT",
        "Virtual input flags must be boolean",
      );
  }
  private alive(): void {
    if (this.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Virtual input has been disposed",
      );
  }
  private validate<A extends ActionSet>(
    controller: ActionController<A>,
    action: A[keyof A],
    kind: "axis2d" | "button",
    options: VirtualStickOptions & VirtualButtonOptions,
  ): void {
    this.alive();
    checkVirtualOptions(options);
    if (
      !this.input.hasController(controller) ||
      controller.reader(action).scene !== this.pointer.scene ||
      action.kind !== kind
    )
      throw new EngineError(
        "INVALID_ACTION",
        "Virtual input requires a matching Action kind and a controller in its own Scene/InputSystem",
      );
    const region = resolveVirtualRegion(options.region, this.view);
    const peers = this.resolve(this.view);
    for (const control of this.list) {
      const other = peers.get(control);
      if (
        other &&
        control.kind === (kind === "axis2d" ? "stick" : "button") &&
        virtualOverlap(region, other)
      )
        throw new EngineError(
          "VIRTUAL_REGION_OVERLAP",
          "Same-priority virtual activation regions overlap",
        );
    }
    if (options.position) virtualPosition(options.position, this.view);
  }
  private binding<A extends ActionSet>(
    controller: ActionController<A>,
    action: A[keyof A],
  ): VirtualBinding {
    const source = controller.createSource();
    return {
      get disposed() {
        return source.disposed;
      },
      onDispose: (callback) => controller.onDispose(callback),
      clear: () => source.clear(),
      dispose: () => source.dispose(),
      active: () => controller.active,
      write: (direction, pressed) =>
        source.set(
          action,
          (action.kind === "axis2d" ? direction : pressed) as ActionInputValue<
            A[keyof A]["kind"]
          >,
        ),
    };
  }
  stick<A extends ActionSet>(
    controller: ActionController<A>,
    action: Extract<A[keyof A], { kind: "axis2d" }>,
    options: VirtualStickOptions,
  ): VirtualStick {
    this.validate(controller, action, "axis2d", options);
    const binding = this.binding(controller, action);
    try {
      return this.add(new VirtualStick(options, this.host, binding));
    } catch (error) {
      binding.dispose();
      throw error;
    }
  }
  button<A extends ActionSet>(
    controller: ActionController<A>,
    action: Extract<A[keyof A], { kind: "button" }>,
    options: VirtualButtonOptions,
  ): VirtualButton {
    this.validate(controller, action, "button", options);
    const binding = this.binding(controller, action);
    try {
      return this.add(new VirtualButton(options, this.host, binding));
    } catch (error) {
      binding.dispose();
      throw error;
    }
  }
  private add<T extends VirtualControl>(control: T): T {
    this.list = Object.freeze([...this.list, control]);
    this.dirty = true;
    try {
      this.refresh();
    } catch (error) {
      control.dispose();
      throw error;
    }
    return control;
  }
  private resolve(
    view: Viewport,
    replaced?: VirtualControl,
    region?: VirtualRegion,
  ): Map<VirtualControl, ResolvedVirtualRegion> {
    const result = new Map<VirtualControl, ResolvedVirtualRegion>();
    for (const control of this.list)
      result.set(
        control,
        resolveVirtualRegion(
          control === replaced && region ? region : control.region,
          view,
        ),
      );
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (!a) continue;
      for (let j = i + 1; j < this.list.length; j++) {
        const b = this.list[j],
          x = result.get(a),
          y = b ? result.get(b) : undefined;
        if (b && x && y && a.kind === b.kind && virtualOverlap(x, y))
          throw new EngineError(
            "VIRTUAL_REGION_OVERLAP",
            "Same-priority virtual activation regions overlap",
            { first: i, second: j },
          );
      }
    }
    return result;
  }
  private centers(
    regions: ReadonlyMap<VirtualControl, ResolvedVirtualRegion>,
    view: Viewport,
  ): Map<VirtualControl, Point> {
    return new Map(
      [...regions].map(([control, region]) => {
        const b = region.bounds;
        return [
          control,
          control.position
            ? virtualPosition(control.position, view)
            : Object.freeze({ x: b.x + b.width / 2, y: b.y + b.height / 2 }),
        ];
      }),
    );
  }
  /** Resolve after Canvas layout and before routing/rendering. Layout changes cancel active gestures. */
  refresh(viewport: Viewport = this.view): void {
    this.alive();
    const view = virtualBounds(viewport);
    const resized = Object.keys(view).some(
      (key) => view[key as keyof Viewport] !== this.view[key as keyof Viewport],
    );
    if (
      !this.dirty &&
      !resized &&
      !this.list.some((c) => c.region.kind === "custom")
    )
      return;
    const regions = this.resolve(view),
      centers = this.centers(regions, view);
    const changed = this.list.filter(
      (c) =>
        resized ||
        JSON.stringify(regions.get(c)) !==
          JSON.stringify(this.regions.get(c)) ||
        JSON.stringify(centers.get(c)) !== JSON.stringify(this.anchors.get(c)),
    );
    this.view = view;
    this.regions = regions;
    this.anchors = centers;
    this.dirty = false;
    cleanupAll(
      changed.map((c) => () => c.invalidate()),
      "Virtual layout cancellation failed",
    );
  }
  pick(data: PointerInfo): VirtualControl | undefined {
    if (
      this.disposed ||
      !this.active ||
      !this.input.liveInput ||
      data.button !== 0
    )
      return;
    this.refresh();
    for (const kind of ["button", "stick"] as const)
      for (const control of this.list)
        if (
          control.kind === kind &&
          control.available &&
          control.contains(data)
        )
          return control;
    return undefined;
  }
  sample(): void {
    if (this.disposed) return;
    this.refresh();
    cleanupAll(
      this.list
        .filter((c) => c.pressed && !c.available)
        .map((c) => () => c.invalidate()),
      "Virtual availability cancellation failed",
    );
  }
  advance(seconds: number): void {
    this.alive();
    if (virtualFinite(seconds, "seconds") < 0)
      throw new EngineError(
        "INVALID_VIRTUAL_INPUT",
        "Presentation seconds must be nonnegative",
      );
    cleanupAll(
      this.list.map((c) => () => {
        if (!c.disposed) c.advance(seconds);
      }),
      "Virtual hold callbacks failed",
    );
  }
  reset(): void {
    cleanupAll(
      this.list.map((c) => () => c.invalidate()),
      "Virtual input reset failed",
    );
  }
  dispose(): void {
    if (this.disposed) return;
    cleanupAll(
      [
        () => this.life.dispose(),
        ...this.list.map((c) => () => c.dispose()),
        () => {
          this.regions.clear();
          this.anchors.clear();
          this.list = Object.freeze([]);
        },
      ],
      "Virtual input cleanup failed",
    );
  }
}
