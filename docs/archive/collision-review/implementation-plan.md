# 正式実装タスクへの引き継ぎ

> Historical design review. The public Contact union proposal is superseded by the [implementation decision](../collision-implementation.md): Actor Contact stays unchanged; dedicated TileContact events share the same internal World/solver. Recorded measurements and counterexamples remain historical evidence, not current Solver throughput.

この資料は設計ブランチの成果であり、Tilemap Collisionの正式実装完了を示さない。元の会話は不要。[契約案](tilemap-contract.md)、[現行調査](README.md)、[測定と限界](performance.md)、`tests/prototypes/`を合わせて読む。

## 決定済み

- 現行CollisionWorldへ接続する。別World、Scene所有モデル、汎用物理エンジン、ControlGuardは作らない。
- Tilemapは任意の衝突設定を持つ。セルActor/Component/Colliderは生成しない。CollisionBodyはActorの補正重みのまま。
- 初期探索はActorのワールドAABBからの直接セル検索。Cameraや描画カリングを使用しない。
- セル形状はセル全体の軸平行矩形、地形の逆質量0。既存Circle/OBBとの判定と逆質量補正を共用する。
- ID既定と疎なセル上書き(nullでnone、resetで継承)、可視性と独立したcollisionEnabled。
- Contact.otherを対象unionへ明示移行し、同じイベント群・問い合わせを使用。型の破壊的変更を移行資料に記載。
- 接触識別はCollider＋配置＋セル＋ペアresponse。最適化用矩形やチャンクのIDを公開の同一性に使わない。
- 全補正後に通知し、イベント編集は次パス、破棄/無効化は後続通知を即抑制。Scene破棄時は静かに全消去。

## 検証すべき仮説・未決事項

1. **継ぎ目対応の実装方式は未確定。** 単純なセル補正は円で接線方向に約3.43 world unitsのずれを再現した。候補の隣接セルが同じActorに対してSolid/フィルタ許可なら、内部面・内部頂点を衝突応答から除外する方式をまず隔離検証する。単なる「法線を軸へ丸める」は凸角やCircle/OBBで誤るため採用しない。必要な外周feature情報の表現、斜め接触、凹角・薄い壁の退化は実装時に決める。探索Aの採用は、応答まで素朴なセル単位で完成するという判断ではない。
2. Actor対ActorとActor対地形の補正を**同一の反復予算**へ入れる。各反復でActor群を既存順に補正し、次にActor/配置/行優先で地形を補正し、再captureして次反復へ進む案を検証する。群間順序による収束・押し付けの影響をテストする。世界を丸ごと作り直さず、現在のscan/solving/deliveryの小さな経路追加を優先する。
3. `selfPosition/otherPosition`のpayloadは値契約を固定しつつ、pair内で座標オブジェクトを再利用するかを割当測定後に決める。contactsForは座標もコピーする。誤って全イベントで同じ一時Pointを共有しない。
4. 多数の独立Tilemapには最初はActor AABB対map boundsのO(A×M)棄却でよいか、計数で判断する。マップ用空間索引は必要が実証されるまで追加しない。
5. 巨大なActor/Triggerの接触状態はセル数に比例する。接触を黙って上限で捨てない。大量セルへの対策は診断と測定を優先し、公開APIにチャンク寸法を要求しない。
6. 深い埋まり、動く地形、極端な座標での数値精度は有限予算で一般解を保証しない。CCD、最近傍空セルへのワープ、移動プラットフォーム速度伝達は別段階。

継ぎ目の解決が小さな局所feature判定で達成できない場合は、その理由と候補を保存して設計を更新する。**未解決のまま「壁沿いに安定移動できる」正式機能として完了させない。** 最適化目的の全体矩形統合へ安易に切り替えない。

## 第1実装段階

| 作業                                | 主なファイル                                                          | 完了条件                                                                            |
| ----------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| コピー/正規化されたpolicyとoverride | `packages/core/src/tilemap.ts`、必要なら小さな `tilemap-collision.ts` | 型推論、重複ID/境界/破棄の検証、値等価性、未設定の描画のみ契約                      |
| 共通Contact対象                     | `collider.ts`、`collision.ts`、`index.ts`                             | discriminator、全フィールド、値スナップショット、既存ゲーム移行と厳密型チェック     |
| map配置の登録・寿命                 | `collision.ts`、既存TilemapLayer                                      | Scene一覧から発見、後付け設定、破棄フック解除、追加の所有モデルなし                 |
| 局所候補範囲と狭義判定              | `collision-geometry.ts`、必要なら `tile-collision-query.ts`           | 閉区間/tolerance対応、回転Box/Circle、負の配置・非正方形セル、隣接featureの受入条件 |
| 同じ反復補正経路へ接続              | `collision.ts`、`collision-response.ts`                               | tile重み0、Trigger非補正、Actor群も再探索、予算/未解消診断、混在角で決定論的        |
| セル接触追跡と動的変更              | `collision.ts`、Tilemap内部通知                                       | image-only Stay、response Exit→Enter、削除/無効化、コールバック編集、観測順序       |
| サンプル・移行資料                  | Tile trail、Signal Run/Prism Raidのhandler、docs/API/siteガイド       | Tile trailで壁/Trigger/破壊を操作、既存サンプル維持、未実装と混同しない説明         |

