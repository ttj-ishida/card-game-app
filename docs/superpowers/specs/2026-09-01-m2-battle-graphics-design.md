# M2-GR-01〜04：対局グラフィックのプレースホルダ 設計書

- 文書ID：GAME-SPEC-M2-GR
- 版数：0.1
- 作成日：2026-09-01
- 基準文書：`独自カードゲーム_M2_詳細TODO_v0.2.md` §M2-GR-01〜04、`独自カードゲーム_要件定義書_v0.2.md`（§22.4 UI-A11Y、§23 FX）
- 実装場所：`scripts/`、`assets/`、`docs/progress/`
- 前例：M1-GR-01〜03（`scripts/generate-m1-rule-sandbox-assets.mjs` / `scripts/check-m1-assets.mjs` / `assets/manifests/m1-rule-sandbox-assets.json`）

---

## 1. 目的とスコープ

M2 の対局画面が参照しうる仮グラフィック（昼夜背景・代表階級イラスト・属性フレームと紋章・基本演出素材）を、**プログラム生成のプレースホルダ SVG** としてリポジトリに追加し、マニフェストで追跡・検査できるようにする。本番アートは後続（M3-GR / M6）で差し替える。

M1-GR と同じ運用：生成スクリプト + マニフェスト + 検査スクリプト + npm scripts + 進捗ドキュメント。色に依存せず形で識別（UI-A11Y-001/002）。

### スコープ外

| 項目 | 行き先 |
|---|---|
| 本番クオリティのイラスト・9階級すべて | M3-GR-01（9階級ラフ）、M6（仕上げ） |
| 演出の実装（アニメーション・画面への配線） | M3 以降（M2 は素材のみ。M2-GR-04 完了条件は「仮アニメーションへ適用できる」= 素材が存在すること） |
| モバイルアプリのコード変更 | なし（M1-GR 同様、素材レベルの成果物） |
| ラスタ書き出し（PNG/WebP）・9パッチ | 後続。M2 は SVG のみ |

## 2. Global Constraints

- 依存を追加しない。生成・検査スクリプトは Node 標準モジュール（`node:fs` / `node:path`）のみ。M1 スクリプトと同じ書式（ESM `.mjs`、`import { mkdirSync, writeFileSync } from "node:fs"`）。
- すべての SVG は `xmlns="http://www.w3.org/2000/svg"`、`viewBox`、`role="img"`、`<title>` + `<desc>`（`aria-labelledby` または `aria-label`）を持つ。M0 emblem（`assets/runtime/m0/emblems/suit-fire.svg`）の書式に合わせる。
- 色に加えて形・シルエットで意味を持たせる（昼夜、属性、演出）。
- `assets/source/m2/battle/<...>.source.svg`（編集可能な元データ）と `assets/runtime/m2/battle/<...>.svg`（最適化済み）を分離。M2 では生成物が同一でよい（M1 と同じ割り切り。source は将来手編集の起点）。
- マニフェストにすべてのアセットIDと寸法・`maxBytes`・source/runtime パス・`todoIds` を記録。検査スクリプトがマニフェスト網羅と各 SVG の宣言寸法・サイズ上限を検証。
- 既存の `assets:generate` / `assets:check` / `assets:generate:m1` / `assets:check:m1` は変更しない。`assets:generate:m2` / `assets:check:m2` を `package.json` に追加。
- コミットは `main` 直、`[TODO-ID]` 付き、明示パスのみ `git add`。

## 3. 成果物

### 3.1 スクリプト

| ファイル | 役割 |
|---|---|
| `scripts/generate-m2-battle-assets.mjs` | 全 SVG を `assets/source/m2/battle/` と `assets/runtime/m2/battle/` へ書き出し、`assets/manifests/m2-battle-assets.json` を書き出す |
| `scripts/check-m2-assets.mjs` | マニフェスト網羅（4 TODO・全カテゴリの件数）＋各 SVG の `width`/`height`/`viewBox` 宣言と `maxBytes` を検証。失敗で非ゼロ終了 |

