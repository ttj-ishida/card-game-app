import {
  type PlayInput,
  resolveServerPlayRequest,
} from "@card-game-app/game-core/server";

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

type PlayRequestBody = {
  round_id?: string;
  request_id?: string;
  expected_state_version?: number;
  play?: PlayInput;
};

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

  const playBody = body.value as PlayRequestBody;
  if (!playBody.round_id || !playBody.request_id || !playBody.play) {
    return json({ ok: false, reason: "INVALID_REQUEST" }, 400);
  }

  const user = await fetchAuthUser(supabaseUrl, serviceRoleKey, authorization);
  if (!user.ok) {
    return json({ ok: false, reason: "UNAUTHENTICATED" }, 401);
  }

  const client = createPostgrestClient(supabaseUrl, serviceRoleKey);
  const rows = await loadRoundRows(client, playBody.round_id);
  if (!rows) {
    return json({ ok: false, reason: "ROUND_NOT_FOUND" }, 404);
  }
  if (rows.round.status !== "IN_PROGRESS") {
    return json({ ok: false, reason: "ROUND_NOT_IN_PROGRESS" }, 409);
  }

  const actor = rows.players.find((player) => player.auth_user_id === user.id);
  if (!actor) {
    return json({ ok: false, reason: "FORBIDDEN" }, 403);
  }

  const result = resolveServerPlayRequest(buildServerSnapshot(rows), {
    requestId: playBody.request_id,
    expectedStateVersion: playBody.expected_state_version ?? -1,
    playerId: actor.player_id,
    play: playBody.play,
  });

  if (!result.ok) {
    return json(
      {
        ok: false,
        reason: result.reason,
        current_state_version: result.currentStateVersion,
      },
      statusForRejection(result.reason),
    );
  }

  const commit = await commitResolvedPlay(client, {
    result,
    play: playBody.play,
    actorPlayerId: actor.player_id,
    expectedStateVersion: playBody.expected_state_version ?? -1,
    usedSkillId: findUsedSkillId(actor.player_id, playBody.play, rows.skills),
  });

  if (!commit.ok) {
    return json(
      {
        ok: false,
        reason: commit.reason ?? "COMMIT_REJECTED",
        current_state_version: commit.current_state_version,
      },
      statusForRejection(commit.reason ?? "COMMIT_REJECTED"),
    );
  }

  return json({
    ok: true,
    dry_run: false,
    request_id: result.requestId,
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
