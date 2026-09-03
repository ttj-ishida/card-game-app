import {
  type ActiveField,
  type DayNight,
  type FieldLock,
  type NumberCombination,
  type PlayInput,
  type PlayerStatus,
  type ServerPlayerSnapshot,
  type ServerRoundSnapshot,
  resolveServerPlayRequest,
} from "@card-game-app/game-core/server";

type Json = Record<string, unknown>;

type PlayRequestBody = {
  round_id?: string;
  request_id?: string;
  expected_state_version?: number;
  play?: PlayInput;
};

type PostgrestRound = {
  id: string;
  state_version: number;
  status: string;
};

type PostgrestPublicState = {
  state_version: number;
  day_night: DayNight;
  active_player_id: string;
  active_field: Json;
};

type PostgrestRoundPlayer = {
  player_id: string;
  auth_user_id: string | null;
  status: string;
};

type PostgrestHand = {
  player_id: string;
  card_id: string;
  number_cards: { rank_code: string; suit_code: string } | null;
};

type PostgrestSkill = {
  player_id: string;
  skill_id: string;
  used: boolean;
  skill_cards: { effect_code: string } | null;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
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
  const [round, publicState, players, hands, skills] = await Promise.all([
    client.one<PostgrestRound>(
      `rounds?select=id,state_version,status&id=eq.${encodeURIComponent(playBody.round_id)}`,
    ),
    client.one<PostgrestPublicState>(
      `online_round_public_state?select=state_version,day_night,active_player_id,active_field&round_id=eq.${encodeURIComponent(playBody.round_id)}`,
    ),
    client.many<PostgrestRoundPlayer>(
      `round_players?select=player_id,auth_user_id,status&round_id=eq.${encodeURIComponent(playBody.round_id)}`,
    ),
    client.many<PostgrestHand>(
      `round_hands?select=player_id,card_id,number_cards(rank_code,suit_code)&round_id=eq.${encodeURIComponent(playBody.round_id)}&card_state=eq.IN_HAND`,
    ),
    client.many<PostgrestSkill>(
      `round_skills?select=player_id,skill_id,used,skill_cards(effect_code)&round_id=eq.${encodeURIComponent(playBody.round_id)}`,
    ),
  ]);

  if (!round || !publicState) {
    return json({ ok: false, reason: "ROUND_NOT_FOUND" }, 404);
  }

  if (round.status !== "IN_PROGRESS") {
    return json({ ok: false, reason: "ROUND_NOT_IN_PROGRESS" }, 409);
  }

  const actor = players.find((player) => player.auth_user_id === user.id);
  if (!actor) {
    return json({ ok: false, reason: "FORBIDDEN" }, 403);
  }

  const snapshot: ServerRoundSnapshot = {
    roundId: round.id,
    stateVersion: publicState.state_version,
    dayNight: publicState.day_night,
    activePlayerId: publicState.active_player_id,
    activeField: parseActiveField(publicState.active_field),
    players: players.map((player): ServerPlayerSnapshot => ({
      playerId: player.player_id,
      status: toPlayerStatus(player.status),
      consecutivePasses: 0,
      hand: hands
        .filter(
          (hand) => hand.player_id === player.player_id && hand.number_cards,
        )
        .map((hand) => ({
          cardId: hand.card_id,
          rankCode: hand.number_cards!
            .rank_code as ServerPlayerSnapshot["hand"][number]["rankCode"],
          suitCode: hand.number_cards!
            .suit_code as ServerPlayerSnapshot["hand"][number]["suitCode"],
        })),
      skill:
        (skills.find(
          (skill) => skill.player_id === player.player_id && skill.skill_cards,
        ) ?? null)
          ? (() => {
              const skill = skills.find(
                (value) =>
                  value.player_id === player.player_id && value.skill_cards,
              )!;
              return {
                skillId: skill.skill_id,
                effectCode: skill.skill_cards!.effect_code as NonNullable<
                  ServerPlayerSnapshot["skill"]
                >["effectCode"],
                used: skill.used,
              };
            })()
          : null,
    })),
  };

  const result = resolveServerPlayRequest(snapshot, {
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

  return json({
    ok: true,
    dry_run: true,
    request_id: result.requestId,
    round_id: result.roundId,
    ruleset_version: result.rulesetVersion,
    outcome: {
      action_kind: result.outcome.actionKind,
      field_cleared: result.outcome.fieldCleared,
      day_night_after: result.outcome.dayNightAfter,
      winner_id: result.outcome.winnerId,
    },
    next_public_state: {
      active_player_id: result.state.activePlayerId,
      day_night: result.state.dayNight,
      hand_counts: Object.fromEntries(
        result.state.players.map((player) => [
          player.playerId,
          player.hand.length,
        ]),
      ),
    },
  });
});

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

async function fetchAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  authorization: string,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      authorization,
    },
  });

  if (!response.ok) {
    return { ok: false };
  }

  const user = (await response.json()) as { id?: string };
  return user.id ? { ok: true, id: user.id } : { ok: false };
}

function createPostgrestClient(supabaseUrl: string, serviceRoleKey: string) {
  const baseUrl = `${supabaseUrl}/rest/v1/`;
  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
  };

  return {
    async one<T>(path: string): Promise<T | null> {
      const rows = await this.many<T>(path);
      return rows[0] ?? null;
    },
    async many<T>(path: string): Promise<T[]> {
      const response = await fetch(`${baseUrl}${path}`, { headers });
      if (!response.ok) {
        throw new Error(`PostgREST request failed: ${response.status}`);
      }
      return (await response.json()) as T[];
    },
  };
}

function toPlayerStatus(status: string): PlayerStatus {
  return status === "OUT" ? "OUT" : status === "LEFT" ? "OUT" : "ACTIVE";
}

function parseActiveField(value: Json): ActiveField | null {
  if (!value || Object.keys(value).length === 0) {
    return null;
  }

  const combination = value.combination as NumberCombination | undefined;
  const lastPlayerId = value.lastPlayerId as string | undefined;
  const lock = value.lock as FieldLock | undefined;
  if (!combination || !lastPlayerId || !lock) {
    throw new Error("Invalid active_field snapshot");
  }

  return { combination, lastPlayerId, lock };
}

function statusForRejection(reason: string): number {
  if (reason === "STALE_STATE_VERSION") {
    return 409;
  }
  if (reason === "NOT_ACTIVE_PLAYER") {
    return 403;
  }
  if (reason === "INVALID_REQUEST") {
    return 400;
  }
  return 422;
}

function json(payload: Json, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: corsHeaders,
  });
}
