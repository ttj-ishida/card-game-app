# M4-ARC-02: ルールエンジンをExpoとサーバーから共有できるパッケージへ分離する

状態: 完了
日付: 2026-09-04

## 概要

既存の`@card-game-app/game-core`にサーバー向け公開入口を追加し、Supabase Edge Functionから同じTypeScriptルールをimportして実行できることを確認した。

M4-ARC-01の決定に従い、ルールの正本は`packages/game-core`に置く。クライアントとEdge Functionは、表示・通信・永続化を持たない純粋なルール入口を共有する。

## 実装

- `packages/game-core/src/server.ts`
  - Edge Functionから使うサーバー向けbarrel。
  - `core.ts`、`rng.ts`、`deal.ts`、`legalMoves.ts`を公開する。
  - CPU戦ポリシーやUI依存は含めない。
- `packages/game-core/src/server.test.ts`
  - サーバー向け入口から`resolvePlay`を呼び、同じ入力が決定的な対局結果を返すことを確認する。
- `packages/game-core/package.json`
  - `exports["./server"]`を追加し、サーバー向け入口を明示する。
- `supabase/functions/m4-rule-smoke/index.ts`
  - Edge Runtime上で`@card-game-app/game-core/server`をimportし、`resolvePlay`を実行するsmoke function。
- `supabase/functions/m4-rule-smoke/deno.json`
  - 関数単位のDeno import設定。
- `scripts/check-m4-edge-function-config.mjs`
  - Edge Functionのimport設定とsmoke functionの最低限の構造を検査する。
- `package.json`
  - `m4:edge-smoke:check`を追加する。

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run game-core:test` | RED: `server.ts`未作成で失敗 → GREEN: 211件成功 |
| `npm run game-core:typecheck` | PASS |
| `npm run mobile:typecheck` | PASS |
| `npm run m4:edge-smoke:check` | RED: `m4-rule-smoke/deno.json`未作成で失敗 → GREEN: PASS |
| `npx supabase functions serve m4-rule-smoke --no-verify-jwt` | PASS。Edge Runtime起動 |
| `Invoke-RestMethod -Method Post http://127.0.0.1:54321/functions/v1/m4-rule-smoke` | PASS。`{"ok":true,"actionKind":"LEAD","activePlayerId":"P2","rulesetVersion":1}` |

## 境界

- このTODOでは、共有ルール入口とEdge Functionからのimport実行を確認した。
- DBトランザクション、`expected_state_version`、`request_id`冪等性、RLS、非公開手札の所有者別読取は、M4-SB-01～09で実装する。
- `m4-rule-smoke`はM4初期の技術確認用であり、ユーザー操作の本番入口ではない。

## 次の作業

`M4-SB-01`で、`rooms`、`room_players`、`rounds`、`round_players`のDBマイグレーションを作る。
