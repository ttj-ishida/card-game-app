# SP4a — Number-card render layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `CardFace` so number cards render as baked full-art images when available, with a themed vector fallback and a small-size legibility overlay, and scaffold the asset pipeline — without shipping the 36 artworks yet.

**Architecture:** A single size table (`cardMetrics.ts`) becomes the source of truth for every card-rendering consumer (`CardFace`, `HandFan`, `FieldTrail` layout, `SkillMiniCard`). `CardFace` composites: an `<Image>` when `resolveCardArt(rank, suit)` finds a bundled PNG, otherwise a drawn vector card; below a width threshold it adds a code-drawn rank badge + suit emblem over the image. A generator script writes a literal-`require` map from whatever PNGs exist in `assets/cards/full/`; a check script validates the manifest and any present PNGs. SP4b later drops the 36 PNGs and regenerates the map.

**Tech Stack:** React Native 0.86 / React 19 / Expo 57, `react-native-svg` 15.15.4 (already a dep — no new deps), TypeScript, `node:test` via `tsx` (no React Testing Library), theme via `useThemedStyles`, Node `.mjs` scripts run by plain `node`.

**Spec:** `docs/superpowers/specs/2026-09-08-sp4a-number-card-render-design.md`

## Global Constraints

- No new npm dependencies. `react-native-svg@15.15.4` is already installed.
- No `game-core` / rules changes. Number cards stay `{ rank: 1..9, suitCode: SUIT_FIRE|SUIT_WATER|SUIT_WIND|SUIT_EARTH }`.
- Tests are `node:test` files run by `tsx --test src/**/*.test.ts`; `.ts` only; no RTL; extract pure logic and test that.
- Theme: colours come from `useTheme()` / `useThemedStyles(makeStyles)`; suit colours are `colors.suit.{fire,water,wind,earth}`; gold accent is `ACCENT` = `#C9A94E` (from `../../components` / `./buttonStyle`).
- i18n: Japanese only, one dictionary in `apps/mobile/src/i18n/translate.ts`; add keys there; read with `translate('key')`.
- UI-A11Y-002: a suit must always be conveyed by shape/symbol, never colour alone.
- Card aspect ratio is 5:7 (`height = round(width * 7/5)`).
- Full-art image spec (SP4b fills it): PNG, exactly **832 × 1164**, ≤ **204800** bytes, path `assets/cards/full/card-<rank>-<suit>.png` with `<suit>` ∈ `fire|water|wind|earth`, one per (rank 1-9 × 4 suits) = 36.
- Git: work on `main`; commit only the files listed per task with **explicit paths** (never `git add -A`); end every commit message with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Concurrent editor:** another session actively edits `apps/mobile/src/components/FieldTrail.tsx`, `apps/mobile/src/components/fieldTrailLayout.ts`, `apps/mobile/src/components/HandFan.tsx`, `apps/mobile/src/components/SkillMiniCard.tsx`, and both `play.tsx`. Before Task 7 run `git pull --rebase`; keep that task's diffs minimal (swap literals for imports); do not reformat those files.

## Verification commands (run from repo root unless noted)

- Mobile tests: `cd apps/mobile && npx tsx --test "src/**/*.test.ts"`
- One test file: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardMetrics.test.ts`
- Typecheck: `cd apps/mobile && npx tsc --noEmit`
- Lint (changed files): `cd apps/mobile && npx eslint <path...>`
- Format: `npx prettier --write <path...>` (run from repo root)
- Card-art manifest generator: `node scripts/generate-card-art-manifest.mjs`
- Card-art asset check: `node scripts/check-cards-full-assets.mjs`

---

## File Structure

**New (SP4a):**

- `apps/mobile/src/features/cpu-game/cardMetrics.ts` — `CardFaceSize` type, `CARD_ASPECT`, `CARD_METRICS`, `cardHeight()`, `OVERLAY_BELOW_WIDTH`, `SUIT_SYMBOL`. The only place card pixel sizes are defined.
- `apps/mobile/src/features/cpu-game/cardMetrics.test.ts`
- `apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts` — GENERATED; maps art key → `require()` id. Ships holding `{}` until SP4b.
- `apps/mobile/src/features/cpu-game/cardArt.ts` — `cardArtKey()`, `resolveCardArt()`.
- `apps/mobile/src/features/cpu-game/cardArt.test.ts`
- `apps/mobile/src/features/cpu-game/cardFaceLayers.ts` — `cardFaceLayers(size, hasArt)` → which layers to draw.
- `apps/mobile/src/features/cpu-game/cardFaceLayers.test.ts`
- `scripts/generate-card-art-manifest.mjs` — scans `assets/cards/full/`, writes `cardArtAssets.generated.ts`.
- `scripts/check-cards-full-assets.mjs` — validates `assets/manifests/cards-full.json` + present PNGs. Exports `pngSize`.
- `scripts/check-cards-full-assets.test.mjs` — unit-tests `pngSize`.
- `assets/manifests/cards-full.json` — the 36-card contract.
- `docs/art/SP4-GR-01-number-card-art.md` — art direction for SP4b.

**Modified:**

- `apps/mobile/src/features/cpu-game/CardFace.tsx` — full rebuild.
- `apps/mobile/src/components/HandFan.tsx` — sizes from `cardMetrics`.
- `apps/mobile/src/components/fieldTrailLayout.ts` — widths/height from `cardMetrics`.
- `apps/mobile/src/components/SkillMiniCard.tsx` — sizes from `cardMetrics`.
- `apps/mobile/src/features/catalog/cardCatalog.ts` — add `rank`/`suitCode`/`fullArtPath` to number `CatalogItem`; per-kind assertion.
- `apps/mobile/src/features/catalog/cardCatalog.test.ts` — updated expectations.
- `apps/mobile/src/app/catalog/index.tsx` — render `<CardFace size="catalog">` for number cards; detail modal shows the card name.
- `apps/mobile/src/i18n/translate.ts` — `catalog.numberCard.name.1..9`.
- `package.json` (repo root) — `assets:generate:cards`, `assets:check:cards`, `assets:check:cards:selftest` scripts.

---

## Task 1: Card size source of truth (`cardMetrics.ts`)

**Files:**

- Create: `apps/mobile/src/features/cpu-game/cardMetrics.ts`
- Test: `apps/mobile/src/features/cpu-game/cardMetrics.test.ts`

**Interfaces:**

- Consumes: `SuitCode` from `@ragnarok-millennium/game-core`.
- Produces:
  - `type CardFaceSize = 'catalog' | 'hand' | 'field' | 'mini'`
  - `const CARD_ASPECT = 7 / 5`
  - `const CARD_METRICS: Record<CardFaceSize, { width: number }>`
  - `function cardHeight(width: number): number`
  - `const OVERLAY_BELOW_WIDTH = 120`
  - `const SUIT_SYMBOL: Record<SuitCode, string>`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/cpu-game/cardMetrics.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CARD_ASPECT,
  CARD_METRICS,
  cardHeight,
  OVERLAY_BELOW_WIDTH,
  SUIT_SYMBOL,
} from "./cardMetrics.ts";

test("cardHeight keeps the 5:7 ratio, rounded", () => {
  assert.equal(cardHeight(100), 140);
  assert.equal(
    cardHeight(CARD_METRICS.hand.width),
    Math.round(CARD_METRICS.hand.width * CARD_ASPECT),
  );
});

test("every CardFaceSize has a positive width; sizes are ordered mini < hand < field < catalog", () => {
  for (const size of ["catalog", "hand", "field", "mini"] as const) {
    assert.ok(CARD_METRICS[size].width > 0, `${size} width`);
  }
  assert.ok(CARD_METRICS.mini.width < CARD_METRICS.hand.width);
  assert.ok(CARD_METRICS.hand.width < CARD_METRICS.field.width);
  assert.ok(CARD_METRICS.field.width < CARD_METRICS.catalog.width);
});

test("battle sizes sit below the overlay threshold and catalog above it", () => {
  assert.ok(CARD_METRICS.hand.width < OVERLAY_BELOW_WIDTH);
  assert.ok(CARD_METRICS.field.width < OVERLAY_BELOW_WIDTH);
  assert.ok(CARD_METRICS.mini.width < OVERLAY_BELOW_WIDTH);
  assert.ok(CARD_METRICS.catalog.width >= OVERLAY_BELOW_WIDTH);
});

test("each suit has a distinct symbol", () => {
  assert.equal(new Set(Object.values(SUIT_SYMBOL)).size, 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardMetrics.test.ts`
