# 入力とゲームループ

ゲームの意味を表すActionと、キーボードの物理位置を表すKeyCodeを分離します。キーボード・タッチ・プログラム入力は同じActionを操作でき、CoreはDOMに依存しません。[英語の詳細契約](../../docs/action-input.md)には更新境界、合成、設定形式、移行上の制約をまとめています。

## 型安全なActionを定義する

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Engine,
  KeyCode,
} from "@simpludify/core";
const Actions = defineActions({
  Move: Action.axis2D(),
  Fire: Action.button(),
  Pause: Action.button(),
  Yaw: Action.axis1D(),
  Orientation: Action.axis3D(),
});
const engine = new Engine({ seed: 42 });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: {
    Move: {
      x: {
        negative: [KeyCode.A, KeyCode.ArrowLeft],
        positive: [KeyCode.D, KeyCode.ArrowRight],
      },
      y: {
        negative: [KeyCode.W, KeyCode.ArrowUp],
        positive: [KeyCode.S, KeyCode.ArrowDown],
      },
    },
    Fire: { keys: [KeyCode.Space] },
    Pause: { keys: [KeyCode.P, KeyCode.Escape] },
    Yaw: { negative: [KeyCode.Q], positive: [KeyCode.E] },
  },
});
engine.scene.onUpdate(() => {
  const move = controls.value(Actions.Move); // x, y
  const fire = controls.value(Actions.Fire); // boolean
  const yaw = controls.value(Actions.Yaw); // number
  const orientation = controls.value(Actions.Orientation); // x, y, z
  // 値をMotion.directionやゲーム固有の処理へ適用する。
});
controls.onPressed(Actions.Pause, () =>
  engine.paused ? engine.resume() : engine.pause(),
);
engine.step(1 / 60);
engine.dispose();
```

`Actions.Fire`のような型付き識別子を使います。未定義のAction、Buttonへ数値を渡す操作、Axisの次元違いは型チェックで検出されます。同名でも別のdefineActionsで作った識別子は別物です。

Buttonはboolean、Axis1Dはnumber、Axis2Dはx/y、Axis3Dはx/y/zです。Yawなどの意味や、入力を移動・回転へ適用する方法はゲーム側が決めます。

## キーの物理位置と文字を区別する

`KeyCode.W`の値は`"KeyW"`です。KeyboardEvent.codeによる物理位置を扱い、言語・配列・Shiftに応じた文字であるKeyboardEvent.keyとは区別します。設定ファイルの値は`isKeyCode(value)`で判定するか、`parseKeyCode(value)`で検証します。

Gameは、ActiveなActionControllerの割り当てを標準BrowserInputへ自動登録します。ゲーム領域へクリックまたはTabでフォーカスすると入力でき、ネイティブのボタンや編集欄からキーを奪いません。PreparingのSceneの割り当てはブラウザ入力を捕捉しません。

## 短押しと更新境界

`Engine.step()`の開始境界で入力を捕捉します。Buttonの`button(action)`はheld、pressed、released、pressCount、releaseCountを返します。

- down/upがstep間に完了してもpressedとreleasedは両方trueになります。
- 複数回の短押しは回数を保持し、`controls.events`はButton間の押下・解放順序も保持します。
- 同じstepで何度読んでも状態は消費されません。コールバックやComponentからの入力変更は次の境界に反映します。
- Axisは継続する値です。step間で完了したAxisの往復をコマンドとして蓄積するものではありません。

`onPressed(action, callback)`は境界で同期実行され、pause中も利用できます。停止中もPause Actionからresumeでき、シミュレーションのComponent・接触・Timer・Scene.onUpdateは停止します。入力コールバックでresumeした場合、そのstepに渡されたdeltaでシミュレーションを進められます。Component更新中のpauseは従来どおり次stepから有効です。

[Blockfall](../../examples/blockfall/README.md)は左右のButtonの長押し・短押しと、回転・ドロップ等の順序付きイベントを使います。個別のkeydownキューはありません。[Prism Raid](../../examples/prism-raid/README.md)はMoveのAxis2DとFireの保持状態を使います。

## タッチ・プログラム・自動操作

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Game,
  HoldButton,
  KeyCode,
  Panel,
} from "@simpludify/web";
const Actions = defineActions({ Fire: Action.button(), Move: Action.axis2D() });
const game = new Game<"play">();
game.scene("play", ({ scene, ui }) => {
  const controls = new ActionController(Actions, {
    scene,
    input: game.engine.input,
    bindings: { Fire: { keys: [KeyCode.Space] } },
  });
  const touch = controls.createSource(scene);
  ui(Panel([HoldButton("Fire", (held) => touch.set(Actions.Fire, held))]));
  const automatic = controls.createSource(scene);
  automatic.set(Actions.Move, { x: 0.5, y: 0 });
  automatic.set(Actions.Fire, true);
  // 短押しは同じsourceへtrue、falseの順で設定する。
});
// ブラウザentryでawait game.run("play")し、終了時にgame.dispose()する。
```

