import { mkdirSync, writeFileSync } from "node:fs";
import prettier from "../apps/mobile/node_modules/prettier/index.mjs";
import { dirname } from "node:path";

const INK = "#1F2933";
const PAPER = "#F7F1E6";
const GOLD = "#D9A441";
const SILVER = "#C8D0D8";
const SHADOW = "#59636E";

const SIZES = {
  cardIllust: {
    width: 630,
    height: 882,
    viewBox: "0 0 630 882",
    maxBytes: 30000,
  },
  frame: { width: 750, height: 1050, viewBox: "0 0 750 1050", maxBytes: 24000 },
  emblem: { width: 200, height: 200, viewBox: "0 0 200 200", maxBytes: 12000 },
  skillCard: {
    width: 750,
    height: 1050,
    viewBox: "0 0 750 1050",
    maxBytes: 32000,
  },
  tutorialPanel: {
    width: 1280,
    height: 720,
    viewBox: "0 0 1280 720",
    maxBytes: 48000,
  },
};

const RANKS = [
  {
    rank: 1,
    nameJa: "大魔王",
    motif: "abyss throne",
    color: "#4A2436",
    crown: "M250 214 L314 122 L378 214 Z",
  },
  {
    rank: 2,
    nameJa: "魔王",
    motif: "horned ruler",
    color: "#6B2D45",
    crown: "M230 230 L274 146 L318 230 L362 146 L406 230 Z",
  },
  {
    rank: 3,
    nameJa: "竜騎士",
    motif: "dragon lance",
    color: "#7C3F28",
    crown: "M220 252 L410 252 L342 184 L300 232 L260 184 Z",
  },
  {
    rank: 4,
    nameJa: "騎士",
    motif: "shield guard",
    color: "#5D6B7A",
    crown: "M254 222 H376 L346 164 H284 Z",
  },
  {
    rank: 5,
    nameJa: "人間の戦士",
    motif: "standard warrior",
    color: "#2F6F66",
    crown: "M250 232 H380 L350 184 H280 Z",
  },
  {
    rank: 6,
    nameJa: "貴族",
    motif: "banner noble",
    color: "#8A6A2A",
    crown: "M238 236 L314 176 L390 236 Z",
  },
  {
    rank: 7,
    nameJa: "王",
    motif: "royal crest",
    color: "#9A5B22",
    crown: "M220 230 L260 154 L314 220 L368 154 L410 230 Z",
  },
  {
    rank: 8,
    nameJa: "天使",
    motif: "winged halo",
    color: "#6578B8",
    crown: "M230 240 C270 160 360 160 400 240 Z",
  },
  {
    rank: 9,
    nameJa: "神",
    motif: "radiant deity",
    color: "#B68A2E",
    crown:
      "M314 112 L350 218 L462 218 L372 282 L406 392 L314 328 L222 392 L256 282 L166 218 L278 218 Z",
  },
];

const SUITS = [
  {
    key: "fire",
    code: "SUIT_FIRE",
    nameJa: "火",
    color: "#D84A2B",
    cue: "spikes",
  },
  {
    key: "water",
    code: "SUIT_WATER",
    nameJa: "水",
    color: "#2577B8",
    cue: "waves",
  },
  {
    key: "wind",
    code: "SUIT_WIND",
    nameJa: "風",
    color: "#31886B",
    cue: "swirls",
  },
  {
    key: "earth",
    code: "SUIT_EARTH",
    nameJa: "土",
    color: "#8A6A2A",
    cue: "diamonds",
  },
];

const SKILLS = [
  {
    assetId: "m3-skill-joker-hero",
    todoId: "M3-GR-03",
    skillCode: "SKILL_JOKER_HERO",
    nameJa: "勇者Joker",
    motif: "sun sword joker",
    color: "#D84A2B",
  },
  {
    assetId: "m3-skill-joker-saint",
    todoId: "M3-GR-03",
    skillCode: "SKILL_JOKER_SAINT",
    nameJa: "聖女Joker",
    motif: "moon chalice joker",
    color: "#2577B8",
  },
  {
    assetId: "m3-skill-extension-seal",
    todoId: "M3-GR-04",
    skillCode: "SKILL_EXTENSION_SEAL",
    nameJa: "追加封印",
    motif: "chain and wax seal",
    color: "#8A6A2A",
  },
  {
    assetId: "m3-skill-revolution",
    todoId: "M3-GR-04",
    skillCode: "SKILL_REVOLUTION",
    nameJa: "革命",
    motif: "day night reversal arrows",
    color: "#31886B",
  },
];

