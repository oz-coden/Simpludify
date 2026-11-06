# Tilemap Collision 統合契約案

> Historical design review. The public Contact union proposal is superseded by the [implementation decision](../collision-implementation.md): Actor Contact stays unchanged; dedicated TileContact events share the same internal World/solver. Recorded measurements and counterexamples remain historical evidence, not current Solver throughput.

**設計決定。正式APIは未実装。** 基準は Tilemap `77479d59b58f26aadc4e89f773d90b9b5ba1752b`。宣言のみの型試作は `tests/prototypes/collision-api.ts`、正例・負例は `tests/types/collision-proposal.ts`。次段階でこれらを公開APIへ移すまで、以下のコードを既存エンジンへコピーしても動作しない。

## 責務と所有権

| 対象               | 維持する責務                                                     | 次段階で加える責務                                         |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Collider           | Actorの形状、offset、Trigger/Solid、layer/mask、有効性、接触通知 | 統一Contactの受信。タイルの所有や移動速度は持たない        |
| CollisionBody      | static/dynamic、mass、補正重み                                   | 変更なし。タイル側の重みは0                                |
| Motion / Transform | 移動の意図・積分 / ワールド位置                                  | 変更なし。補正はMotionの意図を変更しない                   |
| Tilemap            | コピーされたGrid、セル編集、配置、内部Actorと受動Layer           | 任意の衝突属性データ、検証、独立した衝突変更通知           |
| CollisionWorld     | 登録、候補探索、狭義判定、反復補正、接触追跡、通知               | TilemapLayerの発見と局所セル候補、共通の補正・通知への接続 |
| Web / Renderer     | Camera・表示・画像の非同期準備と解放                             | 衝突への依存を追加しない                                   |

Tilemapの内部Actorは引き続き1つ。追加のScene所有コレクション、セルActor、セルCollider Component、Tilemap専用CollisionWorldを作らない。任意の衝突データはTilemapが所有し、既存TilemapLayerからWorldが読む。CollisionWorldはSceneの構造revisionで全Tilemap配置の一覧を更新する。衝突未設定の配置も一覧から消さず、後から設定を追加できるようにする。衝突の有無はパス開始時に判定し、毎フレーム全セルを調べない。

描画のみのゲームは従来どおりWorldも衝突設定も不要。衝突を使うゲームはSceneごとに `new CollisionWorld(scene)` を1回作る。画像ロード完了や当該セルがCamera内かどうかは、衝突開始の条件にならない。

## 公開API案

```ts
// 提案API。正式実装タスクで導入する。
const terrain = new Tilemap({
  sheet,
  tiles: [
    ["grass", "wall", "water"],
    [null, "wall", "grass"],
  ],
  tileWidth: 32,
  tileHeight: 32,
  collision: {
    tiles: [
      { tile: "wall", response: CollisionResponse.Solid },
      { tile: "water", response: CollisionResponse.Trigger, layer: 2, mask: 1 },
    ],
  },
}).place(scene);

terrain.setCollision(1, 0, null); // 明示的に衝突なし
terrain.resetCollision(1, 0); // wallの既定へ戻す
terrain.setCollision(0, 1, { response: CollisionResponse.Solid }); // 画像なしの壁
terrain.setTileCollision("wall", { response: CollisionResponse.Trigger });
terrain.collisionEnabled = false; // 描画のvisibleとは独立
```

衝突ルールは `response` 必須、`layer=1`、`mask=0xffffffff`。Colliderと同じ32ビット・有限値検証を共用する。既存ColliderのTrigger既定値は変更しない。タイル設定で無指定を暗黙のSolidにしない。設定配列の重複IDはエラー。配列を採用する理由は数値 `0` と文字列名 `"0"` を区別できるためで、JSオブジェクトのキー強制変換やMapの型注釈を利用者に要求しない。

名前はsheetから推論する。`NoInfer`でルール側の誤記から名前unionが広がることを防ぐ。数値IDの上限は既存SpriteSheetのメタデータで検証可能な範囲に従う。画像のデコードは衝突の前提とせず、将来の衝突設定は画像サイズを非同期ロードして検証しない。配置セルの画像境界に関する既存Rendererのエラー契約は独立して維持する。

IDの比較は厳密な値で行う。同じ画像領域を指す名前と数値にも、自動で同一ルールを割り当てない。通常は名前か数値に統一する。画像の内容・Texture・Spriteの参照同一性は衝突IDではない。

| セルの状態                    | 実効属性                             |
| ----------------------------- | ------------------------------------ |
| 上書きMapにキーなし           | 現在の画像IDの既定。なければ衝突なし |
| 上書きがnull                  | 明示的に衝突なし。画像IDの既定を無視 |
| 上書きがSolid/Triggerのpolicy | 指定policy。画像がnullでも有効       |
| resetCollision                | キーを削除し、継承に戻す             |

