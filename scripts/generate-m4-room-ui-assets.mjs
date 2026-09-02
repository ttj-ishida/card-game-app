import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import prettier from "../apps/mobile/node_modules/prettier/index.mjs";

const INK = "#1F2933";
const PAPER = "#F7F1E6";
const PANEL = "#EAF2EF";
const GOLD = "#D9A441";
const BLUE = "#2577B8";
const GREEN = "#31886B";
const RED = "#D84A2B";
const VIOLET = "#6B5DA8";
const GRAY = "#59636E";
const MUTED = "#C8D0D8";
const NIGHT = "#263645";

const SIZES = {
  roomLayout: {
    width: 1280,
    height: 720,
    viewBox: "0 0 1280 720",
    maxBytes: 52000,
  },
  badge: { width: 320, height: 320, viewBox: "0 0 320 320", maxBytes: 18000 },
};

const ROOM_LAYOUTS = [2, 3, 4, 5, 6];
const SEAT_BADGES = [
  {
    assetId: "m4-seat-host",
    role: "HOST",
    label: "HOST",
    color: GOLD,
    shape: "crown",
  },
  {
    assetId: "m4-seat-guest",
    role: "GUEST",
    label: "GUEST",
    color: BLUE,
    shape: "person",
  },
  {
    assetId: "m4-seat-empty",
    role: "EMPTY",
    label: "OPEN",
    color: MUTED,
    shape: "plus",
  },
  {
    assetId: "m4-seat-cpu-takeover",
    role: "CPU_TAKEOVER",
    label: "CPU",
    color: VIOLET,
    shape: "chip",
  },
];
const READY_BADGES = [
  {
    assetId: "m4-ready-ready",
    readyState: "READY",
    label: "READY",
    color: GREEN,
    shape: "check",
  },
  {
    assetId: "m4-ready-waiting",
    readyState: "WAITING",
    label: "WAIT",
    color: GOLD,
    shape: "hourglass",
  },
  {
    assetId: "m4-ready-locked",
    readyState: "LOCKED",
    label: "LOCK",
    color: GRAY,
    shape: "lock",
  },
];
const CONNECTION_BADGES = [
  {
    assetId: "m4-connection-online",
    connectionState: "ONLINE",
    label: "ON",
    color: GREEN,
    shape: "signal",
  },
  {
    assetId: "m4-connection-connecting",
    connectionState: "CONNECTING",
    label: "SYNC",
    color: BLUE,
    shape: "sync",
  },
  {
    assetId: "m4-connection-offline",
    connectionState: "OFFLINE",
    label: "OFF",
    color: RED,
    shape: "slash",
  },
];
const OPPONENT_HAND_BACKS = [
  {
    assetId: "m4-opponent-hand-low",
    handCountBand: "LOW",
    label: "1-4",
    stackCount: 2,
    color: BLUE,
  },
  {
    assetId: "m4-opponent-hand-mid",
    handCountBand: "MID",
    label: "5-9",
    stackCount: 4,
    color: GOLD,
  },
  {
    assetId: "m4-opponent-hand-high",
    handCountBand: "HIGH",
    label: "10+",
    stackCount: 6,
    color: VIOLET,
  },
];
const OPPONENT_SKILL_BADGES = [
  {
    assetId: "m4-opponent-skill-unknown",
    skillState: "UNKNOWN",
    label: "?",
    color: GRAY,
    shape: "question",
  },
  {
    assetId: "m4-opponent-skill-held",
    skillState: "HELD",
    label: "SKILL",
    color: GOLD,
    shape: "spark",
  },
  {
    assetId: "m4-opponent-skill-used",
    skillState: "USED",
    label: "USED",
    color: MUTED,
    shape: "spent",
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

function seatPosition(index, count) {
  const centerX = 640;
  const centerY = 374;
  const rx = 438;
  const ry = 236;
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return {
    x: Math.round(centerX + Math.cos(angle) * rx),
    y: Math.round(centerY + Math.sin(angle) * ry),
  };
}

function miniCard(x, y, rotate = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate})"><rect x="-22" y="-32" width="44" height="64" rx="6" fill="${PAPER}" stroke="${INK}" stroke-width="3"/><path d="M-10 -12 H10 M-10 4 H10 M-10 20 H6" stroke="${GRAY}" stroke-width="4" stroke-linecap="round"/></g>`;
}