const TUTORIALS = [
  {
    panelId: "m3-tutorial-strength-order",
    title: "昼夜で強弱が反転",
    focus: "strength-order",
  },
  {
    panelId: "m3-tutorial-lead-update",
    title: "場なしから更新とパス",
    focus: "lead-update",
  },
  { panelId: "m3-tutorial-locks", title: "縛りと追加封印", focus: "locks" },
  { panelId: "m3-tutorial-skills", title: "4つの初期スキル", focus: "skills" },
  {
    panelId: "m3-tutorial-history-stats",
    title: "履歴と戦績",
    focus: "history-stats",
  },
];

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function svg(sizeKey, title, desc, body) {
  const size = SIZES[sizeKey];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="${size.viewBox}" role="img" aria-labelledby="t d"><title id="t">${title}</title><desc id="d">${desc}</desc>${body}</svg>\n`;
}

function rankSilhouette(entry) {
  const halo =
    entry.rank >= 8
      ? `<circle cx="315" cy="235" r="145" fill="none" stroke="${GOLD}" stroke-width="18" stroke-dasharray="18 16"/>`
      : "";
  const wings =
    entry.rank === 8
      ? `<path d="M178 356 C82 276 72 458 188 480" fill="${SILVER}" stroke="${INK}" stroke-width="8"/><path d="M452 356 C548 276 558 458 442 480" fill="${SILVER}" stroke="${INK}" stroke-width="8"/>`
      : "";
  return `${halo}${wings}<path d="${entry.crown}" fill="${GOLD}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><circle cx="315" cy="306" r="78" fill="${entry.color}" stroke="${INK}" stroke-width="8"/><path d="M206 642 C226 488 404 488 424 642 Z" fill="${entry.color}" stroke="${INK}" stroke-width="8"/><path d="M180 676 H450" stroke="${INK}" stroke-width="18" stroke-linecap="round"/>`;
}

function rankSvg(entry) {
  return svg(
    "cardIllust",
    `M3 rank illustration rough: rank ${entry.rank} ${entry.nameJa}`,
    `Editable SVG rough for ${entry.nameJa}, using ${entry.motif} and a large rank number for small-size readability.`,
    `<rect width="630" height="882" fill="${PAPER}"/>` +
      `<rect x="18" y="18" width="594" height="846" rx="28" fill="none" stroke="${INK}" stroke-width="6" stroke-dasharray="18 12"/>` +
      rankSilhouette(entry) +
      `<text x="315" y="820" font-family="Arial, sans-serif" font-size="184" font-weight="700" text-anchor="middle" fill="${INK}">${entry.rank}</text>`,
  );
}

function framePattern(suit) {
  if (suit.cue === "spikes") {
    return Array.from(
      { length: 18 },
      (_, i) =>
        `<path d="M${54 + i * 36} 52 L${72 + i * 36} 20 L${90 + i * 36} 52 Z" fill="${suit.color}"/>`,
    ).join("");
  }
  if (suit.cue === "waves") {
    return `<path d="M54 48 Q102 18 150 48 T246 48 T342 48 T438 48 T534 48 T630 48 T696 48" fill="none" stroke="${suit.color}" stroke-width="16"/>`;
  }
  if (suit.cue === "swirls") {
    return Array.from(
      { length: 7 },
      (_, i) =>
        `<path d="M${90 + i * 94} 34 c44 -24 66 30 20 48 c-36 14 -54 -22 -16 -34" fill="none" stroke="${suit.color}" stroke-width="12" stroke-linecap="round"/>`,
    ).join("");
  }
  return Array.from(
    { length: 12 },
    (_, i) =>
      `<path d="M${72 + i * 56} 20 L${100 + i * 56} 50 L${72 + i * 56} 80 L${44 + i * 56} 50 Z" fill="${suit.color}"/>`,
  ).join("");
}

