# Canvas UI・Flex・Pointer入力

Canvas UIはPixi上に描画するHUDやゲーム操作ボタンです。既存のDOM版`Panel`・`Label`・`Button`・`HoldButton`はそのまま利用できます。フォーム・文字入力・文書の選択にはDOM版を選び、Canvasに重ねるゲームUIには`Canvas`で始まるAPIを使います。

```ts verify
import {
  Action,
  CanvasButton,
  CanvasColumn,
  CanvasHoldButton,
  CanvasLabel,
  CanvasPanel,
  CanvasRow,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
  PointerClick,
} from "@simpludify/web";
const game = new Game<"title" | "play">();
const Actions = defineActions({ Move: Action.axis2D() });
game.scene("title", ({ canvasUI }) => {
  canvasUI(
    CanvasColumn(
      [
        CanvasLabel("Ready?", { fontSize: 30 }),
        CanvasButton("Start", () => game.goTo("play")),
      ],
      { gap: 20, align: "center", justify: "center" },
    ),
  );
});
game.scene("play", ({ actions, canvasUI, pointer, add }) => {
  const controls = actions(Actions, { Move: KeyboardBindings.WASD });
  add(Character({ movement: controls.reader(Actions.Move) }));
  const right = CanvasHoldButton("Right", (held) => {
    source.set(Actions.Move, held ? { x: 1, y: 0 } : { x: 0, y: 0 });
  });
  const source = controls.createSource(right);
  const selected = CanvasLabel("Select the field");
  canvasUI(
    CanvasColumn(
      [
        CanvasRow([selected, CanvasButton("Menu", () => game.goTo("title"))], {
          gap: 12,
          wrap: true,
        }),
        CanvasPanel([], { grow: 1 }),
        right,
      ],
      { padding: 12, gap: 10 },
    ),
  );
  pointer.events.on(PointerClick, (event) => {
    selected.setText(
      `World ${Math.round(event.world.x)}, ${Math.round(event.world.y)}`,
    );
  });
});
await game.run("title");
```

`actions`は当該SceneとGameのInputSystemを使う生成ヘルパーです。既存ActionControllerの合成・フレーム確定・型・リバインド・Pause時のリセットは変えません。独立して長押しできるボタンごとに`createSource(node)`を作ると、別のタッチやキーボードの入力まで解除せずに済みます。Core単体では従来どおり明示的なActionControllerを使えます。

## 座標とレイアウト

UIはホストのCSSピクセル÷`ui.scale`（既定1）で配置され、Camera・ズーム・ワールドのFit領域・DPRから独立しています。`CanvasRow`／`CanvasColumn`、`gap`・`padding`、数値／割合の幅と高さ、`grow`・`shrink`、`align`・`alignSelf`・`justify`、明示的な`wrap`、矩形`clip`に対応します。背景・文字色はRGB整数、fontSizeはUI単位です。

`setText`・`setStyle`・表示・サイズ変更でレイアウトを無効化し、次の描画またはPointer判定前に更新します。変更のないフレームはレイアウトと表示ツリー同期を省略します。変更がある場合はルート全体を再計算します。すべてのCSS Flex仕様や部分木だけの再計算を実装したものではありません。

割合サイズを使う親には明示サイズを与え、内容サイズとの循環を避けてください。`minWidth`・`maxWidth`・`minHeight`・`maxHeight`は数値または親の内容領域に対する割合で指定します。Grow/Shrink中に制約へ達した要素を固定し、残りをほかの要素へ再配分します。矛盾する場合はminを優先し、minの合計が親を超える場合ははみ出しを許容します。0は有効で、負数・無限大・NaNは拒否します。margin・absolute・Grid・reverseは対象外です。Wrapはノードの折り返しで、文字の折り返しは既定で有効な`textWrap`が担当します。縮められない子ははみ出す場合があるため、必要な場所にclipを指定します。角丸の背景もヒット領域は矩形です。

