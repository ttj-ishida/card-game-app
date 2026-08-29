import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
  parseNumberCombination,
  type DayNight,
  type NumberCard,
  type RankCode,
  type RoundState,
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
