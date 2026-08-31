# M1-QA-03 ルール検証チェックリスト

- TODO: M1-QA-03
- 版数: 1.0
- 日付: 2026-08-29
- 基準文書: `独自カードゲーム_要件定義書_v0.2.md`（§8〜§14、§31.2）
- 対象: `packages/game-core` のローカル・ルールサンドボックス

## 使い方

1. 一括自動検証: リポジトリルートで `npm run game-core:test` と `npm run game-core:typecheck` を実行する。全件 PASS かつ typecheck 通過を合格条件とする。
2. 個別確認: 下表の「自動テスト」列のテスト名で該当ケースを特定する（`node --test` の出力に一致）。
3. 人手再現: 「代表ケース」列の場・手札・効果を初期状態として組み、記載のプレイを 1 手入力し、「期待結果」列と一致することを確認する。M1-EX-10 のサンドボックス画面完成後は同じ表を画面操作で再現する。

## A. 組み合わせ解析（§9.1、COMBO-001〜007）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| A-1 | 単体・同数セットの識別 | COMBO-001 | `6` / `7・7・7` | `SINGLE` / `RANK_SET` | `parseNumberCombination recognizes single and rank sets` |
| A-2 | 連番の識別と不正拒否 | COMBO-002/003/004 | `234` / `89 1` / `223344` | `SEQUENCE` / `null` / `null` | `parseNumberCombination recognizes sequences and rejects invalid sets` |
| A-3 | 同数セット上限4枚 | COMBO-006 | `5・5・5・5・5` | `null` | 同上 |

## B. 昼夜の強弱（§9.2、STRENGTH-001〜004）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| B-1 | 昼夜で強弱反転 | STRENGTH-001/002 | `rankStrength(9,DAY)` vs `rankStrength(1,DAY)` ほか | 昼は大きい数字、夜は小さい数字が強い | `rankStrength reverses between day and night` |
| B-2 | 同型比較 | STRENGTH-001/002 | 昼 `66`→`77`、夜 `66`→`55` | いずれも更新が強いと判定 | `compareCombinations compares same-shaped combinations by current day/night` / `T-RULE-001` / `T-RULE-002` |

## C. 追加と更新（§8.3、§9.3、§9.4）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| C-1 | 単体へ同数追加 | SINGLE-001 / RANKSET-001 | 昼 単体`6` に `6・6` | 場は `666`（EXTEND） | `T-RULE-022` |
| C-2 | 単体をより強い単体へ更新 | SINGLE-002 | 昼 単体`6` に `7` | REPLACE で合法 | `T-RULE-021` |
| C-3 | 枚数不一致の更新拒否 | RANKSET-003 | 昼 `66` に `777` | `SHAPE_MISMATCH` | `T-RULE-003` |
| C-4 | 連番の拡張方向 | SEQ-004/005 | 昼 `234`+`56` / 夜 `567`+`34` | `23456` / `34567` | `T-RULE-004` / `T-RULE-005` / `evaluateNumberPlay handles sequence extension direction and same-length replacement` |
| C-5 | 更新時に旧セットを捨て札へ | FIELD-002 | 場 `6(水)` を `8` で更新 | 捨て札に `6(水)` | `resolvePlay moves the replaced set to the discard pile` |
| C-6 | 追加は旧カードを場に残す | FIELD-001 | 場 `6` に `6・6` 追加 | 場は3枚、捨て札は増えない | `T-RULE-022` |

