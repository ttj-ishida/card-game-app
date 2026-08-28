import { m0CardPlaceholderManifest as placeholderManifest } from './m0CardPlaceholderManifest';

export type NumberCardMaster = {
  card_id: string;
  rank_code: string;
  suit_code: string;
  display_resource_key: string;
  sort_order: number;
};

export type SkillCardMaster = {
  skill_id: string;
  effect_code: string;
  display_resource_key: string;
  description_resource_key: string;
  card_count: number;
  sort_order: number;
};

type NumberAsset = (typeof placeholderManifest.numberCards)[number];
type SkillAsset = (typeof placeholderManifest.skillCards)[number];

export type CatalogItem = {
  id: string;
  masterId: string;
  kind: 'number' | 'skill';
  title: string;
  subtitle: string;
  assetId: string;
  runtimePath: string;
  sortOrder: number;
  copyIndex: number;
  copyCount: number;
};

const numberAssetByCardId = new Map<string, NumberAsset>(
  placeholderManifest.numberCards.map((asset) => [asset.cardId, asset]),
);
const skillAssetBySkillId = new Map<string, SkillAsset>(
  placeholderManifest.skillCards.map((asset) => [asset.skillId, asset]),
);

function rankLabel(rankCode: string): string {
  return rankCode.replace('RANK_', '');
}

function suitLabel(suitCode: string): string {
  return suitCode.replace('SUIT_', '');
}

export function buildCatalogItems(
  numberCards: NumberCardMaster[],
  skillCards: SkillCardMaster[],
): CatalogItem[] {
  const numbers = numberCards.map((card) => {
    const asset = numberAssetByCardId.get(card.card_id);
    if (!asset) throw new Error('Missing number asset for ' + card.card_id);
    return {
      id: card.card_id,
      masterId: card.card_id,
      kind: 'number' as const,
      title: rankLabel(card.rank_code),
      subtitle: suitLabel(card.suit_code),
      assetId: asset.assetId,
      runtimePath: asset.runtimePath,
      sortOrder: card.sort_order,
      copyIndex: 1,
      copyCount: 1,
    };
  });

  const skills = skillCards.flatMap((card) => {
    const asset = skillAssetBySkillId.get(card.skill_id);
    if (!asset) throw new Error('Missing skill asset for ' + card.skill_id);
    return Array.from({ length: card.card_count }, (_, index) => ({
      id: `${card.skill_id}#${index + 1}`,
      masterId: card.skill_id,
      kind: 'skill' as const,
      title: card.effect_code.replace('SKILL_', '').replaceAll('_', ' '),
      subtitle: `${index + 1}/${card.card_count}`,
      assetId: asset.assetId,
      runtimePath: asset.runtimePath,
      sortOrder: 1000 + card.sort_order * 10 + index,
      copyIndex: index + 1,
      copyCount: card.card_count,
    }));
  });

  return [...numbers, ...skills].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function assertCompleteM0Catalog(items: CatalogItem[]) {
  if (items.length !== placeholderManifest.physicalDeckCount) {
    throw new Error(
      `Expected ${placeholderManifest.physicalDeckCount} catalog items but received ${items.length}`,
    );
  }
  const missingAssets = items.filter((item) => !item.runtimePath.endsWith('.svg'));
  if (missingAssets.length > 0) {
    throw new Error('Catalog contains items without SVG runtime assets');
  }
}

export { placeholderManifest };
