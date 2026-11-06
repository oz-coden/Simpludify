# 移動とComponentの合成

Actionは論理的な操作意図を表現します。Action自身はMotion、Character、ワールド座標、物理演算の知識を持ちません。Motionは入力から独立した任意のキネマティック移動積分器です。ActionMovementは小さなアダプターであり、移動を実現する唯一の経路ではありません。Transformは位置・回転・拡縮の状態を保持し、CollisionBodyはSolidの補正の重みを提供し、別の速度ストレージではありません。

## 標準移動と実行時倍率変更

```ts verify
import {
  Action,
  ActionController,
  ActionMovement,
  Character,
  defineActions,
  Engine,
  KeyboardBindings,
  Motion,
} from "@simpludify/core";
const engine = new Engine({ seed: 42 });
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
const player = engine.scene.add(
  Character({ movement: controls.reader(Actions.Move), speed: 180 }),
);
const movement = player.require(ActionMovement.type);
movement.scale = 2; // 1 = 通常, 0.5 = 減速, 0 = 停止
player.require(Motion.type).speed = 200; // 実行中に基準速度を変更
controls.createSource().set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
engine.dispose();
```

Motionは、モデルと書き込み可能な第2の速度状態を二重に持つのではなく、**direction × speed**のモデルを維持します。既存の弾丸やAIコードはすでに正規化されていない方向倍率を使用しており、Characterは便利な基本速度を使用しています。speedを変更可能にすることで、競合する表現間の変換や同期を導入することなく、必要な制御を提供します。意図された速度ベクトルはワールド単位／秒で`(direction.x * speed, direction.y * speed)`であり、移動量はその速度にdelta（秒）を掛けた値です。衝突補正によって実際の移動量が小さくなる場合があります。実際の移動量が必要な場合は、stepの前後にTransformを検査してください。

`Motion.speed`は既定180で、変更可能、有限、非負です。0を指定すると移動積分が停止します。`direction`は既定で(0,0)であり、負の値や1より大きい大きさを含む任意の有限x/yを受け入れ、自動的に正規化されることはありません。directionオブジェクトの参照自体を置き換えることはできませんが、そのコンポーネント（x/y）は変更可能です。無効なspeedやscaleの代入は、新しいスカラー値を受け入れずに`INVALID_VALUE`をスローします。directionはTransformと同様に通常の変更可能な数値データです。コンストラクタは初期値を検証し、Integrateは位置を変更する前に無効なx/yを拒否します。いずれかのTransform座標がコミットされる前に両方の導出座標が検証され、オーバーフローはスローされます。失敗しても無関係なComponentやstep全体がロールバックされることはありません。

`new ActionMovement(reader, { scale: 2 })`と`.scale = 2`は同じ有限・非負ポリシーを使用します。既定値は1であり、恣意的な上限はありません。オーバーフローする導出コマンドは拒否されます。scaleはActionControllerの合成・正規化の**後に**キャプチャされたベクトルを乗算します。ActionSourceに書き戻したり、2倍になったコマンドを[-1,1]に切り詰めることはありません。負のscaleは拒否されます。反転操作には明示的な方向変換を使用してください。Characterのspeedオプションは`Motion.speed`を初期化するだけであり、Characterが重複した速度を保持することはありません。

## ゲームポリシーとしてのダッシュ

