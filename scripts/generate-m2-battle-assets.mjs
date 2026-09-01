import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// M2-GR-01〜04: プログラム生成の対局グラフィックのプレースホルダ。
// 設計書: docs/superpowers/specs/2026-09-01-m2-battle-graphics-design.md
// 前例: scripts/generate-m1-rule-sandbox-assets.mjs

const SIZES = {
  background: { width: 1920, height: 1080, viewBox: "0 0 1920 1080", maxBytes: 40960 },
  cardIllust: { width: 630, height: 882, viewBox: "0 0 630 882", maxBytes: 24576 },
  frame: { width: 750, height: 1050, viewBox: "0 0 750 1050", maxBytes: 16384 },
  emblem: { width: 200, height: 200, viewBox: "0 0 200 200", maxBytes: 8192 },
  composite: { width: 750, height: 1050, viewBox: "0 0 750 1050", maxBytes: 32768 },
  fxSelect: { width: 300, height: 420, viewBox: "0 0 300 420", maxBytes: 12288 },
  fxSubmit: { width: 400, height: 400, viewBox: "0 0 400 400", maxBytes: 12288 },
  fxVictory: { width: 900, height: 300, viewBox: "0 0 900 300", maxBytes: 16384 },
};

const INK = "#1B1D24";
const DAY_TABLE = "#EEF5F1";
const NIGHT_TABLE = "#17202A";
const PAPER = "#FAF8F0";

const SUITS = [
  { code: "SUIT_FIRE", key: "fire", nameJa: "火", color: "#D84A2B", frameCue: "spikes" },
  { code: "SUIT_WATER", key: "water", nameJa: "水", color: "#2577B8", frameCue: "waves" },
  { code: "SUIT_WIND", key: "wind", nameJa: "風", color: "#31886B", frameCue: "swirls" },
  { code: "SUIT_EARTH", key: "earth", nameJa: "土", color: "#8A6A2A", frameCue: "diamonds" },
];

const EMBLEM_SHAPE = {
  fire: "M100 16 C56 64 56 116 100 178 C144 116 144 64 100 16 Z",
  water: "M100 20 C58 78 44 116 44 144 C44 178 74 190 100 190 C126 190 156 178 156 144 C156 116 142 78 100 20 Z",
  wind: "M22 78 C82 30 156 46 176 90 C138 74 108 86 84 116 C124 100 168 120 186 160 C124 150 74 162 30 196 C48 150 60 114 22 78 Z",
  earth: "M100 24 L176 100 L100 176 L24 100 Z",
};

const RANKS = [
  { rank: 1, nameJa: "大魔王", frameSuit: "SUIT_EARTH", silhouette: "M315 90 L250 210 L200 170 L230 300 L400 300 L430 170 L380 210 Z" },
  { rank: 5, nameJa: "人間の戦士", frameSuit: "SUIT_WATER", silhouette: "M315 60 L340 260 L470 500 L440 520 L315 300 L190 520 L160 500 L290 260 Z" },
  { rank: 9, nameJa: "神", frameSuit: "SUIT_WIND", silhouette: "M315 70 A150 150 0 1 0 316 70 M315 130 A90 90 0 1 1 314 130" },
];

const EFFECTS = [
  { event: "SELECT", assetId: "m2-fx-select", size: "fxSelect" },
  { event: "SUBMIT", assetId: "m2-fx-submit", size: "fxSubmit" },
  { event: "VICTORY", assetId: "m2-fx-victory", size: "fxVictory" },
];

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function svg(size, title, desc, body) {
  const s = SIZES[size];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}" viewBox="${s.viewBox}" ` +
    `role="img" aria-labelledby="t d"><title id="t">${title}</title><desc id="d">${desc}</desc>${body}</svg>\n`
  );
}