## 自動折り返しと制約付きPanel

```ts verify
import { CanvasPanel, CanvasLabel, CanvasButton } from "@simpludify/web";
const panel = CanvasPanel(
  [
    CanvasLabel(
      "Status / 日本語と English が混在する説明。\nこの改行は保持します。",
    ),
    CanvasButton("次のステージへ / Continue", () => {}, {
      width: "100%",
      minWidth: 120,
      maxWidth: 360,
      minHeight: 48,
    }),
  ],
  {
    width: "80%",
    minWidth: 200,
    maxWidth: 600,
    minHeight: 80,
    padding: 16,
    gap: 12,
  },
);
console.log(panel);
```

幅・高さ・制約はPadding込みです。文字は確定した幅から左右Paddingを引いた領域で折り返し、heightを省略すれば複数行の高さも再計算します。固定heightやmaxHeightで収まらない文字はノードの矩形でクリップします。`textWrap: false`なら自動折り返しを無効にし、明示改行だけを残します。

`Intl.Segmenter`で書記素と単語を扱い、絵文字の結合列・国旗・結合文字を途中で分割しません。英語は単語境界を優先し、長い単語やURLは書記素単位で分割します。日本語は文字間で折り返し、一般的な句読点・括弧・小書き仮名の禁則を可能な範囲で考慮します。完全なUnicode行分割・JIS組版・ハイフネーションには対応しません。1書記素より狭い幅など、成立しない条件では文字を保持して描画をクリップします。

明示改行・空行・行内空白は保持し、自動改行の境界の空白だけを除きます。計測済みの同じ改行文字列とフォントをPixi描画にも使います。各ノードの幅別キャッシュは最大8件で、文字・フォント変更やScene破棄で更新・解放します。独自フォントはUI生成前に読み込んでください。読み込み完了後の自動フォント再計測は未対応です。

## Pointerと優先順位

`PointerDown`・`PointerMove`・`PointerUp`・`PointerCancel`・`PointerEnter`・`PointerLeave`・`PointerClick`を`node.events`またはSceneの`pointer.events`へ登録します。通常のクリックはCanvasButtonのコールバックだけで扱えます。イベントのバブリングはなく、描画順の最前面にある有効な対象へ配信します。Panel/Labelで受け取る場合は`pointerEvents: "auto"`を指定します。既定のコンテナは空白部分を通過させ、`none`は子を含めて入力対象外にします。

Pointerの開始時にUIかワールドを固定し、移動中に相手側へ切り替えません。長押しは対象外へ動かしても続き、クリックは元の対象内で離した場合に成立します。Cancel・Capture喪失・window失焦・非表示化・無効化・破棄で解放します。キャンセル済みの操作は、離すか新しい押下が始まるまで新しいSceneへ配信されません。複数Pointerは独立しています。ワールド入力はCamera適用済みの`event.world`を持ち、表示範囲外での押下は無視します。UIはFitの余白でも操作できます。

GameがDOMキャプチャ段階で一度だけルーティングし、Canvas UIのPixiイベントは無効にしています。同じ操作を別の生DOM/Pixiハンドラーでも処理しないでください。既存DOM UIがCanvasを覆う場所ではDOM側が優先します。

## 寿命・Pause・キーボード

SceneごとにCanvas UIルートは一つです。ノードは一つの親に属し、removeはその部分木の破棄です。Scene切り替えでUI・イベント・長押し・ActionSource・Pixi表示・DOM補助ボタンを解放します。非同期ボタンにはAbortSignalを渡し、待機中はbusyになります。準備失敗なら候補だけを破棄し、旧Sceneを維持します。