## D. 場のロック（枚数 / 属性固定 / 属性統一）（§8.3、§9.3、§9.4、§10.1、spec §2）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| D-1 | 同属性連番リードで属性統一ロック発生 | LOCK-001 | リード `炎3炎4炎5` | `lock.suitUniform = true` | `T-RULE-008` / `LEAD of a uniform-suit sequence sets suitUniform` |
| D-2 | 混色連番・同数セットのリードは統一ロックなし | LOCK-001 | `炎3水4風5` / `炎6水6` をリード | `lock.suitUniform = false` | `LEAD of a mixed sequence or a rank set does not set suitUniform` |
| D-3 | 統一ロック中の異属性追加を拒否 | LOCK-003 | 場 `炎3炎4炎5`（統一）に `水6` を追加 | `SUIT_UNIFORM_REQUIRED` | `evaluateNumberPlay enforces suit-uniform on both extension and replace` |
| D-4 | 統一ロック中の更新は別属性の統一連番なら可 | LOCK-001/004 | 場 `炎3炎4炎5`（統一）に `水4水5水6` で更新 | REPLACE で合法（属性変更可） | `T-RULE-025` |
| D-5 | 初回更新で枚数ロック発生 | FIELD-006 | 場 `炎7水7` を `炎8水8` で更新 | `lock.countLocked = true` | `resolvePlay locks the count on the first replace and then rejects an add` / `first REPLACE always locks count; locks suitFixed only when suits match` |
| D-6 | 枚数ロック中は追加/拡張を拒否 | FIELD-006 / RANKSET-007 / SEQ-009 | `77`→`88` 更新後に `8` を追加 | `COUNT_LOCKED` | `T-RULE-023` / `evaluateNumberPlay rejects an extension while the field's count is locked` |
| D-7 | 初回更新の属性一致で属性固定ロック | RANKSET-008 / SEQ-010 | 場 `炎7水7` を `炎8水8` で更新 | `lock.suitFixed = {炎,水}` | `first REPLACE always locks count; locks suitFixed only when suits match` |
| D-8 | 属性固定ロックと不一致な更新を拒否 | RANKSET-008 / LOCK-006 | `{炎}` 固定の場 `炎8` を `水9` で更新 | `SUIT_FIXED_MISMATCH` | `T-RULE-024` / `evaluateNumberPlay rejects a replace whose suit multiset misses the fixed lock` |
| D-9 | 初回更新の属性不一致なら属性固定ロックなし | LOCK-006 | リード `炎5` → 更新 `水6` | `lock.suitFixed = null`（枚数ロックのみ） | `first REPLACE always locks count; locks suitFixed only when suits match` |
| D-10 | 属性固定ロックは初回更新でのみ判定 | LOCK-006 | 2回目以降の更新 | 初回の `suitFixed` を保持し再判定しない | `a later REPLACE keeps the suitFixed established by the first REPLACE` |
| D-11 | EXTEND は属性統一ロックのみ継承し枚数・属性固定は増やさない | LOCK-004 | 統一連番へ同属性追加 | `countLocked=false` / `suitFixed=null` / `suitUniform=true` を維持 | `EXTEND preserves suitUniform and never locks count or suitFixed` |
| D-12 | 場流しで3ロックすべて解除 | LOCK-005 | 全員パスで場流し | `activeField = null`（ロック消滅） | `T-RULE-020` / `resolvePlay clears the field once every responder passed and hands the lead to the last player` |
| D-13 | ルールセットトグルで各ロックを個別に無効化 | spec §4.2 | `RULESET_INITIAL` の各フラグを false | 対応するロックが導出・判定されない | `ruleset toggles gate each lock independently` |

## E. 追加封印（§10.2、SEAL-001〜008）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| E-1 | 封印中の同数字追加を拒否 | SEAL-003 | 封印中 `66` に `6` | `EXTENSION_SEALED` | `T-RULE-009` |
| E-2 | 封印中も同種同枚数の更新は可 | SEAL-005 | 封印中 `66` に `77` | REPLACE で合法 | `T-RULE-010` |
| E-3 | 数字反映後に封印有効化 | SEAL-002 | 数字＋追加封印を出す | プレイ成立後 `extensionSealed = true` | `resolvePlay applies extension seal after the number card lands` |
| E-4 | 場流しで封印解除 | SEAL-007 | 場流し | `extensionSealed = false` | `resolvePlay clears the field with a Joker then leads in the same play` |

## F. 革命・自然革命（§11、REV-001〜007、REVSKILL-001〜006）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| F-1 | 新4枚組で自然革命 | REV-001 | 場空に `6666` | 自然革命1回、昼夜反転 | `detectNaturalRevolution triggers ...` |
| F-2 | 3枚以下→4枚以上の追加で自然革命1回 | REV-002/005 | `234`+`56` | 自然革命1回 | `T-RULE-004` |
| F-3 | 既存4枚連番への追加は非革命 | REV-004 | `2345`+`6` | 自然革命なし | `T-RULE-006` |
| F-4 | 新4枚組での更新は再度革命 | REV-003 | `6666`→`7777` | 自然革命発生 | `T-RULE-007` |
| F-5 | 革命カードは事前反転 | REVSKILL-002/003 | 昼 `77` に 革命＋`66` | 夜へ反転後に合法 | `T-RULE-011` / `revolution skill flips day/night ...` |
| F-6 | 反転後に不正なら巻き戻し | REVSKILL-004 | 反転しても不正な革命プレイ | 拒否、昼夜も手札も不変 | `resolvePlay rejects a revolution skill play that is illegal after the flip and keeps state` |
| F-7 | 自然革命と革命カードの併用禁止 | REVSKILL-005 | `6666`＋革命カード | `NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL` | `T-RULE-012` |

## G. Joker（§12、JCLR-001〜009、JTR-001〜010）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| G-1 | 変化Jokerを組み合わせに含める | JTR-002/005 | `🔥3・🔥4`＋Joker `🔥5`宣言 | `🔥345` として成立 | `T-RULE-017` / `evaluateJokerTransformPlay lets two distinct Jokers complete a sequence and trigger lock plus natural revolution` |
| G-2 | 2枚Jokerは別宣言なら合法 | JTR-007/008 | Joker `🔥5` ＋ Joker `🔥6` | 連番成立 | `T-RULE-017` / `evaluateJokerTransformPlay lets two distinct Jokers ...` |
| G-3 | 実カード／別Jokerとの完全重複を拒否 | JTR-006 / DUP-002/003 | 実 `🔥5` ＋ Joker `🔥5`宣言 | `DUPLICATE_JOKER_DECLARATION` | `T-RULE-018` / `evaluateJokerTransformPlay rejects duplicate declared identity ...` |
| G-4 | 場流しJokerは場がある時だけ | JCLR-001/002 | 場空で場流しJoker | `NO_FIELD_TO_CLEAR` | `resolvePlay rejects a Joker clear when there is no field` |
| G-5 | 場流し後は同一手番でリード、パス不可 | JCLR-006/007 | Joker場流し→続けてリード | 1プレイで場流し＋新しい場、`fieldCleared = true` | `resolvePlay clears the field with a Joker then leads in the same play` |

