# Collision search measurements and response probes

> Historical design review. The public Contact union proposal is superseded by the [implementation decision](../collision-implementation.md): Actor Contact stays unchanged; dedicated TileContact events share the same internal World/solver. Recorded measurements and counterexamples remain historical evidence, not current Solver throughput.

Status: isolated design evidence, not production Tilemap collision throughput. Full raw data is [results.json](../../benchmarks/collision-design/results.json), with the twelve linked `samples/` files. Measured source: `1d1d0c018a7fea44d1b24dc7e538f55ecf088b66`, clean worktree at start. No other local test/build ran during measurement.

## Reproduction and scope

```sh
npm ci
# Commit and push changes first; the harness rejects a dirty worktree.
node scripts/benchmark-collision-design.mjs
```

Linux / Node v24.22.1 / AMD EPYC 9V74 80-Core Processor, shared host, 2026-10-29. Vite loads the isolated TypeScript probes, not a browser. 12 workloads × static/eight edits per pass × three strategies × three repetitions = **216 runs**. Ten warmups, twenty measured passes each. Strategy timing order rotates by repetition. Identical deterministic poses, boolean maps and edits are used for every strategy. Hit counts/checksums assert equality every pass; unit tests compare exact cell sets and duplicate exclusion across dense, sparse, stripe, boundary and edited cases.

Maps are 32², 100², 256². Uniform maps are entirely Solid; scattered maps use a coordinate hash modulo eight (exactly 8192 occupied cells in the 256² workload). Actor footprint sides are 1, 8 or 16 cells; populations are 1, 32 or 256. The harness also measures current production Actor sweep distributions separately. Camera, Viewport, rendered tiles and image loads are absent and cannot reduce collision work.

A = direct integer footprint lookup. B = greedy whole-map horizontal-run/vertical-span rectangle merging **with 16-cell spatial buckets**. C = merging only within 16×16 chunks, indexed by those chunks. B is not penalized by an artificial global linear rectangle scan; both merged paths use local buckets and deduplicate rectangle IDs per query. Their rectangle count is not an optimal cover.

All three enumerate the same semantic cell IDs after search: a dense merged rectangle does not erase per-cell event bookkeeping. This comparison measures search + semantic enumeration, **not** circle/OBB narrow-phase savings. B/C cannot be judged by rectangle count alone. Empty cells are not enumerated by B/C, whereas A visits its whole local window. Rectangle tests in B/C are AABB range intersections, not production narrowTests.

Timing separates index construction, eight edit writes/index commit, and all Actor queries/cell enumeration. Input Grid allocation is outside construction timing. No production filtering, manifold calculation, iterative response, contact table, event delivery, browser, GPU or GC/native memory cost is included in the candidate benchmark. Per-pass allocations and counter accumulation are included. Millisecond values are CPU observations, not FPS. The lower-cost rows are sensitive to JIT/order/timer noise; a single small winning row is not evidence of a universal speedup.

Tables below use the median of three run p50 values (ordinary median of twenty raw samples per run); p95 is nearest rank within a run and remains in JSON. Counts are deterministic, while dynamic counts can alternate after edits. Full run tables and limits follow in the final report.

## Response findings

The naive cell response probe uses the **real** `contactManifold` and `correctPositions` with plain shape/position data: no fake tile Actor or Collider instance. A single circle/static cell separates correctly to (-10,16). A continuous vertical tiled wall at x=64 is pressed by an initially tangent radius-10 circle: 60 steps of intended (2,2), six iterations each. Expected tangent y=136; observed y=139.43444369830038, drift **+3.4344436983003845**. No residual penetration is necessary for this error: a neighbor's internal corner can distort the normal. A 20×20 box under the same probe has zero tangent drift. A radius-10 circle embedded at (96,96) in a 6² solid map finishes at (86,106), with one unresolved cell after six iterations.