```ts verify
import {
  Action,
  ActionController,
  ActionMovement,
  type ActionReader,
  Character,
  Component,
  ComponentPhase,
  type ComponentType,
  defineActions,
  defineComponent,
  Engine,
  KeyCode,
} from "@simpludify/core";
class SprintScale extends Component {
  static readonly type: ComponentType<SprintScale> =
    defineComponent<SprintScale>("SprintScale", [ActionMovement.type]);
  readonly type = SprintScale.type;
  readonly phase = ComponentPhase.Input;
  private movement: ActionMovement | undefined;
  constructor(private readonly sprint: ActionReader<"button">) {
    super();
  }
  protected onAttach(): void {
    this.movement = this.actor.require(ActionMovement.type);
  }
  protected onDisable(): void {
    if (this.movement) this.movement.scale = 1;
  }
  protected onDestroy(): void {
    this.onDisable();
    this.movement = undefined;
  }
  update({ scene }: import("@simpludify/core").UpdateContext): void {
    if (this.sprint.scene !== scene)
      throw Error("Sprint reader belongs to another Scene");
    if (this.movement)
      this.movement.scale =
        !this.sprint.disposed && this.sprint.value() ? 2 : 1;
  }
}
const engine = new Engine({ seed: 42 });
const Actions = defineActions({
  Move: Action.axis2D(),
  Sprint: Action.button(),
});
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
  bindings: { Sprint: { keys: [KeyCode.ShiftLeft, KeyCode.ShiftRight] } },
});
const player = engine.scene.add(
  Character({ movement: controls.reader(Actions.Move) }),
);
player.add(new SprintScale(controls.reader(Actions.Sprint)));
const touchOrAI = controls.createSource(engine.scene);
touchOrAI.set(Actions.Move, { x: 1, y: 0 });
touchOrAI.set(Actions.Sprint, true);
engine.step(1 / 60);
engine.dispose();
```

このポリシーはActionMovementのUpdateより前の**Input**フェーズで実行されるため、新しく捕捉されたSprint入力がそのstepに直ちに反映されます。これはアダプターのscaleのみを所有します。パワーアップアイテムなどはMotionの基本speedを独立して変更できます。このポリシーは通常のゲームコードであり、組み込みのSprint Actionや新しい入力コンテキストではありません。Prism RaidではShiftキーとタッチDASHボタンでこのパターンを使用しています。複数のscaleポリシーを適用する場合はゲーム定義の調停が必要であり、エンジンが暗黙に合成することはありません。

## アダプターを独自Componentに置き換える

```ts verify
import {
  Action,
  ActionController,
  type ActionReader,
  Character,
  Component,
  type ComponentType,
  defineActions,
  defineComponent,
  Engine,
  Motion,
  type UpdateContext,
} from "@simpludify/core";
class CustomMovement extends Component {
  static readonly type: ComponentType<CustomMovement> =
    defineComponent<CustomMovement>("CustomMovement", [Motion.type]);
  readonly type = CustomMovement.type;
  private motion: Motion | undefined;
  constructor(
    private readonly move: ActionReader<"axis2d">,
    private readonly sprint: ActionReader<"button">,
  ) {
    super();
  }
  protected onAttach(): void {
    this.motion = this.actor.require(Motion.type);
  }
  protected onDisable(): void {
    if (this.motion) {
      this.motion.direction.x = 0;
      this.motion.direction.y = 0;
    }
  }
  protected onDestroy(): void {
    this.onDisable();
    this.motion = undefined;
  }
  update({ scene }: UpdateContext): void {
    if (this.move.scene !== scene || this.sprint.scene !== scene)
      throw Error("Movement readers belong to another Scene");
    if (this.move.disposed || this.sprint.disposed) {
      this.onDisable();
      return;
    }
    if (!this.motion) return;
    const input = this.move.value();
    this.motion.speed = this.sprint.value() ? 300 : 180;
    this.motion.direction.x = Math.max(0, input.x); // ゲーム固有の制約: 左移動を禁止
    this.motion.direction.y = input.y;
  }
}
const engine = new Engine({ seed: 42 });
const Actions = defineActions({
  Move: Action.axis2D(),
  Sprint: Action.button(),
});
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
});
const player = Character(); // ActionMovementなしでMotionを含む
player.add(
  new CustomMovement(
    controls.reader(Actions.Move),
    controls.reader(Actions.Sprint),
  ),
);
engine.scene.add(player);
controls.createSource().set(Actions.Move, { x: 1, y: 0 });
engine.step(1 / 60);
engine.dispose();
```

