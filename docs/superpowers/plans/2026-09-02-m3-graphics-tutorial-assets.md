# M3 Graphics Tutorial Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reproducible SVG rough assets for M3-GR-01 through M3-GR-05 and document their completion.

**Architecture:** Follow the existing M2 asset pipeline: one generator script writes source/runtime SVGs and manifest, one check script validates manifest/file integrity, root npm scripts expose generation and validation. Progress docs record each TODO's generated assets and verification commands.

**Tech Stack:** Node.js ESM scripts, SVG, JSON manifest, npm scripts, Git.

**Spec:** `docs/superpowers/specs/2026-09-02-m3-graphics-tutorial-assets-design.md`

## Global Constraints

- All assets are self-authored SVG generated from deterministic script constants.
- Source and runtime assets are separated under `assets/source/m3/...` and `assets/runtime/m3/...`.
- Every SVG includes root `xmlns`, `width`, `height`, `viewBox`, `role="img"`, `<title>`, and `<desc>`.
- No external network or licensed asset input is used.
- Manifest path is `assets/manifests/m3-graphics-assets.json`.
- Root npm scripts are `assets:generate:m3` and `assets:check:m3`.

---

### Task 1: Generator and Manifest

**Files:**
- Create: `scripts/generate-m3-graphics-assets.mjs`
- Create generated: `assets/source/m3/**`
- Create generated: `assets/runtime/m3/**`
- Create generated: `assets/manifests/m3-graphics-assets.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `node scripts/generate-m3-graphics-assets.mjs`
- Produces: manifest groups `rankIllustrations`, `attributeFrames`, `attributeEmblems`, `skillCandidates`, `tutorialPanels`

- [ ] **Step 1: Add the generator script**

Create a deterministic Node ESM script with helpers `svg(sizeKey,title,desc,body)`, `emit(assetId, subdir, content, extra)`, and manifest object matching the spec.

- [ ] **Step 2: Add root npm script**

Add `"assets:generate:m3": "node scripts/generate-m3-graphics-assets.mjs"` to root `package.json`.

- [ ] **Step 3: Run generator**

Run: `npm run assets:generate:m3`
Expected: generated manifest and 52 SVG files total, counting source plus runtime copies for 26 logical assets.

### Task 2: Asset Checker

**Files:**
- Create: `scripts/check-m3-assets.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `assets/manifests/m3-graphics-assets.json`
- Produces: `node scripts/check-m3-assets.mjs`

- [ ] **Step 1: Add checker script**

Validate TODO IDs, group counts, dimensions, accessibility tags, file sizes, and source/runtime existence.

- [ ] **Step 2: Add root npm script**

Add `"assets:check:m3": "node scripts/check-m3-assets.mjs"` to root `package.json`.

- [ ] **Step 3: Run checker**

Run: `npm run assets:check:m3`
Expected: PASS with a checked file count.

### Task 3: Progress Docs and Verification

**Files:**
- Create: `docs/progress/M3-GR-01.md`
- Create: `docs/progress/M3-GR-02.md`
- Create: `docs/progress/M3-GR-03.md`
- Create: `docs/progress/M3-GR-04.md`
- Create: `docs/progress/M3-GR-05.md`

**Interfaces:**
- Consumes: generated manifest and check output
- Produces: progress records for all M3-GR TODOs

- [ ] **Step 1: Write progress docs**

Record generated asset groups, manifest/check script paths, verification commands, and remaining visual review scope.

- [ ] **Step 2: Run verification**

Run: `npm run assets:generate:m3`, `npm run assets:check:m3`, `npm run mobile:format:check`, `git diff --check`.
Expected: all pass.

- [ ] **Step 3: Commit and push**

Stage only explicit M3 asset/script/docs paths and `package.json`, commit with `feat(assets): [M3-GR-01..05] add graphics tutorial roughs`, then push.
