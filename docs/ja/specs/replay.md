# 乱数・Replay・固定ステップ

Simpludifyは決定論的な乱数ストリーム、論理Action記録、決定論的リプレイ、有界な固定ステップ実行を提供します。外部の非決定論的な時間をゲームルールから排除し、テストと再現性を高めます。

## 乱数ストリーム

```ts verify
import { Engine, RandomManager } from "@simpludify/core";
const engine = new Engine({ seed: 42 });
const roll = engine.random.stream("loot").next();
const independent = new RandomManager(42);
const first = independent.stream("loot").next();
console.log(roll === first); // true: 同一seedから同一乱数列
engine.dispose();
independent.dispose();
```

`new Engine({ seed: 42 })`と`new RandomManager(42)`は同一の既定シーケンスを再現します。明示的なseedは0〜4294967295の整数でなければなりません。負の数や小数は切り捨てることなく拒否されます。`next()`は[0,1)の数値を返します。初期`seed`、現在の`state`、消費された`calls`数は個別に管理されます。マネージャは正確で大文字小文字を区別する名前ごとにハンドルをキャッシュします。名前は1〜256のUTF-16コードユニットを含みます。`$default`は既定ストリームを指します。あるストリームを取得しても別のストリームを消費することはありません。

アルゴリズム識別子: **lcg32-fnv1a-utf16le-v1**。既定ストリームはマスターseedから開始します。各状態遷移は`(1664525 * state + 1013904223) mod 2^32`であり、Math.imulと符号なし型強制で実装されます。出力は2^32で除算されます。名前付きseedは2166136261から始まるFNV-1a-32を使用し、マスターの4つのリトルエンディアンバイトを処理した後に、各UTF-16コードユニットの下位バイト、上位バイトの順で処理します。各バイトは`hash = imul(hash xor byte, 16777619) >>> 0`を適用します。ロケール変換やUnicode正規化はありません。他のストリームの作成順序や消費が対象ストリームの状態を変更することはありません。有限な32ビットseed/ハッシュは衝突する可能性があります。これは軽量なゲーム用PRNGであり、暗号論的乱数ではありません。

seedを指定しない場合、マネージャは利用可能な場合に移植可能な`globalThis.crypto.getRandomValues`機能を使用します。モダンブラウザと対応するNodeビルドがこれを提供します。それを持たないホストや失敗したホストでは初期seedにMath.randomへフォールバックします。自動seedの一意性は保証されません。シード設定後のPRNGは常に特定の決定論的アルゴリズムです。

Engineは自身のマネージャを所有します。Sceneの差し替えはすべてのストリームとその消費状態を維持します。disposeは以前保持されていたハンドルを含む将来のnext/stream呼び出しを無効化します。

移行: `engine.random()`は`engine.random.next()`になり、`new Engine(42)`は`new Engine({ seed: 42 })`になります。Gameのseedオプションは省略可能で、自動生成が既定です。`Engine.snapshot().random`が古い単一のrandomStateフィールドを置き換えます。

