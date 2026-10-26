import {
  Component,
  ComponentPhase,
  type ComponentType,
  type UpdateContext,
} from "./component";
import { EngineError } from "./diagnostics";
import { EventBus } from "./events";
import { cleanupAll, Lifetime } from "./lifetime";
import type { Scene } from "./scene";
export const ActorState = {
  Detached: "detached",
  Attached: "attached",
  Disposed: "disposed",
} as const;
export type ActorState = (typeof ActorState)[keyof typeof ActorState];
export interface ActorOptions {
  id?: string;
  enabled?: boolean;
}
export class Actor {
  private identifier: string | undefined;
  private owner: Scene | undefined;
  private readonly components = new Map<symbol, Component>();
  private inputPlan: readonly Component[] = [];
  private updatePlan: readonly Component[] = [];
  private frameInput: readonly Component[] = [];
  private frameUpdates: readonly Component[] = [];
  private attaching = false;
  private frameEligible = false;
  private readonly lifetime = new Lifetime();
  private bus: EventBus | undefined;
  private on: boolean;
  private destroying = false;
  constructor(options: ActorOptions = {}) {
    if (options.id !== undefined && !options.id.trim())
      throw new EngineError("INVALID_ID", "Actor id cannot be empty");
    this.identifier = options.id;
    this.on = options.enabled ?? true;
  }
  get id(): string | undefined {
    return this.identifier;
  }
  get scene(): Scene | undefined {
    return this.owner;
  }
  get state(): ActorState {
    return this.disposed
      ? ActorState.Disposed
      : this.owner
        ? ActorState.Attached
        : ActorState.Detached;
  }
  get disposed(): boolean {
    return this.destroying || this.lifetime.disposed;
  }
  get enabled(): boolean {
    return this.on;
  }
  set enabled(value: boolean) {
    this.assertAlive();
    this.on = value;
  }
  get events(): EventBus {
    this.assertAlive();
    this.bus ??= new EventBus();
    return this.bus;
  }
  onDispose(callback: () => void): () => void {
    this.assertAlive();
    return this.lifetime.onDispose(callback);
  }
  private assertAlive(): void {
    if (this.disposed)
      throw new EngineError("ACTOR_DISPOSED", "Actor has been disposed", {
        actorId: this.id,
      });
  }
  get<T extends Component>(type: ComponentType<T>): T | undefined {
    return this.components.get(type.id) as T | undefined;
  }
  require<T extends Component>(type: ComponentType<T>): T {
    const value = this.get(type);
    if (!value)
      throw new EngineError(
        "COMPONENT_MISSING",
        "Required component is missing",
        { actorId: this.id, component: type.name },
      );
    return value;
  }
  private validate(
    type: ComponentType,
    visiting = new Set<symbol>(),
    visited = new Set<symbol>(),
  ): void {
    if (visiting.has(type.id))
      throw new EngineError(
        "COMPONENT_CYCLE",
        "Cyclic component requirements",
        { component: type.name, actorId: this.id },
      );
    if (visited.has(type.id)) return;
    visiting.add(type.id);
    for (const dependency of type.requires)
      this.validate(dependency, visiting, visited);
    visiting.delete(type.id);
    visited.add(type.id);
  }
  add<T extends Component>(component: T): T {
    this.assertAlive();
    if (this.attaching)
      throw new EngineError(
        "COMPONENT_MUTATION_REENTRANT",
        "Do not change component structure from onAttach",
      );
    this.validate(component.type);
    if (this.components.has(component.type.id))
      throw new EngineError(
        "COMPONENT_DUPLICATE",
        "Component type already exists",
        { actorId: this.id, component: component.type.name },
      );
    for (const dependency of component.type.requires)
      if (!this.components.has(dependency.id))
        throw new EngineError(
          "COMPONENT_MISSING",
          "Add required components before dependents",
          {
            actorId: this.id,
            component: component.type.name,
            dependency: dependency.name,
          },
        );
    if (component.disposed)
      throw new EngineError(
        "COMPONENT_OWNERSHIP",
        "Cannot add a disposed component",
      );
    this.components.set(component.type.id, component);
    this.attaching = true;
    try {
      component.attachTo(this);
      this.assertAlive();
      if (component.disposed)
        throw new EngineError(
          "COMPONENT_DISPOSED",
          "Component was disposed during attachment",
        );
    } catch (error) {
      this.components.delete(component.type.id);
      throw error;
    } finally {
      this.attaching = false;
    }
    this.rebuild();
    return component;
  }
  remove<T extends Component>(type: ComponentType<T>): boolean {
    this.assertAlive();
    if (this.attaching)
      throw new EngineError(
        "COMPONENT_MUTATION_REENTRANT",
        "Do not change component structure from onAttach",
      );
    const component = this.components.get(type.id);
    if (!component) return false;
    for (const other of this.components.values())
      if (other.type.requires.some((required) => required.id === type.id))
        throw new EngineError(
          "COMPONENT_REQUIRED",
          "Remove dependents before their dependency",
          {
            actorId: this.id,
            component: type.name,
            dependent: other.type.name,
          },
        );
    this.components.delete(type.id);
    this.rebuild();
    component.destroyOwned();
    return true;
  }
  private rebuild(): void {
    const input: Component[] = [],
      update: Component[] = [];
    for (const component of this.components.values())
      if (component.update !== Component.prototype.update) {
        (component.phase === ComponentPhase.Input ? input : update).push(
          component,
        );
      }
    this.inputPlan = input;
    this.updatePlan = update;
    this.owner?.touch();
  }
  /** @internal */ attachTo(scene: Scene, id: string): void {
    this.assertAlive();
    if (this.owner)
      throw new EngineError(
        "ACTOR_OWNERSHIP",
        "Actor already belongs to a scene",
        { actorId: this.id },
      );
    this.identifier = id;
    this.owner = scene;
  }
  /** @internal */ beginStep(): void {
    this.frameInput = this.inputPlan;
    this.frameUpdates = this.updatePlan;
    this.frameEligible = this.enabled && !this.disposed;
  }
  /** @internal */ updatePhase(
    phase: ComponentPhase,
    context: UpdateContext,
  ): void {
    if (
      !this.frameEligible ||
      !this.enabled ||
      this.disposed ||
      this.owner !== context.scene
    )
      return;
    for (const component of phase === ComponentPhase.Input
      ? this.frameInput
      : this.frameUpdates) {
      if (!this.enabled || this.disposed || this.owner !== context.scene) break;
      if (component.enabled && !component.disposed) component.update(context);
    }
  }
  /** @internal */ destroyOwned(): void {
    if (this.disposed) return;
    this.destroying = true;
    this.owner = undefined;
    const components = [...this.components.values()].reverse();
    this.components.clear();
    this.inputPlan = [];
    this.updatePlan = [];
    this.frameInput = [];
    this.frameUpdates = [];
    try {
      cleanupAll(
        [
          () => this.lifetime.dispose(),
          () => this.bus?.dispose(),
          ...components.map((component) => () => component.destroyOwned()),
        ],
        "Actor cleanup failed",
      );
    } finally {
      this.bus = undefined;
    }
  }
  dispose(): void {
    if (this.disposed) return;
    if (this.owner) this.owner.remove(this);
    else this.destroyOwned();
  }
}
