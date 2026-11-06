# CoreとHostの責務境界

Simpludifyは、コード主導・軽量・AIネイティブな2Dコンテンツエンジンです。型安全なAPI、明示的なライフサイクルと所有権、構造化された診断ツールにより、外部のAIサービスに依存することなく、人間とAIアシスタントの双方が迷わず開発できるように設計されています。ゲーム制作を主目的としつつ、インタラクティブアニメーション、ミニゲーム、シミュレーション、軽量な2Dツールにも適しています。標準的なUIやコンテンツの定義には、手書きのHTMLやCSS、PixiJSの直接呼び出しは不要です。公開パッケージは`@simpludify/core`と`@simpludify/web`のみであり、モジュールディレクトリは内部構造であって個別にimportする対象ではありません。

## 内部モジュールの責務マップ

| Coreディレクトリ | 担当責務                                                                     | 依存関係                                 |
| ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| foundation       | 診断、ライフサイクル・キャンセル、イベント、タイマー、乱数、固定サイズGrid   | foundation のみ                          |
| scene            | Scene、Actor、Component、実行フェーズ                                        | foundation、型情報のみのInputSystem      |
| graphics         | Transform/Renderableデータ、座標変換/Camera、SpriteSheet                     | foundation、Sceneコンポーネント          |
| ui               | Canvas UIツリー/状態、Flexレイアウト、テキスト折り返し、クリップ、スクロール | foundation、UI のみ                      |
| interaction      | Actions、キーボード貢献、Pointerイベント記録/ルーティング、ホールド判定      | foundation、Scene、UI、座標型            |
| animation        | SpriteAnimation再生コンポーネント                                            | foundation、Scene、graphics              |
| game             | Motion/ActionMovement、Character、衝突判定/位置補正、Tilemap統合ファサード   | foundation、Scene、graphics、interaction |
| runtime          | Engine、固定ステップ、Replay、描画/フレームポート                            | foundation、Scene、graphics、interaction |

`src/index.ts` はパッケージ単位の公開APIを提供します。内部モジュール間の参照方向は依存ルールで厳密に守られており、`npm run check` では **ES2022標準のみ・DOMやNodeの環境型なし** でCoreの型検査を行います。外部依存の混入や相対パスでの脱出は拒否されます。

## Core、Renderer、Host、配布ターゲットの4層構造

| レイヤー           | 所有する責務                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Core**           | 論理状態、同期ライフサイクル、構造合成、描画記述、UIレイアウトと入力の意味解釈、リソース所有権・破棄 |
| **Renderer**       | プラットフォーム描画オブジェクト、厳密なフォント計測、画像デコードとテクスチャ、マスク、描画の同期   |
| **Host**           | OS/ブラウザの入力取得、画面/Viewportの変更、タイミング、非同期準備と確定、フォーカス/IME統合         |
| **配布ターゲット** | ビルド、パッケージング、署名、インストール、アップデート規約                                         |

Web版の`Game`クラスは、PixiRendererとブラウザ用入力アダプターを利用する**Host**の一実装です。ElectronやTauriによるデスクトップ・モバイル展開は、このWeb HostをWebView内でラップする形態をとります（※現時点では未実装・未検証です）。将来的には、Core定義を変更することなく、別のレンダラーや入力アダプターを持つ非WebのHostを構築することも可能です。

Coreのライフサイクルは**完全に同期**です。画像の非同期読み込み、フォントの利用可能待機、ユーザー設定のロード、キャンセル、描画確定はすべてHost側のトランザクションとして扱います。

## UIの処理フロー

