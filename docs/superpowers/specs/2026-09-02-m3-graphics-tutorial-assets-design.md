# M3 サブプロジェクト5：グラフィックラフ素材とチュートリアル図解 設計書

- 作成日：2026-09-02
- 版数：0.1
- 対象TODO：M3-GR-01、M3-GR-02、M3-GR-03、M3-GR-04、M3-GR-05
- 後続TODO：M3-EX-06（初回チュートリアル画面）
- 基準文書：`docs/product/独自カードゲーム_M3_詳細TODO_v0.2.md`、`docs/progress/M2-GR-01.md`、`docs/progress/M2-GR-02.md`、`docs/progress/M2-GR-03.md`、`docs/progress/M2-GR-04.md`

## 1. 目的

M3 の CPU アルファで必要な「全初期スキル、履歴、統計、チュートリアルを含むCPU版を外部確認できる」状態に向けて、チュートリアルと後続カード見た目改善に使えるラフ以上の素材をリポジトリ内で追跡可能にする。

M3 では商用完成イラストではなく、レビュー可能で再生成可能な SVG ラフ素材を採用する。M0/M1/M2 と同じく、編集元 `assets/source/...` と書き出し `assets/runtime/...` を分離し、manifest と検査 script で欠落を検知する。

## 2. 非目標

| 非目標 | 理由 |
| --- | --- |
| 最終カードアートの確定 | M6 以降で本番候補・演出込みの品質へ引き上げる |
| AI生成ラスタ画像の採用 | 現段階では再生成性、差分レビュー、容量管理を優先する |
| モバイル画面への全面適用 | M3-GR は素材準備。実画面適用は M3-EX-06 と後続演出タスクで扱う |
| 外部ライセンス素材の取り込み | 権利確認コストを避け、全素材を自前 SVG として生成する |

## 3. 成果物

### 3.1 生成 script

- `scripts/generate-m3-graphics-assets.mjs`
  - M3-GR-01〜05 の SVG と manifest を生成する。
  - 入力は script 内の安定した定義配列のみとし、ネットワークや外部ファイルに依存しない。
  - 実行すると source と runtime の両方へ同一 SVG を書き出す。

### 3.2 検査 script

- `scripts/check-m3-assets.mjs`
  - manifest の TODO ID、件数、寸法、`role="img"`、`title`、`desc`、最大ファイルサイズ、source/runtime 両方の存在を検査する。
  - `npm run assets:check:m3` から実行できる。

### 3.3 manifest

- `assets/manifests/m3-graphics-assets.json`
  - `todoIds`: `M3-GR-01`〜`M3-GR-05`
  - `rankIllustrations`: 9件（rank 1〜9）
  - `attributeFrames`: 4件（火・水・風・土）
  - `attributeEmblems`: 4件（火・水・風・土）
  - `skillCandidates`: 4件（勇者Joker、聖女Joker、追加封印、革命）
  - `tutorialPanels`: 5件（基本の強弱、場の更新、縛り・封印、スキル、履歴・戦績）

## 4. アセット仕様

| 種別 | 件数 | source path | runtime path | サイズ | 対応TODO |
| --- | ---: | --- | --- | --- | --- |
| 階級イラスト | 9 | `assets/source/m3/card-illustrations/` | `assets/runtime/m3/card-illustrations/` | 630x882 | M3-GR-01 |
| 属性フレーム | 4 | `assets/source/m3/frames/` | `assets/runtime/m3/frames/` | 750x1050 | M3-GR-02 |
| 属性紋章 | 4 | `assets/source/m3/emblems/` | `assets/runtime/m3/emblems/` | 200x200 | M3-GR-02 |
| スキル候補 | 4 | `assets/source/m3/skill-candidates/` | `assets/runtime/m3/skill-candidates/` | 750x1050 | M3-GR-03 / M3-GR-04 |
| チュートリアル図解 | 5 | `assets/source/m3/tutorial/` | `assets/runtime/m3/tutorial/` | 1280x720 | M3-GR-05 |

## 5. 視覚方針

### 5.1 階級イラスト

9階級は数字だけに頼らず、シルエットで段階差を読む。弱い側から強い側へ、台座、人物、旗、玉座、光背などの構成密度を段階的に増やす。各 SVG には大きな rank 数字も入れ、小表示でも対応 rank を誤読しないようにする。

### 5.2 属性フレーム・紋章

火・水・風・土は M2 の形状キューを維持する。

| 属性 | 色 | 形状キュー |
| --- | --- | --- |
| 火 | 赤系 | とがった炎・三角 |
| 水 | 青系 | 波線・しずく |
| 風 | 緑系 | 渦・流線 |
| 土 | 黄土系 | 菱形・石片 |

色だけで識別させず、フレーム端のパターンと紋章形状で区別する。

### 5.3 スキル候補

勇者Jokerと聖女Jokerは同じ Joker 系であることを保ちつつ、勇者は剣と太陽、聖女は杯と月で区別する。追加封印は鎖と封蝋、革命は反転矢印と昼夜反転の記号を使う。

### 5.4 チュートリアル図解

初回チュートリアル画面から直接使える横長パネルにする。文字説明に依存しすぎず、盤面・カード・矢印・状態アイコンで理解できる構成にする。

5パネルは次の内容を固定する。

| panelId | 内容 |
| --- | --- |
| `m3-tutorial-strength-order` | 昼と夜で数字の強弱が反転する |
| `m3-tutorial-lead-update` | 場なしリード、より強い手で更新、パス |
| `m3-tutorial-locks` | 枚数ロック、属性固定、属性統一、追加封印 |
| `m3-tutorial-skills` | Joker場流し、変化Joker、追加封印、革命 |
| `m3-tutorial-history-stats` | 対局後に履歴と戦績を確認できる |

## 6. npm scripts

root `package.json` に次を追加する。

- `assets:generate:m3`: `node scripts/generate-m3-graphics-assets.mjs`
- `assets:check:m3`: `node scripts/check-m3-assets.mjs`

## 7. 品質条件

- すべての SVG は root `<svg>` に `xmlns`, `width`, `height`, `viewBox`, `role="img"`, `<title>`, `<desc>` を持つ。
- source と runtime は同一内容でよいが、path は必ず分離する。
- manifest に stable `assetId`、TODO ID、種別、サイズキー、対応 rank / suit / skill / panel を記録する。
- 各 SVG は M3 の検査 script の `maxBytes` を超えない。
- 生成 script を複数回実行しても同じファイル内容になる。
- `git diff --check` が通る。

## 8. 進捗記録

次のファイルを追加する。

- `docs/progress/M3-GR-01.md`
- `docs/progress/M3-GR-02.md`
- `docs/progress/M3-GR-03.md`
- `docs/progress/M3-GR-04.md`
- `docs/progress/M3-GR-05.md`

各ファイルには、生成対象、manifest、検査コマンド、残りの実機・視認レビュー範囲を記録する。

## 9. 後続への接続

M3-EX-06 は、この manifest の `tutorialPanels` を読み、初回チュートリアル画面のページ構成へ接続する。M3-GR の時点では画面実装を行わない。

M6 以降で本番アートを差し替える場合も、同じ assetId と manifest の大分類を保てば、画面側の参照を大きく変えずに置換できる。
