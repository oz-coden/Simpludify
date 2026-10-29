# APIリファレンス

日本語では主要APIの入口と責務を整理します。全オプション・異常系・移行情報は[英語のAPI契約](../en/api.html)を参照してください。ソースのexportと型定義が現在の実装です。

## パッケージと対応範囲

`@simpludify/core`はDOM/Node/Pixiに依存しません。`@simpludify/web`はCoreを再exportし、Game・PixiRenderer・BrowserInput・DOM UI・CSSを追加します。どちらもprivateなソースワークスペースです。

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
- [Collider](https://github.com/oz-coden/Simpludify/blob/main/packages/core/src/collider.ts)、[CollisionBody](https://github.com/oz-coden/Simpludify/blob/main/packages/core/src/collision-body.ts)

未実装の構想はAPI一覧へ混ぜず、[制約とロードマップ](limitations.md)へ記載します。

## SpriteSheet・SpriteAnimation

[フレームとアニメーションのガイド](sprites.md)に、型推論を使う定義・再生操作・画像共有・破棄・失敗時の契約をまとめています。

## Tilemap

[Tilemapガイド](tilemap.md)に、Grid／行列、名前付きID、配置、座標変換、セル更新、画像共有と破棄をまとめています。任意の衝突属性とTileContact専用イベントを既存CollisionWorldへ統合しています。[衝突ガイド](collision.md)も参照してください。