既存内部関数の型はこの設計ブランチで既に最小限緩和した。`contactManifold`はshape/geometryだけ、`correctPositions`はx/yだけで使える。Actor経路の処理本体は変更していない。狭義判定へ偽のCollider/Transformを渡す必要はない。

## テスト行列

| 分類         | 必須ケースと観測                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actor回帰    | Box/Box、Circle/Circle、Circle/OBB、回転/offset/符号scale/zero scale、layer上位bit/双方向mask、Trigger既定、static/static、dynamic比率、Bodyなし/無効、既存発見順 |
| 更新順       | Input→Update→Integrate→Late→contacts→timers→Scene、Actor追加は更新次step/衝突capture前なら当pass、contact callbackからの追加/移動は次pass                         |
| Contact型    | other.kindの補完、tile座標、Actor用game handler移行漏れ検出、無効名/undefined override/response誤型、WorldPointと画面座標の混同防止                               |
| 単一地形     | 単一Solid/Trigger/空セル、image=null+Solid override、非正方形セル、負配置、丁度の境界/tolerance、マップ外、離れたCamera外でも接触                                 |
| 連続地形     | 長い壁をCircle/回転Boxが両方向へ滑る、凸角/凹角/2壁同時、左右/上下の継ぎ目、混在するフィルタ/Trigger、タイルの大きさやマップ原点を変更                            |
| 複数接触     | 1Actorが複数セル、複数Actorが同セル、Actorと壁の間に別Actor、異なるTilemap同士の重なり、重い/軽いActor、予算1/6/32と残存侵入                                      |
| イベント     | Enter→Stay→Exit、同じ実効policyで画像変更→Stay、override none/reset、Solid↔Trigger、mask変更で不許可/許可維持、複数変更の行優先順、内部形状IDのみ変更→Stay        |
| コールバック | 先のhandlerから対象破棄/無効化、未Enter側へのExit抑制、同イベント内listener削除、地形編集は次pass、エラー集約、再入拒否、Geometry失敗後の回復                     |
| 寿命         | Actor/Collider/map/World破棄、Scene往復、Game.dispose、ステージング失敗、画像ロード待機中でも衝突寿命独立、参照/購読/診断0、Scene終了時合成Exitなし               |
| 性能         | 32²/100²/256²、密/疎、1/多数Actor、巨大footprint、静的/8セル編集、表示数と独立の候補数、複数map、build/update/query/solver/events/cleanup別計測                   |
| ブラウザ     | WebGL/既存Canvas2D、PC/narrow、移動/Camera/壁/Trigger/セル変更、Scene往復、実位置/実ピクセル、未処理Consoleエラーなし                                             |

継ぎ目受入試験は同じ実効Solidの一枚の長方形壁を参照とし、同じ初期位置と意図の軌跡で比較する。最低限、半径10・32セル・60歩(2,2)で接線誤差を1e-6 world units以内にし、逆方向・非正方形・回転Box・凸角で新たな貫通がないことを確認する。浮動小数点スケール別の許容誤差は根拠付きで追加できる。完全な任意形状union/剛体解法の保証へ広げない。

## 診断と性能の完了条件

既存world.diagnosticsのActor候補数の意味を黙って変えない。Tilemap側の `maps / candidateCells / policyRejected / narrowTests / contacts / corrections / unresolved` を区別して追加し、反復による再計数も説明する。表示Sprite数やmap総セル数を衝突候補数として報告しない。

通常の1セルsetはO(1)の書き込み/通知で、次の問い合わせも局所footprintと接触状態に比例する。O(N)の事前矩形化や毎フレームのmap走査を加えない。深い埋まり等で接触が大きい場合は実際のコストを記録する。既存Actor X sweepの二次的最悪例は残すが、Tilemap統合と同時に無関係な再設計で置き換えない。

API・実装・テスト・サンプル・日本語/英語資料が一致し、既存check/unit/build/browserと新規行列が通り、測定値・未解消制約・移行手順がPushされて初めて正式実装を完了とする。今回の設計ブランチの試作成功だけではこの条件を満たさない。

## 保存と統合

次のWorkは、この設計ブランチの最終SHAを確認してから新しい実装用ブランチを作る。main/Sprite/Tilemapへ直接Pushしない。意味のある変更ごとにコミット直後Pushし、長時間検証前にも保存する。通常のfast-forwardのみ。設計ブランチの最終SHAとコミット一覧は `validation.md` とGitHubブランチの履歴で確認する。

このブランチはTilemapの全祖先を含むため、mainとの差分にはSprite/Tilemap実装も含まれる。まずTilemap基点との差分をレビューする。既存Tilemap設計資料の衝突章は初期提案で、Contact型の選択などはこのレビューで具体化した。mainへ取り込む順序/親ブランチの採否は管理者が別途判断する。
