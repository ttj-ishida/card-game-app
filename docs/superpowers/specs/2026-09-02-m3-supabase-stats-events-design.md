# M3 サブプロジェクト2：Supabase 統計・イベント基盤 設計書

- 文書ID：GAME-SPEC-M3-SB-STATS-EVENTS
- 版数：0.1
- 作成日：2026-09-02
- 基準文書：`独自カードゲーム_要件定義書_v0.2.md`（v0.4 本文）、`独自カードゲーム_M3_詳細TODO_v0.2.md` §M3-SB-01〜04
- 対象 TODO：M3-SB-01、M3-SB-02、M3-SB-03、M3-SB-04（M3 サブプロジェクト2 全体）
- 実装場所：`supabase/migrations/`、`supabase/tests/`、`apps/mobile/src/features/cpu-game/`

---

## 1. 目的とスコープ

`practice_round_results`（M2-SB-01）を核に、プレイヤー別統計・ルール版の関連付け・公開対局イベントの保存形式を Postgres へ追加する。実際のネットワーク配線（`cpuGameStore` から `players`/`round_events`/`ruleset_id` を送信する処理と、履歴・統計画面）は次のサブプロジェクト（M3-EX-04/05）へ送る。

### 今回作るもの

| TODO | 成果物 |
|---|---|
| M3-SB-01 | `players`、`player_mode_stats` テーブル、`get_player_mode_stats()` 関数、それらを維持するトリガ |
| M3-SB-02 | （新規スキーマなし）二重登録防止の性質を証明する pgTAP |
| M3-SB-03 | `practice_round_results.ruleset_id` 列、クライアント側の純整形関数 |
| M3-SB-04 | `round_events` テーブル、`turnDriver` への公開イベント逐次記録、クライアント側の純整形関数 |

### スコープ外（次サブプロジェクトへ）

| 項目 | 行き先 |
|---|---|
| `cpuGameStore` からの実際の POST 配線（`players` upsert 呼び出しは不要＝トリガが自動生成するが、`round_events` と `ruleset_id` 付き `practice_round_results` の送信） | M3-EX-04/05 のサブプロジェクト（履歴・統計画面と同時に配線） |
| 対局履歴画面（M3-EX-04）・CPU戦統計画面（M3-EX-05） | 同上 |
| 認証（`auth.uid()` によるプレイヤー隔離） | ACCOUNT-* マイルストーン |
| 棄権局の統計反映（STAT-004） | 対局途中離脱・CPU引き継ぎが未実装（M4 相当）のため対象外。§7 に明記 |

## 2. Global Constraints

- マイグレーションは `supabase/migrations/` に追記のみ。既存マイグレーションは編集しない。ファイル名は `<UTC timestamp>_<description>.sql`、既存の最大値より後。
- 秘匿情報をリポジトリに置かない。
- 既存マスタ表・`practice_round_results` と同じアクセス流儀：`revoke all ... from public, anon, authenticated` → 必要な権限だけ `grant` → `enable row level security` → `create policy`。`update`/`delete` の policy は作らない。
- pgTAP テストは `supabase/tests/*.sql`、`begin; select plan(N); ...; select * from finish(); rollback;` 形式。
- 表示名・日本語文言・resource key を保存しない。
- 非公開手札・未使用スキルを保存しない（`round_events` は行動時点で公開された情報のみ。VIS-202）。
- クライアント側の新規コードは既存パターンに従う：純ロジックは `fetch`/`AsyncStorage`/`Date.now`/`Math.random` を直接 import しない（DI ポート経由）。

## 3. 要件マッピング