`setCollision`にundefinedは渡せない。`getCollision(x,y)`は正規化済みreadonly policyまたはnullを返す。設定はコピー・凍結し、外部オブジェクト変更でキャッシュが古くならない。範囲外はGridと同じ `GRID_BOUNDS`、不正オプションは `INVALID_VALUE`、破棄後の書き込みは既存Tilemapの破棄エラー。設定未作成でもsetCollision/setTileCollisionで遅延作成でき、別の管理オブジェクトを利用者が保持する必要はない。

`collisionEnabled`は既定true。設定のないマップではtrueでも衝突を作らない。`map.enabled=false`は従来の配置無効化として描画・衝突双方を止める。`map.visible=false`は描画のみ、`collisionEnabled=false`は衝突のみ。これらとActor Colliderのenabledの違いをドキュメント・テストで固定する。

## 接触型と互換性

採用案は**既存ContactEnter/Stay/Exitを継続使用し、Contact.otherを判別可能な対象unionへ移行**するもの。selfは従来どおりCollider、selfActorも残す。Actor同士では双方のColliderへ対称通知、Actor対タイルではActor側のColliderへ通知する。初期段階にTilemap自身のイベントbusは追加しない。

```ts
collider.events.on(ContactEnter, (contact) => {
  if (contact.other.kind === "tile") {
    const { map, tileX, tileY, tileId, policy } = contact.other;
    // mapは配置への生きた参照。tileId/policyはこの接触観測時の値。
    console.log(tileX, tileY, tileId, policy.response, map.disposed);
  } else {
    const { actor, collider: otherCollider } = contact.other;
    console.log(actor.id, otherCollider.response);
  }
  // normal/depthは検出時、positionは全補正終了時のワールド位置。
  console.log(contact.normalX, contact.depth, contact.selfPosition);
});
```

対象は `{kind:"collider", actor, collider}` または `{kind:"tile", map, tileX, tileY, tileId, policy}`。tileIdはnullもあり得る。セルの画像がnullでも明示的な衝突上書きがあるため。タイル側に偽のActor/Colliderを作らない。

共通情報はnormalX/Y、depth、response、resolved。normalはselfからother方向の検出時法線、depthは当該パスで記録した最大侵入深さ、responseは**ペアの**実効応答。両者SolidのみSolidで、片方TriggerならTrigger。resolvedは実際に補正を行ったことを示し、最終的な非重複を保証しない。

追加の `selfPosition` / `otherPosition` はWorldPoint。全反復終了後・最初のイベント通知前のTransform原点、またはタイル左上を記録する。offset付き形状の中心や接触点ではない。前のコールバックがTransformを書き換えても、そのパスの観測位置は変わらない。Exitでは前回観測を保持する。イベントpayloadの再利用契約は維持し、履歴保持はコピーする。contactsForは対象の数値情報・座標も含めた独立した値コピーを返すが、Actor/Collider/Tilemap参照は生きた参照。

| 代替                                                     | 判断                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| otherActorをダミーActorで埋める                          | 禁止。所有・寿命・型・識別が誤る                                       |
| otherActor/otherをnullableにし、別のtileフィールドを足す | 不正な組み合わせが表現でき、利用者へ複数の条件判定を要求するため不採用 |
| 別のTileContactイベント群/別World                        | 検出・イベント処理の重複と両方を購読する負担のため不採用               |
| 既存イベントとは別の統一イベントを追加し二重通知         | 移行期間以外に二つの意味が残るため初期案では不採用                     |
| 判別可能なother unionへ明示移行                          | 採用。実験段階のAPIとして型エラーで移行漏れを検出可能                  |

これは**ソース互換性を破る提案**であり、このブランチでは実施しない。Actorの補正量・フィルタ・通知順・Enter/Stay/Exitの物理的意味は維持する。`otherActor`を直接扱うゲームコードを `other.kind === "collider"` の分岐内で `other.actor` へ移す。`Contact.other`をColliderとして使う場合は `other.collider` へ移す。単にotherActorの別名を残してTile接触でundefinedを潜ませない。

既知の移行箇所: `examples/signal-run/logic.ts` の収集/ダメージ処理、`examples/prism-raid/logic.ts` の機体接触/弾命中、`tests/unit/collision.test.ts`、`tests/unit/signal-run.test.ts`、`tests/browser/signal-run.spec.ts`、API/日本語衝突ガイド。他の参照も `rg 'otherActor|ContactEnter|ContactStay|ContactExit'` で全件確認する。型試作には旧来の無条件Actorアクセスがエラーになる例を含めた。

## セルの同一性とイベント

採用粒度はセル。接触の論理キーは `(Colliderインスタンス, Tilemap配置インスタンス, 行優先セルindex, ペアの実効response)`。名前付きIDや画像変更、Sprite、統合矩形ID、チャンク世代、Actor文字列IDはキーにしない。既存Actor対ActorキーはColliderの組のまま。

