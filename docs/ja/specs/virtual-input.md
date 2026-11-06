# 仮想スティックとポインター入力

このAPIは**npm公開済みCore/Web v0.1.5**で利用できます。マウス・タッチ・ペンのPointer Eventsを同じ仕組みで処理し、端末判定で表示や入力を強制しません。

## Actionへ接続する

```ts verify
import {
  Action,
  Character,
  defineActions,
  Game,
  VirtualStickMode,
} from "@simpludify/web";
const game = new Game();
const Actions = defineActions({
  Move: Action.axis2D(),
  Aim: Action.axis2D(),
  Fire: Action.button(),
});
game.scene("play", ({ actions, add, virtualInput }) => {
  const controls = actions(Actions);
  const move = virtualInput.stick(controls, Actions.Move, {
    region: { kind: "rect", x: 0, y: 0, width: 0.44, height: 1 },
    position: { x: 0.22, y: 0.7 },
    radius: 60,
    mode: VirtualStickMode.Floating,
    deadZone: 0.15,
  });
  virtualInput.stick(controls, Actions.Aim, {
    region: { kind: "rect", x: 0.56, y: 0, width: 0.44, height: 1 },
    radius: 60,
    mode: VirtualStickMode.Follow,
  });
  const fire = virtualInput.button(controls, Actions.Fire, {
    region: { kind: "circle", x: 0.85, y: 0.25, radius: 0.09 },
    direction: true,
    radius: 48,
  });
  fire.onCommit(({ direction }) => console.log("確定した方向", direction));
  add(Character({ movement: controls.reader(Actions.Move) }));
  move.visible = false; // 描画だけを隠す。入力は有効なまま。
});
await game.run("play");
```

`game.virtualInput`は現在／初期Scene、factoryの`context.virtualInput`は準備中のそのSceneを対象にします。各入力は既存のActionSourceを1つ所有します。同じScene・InputSystemのControllerと、種類の一致するActionを渡してください。Axis2Dの加算・クランプ、ButtonのOR合成、入力境界での値の固定は既存仕様です。キーボード・ゲームパッド・プログラム入力と共存でき、ReaderやCharacterの作り直しは不要です。

## 起動領域と座標

| 設定                                                        | 意味                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `VirtualRegions.Left` / `.Right`                            | 現在のGame Viewportの左半分／右半分                           |
| `{kind:"rect",x,y,width,height,space?}`                     | 矩形。既定の`viewport`は相対値、`screen`はホスト内CSSピクセル |
| `{kind:"circle",x,y,radius,space?}`                         | 円。相対半径はViewportの短辺に対する割合                      |
| `{kind:"custom",bounds(viewport),contains(point,viewport)}` | CSSピクセルの保守的な外接矩形と同期boolean判定                |

相対位置のx/yはViewport左上を原点にした割合です。`position`で固定・待機中心を起動領域とは独立に指定でき、省略時は領域の外接矩形の中心になります。**スティック／ボタン本体の`radius`は常にホストCSSピクセル**です。領域の円の相対半径とは区別してください。Camera・論理解像度・DPR・Canvas UI scaleで入力値を変えません。

上の例では中央12%がスティックを起動しない領域です。空白のポインターを消費する設定ではないため、通常のワールド入力には利用できます。起動領域は「操作を開始できる場所」です。開始後の移動範囲を制限せず、中央や別の領域へ移動しても担当を変えません。

矩形は右・下端を含まず、円は円周を含みません。境界だけ接する領域は曖昧な重複になりません。幅／高さ0の領域は何も受けません。`screen`の領域はワールドViewportへ自動でクリップしませんが、ブラウザのdownはGameの入力面へ届く必要があります。

`region`の変更やリサイズ後の再解決で同じ優先度の領域が重なると、`VIRTUAL_REGION_OVERLAP`になります。非表示・無効の設定も含めて検証します。矩形・円は幾何判定し、単に外接矩形が交わるだけでは重複にしません。独自判定は外接矩形が重なると曖昧として拒否します。判定関数の結果が互いに排他的でも、外接範囲を分割するか組み込み形状を使ってください。

独自判定は宣言した外接矩形の内側でだけ呼ばれます。外接範囲は有限・非負、判定は同期booleanである必要があります。関数はSceneを準備している段階でも安全に呼べるようにしてください。

