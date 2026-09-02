import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig } from './matchConfig';
import { initGame, cpuStep, type DriverState } from './turnDriver';
import {
  heldSkillEffect,
  submitOptionsForSelection,
  resolveJokerTransform,
  revolutionPreview,
  legalMoveCount,
  selectionRejectionReasonKey,
  jokerPreviewCard,
} from './skillPlayOptions';
import {
  createActiveField,
  createNumberCard,
  createPlayerState,
  createRoundState,
  enumerateLegalPlays,
  INITIAL_RULESET_VERSION,
  parseNumberCombination,
  type LegalPlay,
} from '@card-game-app/game-core';

/** seat-0 (human) が指定 effectCode を未使用で持ち、かつ人間手番の局面を線形探索する。
 *  requireField: true なら場あり、false なら場なしの人間手番のみ採用。 */
function findHumanSkillState(effectCode: string, requireField = false): DriverState {
  for (let seed = 0; seed < 400; seed += 1) {
    for (const n of [2, 3, 4, 5, 6]) {
      let g = initGame({ config: buildMatchConfig(n), seed });
      const human = g.round.players.find((p) => p.playerId === 'seat-0');
      if (!(human?.skill && !human.skill.used && human.skill.effectCode === effectCode)) continue;
      let guard = 0;
      while (g.phase === 'CPU_PENDING' && guard < 200) {
        g = cpuStep(g).next;
        guard += 1;
      }
      if (g.phase !== 'HUMAN_TURN') continue;
      const hasField = g.round.activeField != null;
      if (requireField !== hasField) continue;
      return g;
    }
  }
  throw new Error(`no state found for human skill ${effectCode} (requireField=${requireField})`);
}

test('heldSkillEffect returns the human seat unused skill effect or null', () => {
  const g = findHumanSkillState('SKILL_REVOLUTION');
  assert.equal(heldSkillEffect(g), 'SKILL_REVOLUTION');
});

test('revolutionPreview flips day/night and reverses the strength order', () => {
  const g = findHumanSkillState('SKILL_REVOLUTION');
  const pv = revolutionPreview(g);
  assert.equal(pv.dayNightAfter, g.round.dayNight === 'DAY' ? 'NIGHT' : 'DAY');
  const expected =
    pv.dayNightAfter === 'DAY' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [9, 8, 7, 6, 5, 4, 3, 2, 1];
  assert.deepEqual(pv.strengthOrderAfter, expected);
});

