import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const templateManifest = JSON.parse(readFileSync('assets/manifests/m0-card-template.json', 'utf8'));
const suitManifest = JSON.parse(readFileSync('assets/manifests/m0-suits-and-palettes.json', 'utf8'));
const template = templateManifest.cardTemplate;
const suitByCode = new Map(suitManifest.suits.map((suit) => [suit.suitCode, suit]));
const suitOrder = ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH'];
const suitShort = { SUIT_FIRE: 'FIRE', SUIT_WATER: 'WATER', SUIT_WIND: 'WIND', SUIT_EARTH: 'EARTH' };
const skillCards = [
  { skillId: 'SKILL_CARD_JOKER_HERO', effectCode: 'SKILL_JOKER_HERO', label: 'JOKER HERO', cardCount: 1, accent: '#6A4BC3', mark: 'JH' },
  { skillId: 'SKILL_CARD_JOKER_SAINT', effectCode: 'SKILL_JOKER_SAINT', label: 'JOKER SAINT', cardCount: 1, accent: '#247C9A', mark: 'JS' },
  { skillId: 'SKILL_CARD_EXTENSION_SEAL', effectCode: 'SKILL_EXTENSION_SEAL', label: 'EXTENSION SEAL', cardCount: 2, accent: '#C28A18', mark: 'ES' },
  { skillId: 'SKILL_CARD_REVOLUTION', effectCode: 'SKILL_REVOLUTION', label: 'REVOLUTION', cardCount: 2, accent: '#B83F55', mark: 'RV' },
];

function kebab(value) {
  return value.toLowerCase().replaceAll('_', '-');
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.trimEnd() + '\n');
}

function cardShell(inner, accent = '#1B1D24') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.source.width}" height="${template.source.height}" viewBox="${template.source.viewBox}" role="img">
  <rect width="750" height="1050" rx="36" fill="#FAF8F0"/>
  <rect x="24" y="24" width="702" height="1002" rx="36" fill="none" stroke="#1B1D24" stroke-width="8"/>
  <rect x="60" y="84" width="630" height="882" rx="20" fill="none" stroke="${accent}" stroke-width="10"/>
  ${inner}
</svg>`;
}

function numberSvg(rank, suit) {
  const suitNumber = suitOrder.indexOf(suit.suitCode) + 1;
  const pattern = Array.from({ length: suitNumber }, (_, index) => `<circle cx="${312 + index * 42}" cy="690" r="14" fill="${suit.color}"/>`).join('\n  ');
  return cardShell(`<text x="92" y="176" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" fill="#1B1D24" font-weight="700">${rank}</text>
  <text x="375" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="210" fill="#1B1D24" font-weight="700">${rank}</text>
  <path d="M375 510 L455 650 L295 650 Z" fill="${suit.color}" opacity="0.16"/>
  <text x="375" y="610" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" fill="${suit.color}" font-weight="700">${suitShort[suit.suitCode]}</text>
  ${pattern}
  <text x="375" y="816" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#3B4148">${suit.shapeCue}</text>`, suit.color);
}

function skillSvg(skill) {
  return cardShell(`<rect x="96" y="170" width="558" height="136" rx="18" fill="${skill.accent}"/>
  <text x="375" y="258" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" fill="#FAF8F0" font-weight="700">${skill.mark}</text>
  <text x="375" y="480" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" fill="#1B1D24" font-weight="700">${skill.label}</text>
  <path d="M220 608 H530 M250 676 H500 M280 744 H470" stroke="${skill.accent}" stroke-width="28" stroke-linecap="round"/>
  <text x="375" y="860" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#3B4148">temporary skill art</text>`, skill.accent);
}

function backSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050" role="img">
  <rect width="750" height="1050" rx="36" fill="#2E3147"/>
  <rect x="24" y="24" width="702" height="1002" rx="36" fill="none" stroke="#F5F2E8" stroke-width="8"/>
  <path d="M375 170 L560 275 L560 775 L375 880 L190 775 L190 275 Z" fill="none" stroke="#F5F2E8" stroke-width="18"/>
  <path d="M375 285 L470 525 L375 765 L280 525 Z" fill="#F5F2E8" opacity="0.18"/>
  <text x="375" y="548" text-anchor="middle" font-family="Arial, sans-serif" font-size="70" fill="#F5F2E8" font-weight="700">M0</text>
  <text x="375" y="630" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#F5F2E8">CARD BACK</text>
</svg>`;
}

const numberCards = [];
for (let rank = 1; rank <= 9; rank += 1) {
  for (const suitCode of suitOrder) {
    const suit = suitByCode.get(suitCode);
    const cardId = `CARD_NUMBER_RANK_${rank}_${suitCode}`;
    const file = `card-number-rank-${rank}-${kebab(suitCode)}`;
    const sourcePath = `assets/source/m0/cards/number/${file}.source.svg`;
    const runtimePath = `assets/runtime/m0/cards/number/${file}.svg`;
    const svg = numberSvg(rank, suit);
    write(sourcePath, svg);
    write(runtimePath, svg);
    numberCards.push({ cardId, rankCode: `RANK_${rank}`, suitCode, assetId: file, sourcePath, runtimePath });
  }
}

const skills = skillCards.map((skill) => {
  const file = kebab(skill.skillId);
  const sourcePath = `assets/source/m0/cards/skill/${file}.source.svg`;
  const runtimePath = `assets/runtime/m0/cards/skill/${file}.svg`;
  const svg = skillSvg(skill);
  write(sourcePath, svg);
  write(runtimePath, svg);
  return { skillId: skill.skillId, effectCode: skill.effectCode, cardCount: skill.cardCount, assetId: file, sourcePath, runtimePath };
});

const cardBack = {
  assetId: 'card-back-m0',
  sourcePath: 'assets/source/m0/cards/back/card-back-m0.source.svg',
  runtimePath: 'assets/runtime/m0/cards/back/card-back-m0.svg',
};
const back = backSvg();
write(cardBack.sourcePath, back);
write(cardBack.runtimePath, back);

const manifest = {
  todoId: 'M0-GR-04',
  version: '0.1.0',
  status: 'accepted-for-m0',
  templateRef: 'assets/manifests/m0-card-template.json',
  suitPaletteRef: 'assets/manifests/m0-suits-and-palettes.json',
  physicalDeckCount: numberCards.length + skills.reduce((sum, skill) => sum + skill.cardCount, 0),
  numberCards,
  skillCards: skills,
  cardBack,
  license: 'project-owned-placeholder',
};
write('assets/manifests/m0-card-placeholders.json', JSON.stringify(manifest, null, 2));
console.log(`Generated ${numberCards.length} number placeholders, ${skills.length} skill placeholder definitions, and 1 card back.`);
console.log(`Physical deck count represented by manifest: ${manifest.physicalDeckCount}`);
