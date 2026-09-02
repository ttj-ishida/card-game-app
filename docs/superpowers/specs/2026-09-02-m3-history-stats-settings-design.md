# M3 サブプロジェクト4：履歴・統計・設定画面 設計書

- 文書ID：GAME-SPEC-M3-HISTORY-STATS-SETTINGS
- 版数：0.1
- 作成日：2026-09-02
- 基準文書：`docs/product/独自カードゲーム_要件定義書_v0.2.md`（本文 v0.4）、`docs/product/独自カードゲーム_M3_詳細TODO_v0.2.md` §M3-EX-04/05/08、`docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md`
- 対象 TODO：M3-EX-04、M3-EX-05、M3-EX-08
- 実装場所：`apps/mobile/src/features/cpu-game/`、`apps/mobile/src/state/`、`apps/mobile/src/app/`、`apps/mobile/src/i18n/translate.ts`

---

## 1. 目的とスコープ

M3 サブプロジェクト4では、M3-SB-01〜04で作った統計・公開イベント基盤をCPU戦アプリから使える状態にし、外部確認できる履歴画面・統計画面・設定画面を追加する。画面は Expo Router の既存画面と同じく薄く保ち、通信・整形・設定保存は `features/cpu-game` と `state` の純モジュールへ寄せる。

### 今回作るもの

| TODO     | 成果物                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| M3-EX-04 | 対局履歴画面、`round_events` 読み取りポート、公開イベント表示ViewModel、結果保存後の `round_events` POST 配線 |
| M3-EX-05 | CPU戦統計画面、`get_player_mode_stats` RPC 読み取りポート、統計表示ViewModel                                  |
| M3-EX-08 | 演出短縮・軽量設定の設定モデル、AsyncStorage保存、設定画面、CPU思考待ち時間への反映口                         |

### スコープ外

| 項目                                               | 理由                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| 実機目視確認の完了宣言                             | M3-QA-02/03でユーザー端末確認として扱う                                |
| グラフィック本番候補                               | M3-GR-01〜05の対象                                                     |
| 認証ユーザー単位の厳密な履歴隔離                   | ACCOUNT系マイルストーン前のため、M3-SBと同じ匿名IDベースに留める       |
| `practice_round_results.ruleset_id` の NOT NULL 化 | 保存配線が安定し、既存NULL行の扱いを決めてから別マイグレーションで行う |
| M6相当の重い演出制御                               | M3-EX-08は設定土台。粒子・フィルタ等の本実装はM6-EX-04                 |

---

## 2. 要件マッピング

| 要件ID / TODO            | 内容                                                     | 対応                                                                                |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| UI-BATTLE-012 / M3-EX-04 | 対局履歴を手番進行を妨げずに確認できる                   | ホームと結果画面から履歴画面へ遷移。最新の保存済み対局イベントを一覧表示する        |
| VIS-005 / VIS-104        | 場が流れた後も使用済みカード・公開済みスキルを確認できる | `round_events.events[]` の `cards`、`skill_effect`、`field_cleared` を表示する      |
| VIS-202                  | 履歴は公開情報のみ                                       | DBに保存済みの公開イベントだけを表示し、非公開手札・未使用スキルを取得しない        |
| STAT-001〜003 / M3-EX-05 | CPU戦の対局数・勝利数・勝率を表示                        | `get_player_mode_stats(anon_player_id, 'CPU_PRACTICE')` を読み、0行なら未プレイ表示 |
| STAT-005                 | 再集計に必要な対局結果を保持                             | `ruleset_id` 付きで結果保存し、`round_events` も同じ対局IDへ紐付ける                |
| M3-EX-08                 | 設定で演出時間と負荷を変更できる                         | `animationSpeed` と `lowMotion` を保存し、CPU思考待ち時間の倍率へ反映する           |
| UI-A11Y-001〜003         | 色だけに依存せず、文字拡大で主要操作が欠けない           | 画面はテキストラベル中心、横画面でスクロール可能、色以外に文言で状態を示す          |

---

## 3. アーキテクチャ

### 3.1 層分け

- `features/cpu-game/*`：通信ペイロード、レスポンス整形、履歴・統計・設定の純関数。`fetch`、`AsyncStorage`、`Date.now`、`Math.random` を直接 import しない。
- `state/*Store.ts`：Zustand vanilla store。DIされた `StoragePort` / `HttpPort` / Supabase URL / anon key を使う。
- `app/**`：Expo画面。表示とボタン操作だけを持ち、ビジネスロジックを置かない。
- `i18n/translate.ts`：画面文言のキーを追加。画面や状態へ日本語の直書きを保存しない。

### 3.2 保存配線

`cpuGameStore.finishRound()` は次の順序で保存する。

1. `describeRoundResult()` で結果Viewを作る。
2. `getAnonPlayerId()` で匿名IDを取得する。
3. `rulesetClient.fetchActiveRulesetId()` を呼び、取得できた場合だけ `buildPracticeResultPayload({ rulesetId })` へ渡す。取得失敗時は `ruleset_id: null` で結果保存を継続する。
4. `recordFinishedRoundWithEvents()` で `practice_round_results` を保存する。
5. 結果保存が `saved` または `duplicate` の場合、対局IDを解決できるときだけ `round_events` をPOSTする。対局IDが返らない旧経路では結果保存を優先し、イベント保存は失敗としてキューに積まない。

M3では `practice_round_results` の既存保存APIが `Prefer: return=minimal` でIDを返していないため、イベント保存を確実に行うには保存関数を拡張する。新しい保存関数は `Prefer: return=representation` と `select=id` を使い、成功時に `id` を得る。既存の `savePracticeResult()` は互換維持のため残す。

