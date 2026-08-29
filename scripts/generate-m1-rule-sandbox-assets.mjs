import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const layoutCounts = Array.from({ length: 9 }, (_, index) => index + 1);
const stateIcons = [
  { id: "state-day-night", cue: "split-circle", color: "#2577B8" },
  { id: "state-suit-lock", cue: "ring-lock", color: "#31886B" },
  { id: "state-extension-seal", cue: "bar-seal", color: "#C28A18" },
  { id: "state-revolution", cue: "reversal-arrows", color: "#D84A2B" },
];
const suits = [
  {
    code: "SUIT_FIRE",
    key: "fire",
    color: "#D84A2B",
    shape: "M120 30 L92 92 L132 92 L68 150 L90 104 L54 104 Z",
  },
  {
    code: "SUIT_WATER",
    key: "water",
    color: "#2577B8",
    shape:
      "M90 24 C52 70 42 96 42 122 C42 158 70 184 90 184 C110 184 138 158 138 122 C138 96 128 70 90 24 Z",
  },
  {
    code: "SUIT_WIND",
    key: "wind",
    color: "#31886B",
    shape:
      "M30 72 C78 32 138 44 154 82 C122 70 98 80 78 104 C112 90 148 106 164 140 C112 132 70 142 34 172 C48 132 58 102 30 72 Z",
  },
  {
    code: "SUIT_EARTH",
    key: "earth",
    color: "#8A6A2A",
    shape: "M90 28 L156 90 L90 152 L24 90 Z",
  },
];

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function layoutSvg(count) {
  const width = 900;
  const height = 240;
  const gap = 14;
  const cardWidth = Math.floor((width - 60 - gap * (count - 1)) / count);
  const cardHeight = Math.floor(cardWidth * 1.4);
  const y = Math.floor((height - cardHeight) / 2);
  const cards = Array.from({ length: count }, (_, index) => {
    const x = 30 + index * (cardWidth + gap);
    return `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="#FAF8F0" stroke="#1B1D24" stroke-width="3"/><circle cx="${x + cardWidth / 2}" cy="${y + cardHeight / 2}" r="${Math.max(8, Math.floor(cardWidth / 8))}" fill="#2577B8"/><path d="M${x + 10} ${y + 12} H${x + cardWidth - 10}" stroke="#8B9098" stroke-width="3"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${count} card layout"><rect width="${width}" height="${height}" fill="#EEF5F1"/><rect x="18" y="18" width="864" height="204" rx="12" fill="none" stroke="#3B4148" stroke-width="2" stroke-dasharray="10 8"/>${cards}</svg>\n`;
}

function stateIconSvg(icon) {
  const glyphs = {
    "split-circle":
      '<path d="M80 18 A62 62 0 1 0 80 142 A62 62 0 1 0 80 18 Z" fill="#EEF5F1" stroke="#1B1D24" stroke-width="6"/><path d="M80 18 A62 62 0 0 1 80 142 Z" fill="#17202A"/>',
    "ring-lock":
      '<circle cx="80" cy="88" r="48" fill="none" stroke="#31886B" stroke-width="14"/><rect x="54" y="72" width="52" height="44" rx="8" fill="#FAF8F0" stroke="#1B1D24" stroke-width="6"/><path d="M64 72 V58 C64 40 96 40 96 58 V72" fill="none" stroke="#1B1D24" stroke-width="6"/>',
    "bar-seal":
      '<rect x="28" y="54" width="104" height="52" rx="8" fill="#FAF8F0" stroke="#1B1D24" stroke-width="6"/><path d="M36 80 H124" stroke="#C28A18" stroke-width="18"/><path d="M52 42 L108 118" stroke="#1B1D24" stroke-width="8"/>',
    "reversal-arrows":
      '<path d="M42 58 H112 L96 42" fill="none" stroke="#D84A2B" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M118 102 H48 L64 118" fill="none" stroke="#2577B8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="80" cy="80" r="62" fill="none" stroke="#1B1D24" stroke-width="5"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${icon.id}"><rect width="160" height="160" rx="18" fill="#FAF8F0"/>${glyphs[icon.cue]}</svg>\n`;
}

function jokerOverlaySvg(rank, suit) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160" role="img" aria-label="Joker rank ${rank} ${suit.key}"><rect width="240" height="160" rx="18" fill="#FAF8F0" stroke="#1B1D24" stroke-width="5"/><circle cx="70" cy="80" r="46" fill="${suit.color}" opacity="0.18"/><path d="${suit.shape}" transform="translate(-20 -20) scale(0.75)" fill="${suit.color}"/><text x="148" y="106" font-family="Arial, sans-serif" font-size="78" font-weight="700" text-anchor="middle" fill="#1B1D24">${rank}</text><path d="M126 122 H204" stroke="${suit.color}" stroke-width="8" stroke-linecap="round"/></svg>\n`;
}

const manifest = {
  todoIds: ["M1-GR-01", "M1-GR-02", "M1-GR-03"],
  version: "0.1.0",
  status: "accepted-for-m1-sandbox",
  layoutSize: {
    width: 900,
    height: 240,
    viewBox: "0 0 900 240",
    maxBytes: 81920,
  },
  iconSize: {
    width: 160,
    height: 160,
    viewBox: "0 0 160 160",
    maxBytes: 20480,
  },
  jokerOverlaySize: {
    width: 240,
    height: 160,
    viewBox: "0 0 240 160",
    maxBytes: 20480,
  },
  combinationLayouts: [],
  stateIcons: [],
  jokerDeclarationOverlays: [],
};

for (const count of layoutCounts) {
  const assetId = `m1-layout-${count}-cards`;
  const sourcePath = `assets/source/m1/rule-sandbox/layouts/${assetId}.source.svg`;
  const runtimePath = `assets/runtime/m1/rule-sandbox/layouts/${assetId}.svg`;
  const svg = layoutSvg(count);
  write(sourcePath, svg);
  write(runtimePath, svg);
  manifest.combinationLayouts.push({
    assetId,
    cardCount: count,
    sourcePath,
    runtimePath,
  });
}

for (const icon of stateIcons) {
  const sourcePath = `assets/source/m1/rule-sandbox/icons/${icon.id}.source.svg`;
  const runtimePath = `assets/runtime/m1/rule-sandbox/icons/${icon.id}.svg`;
  const svg = stateIconSvg(icon);
  write(sourcePath, svg);
  write(runtimePath, svg);
  manifest.stateIcons.push({
    assetId: icon.id,
    shapeCue: icon.cue,
    sourcePath,
    runtimePath,
  });
}

for (let rank = 1; rank <= 9; rank += 1) {
  for (const suit of suits) {
    const assetId = `m1-joker-rank-${rank}-suit-${suit.key}`;
    const sourcePath = `assets/source/m1/rule-sandbox/joker-overlays/${assetId}.source.svg`;
    const runtimePath = `assets/runtime/m1/rule-sandbox/joker-overlays/${assetId}.svg`;
    const svg = jokerOverlaySvg(rank, suit);
    write(sourcePath, svg);
    write(runtimePath, svg);
    manifest.jokerDeclarationOverlays.push({
      assetId,
      rankCode: `RANK_${rank}`,
      suitCode: suit.code,
      sourcePath,
      runtimePath,
    });
  }
}

write(
  "assets/manifests/m1-rule-sandbox-assets.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("M1 rule sandbox assets generated");
