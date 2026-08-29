import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
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
