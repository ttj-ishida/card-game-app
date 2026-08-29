import { readFileSync, statSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSvg(path, size) {
  const svg = readFileSync(path, "utf8");
  assert(
    svg.includes(`width="${size.width}"`),
    path + " must declare width " + size.width,
  );
  assert(
    svg.includes(`height="${size.height}"`),
    path + " must declare height " + size.height,
  );
  assert(
    svg.includes(`viewBox="${size.viewBox}"`),
    path + " must declare viewBox " + size.viewBox,
  );
  assert(statSync(path).size <= size.maxBytes, path + " exceeds max bytes");
}

const manifest = readJson("assets/manifests/m1-rule-sandbox-assets.json");
assert(manifest.todoIds.includes("M1-GR-01"), "manifest must cover M1-GR-01");
assert(manifest.todoIds.includes("M1-GR-02"), "manifest must cover M1-GR-02");
assert(manifest.todoIds.includes("M1-GR-03"), "manifest must cover M1-GR-03");
assert(
  manifest.combinationLayouts.length === 9,
  "must include layouts for 1 to 9 cards",
);
assert(manifest.stateIcons.length === 4, "must include four state icons");
assert(
  manifest.jokerDeclarationOverlays.length === 36,
  "must include 9 x 4 Joker declaration overlays",
);

for (let count = 1; count <= 9; count += 1) {
  assert(
    manifest.combinationLayouts.some((layout) => layout.cardCount === count),
    count + " card layout must exist",
  );
}

for (const icon of manifest.stateIcons) {
  assert(
    icon.shapeCue && typeof icon.shapeCue === "string",
    icon.assetId + " must have a shape cue",
  );
  assertSvg(icon.sourcePath, manifest.iconSize);
  assertSvg(icon.runtimePath, manifest.iconSize);
}

const requiredSuits = ["SUIT_FIRE", "SUIT_WATER", "SUIT_WIND", "SUIT_EARTH"];
for (let rank = 1; rank <= 9; rank += 1) {
  for (const suitCode of requiredSuits) {
    assert(
      manifest.jokerDeclarationOverlays.some(
        (overlay) =>
          overlay.rankCode === `RANK_${rank}` && overlay.suitCode === suitCode,
      ),
      `Joker overlay RANK_${rank} ${suitCode} must exist`,
    );
  }
}

for (const layout of manifest.combinationLayouts) {
  assertSvg(layout.sourcePath, manifest.layoutSize);
  assertSvg(layout.runtimePath, manifest.layoutSize);
}

for (const overlay of manifest.jokerDeclarationOverlays) {
  assertSvg(overlay.sourcePath, manifest.jokerOverlaySize);
  assertSvg(overlay.runtimePath, manifest.jokerOverlaySize);
}

console.log("M1 asset checks passed");