function personIcon(x, y, color) {
  return `<circle cx="${x}" cy="${y - 22}" r="22" fill="${color}" stroke="${INK}" stroke-width="5"/><path d="M${x - 44} ${y + 50} C${x - 34} ${y + 4} ${x + 34} ${y + 4} ${x + 44} ${y + 50} Z" fill="${color}" stroke="${INK}" stroke-width="5"/>`;
}

function roomLayoutSvg(playerCount) {
  const seats = Array.from({ length: playerCount }, (_, index) => {
    const { x, y } = seatPosition(index, playerCount);
    const isHost = index === 0;
    const ready = index % 3 !== 1;
    const fill = isHost ? "#FFF4C9" : ready ? "#E3F2EC" : "#EEF1F4";
    const badge = isHost ? "HOST" : ready ? "READY" : "WAIT";
    return `<g transform="translate(${x - 78} ${y - 70})"><rect width="156" height="140" rx="20" fill="${fill}" stroke="${INK}" stroke-width="5"/><circle cx="78" cy="48" r="28" fill="${isHost ? GOLD : BLUE}" stroke="${INK}" stroke-width="4"/><path d="M34 116 H122" stroke="${ready ? GREEN : GRAY}" stroke-width="12" stroke-linecap="round"/><text x="78" y="98" font-family="Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="${INK}">${badge}</text></g>`;
  }).join("");

  const cards = Array.from({ length: Math.min(playerCount + 2, 8) }, (_, i) =>
    miniCard(504 + i * 38, 372, -18 + i * 5),
  ).join("");

  return svg(
    "roomLayout",
    `M4 friend room layout rough: ${playerCount} seats`,
    `${playerCount}-player waiting-room layout showing host, ready states, open table center, and readable seat count for M4 alpha.`,
    `<rect width="1280" height="720" fill="${PAPER}"/>` +
      `<rect x="44" y="42" width="1192" height="636" rx="34" fill="${PANEL}" stroke="${INK}" stroke-width="6"/>` +
      `<ellipse cx="640" cy="374" rx="300" ry="160" fill="#FFFFFF" stroke="${INK}" stroke-width="8"/>` +
      `<text x="640" y="116" font-family="Arial, sans-serif" font-size="54" font-weight="700" text-anchor="middle" fill="${INK}">FRIEND ROOM ${playerCount}P</text>` +
      cards +
      `<text x="640" y="472" font-family="Arial, sans-serif" font-size="38" font-weight="700" text-anchor="middle" fill="${INK}">2-6 PLAYERS / READY CHECK</text>` +
      seats +
      `<path d="M100 610 H1180" stroke="${GOLD}" stroke-width="12" stroke-linecap="round" stroke-dasharray="30 22"/>`,
  );
}