GameはCanvasレイアウト解決後、描画／入力前に領域を更新します。Viewportや独自の外接矩形が変わると進行中の操作をキャンセルします。不正な領域は以前の解決結果へ部分的に反映しません。Canvas Flexの領域と連動させる場合は、独自bounds関数で`node.bounds`へ`ui.scale`を掛けてCSS座標へ変換できます。非表示やクリップで入力を除外する場合は、その条件で幅／高さ0を返してください。

## モードと状態

| API                                 | 契約                                                        |
| ----------------------------------- | ----------------------------------------------------------- |
| `VirtualStickMode.Fixed`            | 既定。設定した中心から方向を計算                            |
| `.Floating`                         | down位置をその操作の中心にする                              |
| `.Follow`                           | down位置で開始し、指が半径を越えた距離だけ中心が追従        |
| `radius`                            | 正のCSSピクセル。既定はスティック64、ボタン28               |
| `deadZone`                          | 既定0.15、`0 <= 値 < 1`。半径方向の無効域の後を0〜1へ再配分 |
| `value` / `direction`               | スティックのベクトル。長さ最大1、下向きが正のY              |
| `center` / `knob`                   | CSS画面座標。ノブ描画は半径以内に制限                       |
| `pointerId` / `pressed` / `elapsed` | 担当ID、進行中の操作、表示時間の秒数                        |
| `enabled` / `visible`               | 個別入力とVirtualInput全体で独立に指定                      |

mode・radius・deadZone・regionの変更、無効化、`cancel()`、入力の全解除、一時停止／再開、Replay切り替え、Capture喪失、フォーカス喪失、文書非表示、Controller／Scene／Game破棄で入力を解放します。無効化解除で古い押下を復活させません。解放するのは該当Sourceだけなので、別のSourceが同じActionを保持していればその入力は続きます。

入力イベント直後のコントロール状態と、次のEngine.stepで固定されるAction値は別です。ゲームのComponentは引き続きActionReaderを読みます。破棄済みの入力は別Sceneで再利用できません。

## ボタン・長押し・方向確定

`virtualInput.button`は既定で方向を必要としません。downから解放までButtonへtrueを供給し、更新間隔内の短い押下も既存のButton遷移として保持します。自己強化など、方向のない操作にも使えます。

`direction:true`を指定すると、down位置からのドラッグ方向を取得できます。Action自体はButtonのままで、`onCommit`の引数から最終方向を読めます。通常のupなら起動領域の外でも確定し、cancelでは確定しません。スキル条件・クールダウン・ダメージ・ターゲット選択はゲーム側の責務です。

`onStart`・`onChange`・`onEnd`・`onCancel`・`onHold`は任意のLifetime ownerで購読できます。ボタンの`onCommit`は通常終了の`onEnd`を購読します。イベントにはID・入力種別・開始位置・現在位置・中心・方向・領域内か・経過秒が入り、終了時はSourceを解放した後も引数に最終方向が残ります。

`onHold`は`holdDelay`（既定0.5秒）を越えたとき1回通知します。移動イベントがなくても進みます。CoreのHostは`virtualInput.advance(seconds)`を呼び、Web Gameは表示中の上限付きフレーム時間を渡します。連打やゲーム内タイマーを自動実装する機能ではありません。Replay再生中は新しい実入力を受け付けません。

## 入力競合と対応範囲

開始時の優先順位は**通常のCanvas UI → 仮想ボタン → スティック → ワールド**です。既存Canvas UI内の描画順・クリップ・スクロール所有権は維持します。広いスティック領域の上にCanvasボタンや仮想ボタンを置けます。同じ優先度の仮想領域は重複させられません。使用中の入力へ別の指で押すと、その指は離すまで抑止し、ほかの操作へ渡しません。右／中央マウスボタンは仮想入力を起動せず、通常のワールド入力になります。

`pointerId`の所有権は既存ルーターとBrowserPointerだけが管理します。指の交差や領域越えで変更しません。表示方式はゲームと利用者が選べます。描画された仮想ボタンはポインター操作用で、別のネイティブなキーボードフォーカス要素は生成しません。必要な代替操作はキーボード・ゲームパッド・既存Canvas UIで用意してください。

[Virtual input lab](../examples.html)で左右スティック、中央の空白、2種のボタン、Canvas優先、表示／入力の切り替え、プログラム入力、リサイズを試せます。自動検証はCore状態、CDPマルチタッチ、ブラウザのマウス／Capture、WebGL／Canvas2Dが対象です。実機・ペンの筆圧／傾き・ドライバー・モバイルブラウザ固有ジェスチャー・Safari/Firefox・OS IME・支援技術は別途検証が必要です。