## 論理Actionの記録と再生

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Engine,
  parseReplayData,
  ReplayPlayer,
  ReplayRecorder,
} from "@simpludify/core";
const Actions = defineActions({ Move: Action.axis2D(), Fire: Action.button() });
function create(seed: number) {
  const engine = new Engine({ seed });
  const controls = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
  });
  engine.scene.add(Character({ movement: controls.reader(Actions.Move) }));
  return { engine, controls };
}
const live = create(42);
const recorder = new ReplayRecorder(live.engine, {
  controllers: { player: live.controls },
  metadata: {
    gameVersion: "movement-example-1",
    difficulty: "normal",
    buildId: "local",
  },
});
const source = live.controls.createSource();
source.set(Actions.Move, { x: 1, y: 0 });
source.set(Actions.Fire, true);
source.set(Actions.Fire, false); // 短いタップを保持
live.engine.step(1 / 60);
recorder.record("checkpoint", { x: live.engine.scene.actors[0]?.id ?? "none" });
const data = recorder.finish();
const text = JSON.stringify(data);
const decoded = parseReplayData(JSON.parse(text));
const replay = create(decoded.random.seed);
const player = new ReplayPlayer(replay.engine, decoded, {
  controllers: { player: replay.controls },
  expectedMetadata: { gameVersion: "movement-example-1", buildId: "local" },
});
while (player.step()) {
  /* 実時間の待機なし */
}
console.log(live.engine.snapshot(), replay.engine.snapshot());
player.dispose();
live.engine.dispose();
replay.engine.dispose();
```

レコーダー／プレイヤーは、**決定論的なゲーム設定の後、新しいEngineの最初のstepの前に**構築します。ゲーム途中の記録開始は拒否されます。初期seed単体では途中のゲーム状態を再構築できないためです。最初に記録された境界の直前の乱数状態が初期条件検査のために保存されます。再生には同じセットアップ／アクティブ化の乱数消費が必要です。一致を強制するために任意のゲーム状態を復元することはありません。

アクティブなすべてのActionControllerを明示的な安定IDでバインドします。2つのコントローラーが両方`Fire`を定義している場合、IDによってそれらを明確化します。IDとAction名／種類／正規化設定は一致していなければなりません。シンボルやオブジェクトの同一性はシリアライズされません。ターゲットコントローラー内では、インポートされた名前がそのコントローラー自身の型付きトークンに解決されます。記録されるフレームはすでに合成された論理入力であるため、物理キー割り当てが異なっていても構いません。

フレームはすべてのButton/Axis1D/2D/3D値に加えて、**順序付けされたButtonのdown/upイベントリスト**を保存します。これにより、step内のタップ、連続押し、ボタン間の順序、複数入力元の合成が保持されます。キャプチャされたフレームはonPressedディスパッチの前に既存のAction境界に入ります。これらが人工的な物理キーとして再生成されたり、ライブの入力元の上に加算されることはありません。正規化されたベクトルが2回正規化されることもありません。

再生は論理フレームを排他的に所有します。ブラウザキーは受け入れられません。ニュートラルでないAction/デバイス書き込みは`REPLAY_INPUT_LOCKED`をスローします。ニュートラルなクリーンアップは安全です。リプレイビューアではライブのタッチ／AI入力を無効化してください。プレイヤーの破棄は入力を解放し、通常の入力をアンロックします。直接のEngine.stepは次に記録されたdeltaでのみ許可されます。player.step()がそれを供給し、終了時にfalseを返します。完了後もドライバは破棄されるまでアタッチされたままであり、記録外の意図しないステップ実行を防ぎます。

境界ごとにpausedBefore/pausedAfterが記録されます。再生は境界間の外部一時停止変更を適用し、ゲームの一時停止コールバックが同じ事後状態を生成することを検証します。記録された一時停止Actionはシミュレーション停止中も実行されます。一時停止中の入力処理を含む0秒の境界も正確な順序を保持します。ホストの実時間一時停止時間は記録されません。

初期サポートは**新しいEngineセッションにつき1つのScene**です。Scene差し替えの前にfinish/disposeを行ってください。サポート外の遷移はCoreコミット前に拒否されます。

## JSONフォーマットと補助観測点

`finish()`はJSONシリアライズ可能なプレーンオブジェクト`ReplayData`を返します。スキーマバージョンは`simpludify-replay-1`です。これにはメタデータ、乱数seed、初期状態、コントローラーマニフェスト、ステップ列、任意の観測点（checkpoints）が含まれます。`parseReplayData`はスキーマとステップの整合性を検証します。

観測点（checkpoints）はステップ境界に記録される任意の補助データです。再生中に`player.onCheckpoint`で観測点データを比較検証し、シミュレーションが乖離していないかを検証できます。

## 固定ステップとブラウザ表示

Webは既定で可変RAF deltaを使用しますが、`fixedStep`オプションを指定することで有界な固定ステップ蓄積を選択できます。

```ts
const game = new Game({
  fixedStep: {
    step: 1 / 60,
    maxSteps: 4,
    maxFrameDelta: 0.1,
  },
});
```

蓄積された時間が`step`に達するごとに1回の`engine.step(step)`が実行されます。過剰な停滞時間は`maxSteps`によって切り捨てられ、フレーム落ち時のスパイラルを防ぎます。表示アニメーション（Presentation Tween）は表示フレームのdeltaで進み、固定ステップのシミュレーションと独立して滑らかに動作します。

## 決定論の限界

- **外部時間・乱数：** `Date.now()`、`performance.now()`、外部の`Math.random()`をゲームロジックで使用すると決定論が崩れます。`Engine.random`とUpdateContextのdeltaを使用してください。
- **浮動小数点数：** 同一ブラウザ・同一プラットフォームでは決定論的ですが、異なるアーキテクチャやコンパイラ最適化を跨いだ厳密なビット一致（Cross-platform bitwise determinism）は保証されません。
- **非同期ロード：** アセットのロード完了順序がシミュレーションに影響を与えないよう、Sceneの準備フェーズで必要なアセットをすべて解決してください。
- **GPU・描画：** 画面出力ピクセルやGPUの内部タイミングは決定論の対象外です。

## 実ゲームでの検証と負荷

Prism RaidとBlockfallにおいて、記録されたAction列からの完全なリプレイ再現性が自動テストで検証されています。Prism Raidの60ラウンド連続自動プレイにおいて、同一seedと入力から完全に一致する勝敗、スコア、撃破数、最終Actor状態が再現されます。
