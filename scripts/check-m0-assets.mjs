import { readFileSync, statSync } from 'node:fs';

const manifestPath = 'assets/manifests/m0-card-template.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const template = manifest.cardTemplate;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertRatio(size, label) {
  assert(size.width * 7 === size.height * 5, label + ' must keep the 5:7 ratio');
}

assert(manifest.todoId === 'M0-GR-02', 'manifest todoId must be M0-GR-02');
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
  const svg = readFileSync(path, 'utf8');
  assert(svg.includes('width="750"'), path + ' must declare width 750');
  assert(svg.includes('height="1050"'), path + ' must declare height 1050');
  assert(svg.includes('viewBox="0 0 750 1050"'), path + ' must declare the template viewBox');
  assert(statSync(path).size <= template.style.maxBytesPerCard, path + ' exceeds maxBytesPerCard');
}

console.log('M0 asset template checks passed');
