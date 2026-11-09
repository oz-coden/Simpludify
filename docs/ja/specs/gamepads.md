# ゲームパッドと統一入力

ソースv0.1.6ではbindings省略でControllerのgamepad設定へ追従します。明示的なbindingsは従来どおり独立します。[共通設定とキャプチャ](input-bindings.md)も参照してください。

このページのAPIは、npmで公開済みのCore/Web v0.1.4から利用できます。[npm導入ガイド](../npm.md)に従い、同じバージョンを導入してください。

ActorはActionReaderを読み、入力元を知りません。キーボード・ゲームパッド・Canvasのタッチ・プログラムは同じActionControllerへ値を供給します。Game.gamepadsはWeb用Adapterで、別のゲーム用Controllerやプレイヤー管理機構ではありません。CoreへDOM・navigator・Gamepad APIは持ち込みません。

## 同じ操作対象へ複数の入力元を接続する

```ts verify
import {
  Action,
  Character,
  defineActions,
  Game,
  GamepadBindings,
  GamepadButton,
  KeyboardBindings,
} from "@simpludify/web";
const game = new Game();
game.scene("play", ({ actions, add }) => {
  const Actions = defineActions({
    Move: Action.axis2D(),
    Fire: Action.button(),
  });
  const controls = actions(Actions, { Move: KeyboardBindings.WASD });
  const pad = game.gamepads.bind(controls, {
    index: 0,
    bindings: {
      Move: GamepadBindings.Move,
      Fire: { buttons: [GamepadButton.South] },
    },
  });
  const program = controls.createSource();
  program.enabled = false;
  add(Character({ movement: controls.reader(Actions.Move) }));
  function useProgram() {
    controls.keyboardEnabled = false;
    pad.enabled = false;
    program.enabled = true;
    program.set(Actions.Move, { x: 0.5, y: 0 });
  }
  void useProgram;
});
await game.run("play");
```

割り当てはゲームが選びます。別Controllerへindex 1などを接続でき、同じパッドを複数Controllerへ意図的に割り当てることもできます。各接続は独立したSourceなので、片方の無効化・破棄は他方を解放しません。エンジンはプレイヤー数・台数に固定上限を設けず、利用可能な台数はブラウザと機器に依存します。

共有キーボードの同じキーは、有効な全Controllerへ配信します。conflicts()はController内部の重複だけを報告します。分離したい場合は別キーを使うか、パッド／プログラム専用側のkeyboardEnabledをfalseにしてください。CanvasHoldButtonもcreateSource().setを使います。同時ジェスチャーはSourceを分けるか、自分で合成状態を保持し、一方の解放で他方を消さないようにします。[2人用入力ラボ](unified-input.md)は方向ごとの独立Sourceを使います。

## API・有効化・所有権

| API                                        | 契約                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| game.gamepads.bind(controller, options)    | ControllerとHostが所有するGamepadSourceを返す。別EngineのControllerは拒否                |
| options.index / source.assign(index)       | 0以上の安全な整数スロット。再割り当ては旧入力を解放してニュートラル待ち                  |
| options.bindings / source.rebind(bindings) | Action名をキーにする型付き定義。全項目を検証してから適用し、旧入力を解放                 |
| options.deadZone                           | 既定0.15。有限値で0以上1未満。各軸で上書き可能                                           |
| options.mapping                            | 既定standard。非標準パッドはrawを明示した場合だけ入力を受理                              |
| source.enabled                             | 無効化で入力を解放。再有効化は保持状態を復元せずニュートラル待ち                         |
| source.clear() / dispose()                 | clearは解放して再待機。disposeは恒久的に接続を破棄                                       |
| source.info / connected / usable           | 最新ポーリング情報、物理的な公開状態、マッピング条件。Hostが入力受付中である保証ではない |
| game.gamepads.devices                      | 接続中として公開された機器の凍結スナップショット。index順                                |
| game.gamepads.available                    | 直近の読み取りが成功。空配列でも初回の機器操作待ちの場合がある                           |
| game.gamepads.onChange(handler, owner?)    | 機器情報・利用可能性の変更通知。同期、所有者付き購読、解除関数を返し、pause中も利用可能  |