Tab／Shift-TabはRow・Column・入れ子Panelを含むツリーの宣言順／逆順で操作部品へ移動し、Canvasに金色の枠を描きます。非操作コンテナ、無効・非表示の祖先を持つ要素は除外し、読み取り専用の部品は対象に残します。追加・削除・move後も順序を更新し、Scroll内の対象は表示範囲へ移動します。ゲーム領域でTabを押すと最初の対象へ入り、先頭・末尾では通常のブラウザ移動へ戻ります。循環や正のtabindexによる順序指定は行いません。Enter／Spaceで部品を押下・解放します。Pointer操作の所有権とUI論理フォーカス、DOMフォーカス、ゲーム入力は独立しています。Button・Checkboxのクリック、Slider・Scrollのドラッグ／ホイールはWASDを不必要に解除しません。標準DOM Buttonも同じ規則です。`game.pause/resume`は操作を解除し、Coreの入力リセットも維持します。Pause中もUIとPointerは動きます。

補助DOMはボタンの名前・状態・キーボード操作を提供する範囲です。Canvas Label全体を文書として読み上げたり、Canvas文書全体の完全なスクリーンリーダー対応を提供したりはしません。文字入力のネイティブIME連携は標準TextInputが提供しますが、実OSでの適合性は別途検証が必要です。実機・Safari・Firefox・OS IMEの適合性は未検証です。

[Canvas trail](../../examples/canvas-ui/README.md)はSpriteAnimation・Tilemap・Collision・HUD・タッチ・Pause・Scene往復を組み合わせた実行例です。[詳細仕様](../../docs/canvas-ui.md)・[測定結果](../../docs/canvas-ui-performance.md)・[検証記録](../../docs/canvas-ui-implementation.md)も参照してください。

## Core共通UIと動的リスト

Canvas UIのツリー・Flex計算・ヒットテスト・スクロール・フォーカス・入力配送はCoreにあり、WebはPixi描画・文字計測・ブラウザ入力・ネイティブのフォーカス補助を担当します。`CanvasScroll`で範囲を区切り、`add`・`remove`・`move(child, index)`・`clear`でリストを更新できます。`move`はノードを破棄しません。スクロール量は`scrollTo` / `scrollBy`で変更し、レイアウト後の`maxScrollX/Y`へ収まります。

Canvas trailの **UI list lab** は、Core APIだけで構築した同じ画面定義をWebとヘッドレステストで使います。項目の選択・追加・削除・並べ替え、ホイール／ボタンでのスクロール、Tab移動による表示範囲外の項目へのフォーカスを試せます。タッチ／マウスドラッグ、慣性、ドラッグできるスクロールバーに対応しています。専用の文字・数値・選択フォームはSettings labで試せます。

`canvasUI`の戻り値で`focus(node)`・`focusNext(reverse?)`を使えます。Coreのボタンコールバックと`node.signal`は環境非依存の`CancellationSignal`です。Webの`CanvasButton`コールバックは従来の`AbortSignal`を維持します。DOM/fetchへ`node.signal`を接続する場合はWebの`browserAbortSignal`を使ってください。[Core / Host境界と移行](../../docs/host-boundary.md)に詳細をまとめています。Electron・Tauri・Androidのビルドや実機動作は今回追加していません。

## ドラッグ・慣性・スクロールバー

`CanvasScroll`は領域ごとに`dragScroll`・`inertia`（既定値true）と`scrollbar`（auto / always / hidden、既定値auto）を持ち、`setStyle`で実行中にも変更できます。バーをhiddenにしても、許可されたドラッグ・ホイール・キーボード・プログラム操作は使えます。alwaysで内容が収まる場合は、全長の薄いつまみを表示して操作不可とします。

ボタン上から8画面単位以上の有効軸ドラッグになると、元の入力をキャンセルしてスクロール領域が引き継ぎます。HoldButtonは従来どおり押下時に開始し、ドラッグ移行時にその指の寄与を解除します。親子では操作開始時に最も内側の移動可能な領域を選び、指を離すまで固定します。端から親へ移るときは、一度離して次の操作を始めます。複数の領域は別々の指で操作できます。

