# 基本概念

便利なプリセットと、組み合わせ可能な小さな部品を両立します。ゲーム固有のルールは通常のTypeScriptで表現できます。

## 責務と所有権

| 概念      | 担当                                        | 寿命                         |
| --------- | ------------------------------------------- | ---------------------------- |
| Engine    | 現在のScene、入力の固定、明示的な時間更新   | アプリケーションが所有       |
| Scene     | Actor集合、タイマー、ローカルイベント       | 切り替え時に旧Sceneを破棄    |
| Actor     | ゲーム内の識別可能な対象とComponent         | 1つのSceneに所属。削除は破棄 |
| Component | データまたは再利用可能な振る舞い            | 1つのActorに所属             |
| EventBus  | 任意の型付き同期通知                        | 明示した所有者が管理         |
| Web Game  | 描画、ブラウザ入力、非同期Scene準備、DOM UI | `dispose()`で解放            |

SceneやComponentを破棄後に再利用するAPIではありません。`remove`は一時的な取り外しではなく終端の破棄です。

## Actorを組み合わせる

```ts
import { Actor, Motion, Renderable, Transform } from "@simpludify/core";

const actor = new Actor({ id: "courier" });
actor.add(new Transform({ x: 120, y: 200 }));
actor.add(new Renderable({ width: 24, height: 24, color: 0x73e3c0 }));
actor.add(new Motion({ speed: 80, x: 1, y: 0 }));
scene.add(actor);
```

依存Componentは先に追加します。RenderableとMotionはTransformを必要とします。同型Componentの重複、インスタンスの共有、依存先の先行削除は診断エラーになります。非表示のActorやTransformを持たないロジック専用Actorも作れます。

## 独自Component

```ts
import {
  Component,
  type ComponentType,
  defineComponent,
  Transform,
  type UpdateContext,
} from "@simpludify/core";

class Drift extends Component {
  static readonly type: ComponentType<Drift> = defineComponent<Drift>("Drift", [
    Transform.type,
  ]);
  readonly type = Drift.type;
  update({ delta }: UpdateContext): void {
    this.actor.require(Transform.type).x += 20 * delta;
  }
}
```

`type`は名前文字列ではなく識別トークンです。`actor.get(Drift.type)`は型の付いた値かundefined、`require`は存在しなければエラーを返します。依存宣言は構造上の制約であり、自動スケジューラではありません。

## イベントは任意

状態を通常の変数として読み書きしても、Componentから問い合わせても構いません。複数の利用先へ通知する場面では型付きイベントを使えます。

```ts
import { defineEvent } from "@simpludify/core";
const ScoreChanged = defineEvent<{ score: number }>("ScoreChanged");
scene.events.on(
  ScoreChanged,
  ({ score }) => label.setText(String(score)),
  scene,
);
scene.events.emit(ScoreChanged, { score: 1 });
```

最後の所有者引数でScene・Actor・Componentの寿命に購読を結び付けます。別のバスへ購読する場合にも有効です。同期通知は登録順です。同一トークンの同一バスへの再帰配送とPromiseを返すハンドラは診断対象です。非同期処理は別に所有して開始してください。

## 更新順序と変更

1. 入力をそのステップ用に固定する。
2. 全ActorのInputフェーズComponentを実行する。
3. UpdateフェーズComponentを実行する。
4. post-updateフックで衝突判定・位置補正・接触通知を行う。
5. Sceneのシミュレーションタイマー、Scene.onUpdateを実行する。
6. Webが現在の状態を描画する。

同一フェーズではActor・Componentの追加順です。追加したActor/Componentの更新は次のステップから、削除・無効化は後続実行を即時抑止します。`onUpdate`で動かした座標への接触判定は次のステップになります。通常の移動はComponentに配置してください。

## ゲーム固有のモデル

落ち物パズルなら盤面配列・回転・行消去を通常のゲームロジックにし、Actor/Renderableは表示、入力は操作、UIは得点を担当できます。グリッド判定にColliderを使う必要はありません。[Blockfall](../../examples/blockfall/README.md)はこの構成を実装したサンプルです。7-bag・回転・ホールド・ゴースト・得点はゲーム側に置き、公開APIによる入力・Scene・描画から分離しています。