既存ActionSourceとKeyboardSourceにもenabledを追加しました。無効中のsetは検証後に無視し、再有効化は空の状態から始めます。破棄後は従来どおり無害なneutral書き込みを許し、新たな非neutral値を拒否します。ControllerのkeyboardEnabled=falseはそのControllerだけをキーボードから切り離します。trueへ戻すと、既に押されていたキーはいったん離してから新しく押す必要があります。割り当て定義自体は保持します。明示的なActionController生成時にはkeyboard:falseも指定できます。

Sourceのclear・無効化・破棄で最後の寄与が消えると、通常のButton解放を次の入力境界で観測します。他のSourceが保持中なら解放しません。捕捉済みフレームは次のEngine.stepまで変わりません。input.clear、pause/resumeの状態変更、Scene交換は従来どおり寄与と未処理edgeを無音で破棄し、人工的な押下・解放を発生させません。

ゲームパッド接続は、割り当てた全Actionが一度neutralになるまで待機します。Buttonは閾値未満、Axisはデッドゾーン内がneutralです。初回、再接続、ID／mapping／軸・ボタン数の変化、再割り当て、rebind、再有効化、フォーカス中断、全体resetが対象です。倒したままのスティックや押したままのボタンは勝手に復帰しません。接続全体を単位にする保守的な規則なので、移動中にpauseした場合はスティックとpauseボタンを両方離してから新たに押してください。

Scene破棄はController・全Source・購読を破棄します。Game破棄はイベントとAdapterを解放し、InputSystem破棄も登録Adapterを破棄します。別Sceneで旧SourceやReaderを再利用しません。

## ポーリングと入力優先順位

Gamepad APIは各Engine入力境界で1回読み、全Controllerのフレーム確定・Actionコールバックより前に処理します。固定ステップでは描画1回の間に複数回読むことがあります。観測したButton遷移は境界まで保持しますが、2回のポーリングの間に物理的に完了した短押しは復元できません。Axisの往復もコマンドキューではありません。

接続イベントは状態を無効化・解放する通知です。event.gamepadの値を、そのまま利用可能な入力とみなしません。次のポーリングで利用可能性を確認します。切断イベント後の古い接続済みスナップショットは、実際の不在または接続イベントまで抑止します。API不在、権限制限、読み取り失敗は安全な空配列として扱い、他の入力元を止めません。非標準mappingは情報表示できますが、入力には明示的なraw設定が必要です。

標準Gameは、表示中のHostがdocument内でフォーカスを持ち、互換性のある要素が選択されている間だけパッドのゲーム入力を受けます。入力欄・Select・contenteditable・管理外Buttonは編集/UIを優先します。受付対象から外れるとパッドの保持状態を解放し、復帰にはneutral確認が必要です。ゲームパッドでEnter/Spaceを合成したりUIを自動ナビゲートしたりはしません。キーボードのUI消費規則、Canvasのタッチ経路、プログラムSourceの寿命はそのままです。

## アナログ・十字キー・トリガー

| Action種別 | 割り当て                                                              |
| ---------- | --------------------------------------------------------------------- |
| button     | buttonsに番号または{button, threshold}。既定閾値0.5、0より大きく1以下 |
| axis1d     | axis?, invert?, negative?, positive?, deadZone?                       |
| axis2d     | x?, y?に軸設定                                                        |
| axis3d     | x?, y?, z?に軸設定                                                    |

negative/positiveはボタン番号列です。それぞれの最大アナログ値を軸に減算／加算し、[-1,1]へ制限、必要なら反転してから軸ごとのデッドゾーンを適用します。abs(v)がd以下なら0、それ以外はsign(v)×(abs(v)-d)/(1-d)です。欠落・非有限値は0、有限の範囲外値は制限します。radial方式ではなく各軸独立の方式です。その後、通常のAction合成でSourceを加算・成分制限・ベクトル正規化し、1未満のアナログ強度は維持します。

同じButton Action内で同じ番号を複数指定した場合は、最後の指定とその閾値を使います。`addBindings` で登録済みの番号を指定した場合も閾値を更新します。別のActionや割り当て先で同じ番号を使う場合は、競合検出の対象です。

