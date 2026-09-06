// M4-SB / EX-09: CPU 引き継ぎ席の手番を1手進める。
//
// `leave_friend_round(..., requested_cpu_takeover=true)` は席を CPU_TAKEOVER にするだけで、
// その席の手番を打つ処理が無かった。この関数を対局中の任意のメンバーが叩くと、
// アクティブ席が CPU 席なら standardPolicy で1手選んで commit する。
//
//   POST { round_id }  ->  { ok, acted, ... }
//
// 冪等: expected_state_version ガード + commit_friend_play の p_request_id で、
// 複数クライアントが同時に叩いても1手ぶんしか進まない。

import {
  buildServerRoundState,
  createRng,
  enumerateLegalPlays,
  resolveCpuPolicy,
  resolveServerPlayRequest,
} from "@ragnarok-millennium/game-core/server";

import {
  commitResolvedPlay,
  corsHeaders,
  createPostgrestClient,
  fetchAuthUser,
  findUsedSkillId,
  buildServerSnapshot,
  json,
  loadRoundRows,
  readJsonBody,
  statusForRejection,
} from "../_shared/friendRound.ts";

type Body = { round_id?: string };

/** round id + state_version から決定的なシード。 */
function seedFor(roundId: string, stateVersion: number): number {
  let h = 2166136261 >>> 0;
  const material = `${roundId}:${stateVersion}`;
  for (let i = 0; i < material.length; i += 1) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 1; // 正の整数
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ ok: false, reason: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, reason: "SERVER_NOT_CONFIGURED" }, 500);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return json({ ok: false, reason: "UNAUTHENTICATED" }, 401);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return json({ ok: false, reason: "INVALID_JSON" }, 400);
  }
  const roundIdRaw = (body.value as Body).round_id;
  if (!roundIdRaw) {
    return json({ ok: false, reason: "INVALID_REQUEST" }, 400);
  }

  const user = await fetchAuthUser(supabaseUrl, serviceRoleKey, authorization);
  if (!user.ok) {
    return json({ ok: false, reason: "UNAUTHENTICATED" }, 401);
  }

  const client = createPostgrestClient(supabaseUrl, serviceRoleKey);
  const rows = await loadRoundRows(client, roundIdRaw);
  if (!rows) {
    return json({ ok: false, reason: "ROUND_NOT_FOUND" }, 404);
  }
  if (rows.round.status !== "IN_PROGRESS") {
    return json({ ok: false, reason: "ROUND_NOT_IN_PROGRESS" }, 409);
  }

  // 呼び出し元は対局メンバーであること（退出済みでも可 — 観戦的に叩けてよい）。
  const isMember = rows.players.some((p) => p.auth_user_id === user.id);
  if (!isMember) {
    return json({ ok: false, reason: "FORBIDDEN" }, 403);
  }

  const activeSeat = rows.players.find(
    (p) => p.player_id === rows.publicState.active_player_id,
  );
  if (!activeSeat) {
    return json({ ok: false, reason: "ACTIVE_SEAT_NOT_FOUND" }, 409);
  }
  if (activeSeat.status !== "CPU_TAKEOVER") {
    return json({ ok: true, acted: false, reason: "NOT_CPU_TURN" });
  }

  const snapshot = buildServerSnapshot(rows);
  const state = buildServerRoundState(snapshot);
  const legalPlays = enumerateLegalPlays(state, { includeSkills: true });
  if (legalPlays.length === 0) {
    return json({ ok: true, acted: false, reason: "NO_LEGAL_MOVE" });
  }

  const rng = createRng(seedFor(rows.round.id, rows.publicState.state_version));
  const move = resolveCpuPolicy("STANDARD")({ state, legalPlays, rng });

  const result = resolveServerPlayRequest(snapshot, {
    requestId: crypto.randomUUID(),
    expectedStateVersion: rows.publicState.state_version,
    playerId: activeSeat.player_id,
    play: move,
  });
  if (!result.ok) {
    return json(
      { ok: false, acted: false, reason: result.reason },
      statusForRejection(result.reason),
    );
  }

  const commit = await commitResolvedPlay(client, {
    result,
    play: move,
    actorPlayerId: activeSeat.player_id,
    expectedStateVersion: rows.publicState.state_version,
    usedSkillId: findUsedSkillId(activeSeat.player_id, move, rows.skills),
    eventKind: "CPU_PLAY_ACCEPTED",
  });
  if (!commit.ok) {
    return json(
      {
        ok: false,
        acted: false,
        reason: commit.reason ?? "COMMIT_REJECTED",
        current_state_version: commit.current_state_version,
      },
      statusForRejection(commit.reason ?? "COMMIT_REJECTED"),
    );
  }

  return json({
    ok: true,
    acted: true,
    round_id: result.roundId,
    state_version: commit.state_version,
    event_seq: commit.event_seq,
    outcome: {
      action_kind: result.outcome.actionKind,
      field_cleared: result.outcome.fieldCleared,
      day_night_after: result.outcome.dayNightAfter,
      winner_id: result.outcome.winnerId,
    },
  });
});
