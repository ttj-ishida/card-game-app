import { readFileSync, statSync } from "node:fs";

// M2-GR-01〜04 のアセット検査。前例: scripts/check-m1-assets.mjs

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL: " + message);
    process.exitCode = 1;
    throw new Error(message);
  }
}

function assertSvg(path, size) {
  const svg = readFileSync(path, "utf8");
  assert(svg.includes('xmlns="http://www.w3.org/2000/svg"'), path + " missing xmlns");
  assert(svg.includes('role="img"'), path + " missing role=img");
  assert(svg.includes("<title"), path + " missing <title>");
  assert(svg.includes("<desc"), path + " missing <desc>");

  // Anchor dimension checks to the root <svg ...> tag so a child <rect> can't satisfy them.
  const openTag = svg.match(/<svg\b[^>]*>/);
  assert(openTag, path + " has no <svg> opening tag");
  const root = openTag[0];
  assert(root.includes(`width="${size.width}"`), path + " root must declare width " + size.width);
  assert(root.includes(`height="${size.height}"`), path + " root must declare height " + size.height);
  assert(root.includes(`viewBox="${size.viewBox}"`), path + " root must declare viewBox " + size.viewBox);

  assert(statSync(path).size <= size.maxBytes, path + " exceeds maxBytes " + size.maxBytes);
}

const manifest = readJson("assets/manifests/m2-battle-assets.json");

for (const id of ["M2-GR-01", "M2-GR-02", "M2-GR-03", "M2-GR-04"]) {
  assert(manifest.todoIds.includes(id), "manifest must cover " + id);
}

assert(manifest.backgrounds.length === 2, "must include 2 backgrounds (DAY, NIGHT)");
assert(
  manifest.backgrounds.some((b) => b.phase === "DAY") && manifest.backgrounds.some((b) => b.phase === "NIGHT"),
  "backgrounds must include one DAY and one NIGHT",
);

assert(manifest.cardIllustrations.length === 3, "must include 3 card illustrations (rank 1, 5, 9)");
for (const rank of [1, 5, 9]) {
  assert(
    manifest.cardIllustrations.some((c) => c.rank === rank),
    "card illustration for rank " + rank + " must exist",
  );
}

const suitCodes = ["SUIT_FIRE", "SUIT_WATER", "SUIT_WIND", "SUIT_EARTH"];
assert(manifest.attributeFrames.length === 4, "must include 4 attribute frames");
assert(manifest.attributeEmblems.length === 4, "must include 4 attribute emblems");
for (const code of suitCodes) {
  assert(manifest.attributeFrames.some((f) => f.suitCode === code), "frame for " + code + " must exist");
  assert(manifest.attributeEmblems.some((e) => e.suitCode === code), "emblem for " + code + " must exist");
}

assert(manifest.compositePreviews.length === 3, "must include 3 composite previews (rank 1, 5, 9)");
for (const rank of [1, 5, 9]) {
  assert(
    manifest.compositePreviews.some((c) => c.rank === rank),
    "composite preview for rank " + rank + " must exist",
  );
}

assert(manifest.effects.length === 3, "must include 3 effect assets");
for (const event of ["SELECT", "SUBMIT", "VICTORY"]) {
  assert(manifest.effects.some((e) => e.event === event), "effect " + event + " must exist");
}

const groups = [
  manifest.backgrounds,
  manifest.cardIllustrations,
  manifest.attributeFrames,
  manifest.attributeEmblems,
  manifest.compositePreviews,
  manifest.effects,
];
let checked = 0;
for (const group of groups) {
  for (const asset of group) {
    const size = manifest.sizes[asset.size];
    assert(size, asset.assetId + " references unknown size key " + asset.size);
    assertSvg(asset.sourcePath, size);
    assertSvg(asset.runtimePath, size);
    checked += 2;
  }
}

console.log(`M2 battle graphics OK (${checked} SVG files checked)`);