| 要件ID | 内容 | この設計での対応 |
|---|---|---|
| STAT-001 | CPU戦等の対局数・勝利数・勝率をモード別に記録 | `player_mode_stats`（player_id, mode）で分離集計 |
| STAT-002 | 勝者へ対象モードの勝利数を1加算 | トリガが `local_won` を見て `rounds_won` を加算（ローカルプレイヤー視点。CPU側の勝利は今回集計対象外＝§7） |
| STAT-003 | 2位以下へ順位ポイントを付与しない | `player_mode_stats` は勝敗のみ保持、順位ポイント列を持たない |
| STAT-004 | 棄権局を対局数・敗北・勝率分母へ算入 | 対象外（§7 に理由を明記） |
| STAT-005 | 統計の再集計に必要な対局結果を保持 | `practice_round_results` は既存のまま保持され、`player_mode_stats` はそこから再構築可能 |
| VIS-005 / VIS-104 | 場が流れた後も使用済みカード・使用済みスキルを対局履歴から確認できる | `round_events` の各要素にカード・スキル効果を保持 |
| VIS-202 | 対局履歴は行動時点で公開された情報のみ | `round_events` は非公開手札・未使用スキルを含めない |
| DATA-M-006 | ルール版変更後も過去対局を当時の意味で再現 | `practice_round_results.ruleset_id` で適用ルール版を追跡（カードマスタは既に `ruleset_id` で版管理済み） |

## 4. テーブル設計

### 4.1 `players`

```sql
create table public.players (
  id             uuid primary key default extensions.gen_random_uuid(),
  anon_player_id text not null,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  constraint players_anon_player_id_key unique (anon_player_id),
  constraint players_anon_player_id_check check (anon_player_id <> '')
);
```

クライアントは直接 insert/update しない。存在は `practice_round_results` への insert 時にトリガが upsert する（§5）。

### 4.2 `player_mode_stats`

```sql
create table public.player_mode_stats (
  player_id       uuid not null references public.players(id) on delete cascade,
  mode            text not null,
  rounds_played   integer not null default 0,
  rounds_won      integer not null default 0,
  last_played_at  timestamptz,
  constraint player_mode_stats_pkey primary key (player_id, mode),
  constraint player_mode_stats_mode_check check (mode in ('CPU_PRACTICE')),
  constraint player_mode_stats_rounds_played_check check (rounds_played >= 0),
  constraint player_mode_stats_rounds_won_check
    check (rounds_won >= 0 and rounds_won <= rounds_played)
);
```

`win_rate` は保存せず読取時に計算する（`rounds_won::numeric / nullif(rounds_played, 0)`）。

### 4.3 `get_player_mode_stats` 関数

```sql
create or replace function public.get_player_mode_stats(
  p_anon_player_id text,
  p_mode text default 'CPU_PRACTICE'
)
returns table (
  rounds_played  integer,
  rounds_won     integer,
  win_rate       numeric,
  last_played_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.rounds_played,
    s.rounds_won,
    case when s.rounds_played > 0
      then round(s.rounds_won::numeric / s.rounds_played, 4)
      else null
    end as win_rate,
    s.last_played_at
  from public.player_mode_stats s
  join public.players p on p.id = s.player_id
  where p.anon_player_id = p_anon_player_id
    and s.mode = p_mode
$$;
```

`get_active_ruleset()`（M1-SB-01）と同じ流儀（`security invoker` + `select` 権限に依存）。該当行がなければ0行を返す（クライアントは「未プレイ」として扱う）。

### 4.4 `practice_round_results.ruleset_id`（M3-SB-03）

```sql
alter table public.practice_round_results
  add column ruleset_id uuid references public.rulesets(id) on delete restrict;

comment on column public.practice_round_results.ruleset_id is
  '対局時点の適用ルール版。nullable：クライアント配線（M3-EX-04/05 サブプロジェクト）完了までの既存クライアントは送らない。配線後は常に送信される想定。';
```

nullable のまま追加する（`round_seed` と同じ「nullable→将来必須化」方針）。次サブプロジェクトで送信配線が入るまで、既存の M2 由来クライアントの insert を壊さないため。

### 4.5 `round_events`（M3-SB-04）

