# APIリファレンス

現行のAPI・既定値・寿命・入力境界を日本語で整理します。対応する[英語API](../en/api.html)と各分野の詳細ガイドも参照できます。現在のソースはv0.1.4候補、公開済みSDKは0.1.3です。

## パッケージと対応範囲

`@simpludify/core`はDOM/Node/Pixiに依存しません。`@simpludify/web`はCoreを再exportし、Game・PixiRenderer・BrowserInput・DOM UI・CSSを追加します。ルートワークスペースはprivateですが、Core/Webは公開用SDKパッケージです。

| 用途             | 主な公開API                                                                                                         | 詳細                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Web起動・遷移    | Game, GameOptions, SceneContext                                                                                     | [英語API](../en/api.html#minimal-game-and-defaults)                 |
| Actor構成        | Actor, Component, defineComponent, ComponentPhase                                                                   | [基本概念](concepts.md)                                             |
| 標準Component    | Transform, Renderable, Motion, ActionMovement                                                                       | [英語API](../en/api.html#built-in-components)                       |
| 描画の状態       | Renderable, RenderableOptions, VisualSource, Shape, SpriteFit                                                       | [動的描画と画像待機](rendering.md)                                  |
| 2次元データ      | Grid, GridVisitor                                                                                                   | [Gridの生成・走査・範囲](grid.md)                                   |
| 高水準プリセット | Character, CharacterActor                                                                                           | [最初のゲーム](getting-started.md)                                  |
| Scene・通知      | Scene, SceneState, EventBus, defineEvent, Lifetime                                                                  | [SceneとUI](scenes-ui.md)                                           |
| 時間・入力       | Engine, Action, defineActions, ActionController, ActionSource, KeyCode, ActionReader, KeyboardBindings, InputSystem | [入力ガイド](input.md)                                              |
| 衝突             | Collider, CollisionShape, CollisionResponse, CollisionBody, BodyType, CollisionWorld                                | [衝突ガイド](collision.md)                                          |
| 接触通知         | ContactEnter, ContactStay, ContactExit, Contact                                                                     | [接触契約](../en/api.html#contact-lifecycle-and-observation)        |
| 座標・追従       | Camera, CameraFollow, WorldBounds, Viewport, LogicalResolution, Aspect                                              | [描画ガイド](rendering.md)                                          |
| 空間変換         | worldPoint, screenPoint, createViewTransform, worldToScreen, screenToWorld, containsScreenPoint, screenToPhysical   | [座標契約](../en/api.html#camera-and-coordinate-spaces)             |
| DOM UI           | Label, Button, HoldButton, Panel, Layout, Placement, Theme                                                          | [UI契約](../en/api.html#dom-ui-and-styling)                         |
| 拡張・診断       | RendererPort, PreparedScene, FrameDriver, EngineError, PixiRenderer                                                 | [拡張契約](../en/api.html#renderer-ports-diagnostics-and-migration) |

## よく使う既定値

| 設定                                  | 既定                                        |
| ------------------------------------- | ------------------------------------------- |
| Game resolution / aspect              | 800×450 / Aspect.Fit                        |
| Camera x / y / zoom                   | 0 / 0 / 1                                   |
| Web maxDelta                          | 0.05秒                                      |
| Character x / y / speed / size        | 400 / 225 / 180単位毎秒 / 32                |
| Character movement                    | 省略（Axis2D ActionReaderを明示して有効化） |
| Collider shape / response             | Box / Trigger                               |
| Collider box / circle                 | 幅・高さ32 / 半径16                         |
| Collider layer / mask                 | 1 / 0xffffffff                              |
| CollisionBody motion / mass           | Dynamic / 1                                 |
| CollisionWorld iterations / tolerance | 6 / 1e-7世界単位                            |
| CameraFollow responsiveness           | 0（即時追従）                               |

## 寿命と失敗の扱い

`Game.run/goTo/whenReady`はPromiseで、呼び出し元がrejectを扱います。Coreの更新・イベントは同期です。イベントからPromiseを返さず、非同期のUI操作にはButtonなどホスト側の契約を使います。

`Game.dispose`、Scene/Actor/Componentの破棄は冪等です。破棄済み所有者への新しい資源取得や不正なComponent依存は診断されます。更新中の変更はエラー時に巻き戻しません。Scene準備中の失敗とコミット後の通知失敗を区別します。

## ソースを読む

- [Core公開export](https://github.com/oz-coden/Simpludify/blob/main/packages/core/src/index.ts)
- [Web公開export](https://github.com/oz-coden/Simpludify/blob/main/packages/web/src/index.ts)
- [GameとSceneContext](https://github.com/oz-coden/Simpludify/blob/main/packages/web/src/game.ts)
- [Collider](https://github.com/oz-coden/Simpludify/blob/main/packages/core/src/game/collider.ts)、[CollisionBody](https://github.com/oz-coden/Simpludify/blob/main/packages/core/src/game/collision-body.ts)

未実装の構想はAPI一覧へ混ぜず、[制約とロードマップ](limitations.md)へ記載します。

## SpriteSheet・SpriteAnimation

[フレームとアニメーションのガイド](sprites.md)に、型推論を使う定義・再生操作・画像共有・破棄・失敗時の契約をまとめています。

## Tilemap

[Tilemapガイド](tilemap.md)に、Grid／行列、名前付きID、配置、座標変換、セル更新、画像共有と破棄をまとめています。任意の衝突属性とTileContact専用イベントを既存CollisionWorldへ統合しています。[衝突ガイド](collision.md)も参照してください。

## Canvas UIとPointer

Sceneの`actions`ヘルパー、`canvasUI`、`pointer.events`を追加しています。既存DOM UIとActionControllerを維持します。[Canvasガイド](canvas-ui.md)を参照してください。

## Gameの生成・準備・遷移

| option              | 既定と単位                                                |
| ------------------- | --------------------------------------------------------- |
| parent              | document.body。Game自身の子要素だけを追加・除去           |
| resolution / aspect | 800×450の論理範囲／Aspect.Fit                             |
| camera              | new Camera()。x/yはワールド左上、zoomは正                 |
| viewport            | Host全体のCSSピクセル矩形。オフセットを含む               |
| pixelRatio          | min(devicePixelRatio,2)。描画の物理密度で世界座標ではない |
| theme / tokens      | Theme.Dark／上書きなし。色とフォントを検証                |
| seed                | 自動。指定時はuint32の乱数初期seed                        |
| maxDelta            | Webのフレームdelta上限0.05秒。Core.stepの上限ではない     |
| fixedStep           | 省略時は可変RAF。指定時は有界の固定ステップ蓄積           |
| renderer / frames   | PixiRenderer factory／RAF driver。フレーム通知は非同期    |
| onError             | console.error。バックグラウンド・UI・cleanup失敗を通知    |

Gameはautofocusしません。親要素とページに高さを与え、クリック／Tabでゲームへfocusします。scene(id,setup)のfactoryはscene/signal/add/ui/canvasUI/actions/pointer、2つのTween時計、onUpdate/onActivate/onDeactivate/onDisposeを受けます。非同期準備ではawaitより先にcleanupを所有させ、HostのAbortSignalを使います。

run(id?)は共有の起動Promise、goTo(id)は準備完了Promiseです。同じ保留先はまとめ、別の先は順番に処理し、完了後の再訪は新しいSceneを作ります。runをawaitしてからgoToします。準備・アセットのコミット前失敗は旧Sceneを維持し、コミット後の通知失敗は新Sceneを保って報告します。disposeは冪等で、保留中の起動・遷移を速やかに中断します。

add/removeは現在のSceneを対象にし、準備中の次Sceneにはfactoryのadd/sceneを使います。removeは破棄で、再利用できる取り外しではありません。whenReadyは観測時の現在プレゼンテーションの最新要求に追従して描画まで同期しますが、別の遷移や将来の変更全体を待つPromiseではありません。

bindViewport(ui,node)はv0.1.2以降のCanvas専用slot連動です。解決済みbounds×UI scaleをCSSピクセルへ変換し、Camera/DPRと分離します。UIごとに1つ、再割り当て・解除は安全で、UI/node破棄・非表示・無効・空領域を扱います。準備中のUIは旧投影を変えません。[レイアウト](layout.md)を参照してください。

## Scene・Engine・更新境界

SceneはPreparing→Ready→Active→Inactive→Disposedの同期状態です。Webが非同期準備を終えてコミットし、CoreのmarkReady/activateを非同期化しません。Engineの既定Sceneは最初のheadless stepで活性化できます。交換した旧Sceneは破棄し、同じ破棄済みSceneを再活性化しません。

Engine.step(seconds)は有限・非負の秒を要求し、Core側で自動上限は掛けません。0秒も入力境界です。不正なdeltaや再入stepは入力を消費しません。Actor/Component/Timerの適格性を捕捉し、live Adapterを読み、全Controllerを凍結してからonPressedを配信します。その後Input→Update→Integrate→LateUpdate→接触→simulation Tween→Timer→Scene.onUpdateの順です。追加は次step、除去／無効化は残りの処理を直ちに抑止します。入力コールバック中の書き込みは次の入力境界です。

pauseはシミュレーションを止めますがAction捕捉・onPressed、Web表示とUIは継続します。入力コールバックでresumeすると、そのstepのdeltaでシミュレーションできます。Component中のpauseは次stepからです。pause/resumeの状態変更とScene交換は全体入力を無音でflushし、Source単体の解放による通常releaseと区別します。

Scene.onUpdate/onPostUpdateなどの同期コールバックはPromiseを返しません。型付きEventBusはdefineEvent、on(type,handler,owner?)、emit、disposeを使います。登録順に同期配信し、同じイベントへの再入と非同期handlerを拒否し、失敗を集約します。所有者の破棄で解除します。

scene.after(delay,callback,owner?)は有限・非負秒、every(interval,callback,owner?)は正の秒です。解除関数を返し、Scene／任意所有者で終了します。0秒afterも次stepからです。Timer適格性はstep境界で決まり、更新・接触・Timer中の追加は次stepから進みます。繰り返しは1stepに最大1回で、取り逃した回数を捨てて周期の端数を維持します。Actor/Componentの無効化だけでは所有Timerをpauseしません。

## Actor・Component・移動

Actorの既定enabledはtrue、IDはSceneが自動付与でき、Scene内で一意です。1つのSceneへ所属し、find(id)、add/remove、actor.disposeを使います。get(ComponentType)は任意、requireは欠落時COMPONENT_MISSINGです。同じ型の重複・共有インスタンス・依存循環・依存先の先行除去を拒否します。defineComponentの依存型を先に追加し、onAttach中の構造編集はロールバック可能性のため拒否します。破棄は逆の所有順で全cleanupを試行します。

Actor.enabledは更新と表示、Component.enabledは自身の更新を抑止します。Renderable.enabledは表示にも作用します。受動的なTransformを無効化しても依存動作全体は停止しません。ActionMovementは無効化／除去でMotion.directionを解放します。

Transformは有限x/y、ラジアンrotation、scaleを保持します。Motionはdirection×speed×deltaをIntegrateで反映し、speedは有限・非負、既定180単位/秒です。directionは自動正規化しません。ActionMovementは注入したAxis2D ReaderをUpdateで読み、scale（既定1）を掛けてMotionへ供給し、Sceneの一致とController破棄を扱います。CharacterはTransform・Renderable・Motion・任意ActionMovementの構成プリセットで、入力省略時は移動入力を読みません。

## Action・入力元・ゲームパッド

Action.button/axis1D/axis2D/axis3DをdefineActionsへ渡します。識別子は同名でも別定義なら別物です。Buttonはboolean、Axis1Dは[-1,1]の有限数、Axis2D/3Dは正しい成分だけを持つベクトルです。Source.setは検証してコピーし、別Action・非有限値・範囲外・次元違いを拒否します。

ActionControllerはButtonをOR、軸を成分加算して[-1,1]へclampします。2D/3Dの既定は長さ1以下への正規化で、normalize:falseなら独立成分を保持します。1未満のアナログ強度は維持します。value/reader/snapshot/frameは捕捉済み状態で、読むたびにedgeを消費しません。ButtonStateはheld/pressed/released/pressCount/releaseCount、eventsは順序付きButton遷移です。境界間のdown/upは両edgeを保持しますが、Axisの往復はコマンドとして蓄積しません。

rebind/addBindings/removeBindings/resetBindings、getBinding/conflicts、version:1のexportBindings/importBindingsはキーボード設定を扱います。importは全項目を検証してから適用し、変更Actionの保留edgeを捨てて現在の物理キーへ追従します。プログラムSource値は維持します。永続化はアプリの責務です。

v0.1.4ではActionSource／KeyboardSource.enabled、Controller.keyboardEnabledとconstructorのkeyboard:falseを追加します。Source無効化は保持を解放し、再有効化で復元しません。Controllerキーボードを戻す場合は既存holdを離してから押します。createSource(owner?)の全SourceをControllerが所有し、任意のActor/Component/Lifetimeが寿命を短縮できます。

Game.gamepadsはWebのGamepadInputです。bind(controller,{index,bindings,deadZone?,mapping?})はGamepadSourceを返し、assign/rebind/enabled/clear/disposeで操作します。GamepadButton/Axisは標準物理位置、GamepadBindingsは再利用可能なデータ、gamepadButtonLabelは上書き可能な表示名です。事実のGamepadInfoとinferredLayoutを分離し、非標準mappingは明示rawだけ受け付けます。全割り当て入力のneutral後に復帰し、機器交換・切断・再開で保持を残しません。詳しくは[入力](input.md)と[ゲームパッド](gamepads.md)を参照してください。

## 描画・画像・カメラ

Renderableはwidth/height/color/source/visible/opacity/zIndexを検証し、独立したrevisionを持ちます。sourceはshapeまたはimageで、SpriteFitはContain既定／Stretchです。色はshapeの塗り／画像RGBの乗算です。Shape.Character/Box/Circle/Triangle/Hexagonの見た目とColliderは別です。depthが同じならActor挿入順、単なる移動・外観変更で画像を再ロードしません。

画像差し替え中は旧表示を保ち、世代・所有権で古い結果を拒否し、現在の失敗は報告して回復できます。whenReadyは最新の現在要求へ追従し、無関係な保留に永久待ちしません。Renderer単位の共有画像leaseで同一URLを統合し、最後の参照がpendingをキャンセル／Textureを破棄します。許可する画像schemeはhttp/https/data/blob/fileで、script/custom schemeはASSET_LOAD_FAILEDです。URLのquery/fragment等は解決結果に保持します。

Cameraはx/y=0、zoom=1が既定。worldPoint/screenPointは空間の型を区別し、worldToScreen/screenToWorldは逆変換です。Aspect.Fit/Fill/Adaptive、Viewport、Game.pointerToWorld、containsScreenPointでHost・世界・余白を区別します。CameraFollowは任意のresolution/bounds/responsivenessを持ち、0なら即時、正なら秒に基づく指数追従です。接触補正後などに明示的updateを呼び、DPRを渡しません。[描画](rendering.md)を参照してください。

## 衝突の契約

ColliderはTransformを必要とし、Circle／回転Box、有限正の寸法・radius、局所offset、layer/mask、responseを持ちます。既定responseはTriggerです。両者のmaskが相手layerを含む組だけ判定し、両ColliderがSolidの場合だけ位置補正します。表示形状と衝突形状を自動的に一致させません。

CollisionBodyのDynamic/Staticとmassはresponseと独立です。Bodyなしは不動、Dynamic質量は有限正で、逆質量に従って有界の位置補正を配分します。反発・摩擦・重力・角力学・CCDではなく、密集・深い重なり・狭所・高速移動の完全解決を保証しません。responseDiagnostics.unresolvedを確認し、delta／速度／形状を調整してください。

ContactEnter/Stay/Exitは安定した発見順で通知し、payloadはself/other Collider・Actor、単位normal、depth、response、resolvedを持ちます。payloadを保持したい場合は必要なスカラーをコピーします。除去／無効化は後続通知を抑止し、生存した既通知先へExitします。破棄済み対象やScene全体破棄へ人工的Exitは送りません。contactsForは現在の適格な接触の独立スカラーsnapshotです。手動world.stepはactive Sceneで追加passを実行し、再入は拒否します。

TilemapのID／cell衝突属性とTileContactは既存CollisionWorldへ統合します。ActorのContactとタイル座標通知を区別し、既定cell探索と任意のrectangle候補探索を選べます。単色のGeometryTilemapは多角形物理を追加しません。[衝突](collision.md)と[Tilemap](tilemap.md)を参照してください。

## Canvas・DOM UI・文字編集

Canvas UIはSceneごとに1つのCoreツリーで、CanvasPanel/Row/Column/Scroll、Label/Button/HoldButton、値コントロールを合成します。幅・高さ・grow/shrink・min/max・gap/padding・整列・折り返しは限定Flexで、完全なCSSではありません。clip・scroll・focus reveal・PointerRoutingを共有し、Gestureの受信者を固定してキャンセル済みIDを物理解放まで抑止します。

Checkbox/Sliderは即時value、onChange/onCommit/onCancelとreadOnlyを持ちます。Sliderの取消は値や外部副作用を巻き戻さず、範囲変更は全検証後にclamp/snapします。Select/TextInput/NumberInputは受理値とdraftを分け、Webがnative caret/selection/popup/IMEを所有します。inputMode:numeric/decimalはTextInputの文字列を数値化しないキーボードヒントです。[値コントロール](canvas-controls.md)、[編集](editing.md)、[スクロール](scrolling.md)を参照してください。

CanvasLabelは文字を読み順へミラーし、heading＋level1～6、status、alertを宣言できます。追加Tab stopやpointer所有権は作りません。動的文字・並べ替えは維持可能な編集Sessionを再生成せず、明示focusは保留レイアウトを解決します。実機IME・支援技術認定ではありません。

DOMのLabel/Button/HoldButton/PanelはブラウザのFlex/GridとtextContentを使います。空のoverlay領域はワールドへpointerを通し、Buttonはnative Tab/Enter/Spaceを維持します。非同期Web Buttonはbusy/disabledと重複実行を管理し、AbortSignalと寿命で古い完了を排除します。

Theme.Dark/Light、background/surface/text/muted/accent/fontの部分上書きを使えます。色はブラウザが受理するCSS色で、background-colorに適用して画像関数を読み込みません。fontは引用符・CSSエスケープとfallback列を扱います。不明テーマはINVALID_THEME、不明キー・空値・不正色・危険なフォント構文はINVALID_THEME_TOKENです。nativeGeometryはfontFamilyをCSSOMの単一プロパティへ設定します。独自@font-faceが初期レイアウトに必要ならdocument.fonts.loadをawaitしてください。

## Grid・Tilemap・Sprite・Tween・Replay

Grid<T>は固定幅高の密な行優先データです。get/setは厳密な境界検証、inBoundsは範囲判定、fill/forEach/forEachRect/generateを提供します。初期値の参照を複製する場合はgenerateを使い、GridはActorや寿命を所有しません。[Grid](grid.md)に寸法・走査の契約をまとめています。

SpriteSheetは画像とframeの不変metadata、SpriteAnimationはActor単位の再生cursorをLateUpdateで進めます。frame cropは既存画像leaseを共有し、再生とRenderable.sourceの手動変更の優先規則を守ります。TilemapはコピーしたGrid／行列を所有し、place(scene)の内部Actor/Layerで表示・イベント・leaseの寿命を再利用します。GeometryTilemapはsquare/triangle/hexのRGB/null層と座標・隣接・選択を提供し、画像多角形切り抜きや物理は含みません。[Sprite](sprites.md)、[Tilemap](tilemap.md)、[TileGeometry](tile-geometry.md)を参照してください。

Tween/Easing/TweenScheduler/PlaybackとSceneのsimulation/presentation時計を使い分けます。simulationは接触後・Timer前、presentationはWebの表示deltaでpause中も進みます。同じ対象propertyの競合所有を拒否し、寿命・無効化でcleanupします。表示offset/rotation/scaleやCanvas presentationを世界物理やFlexへ混入しません。[Tween](tween.md)を参照してください。

RandomManagerはEngine seedから名前付きstreamを独立に生成します。ReplayRecorder/ReplayPlayerは全Action捕捉後・最初のcallback前に記録／供給し、Controller ID、schema/version、seed、delta、イベント順を検証します。fresh Engine・現在の単一Scene制約を守り、任意ゲーム保存や全プラットフォームのbit一致を保証しません。FixedStepRunnerはHost時間の有界蓄積で、補間やロールバックではありません。[Replay](replay.md)を参照してください。

EngineErrorはcode/message/details/toJSONを持ちます。例外時の任意ゲーム状態の巻き戻し、互換性のための旧入力Controller階層、ネットワーク／AI frameworkは追加しません。環境と公開状態は[制約](../ja/limitations.md)、独立利用は[SDK導入](npm.md)で確認できます。
