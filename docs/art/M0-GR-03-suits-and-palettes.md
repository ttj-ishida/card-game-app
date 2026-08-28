# M0-GR-03 Suit Emblems and Day/Night Palettes

- TODO: M0-GR-03
- Version: v0.1
- Date: 2026-08-28
- Depends on: M0-GR-01
- Manifest: assets/manifests/m0-suits-and-palettes.json

## Purpose

Create temporary suit emblems and day/night palettes that can be used by the M0 card catalog and later placeholder card generation. The four suits must remain distinguishable when color is unavailable or unreliable.

## Suit Decisions

| Suit code | Runtime asset | Color | Shape cue | Color-independent cue |
|---|---|---|---|---|
| SUIT_FIRE | assets/runtime/m0/emblems/suit-fire.svg | #D84A2B | flame | Pointed outer flame with inner cutout. |
| SUIT_WATER | assets/runtime/m0/emblems/suit-water.svg | #2577B8 | drop-wave | Asymmetric drop plus wave stripe. |
| SUIT_WIND | assets/runtime/m0/emblems/suit-wind.svg | #31886B | sweeping-leaf | Two separate flowing leaf strokes. |
| SUIT_EARTH | assets/runtime/m0/emblems/suit-earth.svg | #8A6A2A | diamond-mountain | Diamond boundary with mountain cutout. |

## Palette Decisions

| Palette | Background | Card face | Primary ink | Border | Use |
|---|---|---|---|---|---|
| Day | #EEF5F1 | #FAF8F0 | #1B1D24 | #1B1D24 | Default catalog and normal battle table. |
| Night | #17202A | #FAF8F0 | #F5F2E8 | #F5F2E8 | Revolution/night state preview and future battle background. |

## Production Notes

- Emblem source and runtime SVGs use a 160 x 160 viewBox and transparent background.
- Each emblem must stay under 20 KB and remain readable inside the M0-GR-02 corner mark box.
- Placeholder card generation must use suitCode and assetId, not display names.
- These are project-owned placeholder assets, not third-party licensed art.

## Review Record

| Step | Result |
|---|---|
| Rough | Four silhouette families selected from M0-GR-01 direction. |
| Review | Self-check confirms each suit has a distinct shape cue independent of color. |
| Revision | Added inner cutouts/stripes to improve thumbnail identification. |
| Approval | Accepted for M0-GR-04 placeholder card generation. |
| Export | Source and runtime SVGs saved with matching manifest entries. |

## Verification

Run npm run assets:check to validate suit count, required suit codes, unique shape cues, SVG dimensions, file sizes, and palette presence.
