/**
 * M4-QA-01: 2〜6クライアントの自動操作ハーネス。
 *
 * game-core の合法手列挙で各クライアントを駆動し、フレンドルーム作成 → 参加 →
 * 対局開始 → 決着までを完全にヘッドレスで回す。既定ではローカル Supabase
 * スタック（`supabase start`）を叩く。
 *
 *   PLAYERS=4 ROUNDS=1 npm --prefix apps/mobile run qa:m4:selfplay
 *
 * 環境変数:
 *   SUPABASE_URL       (default: http://127.0.0.1:54321)
 *   SUPABASE_ANON_KEY  (default: ローカルスタックの demo anon key)
 *   PLAYERS            参加人数 2..6 (default 3)
 *   ROUNDS             連続して回す部屋数 (default 1) — QA-03 は ROUNDS=50
 *   MAX_TURNS          1局あたりの手番上限ガード (default 600)
 *   POLL_MS            ポーリング間隔ミリ秒 (default 60)
 *   VERBOSE            "1" で毎手番ログ
 *
 *   -- M4-QA-02 障害注入 --
 *   FAULT_DELAY_MS     各リクエスト前に 0..N ミリ秒のランダム遅延 (default 0)
 *   FAULT_DROP_RATE    各リクエストを失敗させる確率 0..1 — 切断相当 (default 0)
 *   FAULT_DUP_RATE     各 POST を二重送信する確率 0..1 — 冪等性テスト (default 0)
 *
 *   -- M4-QA-05 退出 --
 *   FORFEIT_AT         この手番で FORFEIT_CLIENT が棄権退出する (default: なし)
 *   FORFEIT_CLIENT     退出するクライアント番号 1-indexed (default 2)
 */
import { randomUUID } from 'node:crypto';

import { enumerateLegalPlays, type LegalPlay } from '@card-game-app/game-core';

import type { StoragePort } from '../src/features/cpu-game/anonPlayerId';
import {
  createOnlineRoom,
  fetchOnlineRoundSnapshot,
  joinOnlineRoom,
  leaveOnlineRound,
  startOnlineRound,
  submitOnlinePlayRequest,
  type OnlineHttpPort,
  type OnlineRoomDeps,
} from '../src/features/online-room/onlineRoomClient';
import { buildRoundStateForLegalMoves } from '../src/features/online-room/onlineLegalMoves';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PLAYERS = clampInt(process.env.PLAYERS, 3, 2, 6);
const ROUNDS = clampInt(process.env.ROUNDS, 1, 1, 200);
const MAX_TURNS = clampInt(process.env.MAX_TURNS, 600, 20, 5000);
const POLL_MS = clampInt(process.env.POLL_MS, 60, 5, 2000);
const VERBOSE = process.env.VERBOSE === '1';

const FAULT_DELAY_MS = clampInt(process.env.FAULT_DELAY_MS, 0, 0, 10_000);
const FAULT_DROP_RATE = clampRate(process.env.FAULT_DROP_RATE);
const FAULT_DUP_RATE = clampRate(process.env.FAULT_DUP_RATE);
const FORFEIT_AT = process.env.FORFEIT_AT ? clampInt(process.env.FORFEIT_AT, 0, 0, 5000) : null;
const FORFEIT_CLIENT = clampInt(process.env.FORFEIT_CLIENT, 2, 1, 6);

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampRate(raw: string | undefined): number {
  const n = raw ? Number.parseFloat(raw) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function memoryStorage(): StoragePort {
  const data = new Map<string, string>();
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
  };
}

// 障害注入は対局ループ中だけ有効にする（ルーム作成・参加・開始は素で通す）。
let faultsArmed = false;

async function maybeFaultBefore(): Promise<void> {
  if (FAULT_DELAY_MS > 0) await sleep(Math.floor(Math.random() * FAULT_DELAY_MS));
  if (faultsArmed && FAULT_DROP_RATE > 0 && Math.random() < FAULT_DROP_RATE) {
    throw new Error('injected connection drop');
  }
}

const DROP_RE = /drop|network|fetch failed|ECONN|terminated|socket/i;

/** 切断相当のエラーだけ最大 `tries` 回まで飲み込んで再試行する。 */
async function withRetry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= tries || !DROP_RE.test(message)) throw err;
      await sleep(POLL_MS);
    }
  }
}

