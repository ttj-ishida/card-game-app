import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig } from './matchConfig';
import {
  activeSeatId,
  cpuStep,
  humanPlay,
  initGame,
  isHumanTurn,
  legalPlaysForHuman,
  type DriverState,
} from './turnDriver';
import { buildBoardViewModel } from './boardViewModel';

const start = (n: number, seed = n * 1000 + 1): DriverState =>
  initGame({ config: buildMatchConfig(n), seed });

/** 人間手番は最初の合法手、CPU手番は cpuStep。指定手数だけ進める。 */
function advance(s: DriverState, steps: number): DriverState {
  let cur = s;
  for (let i = 0; i < steps && cur.phase !== 'ROUND_OVER'; i += 1) {
    if (isHumanTurn(cur)) {
      const res = humanPlay(cur, legalPlaysForHuman(cur)[0].input);
      if (!res.ok) throw new Error(`human illegal: ${res.reason}`);
      cur = res.next;
    } else {
      cur = cpuStep(cur).next;
    }
  }
  return cur;
}

/** CPU手番を消化して最初の人間手番まで進める。 */
function toHumanTurn(s: DriverState): DriverState {
  let cur = s;
  let guard = 0;
  while (cur.phase === 'CPU_PENDING') {
    if (++guard > 200) throw new Error('never reached a human turn');
    cur = cpuStep(cur).next;
  }
  return cur;
}

function playToEnd(s: DriverState): DriverState {
  let cur = s;
  let guard = 0;
  while (cur.phase !== 'ROUND_OVER') {
    if (++guard > 500) throw new Error('no progress');
    cur = advance(cur, 1);
  }
  return cur;
}

test('M2-QA-03: a 2-player deal yields an 18-card hand, a 6-player deal yields 6', () => {
  const vm2 = buildBoardViewModel(start(2), [], []);
  assert.equal(vm2.hand.length, 18);
  const vm6 = buildBoardViewModel(start(6), [], []);
  assert.equal(vm6.hand.length, 6);
});

test('every HandCardView carries the full shape', () => {
  const vm = buildBoardViewModel(start(2), [], []);
  for (const c of vm.hand) {
    assert.equal(typeof c.cardId, 'string');
    assert.equal(typeof c.rank, 'number');
    assert.equal(typeof c.suitCode, 'string');
    assert.equal(typeof c.isJoker, 'boolean');
    assert.equal(typeof c.selected, 'boolean');
    assert.equal(typeof c.selectable, 'boolean');
  }
});

test('every FieldCardView and HandCardView carries { rank, suitCode, isJoker }', () => {
  const s = advance(start(2, 2001), 1); // seat-0 leads -> field is set
  const vm = buildBoardViewModel(s, [], legalPlaysForHuman(s));
  assert.ok(vm.field);
  for (const c of vm.field!.cards) {
    assert.equal(typeof c.rank, 'number');
    assert.equal(typeof c.suitCode, 'string');
    assert.equal(typeof c.isJoker, 'boolean');
  }
  for (const c of vm.hand) {
    assert.equal(typeof c.rank, 'number');
    assert.equal(typeof c.suitCode, 'string');
    assert.equal(typeof c.isJoker, 'boolean');
  }
});

test('hand is sorted ascending by (rank, suit order)', () => {
  const suitOrder = ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH'];
  const vm = buildBoardViewModel(start(3, 777), [], []);
  for (let i = 1; i < vm.hand.length; i += 1) {
    const prev = vm.hand[i - 1];
    const cur = vm.hand[i];
    const key = (c: (typeof vm.hand)[number]) => c.rank * 10 + suitOrder.indexOf(c.suitCode);
    assert.ok(key(prev) <= key(cur), `not sorted at ${i}`);
  }
});

