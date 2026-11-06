# Tilemapの地形衝突

Actor同士のContactはそのまま機能します。地形には専用の`TileContact`イベントを購読するため、Actorだけのゲームに型判別を追加する必要はありません。内部では同一のCollisionWorld、形状判定、反復補正、接触追跡を共有します。

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

動くActorは既存の例と同じくSolid Collider＋動的CollisionBodyを使います。TileContactにはself／selfActor、map、tileX／tileY、観測時のtileId／凍結policy、normal／depth／response／resolvedがあります。`world.tileContactsFor(collider)`でも取得でき、既存の`contactsFor`はActor専用のままです。

ルールのresponseは必須、layer=1、mask=0xffffffffです。両側のmaskで許可された組だけ判定します。画像がnullでもセルの明示的なSolid／Trigger上書きは使えます。visibleは描画だけ、collisionEnabledは衝突だけ、enabledは配置全体を制御します。Camera外や画像準備中でもCoreの衝突判定は画像を読みません。

## イベントと変更規則

接触の同一性（Contact identity）は、**Colliderインスタンス + マップ配置インスタンス + セルインデックス + 実効ペア応答**です。

| 観測／変更内容                                                 | イベント                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| 新しい重なり                                                   | Enter                                                           |
| 同一セルかつ同一実効応答が継続観測                             | Stay                                                            |
| 画像のみ変更（衝突応答は同一）、またはフィルタ変更後も同一応答 | Stay                                                            |
| 実効ペア応答がSolid ↔ Triggerへ変化                            | 旧観測のExit、直後に新観測のEnter                               |
| 自身がTriggerの状態でタイルがSolid ↔ Triggerへ変化             | Stay（実効ペア応答はTriggerのまま）                             |
| セルがnull/除去、またはマスクにより不適合化                    | 以前Enterした生存ColliderへExit                                 |
| Collider/マップ/配置の衝突が無効化                             | 後続のEnter/Stayを即座に抑止。次パスでマッチしたExitを配信      |
| Colliderが破棄                                                 | 破棄された受信者には何も配信しない                              |
| マップが破棄                                                   | 最後のマップ参照（map.disposed=true）とともに生存ColliderへExit |
| World/Sceneが破棄／差し替え                                    | 配信を停止し静かにクリア（合成Exitなし）                        |

Actorペアは既存の相対発見順序を保持して最初に配信されます。地形接触はCollider発見順、マップ発見順、行優先セルインデックス順に配信されます。各ペアは反復ごとではなくパスごとに1回通知します。

## クエリ・応答・ライフサイクル

Worldは既存のActor X軸スイープを維持します。各適格ActorのワールドAABBが各適格マップのローカルセル矩形をクエリします。回転BoxはAABBで候補を絞った後に実際のOBBナローフェーズを実行します。

単一の反復予算がActor同士と地形ペアの両方を処理します。地形は逆質量0（移動不可）です。同一の完全ポリシーを持つ連続壁では、近傍トポロジーにより内部の面や頂点による補正が除外され、円や回転Boxが継ぎ目で引っかかるのを防ぎます。

## 診断機能と限界

`world.diagnostics`はActor専用のままです。`responseDiagnostics`はソルバー全体を報告します。`tileDiagnostics`は整合されたマップ数、candidateCells、policyRejected、narrowTests、responseTests、trackedContacts、corrections、unresolved、neighborProbes、retainedCellsを報告します。

これは離散的な位置補正です。深く埋まった初期状態、狭すぎる隙間、瞬間移動、密集では未解消の接触が残る場合があります。

## 任意の矩形候補探索（tileSearch: "rectangles"）

```ts verify
import { CollisionWorld, Engine } from "@simpludify/core";
const engine = new Engine();
const world = new CollisionWorld(engine.scene, { tileSearch: "rectangles" });
engine.step(0);
console.log(world.tileIndexDiagnostics);
engine.dispose();
```

`tileSearch`は`"cells"`（既定）または`"rectangles"`です。インデックスは連続する同一ポリシーのセルを16×16チャンク内で矩形に結合します。これにより候補判定が高速化される場合があります。**矩形は候補幾何を結合するだけであり、公開される接触イベントやソルバー応答はセル単位のままです。**
