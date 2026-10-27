# 乱数・記録・再生・固定ステップ

RandomはEngineの標準機能、Replayは必要なときだけ作る記録・再生機能です。通常プレイでは記録用オブジェクトや入力ログを作りません。ゲームの任意状態を保存・復元する仕組みではありません。

## 名前付き乱数

```ts verify
import { Engine, RandomManager } from "@simpludify/core";
const engine = new Engine();
console.log(engine.random.seed); // 自動生成された実際の初期seed
const enemy = engine.random.stream("enemy");
const loot = engine.random.stream("loot");
enemy.next();
loot.next();
const random = new RandomManager(42); // Engineなしでも利用可能
console.log(random.stream("map").next());
random.dispose();
engine.dispose();
```

明示的なseedはuint32整数です。同じseedと名前で同じ列を得られ、ストリームの取得順序や別ストリームの消費に影響されません。同じ名前は同じハンドルを返します。`engine.random.next()`は既定ストリームです。初期seedと、消費によって変化するstate／callsは区別します。

方式は`lcg32-fnv1a-utf16le-v1`です。名前付きseedはマスターseedの4バイトLEと名前のUTF-16コード単位の2バイトLEをFNV-1a-32で処理して導出し、各列はLCG32で進めます。名前は大小文字を区別し、Unicode正規化やロケールに依存しません。32bitの衝突はあり得るため、暗号用乱数や数学的な独立性を保証するものではありません。

seed省略時は、利用可能ならNode／ブラウザ共通のCrypto機能から生成し、利用できない場合はMath.randomへフォールバックします。初期seedは取得・記録できます。自動seedの一意性は保証しません。CoreにDOM／Nodeのimportは入りません。

Scene切り替えでストリームは継続します。Engine破棄後はnext／streamが例外になり、既に保持していたハンドルも停止します。seedと診断用snapshotは読み取れます。独立Managerは自分でdisposeします。

旧`engine.random()`は`engine.random.next()`へ、`new Engine(42)`は`new Engine({ seed: 42 })`へ移行します。

## Replayの手順

1. 同じゲーム初期化処理を用意し、新しいEngineでゲームを構築します。
2. 最初のstep前にReplayRecorderを作り、各ActionControllerへ一意の記録IDを付けます。
3. 通常のActionSource・キーボード・タッチ入力で操作します。
4. `finish()`でReplayDataを取得します。JSON.stringifyで文字列にできます。
5. JSON.parse後にparseReplayDataで検証し、記録されたseedで新しいEngineと同じゲームを構築します。
6. ReplayPlayerへ同じIDのControllerを渡し、step()がfalseになるまで進めます。
7. 終了後はPlayerとEngineをdisposeします。

[型チェックされる完全なコード例](../en/replay.html#record-and-replay-logical-actions)と、[Prism Raidの実ゲーム用ヘルパー](../../examples/prism-raid/replay.ts)を参照してください。

```sh
npm run replay:demo
npm run replay:demo -- --out mission.json
```

CLIは通常の自動プレイヤーで勝利まで操作し、JSON往復後の再生で実際のゲーム状態とEngine状態を比較します。ファイルへの保存はCLI側だけが担当します。

## 何を記録するか

形式・エンジン版、実際の初期seed、乱数方式と初期ストリーム状態、Scene ID、Controller IDとAction定義、step番号・dt・pause前後状態、合成済みAction値とButtonの順序付き押下／解放を記録します。同名Actionを持つ複数Controllerも識別できます。短押しや複数押下は保持値だけに潰しません。

ゲーム版・難易度・ステージ・ビルドIDはmetadataへゲーム側が指定します。expectedMetadataで必要な値を確認できます。エンジン版はpackage.jsonに対応するソース定数で、Gitコミットの自動検出ではありません。実験版では同じパッケージ版でもコードが変わるため、ゲーム版やビルドIDも照合してください。

`record("bossDefeated", { bossId: "boss-1", score: 5000 })`のような補助観測も明示的に残せます。step内／境界間の位置と順序を保存しますが、再生時のゲーム命令として自動実行しません。

Coreはメモリ上のJSON互換データだけを扱います。ファイル・ダウンロード・ネットワークへの保存は利用側の責務です。関数、undefined、循環、非有限数などは拒否します。件数・深さの上限もあります。初版は各境界をそのまま記録し、圧縮しません。

## 再生の制約と所有権

初版は**新しいEngine・最初のstepから・1つのScene**が対象です。途中記録、シーク、巻き戻し、任意Componentの完全復元は提供しません。記録されたseedだけで途中状態を復元したことにはしません。初期化時の乱数消費も比較します。

すべての有効Controllerを登録し、記録中は定義と所有Sceneを維持します。Scene切り替えの前にfinish／disposeします。未対応の切り替えはCoreのcommit前に拒否します。Engine破棄は記録・再生も解放します。

再生中は記録フレームが入力を専有し、キーボードや非中立のActionSource書き込みを受け付けません。タッチUIやAI入力の生成は無効にしてください。Player破棄で全体クリアと入力の解放を行います。pauseは記録された境界ごとに適用・検証します。実時間の休止時間そのものは記録しません。

## 固定ステップ

Webでは`new Game({ fixedStep: { step: 1 / 120, maxSteps: 8, maxFrameDelta: 0.25 } })`で選択します。既定は従来の可変ステップです。CoreのEngine.step(dt)も維持します。

固定モードは時間を蓄積し、1描画あたり0回以上のstepを実行してから1回描画します。maxStepsで追いつき回数、maxFrameDeltaで受理する実時間を制限します。超過した整数stepを捨て、端数を保持します。CoreのFixedStepRunnerは同じ処理をヘッドレスでも使え、捨てた秒数・補間率を診断できます。描画補間自体は実装していません。

pause中はEngine.step(0)でActionを捕捉し、同じPause操作で再開できます。再開境界での0秒コールバックは既存Engine契約に従います。Scene・表示状態・Game.pause/resumeの変更で蓄積をリセットします。固定tick前に完了した短押しも失いません。

Web再生は初期Scene factory内で、ゲーム構築後に`game.playReplay(data, { scene, controllers })`を呼びます。RAFから記録されたdtを順に進め、通常の固定／可変モードとは分けて再生します。追いつき上限に達しても記録stepを飛ばさず、表示側が遅くなります。Scene移動・準備失敗・Game破棄でPlayerも解放します。

## 再現性が成立する条件

ゲームコード、設定、seed、初期化時の乱数消費、Action定義、step列、外部条件を揃えます。固定ステップだけでDate.now、ゲーム側Math.random、非同期完了順、通信、OS文字入力、GPU出力まで制御できるわけではありません。ゲーム結果に影響する外部値は、明示的な入力として扱う必要があります。補助観測イベントを保存しただけでは、その外部条件を再生したことにはなりません。

OS・ブラウザをまたぐビット単位の一致は保証しません。詳しい契約、データ上限、実測結果は[英語ガイド](../en/replay.html)と検証記録を参照してください。
