import {
  createPlayerState,
  createRoundState,
  createSkillCard,
  enumerateLegalPlays,
  INITIAL_RULESET_VERSION,
  type ActiveField,
  type LegalPlay,
  type NumberCard,
  type RoundState,
  type SkillCard,
} from '@card-game-app/game-core';

import {
  normalizeLock,
  parseNumberCardId,
  parseSkillEffectFromId,
  type OnlineRoundSnapshotResponse,
  type OnlineSnapshotSkillRow,
} from './onlineRoundViewModel';

function buildActiveField(
  value: OnlineRoundSnapshotResponse['public_state']['active_field'],
): ActiveField | null {
  if (!value || Object.keys(value).length === 0) return null;
  const raw = value as {
    combination: ActiveField['combination'];
    lastPlayerId: string;
    lock?: ActiveField['lock'] | null;
  };
  return {
    combination: raw.combination,
    lastPlayerId: raw.lastPlayerId,
    lock: normalizeLock(raw.lock),
  };
}

function buildOwnSkill(rows: OnlineSnapshotSkillRow[]): SkillCard | null {
  const row = rows.find((r) => !r.used);
  if (!row) return null;
  const effectCode = parseSkillEffectFromId(row.skill_id);
  if (!effectCode) return null;
  return createSkillCard(row.skill_id, effectCode, row.used);
}

/**
 * サーバー権威の対局スナップショットから、自分の手番のときだけ合法手判定用の
 * `RoundState` を組み立てる。相手の手札は枚数以外わからないため空の手札で
 * プレースホルダー化する — `enumerateLegalPlays` は手番プレイヤー自身の
 * `hand`/`skill` のみを参照するため、自分の合法手列挙には影響しない
 * （§legalMoves.ts の実装に依存する前提。VIS-202: 非公開情報を推測復元しない）。
 */
export function buildRoundStateForLegalMoves(
  snapshot: OnlineRoundSnapshotResponse,
): RoundState | null {
  if (snapshot.player_id !== snapshot.public_state.active_player_id) return null;

  const myHand: NumberCard[] = snapshot.hand
    .filter((row) => row.card_state === 'IN_HAND')
    .map((row) => parseNumberCardId(row.card_id))
    .filter((card): card is NumberCard => card != null);

  const me = createPlayerState(snapshot.player_id, myHand, buildOwnSkill(snapshot.skills));
  const opponents = Object.keys(snapshot.public_state.hand_counts)
    .filter((playerId) => playerId !== snapshot.player_id)
    .map((playerId) => createPlayerState(playerId, [], null));

  return createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: snapshot.public_state.day_night,
    activePlayerId: snapshot.player_id,
    activeField: buildActiveField(snapshot.public_state.active_field),
    players: [me, ...opponents],
  });
}

/** 自分の手番のときだけ、保有スキルを含む合法手一覧を返す。手番でなければ`[]`。 */
export function buildLegalPlaysForOnlineRound(snapshot: OnlineRoundSnapshotResponse): LegalPlay[] {
  const state = buildRoundStateForLegalMoves(snapshot);
  if (!state) return [];
  return enumerateLegalPlays(state, { includeSkills: true });
}
