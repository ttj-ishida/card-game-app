# M0-GR-04 Card Placeholder Assets

- TODO: M0-GR-04
- Version: v0.1
- Date: 2026-08-28
- Depends on: M0-GR-02, M0-GR-03
- Manifest: assets/manifests/m0-card-placeholders.json

## Purpose

Provide temporary card images for the M0 catalog. The generated set follows the Supabase master seed: 36 number cards and 4 skill card definitions whose card_count values represent 6 physical skill cards. A shared M0 card back is also included for hidden/deck states.

## Asset Coverage

| Type | Coverage | Runtime path |
|---|---|---|
| Number cards | RANK_1 through RANK_9 across SUIT_FIRE, SUIT_WATER, SUIT_WIND, SUIT_EARTH | assets/runtime/m0/cards/number/*.svg |
| Skill cards | SKILL_CARD_JOKER_HERO, SKILL_CARD_JOKER_SAINT, SKILL_CARD_EXTENSION_SEAL, SKILL_CARD_REVOLUTION | assets/runtime/m0/cards/skill/*.svg |
| Card back | Shared M0 card back | assets/runtime/m0/cards/back/card-back-m0.svg |

## Rules

- Placeholder dimensions come from assets/manifests/m0-card-template.json.
- Suit colors and color-independent shape cues come from assets/manifests/m0-suits-and-palettes.json.
- Re-running npm run assets:generate should recreate the same manifest and SVG paths.
- Skill definitions with card_count 2 intentionally share one placeholder image per skill ID.

## Review Record

| Step | Result |
|---|---|
| Rough | Generated simple SVG placeholders from stable card and skill IDs. |
| Review | Self-check confirms every number card ID and skill definition has source/runtime assets. |
| Revision | Manifest records physicalDeckCount 42 while preserving 4 skill master definitions. |
| Approval | Accepted for M0-QA-01 catalog integration. |
| Export | Source and runtime SVG files generated from scripts/generate-m0-card-placeholders.mjs. |

## Verification

Run npm run assets:generate and npm run assets:check to regenerate and validate asset count, IDs, dimensions, and file-size limits.
