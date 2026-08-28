const suitCodes = ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH'] as const;

function kebab(value: string) {
  return value.toLowerCase().replaceAll('_', '-');
}

export const m0CardPlaceholderManifest = {
  todoId: 'M0-GR-04',
  physicalDeckCount: 42,
  numberCards: Array.from({ length: 9 }, (_, rankIndex) =>
    suitCodes.map((suitCode) => {
      const rank = rankIndex + 1;
      const assetId = `card-number-rank-${rank}-${kebab(suitCode)}`;
      return {
        cardId: `CARD_NUMBER_RANK_${rank}_${suitCode}`,
        rankCode: `RANK_${rank}`,
        suitCode,
        assetId,
        runtimePath: `assets/runtime/m0/cards/number/${assetId}.svg`,
      };
    }),
  ).flat(),
  skillCards: [
    { skillId: 'SKILL_CARD_JOKER_HERO', effectCode: 'SKILL_JOKER_HERO', cardCount: 1 },
    { skillId: 'SKILL_CARD_JOKER_SAINT', effectCode: 'SKILL_JOKER_SAINT', cardCount: 1 },
    { skillId: 'SKILL_CARD_EXTENSION_SEAL', effectCode: 'SKILL_EXTENSION_SEAL', cardCount: 2 },
    { skillId: 'SKILL_CARD_REVOLUTION', effectCode: 'SKILL_REVOLUTION', cardCount: 2 },
  ].map((skill) => {
    const assetId = kebab(skill.skillId);
    return {
      ...skill,
      assetId,
      runtimePath: `assets/runtime/m0/cards/skill/${assetId}.svg`,
    };
  }),
  cardBack: {
    assetId: 'card-back-m0',
    runtimePath: 'assets/runtime/m0/cards/back/card-back-m0.svg',
  },
} as const;
