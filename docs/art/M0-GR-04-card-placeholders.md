# M0-GR-04 カード仮素材

- TODO: M0-GR-04
- 版: v0.1
- 日付: 2026-08-28
- 依存TODO: M0-GR-02、M0-GR-03
- manifest: assets/manifests/m0-card-placeholders.json

## 目的

M0カードカタログで使う仮カード画像を用意する。生成対象はSupabase master seedに合わせ、数字カード36枚と、card_countの合計で物理カード6枚を表すスキルカード定義4件とする。非公開・山札状態用に共通カード裏面も含める。

## アセット範囲

| 種別 | 対象 | runtime path |
|---|---|---|
| 数字カード | RANK_1からRANK_9、SUIT_FIRE、SUIT_WATER、SUIT_WIND、SUIT_EARTHの全組み合わせ | assets/runtime/m0/cards/number/*.svg |
| スキルカード | SKILL_CARD_JOKER_HERO、SKILL_CARD_JOKER_SAINT、SKILL_CARD_EXTENSION_SEAL、SKILL_CARD_REVOLUTION | assets/runtime/m0/cards/skill/*.svg |
| カード裏面 | M0共通カード裏面 | assets/runtime/m0/cards/back/card-back-m0.svg |

## ルール

- 仮素材の寸法は assets/manifests/m0-card-template.json に従う。
- 属性色と色以外の形の手がかりは assets/manifests/m0-suits-and-palettes.json に従う。
- `npm run assets:generate` を再実行すると、同じmanifestとSVG pathが再生成される。
- card_countが2のスキル定義は、skill IDごとに1つの仮画像を共有する。

## レビュー記録

| 手順 | 結果 |
|---|---|
| ラフ | 安定したカードID・スキルIDから単純なSVG仮素材を生成した。 |
| レビュー | すべての数字カードIDとスキル定義にsource/runtime assetがあることを確認した。 |
| 修正 | スキルmaster定義4件を保ったまま、manifestのphysicalDeckCountで42枚を表現した。 |
| 承認 | M0-QA-01のカードカタログ結合に使う仮素材として採用。 |
| 書き出し | scripts/generate-m0-card-placeholders.mjs から source/runtime SVGを生成した。 |

## 確認方法

`npm run assets:generate` と `npm run assets:check` を実行し、asset数、ID、寸法、容量上限を検証する。
