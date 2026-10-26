import {expect,it} from "vitest";
import {Collider,CollisionShape,Engine,Scene,Transform,worldPoint} from "@simpludify/core";
import {Round,RoundChanged,RoundFinished,RoundStatus} from "../../examples/signal-run/logic";
it("collects signals through contacts and freezes terminal motion",()=>{
 const engine=new Engine(),round=new Round(engine.scene,{hazards:false});const ended:string[]=[];engine.scene.events.on(RoundFinished,state=>ended.push(state.status));
 for(const actor of [...round.pickups]){const t=actor.require(Transform.type);round.player.x=t.x;round.player.y=t.y;engine.step(0);}
 expect(round.snapshot()).toMatchObject({status:RoundStatus.Won,hp:3,score:6});expect(ended).toEqual(["won"]);expect(round.world.disposed).toBe(true);
 const x=round.player.x;engine.input.set("KeyD",true);engine.step(1);expect(round.player.x).toBe(x);engine.dispose();
});
it("applies contact cooldown and game over with a rotated obstacle",()=>{
 const engine=new Engine(),round=new Round(engine.scene),hazard=[...round.hazards].find(actor=>actor.require(Collider.type).shape===CollisionShape.Box);
 if(!hazard)throw new Error("No obstacle");const t=hazard.require(Transform.type);round.player.x=t.x;round.player.y=t.y;engine.step(0);expect(round.health.hp).toBe(2);engine.step(.5);expect(round.health.hp).toBe(2);engine.step(.51);expect(round.health.hp).toBe(1);engine.step(1.01);expect(round.status).toBe(RoundStatus.Lost);engine.dispose();
});
it("times out before late pickup delivery",()=>{
 const engine=new Engine(),round=new Round(engine.scene,{hazards:false,duration:1,goal:1}),item=[...round.pickups][0];if(!item)throw new Error("No pickup");const t=item.require(Transform.type);round.player.x=t.x;round.player.y=t.y;engine.step(1);expect(round.status).toBe(RoundStatus.Timeout);expect(round.score).toBe(0);engine.dispose();
});
it("supports target movement, keyboard override, bounds and pause",()=>{
 const engine=new Engine(),round=new Round(engine.scene,{hazards:false});round.setTarget(worldPoint(220,225));engine.step(.5);expect(round.player.x).toBe(175);engine.pause();engine.step(10);expect(round.elapsed).toBe(.5);engine.resume();engine.input.set("KeyA",true);engine.step(.1);expect(round.player.x).toBe(156);engine.input.clear();engine.step(.1);expect(round.player.x).toBe(156);round.setTarget(worldPoint(-500,-500));engine.step(2);expect(round.player.x).toBeGreaterThanOrEqual(16);expect(round.player.y).toBeGreaterThanOrEqual(28);engine.dispose();
});
it("publishes coarse UI changes and cleans round resources on restart",()=>{
 const engine=new Engine(),round=new Round(engine.scene);let updates=0;engine.scene.events.on(RoundChanged,()=>updates++);for(let i=0;i<60;i++)engine.step(1/60);expect(updates).toBeLessThan(5);const fresh=new Scene("restart");engine.activate(fresh);const next=new Round(fresh,{hazards:false});engine.step(0);expect(round.world.disposed).toBe(true);expect(round.pickups.size).toBe(0);expect(next.score).toBe(0);engine.dispose();
});
it("replays controlled input deterministically",()=>{
 const run=()=>{const engine=new Engine(42),round=new Round(engine.scene);engine.input.set("KeyD",true);for(let i=0;i<240;i++){if(i===60)engine.input.set("KeyS",true);if(i===120)engine.input.clear();engine.step(1/60);}const state={world:engine.snapshot(),round:round.snapshot()};engine.dispose();return state;};expect(run()).toEqual(run());
});