function frameSvg(suit) {
  const edge = framePattern(suit);
  return svg(
    "frame",
    `M3 finalizable attribute frame rough: ${suit.nameJa}`,
    `Attribute frame for ${suit.nameJa}, distinguishable by ${suit.cue} shape cues as well as colour.`,
    `<rect width="750" height="1050" fill="none"/>` +
      `<rect x="22" y="22" width="706" height="1006" rx="30" fill="none" stroke="${suit.color}" stroke-width="24"/>` +
      `<rect x="58" y="58" width="634" height="934" rx="18" fill="none" stroke="${INK}" stroke-width="5"/>` +
      `<g>${edge}</g><g transform="translate(0 1050) scale(1 -1)">${edge}</g>`,
  );
}

function emblemShape(suit) {
  if (suit.key === "fire")
    return "M100 16 C154 70 130 96 166 146 C134 132 124 172 100 186 C76 172 66 132 34 146 C70 96 46 70 100 16 Z";
  if (suit.key === "water")
    return "M100 12 C146 74 166 108 154 144 C142 180 110 192 80 182 C42 168 36 124 58 90 C72 68 88 44 100 12 Z";
  if (suit.key === "wind")
    return "M28 102 C70 54 150 62 142 104 C136 134 88 120 112 92 C138 62 182 90 170 132 C154 188 58 172 38 138";
  return "M100 14 L178 78 L150 176 H50 L22 78 Z";
}

function emblemSvg(suit) {
  return svg(
    "emblem",
    `M3 attribute emblem rough: ${suit.nameJa}`,
    `Compact emblem for ${suit.nameJa}, readable by silhouette without relying on colour alone.`,
    `<rect width="200" height="200" fill="none"/>` +
      `<path d="${emblemShape(suit)}" fill="${suit.color}" stroke="${INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>`,
  );
}

function skillCenter(skill) {
  if (skill.skillCode === "SKILL_JOKER_HERO")
    return `<circle cx="375" cy="300" r="118" fill="#F8D36A" stroke="${INK}" stroke-width="8"/><path d="M375 166 V436 M290 246 L460 416 M460 246 L290 416" stroke="${INK}" stroke-width="18" stroke-linecap="round"/><path d="M350 520 L400 520 L390 760 L360 760 Z" fill="${SILVER}" stroke="${INK}" stroke-width="8"/>`;
  if (skill.skillCode === "SKILL_JOKER_SAINT")
    return `<path d="M292 236 A118 118 0 1 0 476 380 A92 92 0 1 1 292 236 Z" fill="#E9EEF7" stroke="${INK}" stroke-width="8"/><path d="M290 520 C290 438 460 438 460 520 C460 620 420 714 375 760 C330 714 290 620 290 520 Z" fill="#C8DDF4" stroke="${INK}" stroke-width="8"/>`;
  if (skill.skillCode === "SKILL_EXTENSION_SEAL")
    return `<path d="M168 390 C250 310 500 470 582 390" fill="none" stroke="${SHADOW}" stroke-width="34" stroke-linecap="round" stroke-dasharray="54 34"/><circle cx="375" cy="520" r="114" fill="#C84D3A" stroke="${INK}" stroke-width="8"/><path d="M318 520 H432 M375 462 V578" stroke="${PAPER}" stroke-width="24" stroke-linecap="round"/>`;
  return `<path d="M210 294 C300 174 474 184 536 320" fill="none" stroke="${skill.color}" stroke-width="30" stroke-linecap="round"/><path d="M536 320 L486 306 L516 260" fill="none" stroke="${skill.color}" stroke-width="30" stroke-linecap="round"/><path d="M540 582 C450 702 276 692 214 556" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round"/><path d="M214 556 L264 570 L234 616" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round"/><circle cx="302" cy="440" r="78" fill="#F7D36A"/><path d="M448 440 A78 78 0 1 0 448 596 A58 58 0 1 1 448 440 Z" fill="#E9EEF7" stroke="${INK}" stroke-width="6"/>`;
}