```sql
create table public.round_events (
  id               uuid primary key default extensions.gen_random_uuid(),
  round_result_id  uuid not null references public.practice_round_results(id) on delete cascade,
  events           jsonb not null,
  created_at       timestamptz not null default now(),
  constraint round_events_round_result_id_key unique (round_result_id),
  constraint round_events_events_check check (jsonb_typeof(events) = 'array')
);
```

`round_result_id` への UNIQUE により、`round_events` 自体の再送も `practice_round_results` と同じ冪等性パターン（2回目の insert が 23505 で失敗 → クライアントは既存の `isDuplicate()` 判定で「保存済み」扱い）を得る。

`events` 配列の各要素（1手ぶん）：

```json
{
  "index": 0,
  "seat_id": "seat-0",
  "seat_kind": "HUMAN",
  "kind": "PLAY",
  "action_kind": "LEAD",
  "cards": [
    { "rank_code": "RANK_5", "suit_code": "SUIT_FIRE" }
  ],
  "skill_effect": null,
  "field_cleared": false,
  "day_night_after": "DAY",
  "hand_counts_after": { "seat-0": 7, "seat-1": 8 }
}
```

- `cards`：実カードのみ（`transformedFromSkillId === undefined`）。変化Jokerの場合は宣言された `rank_code`/`suit_code` も併せて記録する（プレイヤーが公開した内容そのもの）。
- `skill_effect`：`SkillEffectCode | null`。使用しなかったスキルは記録しない。
- `kind: "PASS"` のとき `cards` は空配列、`action_kind` は存在しない値を省略可。
- 既存 UI 用の匿名化された `TurnLogEntry`（カード内容を持たない）とは別構造。`round_events` は「行動時点で公開された情報」なので、場に出たカードとスキル効果はここでは秘匿しない（VIS-202 は非公開手札・未使用スキルの秘匿を求めているのであって、公開されたプレイ内容の秘匿は求めていない）。

## 5. トリガ（M3-SB-01 / M3-SB-02）

```sql
create or replace function public.record_practice_round_result_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  insert into public.players (anon_player_id)
  values (new.anon_player_id)
  on conflict (anon_player_id)
  do update set last_seen_at = new.recorded_at
  returning id into v_player_id;

  insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won, last_played_at)
  values (v_player_id, new.mode, 1, case when new.local_won then 1 else 0 end, new.recorded_at)
  on conflict (player_id, mode)
  do update set
    rounds_played  = public.player_mode_stats.rounds_played + 1,
    rounds_won     = public.player_mode_stats.rounds_won + case when new.local_won then 1 else 0 end,
    last_played_at = new.recorded_at;

  return new;
end;
$$;

create trigger practice_round_results_stats_trigger
  after insert on public.practice_round_results
  for each row
  execute function public.record_practice_round_result_stats();
```

- `security definer`（所有者権限で実行）にすることで、`anon` が `players`/`player_mode_stats` へ直接 `insert`/`update` の grant を持たなくても統計が更新できる。`set search_path = public` で search_path 汚染を防ぐ（既存 `get_active_ruleset()` と同じ防御）。
- トリガは **insert が成功した行に対してのみ** 発火する。`client_result_id` UNIQUE 違反で2回目の insert が失敗すればトリガは発火せず、統計は二重加算されない。これが M3-SB-02（二重登録防止キー）の実質的な実装であり、新規スキーマは不要。
- ここで加算されるのは `local_won`（ローカル＝送信元プレイヤー視点の勝敗）のみ。CPU 側の統計（`players` 行や `player_mode_stats`）は作らない。§7 に明記。

## 6. アクセス制御