test('field is null before any lead, populated after', () => {
  const s0 = start(2, 2001);
  assert.equal(buildBoardViewModel(s0, [], []).field, null);
  const s1 = advance(s0, 1);
  const vm = buildBoardViewModel(s1, [], []);
  assert.ok(vm.field);
  assert.ok(['SINGLE', 'RANK_SET', 'SEQUENCE'].includes(vm.field!.kind));
  assert.ok(vm.field!.cards.length >= 1);
  assert.equal(typeof vm.field!.lastPlayerNameKey, 'string');
});

test('strengthOrder is [1..9] by day', () => {
  const vm = buildBoardViewModel(start(2), [], []);
  assert.equal(vm.dayNight, 'DAY');
  assert.deepEqual(vm.strengthOrder, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('strengthOrder is [9..1] at night', () => {
  const s = start(2);
  const night: DriverState = { ...s, round: { ...s.round, dayNight: 'NIGHT' } };
  const vm = buildBoardViewModel(night, [], []);
  assert.equal(vm.dayNight, 'NIGHT');
  assert.deepEqual(vm.strengthOrder, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test('opponents exclude the human seat, follow seat order, and mirror round.players', () => {
  const s = start(5, 505);
  const vm = buildBoardViewModel(s, [], []);
  assert.deepEqual(
    vm.opponents.map((o) => o.seatId),
    ['seat-1', 'seat-2', 'seat-3', 'seat-4'],
  );
  for (const o of vm.opponents) {
    const player = s.round.players.find((p) => p.playerId === o.seatId)!;
    assert.equal(o.numberCardCount, player.hand.length);
    assert.equal(o.status, player.status);
    assert.equal(o.isActive, o.seatId === s.round.activePlayerId);
    assert.equal(o.hasSkill, player.skill != null && !player.skill.used);
  }
});

test('isActive is true for the opponent holding the turn', () => {
  let s = start(3, 99);
  while (isHumanTurn(s)) {
    const res = humanPlay(s, legalPlaysForHuman(s)[0].input);
    if (!res.ok) throw new Error(res.reason);
    s = res.next;
  }
  assert.equal(s.phase, 'CPU_PENDING');
  const vm = buildBoardViewModel(s, [], []);
  const active = vm.opponents.filter((o) => o.isActive);
  assert.equal(active.length, 1);
  assert.equal(active[0].seatId, activeSeatId(s));
});

test('activeSeatNameKey is the name key of the seat holding the turn', () => {
  const s = start(2, 2001);
  const vm = buildBoardViewModel(s, [], []);
  const seat = s.config.seats.find((x) => x.seatId === s.round.activePlayerId)!;
  assert.equal(vm.activeSeatNameKey, seat.nameKey);
});

test('lock and extensionSealed are separate fields', () => {
  const s = advance(start(2, 2001), 1);
  const vm = buildBoardViewModel(s, [], []);
  assert.ok('countLocked' in vm.lock);
  assert.ok('suitFixed' in vm.lock);
  assert.ok('suitUniform' in vm.lock);
  assert.equal(typeof vm.extensionSealed, 'boolean');
  assert.ok(!('extensionSealed' in vm.lock));
});

test('lock defaults to fully unlocked when there is no field', () => {
  const vm = buildBoardViewModel(start(2), [], []);
  assert.deepEqual(vm.lock, { countLocked: false, suitFixed: null, suitUniform: false });
});

test('selected / selectable reflect the current selection and legal plays', () => {
  const s = toHumanTurn(start(2, 2001));
  assert.equal(s.phase, 'HUMAN_TURN');
  const legal = legalPlaysForHuman(s);
  const somePlay = legal.find((p) => p.input.kind === 'PLAY');
  assert.ok(somePlay && somePlay.input.kind === 'PLAY');
  const ids = somePlay.input.cardIds;
  const cardId = ids[0];

  const none = buildBoardViewModel(s, [], legal);
  assert.equal(none.hand.find((c) => c.cardId === cardId)?.selected, false);
  assert.equal(none.hand.find((c) => c.cardId === cardId)?.selectable, true);
  // その合法手に含まれない手札で、選択0のとき selectable は最初の合法プレフィックスに乗るかどうか
  const withSel = buildBoardViewModel(s, [cardId], legal);
  const picked = withSel.hand.find((c) => c.cardId === cardId)!;
  assert.equal(picked.selected, true);
  assert.equal(picked.selectable, true);

  // 完全一致の選択なら canSubmit
  assert.equal(buildBoardViewModel(s, ids, legal).canSubmit, true);
});

test('canPass is false when the field is empty (lead turn)', () => {
  const s = toHumanTurn(start(2, 2001));
  const legal = legalPlaysForHuman(s);
  const vm = buildBoardViewModel(s, [], legal);
  // 場が空でリードなら canPass false、場があれば PASS 合法手の有無に一致
  assert.equal(
    vm.canPass,
    legal.some((p) => p.input.kind === 'PASS'),
  );
  assert.equal(buildBoardViewModel(s, [], legal).canSubmit, false);
});

test('cpuThinking defaults to false and echoes the opt', () => {
  const s = start(2);
  assert.equal(buildBoardViewModel(s, [], []).cpuThinking, false);
  assert.equal(buildBoardViewModel(s, [], [], { cpuThinking: true }).cpuThinking, true);
});

test('humanSkillNameKey reuses the existing sandbox.skill.* key or is null', () => {
  const s = start(2);
  const vm = buildBoardViewModel(s, [], []);
  const human = s.round.players.find((p) => p.playerId === 'seat-0')!;
  if (human.skill) {
    assert.equal(vm.humanSkillNameKey, `sandbox.skill.${human.skill.effectCode}`);
  } else {
    assert.equal(vm.humanSkillNameKey, null);
  }
});

test('phase / winner fields pass through from the driver state', () => {
  const end = playToEnd(start(2, 2001));
  const vm = buildBoardViewModel(end, [], []);
  assert.equal(vm.phase, 'ROUND_OVER');
  assert.equal(vm.winnerSeatId, end.winnerSeatId);
  const winnerSeat = end.config.seats.find((x) => x.seatId === end.winnerSeatId)!;
  assert.equal(vm.winnerNameKey, winnerSeat.nameKey);
});

test('does not mutate its inputs', () => {
  const s = advance(start(4, 404), 3);
  const selection = ['x'];
  const legal = legalPlaysForHuman(s);
  const snapS = JSON.stringify(s);
  const snapLegal = JSON.stringify(legal);
  buildBoardViewModel(s, selection, legal);
  assert.equal(JSON.stringify(s), snapS);
  assert.equal(JSON.stringify(legal), snapLegal);
  assert.deepEqual(selection, ['x']);
});

// M2-QA-03 の構造検証: 全人数で hand が人間席の配布と一致、cardId は重複なし、合計36枚。
for (const n of [2, 3, 4, 5, 6]) {
  test(`M2-QA-03: ${n}-player deal -> human hand matches round.players, deck totals 36`, () => {
    const s = start(n);
    const vm = buildBoardViewModel(s, [], []);
    const human = s.round.players.find((p) => p.playerId === 'seat-0')!;
    assert.equal(vm.hand.length, human.hand.length);
    assert.equal(new Set(vm.hand.map((c) => c.cardId)).size, vm.hand.length);
    assert.deepEqual(
      new Set(vm.hand.map((c) => c.cardId)),
      new Set(human.hand.map((c) => c.cardId)),
    );
    const total = s.round.players.reduce((sum, p) => sum + p.hand.length, 0);
    assert.equal(total, 36);
  });
}

test('M2-QA-03: hand shows exactly 18 cards for a 2-player deal and 6 for a 6-player deal', () => {
  assert.equal(buildBoardViewModel(start(2), [], []).hand.length, 18);
  assert.equal(buildBoardViewModel(start(6), [], []).hand.length, 6);
});
