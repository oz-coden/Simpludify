# APIリファレンス

Core/Web v0.1.6ではmouse/gamepad ActionBindingフィールド、MouseSource、mouseEnabled、デバイス競合診断、Game.captureInputを追加しています。次回開発マイルストーンはv0.1.7の予定です。[入力Binding・キャプチャ](./specs/input-bindings.md)で使用例と互換性を説明します。

`@simpludify/core`はDOMに依存しません。[型安全なAction入力](./specs/action-input.md)で論理ボタン／軸、キー割り当て、入力元の合成、更新境界を定義します。`@simpludify/web`はCoreを再exportし、Game、PixiRenderer、ブラウザ入力、DOM UI、スコープ付き標準CSSを追加します。すべてのモードオブジェクトに対応するUnion型をexportします。ルートワークスペースはprivateですが、Core/Webは公開用SDKパッケージです。公開済みレジストリSDKはv0.1.6です。

## 2次元固定サイズデータ（Grid）

`Grid<T>`は`new Grid(width,height,initial)`、`Grid.generate(width,height,(x,y)=>value)`、読み取り専用のwidth/height、`inBounds`、厳密な`get`/`set`、`fill`、`forEach`、`forEachRect`を提供します。Engine・ライフサイクル・描画から独立し、所有権を持たずに参照を保持し、内部的には行優先の非公開Arrayを使用します。初期値の共有、範囲外エラー、走査順序、サイズ上限については[Gridの契約と例](./specs/grid.md)を参照してください。

## 最小のゲームと既定値

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";

