// M4 オンライン対局のフレンドルーム系 Edge Function 共有ロジック。
// submit-play（人間の着手）と advance-cpu-turn（CPU引き継ぎ席の着手）で共有する。

import {
  type ActiveField,
  type DayNight,
  type FieldLock,
  type NumberCombination,
  type PlayInput,
  type PlayerStatus,
  type RoundState,
  type ServerPlayerSnapshot,
  type ServerRoundSnapshot,
  type ServerPlayRequestResolution,
} from "@card-game-app/game-core/server";

export type Json = Record<string, unknown>;

export type PostgrestRound = {
  id: string;
  state_version: number;
  status: string;
};

export type PostgrestPublicState = {
  state_version: number;
  day_night: DayNight;
  active_player_id: string;
  active_field: Json;
  consecutive_passes: number;
};

export type PostgrestRoundPlayer = {
  player_id: string;
  auth_user_id: string | null;
  status: string;
};

export type PostgrestHand = {
  player_id: string;
  card_id: string;
  number_cards: { rank_code: string; suit_code: string } | null;
};

export type PostgrestSkill = {
  player_id: string;
  skill_id: string;
  used: boolean;
  skill_cards: { effect_code: string } | null;
};

export type CommitResult = {
  ok: boolean;
  reason?: string;
  current_state_version?: number;
  state_version?: number;
  event_seq?: number;
};

export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function json(payload: Json, status = 200): Response {
  return Response.json(payload, { status, headers: corsHeaders });
}

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

export async function fetchAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  authorization: string,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, authorization },
  });
  if (!response.ok) return { ok: false };
  const user = (await response.json()) as { id?: string };
  return user.id ? { ok: true, id: user.id } : { ok: false };
}

export type PostgrestClient = ReturnType<typeof createPostgrestClient>;

