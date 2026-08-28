# M0-EX-05 Design Token Interface

- TODO: M0-EX-05
- Package: packages/ui
- Public entrypoint: packages/ui/src/index.ts

## Public Categories

| Category | Responsibility |
|---|---|
| colors | Semantic surfaces, ink, suit colors, and state colors from M0-GR-01 and M0-GR-03. |
| spacing | Shared spacing primitives for compact Android landscape UI. |
| radius | Control, card, modal, and source-card corner radius values. |
| typography | System font family, fixed font sizes, weights, and zero letter spacing. |
| card | Aspect ratio, source size, display sizes, and safe-area bounds from M0-GR-02. |

## Boundaries

- The token package contains display constants only.
- It does not read Supabase, persist data, log user information, or know private hands.
- Runtime screens may import tokens directly or map them into framework-specific style objects.

## Verification

Run npm run ui:test and npm run ui:typecheck to verify token values and TypeScript compatibility.