```sql
-- players / player_mode_stats: 読み取りのみ。書き込みはトリガ（security definer）経由のみ。
alter table public.players enable row level security;
alter table public.player_mode_stats enable row level security;

revoke all on table public.players from public, anon, authenticated;
revoke all on table public.player_mode_stats from public, anon, authenticated;

grant select on table public.players to anon, authenticated;
grant select on table public.player_mode_stats to anon, authenticated;
grant all on table public.players to service_role;
grant all on table public.player_mode_stats to service_role;

create policy players_select_client
  on public.players for select to anon, authenticated using (true);

create policy player_mode_stats_select_client
  on public.player_mode_stats for select to anon, authenticated using (true);

-- round_events: practice_round_results と同じ流儀（M2 は認証前のためスコープを絞れない）。
alter table public.round_events enable row level security;

revoke all on table public.round_events from public, anon, authenticated;

grant select, insert on table public.round_events to anon, authenticated;
grant all on table public.round_events to service_role;

create policy round_events_insert_client
  on public.round_events for insert to anon, authenticated with check (true);

create policy round_events_select_client
  on public.round_events for select to anon, authenticated using (true);
```

`get_player_mode_stats()` の実行権限：

```sql
revoke all on function public.get_player_mode_stats(text, text) from public;
grant execute on function public.get_player_mode_stats(text, text) to anon, authenticated;
```

## 7. 意図的な割り切り（申し送り）

- **CPU の統計は集計しない**：`local_won` はローカル（人間）プレイヤー視点の勝敗であり、CPU 席の勝敗は `players`/`player_mode_stats` に記録されない。CPU に安定した `anon_player_id` を割り当てる設計が今のところ存在しないため。将来 CPU 統計が必要になれば別途 `players` へ CPU 用の予約IDを割り当てる設計が要る。
- **STAT-004（棄権局の統計算入）は対象外**：対局途中の人間離脱・CPU引き継ぎが未実装（現行 TODO 一覧では言及なし、想定は将来マイルストーン）。`practice_round_results` は完走した局のみを保存する契約（`describeRoundResult` が `winnerSeatId == null` で例外を投げる）ため、棄権局という概念自体が今回のクライアントに存在しない。棄権局の扱いが確定した時点で別途対応する。
- **`ruleset_id` は nullable**：本サブプロジェクトはクライアント配線をしないため、既存クライアントが送らない前提。次サブプロジェクトで送信配線が完了した後、NOT NULL 化を検討できる（別マイグレーション）。
- **`with check (true)` / `using (true)`**：`practice_round_results` と同じ M2/M3 の意図的な割り切り（認証前・ゲスト運用）。認証導入時に `player_id = auth.uid()` 相当へ狭める。

## 8. クライアント側の純整形関数（M3-SB-03 / M3-SB-04 分）

実装場所：`apps/mobile/src/features/cpu-game/`。ネットワーク配線・画面配線は行わない（§1 スコープ外）。

### 8.1 `resultModel.ts` の拡張（M3-SB-03）

- `PracticeResultPayload` に `ruleset_id: string | null` を追加。
- `buildPracticeResultPayload()` の呼び出し側が `rulesetId` を渡せるよう引数を拡張（省略時 `null`）。呼び出し元（`cpuGameStore` 等）が `get_active_ruleset()` の結果を渡す配線は次サブプロジェクトで行う。

### 8.2 `turnDriver.ts` の拡張（M3-SB-04）

- `DriverState` に `publicEvents: PublicRoundEvent[]` を追加。`TurnLogEntry` を追記している内部の共通記録ヘルパー（`humanPlay`/`cpuStep` の両方が通る箇所）で、同時に `PublicRoundEvent` も1件追記する。
- `PublicRoundEvent` の型は §4.5 の JSON 形状に対応する TypeScript 型として `turnDriver.ts`（または同ディレクトリの新規ファイル）に定義する。カード情報は `resolvePlay` 適用後の `RoundState.activeField.combination.cards`（実カードのみ、`transformedFromSkillId === undefined` でフィルタ）から取得する。スキル効果は `cpuPolicyStandard.ts` の `activeSkillEffect` と同等のロジックで `activeField.lock`/`combination` から導出する（既存ロジックの再利用を優先し、必要なら `game-core` 側から export を追加する）。
- `PASS` の場合は `cards: []`、`skill_effect: null`。

### 8.3 新規ファイル `roundEventsPayload.ts`（M3-SB-04）

