# SP4a — Number-card render layer (baked full-art, code overlay)

- Sub-project: SP4a (part of "SP4 カード枠リデザイン")
- Date: 2026-09-08
- Status: draft for review
- Depends on: SP1 (theme), SP2 (UI kit), SHELL-W3 (HandFan / FieldTrail)
- Followed by: SP4b — generate the 36 Canva artworks and wire them in

## 1. Goal

Replace the flat text-box number cards with **baked full-art card images**
(one finished PNG per card: art + frame + name + rank + suit emblem), shown
both in the catalog and in battle. SP4a builds the **render layer and asset
pipeline** and makes every consumer size-correct; it ships with a vector
fallback so it is testable before any real art exists. SP4b produces the 36
images.

The 9 card names are already fixed in `docs/product/独自カードゲーム_用語集と要件定義目次.md`
(§ 数字とカード名称): 1 大魔王 / 2 魔王 / 3 魔将軍 / 4 悪魔 / 5 人間の戦士 /
6 天使 / 7 聖将軍 / 8 大天使 / 9 神. With the 4 suits (火/水/風/土) that is
**36 unique artworks** (e.g. 火の大魔王, 水の神).

## 2. Scope

### In scope (SP4a)

- Rebuild `CardFace` to render a baked card image when one exists, a themed
  vector card when it does not, plus a legibility overlay (rank badge + suit
  emblem) at small sizes, keeping all existing selection / lock / glow / Joker
  overlays.
- New size table with larger battle cards and a new `catalog` size; make it the
  single source of truth consumed by `HandFan` and `FieldTrail`.
- Generated static-`require` asset map (`cardArtAssets.ts`) + generator script +
  `check-cards-full-assets.mjs` wired into the `assets:check` group.
- Catalog screen renders cards via `CardFace size="catalog"` instead of the text
  placeholder; detail modal shows the large card + i18n name/suit/rank text.
- Layout follow-through in `HandFan`, `FieldTrail` / `fieldTrailLayout.ts`, and
  both battle `play.tsx` screens for the larger cards.
- Art-direction doc `docs/art/SP4-GR-01-number-card-art.md` (world, palette,
  do/avoid, Canva prompt template, template design-ID record) — written in SP4a,
  used in SP4b.
- Pure-logic tests + the check script.

### Out of scope

- The 36 Canva artworks and the Canva card template build (SP4b).
- Skill cards (6) and the card back — they keep the current placeholders; a
  later sub-project.
- i18n: card names stay Japanese and are baked into the images. The
  requirements doc lists multi-language as 将来; SP4a keeps the i18n **keys**
  alive for names/suits/ranks so a future localisation can add non-baked text or
  regenerate art.
- Moving `CardFace` out of `features/cpu-game/`.
- Any game-core / rules change.

## 3. Card asset spec (the contract SP4b fills)

| Item | Value |
|---|---|
| Format | One finished PNG per card (art + frame + name plate + rank pennant + suit emblem all baked) |
| Aspect / size | 5:7, **832 × 1164 px** (same ratio as `card-template.svg` 750×1050, ~@2× for catalog crispness) |
| Count | 36 (9 names × 4 suits). Art does **not** change for day/night — 昼夜 is carried by the board and frame chrome, not the card face. No 72-variant set. |
| Path | `assets/cards/full/card-<rank>-<suit>.png` — `<rank>` = 1..9, `<suit>` = `fire|water|wind|earth` |
| Master-ID link | maps to `CARD_NUMBER_RANK_<n>_<SUIT>` via the generated manifest |
| Frame | suit-colour border; top name plate ("火 / 大魔王"); bottom rank pennant (large numeral); fixed-position suit emblem; gold accents (`ACCENT #C9A94E`) matching the existing dark-temple backgrounds |
| Safe area | rank / name / emblem within the inner 80%; keep the four corners clear for the code-drawn selection frame and lock ring |
| Byte budget | ≤ 200 KB per file (≈ 5–7 MB for 36, bundled) |
| Style | dark-temple digital painting, consistent with `assets/backgrounds/*.png` |

## 4. `CardFace` rebuild

File: `apps/mobile/src/features/cpu-game/CardFace.tsx` (unchanged location).

### 4.1 API