### 3.3 取得配線

履歴・統計画面は、匿名IDをキーに読み取る。

- 統計：RPC `/rest/v1/rpc/get_player_mode_stats` へ `{ p_anon_player_id, p_mode: 'CPU_PRACTICE' }` をPOSTする。
- 履歴：`practice_round_results` を `anon_player_id` + `mode` で最新順に取得し、`round_events` を `round_result_id` で結合的に追加取得する。PostgRESTの複雑な埋め込みに依存せず、M3では2リクエスト方式にする。

### 3.4 設定

`CpuGameSettings` は次の形にする。

```ts
export type AnimationSpeed = "FAST" | "NORMAL" | "SLOW";

export type CpuGameSettings = {
  animationSpeed: AnimationSpeed;
  lowMotion: boolean;
};
```

初期値は `{ animationSpeed: 'NORMAL', lowMotion: false }`。保存キーは `card-game-app:cpu-game-settings:v1`。壊れたJSONや未知値は初期値へ戻す。CPU思考待ち時間は `NORMAL = 1.0`、`FAST = 0.5`、`SLOW = 1.4` の倍率で `Math.round()` し、`lowMotion` は画面の将来演出抑制フラグとしてViewModelへ渡す。

---

## 4. UI設計

### 4.1 導線

- ホームに「履歴」「統計」「設定」を追加する。
- 結果画面に「履歴」「統計」への遷移を追加する。
- 画面は横画面を前提に、左右分割ではなくスクロール可能な単一カラムで実装する。小型横画面でも主要ボタンが欠けないことを優先する。

### 4.2 履歴画面

状態：初期、読込中、空、成功、通信失敗、再試行。

表示項目：

- 対局日時、人数、勝敗、ターン数、適用ルール版の有無。
- イベント一覧：手番番号、席名、PLAY/PASS、アクション種別、公開カード、使用スキル、場流し有無、昼夜。
- `cards` は `RANK_1`〜`RANK_9` と `SUIT_*` を言語キーへ変換して表示する。

### 4.3 統計画面

状態：初期、読込中、未プレイ、成功、通信失敗、再試行。

表示項目：

- CPU戦対局数。
- 勝利数。
- 勝率。DBの `win_rate` が `null` なら `0%` ではなく未プレイとして扱う。
- 最終対局日時。

### 4.4 設定画面

状態：初期、保存済み、保存失敗、壊れた保存値からの復旧。

操作：

- 演出速度：`FAST` / `NORMAL` / `SLOW` の3択。
- 軽量表示：ON/OFF。
- 設定は変更時に即保存する。保存失敗時は画面上に失敗状態を出すが、メモリ上の選択は維持する。

---

## 5. エラー処理

- 結果保存は既存通り、恒久的4xxは `failed`、一時失敗は `queued` とする。
- `round_events` 保存失敗は対局結果保存の成功を取り消さない。履歴のイベントが欠ける可能性はあるため、画面では「イベント未保存」として表示できる形にする。
- 統計・履歴の取得失敗は画面状態に閉じ込め、対局ストアや進行中の対局へ影響させない。
- 設定読み込み失敗・壊れたJSONは初期値で復旧する。保存失敗は再試行可能にする。

---

## 6. テスト方針

- `historyModel.test.ts`：DBレスポンスから履歴ViewModelへの整形、空、イベント欠落、公開カード・スキルの表示キー変換をテストする。
- `statsModel.test.ts`：RPC 0行、勝率あり、勝率null、日付文字列の整形をテストする。
- `cpuGameSettings.test.ts`：初期値、壊れたJSON復旧、速度倍率、保存失敗をテストする。
- `practiceResultSync.test.ts`：結果保存成功後の `round_events` POST、結果保存失敗時にイベントPOSTしない、duplicate時の扱いをテストする。
- `cpuGameStore.test.ts`：`finishRound()` が `ruleset_id` と公開イベント保存を呼ぶこと、設定の速度倍率が `advanceCpu()` に反映されることをテストする。
- 画面ファイルは既存制約によりユニットテスト対象外。`npm run mobile:typecheck`、`npm run mobile:lint`、`npm run mobile:export:android` でバンドル可能性を確認する。

---

## 7. 完了条件

- `M3-EX-04`：保存済み対局の公開イベントから、流れたカードと公開済みスキルを履歴画面で確認できる。
- `M3-EX-05`：CPU戦の対局数、勝利数、勝率を統計画面で確認できる。
- `M3-EX-08`：設定画面で演出速度と軽量表示を変更でき、CPU思考待ち時間へ速度設定が反映される。
- `cpuGameStore.finishRound()` が `ruleset_id` 付き結果保存と `round_events` 保存を行う。
- 秘密情報、非公開手札、未使用スキルをログ・DB・画面に出さない。
- `npm run mobile:export:android` が成功する。

---

## 8. 実装順

1. `practiceResultSync` を拡張し、結果IDを返す保存関数と `round_events` POST関数を追加する。
2. `cpuGameStore.finishRound()` へ `ruleset_id` と `round_events` 保存を配線する。
3. 設定モデルと設定storeを追加し、CPU思考待ち時間へ倍率を反映する。
4. 履歴取得・履歴ViewModelを追加する。
5. 統計取得・統計ViewModelを追加する。
6. ホーム、結果、履歴、統計、設定画面を追加する。
7. `docs/progress/M3-EX-04.md`、`M3-EX-05.md`、`M3-EX-08.md` を追加する。
8. テスト・型チェック・lint・format・Android export・必要なDBテストを実行してから明示パスでcommit/pushする。