`package.json` scripts：
```
"assets:generate:m2": "node scripts/generate-m2-battle-assets.mjs",
"assets:check:m2": "node scripts/check-m2-assets.mjs"
```

### 3.2 アセット（`assets/{source,runtime}/m2/battle/`）

| TODO | assetId | 寸法（viewBox） | maxBytes | 内容 |
|---|---|---|---|---|
| M2-GR-01 | `m2-battle-bg-day` | 1920×1080 | 40960 | 昼背景。太陽（円＋放射）＋明色の水平グラデ帯。`surface.table.day` 系 |
| M2-GR-01 | `m2-battle-bg-night` | 1920×1080 | 40960 | 夜背景。月（三日月）＋星（点在）＋暗色グラデ。`surface.table.night` 系 |
| M2-GR-02 | `m2-card-illust-rank-1` | 630×882（`card.bounds.safeArea` 相当） | 24576 | 大魔王：角＋王冠のシルエット、大きな「1」 |
| M2-GR-02 | `m2-card-illust-rank-5` | 630×882 | 24576 | 人間の戦士：剣＋盾のシルエット、大きな「5」 |
| M2-GR-02 | `m2-card-illust-rank-9` | 630×882 | 24576 | 神：光輪＋翼のシルエット、大きな「9」 |
| M2-GR-03 | `m2-frame-fire` / `-water` / `-wind` / `-earth` | 750×1050（`card.source`） | 16384 各 | 属性別カード枠。角（炎）／波（水）／渦（風）／菱（土）の縁取り＋属性色 |
| M2-GR-03 | `m2-emblem-fire` / `-water` / `-wind` / `-earth` | 200×200 | 8192 各 | 紋章。M0 emblem のシルエットを踏襲・調整 |
| M2-GR-03 | `m2-composite-rank-1` / `-5` / `-9` | 750×1050 | 32768 各 | 「代表3枚へ合成して比較」用。frame（土/水/風を代表割当）＋ emblem ＋ rank イラストを重ねたプレビュー |
| M2-GR-04 | `m2-fx-select` | 300×420 | 12288 | 選択ハイライト：カード比率の二重枠＋角マーカー |
| M2-GR-04 | `m2-fx-submit` | 400×400 | 12288 | 提出バースト：中心から外向きの放射線＋リング |
| M2-GR-04 | `m2-fx-victory` | 900×300 | 16384 | 勝利バナー：帯＋星＋「WIN」テキスト枠（文言は仮、i18n非依存の記号として） |

合計 SVG 数：2（背景）＋3（イラスト）＋4（frame）＋4（emblem）＋3（composite）＋3（fx）= **19**。source/runtime 各19 = 38 ファイル。

### 3.3 マニフェスト `assets/manifests/m2-battle-assets.json`

```json
{
  "todoIds": ["M2-GR-01", "M2-GR-02", "M2-GR-03", "M2-GR-04"],
  "version": "0.1.0",
  "status": "placeholder-for-m2-battle",
  "sizes": {
    "background": { "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "maxBytes": 40960 },
    "cardIllust": { "width": 630, "height": 882, "viewBox": "0 0 630 882", "maxBytes": 24576 },
    "frame": { "width": 750, "height": 1050, "viewBox": "0 0 750 1050", "maxBytes": 16384 },
    "emblem": { "width": 200, "height": 200, "viewBox": "0 0 200 200", "maxBytes": 8192 },
    "composite": { "width": 750, "height": 1050, "viewBox": "0 0 750 1050", "maxBytes": 32768 },
    "fxSelect": { "width": 300, "height": 420, "viewBox": "0 0 300 420", "maxBytes": 12288 },
    "fxSubmit": { "width": 400, "height": 400, "viewBox": "0 0 400 400", "maxBytes": 12288 },
    "fxVictory": { "width": 900, "height": 300, "viewBox": "0 0 900 300", "maxBytes": 16384 }
  },
  "backgrounds": [ { "assetId": "m2-battle-bg-day", "phase": "DAY", "sourcePath": "...", "runtimePath": "..." }, ... ],
  "cardIllustrations": [ { "assetId": "m2-card-illust-rank-1", "rank": 1, "nameJa": "大魔王", ... }, ... ],
  "attributeFrames": [ { "assetId": "m2-frame-fire", "suitCode": "SUIT_FIRE", ... }, ... ],
  "attributeEmblems": [ { "assetId": "m2-emblem-fire", "suitCode": "SUIT_FIRE", ... }, ... ],
  "compositePreviews": [ { "assetId": "m2-composite-rank-1", "rank": 1, "frameSuit": "SUIT_EARTH", ... }, ... ],
  "effects": [ { "assetId": "m2-fx-select", "event": "SELECT", ... }, ... ]
}
```