test('legalMoveCount counts distinct card-sets across plain and skill plays', () => {
  const legal: LegalPlay[] = [
    {
      input: { kind: 'PLAY', playerId: 's', cardIds: ['a'] },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
    // Same real cardIds as the plain ['a'] play, only a skill differs -> collapses.
    {
      input: { kind: 'PLAY', playerId: 's', cardIds: ['a'], useSkill: 'REVOLUTION' },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
    {
      input: { kind: 'PLAY', playerId: 's', cardIds: ['b', 'c'] },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
    // Skill-only card-set with no plain equivalent -> must be counted.
    {
      input: { kind: 'PLAY', playerId: 's', cardIds: ['d'], useSkill: 'EXTENSION_SEAL' },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
    {
      input: { kind: 'PASS', playerId: 's' },
      actionKind: 'PASS',
      resultingCombination: null,
      goesOut: false,
    },
  ];
  // { a } (plain + REVOLUTION collapse), { b, c }, { d } (skill-only) = 3 distinct sets.
  assert.equal(legalMoveCount(legal), 3);
});

test('submitOptionsForSelection returns one option per matching skill variant', () => {
  const g = findHumanSkillState('SKILL_EXTENSION_SEAL');
  const legal = enumerateLegalPlays(g.round, { includeSkills: true });
  // 封印手が存在する最初の選択札を採用
  const sealPlay = legal.find(
    (p) => p.input.kind === 'PLAY' && p.input.useSkill === 'EXTENSION_SEAL',
  );
  assert.ok(sealPlay && sealPlay.input.kind === 'PLAY');
  const opts = submitOptionsForSelection(legal, sealPlay.input.cardIds);
  assert.ok(opts.some((o) => o.useSkill === 'EXTENSION_SEAL'));
  for (const o of opts) {
    assert.ok(['JOKER_CLEAR', 'EXTENSION_SEAL', 'REVOLUTION'].includes(o.useSkill));
    assert.equal(o.input.kind, 'PLAY');
  }
});

test('resolveJokerTransform: incomplete when the declaration is missing', () => {
  const g = findHumanSkillState('SKILL_JOKER_HERO');
  const r = resolveJokerTransform(g, [], { rankCode: null, suitCode: null });
  assert.equal(r.status, 'incomplete');
});

test('resolveJokerTransform: ok for a legal single transform lead on an empty field', () => {
  const g = findHumanSkillState('SKILL_JOKER_HERO');
  assert.equal(g.round.activeField, null);
  // 手札に無い rank/suit を宣言して単体リード（重複回避のため手札の最初のカードと違う識別子を選ぶ）
  const human = g.round.players.find((p) => p.playerId === 'seat-0')!;
  const used = new Set(human.hand.map((c) => `${c.rankCode}:${c.suitCode}`));
  let decl: { rankCode: string; suitCode: string } | null = null;
  for (const r of [
    'RANK_1',
    'RANK_2',
    'RANK_3',
    'RANK_4',
    'RANK_5',
    'RANK_6',
    'RANK_7',
    'RANK_8',
    'RANK_9',
  ]) {
    for (const s of ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH']) {
      if (!used.has(`${r}:${s}`)) {
        decl = { rankCode: r, suitCode: s };
        break;
      }
    }
    if (decl) break;
  }
  assert.ok(decl);
  const r = resolveJokerTransform(g, [], decl as never);
  assert.equal(r.status, 'ok');
  assert.equal(r.status === 'ok' && r.input.kind, 'PLAY');
  assert.equal(r.status === 'ok' && r.input.kind === 'PLAY' && r.input.useSkill, 'JOKER_TRANSFORM');
});

test('resolveJokerTransform: forbidden-go-out when the transform would empty the hand', () => {
  // 局面探索では手札1枚+変化Jokerの上がり局面をヒットできないため、ブリーフの許可に従い
  // createRoundState / createPlayerState で DriverState を直接構築する。
  // seat-0: 手札1枚 (RANK_3/FIRE) + 未使用の変化Jokerスキル。
  // 宣言 RANK_3/WATER → 実1枚 + 宣言1枚の RANK_SET を場が空でリード
  //   → 実カード残り0枚 かつ変化Joker含む = TRANSFORM_JOKER_GO_OUT (forbidden-go-out)。
  const round = createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: 'DAY',
    players: [
      createPlayerState('seat-0', [createNumberCard('h0', 'RANK_3', 'SUIT_FIRE')], {
        skillId: 'sk-0',
        effectCode: 'SKILL_JOKER_HERO',
        used: false,
      }),
      createPlayerState('seat-1', [
        createNumberCard('h1a', 'RANK_5', 'SUIT_WATER'),
        createNumberCard('h1b', 'RANK_6', 'SUIT_WATER'),
      ]),
    ],
    activePlayerId: 'seat-0',
  });
  const g: DriverState = {
    config: buildMatchConfig(2),
    seed: 0,
    rematchIndex: 0,
    baselineFirstSeatId: 'seat-0',
    round,
    phase: 'HUMAN_TURN',
    turnLog: [],
    publicEvents: [],
    winnerSeatId: null,
  };
  const r = resolveJokerTransform(g, ['h0'], {
    rankCode: 'RANK_3' as never,
    suitCode: 'SUIT_WATER' as never,
  });
  assert.equal(r.status, 'forbidden-go-out');
});

test('resolveJokerTransform: illegal when the declared identity duplicates a real card', () => {
  // seat-0: 手札 RANK_5/FIRE + RANK_7/WATER（生きた局面にするための予備札）+ 未使用の変化Joker。
  // 選択 [RANK_5/FIRE] を宣言 RANK_5/FIRE で出す → 実カードと宣言が完全重複
  //   → evaluateJokerTransformPlay が DUPLICATE_JOKER_DECLARATION で棄却（illegal）。
  const round = createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: 'DAY',
    players: [
      createPlayerState(
        'seat-0',
        [
          createNumberCard('h0', 'RANK_5', 'SUIT_FIRE'),
          createNumberCard('h1', 'RANK_7', 'SUIT_WATER'),
        ],
        { skillId: 'sk-0', effectCode: 'SKILL_JOKER_HERO', used: false },
      ),
      createPlayerState('seat-1', [
        createNumberCard('s1a', 'RANK_5', 'SUIT_WATER'),
        createNumberCard('s1b', 'RANK_6', 'SUIT_WATER'),
      ]),
    ],
    activePlayerId: 'seat-0',
  });
  const g: DriverState = {
    config: buildMatchConfig(2),
    seed: 0,
    rematchIndex: 0,
    baselineFirstSeatId: 'seat-0',
    round,
    phase: 'HUMAN_TURN',
    turnLog: [],
    publicEvents: [],
    winnerSeatId: null,
  };
  const r = resolveJokerTransform(g, ['h0'], { rankCode: 'RANK_5', suitCode: 'SUIT_FIRE' });
  assert.equal(r.status, 'illegal');
  assert.equal(
    r.status === 'illegal' && r.rejectionReasonKey,
    'sandbox.reason.DUPLICATE_JOKER_DECLARATION',
  );
});