位置だけの変更ではFlexと文字計測を繰り返しません。Webは既存のフレームから経過秒をCoreへ渡し、慣性を更新します。一時停止・フォーカス喪失・非表示・破棄では解除します。[詳細な仕様・キャンセル規則](../../docs/scrolling.md)と[性能計測の範囲](../../docs/scroll-performance.md)を参照してください。CDPタッチ模擬と実機確認は別で、Android/iOS実機は未検証です。

## 標準入力コンポーネント

`CanvasCheckbox`は真偽値、`CanvasSlider`は数値範囲を扱います。どちらもCoreの値・イベント・フォーカスと既存PointerRoutingを使い、ゲーム側でDOM/Pixiを操作せず構築できます。Canvas trailの **Settings lab** で音声、音量、速度、読み取り専用、適用・リセットを試せます。[引数・値・イベント・入力・破棄の契約](../en/canvas-controls.html) を参照してください。

Sliderは操作中の値を即時反映し、中断時も最後の値を保持します。設定全体を取り消したい場合は、アプリケーション側で保存した値をプログラムから戻します。`CanvasSelect`・`CanvasTextInput`・`CanvasNumberInput`も同じ値・フォーカス基盤を使います。文字・数値は編集中の`draft`と確定値`value`を分け、Enterまたは通常のフォーカス移動で確定、Escapeで取り消します。日本語IME変換中のEnter/Escapeはネイティブ入力に任せます。Settings labで難易度・プレイヤー名・数値音量を試せます。[生成・イベント・ネイティブ入力・Host移行・未検証事項](../en/text-input-design.html) を参照してください。実OSの日本語IMEと物理端末のソフトウェアキーボードは未検証です。


## ホバーとキーボード入力の優先規則

Panel・Row・Column・Scrollの背景は、既定ではホバーで明るくなりません。操作部品は従来どおり強調します。`hoverEffect: "auto"`が既定、`"none"`で抑止、`"highlight"`で操作可能な独自Panel等の強調を明示できます。PointerEnter/Leaveやヒットテストは変更しません。Panelでイベントを受けるには別途`pointerEvents: "auto"`を指定します。

| フォーカス先                     | キーの優先規則                                                           |
| -------------------------------- | ------------------------------------------------------------------------ |
| ゲーム領域                       | 有効なActionの割り当て。TabはUI／ブラウザ移動                            |
| 標準Button・HoldButton・Checkbox | Enter／SpaceはUI、それ以外のゲームキーは利用可能                         |
| Slider・Scroll内の部品           | 部品の変更キーや実際にスクロールするキーをUIが消費。それ以外はゲーム入力 |
| TextInput・NumberInput・Select   | ネイティブ編集／選択を優先し、ゲームのキーボード入力を解放               |
| IME変換中・229の処理キー         | ネイティブ入力のみ                                                       |

UIが消費したkeydownをActionへ重複配送しません。keyupはUIが伝播を止めてもゲーム状態を解除します。編集開始、外部へのフォーカス移動、ウィンドウのblur、非表示、Scene／Gameの変更で押下を解放し、押しっぱなしのrepeatでは復元しません。新たなkeydownが必要です。Enter／Escapeで文字を確定／取り消しても編集欄のフォーカスは保ちます。Tabで標準Button等へ移動すると、ゲーム画面を再クリックせずWASDを再開できます。独立したタッチ／プログラムのActionSourceはそれぞれの所有規則を保ちます。

明示的な`ui.focus(node)`の変更をネイティブへ反映し、無関係なホバー再描画でフォーカスを奪い返しません。並べ替えでは編集中のネイティブ要素を取り外さず、選択範囲と変換セッションの同一性を保ちます。実OS日本語IME・物理モバイルキーボード・他ブラウザは未検証です。[共通入力・フォーカスの詳細](../en/canvas-ui.html#keyboard-and-accessibility-scope)を参照してください。