const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
```

移動キーを使うには、ゲームのホスト領域をクリックするかTabでフォーカスします。Gameはautofocusしません。parentを省略した場合、ホスト要素はdocument.bodyに追加されます。フルスクリーン表示にするには親要素／ページに高さを指定してください。既定のホストCSSは幅・高さ100%で最小の高さ20remです。エンジンが所有するボタンは決定／ナビゲーションキーを消費しますが、無関係なゲーム用キー割り当ては通過させます。ネイティブのテキスト／数値／Select編集は自身のキーを専有し、ブラウザの移動入力をクリアします。TabはUIおよびページの順序でフォーカスを移動します。[キーボード優先順位とフォーカス](./specs/canvas-ui.md#ホバーとキーボード入力の優先規則)を参照してください。ゲームを取り除く際は`game.dispose()`を呼び出します。

| Game option | 既定値                        | 意味                                                           |
| ----------- | ----------------------------- | -------------------------------------------------------------- |
| parent      | document.body                 | 既存の親要素。Game自身が追加した子要素のみを除去               |
| resolution  | `{ width: 800, height: 450 }` | 正の論理表示範囲（論理解像度）                                 |
| aspect      | Aspect.Fit                    | Fit / Fill / Adaptiveのワールド表示方式                        |
| camera      | `new Camera()`                | 変更可能なx/yワールド原点と正のzoom                            |
| viewport    | full host                     | x/yオフセットを含む、ホストローカルの明示的なCSSピクセル矩形   |
| pixelRatio  | min(devicePixelRatio, 2)      | 物理バッキングバッファ密度。ワールド単位からは独立             |
| theme       | Theme.Dark                    | DarkまたはLightセマンティックトークン                          |
| tokens      | 上書きなし                    | background/surface/text/muted/accent/fontの部分的上書き        |
| seed        | automatic                     | 指定時は検証済みのuint32初期乱数seed                           |
| maxDelta    | 0.05秒                        | Webフレームdeltaの正の上限                                     |
| renderer    | PixiRenderer factory          | 所有されたHTMLElementを受け取り、RendererPortを返す            |
| frames      | RAF driver                    | FrameDriverの要求／キャンセル。コールバックは非同期            |
| onError     | console.error                 | バックグラウンド／UI／破棄処理の監視。致命的でないエラーを通知 |

`Game.gamepads`は所有されたGamepadInputアダプターです。`bind(controller, { index, bindings, deadZone?, mapping? })`は、enabled/clear/dispose、assign、rebindを備えたcontroller所有のGamepadSourceを返します。デバイスのスナップショットとonChangeは、推定されたボタン表示名とは別にブラウザの実際の状態を公開します。[ゲームパッドAPI](./specs/gamepads.md)を参照してください。`ActionSource.enabled`、`KeyboardSource.enabled`、コントローラーごとの`keyboardEnabled`は、readerやActorを差し替えることなく既存の入力経路をゲートします。[入力元の契約](./specs/action-input.md#入力元の有効化とゲームパッドv014)を参照してください。

`Game.add(actor)`は渡されたActor自身を返し、runの前でも実行中でも動作します。`Game.remove(actorOrId)`は現在のSceneの構成員を破棄し、存在していたかどうかをブール値で返します。別のSceneの準備中であっても、これらのメソッドは常に現在のSceneを対象とします。準備中の候補Sceneには、ステージされたcontextのadd/sceneを使用してください。

`Game.scene(id, setup)`は一意のfactoryを登録します。`Game<'menu' | 'play'>`のように型引数を指定すると、コンパイル時にIDを制限できます。Setupはscene、signal、add、ui、onUpdate、onActivate、onDeactivate、onDisposeを受け取ります。非同期setupも許容されます。キャンセル可能な処理にはsignalを使用し、awaitの前に破棄クリーンアップを登録してください。`run(id?)`は共有の起動Promiseを返し、changeSceneの前にこれをawaitします。`changeScene(id)`は準備完了Promiseを返し、直近の保留中IDと同じ重複リクエストはまとめ、異なるIDはキューに入れ、完了後の再訪問では新しいSceneインスタンスを作成します。コミット前のsetupやアセットの失敗では現在のSceneが維持されます。ライフサイクルコールバックのエラーは、コミット後に新しいSceneを維持したまま報告されます。`Game.dispose()`は同期的かつ冪等であり、処理待ちの遷移を速やかに中断します。

`Game.bindViewport(ui, node): () => void`（v0.1.2以降公開）は、マウントされたGame所有のCanvas UIの専用レイアウト領域をワールドViewportに連動させます。解決済みbounds × UI scaleをCSSピクセルで適用し、描画とポインター変換の前に反映します。これはDPRや論理解像度から独立しています。既存のaspect/camera投影はそのまま機能します。UIごとに1つの連動が許可され、再割り当ては安全で、返された解除関数は冪等です。UIまたは領域ノードの破棄により連動は解除されます。準備中のUIは現在のSceneに影響を与えません。`setViewport`による手動フォールバックも維持され、連動解除時に復元されます。非表示・無効・サイズ0の領域はワールドの描画と入力を完全にクリップし、その空領域での変換はワールド上の意味を持ちません。スクロールしない専用スロットを使用してください。これは任意の入れ子マスクではありません。[SDK統合ラボ](../../examples/sdk-integration/README.md)を参照してください。

`Game.whenReady`は観測された現在のプレゼンテーションを同期し、最新の要求に追従して、準備完了した状態を描画してからresolveします。破棄または差し替えられた要求はブロックを停止します。現在の失敗は、無関係な未完了ロードがあっても速やかにrejectします。過去の表示は実行時エラーでも維持されます。プレゼンテーションの破棄は`GAME_DISPOSED`でrejectします。これは独立した画面遷移や将来の代入を待つものではありません。[動的描画と画像待機](./specs/rendering.md)を参照してください。

`fixedStep?: { step?, maxSteps?, maxFrameDelta? }`を指定すると、Webで有界の固定ステップ蓄積を選択できます。省略時は可変RAFが既定です。`Game.playReplay(data, { scene, controllers, expectedMetadata? })`は、最初のScene factory内において、新しいEngineの最初のstepの前に再生を設定します。`stopReplay()`でこれを解除します。[Replayの契約と例](./specs/replay.md)を参照してください。

## ActorとComponent

```ts
import { Actor, Transform, Renderable, Motion } from "@simpludify/core";
const actor = new Actor({ id: "projectile" });
actor.add(new Transform({ x: 100, y: 200 }));
actor.add(new Renderable({ width: 12, height: 12, color: 0xffc87a }));
actor.add(new Motion({ speed: 300, x: 1, y: 0 }));
game.add(actor);
```

Actorオプションは任意のidとenabled（既定true）です。IDを省略した場合は所属Sceneによって自動割り当てされます。IDはScene内で一意であり、Actorは単一のSceneにのみ所属します。所属前または破棄後の`actor.scene`はundefinedです。`actor.state`はActorState.Detached / Attached / Disposedです。`scene.find(id)`でメンバーを検索できます。`scene.actors`は追加順の読み取り専用ロスターです。`scene.remove(actorOrId)`と`actor.dispose()`はActorを破棄します。removeは一時的な取り外しや転送APIではありません。

`actor.add(component)`は追加されたComponentを返します。`actor.get(ComponentType)`は型付けされたインスタンスまたはundefinedを返します。`actor.require`は存在しない場合に`COMPONENT_MISSING`をスローします。`actor.remove(ComponentType)`はブール値を返し、除去されたインスタンスを破棄します。依存先のComponentを先に追加し、依存している側を先に除去してください。1つのActorにつき各Component型は1つのみ、1つのComponentインスタンスにつき1つのActorのみが強制されます。Componentトークンは同一性（identity）に基づいており、デバッグ用の名前を持ちます。`actor.enabled`は更新と可視性をゲートします。`component.enabled`はそのComponentの更新をゲートし、`Renderable.enabled`はさらに描画の可視性をゲートします。依存関係は構造的な制約であり、自動更新スケジューラではありません。

新しく追加されたActorやComponentは次のstepから更新されます。更新中に作成されたActorはすでにSceneのメンバーであり、新しく追加されたColliderは、その新しいActorの最初のComponent更新の前であっても、そのstepの後半の衝突パスに参加できます。除去や無効化は後続の更新に対して即座に有効になります。検索APIは構造変更を直ちに反映します。Componentの実行計画とActorの所属はstep開始時に捕捉されます。step開始時に無効化されていたActorは、step途中で有効化されてもそのstep内では更新されません。返された読み取り専用ロスターを変更してはいけません。

### 標準Component

| Component      | 既定値と挙動                                                            | 必須Component |
| -------------- | ----------------------------------------------------------------------- | ------------- |
| Transform      | x/y=0, rotation=0ラジアン, scaleX/Y=1。有限の初期値                     | なし          |
| Renderable     | width/height=32, Box source, 図形色はmint / 画像色はwhite               | Transform     |
| Motion         | 変更可能なspeed=180単位/秒（0許容）, direction x/y=0                    | Transform     |
| ActionMovement | Axis2D reader, 変更可能なscale=1。Updateでvalue × scaleをMotionへコピー | Motion        |

`Motion.direction`は有限の無次元方向／倍率ベクトルであり、任意のベクトルは自動正規化されません。参照自体は読み取り専用ですが、x/yは変更可能です。`Motion.speed`は有限・非負の変更可能な数値です。Integrateは、コマンドを生成するUpdate Componentの後に`position += direction × speed × delta`を適用し、両方の座標を検証してから反映します。`ActionMovement.scale`は有限・非負（既定1）で、キャプチャされた入力をAction自体を書き換えたり再正規化したりせずに拡大縮小します。Axis2DはActionControllerで既定で正規化されます。[移動の合成・ダッシュ・移行](./specs/movement.md)を参照してください。Transformは生きた可変データであり、呼び出し側は有限値を保つ必要があります。Motionは代入時にspeedを検証し、構築時およびIntegrate時にdirectionを検証し、いずれかの軸をコミットする前に導出座標を検証します。

`Renderable`は検証済みの変更可能なwidth/height、color、source、visible、opacity、zIndexを公開します。コピーおよび凍結されたsourceは`{ kind: "shape", shape: Shape }`または`{ kind: "image", url: string, fit?: SpriteFit }`で、既定はBoxです。画像fitの既定はContainで、Stretchは正の境界全体を満たします。初期色は図形ではmint、画像ではwhiteです。その後のsource変更でも色は保持されます。色は図形を塗りつぶし、画像のRGBに乗算されます。検証された変更はScene構造に触れることなく`Renderable.revision`を進めます。等しい値の代入はno-opです。sourceの変更は依存関係と以前の表示を保持し、新しい画像の読み込みが成功するまで旧表示を維持します。Circleは小さい方の寸法の半分を半径として使用し、Triangleはバウンディングボックスの中心の周りに上向きに配置され、Hexagonはwidth/height境界内で中央に尖った六角形として配置されます。ShapeがColliderの形状を変更することはありません。大きいzIndexは小さいものの上に描画され、等しい深度ではActorの追加順になります。可視性の変更は接触判定を無効化しません。[描画契約と移行](./specs/rendering.md)を参照してください。

`Character(options)`はTransform、Character sourceを持つRenderable、Motion、そして`movement`が指定された場合はActionMovementを備えたCharacterActorプリセットを返します。オプションはid、x/y（400/225）、speed（180）、size（32）、color（図形mint/画像white）、`source?: VisualSource`、`movement?: ActionReader<"axis2d">`です。暗黙に入力が有効化されることはありません。`controls.reader(Actions.Move)`を渡してください。Action名はゲーム側で定義されます。CharacterActor.x/yはTransformへの便利なアクセサーです。そのspeedオプションは`Motion.speed`を初期化するだけであり、これが唯一の基本速度状態です。ActionMovementなしでカスタム移動Componentを追加したい場合はmovementを省略してください。個別の入力／保存パスは存在しません。座標が別の解像度に合わせて自動的にクランプされたり中央揃えされたりすることはありません。

サブパスセーフな画像にはViteのimportまたは`import.meta.env.BASE_URL + 'player.svg'`を使用してください。実行時の画像には同一オリジンまたはCORS対応のソースが必要です。

### 独自Componentの定義

```ts
import {
  Component,
  type ComponentType,
  defineComponent,
  Transform,
  type UpdateContext,
} from "@simpludify/core";
class Drift extends Component {
  static readonly type: ComponentType<Drift> = defineComponent<Drift>("Drift", [
    Transform.type,
  ]);
  readonly type = Drift.type;
  update({ delta }: UpdateContext): void {
    this.actor.require(Transform.type).x += 20 * delta;
  }
}
```

TypeScriptの再帰的な型推論を避けるため、明示的なトークン型注釈を宣言してください。静的な`type`はget/require/removeで使用される識別子です。インスタンスのtypeはその機能自身を識別します。所有権フックにはprotectedの`onAttach`/`onDisable`/`onDestroy`をオーバーライドします。`onAttach`はActorにアタッチされたときに実行されますが、そのActorはまだSceneに所属していない場合があります。依存関係を読み取り、所有リソースを登録することはできますが、ActorのComponent構造を再帰的に変更することはできません。`onDispose(callback)`は取り外し可能なLIFOクリーンアップを登録します。`Component.dispose`はActorを通じて自身を除去するため、依存制約を尊重します。`onDestroy`および所有クリーンアップの間、依存関係は逆順の破棄が行われるまで読み取り可能なままです。Actorがすでに破棄されている場合、新しいリソースの取得や構造変更は拒否されます。Actor全体の破棄中は`actor.scene`はundefinedになります。

既定のフェーズはコマンド計算用の`ComponentPhase.Update`です。グローバルな実行順序は**Input → Update → Integrate → LateUpdate**であり、その後にポスト更新フック（衝突判定を含む）、シミュレーションTween、タイマー、Sceneコールバックが続きます。MotionはIntegrateを使用し、ActionMovementはUpdateを使用します。入力ポリシーは同じstepに対して`adapter.scale`を設定できます。LateUpdateは移動後のクランプや接触前の発射処理用です。フェーズ内ではActor追加順およびComponent追加順が使用されます。依存要件はフェーズを跨いだスケジューリングを意味しません。フレームコンテキストはdelta（秒）とsceneを公開します。これは再利用されるため、将来のフレームのために保持してはいけません。

## Scene・イベント・タイマー

```ts
import { Actor, defineEvent, Scene } from "@simpludify/core";
const Damage = defineEvent<{ amount: number }>("Damage");
const scene = new Scene("arena");
const actor = scene.add(new Actor());
const off = scene.events.on(Damage, ({ amount }) => console.log(amount), actor);
scene.events.emit(Damage, { amount: 2 });
off(); // actorが破棄された際にも自動解除
scene.after(1, () => console.log("one simulation second"), actor);
```

Sceneの状態は**Preparing → Ready → Active → Inactive → Disposed**です。`markReady`は同期処理です。`Engine.activate`は利便性のためPreparing状態のヘッドレスSceneをReadyにしてアクティブ化できます。`Engine.step`は最初の更新の前に既定のSceneをアクティブ化します。EngineによるScene差し替えは旧インスタンスを破棄します。破棄済みまたは非アクティブなインスタンスは再利用できません。アクティブ化の前に`onActivate`を登録してください。UIレイアウトはWebのrun/changeSceneをawaitした後に利用可能になります。`onActivate`/`onDeactivate`/`onPostUpdate`/`onUpdate`/`onDispose`はコールバックを登録し、登録解除関数を返します。登録解除関数自体はクリーンアップを実行しません。非アクティブまたは破棄済みの所有者でリソースを取得しようとするとエラーがスローされます。初期の既定アクティブ化は合成入力を保持し、Sceneの差し替えは入力をクリアします。

`Scene.events`、`Actor.events`、`Component.events`は遅延初期化されるローカルイベントバスです。アプリケーション所有の明示的なスコープには`new EventBus()`および`new Lifetime()`が利用可能です。これらは自身でdisposeしてください。`bus.on(token, handler, owner?)`は冪等な登録解除関数を返します。バスまたは任意の所有者が破棄されると購読が解除されます。同名のイベントトークンであっても互いに区別されます。`emit`は同期的で登録順に配信されます。配信中の追加は次回のemitを待ち、除去は即座に有効になります。異なるトークンのemitは深さ優先でネストできますが、同一バス上での同一トークンの再帰的配信は拒否されます。エラーが発生しても対象の全ハンドラが実行され、失敗は`AggregateError`としてスローされます。Promiseを返すハンドラは`EVENT_ASYNC_HANDLER`を引き起こし、そのrejectionは消費されてエミッターに集約エラーが渡されます。非同期処理は同期配信の外側で明示的に管理してください。

`scene.after(delay, callback, owner?)`は有限・非負の秒を受け付けます。0秒は次のstepで発火します。`scene.every(interval, callback, owner?)`は正の秒数を要求します。どちらもキャンセル関数を返し、アクティブなScene stepでのみ動作し、Sceneまたは任意の所有者と共にキャンセルされます。タイマーの適格性は、ActionコールバックおよびすべてのScene更新フェーズの前の`Engine.step`境界で捕捉されます。更新フェーズ、接触配信、タイマーコールバック、またはScene.onUpdate中に登録されたタイマーは、次のstepで初めて進みます。繰り返しタイマーは1stepにつき最大1回発火し、予定間隔の端数を維持しながら、飛び越えた反復は破棄します。ActorやComponentの無効化（disable）は所有タイマーを一時停止しません。

## TriggerとSolidの接触

```ts
import {
  Actor,
  BodyType,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  ContactEnter,
  Transform,
} from "@simpludify/core";
const world = new CollisionWorld(scene);
const player = scene.add(new Actor());
player.add(new Transform({ x: 100, y: 200 }));
player.add(new CollisionBody({ motion: BodyType.Dynamic, mass: 1 }));
const playerCollider = player.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 13,
    response: CollisionResponse.Solid,
  }),
);
const wall = scene.add(new Actor());
wall.add(new Transform({ x: 150, y: 200 }));
wall.add(
  new Collider({ width: 18, height: 150, response: CollisionResponse.Solid }),
);
playerCollider.events.on(
  ContactEnter,
  ({ otherActor, normalX, normalY }) => {
    console.log(otherActor.id, normalX, normalY);
  },
  player,
);
// イベント購読なしでもプル型で問い合わせ可能
const contacts = world.contactsFor(playerCollider);
```

### 形状・フィルタ・応答ポリシー

1つのActorにつき1つのColliderが許可され、Transformが必須です。Renderableは任意です。Boxは幅・高さ既定32、Circleは半径既定16です。寸法は有限の正数でなければなりません。offsetX/Yはローカル単位で既定0であり、Transformの拡縮・回転に追従します。Boxは独立した軸スケールとラジアン単位の回転をサポートします。Circleは両軸のスケール絶対値が等しい必要があります（さもないと`COLLIDER_SCALE_UNSUPPORTED`）。負のスケールはオフセットを反転し、いずれかの軸が0の場合はColliderが除外されます。Actor.enabledとCollider.enabledが参加をゲートします。Transform.enabledや可視性は影響しません。導出されたワールド幾何がオーバーフローする有限値は拒否されます。

`response`は既定で**CollisionResponse.Trigger**であり、既存のゲームとの互換性を保ちます。これは寸法、オフセット、フィルタと同様に変更不可（immutable）です。変更するにはColliderを一度除去して再追加してください。名前付きの応答値により設定が読みやすくなり、isTrigger/isSensorといった真偽値の反転に頼らず追加ポリシーを許容できます。

layerは既定1（非ゼロuint32）、maskは既定0xffffffff（uint32、0許容）です。**双方の**maskが相手のlayerのビットを含んでいる必要があります。同一のフィルタが検出、位置補正、通知に適用されます。ワールド接触許容値（tolerance）は既定1e-7ワールド単位であり、完全な接触やその許容値内の数値的隙間は接触として判定されます。

| 組み合わせ        | 接触検出・イベント             | 位置補正                                |
| ----------------- | ------------------------------ | --------------------------------------- |
| Trigger / Trigger | あり（最終補正位置で判定）     | なし                                    |
| Trigger / Solid   | あり（最終補正位置で判定）     | なし                                    |
| Solid / Solid     | あり（補正処理中の遭遇を含む） | 有効なCollisionBodyの参加に基づいて実行 |

### CollisionBodyと位置補正

CollisionBodyはTransformを必要とする受動的なComponentです。`motion`は既定で`BodyType.Dynamic`、`mass`は1（有限、正数、逆数も有限）です。Dynamicボディは質量に反比例して移動量を分担します。`BodyType.Static`、無効化されたボディ、または**CollisionBodyが存在しない**場合、補正の重みは0になります。したがって通常のSolidの壁にはボディは不要であり、プレイヤー側がボディを追加することで明示的に補正に参加します。Solid Colliderを持たないボディは衝突を引き起こしません。Motionは移動意図を統合し、衝突パスはその後にTransformの位置を補正します。ソルバーやCollisionBodyがMotion.directionを変更したり、速度を作成したり、ボディを回転させたり、力を積分することはありません。

静的なボディであってもアプリケーションコードから明示的に動かすことができます。Staticは応答の重みであり、Transformの固定ロックではありません。動く床の速度伝達やキネマティックな押し出しは実装されていません。静的ボディ同士の重なりは検出可能ですが分離されません。ボディの無効化や除去はColliderを無効化することなく次回パスの重みを変更します。Colliderの無効化や除去はそれを除外します。

`new CollisionWorld(scene, { iterations: 6, tolerance: 1e-7 })`によりSceneで検出・応答が有効化されます。iterationsは1から32の整数、toleranceは有限・非負でなければなりません。1つのSceneにつき1つのワールドのみ許可されます（`COLLISION_WORLD_DUPLICATE`）。既定の反復回数は有界であり、剛体の完全な安定性を保証するものではありません。

各Engine stepはComponent更新を実行し、次に登録されたポスト更新フックでワールドを実行し、続いてシミュレーションTween、タイマー、Scene.onUpdateを実行します。ワールドはまず適格な幾何形状を検証・捕捉し、次にX境界のスイープ、Y/フィルタの除外、Solidペアの最小移動法線の計算を繰り返し行います。ペアは決定論的な発見順序で補正され、各補正の前に現在の幾何形状が再計算されます。補正によって生じた新しい重なりは後続の反復で考慮されます。移動が不要になるか反復予算が尽きると補正は終了します。最終パスで補正後位置におけるTrigger接触を検出し、現在のSolid接触を記録します。すべてのイベントコールバックは**位置補正の後**に実行されます。

壁に向かう移動は法線に沿って停止し、接線方向の移動量は維持されるため、滑り移動が可能です。狭い隙間、深く食い込んだボディ、多数の密集、小さすぎる反復予算では、めり込みや振動が残る場合があります。`responseDiagnostics.unresolved`を確認してください。衝撃量、反発係数、重力、摩擦、トルク、角運動応答、剛体拘束は存在しません。

これは**離散的（discrete）**な衝突検出です。高速で動く物体は薄い壁をすり抜ける可能性があります。適切に有界なEngine.step呼び出しを使用するか、移動間隔をより小さなEngine stepへ明示的に細分化してください。瞬間移動、スイープ接触、連続的衝突判定（CCD）の普遍的な保証はサポートされていません。WebのmaxDelta上限は時間を制限しますが、あらゆる速度や形状に対する安全性を保証するものではありません。

### 接触のライフサイクルと観測

接触は両ポリシー共通で`ContactEnter`/`ContactStay`/`ContactExit`を使用し、通知される参加者ごとにワールドパス1回あたり1回配信されます（ソルバーの反復ごとではありません）。新しく観測されたペアはEnter、後続パスでも継続するペアはStay、前パスで通知され次パスで存在しないか無効になったペアはExitになります。補正中に遭遇したSolidペアは、その後の補正で分離されたとしてもそのパスでは観測されたままとなり、次パスでExitが続くことがあります。Triggerは補正後の位置でのみサンプリングされます。

ペアは決定論的な発見順序で配信されます。ハンドラの追加や位置の変更は次回のパスに影響します。除去や無効化はその参加者への後続のEnter/Stayを即座に抑止します。Exitは以前に通知された生存Collider（無効化されたものを含む）に届きます。破棄されたColliderには何も届きません。Sceneやワールドの破棄は配信を停止し、合成Exitなしに静かにクリアします。

接触ペイロードには、self/other Collider、selfActor/otherActor、normalX/Y（自身から相手への単位ベクトル）、depth（そのパスで観測された最大の補正前めり込み深さ）、response（有効なペアポリシー）、resolved（このパスでボディを移動させたか）が含まれます。Exitは最後に観測されたペイロードを保持します。イベントペイロードはパス間で再利用されるため、履歴を保持する場合はスカラー値をコピーしてください。`world.contactsFor(collider)`は、現在追跡されている適格な接触の独立した読み取り専用スカラースナップショットを割り当てます。参照されるActorやColliderは生きたオブジェクトのままです。

`world.diagnostics`は整合されたCollider数、追跡中の接触数、X候補数、ナローフェーズテスト数を報告します。`responseDiagnostics`はソルバーパス数、ペア補正回数、最終スキャンでの未解消の可動Solid重なり数を報告します。

## カメラと座標空間

```ts
import {
  Camera,
  createViewTransform,
  worldPoint,
  worldToScreen,
  screenToWorld,
} from "@simpludify/core";
const camera = new Camera({ x: 100, y: 50, zoom: 2 });
const view = createViewTransform({
  viewport: { x: 20, y: 30, width: 800, height: 450 },
  resolution: { width: 800, height: 450 },
  camera,
});
const screen = worldToScreen(view, worldPoint(500, 275));
const world = screenToWorld(view, screen);
```

`WorldPoint`、`ScreenPoint`、`PhysicalPoint`は空間タグを持っており、異なる空間同士の誤った呼び出しは型検査でエラーになります。worldPoint/screenPointは有限の座標を構築します。スクリーン単位はホストローカルのCSSピクセルであり、Viewportのx/yオフセットを含みます。LogicalResolutionは公称の表示範囲であり、バッキングバッファの寸法ではありません。Cameraのx/yは公称表示のワールド左上座標であり、zoomはその範囲の中心を基準とします。Cameraの既定値は(0,0,1)で、非有限の座標や正でないzoomは拒否されます。

`Aspect.Fit`はアスペクト比を維持して中央揃えの黒帯を付け、フィットした矩形にクリップします。`Fill`は比率を維持してViewportに合わせてクロップします。`Adaptive`はViewportのCSSサイズを論理範囲として使用します。`containsScreenPoint(view, point)`は可視クリップ境界内かを検査します。`screenToPhysical(point, dpr)`は描画ピクセルのみをスケーリングし、DPRがワールド／スクリーン変換に含まれることはありません。

`Game.camera`は変更可能です。`Game.view`は現在キャッシュされている投影を返し、worldToScreen/screenToWorldメソッドはこれを使用します。`Game.pointerToWorld({ clientX, clientY })`はホストの境界とスケーリングを考慮してWorldPointを返します。黒帯領域内のクリックを無視したい場合は`containsScreenPoint`を呼び出してください。`Game.setViewport(rect)`は固定CSS矩形を選択し、`setViewport()`はホスト全体の追従を復元します。オーバーレイはホスト全体でレスポンシブであり、Cameraの影響を受けません。

### CameraFollow

`new CameraFollow(camera, { resolution?, bounds?, responsiveness? })`は、任意のワールド空間追従を提供します。resolutionの既定値は800×450、boundsは任意のワールド矩形、responsivenessの既定値は0（即時追従）です。`follow.update(target, seconds)`は有限のx/y点を追従し、負または非有限の時間を拒否します。位置補正の後に追従させるため、Scene.onUpdateなどから呼び出してください。これは購読、Scene、ホストリソースを所有しません。

ビューの中心はターゲットに追従し、camera.zoomを使用して可視端が可能な限り境界内に収まるようクランプされます。ワールドが表示範囲より小さい場合は中央揃えされます。正のresponsivenessはシミュレーション秒あたりの指数平滑化を使用します。0は時間0の更新であっても即座にスナップします。ポインター変換が次のシミュレーションstepの前に新しくクランプされたカメラを使用する必要がある場合、zoom変更時に直ちにfollowerを更新してください。

## ヘッドレス実行

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Engine,
} from "@simpludify/core";
const engine = new Engine({ seed: 42 });
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
});
engine.scene.add(Character({ movement: controls.reader(Actions.Move) }));
const automatic = controls.createSource();
automatic.set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
console.log(engine.snapshot().actors);
engine.dispose();
```

