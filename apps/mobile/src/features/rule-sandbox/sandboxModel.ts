import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
  parseNumberCombination,
  type DayNight,
  type NumberCard,
  type PlayerState,
  type PlayerStatus,
  type PlayInput,
  type RankCode,
  type RoundState,
  type SkillEffectCode,
  type SuitCode,
} from '@card-game-app/game-core';

export const SANDBOX_MIN_PLAYERS = 2;
export const SANDBOX_MAX_PLAYERS = 6;

export function sandboxCardId(rankCode: RankCode, suitCode: SuitCode): string {
  return `SBX_${rankCode}_${suitCode}`;
}

export function makeSandboxCard(rankCode: RankCode, suitCode: SuitCode): NumberCard {
  return createNumberCard(sandboxCardId(rankCode, suitCode), rankCode, suitCode);
}

export function createInitialRound(): RoundState {
  return createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: 'DAY',
    players: [
      createPlayerState('P1', [
        makeSandboxCard('RANK_3', 'SUIT_FIRE'),
        makeSandboxCard('RANK_4', 'SUIT_WATER'),
        makeSandboxCard('RANK_8', 'SUIT_FIRE'),
      ]),
      createPlayerState('P2', [
        makeSandboxCard('RANK_5', 'SUIT_WIND'),
        makeSandboxCard('RANK_6', 'SUIT_EARTH'),
        makeSandboxCard('RANK_7', 'SUIT_WATER'),
      ]),
    ],
    activePlayerId: 'P1',
  });
}

function cloneRound(round: RoundState): RoundState {
  return createRoundState({
    rulesetCode: round.rulesetCode,
    rulesetVersion: round.rulesetVersion,
    dayNight: round.dayNight,
    players: round.players,
    activePlayerId: round.activePlayerId,
    activeField: round.activeField
      ? {
          combination: round.activeField.combination,
          lastPlayerId: round.activeField.lastPlayerId,
        }
      : null,
    lockedSuitCode: round.lockedSuitCode,
    extensionSealed: round.extensionSealed,
    discardPile: round.discardPile,
    consecutivePasses: round.consecutivePasses,
    winnerId: round.winnerId,
  });
}

function withoutCardId(round: RoundState, cardId: string): RoundState {
  const next = cloneRound(round);
  next.players = next.players.map((player) => ({
    ...player,
    hand: player.hand.filter((card) => card.cardId !== cardId),
  }));
  next.discardPile = next.discardPile.filter((card) => card.cardId !== cardId);
  if (next.activeField) {
    const cards = next.activeField.combination.cards.filter((card) => card.cardId !== cardId);
    const combination = parseNumberCombination(cards);
    next.activeField = combination
      ? { combination, lastPlayerId: next.activeField.lastPlayerId }
      : null;
  }
  return next;
}

export function setDayNight(round: RoundState, dayNight: DayNight): RoundState {
  const next = cloneRound(round);
  next.dayNight = dayNight;
  return next;
}

export function setActivePlayer(round: RoundState, playerId: string): RoundState {
  if (!round.players.some((player) => player.playerId === playerId)) return round;
  const next = cloneRound(round);
  next.activePlayerId = playerId;
  return next;
}

export function setLockedSuit(round: RoundState, suit: SuitCode | null): RoundState {
  const next = cloneRound(round);
  next.lockedSuitCode = suit;
  return next;
}

export function setExtensionSealed(round: RoundState, sealed: boolean): RoundState {
  const next = cloneRound(round);
  next.extensionSealed = sealed;
  return next;
}

export function setConsecutivePasses(round: RoundState, n: number): RoundState {
  const next = cloneRound(round);
  next.consecutivePasses = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return next;
}

export function clearField(round: RoundState): RoundState {
  const next = cloneRound(round);
  next.activeField = null;
  return next;
}

export function isValidFieldCards(cards: NumberCard[]): boolean {
  return parseNumberCombination(cards) !== null;
}

export function setFieldCards(
  round: RoundState,
  cards: NumberCard[],
  lastPlayerId: string,
): RoundState {
  const combination = parseNumberCombination(cards);
  if (!combination) return round;
  let next = round;
  for (const card of cards) next = withoutCardId(next, card.cardId);
  next = cloneRound(next);
  next.activeField = { combination, lastPlayerId };
  return next;
}

export function setFieldLastPlayer(round: RoundState, playerId: string): RoundState {
  if (!round.activeField) return round;
  const next = cloneRound(round);
  next.activeField = {
    combination: round.activeField.combination,
    lastPlayerId: playerId,
  };
  return next;
}