test('selectionRejectionReasonKey: null for an empty selection and for a legal selection', () => {
  const g = findHumanSkillState('SKILL_REVOLUTION');
  const legal = enumerateLegalPlays(g.round, { includeSkills: true });
  assert.equal(selectionRejectionReasonKey(g, [], legal), null);
  const somePlain = legal.find((p) => p.input.kind === 'PLAY' && p.input.useSkill === undefined);
  assert.ok(somePlain && somePlain.input.kind === 'PLAY');
  assert.equal(selectionRejectionReasonKey(g, somePlain.input.cardIds, legal), null);
});

test('selectionRejectionReasonKey: a sandbox.reason.* key for a guaranteed-illegal selection', () => {
  // 局面探索だと「任意の2枚」が合法手に一致してしまい分岐が検証されないため、
  // DriverState を直接構築して確実に非合法な選択を作る（M3-EX-07 の本命分岐）。
  // 場: seat-1 がリードした SINGLE RANK_8/EARTH。DAY なので強さ 8。
  // seat-0 が単体 RANK_2/FIRE (強さ 2) を選択 → NOT_STRONGER で棄却。
  const fieldCombo = parseNumberCombination([createNumberCard('f8', 'RANK_8', 'SUIT_EARTH')])!;
  const round = createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: 'DAY',
    players: [
      createPlayerState('seat-0', [
        createNumberCard('w2', 'RANK_2', 'SUIT_FIRE'),
        createNumberCard('w3', 'RANK_3', 'SUIT_FIRE'),
      ]),
      createPlayerState('seat-1', [createNumberCard('s9', 'RANK_9', 'SUIT_WATER')]),
    ],
    activePlayerId: 'seat-0',
    activeField: createActiveField(fieldCombo, 'seat-1'),
  });
  const g: DriverState = {
    config: buildMatchConfig(2),
    seed: 0,
    rematchIndex: 0,
    baselineFirstSeatId: 'seat-0',
    round,
    phase: 'HUMAN_TURN',
    turnLog: [],
    publicEvents: [],
    winnerSeatId: null,
  };
  const legal = enumerateLegalPlays(g.round, { includeSkills: true });
  const key = selectionRejectionReasonKey(g, ['w2'], legal);
  assert.ok(key !== null, 'expected a rejection reason for an illegal selection');
  assert.match(key, /^sandbox\.reason\./);
  assert.equal(key, 'sandbox.reason.NOT_STRONGER');
});

test('jokerPreviewCard maps a complete draft and returns null for an incomplete one', () => {
  assert.deepEqual(jokerPreviewCard({ rankCode: 'RANK_3', suitCode: 'SUIT_FIRE' }), {
    rank: 3,
    suitCode: 'SUIT_FIRE',
  });
  assert.equal(jokerPreviewCard({ rankCode: null, suitCode: 'SUIT_FIRE' }), null);
  assert.equal(jokerPreviewCard({ rankCode: 'RANK_3', suitCode: null }), null);
});