These are deficiencies of naive future cell response, **not** regressions in current Actor response and not fixed in this design branch. Initial candidate lookup A is recommended, but response must reject internal seam features using eligible neighbor topology, with an explicit acceptance gate. Raising the iteration budget alone is not a seam solution. Deep embedded starts/teleports require diagnostics and documented limits; no unconditional escape guarantee is proposed.

## 実測の代表値

すべて1パス全Actor分のms。値は3反復のp50の中央値で、異なる実行環境への保証ではない。動的条件では8セル/パスを反転する。下表の「更新」は書き込みとindex再構築、「検索」は候補探索とセルID列挙を含む。

| 256² 条件                               | 方式    | 更新ms | 検索ms | 初期構築ms |
| --------------------------------------- | ------- | -----: | -----: | ---------: |
| uniform / 32体 / 1² footprint / 動的    | direct  | 0.0004 | 0.0043 |     0.0023 |
| uniform / 32体 / 1² footprint / 動的    | merged  | 0.2303 | 0.0074 |     0.1658 |
| uniform / 32体 / 1² footprint / 動的    | chunked | 0.0021 | 0.0068 |     0.6660 |
| scattered / 256体 / 1² footprint / 動的 | direct  | 0.0004 | 0.0330 |     0.0032 |
| scattered / 256体 / 1² footprint / 動的 | merged  | 1.7893 | 0.6427 |     1.8857 |
| scattered / 256体 / 1² footprint / 動的 | chunked | 0.0048 | 0.4210 |     1.0800 |
| uniform / 32体 / 16² footprint / 静的   | direct  | 0.0001 | 0.0450 |     0.0022 |
| uniform / 32体 / 16² footprint / 静的   | merged  | 0.0001 | 0.0468 |     0.4135 |
| uniform / 32体 / 16² footprint / 静的   | chunked | 0.0001 | 0.0517 |     0.4466 |
| scattered / 32体 / 16² footprint / 静的 | direct  | 0.0001 | 0.0345 |     0.0035 |
| scattered / 32体 / 16² footprint / 静的 | merged  | 0.0001 | 0.1638 |     1.9092 |
| scattered / 32体 / 16² footprint / 静的 | chunked | 0.0001 | 0.1294 |     1.2738 |

32体・1セルfootprintのdirectは、mapが32²/100²/256²でも**32セル/パス**を読む。256体なら256セル。32体・16² footprintでは8192セル。この計数は描画対象数と無関係で、画面外Actorでも同じ。空のマップでもdirectの局所窓読み取りは残るが、Solidセル総数には比例しない。

256²・uniformの初期矩形数はB=1、C=256、scatteredでは双方8192。1矩形で表現できてもセルイベントを必要とする8192セルの接触列挙が消えるわけではない。dynamicの最初の記録パスでBは65536セルを再構築、Cは今回の編集が1チャンク内なので256セル、Aは0セルを再構築。8セルが別々のチャンクに分散する場合はCの再構築が増える。その条件は今回未測定で、Cが常に256セルという保証ではない。

小さいuniformの単発タイミングではCがAより短い行もあり、JIT・共有ホスト・counter集計の影響を無視できない。採用理由は小さいmsの順位だけでなく、直接検索が局所footprintに限定され、index保持/再構築が不要で、動的編集に強いこと。B/Cによる**実際の狭義判定や応答の削減**はこの検索ベンチからは実証されていない。

## 現行Actor X sweepの実測

Triggerの32×32 boxを1000体、3ウォームアップ＋10記録。初回登録・pair生成は時間外、定常Engine.step(0)を測る。イベント購読なし、表示なし。表は1実行の普通の中央値で、上の3反復比較とは別の証拠。

| 分布       |  X候補 | 狭義判定 | 保持pair |  p50 ms |  p95 ms |
| ---------- | -----: | -------: | -------: | ------: | ------: |
| horizontal |      0 |        0 |        0 |   0.388 |   0.725 |
| vertical   | 499500 |        0 |        0 |  11.835 |  14.335 |
| coincident | 499500 |   499500 |   499500 | 273.866 | 369.518 |

