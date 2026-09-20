import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";

/** Width/height from a PNG's IHDR, or null if `buf` is not a PNG. */
export function pngSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf.toString("binary", 0, 8) !== PNG_SIGNATURE) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Width/height from a JPEG's SOF0/SOF2 segment, or null if `buf` is not a JPEG. */
export function jpegSize(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) return null; // EOI reached without finding a SOF
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (offset + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    const segLength = buf.readUInt16BE(offset + 2);
    offset += 2 + segLength;
  }
  return null;
}

const SUITS = ["fire", "water", "wind", "earth"];

/** Validate the manifest and any present PNGs. Pure-ish: returns a report. */
export function checkCardsFull({
  manifestPath = "assets/manifests/cards-full.json",
  root = process.cwd(),
  requireAll = false,
} = {}) {
  const errors = [];
  const push = (m) => errors.push(m);
  const manifest = JSON.parse(
    readFileSync(resolve(root, manifestPath), "utf8"),
  );

  if (!Array.isArray(manifest.cards) || manifest.cards.length !== 36) {
    push(`manifest must list 36 cards, has ${manifest.cards?.length}`);
  }

  const seenCards = new Set();
  const seenIds = new Set();
  let present = 0;
  let missing = 0;

  for (const c of manifest.cards ?? []) {
    const cardKey = `${c.rank}-${c.suit}`;
    if (seenCards.has(cardKey)) push(`duplicate card ${cardKey}`);
    seenCards.add(cardKey);
    if (seenIds.has(c.assetId)) push(`duplicate assetId ${c.assetId}`);
    seenIds.add(c.assetId);
    if (c.assetId !== `card-${c.rank}-${c.suit}`) {
      push(
        `${c.cardId}: assetId must be card-${c.rank}-${c.suit}, is ${c.assetId}`,
      );
    }
    if (c.path !== `assets/cards/full/${c.assetId}.jpg`)
      push(`${c.cardId}: path mismatch (${c.path})`);

    const abs = resolve(root, c.path);
    if (!existsSync(abs)) {
      missing += 1;
      if (requireAll) push(`missing ${c.path}`);
      continue;
    }
    present += 1;
    const buf = readFileSync(abs);
    const size = jpegSize(buf);
    if (!size) {
      push(`${c.path} is not a JPEG`);
      continue;
    }
    if (
      size.width !== manifest.size.width ||
      size.height !== manifest.size.height
    ) {
      push(
        `${c.path} is ${size.width}x${size.height}, must be ${manifest.size.width}x${manifest.size.height}`,
      );
    }
    const bytes = statSync(abs).size;
    if (bytes > manifest.maxBytes) {
      push(
        `${c.path} is ${bytes} bytes, over ${manifest.maxBytes}`,
      );
    }
  }

  for (let r = 1; r <= 9; r += 1) {
    for (const s of SUITS) {
      if (!seenCards.has(`${r}-${s}`)) push(`manifest missing card ${r}-${s}`);
    }
  }

  return { present, missing, errors };
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { present, missing, errors } = checkCardsFull({
    requireAll: process.argv.includes("--require-all"),
  });
  for (const e of errors) console.error("✗ " + e);
  console.log(`cards-full: ${present} present, ${missing} missing`);
  if (errors.length) {
    console.error("cards-full asset check FAILED");
    process.exit(1);
  }
  console.log("cards-full asset check passed");
}
