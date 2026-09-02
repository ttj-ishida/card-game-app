import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig } from './matchConfig';
import { initGame, cpuStep, isHumanTurn, legalPlaysForHuman, type DriverState } from './turnDriver';
import type { LegalPlay } from '@card-game-app/game-core';
import {
  canSelectCard,
  toggleCard,
  canSubmit,
  canSubmitPlain,
  toPlayInput,
  canPass,
  type HandSelection,
} from './handSelection';

// Helper to get a game state with human turn and some legal plays
function getHumanTurnState(n: number = 2, seed: number = 42): DriverState {
  let state = initGame({ config: buildMatchConfig(n), seed });
  // Advance until it's the human's turn
  while (!isHumanTurn(state)) {
    state = cpuStep(state).next;
  }
  return state;
}

test('canSelectCard: already-selected card can be toggled (returns true)', () => {
  const state = getHumanTurnState();
  const legalPlays = legalPlaysForHuman(state);
  assert.ok(legalPlays.length > 0, 'should have legal plays');

  // Build a selection from the first legal play
  const firstPlay = legalPlays[0];
  let selection: HandSelection = [];
  if (firstPlay.input.kind === 'PLAY') {
    selection = firstPlay.input.cardIds.slice(0, 1); // select first card
    assert.ok(
      canSelectCard(selection, selection[0], legalPlays),
      'already-selected card should return true (can toggle off)',
    );
  }
});

test('canSelectCard: card can be selected if adding it keeps selection as subset of some legal play', () => {
  const state = getHumanTurnState();
  const legalPlays = legalPlaysForHuman(state);
  assert.ok(legalPlays.length > 0);

  const firstPlay = legalPlays[0];
  if (firstPlay.input.kind === 'PLAY' && firstPlay.input.cardIds.length >= 2) {
    const selection: HandSelection = [firstPlay.input.cardIds[0]];
    const secondCard = firstPlay.input.cardIds[1];
    assert.ok(
      canSelectCard(selection, secondCard, legalPlays),
      'adding a card that keeps selection as subset should be selectable',
    );
  }
});

test('canSelectCard: card cannot be selected if adding it breaks all subsets (no matching legal play)', () => {
  const state = getHumanTurnState(3, 999); // Different seed for variety

  // Build a legal play with some cards
  const legalPlays = legalPlaysForHuman(state);
  if (
    legalPlays.length >= 2 &&
    legalPlays[0].input.kind === 'PLAY' &&
    legalPlays[1].input.kind === 'PLAY'
  ) {
    const play1Cards = new Set(legalPlays[0].input.cardIds);
    const play2Cards = new Set(legalPlays[1].input.cardIds);

    // Find a card in play1 but not in play2, and vice versa
    const onlyInPlay1 = Array.from(play1Cards).find((c) => !play2Cards.has(c));
    const onlyInPlay2 = Array.from(play2Cards).find((c) => !play1Cards.has(c));

    if (onlyInPlay1 && onlyInPlay2) {
      // Start with a card from play2, try to add card from play1 only
      // If there's no legal play containing both, it should be unselectable
      const selection: HandSelection = [onlyInPlay2];
      const shouldBeUnselectable = onlyInPlay1;

      // Check if this would actually be unselectable by verifying no legal play contains both
      const anyPlayContainsBoth = legalPlays.some((p) => {
        if (p.input.kind !== 'PLAY') return false;
        const set = new Set(p.input.cardIds);
        return set.has(selection[0]) && set.has(shouldBeUnselectable);
      });

      if (!anyPlayContainsBoth) {
        assert.equal(
          canSelectCard(selection, shouldBeUnselectable, legalPlays),
          false,
          'card that breaks all subsets should not be selectable',
        );
      }
    }
  }
});

test('toggleCard: removes card if already selected', () => {
  const state = getHumanTurnState();
  const legalPlays = legalPlaysForHuman(state);
  const firstPlay = legalPlays[0];

  if (firstPlay.input.kind === 'PLAY') {
    const cardId = firstPlay.input.cardIds[0];
    const selection: HandSelection = [cardId];

    const result = toggleCard(selection, cardId, legalPlays);
    assert.deepEqual(result, [], 'toggling off should remove the card');
  }
});

test('toggleCard: adds card if it can be selected', () => {
  const state = getHumanTurnState();
  const legalPlays = legalPlaysForHuman(state);
  const firstPlay = legalPlays[0];

  if (firstPlay.input.kind === 'PLAY' && firstPlay.input.cardIds.length >= 2) {
    const selection: HandSelection = [firstPlay.input.cardIds[0]];
    const cardToAdd = firstPlay.input.cardIds[1];

    const result = toggleCard(selection, cardToAdd, legalPlays);
    assert.ok(result.includes(cardToAdd), 'should add the card');
    assert.ok(result.includes(selection[0]), 'should keep the original card');
  }
});

