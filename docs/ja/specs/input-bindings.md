# 入力Bindingと単一入力キャプチャ

公開済みv0.1.6では、既存のActionControllerでキーボード・マウス・ゲームパッドの割り当てを管理できます。Actionはゲーム内の意味、Bindingは物理入力との対応であり、変更時にCharacterやReaderを再生成しません。

## 複数デバイスの割り当て

```ts verify
import {
  Action,
  defineActions,
  Game,
  GamepadButton,
  KeyCode,
  MouseButton,
} from "@simpludify/web";

const game = new Game();
const A = defineActions({ Jump: Action.button() });
const controls = game.actions(A, {
  Jump: {
    keys: [KeyCode.Space],
    mouse: [MouseButton.Back],
    gamepad: { buttons: [GamepadButton.South] },
  },
});
const pad = game.gamepads.bind(controls, { index: 0 });
await game.run();
controls.addBindings(A.Jump, { mouse: [MouseButton.Forward] });
controls.removeBindings(A.Jump, { keys: [KeyCode.Space] });
controls.rebind(A.Jump, { keys: [KeyCode.ShiftLeft] });
controls.resetBindings(A.Jump);
console.log(controls.getBinding(A.Jump), pad.info);
game.dispose();
```

KeyCodeはKeyboardEvent.codeの物理位置を表し、Shift・Control・Alt・Escapeも単独で使用できます。MouseButtonはLeft=0、Middle=1、Right=2、Back=3、Forward=4です。ペン・タッチはポインター操作として扱います。Axis1Dはnegative/positiveへキー、mouseNegative/mousePositiveへマウス配列を指定し、Axis2D/3Dは同じ構造をx/y/zへ指定します。gamepadはAction直下に指定します。既存のパッド軸・ボタン・閾値・デッドゾーン設定も使用可能です。

GamepadInput.bindのbindingsを省略するとControllerのgamepad設定へ追従し、rebind/import/resetも反映します。明示的なbindingsは従来どおり独立し、source.rebind()で共通設定へ戻ります。Sourceのindex・mapping・deadZoneはControllerの保存対象外です。既定はstandardで、非標準機器はSource作成時にmapping: "raw"を明示します。IDやスロットはブラウザの事実情報であり、永続識別やベンダー・プレイヤーの自動判定ではありません。

ButtonはOR合成です。Spaceを離してもSouthが押されていれば解放・再押下は発生しません。同じ物理入力から複数Actionへ寄与できます。Axisの加算・成分クランプ・任意のベクトル正規化も維持します。conflicts()は従来のキーボード診断、conflicts("mouse")・conflicts("gamepad")・conflicts("all")は追加診断です。重複を禁止せず、自動で無効化しません。パッド診断はController内の制御番号を比較し、実行時の接続先割り当てまでは比較しません。

## ポインターの優先順位とフォーカス

既存ルーターがCanvas UI・スクロール、仮想入力、ワールドの順に担当を決めます。マウスBindingはワールド所有の操作だけを読み、別のPointer Captureを取得しません。ワールドのコールバックも利用可能です。領域をまたいでも所有権を移しません。同一ジェスチャー内の複数マウスボタンもbuttonsマスクで追跡します。

受理したワールドBindingに対応するcontextmenu/auxclickだけ既定動作を抑え、未割り当て操作には干渉しません。OS・ブラウザの予約操作は利用できない場合があります。ネイティブ編集・フォーカス喪失では物理入力を解放し、既存UIのキーボード消費規則を維持します。keyboardEnabledとmouseEnabledは独立し、GamepadSource.enabled・ActionSource.enabledも従来どおりです。無効化・リセット後は、保持中の入力を復元せず新たな物理操作を待ちます。キーボード・マウスの再割り当ては既存の規則を維持し、保持中の入力を次の境界で新しいBindingに適用しますが、押下・解放イベントを合成しません。Controllerに追従するゲームパッドでは、変更したActionだけをイベントなしで初期化し、新しい割り当てのneutralを待ちます。変更していないActionの入力は維持します。