Expected: FAIL — cannot find module `./cardMetrics.ts`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/features/cpu-game/cardMetrics.ts`:

```ts
import type { SuitCode } from "@ragnarok-millennium/game-core";

/** Where a card is being rendered. Drives its pixel size. */
export type CardFaceSize = "catalog" | "hand" | "field" | "mini";

/** height / width for the 5:7 card. */
export const CARD_ASPECT = 7 / 5;

/**
 * Rendered card width (px) per context — the single source of truth. Consumers
 * (`CardFace`, `HandFan`, `fieldTrailLayout`, `SkillMiniCard`) import from here
 * instead of defining their own. Starting values; tune against the 16:9 web
 * frame during implementation and ship the tuned numbers.
 */
export const CARD_METRICS: Record<CardFaceSize, { width: number }> = {
  catalog: { width: 280 },
  hand: { width: 68 },
  field: { width: 80 },
  mini: { width: 46 },
};

export const cardHeight = (width: number): number =>
  Math.round(width * CARD_ASPECT);

/**
 * At or below this rendered width, `CardFace` draws a code rank badge + suit
 * emblem over baked art so the card stays readable in battle.
 */
export const OVERLAY_BELOW_WIDTH = 120;

/** UI-A11Y-002: suit is shown by shape, never colour alone. */
export const SUIT_SYMBOL: Record<SuitCode, string> = {
  SUIT_FIRE: "▲",
  SUIT_WATER: "●",
  SUIT_WIND: "✦",
  SUIT_EARTH: "■",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardMetrics.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck, lint, format**

Run: `cd apps/mobile && npx tsc --noEmit && npx eslint src/features/cpu-game/cardMetrics.ts src/features/cpu-game/cardMetrics.test.ts`
Then: `npx prettier --write apps/mobile/src/features/cpu-game/cardMetrics.ts apps/mobile/src/features/cpu-game/cardMetrics.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/cpu-game/cardMetrics.ts apps/mobile/src/features/cpu-game/cardMetrics.test.ts
git commit -m "$(printf '%s\n' 'feat(sp4a): card size source of truth (cardMetrics)' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 2: Card-art resolver (`cardArt.ts` + generated map)

**Files:**

- Create: `apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts`
- Create: `apps/mobile/src/features/cpu-game/cardArt.ts`
- Test: `apps/mobile/src/features/cpu-game/cardArt.test.ts`

**Interfaces:**

- Consumes: `SuitCode` from `@ragnarok-millennium/game-core`; `cardArtAssets` from `./cardArtAssets.generated`.
- Produces:
  - `function cardArtKey(rank: number, suit: SuitCode): string` — e.g. `'card-3-fire'`
  - `function resolveCardArt(rank: number, suit: SuitCode, assets?: Partial<Record<string, number>>): number | null`
  - `const cardArtAssets: Partial<Record<string, number>>` (generated; `{}` in SP4a)

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/cpu-game/cardArt.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { cardArtKey, resolveCardArt } from "./cardArt.ts";

const SUITS = ["SUIT_FIRE", "SUIT_WATER", "SUIT_WIND", "SUIT_EARTH"] as const;

test("cardArtKey builds card-<rank>-<suit-slug>", () => {
  assert.equal(cardArtKey(1, "SUIT_FIRE"), "card-1-fire");
  assert.equal(cardArtKey(9, "SUIT_EARTH"), "card-9-earth");
  assert.equal(cardArtKey(5, "SUIT_WATER"), "card-5-water");
  assert.equal(cardArtKey(6, "SUIT_WIND"), "card-6-wind");
});

test("cardArtKey covers all 36 number cards with distinct keys", () => {
  const keys = new Set<string>();
  for (let rank = 1; rank <= 9; rank += 1)
    for (const s of SUITS) keys.add(cardArtKey(rank, s));
  assert.equal(keys.size, 36);
});

test("resolveCardArt returns the mapped require id, or null when absent", () => {
  assert.equal(resolveCardArt(3, "SUIT_FIRE", {}), null);
  assert.equal(resolveCardArt(3, "SUIT_FIRE", { "card-3-fire": 4242 }), 4242);
});

test("resolveCardArt defaults to the generated map (empty in SP4a)", () => {
  assert.equal(resolveCardArt(1, "SUIT_FIRE"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardArt.test.ts`
Expected: FAIL — cannot find module `./cardArt.ts`.

- [ ] **Step 3: Write the generated map (initial, empty)**

Create `apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts`:

```ts
// GENERATED by scripts/generate-card-art-manifest.mjs — do not edit by hand.
// Maps a card-art key (see cardArt.ts `cardArtKey`) to a bundled PNG require() id.
export const cardArtAssets: Partial<Record<string, number>> = {};
```

- [ ] **Step 4: Write the resolver**

Create `apps/mobile/src/features/cpu-game/cardArt.ts`:

```ts
import type { SuitCode } from "@ragnarok-millennium/game-core";

import { cardArtAssets } from "./cardArtAssets.generated";

const SUIT_SLUG: Record<SuitCode, string> = {
  SUIT_FIRE: "fire",
  SUIT_WATER: "water",
  SUIT_WIND: "wind",
  SUIT_EARTH: "earth",
};

/** Asset key for a number card, e.g. cardArtKey(3, 'SUIT_FIRE') -> 'card-3-fire'. */
export function cardArtKey(rank: number, suit: SuitCode): string {
  return `card-${rank}-${SUIT_SLUG[suit]}`;
}

/**
 * The bundled full-art image (a Metro `require()` id) for a number card, or
 * `null` when that artwork is not in the app yet. `assets` is injectable for
 * tests; defaults to the generated map.
 */
export function resolveCardArt(
  rank: number,
  suit: SuitCode,
  assets: Partial<Record<string, number>> = cardArtAssets,
): number | null {
  return assets[cardArtKey(rank, suit)] ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardArt.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck, lint, format**

Run: `cd apps/mobile && npx tsc --noEmit && npx eslint src/features/cpu-game/cardArt.ts src/features/cpu-game/cardArt.test.ts src/features/cpu-game/cardArtAssets.generated.ts`
Then: `npx prettier --write apps/mobile/src/features/cpu-game/cardArt.ts apps/mobile/src/features/cpu-game/cardArt.test.ts apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/cpu-game/cardArt.ts apps/mobile/src/features/cpu-game/cardArt.test.ts apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts
git commit -m "$(printf '%s\n' 'feat(sp4a): number-card art resolver + generated require map' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 3: Manifest + generator script

**Files:**

- Create: `assets/manifests/cards-full.json`
- Create: `scripts/generate-card-art-manifest.mjs`
- Modify: `package.json` (repo root) — add `assets:generate:cards`
- Regenerate: `apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts` (stays `{}` — no PNGs yet)

**Interfaces:**

- Consumes: nothing from earlier tasks (standalone script).
- Produces: `assets/manifests/cards-full.json` shape `{ todoId, version, size:{width,height}, maxBytes, cards: [{ cardId, rank, suit, assetId, path }] }` with 36 entries. `scripts/generate-card-art-manifest.mjs` reads `assets/cards/full/*.png` and rewrites `cardArtAssets.generated.ts`.

- [ ] **Step 1: Write the manifest**

Create `assets/manifests/cards-full.json` by running this one-off snippet from the repo root, then commit the file it writes:

```bash
node --input-type=module -e '
import { writeFileSync } from "node:fs";
const suits = ["fire", "water", "wind", "earth"];
const suitCode = { fire: "SUIT_FIRE", water: "SUIT_WATER", wind: "SUIT_WIND", earth: "SUIT_EARTH" };
const cards = [];
for (let rank = 1; rank <= 9; rank += 1) {
  for (const suit of suits) {
    const assetId = `card-${rank}-${suit}`;
    cards.push({
      cardId: `CARD_NUMBER_RANK_${rank}_${suitCode[suit]}`,
      rank, suit, assetId, path: `assets/cards/full/${assetId}.png`,
    });
  }
}
writeFileSync("assets/manifests/cards-full.json", JSON.stringify({
  todoId: "SP4-GR-02",
  version: "0.1.0",
  size: { width: 832, height: 1164 },
  maxBytes: 204800,
  cards,
}, null, 2) + "\n");
'
```

Verify: `cat assets/manifests/cards-full.json` shows 36 card entries, first `card-1-fire`, last `card-9-earth`.

- [ ] **Step 2: Write the generator**

Create `scripts/generate-card-art-manifest.mjs`:

```js
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

const ART_DIR = "assets/cards/full";
const OUT = "apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts";
const NAME_RE = /^card-[1-9]-(fire|water|wind|earth)\.png$/;
// Relative path from OUT's directory to a file in ART_DIR (matches backgroundAssets.ts depth).
const REL_PREFIX = "../../../../../";

if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true });

const files = readdirSync(ART_DIR)
  .filter((f) => NAME_RE.test(f))
  .sort();

const header =
  "// GENERATED by scripts/generate-card-art-manifest.mjs — do not edit by hand.\n" +
  "// Maps a card-art key (see cardArt.ts `cardArtKey`) to a bundled PNG require() id.\n";

let body;
if (files.length === 0) {
  body = "export const cardArtAssets: Partial<Record<string, number>> = {};\n";
} else {
  const entries = files
    .map(
      (f) =>
        `  '${f.replace(/\.png$/, "")}': require('${REL_PREFIX}${ART_DIR}/${f}'),`,
    )
    .join("\n");
  body = `export const cardArtAssets: Partial<Record<string, number>> = {\n${entries}\n};\n`;
}

writeFileSync(OUT, header + body);
console.log(`card-art manifest: ${files.length}/36 images -> ${OUT}`);
```

- [ ] **Step 3: Add the npm script**

In `package.json` (repo root), inside `"scripts"`, next to `"assets:generate:m4"`, add:

```json
    "assets:generate:cards": "node scripts/generate-card-art-manifest.mjs",
```

- [ ] **Step 4: Run the generator and verify it is a no-op right now**

Run: `node scripts/generate-card-art-manifest.mjs`
Expected: prints `card-art manifest: 0/36 images -> apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts` and `cardArtAssets.generated.ts` still contains `export const cardArtAssets: Partial<Record<string, number>> = {};`.

Run: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardArt.test.ts`
Expected: PASS (still 4 tests) — the generated file is unchanged.

- [ ] **Step 5: Format**

Run: `npx prettier --write assets/manifests/cards-full.json package.json`
(The `.mjs` script and the generated `.ts` match the emitted format already; if `prettier --check` complains about the generated file in a later task, add `apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts` to `apps/mobile/.prettierignore`.)

- [ ] **Step 6: Commit**

```bash
git add assets/manifests/cards-full.json scripts/generate-card-art-manifest.mjs package.json
git commit -m "$(printf '%s\n' 'feat(sp4a): cards-full manifest + require-map generator' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 4: Asset check script

**Files:**

- Create: `scripts/check-cards-full-assets.mjs`
- Create: `scripts/check-cards-full-assets.test.mjs`
- Modify: `package.json` (repo root) — add `assets:check:cards`, `assets:check:cards:selftest`

**Interfaces:**

- Consumes: `assets/manifests/cards-full.json` (Task 3).
- Produces: CLI `node scripts/check-cards-full-assets.mjs [--require-all]`. Exports `pngSize(buf: Buffer): {width, height} | null` and `checkCardsFull({ manifestPath?, root?, requireAll? }): { present, missing, errors: string[] }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-cards-full-assets.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import { pngSize } from "./check-cards-full-assets.mjs";

function fakePngHeader(width, height) {
  const b = Buffer.alloc(24);
  b.write("\x89PNG\r\n\x1a\n", 0, "binary");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

test("pngSize reads width/height from a PNG IHDR header", () => {
  assert.deepEqual(pngSize(fakePngHeader(832, 1164)), {
    width: 832,
    height: 1164,
  });
});

test("pngSize returns null for a non-PNG buffer", () => {
  assert.equal(pngSize(Buffer.from("not a png at all........")), null);
});

test("pngSize returns null for a too-short buffer", () => {
  assert.equal(pngSize(Buffer.alloc(10)), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/check-cards-full-assets.test.mjs`
Expected: FAIL — cannot find module `./check-cards-full-assets.mjs`.

- [ ] **Step 3: Write the check script**

Create `scripts/check-cards-full-assets.mjs`:

```js
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";

/** Width/height from a PNG's IHDR, or null if `buf` is not a PNG. */
export function pngSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf.toString("binary", 0, 8) !== PNG_SIGNATURE) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
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
    if (c.path !== `assets/cards/full/${c.assetId}.png`)
      push(`${c.cardId}: path mismatch (${c.path})`);

    const abs = resolve(root, c.path);
    if (!existsSync(abs)) {
      missing += 1;
      if (requireAll) push(`missing ${c.path}`);
      continue;
    }
    present += 1;
    const buf = readFileSync(abs);
    const size = pngSize(buf);
    if (!size) {
      push(`${c.path} is not a PNG`);
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
    if (statSync(abs).size > manifest.maxBytes) {
      push(
        `${c.path} is ${statSync(abs).size} bytes, over ${manifest.maxBytes}`,
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
if (import.meta.url === `file://${process.argv[1]}`) {
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
```

- [ ] **Step 4: Add npm scripts**

In `package.json` (repo root) `"scripts"`, after `assets:generate:cards`:

```json
    "assets:check:cards": "node scripts/check-cards-full-assets.mjs",
    "assets:check:cards:selftest": "node --test scripts/check-cards-full-assets.test.mjs",
```

- [ ] **Step 5: Run the unit test — verify it passes**

Run: `node --test scripts/check-cards-full-assets.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the check CLI in each state — verify behaviour**

Run: `node scripts/check-cards-full-assets.mjs`
Expected: `cards-full: 0 present, 36 missing` then `cards-full asset check passed` (exit 0 — missing is allowed by default in SP4a).

Run: `node scripts/check-cards-full-assets.mjs --require-all`
Expected: 36 `✗ missing ...` lines, `cards-full asset check FAILED`, exit 1.

Manual malformed-file check: `mkdir -p assets/cards/full && printf 'nope' > assets/cards/full/card-1-fire.png && node scripts/check-cards-full-assets.mjs; rm assets/cards/full/card-1-fire.png`
Expected: `✗ assets/cards/full/card-1-fire.png is not a PNG`, `FAILED`, exit 1. (Then the file is removed — do not commit it.)

- [ ] **Step 7: Format**

Run: `npx prettier --write package.json`
(`.mjs` files: run `npx prettier --write scripts/check-cards-full-assets.mjs scripts/check-cards-full-assets.test.mjs` and accept its formatting.)

- [ ] **Step 8: Commit**

```bash
git add scripts/check-cards-full-assets.mjs scripts/check-cards-full-assets.test.mjs package.json
git commit -m "$(printf '%s\n' 'feat(sp4a): cards-full asset check script (lenient until SP4b)' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 5: `cardFaceLayers()` — which layers to draw

**Files:**

- Create: `apps/mobile/src/features/cpu-game/cardFaceLayers.ts`
- Test: `apps/mobile/src/features/cpu-game/cardFaceLayers.test.ts`

**Interfaces:**

- Consumes: `CardFaceSize`, `CARD_METRICS`, `OVERLAY_BELOW_WIDTH` from `./cardMetrics`.
- Produces:
  - `type CardFaceLayers = { base: 'image' | 'vector'; overlay: boolean; showName: boolean }`
  - `function cardFaceLayers(size: CardFaceSize, hasArt: boolean): CardFaceLayers`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/cpu-game/cardFaceLayers.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { cardFaceLayers } from "./cardFaceLayers.ts";

test("no art: vector base, no overlay; name line only at catalog size", () => {
  assert.deepEqual(cardFaceLayers("catalog", false), {
    base: "vector",
    overlay: false,
    showName: true,
  });
  assert.deepEqual(cardFaceLayers("hand", false), {
    base: "vector",
    overlay: false,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers("mini", false), {
    base: "vector",
    overlay: false,
    showName: false,
  });
});

test("with art: image base; overlay only below the width threshold; never a name line", () => {
  assert.deepEqual(cardFaceLayers("catalog", true), {
    base: "image",
    overlay: false,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers("hand", true), {
    base: "image",
    overlay: true,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers("field", true), {
    base: "image",
    overlay: true,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers("mini", true), {
    base: "image",
    overlay: true,
    showName: false,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardFaceLayers.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/features/cpu-game/cardFaceLayers.ts`:

```ts
import {
  CARD_METRICS,
  OVERLAY_BELOW_WIDTH,
  type CardFaceSize,
} from "./cardMetrics";

export type CardFaceLayers = {
  /** 'image' when baked art exists for this card, else a drawn vector card. */
  base: "image" | "vector";
  /** Draw the code rank badge + suit emblem over the base (small sizes with art). */
  overlay: boolean;
  /** Vector base only: show the card-name line. Catalog size only. */
  showName: boolean;
};

export function cardFaceLayers(
  size: CardFaceSize,
  hasArt: boolean,
): CardFaceLayers {
  const width = CARD_METRICS[size].width;
  return {
    base: hasArt ? "image" : "vector",
    overlay: hasArt && width < OVERLAY_BELOW_WIDTH,
    showName: !hasArt && size === "catalog",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx tsx --test src/features/cpu-game/cardFaceLayers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck, lint, format**

Run: `cd apps/mobile && npx tsc --noEmit && npx eslint src/features/cpu-game/cardFaceLayers.ts src/features/cpu-game/cardFaceLayers.test.ts`
Then: `npx prettier --write apps/mobile/src/features/cpu-game/cardFaceLayers.ts apps/mobile/src/features/cpu-game/cardFaceLayers.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/cpu-game/cardFaceLayers.ts apps/mobile/src/features/cpu-game/cardFaceLayers.test.ts
git commit -m "$(printf '%s\n' 'feat(sp4a): cardFaceLayers - decide image vs vector + overlay' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 6: Rebuild `CardFace`

**Files:**

- Modify: `apps/mobile/src/features/cpu-game/CardFace.tsx` (full rewrite of the body; keep the file path and the export name `CardFace`).
- Test: none new (the logic lives in Tasks 1 & 5, already tested). Verification is typecheck + existing test suite + manual.

**Interfaces:**

- Consumes: `CardFaceSize`, `CARD_METRICS`, `cardHeight`, `SUIT_SYMBOL` from `./cardMetrics`; `cardFaceLayers` from `./cardFaceLayers`; `resolveCardArt` from `./cardArt`; `translate` from `../../i18n/translate`; `useTheme`, `useThemedStyles` from `../theme/ThemeProvider`; `ACCENT` from `../../components`.
- Produces: `<CardFace rank suitCode isJoker size />` where `size: CardFaceSize` now includes `'catalog'`. `CardFaceProps` / `CardFaceSize` re-exported from this file for existing importers.

- [ ] **Step 1: Re-export the type, then check current consumers still compile**

Rewrite `apps/mobile/src/features/cpu-game/CardFace.tsx`:

```tsx
import { Image, StyleSheet, Text, View } from "react-native";

import { radius, typography, type ThemeColors } from "@ragnarok-millennium/ui";

import type { SuitCode } from "@ragnarok-millennium/game-core";

import { translate } from "../../i18n/translate";
import { ACCENT } from "../../components";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import {
  CARD_METRICS,
  cardHeight,
  SUIT_SYMBOL,
  type CardFaceSize,
} from "./cardMetrics";
import { cardFaceLayers } from "./cardFaceLayers";
import { resolveCardArt } from "./cardArt";

export type { CardFaceSize } from "./cardMetrics";

export type CardFaceProps = {
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  size: CardFaceSize;
};

function suitColor(c: ThemeColors, suitCode: SuitCode): string {
  switch (suitCode) {
    case "SUIT_FIRE":
      return c.suit.fire;
    case "SUIT_WATER":
      return c.suit.water;
    case "SUIT_WIND":
      return c.suit.wind;
    case "SUIT_EARTH":
      return c.suit.earth;
  }
}

/** Card-name line for the vector fallback at catalog size. */
function cardName(rank: number): string {
  return translate(`catalog.numberCard.name.${rank}`);
}

/**
 * Number-card face. Renders the baked full-art PNG when the app has it
 * (`resolveCardArt`), otherwise a themed vector card. Below a width threshold a
 * rank badge + suit emblem are drawn over the art for battle legibility. Pure
 * presentational component — no store access.
 */
export function CardFace({ rank, suitCode, isJoker, size }: CardFaceProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const width = CARD_METRICS[size].width;
  const height = cardHeight(width);
  const art = resolveCardArt(rank, suitCode);
  const layers = cardFaceLayers(size, art != null);
  const tint = suitColor(colors, suitCode);
  const suitLabel = translate(`sandbox.suit.${suitCode}`);
  const label = `${rank} ${suitLabel}${isJoker ? ` ${translate("sandbox.card.joker")}` : ""}`;

  const px = (frac: number) => Math.max(8, Math.round(width * frac));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.card, { width, height, borderColor: tint }]}
    >
      {layers.base === "image" && art != null ? (
        <Image source={art} resizeMode="cover" style={{ width, height }} />
      ) : (
        <View style={styles.vector}>
          {layers.showName ? (
            <Text style={[styles.name, { color: tint }]} numberOfLines={1}>
              {suitLabel}／{cardName(rank)}
            </Text>
          ) : null}
          <Text
            style={[
              styles.vectorRank,
              { fontSize: px(0.5), color: colors.ink.primary },
            ]}
          >
            {rank}
          </Text>
          <Text
            style={[
              styles.vectorSuit,
              { fontSize: px(0.16), color: colors.ink.secondary },
            ]}
          >
            {SUIT_SYMBOL[suitCode]} {suitLabel}
          </Text>
        </View>
      )}

      {layers.overlay ? (
        <>
          <Text
            style={[styles.emblem, { fontSize: px(0.24), color: "#FFFFFF" }]}
          >
            {SUIT_SYMBOL[suitCode]}
          </Text>
          <View style={[styles.rankBadge, { backgroundColor: tint }]}>
            <Text style={[styles.rankBadgeText, { fontSize: px(0.3) }]}>
              {rank}
            </Text>
          </View>
        </>
      ) : null}

      {isJoker ? (
        <Text style={[styles.joker, { fontSize: px(0.22) }]}>J</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderWidth: 2,
      borderRadius: radius.control,
      overflow: "hidden",
      backgroundColor: c.surface.card.face,
    },
    vector: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      paddingVertical: 2,
      gap: 2,
    },
    name: {
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
    },
    vectorRank: { fontWeight: typography.weight.bold },
    vectorSuit: {},
    emblem: {
      position: "absolute",
      top: 2,
      left: 3,
      fontWeight: typography.weight.bold,
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowRadius: 2,
    },
    rankBadge: {
      position: "absolute",
      bottom: 2,
      left: 2,
      minWidth: 16,
      paddingHorizontal: 3,
      borderRadius: 4,
      alignItems: "center",
    },
    rankBadgeText: { color: "#FFFFFF", fontWeight: typography.weight.bold },
    joker: {
      position: "absolute",
      top: -2,
      right: -2,
      fontWeight: typography.weight.bold,
      color: "#1B1D24",
      backgroundColor: ACCENT,
      borderRadius: radius.control,
      paddingHorizontal: 3,
      overflow: "hidden",
    },
  });
```

- [ ] **Step 2: Verify the existing test suite still passes**

Run: `cd apps/mobile && npx tsx --test "src/**/*.test.ts"`
Expected: PASS — same count as before this task plus the new files from Tasks 1/2/5. No failures. (`CardFace` has no unit test; `boardViewModel` and others that reference `CardFaceData` are unaffected — the prop shape is unchanged apart from the added `'catalog'` size.)

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS. If an importer breaks on `CardFaceSize` no longer being declared in this file, it is fixed by the `export type { CardFaceSize }` re-export line — confirm the importer uses a `type` import.

- [ ] **Step 4: Lint + format**

Run: `cd apps/mobile && npx eslint src/features/cpu-game/CardFace.tsx`
Then: `npx prettier --write apps/mobile/src/features/cpu-game/CardFace.tsx`
Expected: no errors.

- [ ] **Step 5: Manual visual check (web)**

Run: `cd apps/mobile && npx expo start --web` (or use the `.claude/launch.json` `expo-web` config). Open the CPU game (`/cpu-game/setup` → start). Confirm:

- hand / field / mini cards render the vector fallback at the new larger sizes, rank + suit symbol legible;
- selection border, lock ring and glow still align to the card edges;
- day ↔ night (革命) does not break the card.

Note any size that overflows its container — it will be tuned in Task 7.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/cpu-game/CardFace.tsx
git commit -m "$(printf '%s\n' 'feat(sp4a): CardFace renders baked art or vector fallback + battle overlay' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 7: Resize the card consumers

**Files:**

- Modify: `apps/mobile/src/components/HandFan.tsx`
- Modify: `apps/mobile/src/components/fieldTrailLayout.ts`
- Modify: `apps/mobile/src/components/SkillMiniCard.tsx`
- Check (edit only if broken): `apps/mobile/src/app/cpu-game/play.tsx`, `apps/mobile/src/app/online-room/play.tsx`

**Interfaces:**

- Consumes: `CARD_METRICS`, `cardHeight` from `../features/cpu-game/cardMetrics`.
- Produces: no new exports. `HandFan` card box = `CARD_METRICS.hand`; `fieldTrailLayout` card widths/height = `CARD_METRICS.field` / `CARD_METRICS.mini`; `SkillMiniCard` box widths track the same.

- [ ] **Step 1: Rebase on the concurrent editor's latest**

Run: `git pull --rebase`
Expected: clean. If `FieldTrail.tsx` / `fieldTrailLayout.ts` / `HandFan.tsx` changed upstream, re-read them before editing so the constant names below still match; adapt the swap to whatever constants the current file defines (the goal is "no literal card px in these files — import from `cardMetrics`").

- [ ] **Step 2: `HandFan.tsx` — take the card box from `cardMetrics`**

In `apps/mobile/src/components/HandFan.tsx`:

Add import (with the other imports):

```tsx
import { CARD_METRICS, cardHeight } from "../features/cpu-game/cardMetrics";
```

Replace the size constants:

```tsx
const CARD_WIDTH = CARD_METRICS.hand.width;
const CARD_HEIGHT = cardHeight(CARD_WIDTH);
const LIFT = 26;
const ARC = 18;
```

(Everything else in `HandFan` already derives from `CARD_WIDTH` / `CARD_HEIGHT` — the `fanLayout({ cardWidth: CARD_WIDTH, ... })` call, `left` math, `styles.card.width`, and `styles.container.height`.)

- [ ] **Step 3: `fieldTrailLayout.ts` — take card widths from `cardMetrics`**

In `apps/mobile/src/components/fieldTrailLayout.ts`, add the import and replace the local card-size literals (`FIELD_CARD_W`, `MINI_CARD_W`, `FIELD_CARD_H` and, if present, the skill-card widths) so they derive from `cardMetrics`. Keep the gap/padding constants and `ELLIPSE_SIZE` math as they are. Target state:

```ts
import { CARD_METRICS, cardHeight } from "../features/cpu-game/cardMetrics";

const FIELD_CARD_W = CARD_METRICS.field.width;
const MINI_CARD_W = CARD_METRICS.mini.width;
const CARD_GAP = 4;

const FIELD_SKILL_W = CARD_METRICS.field.width;
const MINI_SKILL_W = CARD_METRICS.mini.width;

const FIELD_CARD_H = cardHeight(CARD_METRICS.field.width);
```

Leave `ELLIPSE_PAD_X`, `ELLIPSE_PAD_Y`, `ELLIPSE_MAX_CARDS`, `ELLIPSE_SIZE`, `stepWidth` unchanged in structure.

- [ ] **Step 4: `SkillMiniCard.tsx` — match the number-card widths**

In `apps/mobile/src/components/SkillMiniCard.tsx`, import `CARD_METRICS` and set the box `minWidth` from it so a skill card and a number card are the same width on the table:

```tsx
import { CARD_METRICS } from "../features/cpu-game/cardMetrics";

const BOX: Record<
  "mini" | "field",
  { minWidth: number; glyph: number; text: number }
> = {
  mini: { minWidth: CARD_METRICS.mini.width, glyph: 13, text: 9 },
  field: { minWidth: CARD_METRICS.field.width, glyph: 16, text: 10 },
};
```

- [ ] **Step 5: Typecheck + tests**

Run: `cd apps/mobile && npx tsc --noEmit && npx tsx --test "src/**/*.test.ts"`
Expected: PASS. If a `fieldTrailLayout` test asserts exact pixel numbers, update those assertions to compute from `CARD_METRICS` the same way the source now does (don't hard-code the new number).

- [ ] **Step 6: Manual fit check (web)**

Run the web app (Task 6 Step 5). In a CPU game with a full hand and a 4-card field play:

- the fan hand fits within its footer column and does not clip;
- the field ellipse + past-trail row fit within `maxWidth` (no horizontal scroll on the frame);
- opponent mini-card rows and history rows still lay out.

If anything overflows, reduce the offending width in `apps/mobile/src/features/cpu-game/cardMetrics.ts` (`CARD_METRICS`) and re-check. The tuned values are what ships. Only touch `play.tsx` if a container needs a spacing/`maxWidth` tweak — keep it to a few lines and do not reformat the file.

- [ ] **Step 7: Lint + format (only the files you changed)**

Run: `cd apps/mobile && npx eslint src/components/HandFan.tsx src/components/fieldTrailLayout.ts src/components/SkillMiniCard.tsx`
Then: `npx prettier --write apps/mobile/src/components/HandFan.tsx apps/mobile/src/components/fieldTrailLayout.ts apps/mobile/src/components/SkillMiniCard.tsx apps/mobile/src/features/cpu-game/cardMetrics.ts`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/HandFan.tsx apps/mobile/src/components/fieldTrailLayout.ts apps/mobile/src/components/SkillMiniCard.tsx apps/mobile/src/features/cpu-game/cardMetrics.ts
# add apps/mobile/src/app/cpu-game/play.tsx and/or online-room/play.tsx ONLY if you edited them
git commit -m "$(printf '%s\n' 'feat(sp4a): bigger battle cards; consumers read cardMetrics' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 8: Catalog data — `fullArtPath`, `rank`, `suitCode`

**Files:**

- Modify: `apps/mobile/src/features/catalog/cardCatalog.ts`
- Test: `apps/mobile/src/features/catalog/cardCatalog.test.ts`

**Interfaces:**

- Consumes: `SuitCode` from `@ragnarok-millennium/game-core`.
- Produces: `CatalogItem` gains optional `rank?: number`, `suitCode?: SuitCode`, `fullArtPath?: string` — set for `kind: 'number'` items. `assertCompleteM0Catalog` now requires number items to carry a `.png` `fullArtPath` and skill items to keep a `.svg` `runtimePath`.

- [ ] **Step 1: Update the failing test**

In `apps/mobile/src/features/catalog/cardCatalog.test.ts`, add to the first test (`buildCatalogItems expands M0 masters...`), after the existing assertions:

```ts
const firstNumber = items.find((i) => i.kind === "number");
assert.equal(firstNumber?.rank, 1);
assert.equal(firstNumber?.suitCode, "SUIT_FIRE");
assert.equal(firstNumber?.fullArtPath, "assets/cards/full/card-1-fire.png");
assert.ok(
  items
    .filter((i) => i.kind === "number")
    .every((i) => i.fullArtPath?.endsWith(".png")),
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx tsx --test src/features/catalog/cardCatalog.test.ts`
Expected: FAIL — `firstNumber?.rank` is `undefined`.

- [ ] **Step 3: Implement**

In `apps/mobile/src/features/catalog/cardCatalog.ts`:

Add the import:

```ts
import type { SuitCode } from "@ragnarok-millennium/game-core";
```

Extend `CatalogItem`:

```ts
export type CatalogItem = {
  id: string;
  masterId: string;
  kind: "number" | "skill";
  title: string;
  subtitle: string;
  assetId: string;
  runtimePath: string;
  sortOrder: number;
  copyIndex: number;
  copyCount: number;
  /** number cards only */
  rank?: number;
  suitCode?: SuitCode;
  fullArtPath?: string;
};
```

Add a helper near `rankLabel` / `suitLabel`:

```ts
const SUIT_SLUG: Record<string, string> = {
  SUIT_FIRE: "fire",
  SUIT_WATER: "water",
  SUIT_WIND: "wind",
  SUIT_EARTH: "earth",
};
```

In the `numbers` map, add the three fields to the returned object:

```ts
const rank = Number(rankLabel(card.rank_code));
return {
  id: card.card_id,
  masterId: card.card_id,
  kind: "number" as const,
  title: rankLabel(card.rank_code),
  subtitle: suitLabel(card.suit_code),
  assetId: asset.assetId,
  runtimePath: asset.runtimePath,
  sortOrder: card.sort_order,
  copyIndex: 1,
  copyCount: 1,
  rank,
  suitCode: card.suit_code as SuitCode,
  fullArtPath: `assets/cards/full/card-${rank}-${SUIT_SLUG[card.suit_code]}.png`,
};
```

Replace `assertCompleteM0Catalog`:

```ts
export function assertCompleteM0Catalog(items: CatalogItem[]) {
  if (items.length !== placeholderManifest.physicalDeckCount) {
    throw new Error(
      `Expected ${placeholderManifest.physicalDeckCount} catalog items but received ${items.length}`,
    );
  }
  const numberCards = items.filter((item) => item.kind === "number");
  if (numberCards.some((item) => !item.fullArtPath?.endsWith(".png"))) {
    throw new Error("Number cards must declare a full-art PNG path");
  }
  const skillCards = items.filter((item) => item.kind === "skill");
  if (skillCards.some((item) => !item.runtimePath.endsWith(".svg"))) {
    throw new Error("Skill cards must have SVG runtime assets");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx tsx --test src/features/catalog/cardCatalog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Full suite + typecheck + lint + format**

Run: `cd apps/mobile && npx tsx --test "src/**/*.test.ts" && npx tsc --noEmit && npx eslint src/features/catalog/cardCatalog.ts src/features/catalog/cardCatalog.test.ts`
Then: `npx prettier --write apps/mobile/src/features/catalog/cardCatalog.ts apps/mobile/src/features/catalog/cardCatalog.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/catalog/cardCatalog.ts apps/mobile/src/features/catalog/cardCatalog.test.ts
git commit -m "$(printf '%s\n' 'feat(sp4a): catalog items carry rank/suit/full-art path for number cards' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 9: Catalog screen renders `CardFace`

**Files:**

- Modify: `apps/mobile/src/app/catalog/index.tsx`
- Modify: `apps/mobile/src/i18n/translate.ts`

**Interfaces:**

- Consumes: `CardFace` from `../../features/cpu-game/CardFace`; `CatalogItem.rank` / `.suitCode` (Task 8); `translate('catalog.numberCard.name.<1-9>')`.
- Produces: no new exports.

- [ ] **Step 1: Add the card-name i18n keys**

In `apps/mobile/src/i18n/translate.ts`, next to the other `catalog.*` keys (around line 84), add:

```ts
  'catalog.numberCard.name.1': '大魔王',
  'catalog.numberCard.name.2': '魔王',
  'catalog.numberCard.name.3': '魔将軍',
  'catalog.numberCard.name.4': '悪魔',
  'catalog.numberCard.name.5': '人間の戦士',
  'catalog.numberCard.name.6': '天使',
  'catalog.numberCard.name.7': '聖将軍',
  'catalog.numberCard.name.8': '大天使',
  'catalog.numberCard.name.9': '神',
  'catalog.numberCard.rankLabel': '数字',
```

- [ ] **Step 2: Render `CardFace` in the grid for number cards**

In `apps/mobile/src/app/catalog/index.tsx`:

Add import:

```tsx
import { CardFace } from "../../features/cpu-game/CardFace";
```

Replace the `renderItem` body so number cards show the card and skill cards keep the text placeholder:

```tsx
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedItemId(item.id)}
              style={styles.card}
            >
              {item.kind === 'number' && item.rank != null && item.suitCode != null ? (
                <CardFace rank={item.rank} suitCode={item.suitCode} isJoker={false} size="catalog" />
              ) : (
                <>
                  <Text style={styles.cardKind}>{item.kind.toUpperCase()}</Text>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  <Text numberOfLines={1} style={styles.assetId}>
                    {item.assetId}
                  </Text>
                </>
              )}
            </Pressable>
          )}
```

- [ ] **Step 3: Show the card name in the detail modal**

Replace the detail modal body:

```tsx
{
  selectedItem ? (
    <View style={styles.detailCard}>
      {selectedItem.kind === "number" &&
      selectedItem.rank != null &&
      selectedItem.suitCode != null ? (
        <>
          <CardFace
            rank={selectedItem.rank}
            suitCode={selectedItem.suitCode}
            isJoker={false}
            size="catalog"
          />
          <Text style={styles.detailTitle}>
            {translate(`catalog.numberCard.name.${selectedItem.rank}`)}
          </Text>
          <Text style={styles.detailSubtitle}>
            {selectedItem.subtitle} ・{" "}
            {translate("catalog.numberCard.rankLabel")} {selectedItem.rank}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.cardKind}>{selectedItem.kind.toUpperCase()}</Text>
          <Text style={styles.detailTitle}>{selectedItem.title}</Text>
          <Text style={styles.detailSubtitle}>{selectedItem.subtitle}</Text>
          <Text style={styles.detailPath}>{selectedItem.runtimePath}</Text>
        </>
      )}
    </View>
  ) : null;
}
```

- [ ] **Step 4: Adjust the grid item container so the card fills it**

In `makeStyles`, the `card` style currently forces `justifyContent: 'center'`, `padding: 8`, `aspectRatio: 5/7`, `maxWidth: 126`. The `CardFace` now brings its own 5:7 box (`CARD_METRICS.catalog.width` = 280 by default). Update `card` to let the CardFace size it, and drop `numColumns` to fit:

```tsx
    card: {
      alignItems: 'center',
      justifyContent: 'center',
      margin: 5,
      padding: 4,
    },
```

Change the `FlatList` prop `numColumns={6}` to `numColumns={3}`.

- [ ] **Step 5: Typecheck, full test suite, lint, format**

Run: `cd apps/mobile && npx tsc --noEmit && npx tsx --test "src/**/*.test.ts" && npx eslint src/app/catalog/index.tsx src/i18n/translate.ts`
Then: `npx prettier --write apps/mobile/src/app/catalog/index.tsx apps/mobile/src/i18n/translate.ts`
Expected: all PASS.

- [ ] **Step 6: Manual check (web)**

Run the web app, open カードカタログ from the menu. Confirm:

- number cards render as vector cards (no art yet) in a 3-column grid, name line visible at the top;
- tapping a number card opens the modal with the card name (大魔王 … 神), suit, and rank;
- skill cards still show their text placeholder;
- `catalog.countPrefix` count still reads `42/42`.

If `CARD_METRICS.catalog.width` (280) makes the grid overflow the 16:9 frame, reduce it in `cardMetrics.ts` (e.g. 220–260) and re-check — this is the last consumer, so its width can be finalised here.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/app/catalog/index.tsx apps/mobile/src/i18n/translate.ts
# include apps/mobile/src/features/cpu-game/cardMetrics.ts if you retuned catalog width
git commit -m "$(printf '%s\n' 'feat(sp4a): catalog renders number cards via CardFace + shows card names' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 10: Art-direction doc for SP4b

**Files:**

- Create: `docs/art/SP4-GR-01-number-card-art.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Write the doc**

Create `docs/art/SP4-GR-01-number-card-art.md`:

```markdown
# SP4-GR-01 — Number card full art (1–9 × 4 suits)

- Sub-project: SP4b (art production for SP4 カード枠)
- Date: 2026-09-09
- Extends: `docs/art/M0-GR-01-art-direction.md` (M0 flat placeholders — superseded for number cards)
- Spec: `docs/superpowers/specs/2026-09-08-sp4a-number-card-render-design.md`
- Contract: `assets/manifests/cards-full.json`, checked by `scripts/check-cards-full-assets.mjs`

## What SP4b delivers

36 finished card PNGs — one per (rank 1–9 × suit 火/水/風/土) — at
`assets/cards/full/card-<rank>-<suit>.png`, each **832 × 1164**, ≤ 200 KB,
art + frame + name plate + rank pennant + suit emblem **all baked in**.

## World

ラグナロク・ミレニアム — a Norse end-times card table. The nine numbers are a
power hierarchy from demon king to god (1 is strongest by day; night reverses
it). Each number is one being, painted once per element.

|   # | 名称       | EN gloss       |
| --: | ---------- | -------------- |
|   1 | 大魔王     | Demon Overlord |
|   2 | 魔王       | Demon King     |
|   3 | 魔将軍     | Demon General  |
|   4 | 悪魔       | Demon          |
|   5 | 人間の戦士 | Human Warrior  |
|   6 | 天使       | Angel          |
|   7 | 聖将軍     | Holy General   |
|   8 | 大天使     | Archangel      |
|   9 | 神         | God            |

Suits are the element the being is bound to: 火 fire, 水 water, 風 wind, 土 earth.

## Look

- Style: dark-temple digital painting, matching `assets/backgrounds/*.png`
  (遊戯王マスターデュエル参照). Cohesive, slightly luminous, readable on both a
  light and a dark table.
- Frame: suit-colour border; a top name plate reading "<suit kanji> ／ <name>";
  a bottom pennant with the large numeral (ref: the linked sample's ② shape);
  a fixed-position suit emblem. Gold accents = `#C9A94E`.
- Safe area: keep name, numeral and emblem within the inner 80%; leave the four
  corners clear (the app draws the selection frame / lock ring there).
- Readable as a catalog thumbnail and as a battle card behind a code overlay.

## Palette

| role        | hex       |
| ----------- | --------- |
| fire        | `#D84A2B` |
| water       | `#2577B8` |
| wind        | `#31886B` |
| earth       | `#8A6A2A` |
| gold accent | `#C9A94E` |
| card face   | `#FAF8F0` |
| ink         | `#1B1D24` |

## Do / Avoid

- DO: rank numeral first, then emblem, then name. One being per card.
- DO: keep the 36 visually a set — same frame, same light, same finish.
- AVOID: baked rules text or long copy on the card.
- AVOID: suit read by colour alone — the emblem shape must carry it.
- AVOID: low-contrast frames that sink the numeral on a dark table.

## Canva prompt template

Base style (prepend to every card):

> Dark fantasy trading-card illustration, digital painting, dramatic rim light,
> muted stone-temple palette with a single accent glow, cohesive card-game set
> style, 5:7 portrait, subject centred with headroom for a top name plate and a
> bottom rank banner.

Per card, append:

> Subject: **<name EN gloss>**, a <one-line being description scaled to rank —
> e.g. rank 1 "towering primordial demon sovereign", rank 9 "radiant supreme
> deity">, bound to **<element>** (<element motif: fire = embers and molten
> cracks / water = deep currents and spray / wind = driving gusts and torn
> cloud / earth = fractured rock and ore veins>). Colour keyed to <suit hex>.

Then in Canva: place the frame template, set the name plate to
「<suit kanji> ／ <name>」, set the pennant numeral to `<rank>`, position the
`<element>` emblem, export PNG at 832 × 1164.

## Records (fill during SP4b)

| card        | Canva design ID | exported | bytes | notes |
| ----------- | --------------- | -------: | ----: | ----- |
| card-1-fire |                 |          |       |       |
| … (36 rows) |                 |          |       |       |

## Wiring (SP4b close-out)

1. Drop all 36 PNGs into `assets/cards/full/`.
2. `node scripts/generate-card-art-manifest.mjs` — regenerates
   `apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts` with 36 requires.
3. `node scripts/check-cards-full-assets.mjs --require-all` — must pass.
4. Flip the SP4a lenient check: make `--require-all` the default (or add the
   flag wherever `assets:check:cards` is invoked in CI/preflight).
5. Manual: catalog + CPU battle now show real art; the small-size overlay sits
   clear of the baked numeral.
```

- [ ] **Step 2: Format**

Run: `npx prettier --write docs/art/SP4-GR-01-number-card-art.md`
Expected: no changes or clean reformat.

- [ ] **Step 3: Commit**

```bash
git add docs/art/SP4-GR-01-number-card-art.md
git commit -m "$(printf '%s\n' 'docs(sp4a): art direction + Canva prompts for the 36 number-card arts' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 11: Final integration pass

**Files:** none new — a full-suite verification and push.

- [ ] **Step 1: Rebase and run everything**

```bash
git pull --rebase
cd apps/mobile && npx tsc --noEmit && npx tsx --test "src/**/*.test.ts" && npx eslint . && npx prettier --check .
cd .. && node --test scripts/check-cards-full-assets.test.mjs && node scripts/check-cards-full-assets.mjs
```

Expected: typecheck clean; all mobile tests pass; eslint clean; prettier clean; `pngSize` selftest passes; `assets:check:cards` prints `0 present, 36 missing` and `passed`.

- [ ] **Step 2: Manual smoke (web)**

Run the web app. In one sitting:

- CPU game: play a few cards — hand fan, field ellipse, past trail, opponent mini rows, history all render with the bigger vector cards and no clipping / horizontal scroll;
- 革命 (day↔night) once — cards unaffected, frame still readable;
- カタログ — 3-column grid of number vector cards, detail modal shows names;
- exit via the ✕ button.

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Report**

State: SP4a done — render layer + pipeline in place, 0/36 arts (expected). Next: SP4b (spec + the 36 Canva artworks), using `docs/art/SP4-GR-01-number-card-art.md`.

---

## Self-Review

**1. Spec coverage**

| Spec section                                                                 | Task                                    |
| ---------------------------------------------------------------------------- | --------------------------------------- |
| §2 in-scope: CardFace rebuild (image / vector / overlay / existing overlays) | 5, 6                                    |
| §2: size table single source of truth, larger battle cards, `catalog` size   | 1, 7                                    |
| §2: generated require map + generator + check script wired to `assets:check` | 2, 3, 4                                 |
| §2: catalog renders via CardFace; detail shows name; i18n name keys          | 8, 9                                    |
| §2: layout follow-through HandFan / FieldTrail / play.tsx                    | 7                                       |
| §2: art-direction doc                                                        | 10                                      |
| §2: pure-logic tests + check script                                          | 1, 2, 5, 4, 8                           |
| §3 asset spec (832×1164, naming, 36, ≤200 KB, day/night-invariant)           | 3 (manifest), 4 (check), 10 (doc)       |
| §4.1 API adds `catalog`; same prop shape; pure component                     | 6                                       |
| §4.2 `cardMetrics.ts` exact exports                                          | 1                                       |
| §4.3 render layers bottom-to-top                                             | 6                                       |
| §4.4 `cardArtAssets.ts` generated, `resolveCardArt`                          | 2, 3                                    |
| §5 catalog: `fullArtPath`, per-kind `assertCompleteM0Catalog`, name keys     | 8, 9                                    |
| §6 pipeline: manifest, generator, check (lenient→strict), art doc            | 3, 4, 10                                |
| §7 day/night invariant, a11y label, UI-A11Y-002 emblem                       | 6                                       |
| §8 coordination: rebase, minimal diffs to M4-owned files                     | 7 (Step 1), 11                          |
| §9 tests enumerated                                                          | 1, 2, 5, 8; check-script self-test in 4 |
| §10 risk: catalog width in 16:9 frame → tune                                 | 9 (Step 6)                              |

No gap found. Note: §4.3's Joker "declared-card appearance = target card image + J badge" is only partially in scope — Task 6 keeps the existing `isJoker` J-badge behaviour; the declared-card compositing already lives in `play.tsx`'s joker-transform preview (`CardFace ... isJoker size="hand"`) and is unchanged. Called out here so a reviewer does not expect new joker code.

**2. Placeholder scan** — no "TBD"/"handle edge cases"/"similar to Task N"/bare "write tests". Every code step has the literal code. The two "tune the width" steps (7.6, 9.6) name the file and constant to change and are verification-driven, not placeholders.

**3. Type consistency**

- `CardFaceSize` — defined in `cardMetrics.ts` (Task 1), re-exported from `CardFace.tsx` (Task 6 Step 1). Consumers import from either; both resolve to the same type.
- `resolveCardArt(rank, suit, assets?)` — 3-arg signature defined in Task 2, called 2-arg in `CardFace.tsx` Task 6 (default applies). Consistent.
- `cardFaceLayers(size, hasArt) -> { base, overlay, showName }` — Task 5 defines, Task 6 consumes exactly those keys.
- `CARD_METRICS[size].width` / `cardHeight()` — Task 1 shape `{ width: number }`; Tasks 6, 7, 9 read `.width` and pass to `cardHeight`. Consistent.
- `CatalogItem.rank / .suitCode / .fullArtPath` — Task 8 adds them; Task 9 reads `.rank` / `.suitCode`. Consistent.
- `pngSize` / `checkCardsFull` — Task 4 exports both; test imports `pngSize`. Consistent.
- Generator writes `cardArtAssets` object literal; `cardArt.ts` imports `{ cardArtAssets }` — name matches (Tasks 2, 3).