export function createPostgrestClient(supabaseUrl: string, serviceRoleKey: string) {
  const baseUrl = `${supabaseUrl}/rest/v1/`;
  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
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
    async rpc<T>(name: string, payload: Json): Promise<T> {
      const response = await fetch(`${baseUrl}rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`PostgREST RPC failed: ${response.status}`);
      }
      return (await response.json()) as T;
    },
  };
}

export type RoundRows = {
  round: PostgrestRound;
  publicState: PostgrestPublicState;
  players: PostgrestRoundPlayer[];
  hands: PostgrestHand[];
  skills: PostgrestSkill[];
};

export async function loadRoundRows(
  client: PostgrestClient,
  rawRoundId: string,
): Promise<RoundRows | null> {
  const roundId = encodeURIComponent(rawRoundId);
  const [round, publicState, players, hands, skills] = await Promise.all([
    client.one<PostgrestRound>(`rounds?select=id,state_version,status&id=eq.${roundId}`),
    client.one<PostgrestPublicState>(
      `online_round_public_state?select=state_version,day_night,active_player_id,active_field,consecutive_passes&round_id=eq.${roundId}`,
    ),
    client.many<PostgrestRoundPlayer>(
      `round_players?select=player_id,auth_user_id,status&round_id=eq.${roundId}`,
    ),
    client.many<PostgrestHand>(
      `round_hands?select=player_id,card_id,number_cards(rank_code,suit_code)&round_id=eq.${roundId}&card_state=eq.IN_HAND`,
    ),
    client.many<PostgrestSkill>(
      `round_skills?select=player_id,skill_id,used,skill_cards(effect_code)&round_id=eq.${roundId}`,
    ),
  ]);
  if (!round || !publicState) return null;
  return { round, publicState, players, hands, skills };
}

export function toPlayerStatus(status: string): PlayerStatus {
  return status === "OUT" || status === "LEFT" ? "OUT" : "ACTIVE";
}

export function parseActiveField(value: Json): ActiveField | null {
  if (!value || Object.keys(value).length === 0) return null;
  const combination = value.combination as NumberCombination | undefined;
  const lastPlayerId = value.lastPlayerId as string | undefined;
  const lock = value.lock as FieldLock | undefined;
  if (!combination || !lastPlayerId || !lock) {
    throw new Error("Invalid active_field snapshot");
  }
  return { combination, lastPlayerId, lock };
}

export function buildServerSnapshot(rows: RoundRows): ServerRoundSnapshot {
  const { round, publicState, players, hands, skills } = rows;
  return {
    roundId: round.id,
    stateVersion: publicState.state_version,
    dayNight: publicState.day_night,
    activePlayerId: publicState.active_player_id,
    activeField: parseActiveField(publicState.active_field),
    consecutivePasses: publicState.consecutive_passes,
    players: players.map((player): ServerPlayerSnapshot => {
      const skill = skills.find(
        (value) => value.player_id === player.player_id && value.skill_cards,
      );
      return {
        playerId: player.player_id,
        status: toPlayerStatus(player.status),
        consecutivePasses: 0,
        hand: hands
          .filter((hand) => hand.player_id === player.player_id && hand.number_cards)
          .map((hand) => ({
            cardId: hand.card_id,
            rankCode: hand.number_cards!
              .rank_code as ServerPlayerSnapshot["hand"][number]["rankCode"],
            suitCode: hand.number_cards!
              .suit_code as ServerPlayerSnapshot["hand"][number]["suitCode"],
          })),
        skill: skill
          ? {
              skillId: skill.skill_id,
              effectCode: skill.skill_cards!.effect_code as NonNullable<
                ServerPlayerSnapshot["skill"]
              >["effectCode"],
              used: skill.used,
            }
          : null,
      };
    }),
  };
}

export function findUsedSkillId(
  playerId: string,
  play: PlayInput,
  skills: PostgrestSkill[],
): string | null {
  if (play.kind !== "PLAY" || !play.useSkill) return null;
  return (
    skills.find(
      (skill) =>
        skill.player_id === playerId &&
        !skill.used &&
        skill.skill_cards?.effect_code === play.useSkill,
    )?.skill_id ?? null
  );
}

export function buildNextPublicState(state: RoundState): Json {
  return {
    day_night: state.dayNight,
    active_player_id: state.activePlayerId,
    active_field: state.activeField ?? {},
    hand_counts: Object.fromEntries(
      state.players.map((player) => [player.playerId, player.hand.length]),
    ),
    consecutive_passes: state.consecutivePasses,
  };
}

export function statusForRejection(reason: string): number {
  if (reason === "STALE_STATE_VERSION") return 409;
  if (reason === "NOT_ACTIVE_PLAYER") return 403;
  if (reason === "INVALID_REQUEST") return 400;
  return 422;
}

/** 解決済みの着手を commit_friend_play で確定する。commit の生結果を返す。 */
export async function commitResolvedPlay(
  client: PostgrestClient,
  params: {
    result: Extract<ServerPlayRequestResolution, { ok: true }>;
    play: PlayInput;
    actorPlayerId: string;
    expectedStateVersion: number;
    usedSkillId: string | null;
    eventKind?: string;
  },
): Promise<CommitResult> {
  const { result, play, actorPlayerId, expectedStateVersion, usedSkillId } = params;
  return client.rpc<CommitResult>("commit_friend_play", {
    target_round_id: result.roundId,
    expected_state_version: expectedStateVersion,
    actor_player_id: actorPlayerId,
    played_card_ids: play.kind === "PLAY" ? play.cardIds : [],
    used_skill_id: usedSkillId,
    next_public_state: buildNextPublicState(result.state),
    event_payload: {
      event_kind: params.eventKind ?? "PLAY_ACCEPTED",
      request_id: result.requestId,
      action_kind: result.outcome.actionKind,
      card_count: play.kind === "PLAY" ? play.cardIds.length : 0,
      skill_effect: play.kind === "PLAY" ? (play.useSkill ?? null) : null,
      field_cleared: result.outcome.fieldCleared,
      natural_revolution: result.outcome.naturalRevolution,
      day_night_after: result.outcome.dayNightAfter,
      winner_id: result.outcome.winnerId,
    },
    round_completed: result.outcome.winnerId !== null,
    winner_player_id: result.outcome.winnerId,
    p_request_id: result.requestId,
  });
}
