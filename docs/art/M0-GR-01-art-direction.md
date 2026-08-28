# M0-GR-01 Art Direction One-Pager

- TODO: M0-GR-01
- Version: v0.1
- Date: 2026-08-28
- Status: M0 accepted baseline
- Source asset: ssets/source/m0/art-direction-board.source.svg
- Runtime preview: ssets/runtime/m0/art-direction-board.svg
- Asset manifest: ssets/source-manifests/m0-gr-01-art-direction.json

## Purpose

M0 uses temporary art to make the card catalog readable before final illustration work starts. This direction favors clear table-play legibility over decorative fantasy detail. The visual language should make number, suit, skill type, card back, day/night state, and disabled/locked states understandable in a landscape Android layout.

## Requirement Mapping

| Requirement | M0-GR-01 decision |
|---|---|
| UI-A11Y-001 | Day/night, suit, and lock states must differ by icon, shape, label, or pattern, not color alone. |
| UI-A11Y-002 | Fire, water, wind, and earth each get a stable emblem silhouette in addition to a color. |
| UI-A11Y-003 | Card labels use large central numerals and short Japanese labels; no long text inside small card art. |
| UI-LAYOUT-001 | All previews assume Android landscape, from phone to tablet, with dense catalog scanning. |
| FX-002 | Day and night backgrounds use different value ranges and border treatments before animation work. |
| FX-003 | Attribute lock uses the suit emblem plus a ring/barrier motif, not just a tint. |
| DATA-M-001 / DATA-M-002 | Art IDs must map to stable card and skill IDs without depending on display names. |
| FUT-006 | Every asset has a stable ID, version, source path, runtime path, and license metadata. |

## Visual Direction

- World: compact magical card table; readable tournament utility with restrained ceremonial details.
- Mood: crisp, slightly luminous, not gloomy; card content should remain clear on both light and dark boards.
- Shape language: strong outer card frame, large rank area, suit emblem in a fixed corner/center lockup, skill cards with a clear banner.
- Line: 2 to 4 px geometric strokes at source scale; avoid hairlines that vanish on small screens.
- Texture: subtle paper grain or flat color bands only; avoid noisy painterly detail during M0.
- Motion implication: assets should leave room for later glow, lock, submit, and revolution overlays.

## Palette Direction

| Role | Token name | Hex | Usage |
|---|---|---|---|
| Day table | surface.table.day | #EEF5F1 | Default catalog and battle preview background. |
| Night table | surface.table.night | #17202A | Revolution/night preview background. |
| Card face | surface.card.face | #FAF8F0 | Number and skill card body. |
| Card back | surface.card.back | #2E3147 | Hidden card and deck back. |
| Ink primary | ink.primary | #1B1D24 | Main text and rank marks. |
| Ink inverse | ink.inverse | #F5F2E8 | Text on dark surfaces. |
| Fire | suit.fire | #D84A2B | Fire suit; triangle/flame silhouette. |
| Water | suit.water | #2577B8 | Water suit; wave/drop silhouette. |
| Wind | suit.wind | #31886B | Wind suit; swirl/leaf silhouette. |
| Earth | suit.earth | #8A6A2A | Earth suit; diamond/mountain silhouette. |
| Warning | state.warning | #C28A18 | Time or invalid action warning. |
| Disabled | state.disabled | #8B9098 | Disabled controls with pattern/opacity. |

## Asset Specification

| Item | M0 fixed value |
|---|---|
| Usage | Card catalog, battle mock UI, docs review board. |
| Source canvas | SVG, 1920 x 1080 px, sRGB. |
| Runtime preview | SVG, 1920 x 1080 px, optimized for repository tracking. |
| Card assumption | Portrait card art embedded into landscape UI; exact card ratio fixed in M0-GR-02. |
| Safe area | Keep essential text and emblems inside the inner 80% until M0-GR-02 finalizes exact guides. |
| Transparency | Emblems and overlays may use transparent background; card faces and backs are opaque. |
| File size target | One emblem <= 20 KB, one card placeholder <= 80 KB, one review board <= 250 KB. |
| Naming | Lowercase kebab-case asset names; card mappings use stable master IDs. |
| License | Project-owned placeholder art generated in repository; not third-party production art. |

## Review Record

| Step | Result |
|---|---|
| Rough | This document and SVG board define world, color, line, texture, and prohibited examples. |
| Review | Self-review checks requirement mapping, color-independent suit cues, file tracking, and contrast notes. |
| Revision | M0 v0.1 accepts flat readable temporary art and defers final illustration style to M2/M8. |
| Approval | Accepted for M0 follow-up tasks M0-GR-02, M0-GR-03, M0-GR-04, and M0-EX-05. |
| Export | Runtime preview exported as SVG with matching source manifest entry. |

## Prohibited Examples

- Do not rely on red/blue/green/brown alone to distinguish suits.
- Do not put long rules text inside card placeholder art.
- Do not use dark low-contrast frames that hide rank or skill labels on night backgrounds.
- Do not introduce decorative gradients as the main readability mechanism.
- Do not change asset IDs when display names change.

## Verification

- Minimum display: central labels and suit silhouettes remain identifiable when the board is scaled down to a catalog thumbnail.
- Enlarged display: strokes and spacing do not reveal accidental overlaps.
- Day/night: both backgrounds preserve enough contrast for card face, card back, and warning state.
- Lightweight mode: no required information depends on animation, sound, blur, or high frame rate.