function badgeCenter(shape, color) {
  if (shape === "crown") {
    return `<path d="M82 154 L118 88 L160 146 L202 88 L238 154 Z" fill="${GOLD}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><rect x="92" y="154" width="136" height="42" rx="10" fill="${color}" stroke="${INK}" stroke-width="8"/>`;
  }
  if (shape === "person") return personIcon(160, 148, color);
  if (shape === "plus")
    return `<path d="M160 82 V214 M94 148 H226" stroke="${INK}" stroke-width="24" stroke-linecap="round"/><circle cx="160" cy="148" r="102" fill="none" stroke="${color}" stroke-width="18" stroke-dasharray="26 18"/>`;
  if (shape === "chip")
    return `<rect x="78" y="82" width="164" height="132" rx="24" fill="${color}" stroke="${INK}" stroke-width="8"/><circle cx="126" cy="132" r="12" fill="${PAPER}"/><circle cx="194" cy="132" r="12" fill="${PAPER}"/><path d="M126 178 H194" stroke="${PAPER}" stroke-width="12" stroke-linecap="round"/><path d="M74 112 H42 M246 112 H278 M74 184 H42 M246 184 H278" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>`;
  if (shape === "check")
    return `<path d="M82 164 L134 214 L238 96" fill="none" stroke="${color}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (shape === "hourglass")
    return `<path d="M104 78 H216 M104 236 H216 M118 84 C118 134 202 134 202 160 C202 186 118 186 118 236" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M132 104 H188 L160 146 Z M132 218 H188 L160 174 Z" fill="${color}"/>`;
  if (shape === "lock")
    return `<rect x="88" y="140" width="144" height="96" rx="18" fill="${color}" stroke="${INK}" stroke-width="8"/><path d="M116 140 V112 C116 56 204 56 204 112 V140" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>`;
  if (shape === "signal")
    return `<circle cx="160" cy="206" r="16" fill="${color}"/><path d="M104 166 C136 134 184 134 216 166 M72 128 C122 78 198 78 248 128" fill="none" stroke="${color}" stroke-width="20" stroke-linecap="round"/>`;
  if (shape === "sync")
    return `<path d="M92 128 C126 82 196 82 228 130 L244 114 M228 130 L212 104" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="M228 194 C194 238 124 238 92 190 L76 206 M92 190 L108 216" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (shape === "question")
    return `<circle cx="160" cy="148" r="96" fill="${color}" stroke="${INK}" stroke-width="8"/><text x="160" y="184" font-family="Arial, sans-serif" font-size="116" font-weight="700" text-anchor="middle" fill="${PAPER}">?</text>`;
  if (shape === "spark")
    return `<path d="M160 56 L184 124 L256 148 L184 172 L160 244 L136 172 L64 148 L136 124 Z" fill="${color}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><circle cx="160" cy="148" r="34" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>`;
  if (shape === "spent")
    return `<path d="M94 92 H226 V206 H94 Z" fill="${color}" stroke="${INK}" stroke-width="8"/><path d="M86 226 H234 M102 74 L218 224" stroke="${RED}" stroke-width="16" stroke-linecap="round"/>`;
  return `<path d="M90 90 L230 230" stroke="${color}" stroke-width="28" stroke-linecap="round"/><circle cx="160" cy="160" r="100" fill="none" stroke="${INK}" stroke-width="10"/>`;
}

function badgeSvg(group, item) {
  return svg(
    "badge",
    `M4 ${group} badge rough: ${item.label}`,
    `Compact ${group} badge for ${item.label}, using shape and label cues so status is not colour-only.`,
    `<rect width="320" height="320" fill="none"/>` +
      `<rect x="22" y="22" width="276" height="276" rx="38" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>` +
      badgeCenter(item.shape, item.color) +
      `<text x="160" y="282" font-family="Arial, sans-serif" font-size="42" font-weight="700" text-anchor="middle" fill="${INK}">${item.label}</text>`,
  );
}

function cardBack(x, y, rotate, color) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate})"><rect x="-44" y="-62" width="88" height="124" rx="12" fill="${NIGHT}" stroke="${INK}" stroke-width="5"/><rect x="-32" y="-50" width="64" height="100" rx="8" fill="${color}" opacity="0.86"/><path d="M-22 -30 H22 M-22 -6 H22 M-22 18 H22" stroke="${PAPER}" stroke-width="7" stroke-linecap="round"/><circle cx="0" cy="38" r="10" fill="${PAPER}"/></g>`;
}