縦一列はYで全棄却されるがX候補は499500。X sweepが一般的に線形になるという保証はない。coincidentは499500 pairを保持するため、索引だけでイベント状態の二次的コストは消せない。次段階は候補/接触/solverを別々に計数する。Actor側の空間索引変更は今回のTilemap接続へ抱き合わせず、実用分布が必要とする場合に別途評価する。

## 理論比較と採用判断

N=総セル、A=Actor数、M=配置数、q=Actorの局所候補セル数、H=実接触セル数、R=統合矩形数、E=索引内の矩形参照数、D=変更チャンク数、c=チャンク辺長。

| 方式               | 初期化・保持                                                 | 問い合わせ                                       | 変更                                                                   | 適性/注意                                                                                    |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A 直接             | 衝突用の全体形状index不要。既存Gridとpolicy/疎overrideを参照 | map境界O(A×M)＋Σq、狭義判定と反復/接触処理は別途 | 通常setはO(1)。画像fillは既存データ書き込みO(N)だが衝突index再構築不要 | 小/大map、普通サイズActor、頻繁な編集に単純。巨大footprintでは多くのセルを読む               |
| B 全体矩形＋bucket | 今回O(N)構築、O(R+E)保持                                     | 局所bucket参照＋重複除去＋矩形判定＋H列挙        | 今回はbatchごとO(N)。局所的な結合/分割indexなら複雑さが増す            | 均一な静的地形の狭義判定を減らす可能性。疎/不規則地形ではRが大きい。実Solverでの優位は未測定 |
| C チャンク内矩形   | O(N)構築、局所R/E保持                                        | 重なるチャンクと局所矩形＋H列挙                  | O(D×c²)の局所再構築。境界形状・重複管理あり                            | 大きな静的地形/頻繁だが局所的な編集への将来候補。チャンク境界の応答とセル識別を別途保証      |

**第1段階はA**。Solid/Trigger混在やセル上書きを直接評価でき、画像ID設定を変更しても全体再構築不要。内部面/頂点の判定のため必要な定数個の隣接セル参照は許す。最適化用矩形を接触対象にせず、実装を重くするチャンク/union索引を先行導入しない。

静的で均一な巨大領域、大きいActor、多数ActorではB/Cが狭義判定・応答を減らす仮説が残る。まず本番にcandidateCells/narrowTests/iterations/contactsの診断を実装し、費用を特定してから比較する。矩形統合を採用する場合もセル観測の費用と継ぎ目の品質を含めて測る。

## 全216実行の集約表

各行は3実行の中央値。s=Actor footprint辺長、edit=8は8セル/パス、0は静的。初期index構築はGrid生成を含まない。個別p95・保持数・再構築数・raw samplesはJSONのリンク参照。

