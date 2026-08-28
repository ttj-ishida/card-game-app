# M0-GR-03 属性紋章と昼夜パレット

- TODO: M0-GR-03
- 版: v0.1
- 日付: 2026-08-28
- 依存TODO: M0-GR-01
- manifest: assets/manifests/m0-suits-and-palettes.json

## 目的

M0のカードカタログと後続のカード仮素材生成で使う、属性紋章と昼夜パレットを作成する。4属性は、色が使えない、または見分けづらい環境でも識別できる必要がある。

## 属性の決定

| 属性コード | runtime asset | 色 | 形の手がかり | 色以外の識別要素 |
|---|---|---|---|---|
| SUIT_FIRE | assets/runtime/m0/emblems/suit-fire.svg | #D84A2B | 炎 | 尖った外形と内側の抜き。 |
| SUIT_WATER | assets/runtime/m0/emblems/suit-water.svg | #2577B8 | しずくと波 | 非対称なしずくと波線。 |
| SUIT_WIND | assets/runtime/m0/emblems/suit-wind.svg | #31886B | 流線の葉 | 2本に分かれた流れる葉形。 |
| SUIT_EARTH | assets/runtime/m0/emblems/suit-earth.svg | #8A6A2A | 菱形と山 | 菱形の境界と山形の抜き。 |

## パレットの決定

| パレット | 背景 | カード表面 | 主要文字 | 境界線 | 用途 |
|---|---|---|---|---|---|
| 昼 | #EEF5F1 | #FAF8F0 | #1B1D24 | #1B1D24 | 通常カタログと通常対局卓。 |
| 夜 | #17202A | #FAF8F0 | #F5F2E8 | #F5F2E8 | 革命・夜状態previewと後続の対局背景。 |

## 制作メモ

- 紋章のsource/runtime SVGは160 x 160 viewBoxで、背景は透過にする。
- 各紋章は20 KB以下とし、M0-GR-02のcorner mark box内でも読めるようにする。
- カード仮素材生成では表示名ではなく、suitCodeとassetIdを使う。
- これらはプロジェクト所有の仮素材であり、第三者ライセンス素材ではない。

## レビュー記録

| 手順 | 結果 |
|---|---|
| ラフ | M0-GR-01の方向性から4つのシルエット系統を選定した。 |
| レビュー | 各属性が色に依存しない異なる形の手がかりを持つことを確認した。 |
| 修正 | サムネイル識別性を高めるため、内側の抜きやstripeを追加した。 |
| 承認 | M0-GR-04のカード仮素材生成の前提として採用。 |
| 書き出し | source/runtime SVGをmanifest entryと一致する形で保存した。 |

## 確認方法

`npm run assets:check` で、属性数、必須suit code、uniqueなshape cue、SVG寸法、容量、昼夜paletteの存在を検証する。