```ts
export type CardFaceSize = 'catalog' | 'hand' | 'field' | 'mini';
export type CardFaceProps = {
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  size: CardFaceSize;
};
```

Same prop shape as today plus the `catalog` size. Still a pure presentational
component — no store access.

### 4.2 Size table — single source of truth

New module `apps/mobile/src/features/cpu-game/cardMetrics.ts`:

```ts
export const CARD_ASPECT = 7 / 5; // height / width
export const CARD_METRICS: Record<CardFaceSize, { width: number }> = {
  catalog: { width: 300 },
  hand:    { width: 72 },
  field:   { width: 88 },
  mini:    { width: 48 },
};
export const cardHeight = (w: number) => Math.round(w * CARD_ASPECT);
/** Below this rendered width, draw the code rank badge + emblem over the art. */
export const OVERLAY_BELOW_WIDTH = 120;
```

`HandFan` (`CARD_WIDTH`) and `fieldTrailLayout.ts` (`FIELD_CARD_W`,
`MINI_CARD_W`, `CARD_BOX_HEIGHT`) stop defining their own numbers and import
from here. Widths above are **starting values**, tuned once against the 16:9
frame during implementation; the tuned values are the ones that ship.

### 4.3 Render layers (bottom to top)

1. **Base**: if `resolveCardArt(rank, suitCode)` returns a source →
   `<Image>` at the size's width×height, `borderRadius`. Else → **vector card**:
   themed rounded rect, suit-colour border, big centred numeral, suit emblem,
   and (at `catalog` only) a small name-plate line. The vector card is
   essentially today's `CardFace` at the new sizes; it keeps the component
   usable through SP4a and as a permanent fallback.
2. **Legibility overlay** (only when rendered width `< OVERLAY_BELOW_WIDTH` —
   i.e. `hand` / `field` / `mini`, not `catalog` — and only over an image base;
   the vector base already draws rank and emblem itself): a
   rank badge (rounded rect, suit colour, high-contrast bold numeral) pinned
   bottom-left, and the suit emblem glyph pinned top-left. Sized as a fraction
   of card width.
3. **Joker**: unchanged behaviour — `isJoker` draws the `J` badge; the
   declared-card appearance after 変化Joker is the target card's image/vector
   plus the `J` badge.
4. **Existing overlays** (selection frame, lock ring, glow, submit) continue to
   be drawn by the callers on top of `CardFace`; nothing there changes except
   they now sit over a possibly-larger card.

### 4.4 Asset resolution

`apps/mobile/src/features/cpu-game/cardArtAssets.ts` — **generated**, a literal
`require` per present file (Metro needs literal paths):

```ts
export const cardArtAssets: Partial<Record<string, number>> = {
  // 'card-1-fire': require('../../../../../assets/cards/full/card-1-fire.png'),
  // …filled by scripts/generate-card-art-manifest.mjs as PNGs land
};
export function cardArtKey(rank: number, suit: SuitCode): string { … }
export function resolveCardArt(rank: number, suit: SuitCode): number | null {
  return cardArtAssets[cardArtKey(rank, suit)] ?? null;
}
```

During SP4a the map is empty or holds 2–3 sample PNGs; SP4b regenerates it.

## 5. Catalog integration

`apps/mobile/src/app/catalog/index.tsx`:

- Grid item: replace the text placeholder (`cardKind`/`cardTitle`/…) with
  `<CardFace size="catalog" rank suitCode isJoker={false} />` for number cards.
  Skill cards keep the existing text placeholder for now.
- Detail modal: large `CardFace` + a text block from i18n — card name
  (`catalog.numberCard.name.<rank>`), suit label, rank — so the name is
  screen-reader reachable and future-searchable even though the image bakes it.
- `cardCatalog.ts`: add `fullArtPath` to `CatalogItem` for number cards;
  `assertCompleteM0Catalog` follows the new path for number cards and leaves the
  `.svg` assertion for skill cards.
- New i18n keys: `catalog.numberCard.name.1` … `.9` (the 9 names).

## 6. Asset pipeline

- `assets/manifests/cards-full.json` — `{ version, size: {w,h}, maxBytes,
  cards: [{ cardId, rank, suit, assetId, path }] × 36 }`.