function backgroundSvg(phase) {
  if (phase === "DAY") {
    return svg(
      "background",
      "Daytime battle background (placeholder)",
      "Bright warm sky with a radiant sun. Distinguished from night by shape and light, not colour alone.",
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#F7ECD6"/><stop offset="1" stop-color="${DAY_TABLE}"/></linearGradient></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<circle cx="1560" cy="240" r="120" fill="#F2B84B" stroke="${INK}" stroke-width="6"/>` +
        Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const x1 = 1560 + Math.cos(a) * 150;
          const y1 = 240 + Math.sin(a) * 150;
          const x2 = 1560 + Math.cos(a) * 210;
          const y2 = 240 + Math.sin(a) * 210;
          return `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)}" stroke="#F2B84B" stroke-width="10" stroke-linecap="round"/>`;
        }).join("") +
        `<path d="M0 860 Q480 800 960 860 T1920 860 V1080 H0 Z" fill="#DCEAE0"/>`,
    );
  }
  return svg(
    "background",
    "Nighttime battle background (placeholder)",
    "Dark sky with a crescent moon and scattered stars. Distinguished from day by shape and darkness, not colour alone.",
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0C1218"/><stop offset="1" stop-color="${NIGHT_TABLE}"/></linearGradient></defs>` +
      `<rect width="1920" height="1080" fill="url(#g)"/>` +
      `<path d="M1560 130 A120 120 0 1 0 1560 370 A96 96 0 1 1 1560 130 Z" fill="#E8ECF2" stroke="${INK}" stroke-width="6"/>` +
      Array.from({ length: 26 }, (_, i) => {
        const x = ((i * 8123) % 1900) + 10;
        const y = ((i * 3571) % 760) + 20;
        const r = (i % 3) + 2;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="#E8ECF2"/>`;
      }).join("") +
      `<path d="M0 880 Q480 940 960 880 T1920 880 V1080 H0 Z" fill="#1F2C36"/>`,
  );
}

function cardIllustSvg(entry) {
  return svg(
    "cardIllust",
    `Card illustration placeholder: rank ${entry.rank} (${entry.nameJa})`,
    `Large rank numeral with a rank-specific silhouette so the card reads at small sizes without relying on colour.`,
    `<rect width="630" height="882" fill="${PAPER}"/>` +
      `<rect x="14" y="14" width="602" height="854" fill="none" stroke="${INK}" stroke-width="6" stroke-dasharray="16 12"/>` +
      `<path d="${entry.silhouette}" fill="#C9CEC7" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
      `<text x="315" y="760" font-family="Arial, sans-serif" font-size="300" font-weight="700" text-anchor="middle" fill="${INK}">${entry.rank}</text>`,
  );
}

function frameEdge(cue, color) {
  switch (cue) {
    case "spikes":
      return Array.from({ length: 20 }, (_, i) => {
        const x = 40 + i * 34;
        return `<path d="M${x} 40 L${x + 17} 10 L${x + 34} 40 Z" fill="${color}"/>`;
      }).join("");
    case "waves":
      return `<path d="M40 40 Q90 10 140 40 T240 40 T340 40 T440 40 T540 40 T640 40 T710 40" fill="none" stroke="${color}" stroke-width="14"/>`;
    case "swirls":
      return Array.from({ length: 7 }, (_, i) => {
        const x = 70 + i * 100;
        return `<path d="M${x} 20 c30 0 30 40 0 40 c-24 0 -24 -28 0 -28" fill="none" stroke="${color}" stroke-width="10"/>`;
      }).join("");
    default:
      return Array.from({ length: 12 }, (_, i) => {
        const x = 55 + i * 55;
        return `<path d="M${x} 15 L${x + 20} 40 L${x} 65 L${x - 20} 40 Z" fill="${color}"/>`;
      }).join("");
  }
}

function frameSvg(suit) {
  const edge = frameEdge(suit.frameCue, suit.color);
  return svg(
    "frame",
    `Attribute frame placeholder: ${suit.nameJa} (${suit.code})`,
    `Card border keyed to the ${suit.key} suit by edge shape (${suit.frameCue}) and colour.`,
    `<rect width="750" height="1050" fill="none"/>` +
      `<rect x="24" y="24" width="702" height="1002" rx="28" fill="none" stroke="${suit.color}" stroke-width="20"/>` +
      `<rect x="52" y="52" width="646" height="946" rx="18" fill="none" stroke="${INK}" stroke-width="4"/>` +
      `<g>${edge}</g>` +
      `<g transform="translate(0 1050) scale(1 -1)">${edge}</g>`,
  );
}

function emblemSvg(suit) {
  return svg(
    "emblem",
    `Attribute emblem placeholder: ${suit.nameJa} (${suit.code})`,
    `Suit emblem recognizable by silhouette without colour.`,
    `<path d="${EMBLEM_SHAPE[suit.key]}" fill="${suit.color}"/>` +
      `<path d="${EMBLEM_SHAPE[suit.key]}" fill="none" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`,
  );
}

function compositeSvg(entry) {
  const suit = SUITS.find((s) => s.code === entry.frameSuit);
  const illust = RANKS.find((r) => r.rank === entry.rank);
  return svg(
    "composite",
    `Composite preview: rank ${entry.rank} in the ${suit.nameJa} frame`,
    `Frame + emblem + rank illustration layered so the three representative cards can be compared.`,
    `<rect width="750" height="1050" fill="${PAPER}"/>` +
      `<path d="${illust.silhouette}" transform="translate(60 120)" fill="#C9CEC7" stroke="${INK}" stroke-width="6"/>` +
      `<text x="375" y="900" font-family="Arial, sans-serif" font-size="260" font-weight="700" text-anchor="middle" fill="${INK}">${entry.rank}</text>` +
      `<g transform="translate(540 60) scale(0.9)"><path d="${EMBLEM_SHAPE[suit.key]}" fill="${suit.color}" stroke="${INK}" stroke-width="8"/></g>` +
      `<rect x="24" y="24" width="702" height="1002" rx="28" fill="none" stroke="${suit.color}" stroke-width="20"/>`,
  );
}

function fxSvg(effect) {
  if (effect.event === "SELECT") {
    return svg(
      "fxSelect",
      "Effect placeholder: card selection highlight",
      "Double outline with corner markers, card-proportioned, for the select animation.",
      `<rect x="10" y="10" width="280" height="400" rx="14" fill="none" stroke="#F2B84B" stroke-width="10"/>` +
        `<rect x="26" y="26" width="248" height="368" rx="10" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="10 8"/>` +
        [
          "M10 40 V10 H40",
          "M260 10 H290 V40",
          "M290 380 V410 H260",
          "M40 410 H10 V380",
        ]
          .map((d) => `<path d="${d}" fill="none" stroke="#F2B84B" stroke-width="10" stroke-linecap="round"/>`)
          .join(""),
    );
  }
  if (effect.event === "SUBMIT") {
    return svg(
      "fxSubmit",
      "Effect placeholder: card submit burst",
      "Radiating lines and a ring emanating outward for the submit animation.",
      `<circle cx="200" cy="200" r="70" fill="none" stroke="#F2B84B" stroke-width="12"/>` +
        Array.from({ length: 16 }, (_, i) => {
          const a = (i * Math.PI) / 8;
          const x1 = 200 + Math.cos(a) * 90;
          const y1 = 200 + Math.sin(a) * 90;
          const x2 = 200 + Math.cos(a) * 170;
          const y2 = 200 + Math.sin(a) * 170;
          return `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)}" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`;
        }).join(""),
    );
  }
  return svg(
    "fxVictory",
    "Effect placeholder: victory banner",
    "Ribbon band with stars marking a win. Uses the token WIN as a language-neutral marker.",
    `<path d="M0 90 H900 L840 150 L900 210 H0 L60 150 Z" fill="#F2B84B" stroke="${INK}" stroke-width="6"/>` +
      [120, 780].map((x) => `<path d="M${x} 110 l18 40 44 4 -33 30 10 44 -39 -24 -39 24 10 -44 -33 -30 44 -4 Z" fill="${PAPER}" stroke="${INK}" stroke-width="4"/>`).join("") +
      `<text x="450" y="180" font-family="Arial, sans-serif" font-size="90" font-weight="700" text-anchor="middle" fill="${INK}">WIN</text>`,
  );
}

const manifest = {
  todoIds: ["M2-GR-01", "M2-GR-02", "M2-GR-03", "M2-GR-04"],
  version: "0.1.0",
  status: "placeholder-for-m2-battle",
  sizes: SIZES,
  backgrounds: [],
  cardIllustrations: [],
  attributeFrames: [],
  attributeEmblems: [],
  compositePreviews: [],
  effects: [],
};

function emit(assetId, subdir, content, extra) {
  const sourcePath = `assets/source/m2/battle/${subdir}/${assetId}.source.svg`;
  const runtimePath = `assets/runtime/m2/battle/${subdir}/${assetId}.svg`;
  write(sourcePath, content);
  write(runtimePath, content);
  return { assetId, sourcePath, runtimePath, ...extra };
}

for (const phase of ["DAY", "NIGHT"]) {
  const assetId = `m2-battle-bg-${phase.toLowerCase()}`;
  manifest.backgrounds.push(emit(assetId, "backgrounds", backgroundSvg(phase), { phase, size: "background" }));
}

for (const entry of RANKS) {
  const assetId = `m2-card-illust-rank-${entry.rank}`;
  manifest.cardIllustrations.push(
    emit(assetId, "card-illustrations", cardIllustSvg(entry), {
      rank: entry.rank,
      rankCode: `RANK_${entry.rank}`,
      nameJa: entry.nameJa,
      size: "cardIllust",
    }),
  );
}

for (const suit of SUITS) {
  manifest.attributeFrames.push(
    emit(`m2-frame-${suit.key}`, "frames", frameSvg(suit), { suitCode: suit.code, shapeCue: suit.frameCue, size: "frame" }),
  );
  manifest.attributeEmblems.push(
    emit(`m2-emblem-${suit.key}`, "emblems", emblemSvg(suit), { suitCode: suit.code, size: "emblem" }),
  );
}

for (const entry of RANKS) {
  const assetId = `m2-composite-rank-${entry.rank}`;
  manifest.compositePreviews.push(
    emit(assetId, "composites", compositeSvg({ rank: entry.rank, frameSuit: entry.frameSuit }), {
      rank: entry.rank,
      frameSuit: entry.frameSuit,
      size: "composite",
    }),
  );
}

for (const effect of EFFECTS) {
  manifest.effects.push(emit(effect.assetId, "effects", fxSvg(effect), { event: effect.event, size: effect.size }));
}

write("assets/manifests/m2-battle-assets.json", JSON.stringify(manifest, null, 2) + "\n");

const total =
  manifest.backgrounds.length +
  manifest.cardIllustrations.length +
  manifest.attributeFrames.length +
  manifest.attributeEmblems.length +
  manifest.compositePreviews.length +
  manifest.effects.length;
console.log(`M2 battle graphics placeholders generated (${total} assets)`);
