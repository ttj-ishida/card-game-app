# ADR-0003: Card Asset Template, Ratio, Safe Area, and Export Sizes

- Status: Accepted for M0
- Date: 2026-08-28
- Related TODO: M0-GR-02
- Depends on: M0-GR-01

## Context

M0 must show all 42 cards in a catalog with temporary art. The exact production illustration style is not final, but every placeholder asset needs a stable frame, predictable dimensions, and safe area rules before M0-GR-04 can generate number cards, skill cards, and card backs.

The app is Android-first, landscape-only for v1.0, and must support phone and tablet screens. Card art itself remains portrait inside the landscape interface.

## Requirements

- Inputs: M0-GR-01 art direction, master card IDs from M0-SB-04, Android landscape target, and accessibility requirements.
- Outputs: one card template decision record, one machine-readable manifest, one editable template SVG, and one runtime template SVG.
- Normal case: all generated M0 card placeholders share the same ratio, viewBox, safe area, and export-size vocabulary.
- Failure case: invalid dimensions, missing safe-area bounds, oversized assets, or mismatch between source and runtime template must fail asset inspection.
- Out of scope: final illustration quality, localized card names, animation timings, and store artwork.

## Options Considered

| Option | Summary | Development Cost | Operating Cost | Security | Future Extension | Player Experience |
|---|---|---|---|---|---|---|
| A: 5:7 portrait card, 750 x 1050 source | Simple playing-card-like ratio, integer scaling to 250 x 350 catalog cards. | Low | Low | No special risk | Strong, easy to generate and scale | Familiar card silhouette and readable ranks. |
| B: 63:88 poker ratio, 756 x 1056 source | Real-card-inspired ratio with closer physical-card feel. | Medium | Low | No special risk | Good, but less convenient integer scaling | Slightly more authentic, little M0 benefit. |
| C: Square tile, 768 x 768 source | Dense catalog grid and easy icon layout. | Low | Low | No special risk | Weak for later hand/table UI | Less card-like, weakens table readability. |

## Decision

Adopt option A: 5:7 portrait card art with a 750 x 1050 source canvas.

The M0 base display size is 250 x 350 px. The source is 3x that base size, giving simple downscaling for thumbnails and enough room for future placeholder refinements. A 5:7 ratio is familiar as a card silhouette, easier to calculate than physical-card ratios, and works cleanly in React Native layout constraints.

## Fixed Template Values

| Item | Value |
|---|---|
| Aspect ratio | 5:7 portrait |
| Source size | 750 x 1050 px |
| ViewBox |  0 750 1050 |
| Base catalog size | 250 x 350 px |
| Thumbnail size | 150 x 210 px |
| Detail preview size | 500 x 700 px |
| Source scale | 3x base catalog size |
| Outer bleed | 24 px from source edge |
| Safe area | x=60, y=84, width=630, height=882 |
| Essential text area | x=90, y=126, width=570, height=798 |
| Corner mark box | 96 x 126 px |
| Minimum stroke | 4 px source, equivalent to about 1.33 px at base display |
| Runtime format for M0 | SVG, sRGB, opaque card face/back unless specifically an overlay |
| Maximum placeholder size | 80 KB per card SVG |

## Consequences

- M0-GR-03 suit emblems should fit inside a 160 x 160 source-space box and remain readable at thumbnail size.
- M0-GR-04 number, skill, and back placeholders must use the manifest values instead of per-file custom dimensions.
- M0-EX-05 design tokens should expose card ratio, radii, spacing, colors, and semantic state values derived from M0-GR-01 and this ADR.
- M0-QA-01 can map Supabase card IDs to placeholder asset paths without recalculating dimensions.

## Review and Revisit Conditions

Revisit this decision if final production art requires a materially different card silhouette, if Android catalog cards need to show more than four columns on small landscape devices, or if performance measurements show SVG card placeholders are too expensive.

## Verification

Run npm run assets:check to validate the manifest dimensions, safe-area bounds, source/runtime SVG dimensions, and size limits.
