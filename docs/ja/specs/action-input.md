# 入力とゲームループ

物理デバイスイベントの直接配送ではなく、論理Actionの合成と更新境界を基本とします。キーボード・タッチ・ゲームパッド・プログラム入力を1つのモデルで扱います。

## 型安全なActionを定義する

```ts verify
import {
  Action,
  ActionController,
  defineActions,
  Engine,
  KeyboardBindings,
  KeyCode,
} from "@simpludify/core";

const Actions = defineActions({
  Move: Action.axis2D(),
  Fire: Action.button(),
  Aim: Action.axis2D({ normalize: false }),
});

const engine = new Engine();
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: {
    Move: KeyboardBindings.WASD,
    Fire: { keys: [KeyCode.Space] },
  },
});

controls.onPressed(Actions.Fire, () => console.log("Fire pressed"));
controls.createSource().set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
engine.dispose();
```

Actionの種類は`button`・`axis1d`・`axis2d`・`axis3d`です。`defineActions`は名前から型付きトークンのマップを作ります。スペルミスや値の型の不一致はTypeScriptのコンパイルエラーになります。

## キーの物理位置と文字を区別する

キーボードは`KeyboardEvent.code`に対応する物理キー位置（`KeyCode`）を使用します。QWERTYのWASDと、配列によって文字位置が変わるDvorakやフランス語AZERTYの互換性を考慮し、位置を基準に判定します。

`KeyboardBindings.WASD`と`KeyboardBindings.Arrows`は合成済みのAxis2D物理バインディングデータです。

## 短押しと更新境界

入力は`Engine.step()`の境界で捕捉されます。フレーム間に複数回押されて離されたボタンは、押下イベントの順序と押下状態が失われないよう保護されます。

フレーム内の入力処理順序:
1. デバイス状態のサンプリングと全ActionControllerのフレーム凍結。
2. 一時停止中であっても`onPressed`コールバックの配信。
3. InputフェーズComponentの実行。
4. UpdateフェーズComponentの実行（ActionMovement等）。
5. IntegrateフェーズComponentの実行（Motion）。
6. LateUpdateフェーズComponentの実行。
7. 接触判定・位置補正・接触イベント配信。
8. シミュレーションTween、タイマー、Scene.onUpdateの実行。

## タッチ・プログラム・自動操作

タッチボタンやAIの自動操作には、合成キーイベントを発生させるのではなく、`controls.createSource()`で論理ActionSourceを作成します。

```ts
const touch = controls.createSource(scene);
touch.set(Actions.Move, { x: 0, y: 1 });
touch.set(Actions.Fire, true);
```

複数入力元の合成規則:
- **Button:** 論理OR。いずれかの入力元がtrueならtrue。
- **Axis:** 単純加算。必要に応じてAction定義のnormalizeによって[-1,1]へ正規化。
- 各入力元は独立して有効化／無効化（`enabled`）や破棄が可能です。

## 実行中のリバインドと保存

```ts
controls.rebind(Actions.Fire, { keys: [KeyCode.KeyJ, KeyCode.KeyZ] });
const saved = JSON.stringify(controls.exportBindings());
controls.importBindings(JSON.parse(saved));
console.log(controls.conflicts(), controls.getBinding(Actions.Fire));
controls.resetBindings();
```

`exportBindings()`と`importBindings()`により、設定画面やローカルストレージへの保存が容易になります。競合診断（`conflicts()`）により重複した割り当てを検出できます。

## Component・Characterへの入力注入

```ts verify
import {
  Action,
  ActionController,
  ActionMovement,
  Actor,
  Character,
  defineActions,
  Engine,
  KeyboardBindings,
  Motion,
  Transform,
} from "@simpludify/core";
const engine = new Engine();
const Actions = defineActions({ Steer: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: { Steer: KeyboardBindings.WASD },
});
const movement = controls.reader(Actions.Steer);
engine.scene.add(Character({ movement }));
const second = engine.scene.add(new Actor());
second.add(new Transform());
second.add(new Motion());
second.add(new ActionMovement(movement));
controls.createSource().set(Actions.Steer, { x: 1, y: 0 });
engine.step(1 / 60);
engine.dispose();
```

`controls.reader(token)`は、kind、所属Scene、disposed、`value()`を持つ読み取り専用の`ActionReader<K>`を返します。Button/Axisの次元をコンパイル時に保持し、3D readerをActionMovementに注入することはできません。複数のreaderがActionのエッジを消費することはありません。Characterにmovementを省略すると表示は行われますが入力は読み取りません。

## 文字入力・タイピングゲーム

Actionはゲーム操作を記述します。テキスト編集は独立したWeb編集ストリームです。タイピングゲームでは物理キーコードではなくネイティブ入力欄のテキストを比較してください。

`CanvasTextInput`はアプリケーションDOMコードなしで標準の単一行フィールドを提供します。BrowserInputはネイティブエディタ、contenteditable、IME変換を無視し、フォーカスがエディタに入るとキーボード移動を解放します。

```ts verify
import { CanvasColumn, CanvasTextInput, Game } from "@simpludify/web";
const game = new Game();
game.scene("typing", ({ canvasUI }) => {
  const answer = CanvasTextInput({ label: "Typing answer", maxLength: 100 });
  answer.onCommit(({ value }) => {
    // 確定した完全な回答とターゲットをここで比較
    console.log(value);
  });
  canvasUI(CanvasColumn([answer], { padding: 16 }));
});
await game.run("typing");
```

編集ごとのフィードバックには`onDraftChange`を使用し、`draft.composing`を検査してください。中間候補は提出ではありません。[ネイティブ文字編集契約](text-input-design.md)を参照してください。

## 入力元の有効化とゲームパッド（v0.1.4）

`ActionSource.enabled`と`KeyboardSource.enabled`の既定値はtrueです。falseに設定すると保持された入力寄与がクリアされ、通常の解放エッジが記録されます。再有効化時に以前の値が自動復元されることはありません。`Controller.keyboardEnabled`は自動キーボード寄与のみをゲートします。

`Game.gamepads.bind(controller, { index, bindings })`は、コントローラー所有のGamepadSourceを作成します。[ゲームパッド契約](gamepads.md)で位置ボタン、アナログ軸、デッドゾーン、複数人割り当てを定義しています。[2人用統一入力ラボ](../../../examples/unified-input/README.md)でキーボード、パッド、タッチ、プログラム入力を組み合わせています。

## 仮想ポインター入力

[仮想スティック・ポインターコントロール](virtual-input.md)は、同一のActionController/ActionSource/ActionReaderを使用して、Axis2Dスティックおよびボタン入力／長押しを提供します。キーコードの合成やCharacterの置き換えは行いません。

## 検証結果と記録

初期Action基盤の統合ソースチェックポイントは[`1017c25`](https://github.com/oz-coden/Simpludify/commit/1017c259598b47dde823970264473196a08b2428)です。厳密なTypeScript型検査、204件の単体テスト、Chromiumブラウザテスト80件がすべて合格しています。Prism Raidの60ラウンド連続自動プレイでは、172,796ステップ、1,439.97シミュレーション秒、60勝、1,440キルを3.47実秒で完了しました。