function skillSvg(skill) {
  return svg(
    "skillCard",
    `M3 skill card candidate rough: ${skill.nameJa}`,
    `Candidate card art for ${skill.nameJa}, marked by ${skill.motif}.`,
    `<rect width="750" height="1050" rx="34" fill="${PAPER}"/>` +
      `<rect x="26" y="26" width="698" height="998" rx="28" fill="none" stroke="${skill.color}" stroke-width="24"/>` +
      `<text x="375" y="128" font-family="Arial, sans-serif" font-size="62" font-weight="700" text-anchor="middle" fill="${INK}">${skill.nameJa}</text>` +
      skillCenter(skill) +
      `<text x="375" y="940" font-family="Arial, sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="${INK}">SKILL</text>`,
  );
}

function card(x, y, label, color = PAPER) {
  return `<g transform="translate(${x} ${y})"><rect width="116" height="162" rx="12" fill="${color}" stroke="${INK}" stroke-width="5"/><text x="58" y="98" font-family="Arial, sans-serif" font-size="54" font-weight="700" text-anchor="middle" fill="${INK}">${label}</text></g>`;
}

function arrow(x1, y1, x2, y2, color = INK) {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${color}" stroke-width="12" stroke-linecap="round"/><path d="M${x2} ${y2} l-34 -22 l10 40 l24 -18 Z" fill="${color}"/>`;
}

function tutorialBody(panel) {
  const base = `<rect width="1280" height="720" fill="#F4F0E8"/><rect x="40" y="40" width="1200" height="640" rx="28" fill="#EEF5F1" stroke="${INK}" stroke-width="6"/><text x="80" y="120" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="${INK}">${panel.title}</text>`;
  if (panel.focus === "strength-order")
    return (
      base +
      `<text x="120" y="230" font-family="Arial, sans-serif" font-size="40" fill="${INK}">DAY</text>${card(120, 270, "1")}${card(260, 270, "5")}${card(400, 270, "9")}${arrow(560, 350, 690, 350, GOLD)}<text x="780" y="230" font-family="Arial, sans-serif" font-size="40" fill="${INK}">NIGHT</text>${card(780, 270, "9", "#DDE5F2")}${card(920, 270, "5", "#DDE5F2")}${card(1060, 270, "1", "#DDE5F2")}`
    );
  if (panel.focus === "lead-update")
    return (
      base +
      `${card(146, 278, "6")}${arrow(292, 360, 430, 360)}${card(474, 278, "7", "#F9E5C0")}${arrow(620, 360, 756, 360)}<g transform="translate(820 310)"><rect width="240" height="104" rx="18" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/><text x="120" y="68" font-family="Arial, sans-serif" font-size="48" font-weight="700" text-anchor="middle" fill="${INK}">PASS</text></g>`
    );
  if (panel.focus === "locks")
    return (
      base +
      `${card(112, 288, "3")}${card(246, 288, "3")}${card(380, 288, "3")}<path d="M104 488 H508" stroke="${GOLD}" stroke-width="18" stroke-linecap="round"/><text x="590" y="360" font-family="Arial, sans-serif" font-size="42" fill="${INK}">COUNT / SUIT / SEAL</text><path d="M920 260 H1090 V520 H920 Z" fill="none" stroke="#C84D3A" stroke-width="16" stroke-dasharray="28 20"/><circle cx="1005" cy="390" r="70" fill="#C84D3A" stroke="${INK}" stroke-width="6"/>`
    );
  if (panel.focus === "skills")
    return (
      base +
      `${card(104, 290, "J", "#F8D36A")}${card(280, 290, "J", "#DDE5F2")}${card(456, 290, "封", "#E9D8B6")}${card(632, 290, "革", "#DDEFE4")}<text x="850" y="350" font-family="Arial, sans-serif" font-size="42" fill="${INK}">CLEAR / TRANSFORM / SEAL / REV</text>${arrow(858, 410, 1030, 498, "#31886B")}`
    );
  return (
    base +
    `<g transform="translate(130 260)"><rect width="330" height="270" rx="22" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/><text x="165" y="92" font-family="Arial, sans-serif" font-size="52" font-weight="700" text-anchor="middle" fill="${INK}">HISTORY</text><path d="M62 140 H268 M62 186 H248 M62 232 H210" stroke="${SHADOW}" stroke-width="12" stroke-linecap="round"/></g><g transform="translate(690 260)"><rect width="330" height="270" rx="22" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/><text x="165" y="92" font-family="Arial, sans-serif" font-size="52" font-weight="700" text-anchor="middle" fill="${INK}">STATS</text><rect x="78" y="132" width="44" height="92" fill="#31886B"/><rect x="144" y="104" width="44" height="120" fill="#2577B8"/><rect x="210" y="72" width="44" height="152" fill="#D84A2B"/></g>${arrow(498, 396, 660, 396, GOLD)}`
  );
}

