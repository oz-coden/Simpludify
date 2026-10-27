# 移動とComponent

Actionは論理的な操作意図、Motionは入力に依存しない単純移動、Transformは位置・回転・拡縮を担当します。ActionMovementはActionとMotionをつなぐ任意の便利Componentです。独自の移動に標準アダプターを使う必要はありません。

## 標準移動と倍率

```ts verify
import {
  Action,
  ActionController,
  ActionMovement,
  Character,
  defineActions,
  Engine,
  Motion,
} from "@simpludify/core";
const engine = new Engine({ seed: 42 });
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
});
const player = engine.scene.add(
  Character({ movement: controls.reader(Actions.Move), speed: 180 }),
);
const movement = player.require(ActionMovement.type);
movement.scale = 2; // 1:通常、0.5:減速、0:停止
player.require(Motion.type).speed = 200; // 実行中の基準速度変更
controls.createSource().set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
engine.dispose();
```

Motionはdirection×speedのモデルを維持しています。directionは有限の無次元ベクトルで、1より大きい倍率や負方向も許容し、自動正規化しません。speedは世界単位／秒、既定180、有限の0以上で、読み取り・変更できます。CharacterのspeedはMotion.speedを初期化するだけで、別の速度状態を持ちません。

ActionMovement.scaleは既定1、有限の0以上です。Action側の合成・正規化後に倍率を掛けるため、2倍が[-1,1]へ潰されず、Action値そのものも変えません。`new ActionMovement(reader, { scale: 2 })`でも指定できます。speed／scaleは代入時、directionは構築時とIntegrate時に有限数を検証し、計算結果のオーバーフローも座標反映前に拒否します。directionオブジェクトの交換はできませんが、x/yは変更できます。

## ダッシュと独自移動

Prism Raidでは、ゲーム側のSprintScaleがShift／DASHのButton Actionを読み、Inputフェーズで標準ActionMovement.scaleを1／2へ変更します。同じステップのUpdateでアダプターが指示を計算し、IntegrateでMotionが移動します。基準速度を変える効果と、ダッシュ倍率は別の責務です。

独自制御は`Character()`へ自分のComponentを追加します。movementを渡さなければActionMovementは追加されません。標準のUpdate内でreaderを読み、任意の制限・変換やAI計算を行ってMotion.directionとspeedへ渡せます。Motionが先に追加されていても、そのステップで反映されます。

[型チェックされるダッシュ例・独自Componentの完全例](../en/movement.html)と、[Signal RunのSignalMovement](../../examples/signal-run/logic.ts)を参照してください。Signal Runはキー入力とポインター目的地を単一Componentで選び、目的地到着時の移動量を制限します。ActionMovementへの先行書き込みや上書き順には依存しません。

入力なしの弾や自律移動なら、Transformと`new Motion({ speed: 300, x: 0, y: -1 })`だけで構成できます。特定Action名、変換パイプライン、専用登録システムは必要ありません。

## 更新順序と所有権

全Actionの捕捉・Button通知後、全Actorについて以下の固定順序で実行します。

| 順序                          | 担当                                   |
| ----------------------------- | -------------------------------------- |
| Input                         | scaleなど、指示計算に先立つゲーム方針  |
| Update（独自Componentの既定） | ActionMovementまたは独自の移動指示計算 |
| Integrate                     | MotionがTransformへ位置を反映          |
| LateUpdate                    | 移動後のクランプ・射撃・画面外削除     |
| post-update                   | CollisionWorldの補正・接触通知         |
| タイマー・Scene.onUpdate      | シミュレーション時間と最終状態の観測   |

同一フェーズはActor・Componentの追加順です。依存宣言は存在・所有権の制約で、自動並べ替えではありません。1つのMotion.directionの書き手は基本的に1つにし、独自Componentへ置換するなら標準ActionMovementを付けません。意図的に複数から書く場合は後の値が優先されます。scaleをアダプター実行後に変えれば次回から、LateUpdateで指示を変えれば次のIntegrateから反映されます。

追加は次のステップから、削除・無効化は後続処理を即時抑止する契約を維持します。Motionの無効化は指示を保持して積分を止め、再有効化で再開します。ActionMovementの無効化・削除やreader破棄では指示を中立化します。独自Componentも必要なonDisable／onDestroyを実装します。Sceneのreaderを次のSceneへ持ち越さないでください。

## Body・衝突・Replayとの関係

CollisionBodyはSolid補正の重みです。速度や入力の別の正本ではありません。Motionで移動した後にCollisionWorldが位置補正し、移動意図は書き換えません。StaticでもTransformの明示変更やMotionによる移動は可能です。Triggerは位置補正しません。直接座標操作とMotionを併用する場合は、同じ軸を二重に動かさないよう順序と担当を決めます。

一定の指示なら同じ実行dt合計で同じ距離を得られますが、衝突やタイマーは時間分割に依存します。固定ステップの追いつき上限で捨てた実時間は、実行したシミュレーション時間と区別してください。

Replay形式はv1のままです。記録対象はActionとdtであり、外部から勝手に変更したspeed／scaleそのものは記録しません。同じゲーム方針を再実行するか、その変更をActionとして表現します。Prism RaidはSprint Action追加に伴いゲーム版をprism-raid-replay-2へ変更しています。旧Action定義の記録は再記録してください。

## 移行と今回の範囲

MotionはUpdateからIntegrateへ、ActionMovementはInputからUpdateへ移りました。移動後のComponent処理はLateUpdateへ、倍率方針はInputへ移してください。Characterの基本APIは維持しています。

Renderableはvisible／opacity／zIndex／enabledとTransformが既に実行中更新に対応します。色・サイズ・画像・形状・fitは交換が必要です。描画形状の再作成や非同期画像の所有権も関係するため、今回は全面改修せず、別の描画更新タスク候補としました。Module／Plugin、物理演算、アニメーションの拡張も今回には含めません。