カスタムポリシーはreaderの代わりにAIやゲーム状態を使用したり、任意の有限なdirection/speedを書き込んだり、スクリプトパスを表現するためにTransformを直接更新することができます。ActionReader.map、移動パイプライン、DIフレームワーク、入力エミュレーションなどは不要です。Signal Runの[SignalMovement](../../../examples/signal-run/logic.ts)はキーボードの意図またはポインター目的地を単一のUpdate Componentで選択し、行き過ぎを防ぐために最後の移動量を制限し、Motionへ直接書き込みます。ActionMovement依存や暗黙の上書き順序はありません。

自律的な弾丸であれば、Transformと`new Motion({ speed: 300, x: 0, y: -1 })`を追加するだけです。CharacterもActionControllerも不要です。Motionを無効化するとコマンドを保持したまま移動積分が一時停止し、有効化すると再開します。ActionMovementを無効化または除去するとdirectionがクリアされ、破棄されたreaderはニュートラルになります。カスタム書き込み者はonDisable/onDestroyで停止／リセットポリシーを自身で管理します。Actorの無効化はすべてのフェーズをゲートします。Engineの一時停止はシミュレーションをスキップし、再開時に入力寄与がクリアされます。

## 更新順序と書き込みの競合

stepはButtonコールバックを配信する前に、Actor/Component/タイマーの適格性とすべてのActionフレームを捕捉します。固定されたグローバルなComponent順序は以下の通りです。

| フェーズ               | 役割                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| Input                  | コマンド生成者を設定するポリシー（スプリント倍率など）                 |
| Update（既定）         | ゲームルールとコマンド計算。ActionMovementまたはカスタム移動書き込み者 |
| Integrate              | Motionが現在のコマンドをTransformに適用                                |
| LateUpdate             | 接触判定前の位置クランプ、新位置からの発射処理、画面外クリーンアップ   |
| Scene post-update      | CollisionWorldの位置補正／検出と接触イベント配信                       |
| Timers, Scene.onUpdate | シミュレーションタイマーと最終観測／UI状態                             |

すべてのActorがフェーズを完了してから、Sceneは次のフェーズを開始します。フェーズ内ではActorおよびComponentの追加順序が維持されます。依存関係要件は存在と所有権の安全性を強制するものであり、同フェーズ内の順序ソートではありません。Motionの後にアタッチされたカスタムUpdate Componentは同じstep内で反映されます。移動後の処理は明示的にLateUpdateを選択しなければなりません。

**Motionごとに1つのdirection書き込み者を使用してください。** `Character()`にカスタム書き込み者を追加するのが標準的な置き換えパスです。同一フェーズ内で複数の書き込み者を意図的に組み合わせる場合、後の書き込みが勝ちます。自動的なブレンディングや所有権レジストリはありません。Inputでのdirection書き込みはUpdateアダプターによって上書きされる可能性があります。アダプターのUpdate後に`adapter.scale`を変更しても次回Updateにしか影響しないため、倍率ポリシーにはInputを使用します。LateUpdateでMotionコマンドを書き込むと、次回のIntegrateに影響します。

実行計画はキャッシュされ、step開始時に捕捉されます。追加された要素は次のstepで初めて更新され、除去や無効化は後続の実行を直ちに抑止します。空のフェーズ計画は変更不可能な配列を共有し、通常の移動でstepごとのベクトル割り当ては発生しません。

## Motion、CollisionBody、Transform

Transformは共有されるワールド位置状態です。Motionは単純なキネマティック積分であり、加速度、摩擦、重力のシミュレーションではありません。CollisionBodyはSolidペアに対して逆質量による位置補正参加を追加し、Motionの意図を所有または書き換えることはありません。Staticは位置ロックではなく補正の重みが0であることを意味します。スクリプト制御されたStaticオブジェクトも移動できます。Triggerは位置を補正しません。CollisionWorldはIntegrateとLateUpdateの後に実行されるため、接触判定はそのstepで補正・クランプされた位置を参照します。Transformの直接書き込みとMotionは両方許可されますが、誤って同一軸を2回動かさないよう配慮してください。LateUpdateのクランプは衝突補正の前に発生します。最終的な補正後位置を観察するには`Scene.onUpdate`を使用してください。