const httpPort: OnlineHttpPort = {
  async get(url, headers) {
    await maybeFaultBefore();
    const res = await fetch(url, { headers });
    return { status: res.status, body: await res.text() };
  },
  async post(url, headers, body) {
    await maybeFaultBefore();
    // Idempotency stress: fire the same POST twice, keep the first answer.
    if (FAULT_DUP_RATE > 0 && Math.random() < FAULT_DUP_RATE) {
      void fetch(url, { method: 'POST', headers, body }).catch(() => undefined);
    }
    const res = await fetch(url, { method: 'POST', headers, body });
    return { status: res.status, body: await res.text() };
  },
};

function makeDeps(): OnlineRoomDeps {
  return {
    http: httpPort,
    storage: memoryStorage(),
    supabaseUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    now: () => Date.now(),
  };
}

/** 常に前進する決定的な手選び: 上がれるなら上がる → 素の最弱手 → PASS。 */
function chooseMove(plays: LegalPlay[]): LegalPlay | null {
  if (plays.length === 0) return null;
  const goOut = plays.find((p) => p.goesOut && p.input.kind === 'PLAY');
  if (goOut) return goOut;
  const play = plays.find((p) => p.input.kind === 'PLAY');
  if (play) return play;
  return plays.find((p) => p.input.kind === 'PASS') ?? null;
}

type Client = { deps: OnlineRoomDeps; playerId: string; label: string };

async function snapshotFor(client: Client, roundId: string) {
  return withRetry(() => fetchOnlineRoundSnapshot(roundId, null, client.deps));
}

const RUN_ID = `${Date.now().toString(36)}${randomUUID().slice(0, 4)}`.toUpperCase();

async function runOneRound(roundIndex: number): Promise<void> {
  // Globally unique per run so a stale room from an earlier run cannot be
  // joined by invite code (which would hand back its already-finished round).
  const inviteCode = `SP${RUN_ID}R${roundIndex}`.slice(0, 24);
  const clients: Client[] = Array.from({ length: PLAYERS }, (_, i) => ({
    deps: makeDeps(),
    playerId: '',
    label: `P${i + 1}`,
  }));

  const created = await createOnlineRoom(
    inviteCode,
    { maxPlayers: PLAYERS, turnSeconds: 60, cpuTakeoverEnabled: true },
    clients[0].deps,
  );
  clients[0].playerId = created.player_id;

  for (let i = 1; i < PLAYERS; i += 1) {
    const joined = await joinOnlineRoom(inviteCode, clients[i].deps);
    clients[i].playerId = joined.player_id;
  }

  const roundId = await startOnlineRound(created.room_id, clients[0].deps);
  const byPlayerId = new Map(clients.map((c) => [c.playerId, c]));
  // 棄権するクライアントを観測役に選ばないようにする。
  const observer =
    FORFEIT_AT != null && FORFEIT_CLIENT - 1 === 0 ? clients[PLAYERS - 1] : clients[0];
  const forfeiter = FORFEIT_AT != null ? clients[Math.min(FORFEIT_CLIENT - 1, PLAYERS - 1)] : null;

  const opening = await snapshotFor(observer, roundId);
  if (extractWinner(opening.events)) {
    throw new Error(`round ${roundIndex} started already finished (stale room reuse?)`);
  }
  const openingSeats = Object.keys(opening.public_state.hand_counts).length;
  if (openingSeats !== PLAYERS) {
    throw new Error(`round ${roundIndex} opened with ${openingSeats} seats, expected ${PLAYERS}`);
  }

  let turns = 0;
  let winnerId: string | null = null;
  let forfeited = false;
  faultsArmed = true;

  while (turns < MAX_TURNS && !winnerId) {
    if (FORFEIT_AT != null && !forfeited && turns >= FORFEIT_AT && forfeiter) {
      const res = await withRetry(() => leaveOnlineRound(roundId, false, forfeiter.deps));
      forfeited = true;
      if (VERBOSE) console.log(`  turn ${turns} ${forfeiter.label} forfeits`);
      if (res.winner_player_id) winnerId = res.winner_player_id;
      if (winnerId) break;
    }

    const snap = await snapshotFor(observer, roundId);
    winnerId = extractWinner(snap.events);
    if (winnerId) break;

    const activeId: string = snap.public_state.active_player_id;
    const active = byPlayerId.get(activeId);
    if (!active || active === forfeiter) {
      // CPU 引き継ぎ席 / 棄権済みの席など、代打不能。少し待って再確認する。
      await sleep(POLL_MS);
      turns += 1;
      continue;
    }

    const actorSnap = await snapshotFor(active, roundId);
    const state = buildRoundStateForLegalMoves(actorSnap);
    if (!state) {
      await sleep(POLL_MS);
      turns += 1;
      continue;
    }
    const move = chooseMove(enumerateLegalPlays(state, { includeSkills: true }));
    if (!move) {
      throw new Error(
        `${active.label} is active at turn ${turns} but has no legal move (state_version ${actorSnap.state_version})`,
      );
    }

    const landed = await submitWithRetry(active, roundId, actorSnap.state_version, move, turns);
    if (landed?.winnerId) winnerId = landed.winnerId;

    turns += 1;
    await sleep(POLL_MS);
  }

  faultsArmed = false;

  if (!winnerId) {
    throw new Error(`round ${roundIndex} did not finish within ${MAX_TURNS} turns`);
  }
  if (forfeiter && winnerId === forfeiter.playerId) {
    throw new Error(
      `round ${roundIndex} declared the forfeiting player ${forfeiter.label} the winner`,
    );
  }
  const winner = byPlayerId.get(winnerId);
  console.log(
    `round ${roundIndex}: winner ${winner?.label ?? winnerId.slice(0, 8)} in ${turns} turns (${PLAYERS}p${forfeited ? ', 1 forfeit' : ''})`,
  );
  // 検証データはローカルスタックの `supabase db reset` で消える。リモートに向けて
  // 回した場合は別途クリーンアップすること。
}