| map  | 分布      | Actor |   s | edit | 方式    | build ms | edit p50 ms | query p50 ms |
| ---- | --------- | ----: | --: | ---: | ------- | -------: | ----------: | -----------: |
| 32²  | uniform   |    32 |   1 |    0 | direct  |   0.0008 |      0.0001 |       0.0091 |
| 32²  | uniform   |    32 |   1 |    0 | merged  |   0.0051 |      0.0001 |       0.0110 |
| 32²  | uniform   |    32 |   1 |    0 | chunked |   0.0081 |      0.0001 |       0.0113 |
| 32²  | uniform   |    32 |   1 |    8 | direct  |   0.0008 |      0.0008 |       0.0092 |
| 32²  | uniform   |    32 |   1 |    8 | merged  |   0.0082 |      0.0052 |       0.0127 |
| 32²  | uniform   |    32 |   1 |    8 | chunked |   0.0086 |      0.0025 |       0.0124 |
| 32²  | scattered |    32 |   1 |    0 | direct  |   0.0019 |      0.0001 |       0.0056 |
| 32²  | scattered |    32 |   1 |    0 | merged  |   0.0296 |      0.0002 |       0.0691 |
| 32²  | scattered |    32 |   1 |    0 | chunked |   0.0285 |      0.0002 |       0.0697 |
| 32²  | scattered |    32 |   1 |    8 | direct  |   0.0014 |      0.0005 |       0.0057 |
| 32²  | scattered |    32 |   1 |    8 | merged  |   0.0420 |      0.0175 |       0.0412 |
| 32²  | scattered |    32 |   1 |    8 | chunked |   0.0181 |      0.0035 |       0.0391 |
| 100² | uniform   |    32 |   1 |    0 | direct  |   0.0007 |      0.0002 |       0.0108 |
| 100² | uniform   |    32 |   1 |    0 | merged  |   0.0697 |      0.0002 |       0.0224 |
| 100² | uniform   |    32 |   1 |    0 | chunked |   0.1419 |      0.0001 |       0.0144 |
| 100² | uniform   |    32 |   1 |    8 | direct  |   0.0008 |      0.0010 |       0.0115 |
| 100² | uniform   |    32 |   1 |    8 | merged  |   0.0498 |      0.0499 |       0.0253 |
| 100² | uniform   |    32 |   1 |    8 | chunked |   0.1272 |      0.0040 |       0.0161 |
| 100² | scattered |    32 |   1 |    0 | direct  |   0.0016 |      0.0002 |       0.0115 |
| 100² | scattered |    32 |   1 |    0 | merged  |   0.4182 |      0.0002 |       0.0715 |
| 100² | scattered |    32 |   1 |    0 | chunked |   0.2264 |      0.0001 |       0.0553 |
| 100² | scattered |    32 |   1 |    8 | direct  |   0.0014 |      0.0008 |       0.0100 |
| 100² | scattered |    32 |   1 |    8 | merged  |   0.2642 |      0.2938 |       0.0757 |
| 100² | scattered |    32 |   1 |    8 | chunked |   0.2358 |      0.0074 |       0.0633 |
| 256² | uniform   |    32 |   1 |    0 | direct  |   0.0016 |      0.0001 |       0.0118 |
| 256² | uniform   |    32 |   1 |    0 | merged  |   0.2643 |      0.0002 |       0.0239 |
| 256² | uniform   |    32 |   1 |    0 | chunked |   0.7653 |      0.0001 |       0.0067 |
| 256² | uniform   |    32 |   1 |    8 | direct  |   0.0023 |      0.0004 |       0.0043 |
| 256² | uniform   |    32 |   1 |    8 | merged  |   0.1658 |      0.2303 |       0.0074 |
| 256² | uniform   |    32 |   1 |    8 | chunked |   0.6660 |      0.0021 |       0.0068 |
| 256² | scattered |    32 |   1 |    0 | direct  |   0.0037 |      0.0001 |       0.0043 |
| 256² | scattered |    32 |   1 |    0 | merged  |   1.6205 |      0.0001 |       0.0379 |
| 256² | scattered |    32 |   1 |    0 | chunked |   1.0852 |      0.0001 |       0.0347 |
| 256² | scattered |    32 |   1 |    8 | direct  |   0.0037 |      0.0004 |       0.0042 |
| 256² | scattered |    32 |   1 |    8 | merged  |   1.6868 |      1.8029 |       0.0637 |
| 256² | scattered |    32 |   1 |    8 | chunked |   1.2462 |      0.0035 |       0.0347 |
| 256² | uniform   |   256 |   1 |    0 | direct  |   0.0033 |      0.0001 |       0.0332 |
| 256² | uniform   |   256 |   1 |    0 | merged  |   0.2588 |      0.0001 |       0.0514 |
| 256² | uniform   |   256 |   1 |    0 | chunked |   0.5487 |      0.0001 |       0.0548 |
| 256² | uniform   |   256 |   1 |    8 | direct  |   0.0018 |      0.0004 |       0.0320 |
| 256² | uniform   |   256 |   1 |    8 | merged  |   0.2698 |      0.1683 |       0.0528 |
| 256² | uniform   |   256 |   1 |    8 | chunked |   0.6169 |      0.0022 |       0.0528 |
| 256² | uniform   |    32 |  16 |    0 | direct  |   0.0022 |      0.0001 |       0.0450 |
| 256² | uniform   |    32 |  16 |    0 | merged  |   0.4135 |      0.0001 |       0.0468 |
| 256² | uniform   |    32 |  16 |    0 | chunked |   0.4466 |      0.0001 |       0.0517 |
| 256² | uniform   |    32 |  16 |    8 | direct  |   0.0020 |      0.0004 |       0.0409 |
| 256² | uniform   |    32 |  16 |    8 | merged  |   0.2836 |      0.1830 |       0.0479 |
| 256² | uniform   |    32 |  16 |    8 | chunked |   0.5324 |      0.0022 |       0.0513 |
| 32²  | uniform   |     1 |   8 |    0 | direct  |   0.0004 |      0.0001 |       0.0005 |
| 32²  | uniform   |     1 |   8 |    0 | merged  |   0.0052 |      0.0001 |       0.0006 |
| 32²  | uniform   |     1 |   8 |    0 | chunked |   0.0080 |      0.0001 |       0.0007 |
| 32²  | uniform   |     1 |   8 |    8 | direct  |   0.0002 |      0.0004 |       0.0006 |
| 32²  | uniform   |     1 |   8 |    8 | merged  |   0.0046 |      0.0047 |       0.0008 |
| 32²  | uniform   |     1 |   8 |    8 | chunked |   0.0073 |      0.0021 |       0.0008 |
| 256² | scattered |   256 |   1 |    0 | direct  |   0.0050 |      0.0001 |       0.0329 |
| 256² | scattered |   256 |   1 |    0 | merged  |   1.7744 |      0.0001 |       0.4205 |
| 256² | scattered |   256 |   1 |    0 | chunked |   1.0411 |      0.0002 |       0.4463 |
| 256² | scattered |   256 |   1 |    8 | direct  |   0.0032 |      0.0004 |       0.0330 |
| 256² | scattered |   256 |   1 |    8 | merged  |   1.8857 |      1.7893 |       0.6427 |
| 256² | scattered |   256 |   1 |    8 | chunked |   1.0800 |      0.0048 |       0.4210 |
| 256² | scattered |    32 |  16 |    0 | direct  |   0.0035 |      0.0001 |       0.0345 |
| 256² | scattered |    32 |  16 |    0 | merged  |   1.9092 |      0.0001 |       0.1638 |
| 256² | scattered |    32 |  16 |    0 | chunked |   1.2738 |      0.0001 |       0.1294 |
| 256² | scattered |    32 |  16 |    8 | direct  |   0.0042 |      0.0004 |       0.0339 |
| 256² | scattered |    32 |  16 |    8 | merged  |   1.5056 |      1.7246 |       0.2647 |
| 256² | scattered |    32 |  16 |    8 | chunked |   0.8744 |      0.0044 |       0.1326 |
| 32²  | scattered |     1 |   8 |    0 | direct  |   0.0005 |      0.0001 |       0.0004 |
| 32²  | scattered |     1 |   8 |    0 | merged  |   0.0228 |      0.0001 |       0.0020 |
| 32²  | scattered |     1 |   8 |    0 | chunked |   0.0168 |      0.0001 |       0.0020 |
| 32²  | scattered |     1 |   8 |    8 | direct  |   0.0003 |      0.0004 |       0.0005 |
| 32²  | scattered |     1 |   8 |    8 | merged  |   0.0182 |      0.0162 |       0.0027 |
| 32²  | scattered |     1 |   8 |    8 | chunked |   0.0142 |      0.0033 |       0.0033 |
