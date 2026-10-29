# 衝突判定と位置補正

円・回転矩形でゲーム内の対象を近似します。キャラクターの絵の輪郭と厳密に一致させる必要はありません。Colliderの寸法はゲームの操作感に合わせて明示します。

## TriggerとSolid

| 組み合わせ        | 接触通知・問い合わせ | 位置補正                            |
| ----------------- | -------------------- | ----------------------------------- |
| Trigger / Trigger | あり                 | なし                                |
| Trigger / Solid   | あり                 | なし                                |
| Solid / Solid     | あり                 | 有効な動的CollisionBodyに応じて実行 |

Colliderの既定は**Trigger**です。壁として止めたいなら両者をSolidにし、動かす側にCollisionBodyを追加します。Colliderは形状・フィルタ・応答方針、CollisionBodyは補正の重み、Motionは移動の意図を担当します。

## 最小の壁との接触

```ts
import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  ContactEnter,
  Motion,
  Transform,
} from "@simpludify/core";

const world = new CollisionWorld(scene);
const player = scene.add(new Actor());
player.add(new Transform({ x: 100, y: 200 }));
player.add(new Motion({ speed: 120, x: 1 }));
player.add(new CollisionBody());
const collider = player.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 13,
    response: CollisionResponse.Solid,
  }),
);
const wall = scene.add(new Actor());
wall.add(new Transform({ x: 150, y: 200 }));
wall.add(
  new Collider({
    width: 18,
    height: 150,
    response: CollisionResponse.Solid,
  }),
);
collider.events.on(
  ContactEnter,
  ({ otherActor }) => {
    console.log("touch", otherActor.id);
  },
  player,
);
// 次のシミュレーションステップ後、イベントなしでも問い合わせ可能。
const contacts = world.contactsFor(collider);
```

Renderableは不要です。見える壁にする場合は別に追加します。Bodyなし・`BodyType.Static`・無効なBodyは位置補正の重み0です。動的Bodyはmass既定1で逆質量比の移動を分担します。StaticはTransformの書換え禁止を意味しません。

## 形状とフィルタ

Colliderは1Actorに1個、Transformが必須です。Boxは幅・高さ既定32、Circleは半径既定16です。offsetと回転、負のスケールを扱います。円は絶対値が等しい2軸スケールを要求し、0スケールは接触対象から外れます。アセットからの自動形状生成と複数Colliderは未実装です。

layer既定1、mask既定0xffffffffで、双方のmaskが相手のlayerを含むときだけ判定・補正・通知します。Actor/Colliderのenabledが参加を制御し、描画のvisibleは接触へ影響しません。形状・response・フィルタはimmutableです。

## イベントの意味と順序

Component更新後、CollisionWorldが位置補正を行い、その後にContactEnter / Stay / Exit、続いてSceneタイマー・onUpdateが動きます。イベントは各参加者へ1パスにつき1回で、補正反復ごとには通知しません。

- Enter：今回初めて観測したペア。
- Stay：前パスから観測が続くペア。
- Exit：通知済みだったペアが次パスで不在または無効になった場合。
- Triggerは補正後の位置、Solidは補正中の遭遇も含みます。Solidの一時接触が次パスでExitすることもあります。
- ペアは発見ID順、ペア内は第一参加者・第二参加者順です。
- 削除・無効化は後続Enter/Stayを抑止します。生存している通知済みColliderへ次パスでExitを送り、破棄済みColliderへは送りません。
- Scene/world破棄で配送を停止し、合成Exitなしに状態を解放します。handlerのエラーは他の対象への配送後に集約し、補正を巻き戻しません。

payloadのnormalX/Yは自分から相手への法線、depthはそのパスで観測した最大の補正前深さ、resolvedはそのペアが位置を補正したかです。イベントpayloadは再利用されるため保持するなら数値をコピーします。`contactsFor`は独立した数値スナップショットを返しますが、Actor/Collider参照は生きたオブジェクトです。未更新の座標変更は次パスで反映します。

## 補正の範囲と限界

`CollisionWorld(scene, { iterations: 6, tolerance: 1e-7 })`が既定です。iterationsは1〜32、toleranceは世界単位です。接線方向の移動は残るため壁沿いに滑れます。ただし、これは位置の押し戻しであり、速度・反発・摩擦・重力・角運動・剛体拘束は計算しません。

高速移動では薄い壁を端点間ですり抜けます。適切に小さなEngine.stepへの分割は緩和策ですが、Sweep/CCDの保証はありません。窮屈な隙間・深い重なり・密集では貫通や振動が残ります。`world.responseDiagnostics.unresolved`を確認します。100体を密集させた測定では既定6反復後も147ペアが未解消でした。

X軸SweepのBroad Phaseを使用しますが、密集・不利な分布では二次的なコストになります。[性能記録](../en/performance.html)は特定環境での観測であり一般的な優劣ではありません。

## Colliderを使わないゲーム

盤面のセル占有や落ち物パズルの行消去は通常の配列・整数ロジックで判定できます。全ゲームへ物理接触を強制しません。描画サイズからの近似形状生成や複合形状は将来候補です。

## Tilemapとの衝突

Actor同士のContactはそのまま使います。地形には専用のTileContactイベントを購読するため、Actorだけのゲームに型判別を追加する必要はありません。内部では同じCollisionWorld・形状判定・反復補正・接触追跡を共有します。

```ts verify
import {
  CollisionResponse,
  CollisionWorld,
  Scene,
  SpriteSheet,
  Tilemap,
} from "@simpludify/core";
const scene = new Scene("field");
new CollisionWorld(scene);
const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { wall: 0, water: 1 },
});
const map = new Tilemap({
  sheet,
  tiles: [["wall", "water", null]],
  tileWidth: 32,
  tileHeight: 32,
  collision: {
    tiles: [
      { tile: "wall", response: CollisionResponse.Solid },
      { tile: "water", response: CollisionResponse.Trigger },
    ],
  },
}).place(scene);
map.setCollision(0, 0, null); // このセルだけ衝突なし
map.resetCollision(0, 0); // wallの既定へ戻す
```

動くActorは既存の例と同じくSolid Collider＋動的CollisionBodyを使います。TileContactにはself／selfActor、map、tileX／tileY、観測時のtileId／凍結policy、normal／depth／response／resolvedがあります。world.tileContactsFor(collider)でも取得でき、既存contactsForはActor用のままです。

ルールのresponseは必須、layer=1、mask=0xffffffffです。両側のmaskで許可された組だけ判定します。画像がnullでもセルの明示的なSolid／Trigger上書きは使えます。visibleは描画だけ、collisionEnabledは衝突だけ、enabledは配置全体を制御します。Camera外や画像準備中でもCoreの衝突判定は画像を読みません。

同じセル・実効応答なら画像変更だけでEnter/Exitを増やしません。ペア応答がSolid↔Triggerへ変われば旧Exit→新Enterです。イベント内の画像／属性編集は次の衝突パスへ反映し、破棄／無効化は後続Enter/Stayを即抑制します。Scene破棄時は合成Exitを出さず解放します。

等しい衝突属性の連続壁では内部面・頂点による補正を除外し、円・回転Box・縦横／逆方向・非正方形セル・凸凹角を検証しています。任意に深く地形へ埋まった場合や狭すぎる隙間では未解消接触が残ります。セル単位のイベントなので、隣のセルへ移ればそのセルのEnter/Exitは発生します。[詳細な契約](../en/tilemap-collision.html)と[実測と限界](../en/collision-performance.html)を確認してください。
