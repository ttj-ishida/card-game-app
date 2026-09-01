# M2-SB-01：`practice_round_results` DB 土台 設計書

- 文書ID：GAME-SPEC-M2-SB-01
- 版数：0.1
- 作成日：2026-09-01
- 基準文書：`独自カードゲーム_要件定義書_v0.2.md`（v0.3 本文）、`独自カードゲーム_M2_詳細TODO_v0.2.md` §M2-SB-01
- 対象 TODO：M2-SB-01（M2 サブプロジェクト3 のうち DB 部分のみ）
- 実装場所：`supabase/migrations/`、`supabase/tests/`

---

## 1. 目的とスコープ

CPU練習1局の結果（モード・人数・勝者・時間）を保存する Postgres テーブルと、その最小限のアクセス制御を作る。ローカル Supabase（Docker Postgres）でマイグレーションと pgTAP テストを自動検証する。

保存先は **Supabase の Postgres データベース**（`public` スキーマ）。既存のカードマスタ（`number_cards` 等）と同じ DB・同じアクセス流儀（PostgREST + anon キー、`apps/mobile/src/features/catalog/supabaseCatalogClient.ts` 参照）。端末ローカル保存ではない。

### スコープ外（このサブプロジェクトでは作らない）

| 項目 | 行き先 |
|---|---|
| 匿名プレイヤーID の生成・端末永続化 | M2-SB-02（サブプロジェクト2 に同梱：AsyncStorage が要り結果画面 EX-08 に統合するため） |
| 結果保存クライアント・オフライン再送キュー | M2-EX-09（同上。`client_result_id` unique が土台） |
| `players` / `player_mode_stats` テーブル、ルール版関連付け、公開対局イベント | M3-SB-01〜04 |
| 行レベルのプレイヤー隔離（RLS で自分の行だけ read/write） | 認証（ACCOUNT-*）導入時。M2 は認証前 |
| 統計集計クエリ・統計画面 | M3-SB-01 / M3-EX-05 |

## 2. Global Constraints

- マイグレーションは `supabase/migrations/` に追記のみ。既存マイグレーションは編集しない。ファイル名は `<UTC timestamp>_create_practice_round_results.sql`（既存の `YYYYMMDDHHMMSS_...` 形式、既存の最大値より後）。
- 秘匿情報をリポジトリに置かない（接続情報・キーはコミットしない）。
- `pgcrypto` extension は既存マイグレーション（`20260828130000_create_card_masters.sql`）で `extensions` スキーマに作成済み。`extensions.gen_random_uuid()` を使う。
- 既存マスタ表と同じアクセス流儀：`revoke all ... from public, anon, authenticated` → 必要な権限だけ `grant` → `enable row level security` → `create policy`。
- pgTAP テストは `supabase/tests/*.sql`、`npx supabase test db supabase/tests/<file>.sql` で実行（既存 `master_*.sql` と同形式：`begin; select plan(N); ... select * from finish(); rollback;`）。
- 表示名・日本語文言・resource key を保存しない（`mode` は内部コード `'CPU_PRACTICE'`）。
- 非公開手札・スキルを保存しない（このテーブルは集計値のみ。手札やカードIDは持たない）。

## 3. テーブル定義

