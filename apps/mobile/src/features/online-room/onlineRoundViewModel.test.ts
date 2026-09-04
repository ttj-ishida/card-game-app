import assert from 'node:assert/strict';
import test from 'node:test';

import type { OnlineRoundSnapshotResponse } from './onlineRoundViewModel';
import {
  buildOnlineRoundViewModel,
  parseNumberCardId,
  parseSkillEffectFromId,
} from './onlineRoundViewModel';

const baseSnapshot: OnlineRoundSnapshotResponse = {
  ok: true,
  round_id: 'round-1',
  player_id: 'player-a',
  state_version: 2,
  latest_event_seq: 3,
  public_state: {
    state_version: 2,
    day_night: 'NIGHT',
    active_player_id: 'player-a',
    active_field: {
      combination: {
        kind: 'RANK_SET',
        cards: [
          {
            kind: 'NUMBER',
            cardId: 'CARD_NUMBER_RANK_5_SUIT_FIRE',
            rankCode: 'RANK_5',
            suitCode: 'SUIT_FIRE',
          },
          {
            kind: 'NUMBER',
            cardId: 'CARD_NUMBER_RANK_5_SUIT_WATER',
            rankCode: 'RANK_5',
            suitCode: 'SUIT_WATER',
          },
        ],
        ranks: [5],
      },
      lastPlayerId: 'player-b',
      lock: { countLocked: true, suitFixed: ['SUIT_FIRE', 'SUIT_WATER'], suitUniform: false },
    },
    hand_counts: { 'player-a': 2, 'player-b': 6, 'seat-2': 6 },
  },
  hand: [
    { card_id: 'CARD_NUMBER_RANK_9_SUIT_EARTH', position: 2, card_state: 'IN_HAND' },
    { card_id: 'CARD_NUMBER_RANK_1_SUIT_FIRE', position: 1, card_state: 'IN_HAND' },
  ],
  skills: [{ skill_id: 'SKILL_CARD_REVOLUTION', used: false, consumed_at: null }],
  events: [
    {
      event_seq: 3,
      state_version: 2,
      event_kind: 'PLAY_ACCEPTED',
      actor_player_id: 'player-b',
      public_payload: {
        kind: 'PLAY',
        action_kind: 'REPLACE',
        cards: [{ rank_code: 'RANK_5', suit_code: 'SUIT_FIRE' }],
        skill_effect: 'REVOLUTION',
        field_cleared: false,
        day_night_after: 'NIGHT',
      },
      created_at: '2026-09-04T00:00:00Z',
    },
  ],
};

test('parseNumberCardId derives rank and suit from stable seed card ids', () => {
  assert.deepEqual(parseNumberCardId('CARD_NUMBER_RANK_7_SUIT_WIND'), {
    kind: 'NUMBER',
    cardId: 'CARD_NUMBER_RANK_7_SUIT_WIND',
    rankCode: 'RANK_7',
    suitCode: 'SUIT_WIND',
  });
  assert.equal(parseNumberCardId('custom-card'), null);
});

test('parseSkillEffectFromId maps seed skill cards to rule effect codes', () => {
  assert.equal(parseSkillEffectFromId('SKILL_CARD_JOKER_HERO'), 'SKILL_JOKER_HERO');
  assert.equal(parseSkillEffectFromId('SKILL_CARD_REVOLUTION'), 'SKILL_REVOLUTION');
  assert.equal(parseSkillEffectFromId('unknown'), null);
});

test('buildOnlineRoundViewModel converts snapshot state into display-safe online state', () => {
  const vm = buildOnlineRoundViewModel(baseSnapshot);

  assert.equal(vm.roundId, 'round-1');
  assert.equal(vm.stateVersion, 2);
  assert.equal(vm.dayNight, 'NIGHT');
  assert.equal(vm.isMyTurn, true);

  assert.deepEqual(
    vm.hand.map((card) => [card.cardId, card.rank, card.suitCode, card.selectable]),
    [
      ['CARD_NUMBER_RANK_1_SUIT_FIRE', 1, 'SUIT_FIRE', true],
      ['CARD_NUMBER_RANK_9_SUIT_EARTH', 9, 'SUIT_EARTH', true],
    ],
  );

  assert.deepEqual(vm.field, {
    kind: 'RANK_SET',
    lastPlayerId: 'player-b',
    cards: [
      { rank: 5, suitCode: 'SUIT_FIRE', isJoker: false },
      { rank: 5, suitCode: 'SUIT_WATER', isJoker: false },
    ],
  });
  assert.deepEqual(vm.lock, {
    countLocked: true,
    suitFixed: ['SUIT_FIRE', 'SUIT_WATER'],
    suitUniform: false,
  });
  assert.deepEqual(vm.skills, [
    { skillId: 'SKILL_CARD_REVOLUTION', effectCode: 'SKILL_REVOLUTION', used: false },
  ]);
  assert.deepEqual(vm.opponents, [
    { playerId: 'player-b', numberCardCount: 6, isActive: false },
    { playerId: 'seat-2', numberCardCount: 6, isActive: false },
  ]);
  assert.equal(vm.events[0].actionKind, 'REPLACE');
  assert.equal(vm.events[0].skillEffect, 'REVOLUTION');
  assert.deepEqual(vm.events[0].cards, [{ rankCode: 'RANK_5', suitCode: 'SUIT_FIRE' }]);
});

test('buildOnlineRoundViewModel treats empty active_field as no field and unlocked state', () => {
  const vm = buildOnlineRoundViewModel({
    ...baseSnapshot,
    public_state: {
      ...baseSnapshot.public_state,
      active_field: {},
      hand_counts: { '0': 18, '1': 18 },
    },
  });

  assert.equal(vm.field, null);
  assert.deepEqual(vm.lock, { countLocked: false, suitFixed: null, suitUniform: false });
  assert.deepEqual(
    vm.opponents.map((opponent) => opponent.playerId),
    ['0', '1'],
  );
});