一定の意図は、浮動小数点誤差を除き、固定または可変の細分化にかかわらず、等しい積算シミュレーション時間で同じ変位を生み出します。衝突、タイマー、状態変化、クランプされた目的地は細分化に依存する場合があります。FixedStepRunnerは有界な追いつきを持ち、ホスト時間を破棄する場合があります。実時間ではなく実行されたdtの合計を比較してください。Replayは論理Actionと正確なstep deltaを記録し、speed/scale/AI状態の恣意的な変化は記録しません。Signal Runのキーボード／タッチMove Actionは正常にリプレイされますが、直接のsetTargetポインター目的地はゲーム所有の外部状態であり自動キャプチャされません。

## 移行と周辺スコープ

- `Motion.speed`は変更可能になり、0を受け入れます。direction値は構築時および積分時に検証され、オブジェクト自体の置き換えは拒否されます。
- MotionはUpdateからIntegrateへ移動しました。ActionMovementはInputからUpdateへ移動しました。移動後のカスタムUpdate ComponentはLateUpdateへ移行してください。倍率ポリシーはInputを使用します。
- Characterのオプションと任意のmovement readerは引き続き有効です。新しいCharacter速度フィールドや必須アダプターは導入されていません。
- Signal RunはPointControlとActionMovementを単一のカスタムSignalMovementに置き換えました。Prism Raidのクランプ／武器／TTL ComponentはLateUpdateを使用します。
- Renderableは置き換えなしで検証済みの色／寸法／ソース変更をサポートします。[描画契約](rendering.md)を参照してください。

## 測定された検証結果

[生データレポート](../../../benchmarks/movement)に、低速だった中間実装を含む全測定シリーズが保存されています。ベースラインはクリーンな`01bb2fb`、中間ソースは`939863b`、最終測定ソースは`744e087`です。Node 24.22.1、Linux、AMD EPYC 9V74共有ホスト、Vite SSR、GC露出環境を使用しました。記録された各コマンドは単独で実行されました。

```sh
npm run bench:movement -- --out /tmp/movement.json
npm run bench:shooter -- --out /tmp/shooter.json
npm run bench:response -- --out /tmp/response.json
```

移動フィクスチャは1,000個のActorを作成し、300 stepのウォームアップ後、dt=1/120で1,000 step（100万Actor step）を測定します。総移動距離、ソースのクリーンアップ、完全な実ゲーム勝敗フィンガープリントを検証します。

ベースラインと最終版を交互に測定した結果は以下の通りです。

| ワークロード                                | ベースライン中央値 | 最終版中央値   |
| ------------------------------------------- | ------------------ | -------------- |
| 自律移動（100万 Actor step）                | 91.71 ms           | 72.76 ms       |
| 標準 ActionMovement（同ワークロード）       | 446.04 ms          | 416.61 ms      |
| カスタム Input 書き込み者（同ワークロード） | 178.74 ms          | 144.09 ms      |
| 10,000個の弾丸Actor作成／破棄               | 13.33 µs/Actor     | 12.25 µs/Actor |
| Prism Raid: 60回の完全自動ラウンド          | 3.82 s             | 4.56 s         |

シューティングゲームの測定では、5ラウンドのウォームアップ後、seed 42〜101、dt=1/120、6 stepごとの通常のAction自動操作を使用しました。すべての呼び出しで172,796境界／1,439.97シミュレーション秒、60勝、1,440キル、同一の弾丸／敵カウントを完了し、破棄後にラウンド／ワールドリソースが空であることを確認しました。最終ゲームは新しいSprint Button/ポリシーと追加のフェーズ処理を実行しています。この有界なCoreワークロードは、実時間1秒あたり数百シミュレーション秒を進めることができます。

別のレスポンスフィクスチャではMotionとCollisionBody/Transformを測定しました。100体の動的Solid移動はp50で0.2337→0.2393 ms、1,000個の静的障害物＋1体の動的Actorは1.5522→1.7193 msでした。60ラウンドの最終セッション中、強制GC後のヒープは約19.65〜19.76 MB（SSR／ツールを含む）でした。
