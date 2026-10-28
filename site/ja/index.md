<p class="eyebrow">Code-first · TypeScript · 2D</p>

# ゲームのしくみを、<br>理解できるコードで。

Simpludifyは、TypeScriptを中心に2Dゲームをつくる実験的なゲームエンジンです。ActorとComponentを組み合わせ、必要なときにイベントを使い、通常のコードとブラウザの道具で開発できます。

<div class="actions"><a class="primary" href="getting-started.html">最初のゲームをつくる →</a><a href="examples.html">ブラウザで試す</a></div>

> 現在はソースを取得して使う段階です。公開npmパッケージはありません。APIは変更される可能性があります。Windows版やネットワーク機能は未実装です。

<div class="feature-grid">
<section class="feature"><h2>組み合わせてつくる</h2><p>Characterの既定値から始め、Transform・Renderable・Motionや独自Componentへ段階的に進めます。イベント駆動は必須ではありません。</p></section>
<section class="feature"><h2>見える部分と、動く部分を分ける</h2><p>DOM非依存のCoreでシミュレーションを実行。Webが描画・入力・非同期準備・DOM UIを担当します。</p></section>
<section class="feature"><h2>接触をゲームのルールへ</h2><p>円と回転矩形、TriggerとSolid、接触通知と問い合わせ。軽量な位置補正を必要なSceneだけに追加できます。</p></section>
<section class="feature"><h2>静的ファイルで配信する</h2><p>シングルプレイのサンプルはゲームサーバーなしで動作します。サブパス配信と独自ドメイン用のビルドに対応します。</p></section>
</div>

## 小さく始める

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";

const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
```

ゲーム領域へフォーカスしてWASDで移動します。ページには高さが必要です。実行可能なHTMLとセットアップは[導入](getting-started.md)を参照してください。

## 試してから、仕組みを読む

[サンプルギャラリー](examples.md)には7つの実行例があります。最小のCharacter、UI / Scenes、Beacon Field、30秒の収集ゲームSignal Run、落ち物パズルBlockfall、シューティングPrism Raid、画像アニメーションのSprite gardenから選べます。Signal Run・Blockfall・Prism Raidはスマートフォンのタッチ操作に対応します。

[基本概念](concepts.md) → [入力](input.md) → [SceneとUI](scenes-ui.md) → [衝突判定](collision.md)の順に読むと、サンプルを自分のゲームへ展開できます。

## 設計と検証を公開する

短さだけでAPIを選びません。所有権・更新順序・エラー時の状態を明確にし、ヘッドレステストとブラウザテストで検証します。AIによる生成・解析も、同じ型・コード・CLIを利用できます。ゲーム実行時にAIサービスは不要です。

[設計思想](architecture.md)、[現在の制約](limitations.md)、[英語の詳細API](../en/api.html)もあわせて確認してください。
