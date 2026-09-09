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
`<element>` emblem, export PNG at 832 × 1164.

## Records (fill during SP4b)

| card        | Canva design ID | exported | bytes | notes |
| ----------- | --------------- | -------: | ----: | ----- |
| card-1-fire |                 |          |       |       |
| … (36 rows) |                 |          |       |       |

## Wiring (SP4b close-out)

1. Drop all 36 PNGs into `assets/cards/full/`.
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