```ts
export type RoundEventsPayload = {
  round_result_id: string;
  events: PublicRoundEvent[];
};

export function buildRoundEventsPayload(
  roundResultId: string,
  publicEvents: PublicRoundEvent[],
): RoundEventsPayload;
```

pure 関数。`round_result_id` は `practice_round_results` への insert 成功後にクライアントが持つ値（次サブプロジェクトで配線）。

## 9. pgTAP テスト計画

| ファイル | 検証内容 |
|---|---|
| `supabase/tests/players_and_stats_schema.sql` | `players`/`player_mode_stats` の列・型・制約・RLS 有効・関数 `get_player_mode_stats` の存在 |
| `supabase/tests/players_and_stats_access.sql` | `anon` は `select` のみ可、`insert`/`update`/`delete` は不可（`players`/`player_mode_stats` とも）。`service_role` は全操作可 |
| `supabase/tests/practice_round_results_stats_trigger.sql` | `practice_round_results` へ1件 insert →`players`+`player_mode_stats` が作られる／2件目（別 `client_result_id`、同 `anon_player_id`）で `rounds_played`/`rounds_won` が加算される／同一 `client_result_id` の再送（2回目 insert 失敗）で **加算されない**（M3-SB-02 の証明） |
| `supabase/tests/practice_round_results_ruleset_link.sql` | `ruleset_id` が nullable で insert 可、存在しない `ruleset_id` は FK 違反で失敗 |
| `supabase/tests/round_events_schema.sql` | 列・制約（`events` が jsonb array であること）・RLS 有効 |
| `supabase/tests/round_events_access.sql` | `anon` は `insert`/`select` 可、`update`/`delete` 不可。同一 `round_result_id` の2回目 insert は失敗（冪等性） |

モバイル側（`tsx --test`）：

- `resultModel.test.ts` に `ruleset_id` を含むペイロード組み立てのケースを追加。
- `turnDriver.test.ts`（既存があれば）に `publicEvents` の逐次記録（PLAY/PASS/スキル使用/場流し）のケースを追加。
- `roundEventsPayload.test.ts`（新規）：`buildRoundEventsPayload` の純関数テスト。

## 10. 確認手順

- `npm run db:reset`（全マイグレーション再適用）
- `npx supabase test db supabase/tests/players_and_stats_schema.sql`
- `npx supabase test db supabase/tests/players_and_stats_access.sql`
- `npx supabase test db supabase/tests/practice_round_results_stats_trigger.sql`
- `npx supabase test db supabase/tests/practice_round_results_ruleset_link.sql`
- `npx supabase test db supabase/tests/round_events_schema.sql`
- `npx supabase test db supabase/tests/round_events_access.sql`
- 既存 DB テスト（`master_*.sql`／`ruleset_version.sql`／`practice_round_results_*.sql`）に回帰がないこと
- `npm run mobile:test`（既存 + 新規）
- `git diff --check`
- 進捗記録：`docs/progress/M3-SB-01.md`〜`M3-SB-04.md`（各TODOごと、または統合1本。既存 `docs/progress/M2-SB-01.md` の書式）

## 11. 将来への申し送り

- CPU 席の統計収集が必要になった場合、CPU 用の予約 `anon_player_id`（またはモード拡張）を設計する。
- `ruleset_id` の NOT NULL 化は、次サブプロジェクトでクライアント送信配線が完了した後の別マイグレーションで行う。
- 棄権局（STAT-004）は、対局途中離脱・CPU引き継ぎの実装（将来マイルストーン）と合わせて `practice_round_results` のスキーマ拡張（例：`abandoned boolean`）を検討する。
- `player_mode_stats` の `win_rate` を毎回計算するのが重くなった場合、マテリアライズドビュー化や集計列の追加を検討する（現状の規模では不要）。
- 共有/ステージング環境へ出す前に、`round_events`/`practice_round_results` とも無制限・無スロットルの `INSERT` を anon が持つ点は M2-SB-01 と同じ注意事項として残る。