test('toggleCard: returns unchanged if card cannot be added', () => {
  const state = getHumanTurnState(3, 777);
  const legalPlays = legalPlaysForHuman(state);

  // Find an unselectable scenario
  if (
    legalPlays.length >= 2 &&
    legalPlays[0].input.kind === 'PLAY' &&
    legalPlays[1].input.kind === 'PLAY'
  ) {
    const play1Cards = new Set(legalPlays[0].input.cardIds);
    const play2Cards = new Set(legalPlays[1].input.cardIds);

    const onlyInPlay1 = Array.from(play1Cards).find((c) => !play2Cards.has(c));
    const onlyInPlay2 = Array.from(play2Cards).find((c) => !play1Cards.has(c));

    if (onlyInPlay1 && onlyInPlay2) {
      const selection: HandSelection = [onlyInPlay2];

      const anyPlayContainsBoth = legalPlays.some((p) => {
        if (p.input.kind !== 'PLAY') return false;
        const set = new Set(p.input.cardIds);
        return set.has(selection[0]) && set.has(onlyInPlay1);
      });

      if (!anyPlayContainsBoth) {
        const result = toggleCard(selection, onlyInPlay1, legalPlays);
        assert.deepEqual(result, selection, 'should return unchanged when card cannot be added');
      }
    }
  }
});

test('canSubmit: returns false for empty selection', () => {
  const state = getHumanTurnState();
  const legalPlays = legalPlaysForHuman(state);
  const selection: HandSelection = [];

  assert.equal(canSubmit(selection, legalPlays), false, 'empty selection cannot be submitted');
});

test('canSubmit: returns true only when selection exactly matches a legal play', () => {
  const state = getHumanTurnState();
  const legalPlays = legalPlaysForHuman(state);
  const firstPlay = legalPlays[0];

  if (firstPlay.input.kind === 'PLAY') {
    const exactSelection: HandSelection = [...firstPlay.input.cardIds];
    assert.equal(canSubmit(exactSelection, legalPlays), true, 'exact match should be submittable');
  }
});

test('canSubmit: returns false for subset that is not exact match', () => {
  const state = getHumanTurnState();
  const legalPlays = legalPlaysForHuman(state);
  const firstPlay = legalPlays[0];

  if (firstPlay.input.kind === 'PLAY' && firstPlay.input.cardIds.length >= 2) {
    const subsetSelection: HandSelection = [firstPlay.input.cardIds[0]]; // only first card
    assert.equal(
      canSubmit(subsetSelection, legalPlays),
      false,
      'subset that is not exact match should not be submittable',
    );
  }
});

test('toPlayInput: converts selection and playerId to PlayInput', () => {
  const selection: HandSelection = ['card-1', 'card-2'];
  const playerId = 'seat-0';

  const result = toPlayInput(selection, playerId);
  assert.deepEqual(result, {
    kind: 'PLAY',
    playerId: 'seat-0',
    cardIds: ['card-1', 'card-2'],
  });
});

test('canPass: returns true if PASS exists in legal plays', () => {
  // Find a state where a PASS is legal
  let state = initGame({ config: buildMatchConfig(2), seed: 42 });
  let found = false;

  for (let i = 0; i < 100; i++) {
    if (isHumanTurn(state)) {
      const legalPlays = legalPlaysForHuman(state);
      const hasPass = legalPlays.some((p) => p.input.kind === 'PASS');
      if (hasPass) {
        assert.equal(canPass(legalPlays), true, 'should return true when PASS is legal');
        found = true;
        break;
      }
    }
    state = cpuStep(state).next;
  }

  if (!found) {
    // If we couldn't find a pass scenario in 100 steps, just skip this detailed check
    // but we can still test with an explicit legal play list
    const explicitPass: LegalPlay[] = [
      {
        input: { kind: 'PASS', playerId: 'seat-0' },
        actionKind: 'PASS',
        resultingCombination: null,
        goesOut: false,
      },
    ];
    assert.equal(canPass(explicitPass), true);
  }
});

test('canPass: returns false if no PASS in legal plays', () => {
  const noPassPlays: LegalPlay[] = [
    {
      input: { kind: 'PLAY', playerId: 'seat-0', cardIds: ['card-1'] },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
  ];
  assert.equal(canPass(noPassPlays), false, 'should return false when no PASS is legal');
});

test('canSubmitPlain: true only for an exact match against a non-skill play', () => {
  const noSkill: LegalPlay[] = [
    {
      input: { kind: 'PLAY', playerId: 'seat-0', cardIds: ['a', 'b'] },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
  ];
  assert.equal(canSubmitPlain(['a', 'b'], noSkill), true);
  assert.equal(canSubmitPlain(['a'], noSkill), false);
  assert.equal(canSubmitPlain([], noSkill), false);
});

test('canSubmitPlain: ignores skill plays even on an exact cardIds match', () => {
  const skillOnly: LegalPlay[] = [
    {
      input: { kind: 'PLAY', playerId: 'seat-0', cardIds: ['a'], useSkill: 'EXTENSION_SEAL' },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
  ];
  assert.equal(canSubmitPlain(['a'], skillOnly), false);
});