export function addDiscard(round: RoundState, card: NumberCard): RoundState {
  const next = cloneRound(withoutCardId(round, card.cardId));
  next.discardPile = [...next.discardPile, card];
  return next;
}

export function removeDiscard(round: RoundState, cardId: string): RoundState {
  const next = cloneRound(round);
  next.discardPile = next.discardPile.filter((card) => card.cardId !== cardId);
  return next;
}

export function setPlayerCount(round: RoundState, count: number): RoundState {
  const target = Math.min(
    SANDBOX_MAX_PLAYERS,
    Math.max(SANDBOX_MIN_PLAYERS, Math.floor(Number.isFinite(count) ? count : SANDBOX_MIN_PLAYERS)),
  );
  const next = cloneRound(round);
  const current = next.players;
  let players: PlayerState[];
  if (target <= current.length) {
    players = current.slice(0, target);
  } else {
    players = [...current];
    for (let index = current.length; index < target; index += 1) {
      players.push(createPlayerState(`P${index + 1}`, []));
    }
  }
  next.players = players;
  if (!players.some((player) => player.playerId === next.activePlayerId)) {
    next.activePlayerId = players[0].playerId;
  }
  return next;
}

function mapPlayer(
  round: RoundState,
  playerId: string,
  fn: (player: PlayerState) => PlayerState,
): RoundState {
  if (!round.players.some((player) => player.playerId === playerId)) return round;
  const next = cloneRound(round);
  next.players = next.players.map((player) =>
    player.playerId === playerId ? fn({ ...player }) : player,
  );
  return next;
}

export function setPlayerSkill(
  round: RoundState,
  playerId: string,
  effectCode: SkillEffectCode | null,
): RoundState {
  return mapPlayer(round, playerId, (player) => ({
    ...player,
    skill: effectCode
      ? { kind: 'SKILL', skillId: `SBX_SKILL_${playerId}`, effectCode, used: false }
      : null,
  }));
}

export function setPlayerSkillUsed(round: RoundState, playerId: string, used: boolean): RoundState {
  return mapPlayer(round, playerId, (player) =>
    player.skill ? { ...player, skill: { ...player.skill, used } } : player,
  );
}

export function setPlayerStatus(
  round: RoundState,
  playerId: string,
  status: PlayerStatus,
): RoundState {
  return mapPlayer(round, playerId, (player) => ({ ...player, status }));
}

export function addCardToHand(
  round: RoundState,
  playerId: string,
  rankCode: RankCode,
  suitCode: SuitCode,
): RoundState {
  if (!round.players.some((player) => player.playerId === playerId)) return round;
  const card = makeSandboxCard(rankCode, suitCode);
  const cleared = cloneRound(withoutCardId(round, card.cardId));
  cleared.players = cleared.players.map((player) =>
    player.playerId === playerId ? { ...player, hand: [...player.hand, card] } : player,
  );
  return cleared;
}

export function removeCardFromHand(
  round: RoundState,
  playerId: string,
  cardId: string,
): RoundState {
  return mapPlayer(round, playerId, (player) => ({
    ...player,
    hand: player.hand.filter((card) => card.cardId !== cardId),
  }));
}

export type PlayDraft = {
  kind: 'PASS' | 'PLAY';
  cardIds: string[];
  useSkill?: 'EXTENSION_SEAL' | 'REVOLUTION' | 'JOKER_TRANSFORM' | 'JOKER_CLEAR';
  jokerDeclaration?: { rankCode: RankCode; suitCode: SuitCode };
};

export function emptyPlayDraft(): PlayDraft {
  return { kind: 'PLAY', cardIds: [] };
}

export function buildPlayInput(round: RoundState, draft: PlayDraft): PlayInput {
  const playerId = round.activePlayerId;
  if (draft.kind === 'PASS') {
    return { kind: 'PASS', playerId };
  }
  const player = round.players.find((entry) => entry.playerId === playerId);
  const skillId = player?.skill?.skillId ?? `SBX_SKILL_${playerId}`;
  const play: Extract<PlayInput, { kind: 'PLAY' }> = {
    kind: 'PLAY',
    playerId,
    cardIds: [...draft.cardIds],
  };
  if (draft.useSkill) {
    play.useSkill = draft.useSkill;
  }
  if (draft.useSkill === 'JOKER_TRANSFORM' && draft.jokerDeclaration) {
    play.jokerDeclarations = [
      {
        skillId,
        rankCode: draft.jokerDeclaration.rankCode,
        suitCode: draft.jokerDeclaration.suitCode,
      },
    ];
  }
  return play;
}