- `scripts/generate-card-art-manifest.mjs` — reads `assets/cards/full/`, writes
  `cardArtAssets.ts` with one literal `require` per file found; idempotent.
  `npm run assets:generate:cards`.
- `scripts/check-cards-full-assets.mjs` — for each manifest entry that has a
  file: assert PNG, exact 832×1164, `≤ maxBytes`, kebab name match. Reports
  present/missing counts; **non-fatal on missing** during SP4a (SP4b flips it to
  require all 36). Added to the repo's `assets:check` aggregate.
- Art-direction doc `docs/art/SP4-GR-01-number-card-art.md`: world/palette/
  do-avoid (extends `M0-GR-01`), the per-card Canva prompt template
  `"<style base> … <element> realm, <being> (<rank-name EN>), …"`, safe-area
  overlay reference, and a table to record Canva design IDs + export params
  (mirrors `assets/backgrounds/README.md`).

## 7. Day/night, motion, accessibility

- Card art is day/night-invariant. `AppBackground inverted` and the board
  already carry 革命. The vector fallback border uses themed suit colours via
  `useThemedStyles`.
- `<Image>` has no motion; existing entrance/glow animations act on the wrapper
  and are unaffected.
- `accessibilityLabel` stays "`<rank> <suit> [joker]`" as today (built from
  i18n), independent of whether art or vector rendered.
- UI-A11Y-002 preserved: suit is always shown by emblem shape, never colour
  alone — baked into art, and drawn in the vector base / small-size overlay.

## 8. Layout follow-through & coordination

Larger cards touch files the concurrent M4 work is editing (`FieldTrail`
reworked in `13bde1e`/`3be3aea`, `HandFan`, both `play.tsx`, `SkillMiniCard`,
`components/index.ts`).

- `HandFan`: fan geometry uses `CARD_METRICS.hand.width`; re-tune `maxSpread` /
  `arc` and the container height for the taller card.
- `FieldTrail` / `fieldTrailLayout.ts`: `FIELD_CARD_W` / `MINI_CARD_W` /
  `CARD_BOX_HEIGHT` come from `cardMetrics`; the ellipse `ellipseSize()` grows
  with the bigger `field` card. `SkillMiniCard` sizes align to the same metrics.
- Both `play.tsx`: the footer hand area and opponent mini-card rows get taller;
  check the 3-column footer and the 16:9 scroll area still fit.
- **Sequencing**: land `cardMetrics` + `CardFace` first (self-contained), then
  the consumer re-tunes in one commit, rebasing on M4's latest. Do not
  interleave with an in-flight M4 change to the same file — coordinate per the
  executing-plans rule (commit only own files, explicit paths, no `git add -A`).

## 9. Testing

Pure logic (`tsx --test`, no RTL):

- `cardArtKey` / `resolveCardArt`: key format for all 9×4; `null` when absent;
  returns the source when the map has it (inject a fake map).
- `cardMetrics`: `cardHeight` ratio; every `CardFaceSize` present; `hand < field`
  and `mini < hand`.
- overlay threshold: `hand`/`field`/`mini` widths are `< OVERLAY_BELOW_WIDTH`,
  `catalog` is not.
- `cardCatalog`: `buildCatalogItems` sets `fullArtPath` for all 36 number
  cards; `assertCompleteM0Catalog` still passes.
- `check-cards-full-assets.mjs`: run against a tmp dir with one good and one
  malformed PNG → correct present/invalid report.

Manual (web, `expo start --web`): catalog grid + detail; CPU battle hand/field/
mini with the vector fallback and with a sample PNG; selection/lock/glow still
align; day↔night.

## 10. Risks / open questions

- **Bundle size**: 36 × ≤200 KB PNG is acceptable bundled; revisit if SP4b art
  overshoots (then consider `expo-image` + remote, out of scope now).
- **Baked JP text vs i18n**: accepted for v1 per the requirements doc; keys kept
  alive (§5). Flag before any English release.
- **Concurrent edits** (§8): main risk to a clean landing; mitigated by
  sequencing and rebase.
- **Sample art for SP4a verification**: needs 2–3 real PNGs from Canva during
  SP4a, or the vector fallback alone carries acceptance and image path is
  proven with a single throwaway PNG.
- **`catalog` width 300 in the 16:9 web frame**: confirm the grid still shows a
  useful number of columns; may land at 240–280.