Buttonは全キー・全sourceのORです。一つを解放しても別のsourceが保持していれば解放されません。Axisは成分ごとに加算して[-1,1]へ制限します。Axis2D/3Dは既定で長さ1以下に制限し、1未満のアナログ値は保ちます。`{ normalize: false }`では各成分だけを制限します。反対方向は加算により相殺されます。

source.clear/disposeは、そのsourceだけを解放します。Scene破棄はControllerと全sourceを破棄します。Engineのpause/resumeへの状態変更、Scene置換、InputSystem.clearは、保持と未消費イベントを全sourceから静かに破棄し、人工的な押下・解放イベントは作りません。ブラウザのキー自動リピートで再押下されないよう、新しい押下を必要とします。

キーボードのfocusout/blurはその物理入力元だけを解放します。HoldButtonはタッチ・マウス・Enter/Spaceと、キャンセル・blur・UI破棄時の解放を扱います。ゲームパッドAdapterは未実装ですが、将来も独立sourceへアナログ値を書き込む方式を利用できます。

## 実行中のリバインドと保存

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Engine,
  KeyCode,
} from "@simpludify/core";
const Actions = defineActions({ Yaw: Action.axis1D() });
const engine = new Engine();
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: { Yaw: { negative: [KeyCode.Q], positive: [KeyCode.E] } },
});
controls.rebind(Actions.Yaw, { negative: [KeyCode.Y], positive: [KeyCode.I] });
controls.addBindings(Actions.Yaw, { positive: [KeyCode.ArrowRight] });
controls.removeBindings(Actions.Yaw, { positive: [KeyCode.ArrowRight] });
const saved = JSON.stringify(controls.exportBindings());
controls.importBindings(JSON.parse(saved));
console.log(controls.getBinding(Actions.Yaw), controls.conflicts());
controls.resetBindings();
engine.dispose();
```

取得・追加・削除・置換・初期設定への復元を提供します。同じリスト内の重複キーは除去し、複数Actionや正負方向にまたがる同じキーはconflicts()で報告します。競合は禁止しません。

変更後の保持状態は次境界から反映し、変更対象の未消費Buttonイベントは破棄します。割り当て変更だけでは新しい押下・解放を生成せず、論理sourceの値は保ちます。保存形式はversion 1とAction名によるbindingsです。読み込みは全件検証後に適用し、Action改名時は設定の移行が必要です。Coreはストレージや設定画面を持ちません。

## Component・Characterへの入力注入

通常のゲーム制作で理解する入力経路はActionControllerだけです。Characterのmovementへ `controls.reader(Actions.Move)` を渡すと、ActionMovementがUpdateフェーズで入力値×scaleをMotion.directionへ反映し、MotionがIntegrateフェーズで位置へ適用します。[移動とComponent](movement.md)では倍率・独自Component・更新順序を説明しています。任意のAction名を使えます。movementを省略したCharacterは入力で動きません。

readerは種類・所有Scene・破棄状態を保持する読み取り専用参照です。同じreaderを複数Componentで共有しても、押下イベントを消費しません。ActionMovementにはAxis2Dだけを渡せます。異なるSceneの参照は診断し、Controller破棄後は移動を停止します。独自Componentには必要なreaderまたは型付きControllerをconstructorで明示的に渡します。

KeyboardBindings.WASD／Arrowsは物理キーのAxis2D割り当てデータです。組み込みAction名はありません。旧KeyboardController、InputState、InputSource、InputReader、KeyMap／KeyMaps、MovementとUpdateContext.inputは削除しました。

## デバイス層

Engine.inputはInputSystemです。更新境界・デバイス経路・全体クリアを担当し、ゲーム用の別の状態読み取り方式は提供しません。GameはBrowserInputを1つ所有し、有効なActionの割り当てだけを受け取ります。新しい操作もButton等のActionとして定義でき、別Adapterを追加する必要はありません。

独自キーボードAdapterや割り当ての専用テストだけで `engine.input.createKeyboardSource(owner?)` を使います。KeyCodeを受け取る書き込み専用ハンドルで、ゲーム用の物理キーフレームや移動判定はありません。タッチ・AI・通常テストはActionSourceへ論理値を渡します。入力元の寿命・clear・disposeの共通実装を共有し、片方の解放で他方を取り消しません。snapshotはデバイス診断で、ゲーム状態にはcontrols.snapshot()を使います。

## 文字入力・タイピングゲーム

KeyboardEvent.codeは操作キーの位置です。入力された文字、貼り付け、ソフトウェアキーボード、IME確定文字列にはネイティブinput／textareaのvalueとinput・compositionイベントを使います。英語・ローマ字の正解判定やローマ字→かなの対応はゲーム側のルールです。IME変換中の候補を確定入力として採点しません。

BrowserInputはネイティブ編集欄・contenteditable・IME変換中を除外し、編集欄へのフォーカス移動でキーボード由来の操作を解放します。文字をActionや削除した旧入力へ押し込みません。DOM編集欄のリスナーはSceneのsignal、要素の削除はonDisposeへ結び付けます。compositionend.dataとinput.dataの両方を追加すると重複し得るため、確定後のvalueを比較して一度だけ更新します。入力途中の削除や選択範囲置換も通常の編集として扱います。

実行可能なコード例は[英語ガイド](../en/actions.html#text-and-typing-games)を参照してください。専用TextInputウィジェットは未実装です。必要になった段階でWeb側に編集欄・選択・変換中／確定の状態を扱う独立した補助を追加できます。モバイルでは表示された入力欄をユーザーがタップしてフォーカスできるようにし、毎フレームの強制フォーカスやキーボードイベントへの依存を避けます。実機ソフトウェアキーボードとOSのIME候補UIは未検証です。

## ポインター・時間・ヘッドレス

ブラウザのclient座標は`game.pointerToWorld(event)`で世界座標へ変換します。範囲外も変換するため、必要なら`containsScreenPoint`で表示範囲を確認します。

Engine.stepは有限・非負の秒数を明示的に受け取ります。再現にはseed、step列、Action入力列、外部時刻・乱数を使わないゲームロジックを揃えます。controls.snapshot()は捕捉済みAction状態、Engine.snapshot()は汎用Actor状態等をコピーします。Componentの完全保存・復元やリプレイファイル形式は提供しません。

WebはRAFの可変deltaで既定上限0.05秒です。固定ステップやCCDではありません。Timerはstep開始時の対象を捕捉し、実行中に登録したafter(0)は次stepから発火します。everyは1step最大1回で欠落分をまとめて実行せず、端数は保持します。
