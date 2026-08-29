import {
  INITIAL_RULESET_VERSION,
  createPlayerState,
  createRoundState,
  parseNumberCombination,
  type ActiveField,
  type NumberCard,
  type RoundState,
  type SkillEffectCode,
} from '@card-game-app/game-core';

import { makeSandboxCard, type PlayDraft } from './sandboxModel';

export type SandboxPreset = {
  id: string;
  titleKey: string;
  round: RoundState;
  play: PlayDraft;
};

type Suit = 'FIRE' | 'WATER' | 'WIND' | 'EARTH';

const card = (rank: number, suit: Suit): NumberCard =>
  makeSandboxCard(`RANK_${rank}` as never, `SUIT_${suit}` as never);

const field = (cards: NumberCard[], lastPlayerId: string): ActiveField => {
  const combination = parseNumberCombination(cards);
  if (!combination) throw new Error('preset field is not a valid combination');
  return { combination, lastPlayerId };
};

function round(input: {
  dayNight?: 'DAY' | 'NIGHT';
  hands: NumberCard[][];
  skills?: (SkillEffectCode | null)[];
  activePlayerId?: string;
  activeField?: ActiveField | null;
  lockedSuitCode?: 'SUIT_FIRE' | 'SUIT_WATER' | 'SUIT_WIND' | 'SUIT_EARTH' | null;
  extensionSealed?: boolean;
  consecutivePasses?: number;
}): RoundState {
  const players = input.hands.map((hand, index) => {
    const effect = input.skills?.[index] ?? null;
    return createPlayerState(
      `P${index + 1}`,
      hand,
      effect ? { skillId: `SBX_SKILL_P${index + 1}`, effectCode: effect, used: false } : null,
    );
  });
  return createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: input.dayNight ?? 'DAY',
    players,
    activePlayerId: input.activePlayerId ?? 'P1',
    activeField: input.activeField ?? null,
    lockedSuitCode: input.lockedSuitCode ?? null,
    extensionSealed: input.extensionSealed ?? false,
    consecutivePasses: input.consecutivePasses ?? 0,
  });
}

const ids = (...cards: NumberCard[]): string[] => cards.map((entry) => entry.cardId);

export const SANDBOX_PRESETS: readonly SandboxPreset[] = [
  {
    id: 'replace-stronger',
    titleKey: 'sandbox.preset.replace-stronger',
    round: round({
      hands: [[card(7, 'FIRE'), card(7, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      activeField: field([card(6, 'FIRE'), card(6, 'WATER')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(7, 'FIRE'), card(7, 'WATER')) },
  },
  {
    id: 'night-weaker-wins',
    titleKey: 'sandbox.preset.night-weaker-wins',
    round: round({
      dayNight: 'NIGHT',
      hands: [[card(5, 'FIRE'), card(5, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      activeField: field([card(6, 'FIRE'), card(6, 'WATER')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(5, 'FIRE'), card(5, 'WATER')) },
  },
  {
    id: 'extend-to-666',
    titleKey: 'sandbox.preset.extend-to-666',
    round: round({
      hands: [[card(6, 'WATER'), card(6, 'WIND'), card(9, 'EARTH')], [card(1, 'FIRE')]],
      activeField: field([card(6, 'FIRE')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(6, 'WATER'), card(6, 'WIND')) },
  },
  {
    id: 'sequence-natural-revolution',
    titleKey: 'sandbox.preset.sequence-natural-revolution',
    round: round({
      hands: [[card(5, 'FIRE'), card(6, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      activeField: field([card(2, 'FIRE'), card(3, 'WATER'), card(4, 'WIND')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(5, 'FIRE'), card(6, 'WATER')) },
  },
  {
    id: 'suit-lock',
    titleKey: 'sandbox.preset.suit-lock',
    round: round({
      hands: [[card(3, 'FIRE'), card(4, 'FIRE'), card(9, 'WATER')], [card(1, 'WIND')]],
      skills: ['SKILL_JOKER_HERO', null],
    }),
    play: {
      kind: 'PLAY',
      cardIds: ids(card(3, 'FIRE'), card(4, 'FIRE')),
      useSkill: 'JOKER_TRANSFORM',
      jokerDeclaration: { rankCode: 'RANK_5', suitCode: 'SUIT_FIRE' },
    },
  },
  {
    id: 'extension-sealed',
    titleKey: 'sandbox.preset.extension-sealed',
    round: round({
      hands: [[card(6, 'WIND'), card(9, 'EARTH')], [card(1, 'FIRE')]],
      activeField: field([card(6, 'FIRE'), card(6, 'WATER')], 'P2'),
      extensionSealed: true,
    }),
    play: { kind: 'PLAY', cardIds: ids(card(6, 'WIND')) },
  },
  {
    id: 'revolution-card',
    titleKey: 'sandbox.preset.revolution-card',
    round: round({
      hands: [[card(6, 'FIRE'), card(6, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      skills: ['SKILL_REVOLUTION', null],
      activeField: field([card(7, 'FIRE'), card(7, 'WATER')], 'P2'),
    }),
    play: {
      kind: 'PLAY',
      cardIds: ids(card(6, 'FIRE'), card(6, 'WATER')),
      useSkill: 'REVOLUTION',
    },
  },
  {
    id: 'joker-clear-win',
    titleKey: 'sandbox.preset.joker-clear-win',
    round: round({
      hands: [[card(6, 'FIRE')], [card(1, 'WIND')]],
      skills: ['SKILL_JOKER_SAINT', null],
      activeField: field([card(9, 'WATER')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(6, 'FIRE')), useSkill: 'JOKER_CLEAR' },
  },
  {
    id: 'forbidden-joker-go-out',
    titleKey: 'sandbox.preset.forbidden-joker-go-out',
    round: round({
      hands: [[card(7, 'WATER')], [card(1, 'WIND')]],
      skills: ['SKILL_JOKER_HERO', null],
    }),
    play: {
      kind: 'PLAY',
      cardIds: ids(card(7, 'WATER')),
      useSkill: 'JOKER_TRANSFORM',
      jokerDeclaration: { rankCode: 'RANK_7', suitCode: 'SUIT_FIRE' },
    },
  },
  {
    id: 'pass-clears-field',
    titleKey: 'sandbox.preset.pass-clears-field',
    round: round({
      hands: [[card(3, 'FIRE')], [card(5, 'WATER')], [card(7, 'WIND')]],
      activeField: field([card(9, 'EARTH')], 'P3'),
      activePlayerId: 'P1',
      consecutivePasses: 1,
    }),
    play: { kind: 'PASS', cardIds: [] },
  },
];
