# SP4-GR-01 — Number card full art (1–9 × 4 suits)

- Sub-project: SP4b (art production for SP4 カード枠)
- Date: 2026-09-09
- Extends: `docs/art/M0-GR-01-art-direction.md` (M0 flat placeholders — superseded for number cards)
- Spec: `docs/superpowers/specs/2026-09-08-sp4a-number-card-render-design.md`
- Contract: `assets/manifests/cards-full.json`, checked by `scripts/check-cards-full-assets.mjs`

## What SP4b delivers

36 finished card JPEGs — one per (rank 1–9 × suit 火/水/風/土) — at
`assets/cards/full/card-<rank>-<suit>.jpg`, each **832 × 1164**, ≤ 200 KB,
art + frame + name plate + rank pennant + suit emblem **all baked in**.

**Format note (added during SP4b execution):** the design calls for
detailed AI-painted full-bleed art, which a *lossless* PNG cannot fit under
200 KB without severe palette-reduction banding (tested: 16-colour PNG barely
fits at ~166 KB and is visibly posterized). **JPEG at quality 85 fits
comfortably (~130–175 KB per card) with no visible quality loss** — confirmed
by side-by-side comparison. The manifest, check script, and generator all
expect `.jpg`.

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
- Baked suit emblem and rank pennant must sit on the **right half** of the card:
  below 120px rendered width the app draws its OWN suit emblem at the top-left
  and its OWN rank badge at the bottom-left, so a bottom-left / top-left bake
  makes every battle card show a doubled numeral and emblem.
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
`<element>` emblem, export **JPEG, quality 85, requested at 832 × 1164**.

**Canva's export preserves the source page's aspect ratio**, so a
1587×2245-ish `poster` source lands at 823×1164 instead of 832×1164 even when
832×1164 is requested. Always hard-resize the downloaded JPEG to exactly
832×1164 locally before checking it in (e.g. Pillow `Image.resize((832,1164),
Image.LANCZOS)` then re-save at quality 85 — the ~1% stretch is imperceptible
and `check-cards-full-assets.mjs` enforces the exact pixel size).

## Records (fill during SP4b)

| card         | Canva design ID | exported   | bytes  | notes            |
| ------------ | ---------------- | ---------- | -----: | ---------------- |
| card-1-fire  | DAHVpQSBFGA       | 2026-09-19 | 134213 | poster candidate 3 (dg-7479afda) |
| card-1-water | DAHVrq_37q0       | 2026-09-19 | 154198 | poster candidate 1 (dg-074eb5ef) |
| card-1-wind  | DAHVsSzV3HA       | 2026-09-19 | 135013 | poster candidate 2 (dg-b9a54c3f); candidate 1 was a text-template misfire, discarded |
| card-1-earth | DAHVsVgK5uI       | 2026-09-19 | 143016 | poster candidate 1 (dg-39f906bc) |
| card-2-fire  | DAHVsdI74o4       | 2026-09-19 | 135664 | poster candidate 1 |
| card-2-water | DAHVsZl_84Q       | 2026-09-19 | 141617 | poster candidate 1 |
| card-2-wind  | DAHVsVphTUs       | 2026-09-19 | 143008 | poster candidate 2 (candidate 1 was an event-flyer template, discarded) |
| card-2-earth | DAHVsegcMlM       | 2026-09-19 | 151995 | poster candidate 2 (candidate 1 was an event-flyer template, discarded; also removed a stray watermark text layer) |
| … (28 rows)  |                   |            |        |                   |

## Wiring (SP4b close-out)

1. Drop all 36 JPEGs into `assets/cards/full/`.
2. `node scripts/generate-card-art-manifest.mjs` — regenerates
   `apps/mobile/src/features/cpu-game/cardArtAssets.generated.ts` with 36 lazy
   require() thunks. Then run `npm test` (from `apps/mobile`) to confirm the 36
   thunks didn't break the suite.
3. `node scripts/check-cards-full-assets.mjs --require-all` — must pass.
4. Change the `assets:check:cards` script in the root `package.json` from
   `node scripts/check-cards-full-assets.mjs` to
   `node scripts/check-cards-full-assets.mjs --require-all` so a missing artwork
   fails the check. The check is manual-only (no CI); consider also adding
   `assets:check:cards` to the `qa:m3:preflight` script.
5. Manual: catalog + CPU battle now show real art; the small-size overlay sits
   clear of the baked numeral.

## Field stage backdrop (bundled into this same SP4b batch)

Two extra PNGs, produced and wired alongside the 36 cards — a stage/altar
illustration that sits behind the latest play on the battle field, replacing
the plain gold ellipse outline (the outline + landing pulse stay, drawn on
top of the image; see `apps/mobile/src/components/FieldTrail.tsx`).

| file | scheme | notes |
| --- | --- | --- |
| `assets/backgrounds/field-stage-dark.png` | dark (night) | night/dark-theme battle stage |
| `assets/backgrounds/field-stage-light.png` | light (day) | day/light-theme battle stage |

- **Aspect ratio: 3.14:1** (≈ 464×148 at 1×) — a wide, short oval/altar shape.
  Export at a higher multiple of that ratio for retina, e.g. **1856×592**.
- **Transparent background outside the stage shape** — the art should read as
  an oval platform/altar floating on the battle backdrop, not a rectangle; the
  gold outline is drawn on top and expects the stage edge to roughly follow
  the ellipse.
- Style: same dark-temple painting language as `assets/backgrounds/*.png` and
  the 36 card arts above — a stone/gold altar or dais, no readable text, no
  characters standing on it (cards render on top). `dark` variant = night
  mood (cool rim light, deep shadow); `light` variant = day mood (warm sun,
  the existing `-day` backgrounds' palette).
- Cross-fades with the existing revolution flip (`AppBackground`'s 220ms
  timing) — doesn't need its own transition design.

Canva prompt (append the scheme's mood to the card base style above):

> Subject: a circular stone-and-gold altar/dais viewed at a slight downward
> angle, empty (no figures, no cards, no text), floating alone on a
> transparent background, wide oval footprint, <mood: "lit by cold moonlight,
> deep blue-black shadow" for dark / "lit by warm sunlight, soft golden haze"
> for light>. Matches the temple-ruin architecture of the existing battle
> backdrop.

### Wiring

1. Drop both PNGs into `assets/backgrounds/`.
2. Hand-edit `apps/mobile/src/features/theme/fieldStageAssets.generated.ts` to
   add the two lazy require() thunks (small enough not to need a generator
   script):
   ```ts
   export const fieldStageAssets: Partial<Record<string, () => number>> = {
     'field-stage-dark': () => require('../../../../../assets/backgrounds/field-stage-dark.png'),
     'field-stage-light': () => require('../../../../../assets/backgrounds/field-stage-light.png'),
   };
   ```
3. Run `npm test` (from `apps/mobile`) — `fieldStageArt.test.ts` should still
   pass (it injects its own fixture maps, unaffected by the generated map).
4. Manual: CPU battle + online battle field ellipse now shows the stage art
   behind the latest play, in both themes, and cross-fades on revolution.