## 4. 検査（`check-m2-assets.mjs`）

M1 の `check-m1-assets.mjs` と同形式：

- `manifest.todoIds` が `M2-GR-01`〜`04` を含む。
- `backgrounds.length === 2`（DAY / NIGHT が1つずつ）。
- `cardIllustrations.length === 3`（rank 1 / 5 / 9）。
- `attributeFrames.length === 4` かつ `attributeEmblems.length === 4`（SUIT_FIRE/WATER/WIND/EARTH を各1）。
- `compositePreviews.length === 3`（rank 1 / 5 / 9）。
- `effects.length === 3`（SELECT / SUBMIT / VICTORY）。
- 各アセットの `sourcePath` / `runtimePath` が実在し、対応する `sizes` の `width="W"` / `height="H"` / `viewBox="..."` を宣言し、`statSync(path).size <= maxBytes`。
- 各 SVG が `role="img"` と `<title>` を含む（a11y）。
- 各 SVG が `xmlns="http://www.w3.org/2000/svg"` を含む。

## 5. 受入確認（TODO 文書との対応）

| TODO | 完了条件 | 充足 |
|---|---|---|
| M2-GR-01 | 昼夜を一目で区別できる | 昼=太陽＋明色、夜=月＋星＋暗色。形で区別。`check` が2件（DAY/NIGHT）を検証 |
| M2-GR-02 | カード内で読める品質を確認できる | 大きな rank 数字＋rank別シルエット。630×882 の安全域内。`check` が3件検証 |
| M2-GR-03 | 代表3枚へ合成して比較できる | frame + emblem + illust を重ねた `m2-composite-rank-{1,5,9}` を出力。`check` が frame4/emblem4/composite3 を検証 |
| M2-GR-04 | 仮アニメーションへ適用できる | SELECT/SUBMIT/VICTORY の静的SVG素材が存在。`check` が3件検証 |
| 全 | 成果物がアセット管理表から追跡できる | `assets/manifests/m2-battle-assets.json` |
| 全 | 関連テスト成功・重大不具合0 | `npm run assets:check:m2` PASS |

## 6. 確認手順

- `npm run assets:generate:m2`（38 SVG + マニフェスト生成、エラーなし）
- `npm run assets:check:m2`（PASS）
- `npm run assets:check:m1` / `npm run assets:check`（既存に回帰なし）
- `git diff --check`
- 進捗記録：`docs/progress/M2-GR-01.md`〜`M2-GR-04.md`（日本語、M1-GR 書式）

## 7. 将来への申し送り

- 本番アート：M3-GR-01（9階級ラフ）、M3-GR-02（属性フレーム確定）、M3-GR-03/04（Joker・スキルカード）、M6（仕上げ）。
- モバイル配線：M3 以降の演出実装で `assets/runtime/m2/battle/` を対局画面（背景）・`CardFace`（フレーム/紋章/イラスト、パック機構経由）・演出レイヤ（fx）へ接続。`MatchConfig.packId` がパック切替の継ぎ目。
- ラスタ書き出しと解像度別アセットは配線時に決定。
