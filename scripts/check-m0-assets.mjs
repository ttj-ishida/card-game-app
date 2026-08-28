import { readFileSync, statSync } from 'node:fs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertRatio(size, label) {
  assert(size.width * 7 === size.height * 5, label + ' must keep the 5:7 ratio');
}

function assertSvgSize(path, width, height, viewBox, maxBytes) {
  const svg = readFileSync(path, 'utf8');
  assert(svg.includes(`width="${width}"`), path + ' must declare width ' + width);
  assert(svg.includes(`height="${height}"`), path + ' must declare height ' + height);
  assert(svg.includes(`viewBox="${viewBox}"`), path + ' must declare viewBox ' + viewBox);
  assert(statSync(path).size <= maxBytes, path + ' exceeds max bytes');
}

function validateCardTemplate() {
  const manifest = readJson('assets/manifests/m0-card-template.json');
  const template = manifest.cardTemplate;
  assert(manifest.todoId === 'M0-GR-02', 'card template todoId must be M0-GR-02');
  assert(template.aspectRatio === '5:7', 'aspectRatio must be 5:7');
  assertRatio(template.source, 'source');
  for (const [name, size] of Object.entries(template.displaySizes)) assertRatio(size, name);
  assert(template.source.width === 750 && template.source.height === 1050, 'source must be 750 x 1050');
  assert(template.source.viewBox === '0 0 750 1050', 'viewBox must match source dimensions');

  const safe = template.bounds.safeArea;
  const essential = template.bounds.essentialTextArea;
  assert(safe.x >= template.bounds.outerBleed && safe.y >= template.bounds.outerBleed, 'safe area must stay inside bleed');
  assert(safe.x + safe.width <= template.source.width - template.bounds.outerBleed, 'safe area width must stay inside card');
  assert(safe.y + safe.height <= template.source.height - template.bounds.outerBleed, 'safe area height must stay inside card');
  assert(essential.x >= safe.x && essential.y >= safe.y, 'essential area must start inside safe area');
  assert(essential.x + essential.width <= safe.x + safe.width, 'essential area width must stay inside safe area');
  assert(essential.y + essential.height <= safe.y + safe.height, 'essential area height must stay inside safe area');

  for (const path of [template.paths.sourceTemplate, template.paths.runtimeTemplate]) {
    assertSvgSize(path, 750, 1050, template.source.viewBox, template.style.maxBytesPerCard);
  }
}

function validateSuitsAndPalettes() {
  const manifest = readJson('assets/manifests/m0-suits-and-palettes.json');
  const requiredSuitCodes = ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH'];
  assert(manifest.todoId === 'M0-GR-03', 'suit manifest todoId must be M0-GR-03');
  assert(manifest.suits.length === 4, 'suit manifest must contain four suits');
  assert(requiredSuitCodes.every((code) => manifest.suits.some((suit) => suit.suitCode === code)), 'all required suit codes must exist');
  assert(new Set(manifest.suits.map((suit) => suit.shapeCue)).size === 4, 'shape cues must be unique');
  assert(manifest.palettes.day && manifest.palettes.night, 'day and night palettes must exist');

  for (const suit of manifest.suits) {
    assert(/^#[0-9A-F]{6}$/.test(suit.color), suit.assetId + ' must use uppercase hex color');
    for (const path of [suit.sourcePath, suit.runtimePath]) {
      assertSvgSize(path, 160, 160, manifest.emblemSize.viewBox, manifest.emblemSize.maxBytes);
    }
  }
}

function validateCardPlaceholders() {
  const template = readJson('assets/manifests/m0-card-template.json').cardTemplate;
  const manifest = readJson('assets/manifests/m0-card-placeholders.json');
  const requiredSuitCodes = ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH'];
  assert(manifest.todoId === 'M0-GR-04', 'placeholder manifest todoId must be M0-GR-04');
  assert(manifest.numberCards.length === 36, 'number card placeholder count must be 36');
  assert(manifest.skillCards.length === 4, 'skill placeholder definition count must be 4');
  assert(manifest.skillCards.reduce((sum, skill) => sum + skill.cardCount, 0) === 6, 'skill physical card count must be 6');
  assert(manifest.physicalDeckCount === 42, 'physical deck count must be 42');

  for (let rank = 1; rank <= 9; rank += 1) {
    for (const suitCode of requiredSuitCodes) {
      const cardId = `CARD_NUMBER_RANK_${rank}_${suitCode}`;
      assert(manifest.numberCards.some((card) => card.cardId === cardId), cardId + ' must have a placeholder');
    }
  }

  const allPaths = [
    ...manifest.numberCards.flatMap((card) => [card.sourcePath, card.runtimePath]),
    ...manifest.skillCards.flatMap((card) => [card.sourcePath, card.runtimePath]),
    manifest.cardBack.sourcePath,
    manifest.cardBack.runtimePath,
  ];
  for (const path of allPaths) {
    assertSvgSize(path, template.source.width, template.source.height, template.source.viewBox, template.style.maxBytesPerCard);
  }
}

validateCardTemplate();
validateSuitsAndPalettes();
validateCardPlaceholders();
console.log('M0 asset checks passed');
