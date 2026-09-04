import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { OnlineRoundSnapshotResponse } from './onlineRoundViewModel';
import { buildLegalPlaysForOnlineRound, buildRoundStateForLegalMoves } from './onlineLegalMoves';

function baseSnapshot(
  overrides: Partial<OnlineRoundSnapshotResponse> = {},
): OnlineRoundSnapshotResponse {
  return {
    ok: true,
    round_id: 'round-1',
    player_id: 'player-1',
    state_version: 4,
    latest_event_seq: 9,
    public_state: {
      state_version: 4,
      day_night: 'DAY',
      active_player_id: 'player-1',
      active_field: {},
      hand_counts: { 'player-1': 3, 'player-2': 3 },
    },
    hand: [
      { card_id: 'CARD_NUMBER_RANK_5_SUIT_FIRE', position: 0, card_state: 'IN_HAND' },
      { card_id: 'CARD_NUMBER_RANK_7_SUIT_WATER', position: 1, card_state: 'IN_HAND' },
      { card_id: 'CARD_NUMBER_RANK_9_SUIT_WIND', position: 2, card_state: 'IN_HAND' },
    ],
    skills: [],
    events: [],
    ...overrides,
  };
}

describe('buildRoundStateForLegalMoves', () => {
  it('returns null when it is not the local player’s turn', () => {
    const snapshot = baseSnapshot({
      public_state: {
        state_version: 4,
        day_night: 'DAY',
        active_player_id: 'player-2',
        active_field: {},
        hand_counts: { 'player-1': 3, 'player-2': 3 },
      },
    });
    assert.equal(buildRoundStateForLegalMoves(snapshot), null);
  });

  it('builds a RoundState with the local hand and empty opponent placeholders', () => {
    const state = buildRoundStateForLegalMoves(baseSnapshot());
    assert.ok(state);
    assert.equal(state?.activePlayerId, 'player-1');
    assert.equal(state?.dayNight, 'DAY');
    const me = state?.players.find((p) => p.playerId === 'player-1');
    const opp = state?.players.find((p) => p.playerId === 'player-2');
    assert.equal(me?.hand.length, 3);
    assert.equal(opp?.hand.length, 0);
    assert.equal(opp?.status, 'ACTIVE');
  });
});

describe('buildLegalPlaysForOnlineRound', () => {
  it('returns an empty list when it is not the local player’s turn', () => {
    const snapshot = baseSnapshot({
      public_state: {
        state_version: 4,
        day_night: 'DAY',
        active_player_id: 'player-2',
        active_field: {},
        hand_counts: { 'player-1': 3, 'player-2': 3 },
      },
    });
    assert.deepEqual(buildLegalPlaysForOnlineRound(snapshot), []);
  });

  it('enumerates a lead of any single card when the field is empty', () => {
    const plays = buildLegalPlaysForOnlineRound(baseSnapshot());
    const singleLeads = plays.filter(
      (p) => p.input.kind === 'PLAY' && p.input.cardIds.length === 1,
    );
    assert.equal(singleLeads.length, 3);
  });

  it('only allows a stronger single card as a reply to an active field', () => {
    const snapshot = baseSnapshot({
      public_state: {
        state_version: 4,
        day_night: 'DAY',
        active_player_id: 'player-1',
        active_field: {
          combination: {
            kind: 'SINGLE',
            cards: [
              {
                kind: 'NUMBER',
                cardId: 'CARD_NUMBER_RANK_6_SUIT_EARTH',
                rankCode: 'RANK_6',
                suitCode: 'SUIT_EARTH',
              },
            ],
            ranks: [6],
          },
          lastPlayerId: 'player-2',
          lock: null,
        },
        hand_counts: { 'player-1': 3, 'player-2': 2 },
      },
    });

    const plays = buildLegalPlaysForOnlineRound(snapshot);
    const playableCardIds = new Set(
      plays.flatMap((p) => (p.input.kind === 'PLAY' ? p.input.cardIds : [])),
    );
    assert.ok(playableCardIds.has('CARD_NUMBER_RANK_7_SUIT_WATER'));
    assert.ok(playableCardIds.has('CARD_NUMBER_RANK_9_SUIT_WIND'));
    assert.ok(!playableCardIds.has('CARD_NUMBER_RANK_5_SUIT_FIRE'));
    assert.ok(plays.some((p) => p.input.kind === 'PASS'));
  });
});
