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
const engine = new Engine(42);
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

source.clear/disposeは、そのsourceだけを解放します。Scene破棄はControllerと全sourceを破棄します。Engineのpause/resumeへの状態変更、Scene置換、InputState.clearは、保持と未消費イベントを全sourceから静かに破棄し、人工的な押下・解放イベントは作りません。ブラウザのキー自動リピートで再押下されないよう、新しい押下を必要とします。

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

## 既存の低レベル入力

CharacterのMovement.WASD／Arrows／None、KeyboardController、KeyMap、InputState、InputSource、BrowserInputも利用できます。KeyMapの静的キーはKeyCode型です。InputState/InputSource.set(string, boolean)は任意の識別子を受け付ける低レベルAPIとして残し、キーボード以外をKeyCodeへ押し込みません。

独自の物理キーをBrowserInputで直接扱う場合は、明示的に受理キーと所有者によるdisposeを定義します。通常のActionゲームでは専用Adapterは不要です。

## ポインター・時間・ヘッドレス

ブラウザのclient座標は`game.pointerToWorld(event)`で世界座標へ変換します。範囲外も変換するため、必要なら`containsScreenPoint`で表示範囲を確認します。

Engine.stepは有限・非負の秒数を明示的に受け取ります。再現にはseed、step列、Action入力列、外部時刻・乱数を使わないゲームロジックを揃えます。controls.snapshot()は捕捉済みAction状態、Engine.snapshot()は汎用Actor状態等をコピーします。Componentの完全保存・復元やリプレイファイル形式は提供しません。

WebはRAFの可変deltaで既定上限0.05秒です。固定ステップやCCDではありません。Timerはstep開始時の対象を捕捉し、実行中に登録したafter(0)は次stepから発火します。everyは1step最大1回で欠落分をまとめて実行せず、端数は保持します。