`Engine.step`は上限なしで有限・非負の秒数を受け取ります。すべてのonPressedコールバックを配信する前に、アクティブなすべてのActionControllerを捕捉します。UpdateContextはdeltaとsceneを供給します。入力の依存関係はグローバルの生フレームから読み取るのではなく、明示的に注入されます。`ActionController.value`/button/eventsを読み取るか、型付けされたreaderをComponentに注入してください。[Action入力](./specs/action-input.md)でボタン、軸、合成、割り当て変更、所有権、境界の意味を定義しています。

`Engine.pause/resume`およびWebの`Game.pause/resume`は冪等です。一時停止されたstepはAction入力をキャプチャしonPressedコントロールをディスパッチしますが、その境界でresumeされない限りシミュレーションをスキップします。状態変更により保持された入力と保留エッジがクリアされます。Gameは描画とDOM UIを継続し、フレームのタイムスタンプをリセットします。Sceneの差し替えは入力をクリアし、disposeはコントローラーとソースを解放します。`Engine.random`は実際の初期seedと名前付き独立ストリームを持つ所有されたRandomManagerです。[乱数・Replay・固定ステップ](./specs/replay.md)を参照してください。`Engine.snapshot()`はSceneの状態、経過時間、PRNG状態、デバイスキー診断、一般的なActor/Transform状態をコピーします。