function opponentHandBackSvg(item) {
  const spread = Array.from({ length: item.stackCount }, (_, index) => {
    const offset = index - (item.stackCount - 1) / 2;
    return cardBack(
      160 + offset * 18,
      142 + Math.abs(offset) * 3,
      offset * 7,
      item.color,
    );
  }).join("");

  return svg(
    "badge",
    `M4 opponent hidden hand rough: ${item.handCountBand}`,
    `Opponent hidden hand indicator for the ${item.label} remaining-card band; count is visible without revealing card faces.`,
    `<rect width="320" height="320" fill="none"/>` +
      `<rect x="18" y="24" width="284" height="272" rx="36" fill="${PANEL}" stroke="${INK}" stroke-width="6"/>` +
      spread +
      `<rect x="88" y="224" width="144" height="52" rx="16" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>` +
      `<text x="160" y="262" font-family="Arial, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="${INK}">${item.label}</text>`,
  );
}

const manifest = {
  todoIds: ["M4-GR-01", "M4-GR-03"],
  version: "0.1.0",
  status: "rough-svg-for-m4-alpha",
  sizes: SIZES,
  roomLayouts: [],
  seatBadges: [],
  readyStateBadges: [],
  connectionBadges: [],
  opponentHandBacks: [],
  opponentSkillBadges: [],
};

function emit(assetId, subdir, content, extra) {
  const sourcePath = `assets/source/m4/room-ui/${subdir}/${assetId}.source.svg`;
  const runtimePath = `assets/runtime/m4/room-ui/${subdir}/${assetId}.svg`;
  write(sourcePath, content);
  write(runtimePath, content);
  return { assetId, sourcePath, runtimePath, todoId: "M4-GR-01", ...extra };
}

for (const playerCount of ROOM_LAYOUTS) {
  manifest.roomLayouts.push(
    emit(
      `m4-room-layout-${playerCount}p`,
      "layouts",
      roomLayoutSvg(playerCount),
      {
        playerCount,
        size: "roomLayout",
      },
    ),
  );
}

for (const badge of SEAT_BADGES) {
  manifest.seatBadges.push(
    emit(badge.assetId, "seat-badges", badgeSvg("seat role", badge), {
      role: badge.role,
      size: "badge",
    }),
  );
}

for (const badge of READY_BADGES) {
  manifest.readyStateBadges.push(
    emit(badge.assetId, "ready-badges", badgeSvg("ready state", badge), {
      readyState: badge.readyState,
      size: "badge",
    }),
  );
}

for (const badge of CONNECTION_BADGES) {
  manifest.connectionBadges.push(
    emit(
      badge.assetId,
      "connection-badges",
      badgeSvg("connection state", badge),
      {
        connectionState: badge.connectionState,
        size: "badge",
      },
    ),
  );
}

for (const handBack of OPPONENT_HAND_BACKS) {
  manifest.opponentHandBacks.push(
    emit(
      handBack.assetId,
      "opponent-hand-backs",
      opponentHandBackSvg(handBack),
      {
        todoId: "M4-GR-03",
        handCountBand: handBack.handCountBand,
        remainingCardsLabel: handBack.label,
        size: "badge",
      },
    ),
  );
}

for (const badge of OPPONENT_SKILL_BADGES) {
  manifest.opponentSkillBadges.push(
    emit(
      badge.assetId,
      "opponent-skill-badges",
      badgeSvg("opponent skill", badge),
      {
        todoId: "M4-GR-03",
        skillState: badge.skillState,
        size: "badge",
      },
    ),
  );
}

write(
  "assets/manifests/m4-room-ui-assets.json",
  await prettier.format(JSON.stringify(manifest), { parser: "json" }),
);

const total =
  manifest.roomLayouts.length +
  manifest.seatBadges.length +
  manifest.readyStateBadges.length +
  manifest.connectionBadges.length +
  manifest.opponentHandBacks.length +
  manifest.opponentSkillBadges.length;
console.log(`M4 room UI rough assets generated (${total} assets)`);