## H. パス・場流し（§8.1、§8.2、TURN-002〜005、FLOW-001〜006）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| H-1 | 場が空でパス不可 | TURN-002 | 場空でパス | `FIELD_EMPTY` | `T-RULE-019` |
| H-2 | 応答者全員が連続パスで場流し | FLOW-001 | 3人、P3リード→P1,P2パス | 場流し、`activeField = null` | `T-RULE-020` |
| H-3 | 場流し後は最終出し手が先頭 | FLOW-002 | 同上 | `activePlayerId = P3` | `T-RULE-020` |
| H-4 | 場流し後も昼夜維持 | FLOW-005 / DAYNIGHT-001 | 夜で場流し | `dayNight` 変化なし | `resolvePlay clears the field once every responder passed ...` |
| H-5 | カードが出たらパス済みが復帰 | TURN-003/004 | P1パス後に他者がプレイ | P1 の `status` が `ACTIVE` へ戻る | `resolvePlay clears the field once every responder passed ...`（全員ACTIVE）|

## I. 上がり・禁止上がり（§14、WIN-001〜008、JTR-009/010）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| I-1 | 最後の数字カードで上がり | WIN-001/003 | 手札1枚を合法にプレイ | `winnerId` セット、`status = OUT` | `resolvePlay declares a winner when the last number card is played` |
| I-2 | 最後の数字＋追加封印で上がり | WIN-004 | 最後の1枚＋追加封印 | 勝利 | `T-RULE-015` |
| I-3 | 最後の数字＋革命カードで上がり | WIN-005 | 最後の2枚＋革命、反転後合法 | 勝利、`dayNight` 反転 | `T-RULE-016` |
| I-4 | 場流しJoker後に最後の数字で上がり | WIN-007 / JCLR-009 | Joker場流し→最後の1枚 | 勝利 | `T-RULE-013` |
| I-5 | 最後の数字＋変化Jokerの上がりを禁止 | WIN-008 / JTR-009/010 | 手札最後の1枚＋Joker宣言 | `TRANSFORM_JOKER_GO_OUT`、カード未消費 | `T-RULE-014` / `resolvePlay forbids going out with a transform Joker ...` |
| I-6 | 勝者確定後は以後のプレイを拒否 | WIN-102 | 勝者確定済み状態でプレイ | `ROUND_FINISHED` | `resolvePlay rejects any play once the round already has a winner` |

## J. 状態の原子性・不変条件（§13.2、§13.4、TX-001/002）

| # | 確認項目 | 要件ID | 代表ケース | 期待結果 | 自動テスト |
|---|---|---|---|---|---|
| J-1 | 不正プレイで状態がバイト単位で不変 | TX-002 / §13.4 | 手札にないカードを指定 | `ok:false`、入力と同一参照・同一内容 | `resolvePlay leaves the input state untouched when the play is illegal` |
| J-2 | 成功プレイでも入力を破壊しない | TX-001 | 合法プレイ | 入力不変、新しい状態オブジェクト | `resolvePlay does not mutate the input on a successful play and is repeatable` |
| J-3 | 同一要求の再適用が冪等 | TX-003 | 同じ `state` に同じ `play` を2回 | 2回の結果状態が一致 | 同上 |
| J-4 | 乱数プレイ列でカード保存・二重消費なし | §13.4 | 25シード×60手のランダム走査 | 全手で不変条件成立 | `state invariants hold across a random play walk (seed N)` |
| J-5 | 走査の再現性 | §31.2 確認方法 | 同一シードで2回走査 | トレース完全一致 | `a random walk is fully reproducible from its seed` |

## 実行レポート（2026-09-01 時点）

| コマンド | 結果 |
|---|---|
| `npm run game-core:test` | PASS（105件） |
| `npm run game-core:typecheck` | PASS |

## 不具合・回帰登録

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | 既知の高重大度不具合はない。 |
| 中 | 0 | — |
| 低 | 0 | — |

- 回帰テストは `packages/game-core/src/*.test.ts` に常設。CI 相当の実行は `npm run game-core:test` + `:typecheck`。
- 本チェックリストの各行は自動テスト名に紐付き、テスト追加・改名時は本表も更新する。
- 棄権・通信切断・対局履歴（§18〜§19、VIS-005）は M1 のローカル・ルールサンドボックス範囲外。M2 以降で本チェックリストを拡張する。
