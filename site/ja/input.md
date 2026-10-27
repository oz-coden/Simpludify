# 入力とゲームループ

Coreはキー状態と明示的なステップ、Webはブラウザイベントとフレーム駆動を担当します。

## キーボード

`Character({ movement: Movement.WASD })`、`Movement.Arrows`、`Movement.None`が選べます。独自マッピングは`KeyboardController`と`KeyMap`を使います。物理キーコードを扱い、KeyboardControllerが対角入力を正規化します。

ゲーム領域へクリックまたはTabでフォーカスすると入力できます。ページ全体のキーボードを常時奪いません。blur、ページ非表示、Scene切り替え、一時停止への変更時にはキーを解放します。

## タッチと独立入力

`HoldButton`と所有されたInputSourceでキーボードとタッチを併用できます。1つの入力元を解放しても、他の入力元が保持するキーは解放されません。

```ts
import { HoldButton, Panel } from "@simpludify/web";
const source = game.engine.input.createSource(scene);
ui(
  Panel([
    HoldButton("Left", (held) => source.set("KeyA", held)),
    HoldButton("Right", (held) => source.set("KeyD", held)),
  ]),
);
```

Scene破棄で入力元も破棄します。HoldButtonはタッチ・マウス・Enter/Spaceの押下と、キャンセル・blur・UI破棄時の解放を扱います。[Signal Run](examples.md#signal-run)で4方向と複数入力を試せます。

## ポインター座標

ブラウザのclient座標を直接世界座標として使わず、`game.pointerToWorld(event)`で変換します。範囲外の座標も変換されるため、必要なら`containsScreenPoint(game.view, game.worldToScreen(point))`で表示範囲を確認します。DOM UI上の操作をゲーム世界の操作と重複させないよう、サンプルでは`.s-panel`を除外します。

## 時間と決定性

`Engine.step(seconds)`は秒単位の有限・非負値を受け取り、上限を設けません。テストでは固定入力、固定ステップ、seed、外部時刻を使わないゲームロジックを揃えます。

```ts verify
import { Character, Engine, Movement } from "@simpludify/core";
const engine = new Engine(42);
engine.scene.add(Character({ movement: Movement.WASD }));
engine.input.set("KeyD", true);
for (let i = 0; i < 60; i++) engine.step(1 / 60);
const state = engine.snapshot();
engine.dispose();
```

WebはRAFの可変deltaを使い、既定で1ステップ0.05秒に制限し、長い停止時間の超過分を捨てます。固定時間物理や連続衝突判定を自動提供するものではありません。ブラウザ描画・非同期アセット順序・外部乱数まで決定的とは限りません。

## タイマーと一時停止

`scene.after(1, callback, owner?)`と`scene.every(2, callback, owner?)`はシミュレーション秒で動作します。繰り返しは1ステップに最大1回で、欠落回数をまとめて再生しません。所有者破棄でキャンセルされます。

`game.pause()` / `resume()`は更新・接触・タイマーを停止／再開します。描画とDOM UI、Scene遷移は継続できます。キー状態とフレーム時刻を調整し、再開直後の大きな移動を防ぎます。ステップ途中のpauseは次のステップから有効です。
