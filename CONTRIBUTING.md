# Contribution Rules

本書は、個人開発でも変更履歴を再現可能にし、将来の共同開発で規則を変えずに済むための最低限の開発規約です。

## ブランチ方針

`main`を常に検証可能な統合ブランチとして扱い、`develop`や長期リリースブランチは作りません。

| 種別 | 形式 | 例 |
|---|---|---|
| 機能 | `feat/<todo-id-lower>-<summary>` | `feat/m1-ex-04-play-legality` |
| 修正 | `fix/<todo-id-lower>-<summary>` | `fix/m1-ex-07-joker-duplicate` |
| 文書 | `docs/<todo-id-lower>-<summary>` | `docs/m0-pm-02-environments` |
| 保守 | `chore/<todo-id-lower>-<summary>` | `chore/m0-ex-03-lint` |
| テスト | `test/<todo-id-lower>-<summary>` | `test/m1-qa-01-rule-cases` |

規則：

- 1ブランチは原則1 TODOとします。
- ブランチ名はASCII小文字、数字、ハイフンだけを使います。
- 2営業日を超える場合も、小さく統合可能な単位へ分割します。
- 緊急修正も`main`から`fix/`を作り、直接編集しません。
- 将来複数人になった場合は、`main`保護と1名以上のレビューを有効にします。

## コミット

Conventional Commitsを使用し、件名へTODO IDを入れます。

```text
feat(game-core): [M1-EX-04] support multi-card extension
fix(mobile): [M3-EX-01] block transform Joker finish
docs(repo): [M0-PM-01] define repository conventions
```

使用する種別は`feat`、`fix`、`docs`、`test`、`refactor`、`perf`、`chore`、`build`、`ci`です。件名は命令形の英語を基本とし、1コミットで説明できない変更は分割します。

## TypeScript命名

| 対象 | 規則 | 例 |
|---|---|---|
| ファイル・ディレクトリ | `kebab-case` | `play-legality.ts` |
| Reactコンポーネント | `PascalCase` | `BattleTable` |
| 型・interface・enum | `PascalCase` | `RoundState` |
| 関数・変数 | `camelCase` | `validatePlay` |
| boolean | `is`、`has`、`can`、`should` | `isSuitLocked` |
| 定数 | `SCREAMING_SNAKE_CASE` | `MAX_PLAYER_COUNT` |
| テスト | 対象名＋`.test.ts` | `play-legality.test.ts` |
| 言語リソースキー | `dot.case` | `battle.action.pass` |

表示文字列を条件分岐、ID、API値へ使用しません。カード、属性、スキル、昼夜は要件定義の固定内部コードを使用します。

## Supabase命名

| 対象 | 規則 | 例 |
|---|---|---|
| schema・table・column | `snake_case` | `round_public_state` |
| table | 複数形を基本 | `round_players` |
| 主キー | `id`または`<entity>_id` | `round_id` |
| 外部キー制約 | `<table>_<column>_fkey` | `round_players_round_id_fkey` |
| 一意制約 | `<table>_<columns>_key` | `terms_internal_code_key` |
| index | `idx_<table>_<columns>` | `idx_round_events_round_id_seq` |
| RLS policy | `<action>_<subject>_<condition>` | `select_owner_own_hand` |
| migration | UTC時刻＋説明 | `20260827090000_create_card_masters.sql` |
| Edge Function | `kebab-case` | `submit-play` |

DB構造を管理画面だけで変更しません。変更はマイグレーションとして記録し、空DBで再現できる状態にします。

## アセット命名

表示名ではなく安定内部コードからファイル名を作ります。

```text
<entity-id-lower>_<variant>_<size>.<ext>
```

例：

```text
rank_1_suit_fire_hand.webp
rank_1_suit_fire_detail.webp
skill_joker_hero_hand.webp
effect_revolution_light.webp
background_day_table.webp
```

- ランタイム画像は原則WebP、透過品質上必要な場合だけPNGとします。
- 同じ論理アセットの差替えでIDを変えず、manifestの版を更新します。
- 大容量のレイヤー付き制作元を通常Gitへ直接追加しません。`assets/source-manifests`へ所在、版、ハッシュ、権利情報を記録します。
- 一時書出し、生成途中、利用権が不明な素材はコミットしません。

## 環境変数

| 種別 | 形式 | 例 |
|---|---|---|
| クライアント公開値 | `EXPO_PUBLIC_<NAME>` | `EXPO_PUBLIC_APP_ENV` |
| サーバー秘密値 | `SCREAMING_SNAKE_CASE` | `SUPABASE_SERVICE_ROLE_KEY` |
| 環境名 | `local`、`development`、`staging`、`production` | `APP_ENV=staging` |

実値を含む`.env*`はコミットせず、必要なキーだけを`.env.example`へ記載します。

## 完了前チェック

- 対応するTODOと要件IDが分かる。
- 自動テストまたは再現可能な確認手順がある。
- マイグレーション、言語キー、アセットmanifestの必要な更新を含む。
- 秘密情報、個人情報、非公開手札情報を含まない。
- Android横画面と低性能設定への影響を確認した。
- `main`へ統合できる単位になっている。