### デバイスアダプターと文字入力

Gameは単一のBrowserInputを自動的に所有し、フォーカスされた物理的な`KeyboardEvent.code`の値を**アクティブなAction割り当てのみ**にルーティングします。ネイティブコントロール、contenteditable、IME変換は除外されます。blur、非表示、フォーカス変更によりブラウザの入力寄与が解放されます。タッチやAI操作には`controls.createSource()`を使用し、合成キーボードイベントを発生させることはありません。

`InputSystem.createKeyboardSource(owner?)`は、キーボードアダプターの実装や物理割り当てのテスト用です。検証済みのKeyCode値のみを受け入れ、個別にdispose可能で、ゲーム状態を読み取ることはできません。`InputSystem.snapshot()`は物理キー診断を報告し、sourceCountはデバイスと論理ハンドルの数をカウントします。暗黙のスクリプトソースは存在しません。`InputSystem.clear()`は生きたハンドルを保持したまま、すべてのソースと保留エッジを静かにフラッシュします。Gameに2つ目のBrowserInputをアタッチしてはいけません。

テキストおよびIMEの確定には、KeyCodeではなくネイティブのinput/textareaのvalue、input、およびcompositionイベントを使用します。[タイピングレシピと現在の制約](./specs/action-input.md#文字入力タイピングゲーム)を参照してください。Canvasテキスト編集はCoreで論理ドラフト／選択／変換契約を保持し、ネイティブ編集／IMEをHostに委任します。[ネイティブ文字編集契約](./specs/text-input-design.md)を参照してください。

## Canvas UIとPointer

Webの`context.actions(definitions, bindings?)`は、factoryのSceneとGame入力を使用してActionControllerを作成します。`game.actions`は現在のSceneを使用します。Coreの明示的な構築も変更ありません。`context.canvasUI(root, { scale? })`はステージされた単一のCanvasツリーを所有し、`game.canvasUI`はrunの前に既定のSceneを設定します。CoreのCanvasPanel / Row / Column / Scroll / Label / Button / HoldButton（Webによって再export）は、検証済みのスタイル変更、テキスト変更、可視性、有効化、ノードイベント、およびScene連動のクリーンアップを公開します。有界なFlexサブセットがダーティな幾何形状／コンテンツでのみ実行されます。UI単位はホストCSSピクセル / UI scaleであり、CameraやDPRから独立しています。

`context.pointer.events`（または現在の`game.pointer.events`）は、ワールド専用のPointerDown / Move / Up / Cancel / Clickを受信します。ノードは自身のイベントバスを通じて型付けされたPointerイベントを受信します。Downによって解放までのルーティングが固定されます。元の祖先スクローラーは、以前のターゲットをキャンセルした後にUIドラッグを要求できます。ワールドジェスチャーは固定されたままです。キャプチャは自動です。ネイティブの透明なボタンミラーが描画フォーカス付きでTab/Enter/Spaceを提供します。これらはポインターのヒットテストを実行しません。DOM UIも維持されます。[完全な契約・例・制約](./specs/canvas-ui.md)を参照してください。

## DOM UIとスタイリング

`Label(text, { muted? })`はsetTextを公開し、テキストが変更されたときのみ購読者を更新します。`Button(text, handler)`はネイティブボタンであり、ハンドラはマウント解除時に中断されるAbortSignalを受け取ります。非同期ハンドラの実行中は自身を無効化し、失敗を報告します。`HoldButton(text, onHold)`はマウス／タッチポインターおよびEnter/Spaceにわたるブール値の保持状態を報告し、同時ポインターにも対応します。押し続けによる重複コールバックは発生しません。解放、ポインターキャンセル、キャプチャ喪失、blur、非表示、UI破棄によって関連する保持が解放されます。独立して解放可能なコントロールグループごとに個別のActionSourceを使用してください。`Panel(children, { title?, layout?, placement? })`は既定でLayout.ColumnとPlacement.Topを使用します。Rowは折り返し、Gridは自動配置します。パネルは内在サイズ、最大幅30rem、セーフエリアの間隔、ネイティブオーバーレイのスクロールを使用します。テキストはtextContentで挿入されます。空のオーバーレイ領域はポインターイベントをワールドへ通過させます。

`Theme.Dark/Light`と部分的なtokensでタイポグラフィと色を上書きできます。色トークンはホストブラウザが受け入れるCSS色でなければなりません。背景はbackground-colorとして適用されるため、画像関数はサポートされません。フォントトークンは引用符／エスケープされたCSSファミリ名とフォールバックスタックを受け入れます。不明なテーマ名は`INVALID_THEME`、不明なトークン名、空の値、不正な色または安全でないフォント構文はホストDOM作成前に`INVALID_THEME_TOKEN`をスローします。パッケージ化されたフォントには通常の@font-faceを使用します。Tab/Enter/Spaceはネイティブボタン操作を保持します。

## Rendererポート・診断・移行

`RendererPort`はinit()、prepare(scene)、resize(cssWidth, cssHeight, dpr)、dispose()を公開します。`PreparedScene`はrender(view)、任意のready()、dispose()を公開します。描画は生きた状態を読み取ります。カスタムアダプターはキャンセル、構造変更、および冪等なクリーンアップを処理しなければなりません。PixiRendererはRenderer内で解決されたURLによって画像を共有します。Visualは独立した外観と保留中／コミット済みのリースを保持します。最後の解放によってロードの中断または共有Texture/TextureSourceの破棄が行われます。診断機能は要求に応じてpresentations、visuals、textures、imageReferences、imageEntries、pendingImagesを返します。pendingImagesは待機中のVisualではなく、一意の基底ロード数をカウントします。[画像共有・URL同一性・準備完了](./specs/rendering.md)を参照してください。

`EngineError`はcode/message/detailsおよびtoJSONを保持します。所有権／状態の診断には、ACTOR_OWNERSHIP、DUPLICATE_ACTOR、COMPONENT_OWNERSHIP、COMPONENT_MISSING、COMPONENT_DUPLICATE、COMPONENT_CYCLE、COMPONENT_REQUIRED、COMPONENT_PHASE、SCENE_STATE、SCENE_OWNERSHIP、TRANSITION_REENTRANT、STEP_REENTRANT、EVENT_REENTRANTが含まれます。破棄されたスコープは新しいリソースの取得を拒否します。ユーザーエラーは通常のError/AggregateErrorのままです。

この実験的リビジョンでは、非推奨となった古いストレージAPIが意図的に削除されています。

| 以前のAPI                                                  | 現在のAPI / 理由                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| CharacterState プレーンオブジェクト                        | CharacterActor 合成プリセット。カスタムオブジェクトは Actor + Component を使用         |
| Scene.characters / Scene.seal                              | 動的メンバーシップを持つ Scene.actors。封印されたロスターは廃止                        |
| Character の直接の keys/speed/size/color/sprite フィールド | ActionReader を注入。Motion または Renderable を get/require。x/y 便利アクセサーは維持 |
| snapshot().characters                                      | 任意の transform を持つ snapshot().actors                                              |
| GameOptions.world                                          | 責務ごとに分離された resolution + aspect + camera + viewport                           |
| viewTransform / WorldView                                  | 明示的な論理解像度、カメラ、Viewport を持つ createViewTransform                        |
| Renderer.prepare(characterList), resize(...worldView)      | prepare(scene), resize(cssWidth,cssHeight,dpr), render(view)                           |

また、InputState、InputSource、InputReader、KeyMap/KeyMaps、Movement、KeyboardControllerも削除されています。Characterは明示的なAxis2D ActionReaderを受け取ります。UpdateContextに生の入力は含まれなくなりました。

## Loggerと診断

`game.logger` で `debug`、`info`、`warn`、`error` を使えます。`new Game({ logging: { console: false } })` でConsole出力を停止します。`minimumLevel` はConsoleの最低レベル、`deduplicate: false` は連続する同一ログの出力抑制を無効にする設定です。

`game.logger.subscribe(handler, owner?)` は出力設定にかかわらず、重複を含む診断を受け取ります。戻り値で購読解除でき、`LifetimeOwner` を指定すると所有者の破棄にも連動します。コールバックの例外と同期的な再帰ログは診断の配信境界で処理します。Loggerは履歴を保存しません。

診断は `code`、`source`、`fatal`、`details`、元の `cause` を保持できます。`fatal` は処理側の停止判断を表し、`logger.error()` 自体はゲームを停止しません。エンジンのConsoleと画面には安全な要約を表示します。従来の `GameOptions.onError` を使っていたコードは、`game.logger` を購読して構造化された診断や `cause` を扱えます。

## Asset管理

`game.assets.load({ kind, url })` はすぐに安定したハンドルを返します。最初の利用可能な結果を待つには `handle.ready` を使います。画像では `handle.source` を `Renderable` に、`handle.source.url` を `SpriteSheet` に渡せます。Sceneのセットアップで受け取る `assets` は、そのSceneの完全破棄に連動します。`game.assets.scope()` は同じAPIを持つ個別に破棄可能なスコープを作ります。所有者ごとに参照を解放でき、同じAssetの取得と実リソースは共有されます。

```ts
const hero = assets.load({ kind: "image", url: "./hero.png" });
await hero.ready;
actor.add(new Renderable({ source: hero.source }));
```

`assets.cacheEntries` は成功した未使用Assetの最大保持数です。既定値は16で、0では最後の参照が外れた時点で解放します。描画側も独立した参照を持ちます。画像のロード失敗時は設定された `assets.fallback.image`、または内蔵の市松模様を使います。JSONは利用可能な値が得られなければ拒否されます。正常画像が得られると既存のVisualを更新します。使用中のアトラスフレームが不正になる差し替えは確定前に拒否します。

`handle.reload()` は現在の利用可能な値を維持しながら再読み込みします。通常失敗を一度だけ再試行するには `retry.once` に `"immediate"`、`{ delayMs }` または `{ until: promise }` を指定します。通信エラーやHTTP 408、429、5xxに対する `retry.network` は追加試行回数0〜5です。待機時間を含むロード期限の既定値は30秒です。処理を共有する場合は最初のロードの方針を使います。Fallbackが利用可能になった時点で `ready` が解決し、再試行は背景で継続できます。

進捗は `assets.progress`、`assets.onProgress(handler)`、`handle.progress` で取得できます。Game全体では各スコープの稼働中のAssetを重複なく集計します。個別のスコープをバッチ単位としても使えます。完了数には最終的な失敗や利用可能なFallbackも含まれ、ロード中の件数には背景の再試行も含まれます。

## SpriteSheetとSpriteAnimation

[Spriteの契約と例](./specs/sprites.md)で、グリッド／名前付き／矩形の画像ソース、シミュレーション時間での再生、Renderable sourceの所有権、遅延境界検査、共有切り抜き／ソースのクリーンアップを定義しています。どちらのAPIもCoreおよびWebからexportされています。SpriteAnimationはRenderableを必要とし、LateUpdateで実行され、ホストタイマーや非同期Coreライフサイクルを追加することはありません。

## Tilemap配置

[Tilemap](./specs/tilemap.md)は、マップごとに1つの既存Actor/TilemapLayer配置をラップするファサードです。Grid/行データをコピーし、型付けされたタイルID、set/fill、タイル／ワールド変換、平行移動、深度／可視性を公開します。Webはカリングされた増分可視セルレンダラーと共有シートリースを所有します。任意の[地形衝突](./specs/tilemap-collision.md)は、同じCollisionWorldをID既定値／セル上書きおよび専用のTileContactイベントと共に使用します。セルごとのActor/Componentは追加されません。

Canvasパネルは、破棄を伴わない`move(child, finalIndex)`および集約クリーンアップを伴う`clear()`もサポートします。CanvasUIは論理フォーカスとスクロール境界を所有します。[Canvas契約](./specs/canvas-ui.md)および[Host境界](host-boundary.md)でスクロール範囲、厳密なテキストメトリクス、ネイティブAbortSignal互換性、移植可能なCancellationSignalを扱っています。

CanvasScrollはノードごとのdragScroll/inertia/scrollbar/dragThreshold、直接のつまみ操作、キーボードスクロールをサポートします。[スクロール契約](./specs/scrolling.md)で既定値、タイムスタンプ、Coreのadvance(seconds)、実行時変更、キャンセルを扱っています。オフセットのみの更新はFlexを繰り返さずにキャッシュされたレイアウトを投影します。

## 標準Canvas値コントロール

Core/Webの`CanvasCheckbox(label, { checked?, readOnly? }, style?)`および`CanvasSlider({ label?, min?, max?, step?, value?, readOnly? }, style?)`は型付けされたCanvasInputNodeサブクラスを返します。値、onChange/onCommit/onCancel、実行時範囲更新、読み取り専用の挙動、ライフサイクルは[Canvasコントロール](./specs/canvas-controls.md)で定義されています。どちらもCanvasUIのフォーカスとPointerRoutingを再利用し、CoreはHostから独立しています。`CanvasSelect(options, config?, style?)`、`CanvasTextInput(options?, style?)`、`CanvasNumberInput(options?, style?)`は受け入れ値、ネイティブドラフトセッション、フォーカス、ライフサイクルのクリーンアップを追加します。[ネイティブ文字編集契約](./specs/text-input-design.md)でオプション、数値解析、キーボード操作、Host移行を定義しています。

## Tweenと表示アニメーション

[数値Tweenリファレンス](./specs/tween.md)でTween、Easing、TweenScheduler、Playback、Scene/Gameクロック、actorTween、canvasTween、sliderTweenを定義しています。すべてCoreおよびWebからexportされています。Renderableの描画オフセット、相対回転／拡縮、Canvas表示は、ワールド物理やFlexレイアウトから独立しています。既存のSpriteAnimationはソース／フレーム再生を担当し続けます。カスタムHostは`Scene.advancePresentation`を通じて明示的な表示秒数を供給し、Webは自動的にこれを供給します。

Tilemapは新しいワールド空間セル矩形を取得する`tileBounds(x,y)`も提供します。`CollisionWorld({ tileSearch: "rectangles" })`は、オプションで遅延16×16チャンク内の同ポリシー候補領域をマージします。既定の`"cells"`は直接検索を維持します。[地形契約](./specs/tilemap-collision.md#任意の矩形候補探索tilesearch-rectangles)を参照してください。

## 多角形タイル幾何（TileGeometry）

[幾何タイル](./specs/tile-geometry.md)は、TileGeometry.square/triangle/hex、有限のGeometryTilemap RGB/nullレイヤー、決定論的な多角形選択、隣接／範囲、Actor Shape.Hexagonを規定します。既存の正方形画像Tilemapおよび円／箱Collisionはそのまま機能します。多角形の画像や物理演算は含まれません。

CanvasLabelは文字列またはCanvasLabelOptions（textと任意の`role: "status" | "alert"`、または`role: "heading"`と`level: 1..6`）を受け取ります。これらの作成時テキストセマンティクスはフォーカス／ポインター所有権を追加せず、Webが見出しやアトミックライブ領域のセマンティクスを供給します。[セマンティックLabelテキスト](./specs/canvas-ui.md#sdk-013の入力改善)を参照してください。

## 仮想ポインターコントロール

`context.virtualInput` / `game.virtualInput`は、既存のActionSourceを使用してScene所有のVirtualStickおよびVirtualButtonコントロールを作成します。[仮想入力の契約](./specs/virtual-input.md)で固定・浮動・追従モード、相対／画面／カスタムの有効化領域、放射状の正規化、独立した可視性／有効性、任意のドラッグ方向、hold/end/cancelコールバック、調停を定義しています。同一のPointerRoutingがCanvas UI、仮想コントロール、ワールドジェスチャーを所有します。Canvas UIが最優先され、仮想ボタンはスティックを上書きし、同じ優先度の曖昧な仮想領域は拒否されます。指が交差しても物理ポインターの同一性が入れ替わることはありません。