```sql
create table public.practice_round_results (
  id                uuid primary key default extensions.gen_random_uuid(),
  client_result_id  uuid not null,
  anon_player_id    text not null,
  mode              text not null default 'CPU_PRACTICE',
  player_count      smallint not null,
  local_player_seat smallint not null,
  winner_seat       smallint not null,
  local_won         boolean not null,
  turn_count        integer not null,
  duration_ms       integer not null,
  round_seed        bigint,
  recorded_at       timestamptz not null default now(),

  constraint practice_round_results_client_result_id_key unique (client_result_id),
  constraint practice_round_results_mode_check
    check (mode in ('CPU_PRACTICE')),
  constraint practice_round_results_player_count_check
    check (player_count between 2 and 6),
  constraint practice_round_results_local_seat_check
    check (local_player_seat >= 0 and local_player_seat < player_count),
  constraint practice_round_results_winner_seat_check
    check (winner_seat >= 0 and winner_seat < player_count),
  constraint practice_round_results_local_won_check
    check (local_won = (winner_seat = local_player_seat)),
  constraint practice_round_results_turn_count_check
    check (turn_count >= 0),
  constraint practice_round_results_duration_ms_check
    check (duration_ms >= 0),
  constraint practice_round_results_anon_player_id_check
    check (anon_player_id <> '')
);

create index practice_round_results_anon_player_id_idx
  on public.practice_round_results (anon_player_id, recorded_at desc);

comment on table public.practice_round_results is
  'CPU練習1局の結果（集計値のみ）。手札・カードIDは保存しない。M2はゲスト運用のため行レベルのプレイヤー隔離なし。';
comment on column public.practice_round_results.client_result_id is
  'クライアント生成の冪等キー。オフライン再送で二重登録を防ぐ（M2-EX-09）。';
comment on column public.practice_round_results.anon_player_id is
  '端末生成の匿名プレイヤーID（M2-SB-02）。M3で players テーブルへ移行予定。';
comment on column public.practice_round_results.round_seed is
  'playRound の seed。局面の完全再現用。M2では nullable。';
```

### 列の根拠

| 列 | 完了条件との対応 | 備考 |
|---|---|---|
| `mode` | 「モード」 | v1.0 は `'CPU_PRACTICE'` のみ。CHECK で固定、将来の値追加で緩める |
| `player_count` | 「人数」 | 2〜6（§4.3） |
| `winner_seat` + `local_won` | 「勝者」 | `winner_seat` = 勝った席の index、`local_won` = ローカルプレイヤーが勝ったか。CHECK で両者の整合を強制。M3-EX-05 の勝率は `local_won` の集計で出せる |
| `local_player_seat` | 「勝者」の判定材料 | ローカルプレイヤーの席 index |
| `duration_ms` | 「時間」 | 対局の実時間（配布〜勝者決定）。クライアント計測。ミリ秒 |
| `turn_count` | 補助 | `RoundResult.turns.length`。分布分析・異常検知用 |
| `round_seed` | 補助（再現） | nullable |
| `client_result_id` | 受入「再送で重複更新なし」 | unique。2件目の insert は 23505 で失敗 → クライアントは「保存済み」とみなす（M2-EX-09） |
| `recorded_at` | 「時間」の記録時刻 | サーバ時刻 |

## 4. アクセス制御

```sql
alter table public.practice_round_results enable row level security;

revoke all on table public.practice_round_results from public, anon, authenticated;

grant select, insert on table public.practice_round_results to anon, authenticated;
grant all on table public.practice_round_results to service_role;

create policy practice_round_results_insert_client
  on public.practice_round_results
  for insert
  to anon, authenticated
  with check (true);

create policy practice_round_results_select_client
  on public.practice_round_results
  for select
  to anon, authenticated
  using (true);
```

- **`update` / `delete` の policy を作らない** → anon/authenticated は更新・削除不可（RLS がデフォルト拒否）。加えて `grant` にも含めない（二重の防御）。
- `with check (true)` / `using (true)`：M2 は認証前でゲスト運用のため、行を送信元プレイヤーに縛れない（`auth.uid()` が無い）。**これは M2 の意図的な割り切り**。認証（ACCOUNT-001〜005）導入時に `anon_player_id` を `players` へ移し、`using (player_id = auth.uid())` 相当へ狭める。テーブルコメントに明記。
- `service_role`：バックエンド処理・移行用に全権。

## 5. pgTAP テスト

### 5.1 `supabase/tests/practice_round_results_schema.sql`

`begin; select plan(N); ...; select * from finish(); rollback;` 形式。検証項目：

- テーブル `public.practice_round_results` が存在する（`has_table`）。
- 列と型：`id uuid` PK、`client_result_id uuid` NOT NULL、`anon_player_id text` NOT NULL、`mode text` NOT NULL、`player_count smallint` NOT NULL、`local_player_seat smallint`、`winner_seat smallint`、`local_won boolean` NOT NULL、`turn_count integer`、`duration_ms integer`、`round_seed bigint`（NULL 許容）、`recorded_at timestamptz` NOT NULL（`has_column` / `col_type_is` / `col_not_null` / `col_is_null`）。
- `client_result_id` に unique 制約（`col_is_unique` または `has_index`）。
- `mode` の既定値が `'CPU_PRACTICE'`、`recorded_at` の既定値が `now()`（`col_default_is`）。
- CHECK 制約が効く（`lives_ok` / `throws_ok`）：
  - `player_count` 1 や 7 → 失敗、2〜6 → 成功。
  - `local_won` と `winner_seat = local_player_seat` の不一致 → 失敗。
  - `turn_count` 負 / `duration_ms` 負 → 失敗。
  - `anon_player_id = ''` → 失敗。