/**
 * 送信を最大5回まで再試行する。request_id は固定なので、切断で失敗しても
 * 実際にはサーバーに届いていた場合は冪等に成立扱いになる（M4-SB-08 / QA-02）。
 */
async function submitWithRetry(
  active: Client,
  roundId: string,
  expectedStateVersion: number,
  move: LegalPlay,
  turn: number,
): Promise<{ winnerId: string | null } | null> {
  const requestId = randomUUID();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await submitOnlinePlayRequest(
        roundId,
        expectedStateVersion,
        requestId,
        move.input,
        active.deps,
      );
      if (result.ok) {
        if (VERBOSE) {
          const desc = move.input.kind === 'PASS' ? 'PASS' : `${move.input.cardIds.length} card`;
          console.log(
            `  turn ${turn} ${active.label} ${desc} -> sv ${result.state_version} ${result.outcome.action_kind}${result.outcome.field_cleared ? ' (cleared)' : ''}`,
          );
        }
        return { winnerId: result.outcome.winner_id };
      }
      if (result.reason === 'STALE_STATE_VERSION') {
        // 直前の試行が実は届いていた、または他クライアントが動いた。前進扱い。
        if (VERBOSE) console.log(`  turn ${turn} ${active.label} stale (already advanced)`);
        return null;
      }
      throw new Error(`${active.label} submit rejected at turn ${turn}: ${result.reason}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!DROP_RE.test(message)) throw err;
      if (attempt === 4) return null; // 5回とも切断: 次ループのポーリングで状態を取り直す
      await sleep(POLL_MS);
    }
  }
  return null;
}

function extractWinner(
  events: { public_payload: Record<string, unknown> | null }[],
): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const payload = events[i].public_payload;
    const w = payload?.winner_id ?? payload?.winner_player_id;
    if (typeof w === 'string') return w;
  }
  return null;
}

async function main(): Promise<void> {
  console.log(
    `online self-play: ${SUPABASE_URL} · ${PLAYERS} players · ${ROUNDS} round(s) · max ${MAX_TURNS} turns`,
  );
  const startedAt = Date.now();
  for (let r = 1; r <= ROUNDS; r += 1) {
    await runOneRound(r);
  }
  console.log(
    `OK: ${ROUNDS} round(s) completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
}

main().catch((err) => {
  console.error('SELF-PLAY FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