function tutorialSvg(panel) {
  return svg(
    "tutorialPanel",
    `M3 tutorial panel rough: ${panel.title}`,
    `Wide tutorial diagram for ${panel.title}, designed for the first-run tutorial flow.`,
    tutorialBody(panel),
  );
}

const manifest = {
  todoIds: ["M3-GR-01", "M3-GR-02", "M3-GR-03", "M3-GR-04", "M3-GR-05"],
  version: "0.1.0",
  status: "rough-svg-for-m3-alpha",
  sizes: SIZES,
  rankIllustrations: [],
  attributeFrames: [],
  attributeEmblems: [],
  skillCandidates: [],
  tutorialPanels: [],
};

function emit(assetId, subdir, content, extra) {
  const sourcePath = `assets/source/m3/${subdir}/${assetId}.source.svg`;
  const runtimePath = `assets/runtime/m3/${subdir}/${assetId}.svg`;
  write(sourcePath, content);
  write(runtimePath, content);
  return { assetId, sourcePath, runtimePath, ...extra };
}

for (const rank of RANKS) {
  manifest.rankIllustrations.push(
    emit(`m3-rank-${rank.rank}-rough`, "card-illustrations", rankSvg(rank), {
      todoId: "M3-GR-01",
      rank: rank.rank,
      rankCode: `RANK_${rank.rank}`,
      nameJa: rank.nameJa,
      size: "cardIllust",
    }),
  );
}

for (const suit of SUITS) {
  manifest.attributeFrames.push(
    emit(`m3-frame-${suit.key}`, "frames", frameSvg(suit), {
      todoId: "M3-GR-02",
      suitCode: suit.code,
      nameJa: suit.nameJa,
      shapeCue: suit.cue,
      size: "frame",
    }),
  );
  manifest.attributeEmblems.push(
    emit(`m3-emblem-${suit.key}`, "emblems", emblemSvg(suit), {
      todoId: "M3-GR-02",
      suitCode: suit.code,
      nameJa: suit.nameJa,
      size: "emblem",
    }),
  );
}

for (const skill of SKILLS) {
  manifest.skillCandidates.push(
    emit(skill.assetId, "skill-candidates", skillSvg(skill), {
      todoId: skill.todoId,
      skillCode: skill.skillCode,
      nameJa: skill.nameJa,
      size: "skillCard",
    }),
  );
}

for (const panel of TUTORIALS) {
  manifest.tutorialPanels.push(
    emit(panel.panelId, "tutorial", tutorialSvg(panel), {
      todoId: "M3-GR-05",
      panelId: panel.panelId,
      titleJa: panel.title,
      size: "tutorialPanel",
    }),
  );
}

write(
  "assets/manifests/m3-graphics-assets.json",
  await prettier.format(JSON.stringify(manifest), { parser: "json" }),
);

const total =
  manifest.rankIllustrations.length +
  manifest.attributeFrames.length +
  manifest.attributeEmblems.length +
  manifest.skillCandidates.length +
  manifest.tutorialPanels.length;
console.log(`M3 graphics rough assets generated (${total} assets)`);