1. **ノード生成:** Coreのファクトリ関数を使ってCanvasノードツリーを構築します。`CanvasUI(owner, root)` がツリーを管理します。ownerはSceneまたは任意のLifetimeOwnerです。この段階ではグラフィックスやブラウザオブジェクトは一切確保されません。
2. **レイアウト計算:** コンテンツの変更によりツリーが無効化されると、Hostは画面ピクセル単位のサイズを渡し、`ui.layout(screenWidth, screenHeight, measureText)` を呼び出します。CoreはUIスケールで除算し、論理座標系で計算します。Hostは正確なフォント計測値を返し、描画時にも同一の改行・フォント規則を適用します。
3. **Flexとクリップ:** Flexボックスの配置が確定し、スクロール量に応じて子ノードの境界が変換されます。`ui.walk` は描画と入力判定のために、同一のノード走査順序と交差クリップ矩形を提供します。CameraやDPRがUI座標系を歪めることはありません。
4. **描画とポインタールーティング:** HostはCoreのボックスを描画し、PointerEventsのスナップショットを`PointerRouting`へ渡します。確定時に`routing.setScene(scenePointer, ui)` を呼び出すことで、Core側でジェスチャー所有権の固定、型付きイベントの配信、ホールドの合算、Enter/Spaceキーによる活性化が行われます。
5. **フォーカスとアクセシビリティ:** Coreが`ui.focus`、`focusedNode`、`focusNext`、スクロール追従を管理します。Web Hostは論理フォーカスの移動をネイティブ要素へ反映します。Tabキーはツリー順にフォーカスを移動し、画面外のスクロール項目を表示させます。ネイティブのアクセシビリティ読み上げからは、直接 `node.activate()` を呼び出すことができます。
6. **所有者の破棄:** ownerが破棄されると、論理ツリー、イベントリスナー、ホールド状態、キャンセルシグナルが一括解放されます。Host側のPixiオブジェクト、フォントキャッシュ、DOMリスナーも同時に安全に破棄されます。

## 新しいHost（プラットフォーム）の実装要件

独自の描画システムや環境向けに新しいHostを実装する場合の手順は以下の通りです：

1. アプリケーションに必要な [RendererPort](api.md) とフレーム/入力サービスを実装します。OSのリソースハンドルはCoreの外側に保持し、[アーキテクチャ](architecture.md)および[描画](./specs/rendering.md)に定義された準備/確定/破棄の順序を守ります。
2. Canvas UIを表示する場合、`CanvasUI.layout/walk` を用いて厳密な計測、順序付けされた描画、入れ子状の矩形マスクを実装します。
3. プラットフォームの画面座標系と現在のWorld変換を `ScenePointer` / `PointerRouting` に渡します。ポインターのキャンセルや指の解放時もPointer IDを正しく維持します。
4. 論理フォーカスと意味的アクティベーションをプラットフォームへ接続します。キーの押下・解放をルーティングへ流し、ウィンドウのblur時には押下中のキーをリセットします。
5. Coreの単体テストとポータブルUIフィクスチャを実行し、対象プラットフォーム上で実機の描画・入力・リサイズ・破棄テストを追加します。

## 互換性とエスケープハッチ

- 既存の `@simpludify/core` と `@simpludify/web` のパッケージimportはそのまま利用できます。内部ファイルパスは安定した公開エントリーポイントではありません。
- キャンセル処理には `CancellationSignal`（`aborted`、`onCancel`、`throwIfCancelled`）を使用します。Webのファクトリではネイティブの `AbortSignal` もサポートされます。
- スクロールの初期設定では、コンテンツドラッグ、慣性移動、自動オーバーレイバーが有効です。以前の受動的な動作が必要な場合は、`dragScroll: false`、`inertia: false`、`scrollbar: "hidden"` を指定します。
- ブラウザのDOM要素やスタイルへの直接アクセス、DOM UI、PixiJSネイティブAPIの拡張は引き続き利用可能です。これらはプラットフォーム固有機能への明示的なオプトインであり、ポータビリティや解放処理は利用側の責務となります。

## 関連資料

- [APIリファレンス](api.md)
- [設計思想と責務](architecture.md)
- [Canvas UIの基礎](./specs/canvas-ui.md)
- [Canvasスクロール](./specs/scrolling.md)
- [Canvas値コントロール](./specs/canvas-controls.md)
