import {
  Actor,
  Character,
  Component,
  type ComponentType,
  defineComponent,
  defineEvent,
  Movement,
  Renderable,
  type Scene,
  Transform,
  type UpdateContext,
} from "@simpludify/core";
export const BeaconCollected = defineEvent<{ actorId: string; total: number }>(
  "BeaconCollected",
);
export class Inventory extends Component {
  static readonly type: ComponentType<Inventory> =
    defineComponent<Inventory>("Inventory");
  readonly type = Inventory.type;
  total = 0;
}
export class Beacon extends Component {
  static readonly type: ComponentType<Beacon> = defineComponent<Beacon>(
    "Beacon",
    [Transform.type],
  );
  readonly type = Beacon.type;
}
export class Collector extends Component {
  static readonly type: ComponentType<Collector> = defineComponent<Collector>(
    "Collector",
    [Transform.type, Inventory.type],
  );
  readonly type = Collector.type;
  update({ scene }: UpdateContext): void {
    const player = this.actor.require(Transform.type),
      inventory = this.actor.require(Inventory.type);
    for (const actor of scene.actors) {
      if (!actor.get(Beacon.type) || actor.disposed) continue;
      const point = actor.require(Transform.type);
      if (Math.hypot(player.x - point.x, player.y - point.y) < 28) {
        const actorId = actor.id;
        actor.dispose();
        inventory.total++;
        if (actorId !== undefined)
          scene.events.emit(BeaconCollected, {
            actorId,
            total: inventory.total,
          });
      }
    }
  }
}
export function spawnBeacon(scene: Scene, x: number, y: number): Actor {
  const actor = new Actor();
  actor.add(new Transform({ x, y }));
  actor.add(new Renderable({ width: 18, height: 18, color: 0xffc87a }));
  actor.add(new Beacon());
  return scene.add(actor);
}
export function createPlayer(scene: Scene) {
  const player = Character({
    id: "player",
    movement: Movement.WASD,
    speed: 200,
  });
  player.add(new Inventory());
  player.add(new Collector());
  return scene.add(player);
}