## 1入力を取得する

```ts verify
import { Action, defineActions, Game, InputDevice } from "@simpludify/web";

const game = new Game();
const A = defineActions({ Jump: Action.button() });
const controls = game.actions(A);
await game.run();
game.element.focus();
const capture = game.captureInput({
  devices: [InputDevice.Keyboard, InputDevice.Mouse, InputDevice.Gamepad],
  gamepadIndex: 0,
});
// 別のキャンセル操作からcapture.cancel()を呼ぶ。
const input = await capture.result;
if (input) controls.addBindings(A.Jump, input.binding);
game.dispose();
```

run後のActiveなSceneと、表示中でフォーカスのあるドキュメントが必要です。ゲーム面へフォーカスし、1つのGameでは同時に1セッションだけ実行できます。任意のownerでSceneより寿命を短くできます。最初はarmingで、開始マウスボタンを含む対象デバイスの押下をすべて解放するとlisteningになります。パッドは開始後の基準ポーリングを待ち、接続・機器変更直後もニュートラルが必要です。gamepadIndexでスロットを限定できます。

取得対象は新たな単一キー・ゲーム面上のマウスボタン・パッドボタン（value ≥ 0.5）です。リピート・IME・ネイティブ編集・タッチ・パッド軸は取得しません。結果はdevice・code/button・Button用bindingを含み、パッドではindex/id/mappingも返します。成功はcompletedで一度だけ解決し、cancel/disposeはcancelled・結果undefinedです。Escapeも割り当て可能です。中止はAPI・呼び出し側UIで明示します。ネイティブ設定ボタンはキャンセル用に操作可能で、そこへ移したフォーカスはゲーム面のクリックで戻せます。

blur・非表示・編集へのフォーカス・入力clear・pause・Replay・Scene/owner/Game破棄でも終了します。取得中は物理・仮想入力の通常操作をニュートラルにし、保留中の論理遷移とポインター所有権を解放します。固定済みフレームは次の入力境界まで従来どおりで、明示的なプログラムSourceの値や新たな書き込みは維持します。取得したキー・マウスは解放まで抑制し、パッドもニュートラルを待ちます。既存のパッドポーリングを共有します。

取得だけでは割り当てを変更しません。Escape自動中止・タイムアウト・標準設定UI・軸キャプチャ・複合入力・Sequence・パターン認識・Action優先順位や排他・ゲーム固有ルールは追加しません。手動のアナログ軸設定は制限しません。

## 保存と互換性

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Engine,
  KeyCode,
  MouseButton,
} from "@simpludify/core";

const engine = new Engine();
const A = defineActions({ Jump: Action.button() });
const controls = new ActionController(A, {
  scene: engine.scene,
  input: engine.input,
  bindings: {
    Jump: {
      keys: [KeyCode.Space],
      mouse: [MouseButton.Back],
      gamepad: { buttons: [0] },
    },
  },
});
const json = JSON.stringify(controls.exportBindings());
controls.rebind(A.Jump, {});
controls.importBindings(JSON.parse(json));
controls.resetBindings(A.Jump);
controls.resetBindings();
engine.dispose();
```

version: 1を維持し、任意のmouse/gamepadフィールドを追加します。既存のキーボードだけの設定は従来の正規化形式で受け付けます。旧SDKは追加フィールドを拒否するため、旧クライアント対応時はSDKの対応機能情報を併記するか、キーボードだけの設定も保持してください。importは全体を検証してから適用し、未知のAction・フィールド、不正なキー・番号、非有限の閾値、不正なベクトルを拒否します。

機器の永続識別・Sourceの有効状態・mapping/deadZone・ゲーム状態は保存しません。ストレージ権限、JSON解析エラー、表示、接続先の選択はアプリ側で扱います。[サンプル](../../../examples/input-bindings/README.md)で取得・追加・中止・保存・復元・初期化を確認できます。Chromium・模擬パッドの自動検証は、物理機器、Safari/Firefox、OS予約操作、ベンダー固有レイアウトの実機検証を代替しません。
