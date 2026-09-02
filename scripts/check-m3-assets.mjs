import { readFileSync, statSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertSvg(path, size) {
  const svg = readFileSync(path, "utf8");
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";

  assert(
    root.includes('xmlns="http://www.w3.org/2000/svg"'),
    `${path}: missing SVG namespace`,
  );
  assert(root.includes('role="img"'), `${path}: missing image role`);
  assert(svg.includes("<title"), `${path}: missing title`);
  assert(svg.includes("<desc"), `${path}: missing desc`);
  assert(
    root.includes(`width="${size.width}"`),
    `${path}: width must be ${size.width}`,
  );
  assert(
    root.includes(`height="${size.height}"`),
    `${path}: height must be ${size.height}`,
  );
  assert(
    root.includes(`viewBox="${size.viewBox}"`),
    `${path}: viewBox must be ${size.viewBox}`,
  );
  assert(
    statSync(path).size <= size.maxBytes,
    `${path}: exceeds ${size.maxBytes} bytes`,
  );
}

const manifest = readJson("assets/manifests/m3-graphics-assets.json");
const requiredTodoIds = [
  "M3-GR-01",
  "M3-GR-02",
  "M3-GR-03",
  "M3-GR-04",
  "M3-GR-05",
];

assert(
  JSON.stringify(manifest.todoIds) === JSON.stringify(requiredTodoIds),
  "manifest todoIds are incomplete",
);
assert(
  manifest.status === "rough-svg-for-m3-alpha",
  "manifest status is unexpected",
);
assert(
  manifest.rankIllustrations.length === 9,
  "rank illustration count must be 9",
);
assert(
  manifest.attributeFrames.length === 4,
  "attribute frame count must be 4",
);
assert(
  manifest.attributeEmblems.length === 4,
  "attribute emblem count must be 4",
);
assert(
  manifest.skillCandidates.length === 4,
  "skill candidate count must be 4",
);
assert(manifest.tutorialPanels.length === 5, "tutorial panel count must be 5");

for (let rank = 1; rank <= 9; rank += 1) {
  assert(
    manifest.rankIllustrations.some((asset) => asset.rank === rank),
    `missing rank ${rank} illustration`,
  );
}

for (const suitCode of ["SUIT_FIRE", "SUIT_WATER", "SUIT_WIND", "SUIT_EARTH"]) {
  assert(
    manifest.attributeFrames.some((asset) => asset.suitCode === suitCode),
    `missing ${suitCode} frame`,
  );
  assert(
    manifest.attributeEmblems.some((asset) => asset.suitCode === suitCode),
    `missing ${suitCode} emblem`,
  );
}

for (const skillCode of [
  "SKILL_JOKER_HERO",
  "SKILL_JOKER_SAINT",
  "SKILL_EXTENSION_SEAL",
  "SKILL_REVOLUTION",
]) {
  assert(
    manifest.skillCandidates.some((asset) => asset.skillCode === skillCode),
    `missing ${skillCode} candidate`,
  );
}

for (const panelId of [
  "m3-tutorial-strength-order",
  "m3-tutorial-lead-update",
  "m3-tutorial-locks",
  "m3-tutorial-skills",
  "m3-tutorial-history-stats",
]) {
  assert(
    manifest.tutorialPanels.some((asset) => asset.panelId === panelId),
    `missing ${panelId} tutorial panel`,
  );
}

const allAssets = [
  ...manifest.rankIllustrations,
  ...manifest.attributeFrames,
  ...manifest.attributeEmblems,
  ...manifest.skillCandidates,
  ...manifest.tutorialPanels,
];
let checked = 0;

for (const asset of allAssets) {
  const size = manifest.sizes[asset.size];
  assert(size, `${asset.assetId}: unknown size ${asset.size}`);
  assert(
    asset.sourcePath.endsWith(".source.svg"),
    `${asset.assetId}: source path must be editable source SVG`,
  );
  assert(
    asset.runtimePath.endsWith(".svg"),
    `${asset.assetId}: runtime path must be SVG`,
  );
  assertSvg(asset.sourcePath, size);
  assertSvg(asset.runtimePath, size);
  checked += 2;
}

console.log(`M3 graphics assets OK (${checked} SVG files checked)`);