- 索引 `practice_round_results_anon_player_id_idx` が存在する（`has_index`）。
- RLS が有効（`is_rls_enabled` 相当。pgTAP に無ければ `pg_class.relrowsecurity` を直接 assert）。

### 5.2 `supabase/tests/practice_round_results_access.sql`

`set local role` を使って役割ごとの権限を検証（既存 `master_access.sql` と同形式）：

- `anon` で正常行を1件 `insert` できる（`lives_ok`）。
- `anon` で `select` できる（`lives_ok`、件数 1 以上）。
- `anon` で `update` すると失敗する（`throws_ok`、権限エラー）。
- `anon` で `delete` すると失敗する（`throws_ok`）。
- 同じ `client_result_id` で2回 `insert` すると2件目が失敗する（`throws_ok`、unique violation `23505`）。
- `service_role` は `insert` / `select` / `update` / `delete` すべてできる（`lives_ok`）。
- （RLS の `with check`）`anon` の insert が policy に阻まれない（M2 は `true` なので通る）ことを確認 = 上の insert 成功で兼ねる。

テスト内の固定データは有効な行（`player_count=3, local_player_seat=0, winner_seat=0, local_won=true, turn_count=20, duration_ms=30000, anon_player_id='test-device-1', client_result_id=gen_random_uuid()`）を用いる。

## 6. 受入確認（TODO 文書との対応）

| M2-SB-01 完了条件 | 充足 |
|---|---|
| モード、人数、勝者、時間を保存できる | `mode` / `player_count` / `winner_seat`+`local_won` / `duration_ms`+`recorded_at` 列 + schema テスト |
| 成果物がリポジトリから追跡できる | マイグレーション + pgTAP がコミットされる |
| 関連テストが成功し、重大度「高」の既知不具合が0件 | `npx supabase test db` 2本 PASS |
| エラー時に部分更新・二重消費・情報漏洩・操作不能を残さない | 単一行 insert（部分更新なし）、`client_result_id` unique（二重登録なし）、集計値のみ（手札漏洩なし）、anon は update/delete 不可 |

| 確認方法 | 手段 |
|---|---|
| 空の検証環境へマイグレーション適用、正常系と権限外アクセスを自動実行 | `npm run db:reset` → `npx supabase test db supabase/tests/practice_round_results_*.sql` |
| 同じ要求の再送・競合で重複更新や部分更新がないこと | access テストの「同一 `client_result_id` 2回 insert → 2件目失敗」 |

## 7. 確認手順

- `npm run db:reset`（全マイグレーション + seed 再適用、新規テーブル作成成功）
- `npx supabase test db supabase/tests/practice_round_results_schema.sql`（PASS）
- `npx supabase test db supabase/tests/practice_round_results_access.sql`（PASS）
- 既存 DB テスト（`master_*.sql` / `ruleset_version.sql`）に回帰がないこと
- `git diff --check`
- 進捗記録：`docs/progress/M2-SB-01.md`（日本語、既存 `docs/progress/M1-SB-02.md` の書式）

## 8. 将来への申し送り

- **M2-SB-02**（サブプロジェクト2）：`anon_player_id` を生成・端末永続化するクライアントモジュール。AsyncStorage（ネイティブ依存、dev client 再ビルドが要る）。
- **M2-EX-09**（サブプロジェクト2）：結果保存クライアント。POST 失敗時は AsyncStorage キューに退避、`client_result_id` で冪等、次回起動/次局後にフラッシュ。unique violation は「保存済み」= 成功扱い。
- **M3-SB-01/02**：`players` テーブル導入時に `anon_player_id` を FK 化 or 移行。二重登録防止キーの恒久化（`client_result_id` はその布石）。
- **認証導入時**：RLS policy を `using (true)` から自分の行だけに狭める。