GamepadBindings.LeftStick / RightStick / DPad / Moveは凍結したAxis2D設定です。Moveは左スティックと十字キーを併用します。標準軸はLeftX=0、LeftY=1、RightX=2、RightY=3で、負のYが上です。トリガーはアナログButton値なので、Axis1Dへ{positive:[GamepadButton.RightTrigger], deadZone:0}を渡すと[0,1]を使えます。デジタル入力にする場合はButtonのthresholdを使います。

GamepadButtonはSouth/East/West/North、左右Shoulder/Trigger、Select、Start、左右Stick、DPadの4方向、Homeです。標準mappingの物理的位置であり、raw機器で同じ番号が同じ位置だとは保証しません。

## 機器情報と表示ラベル

GamepadInfoのid・index・connected・mapping・standardMapping・buttonCount・axisCountはブラウザ情報です。inferredLayoutだけがID文字列からの推定で、generic/xbox/playstation/nintendoのいずれかです。メーカー・型番・印字・個体を特定するAPIではなく、ドライバーや互換機、再マッピングで外れる場合があります。indexは再利用される接続スロット、idは永続的な個体IDではありません。同じスロットに現れた交換機器もneutral確認後に受け付けるため、交換確認が必要なゲームは接続を無効化してプレイヤーに再割り当てを求めてください。

| 位置  | Xbox推定 | PlayStation推定 | Nintendo推定 | 汎用  |
| ----- | -------- | --------------- | ------------ | ----- |
| South | A        | ×               | B            | South |
| East  | B        | ○               | A            | East  |
| West  | X        | □               | Y            | West  |
| North | Y        | △               | X            | North |

```ts verify
import { GamepadButton, gamepadButtonLabel } from "@simpludify/web";
console.log(gamepadButtonLabel(GamepadButton.South, { layout: "playstation" }));
console.log(
  gamepadButtonLabel(GamepadButton.South, {
    layout: "nintendo",
    overrides: { [GamepadButton.South]: "決定" },
  }),
);
```

位置名を出す前にstandardMappingを確認します。raw・未マッピングは、ゲームや利用者が確認済みの割り当てを持たない限りButton Nを表示してください。標準だがレイアウト不明なら位置名、追加の未知番号ならButton Nへフォールバックします。表示名の上書きは物理割り当てを変更しません。ラボには表示レイアウトを明示的に選ぶボタンもあります。

## Replay・外部プログラムとの関係

Replay中はlive Adapterのポーリングを除外します。記録するのは合成済みActionFrameとButtonイベント順序で、機器ID・割り当てではありません。複数プレイヤーはController IDで識別し、新しいEngine・一致するschema/version・現在の単一Scene制約を守ります。

外部プログラムは通常のActionSource.setを使います。boolean、[-1,1]の有限値、正しい次元、Actionの所属を検証してコピーします。受信メッセージの外枠・tick・順番・権限・適用時刻はアプリが検証し、対象Engine.stepより前に値を供給してください。入力コールバックやComponentからの書き込みは次の境界です。切断時はclear/無効化/disposeし、引き継ぐ側が同じControllerへ別Sourceを接続できます。ネットワーク通信、ロールバック、権威、AI判断や自動的な代行切り替えは実装していません。

独自Web Host・テストはGamepadInput(input,{poll,active,events})で構造的なGamepadStateを供給できます。通常のゲームはgame.gamepadsだけを使います。他Host向けにはDOM非依存のInputAdapterをInputSystem.addAdapterへ登録し、sample/reset/disposeを所有します。

## 未検証範囲

自動検証は模擬ポーリングとイベント、Chromiumの実DOMフォーカス、エミュレートされたタッチ、WebGL/Canvas2Dを対象にします。実機パッド、振動、OSドライバー、メーカー別印字、実機スマートフォン、Safari/Firefox、実機IMEの操作性を保証しません。HTTPS/localhost、gamepad Permissions Policy、初回の機器操作が必要になる場合があります。[標準Gamepad API](https://www.w3.org/TR/gamepad/)と[プラットフォーム制限](../limitations.md)も確認してください。