マップ全体を1対象にすれば接触数は減るが、同時に接触するSolid/Triggerの区別、入ったセル/出たセル、局所破壊の意味が曖昧になる。セル方式は接触領域に比例して状態を保持するコストがあるため、大きいActorの測定を必須とする。マップ単位の集約通知は初期APIへ加えない。

| 次パスでの変化                                           | 契約                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| 初めて観測                                               | Enter                                                               |
| 同じセル・同じペアresponseで継続                         | Stay                                                                |
| 画像だけ変更、またはlayer/mask変更後も同じ応答で通過許可 | Stay。tileId/policyの観測値は更新                                   |
| フィルタ不許可、衝突none、セル削除で継承none             | 前回通知済みの生存ColliderへExit                                    |
| 実効ペアresponseがSolid↔Trigger                          | 旧観測でExit、そのセルの新観測でEnter                               |
| ColliderがTriggerで、タイルだけSolid↔Trigger             | ペアはTriggerのままなのでStay                                       |
| 新規の衝突セル追加                                       | 現在の補正/検出結果に応じEnter                                      |
| Collider/Actor/map/collisionEnabled無効化                | 以後のEnter/Stayを即抑制。次パスで通知済み生存ColliderへExit        |
| Collider破棄                                             | 破棄済み受信側には通知しない                                        |
| Tilemap破棄                                              | 生存Colliderに次パスでExit。map参照はdisposedなのでリソース取得不可 |
| World/Scene破棄・Scene置換                               | 静かに全消去。合成Exitなし                                          |

一度の反復で同じセルを複数検出しても1パスにつき1通知。複数セルは独立して追跡し、Collider発見順 → タイル側の配置発見順 → y,xの行優先順。同じセルでpolicy切替の場合はExit→Enterの順。Actor同士の既存相対通知順を維持し、まずActor対Actor群、その後Actor対Tilemap群を通知する。配信の総順序はこの規則で固定する。

Solidは補正中に実際のセル形状と接触した観測も保持し、後の補正で離れてもそのパスは通知する。Triggerは最終補正位置のみ。統合矩形の外接範囲だけで接触セルを作らず、元のセルと形状の実接触に基づく。将来統合方式を変えても同じ観測集合ならEnter/Exitを変えない。法線や補正順序まで完全に同一となる保証は別の検証事項。

## 更新境界と動的編集

衝突と描画の変更経路を分ける。単一セルの画像setでは旧/新実効policyをO(1)で比較し、衝突が変わる場合だけセル衝突変更を通知する。上書きがあるセルの画像変更は通常衝突不変。policyは値の等価性で比較し、オブジェクトの参照が異なるだけで接触を切らない。

`collisionRevision`は衝突設定・実効衝突内容の変更世代。**接触キーではない。** 内部の通知案は `cell(index)` / `tile(id)` / `all`。setTileCollisionはtile(id)通知のみで、そのIDを使う全セルを走査しない。直接検索では毎回policyをO(1)で解決でき、全体衝突キャッシュ自体が不要。将来のチャンク形状を持つ段階で、ID→利用チャンク索引を測定に基づいて検討する。通常のsetで全体再構築しない。

fillや複数のsetは現在どおり直ちにデータを変更する。Worldはパス開始時から補正・観測終了までゲームのコールバックを呼ばないので、全Gridのスナップショットを毎回複製する必要はない。配信するContactはその時点で完成させる。イベント内の画像/policy編集は次のパスへ反映し、配信中の有効接触集合を再計算しない。追加セルの即時Enterやその場の再補正は行わない。一方、破棄/無効化の寿命チェックは既存契約どおり後続通知を即抑制する。

位置は各パスでワールド値を読む。初期地形は補正重み0の静的対象だが、Tilemapのx/yを明示変更することは許す。次パスで新しい境界を用い、乗客の速度伝達・押し出し保証・CCDを意味しない。衝突属性変更のために表示Spriteの再生成やTextureの再取得を行わない。

## 候補範囲は点の座標変換と別

接触は閉区間なので、Tilemap.worldToTileの半開区間をAABBの両端へそのまま使わない。ワールドAABBをtoleranceで広げ、各軸の候補最小を `ceil((min - origin - tolerance) / tileSize) - 1`、最大を `floor((max - origin + tolerance) / tileSize)` とし、[0,size-1]へclampして空範囲を棄却する。丁度のセル境界では両側を候補とする。接触判定はその後の実形状で行う。回転BoxはワールドAABBで候補を得た後にOBB判定し、AABB重複だけで接触イベントを出さない。

この式は検証済みの有限・正の寸法と有限座標を前提とする。極端な座標/寸法の精度、toleranceの大きさ、derived geometryのoverflow検証を実装試験で維持する。通常の点問い合わせworldToTileの右/下端除外契約を変更しない。
