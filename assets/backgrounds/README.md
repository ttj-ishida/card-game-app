# Ragnarok Millennium — 背景アート (Canva生成)

遊戯王マスターデュエルのデュエルフィールドを参照した、ラグナロク・ミレニアム用の
背景画像セット。SVGの自動生成パイプライン (`assets/source` → `assets/runtime`) とは別枠で、
Canva AI で生成 → 図形レイヤーで微調整 → PNG書き出し、という流れで作成した「原画」です。

全て 1920×1080 (16:9)、Androidランドスケープ前提。
`dark` = ダークテーマ用（マスターデュエル風の夜）、`day` = ライトテーマ用（昼。暗いUI文字ではなく濃色UI文字が乗る前提で明るく）。

| ファイル | テーマ | 用途 | 元Canvaデザイン | 調整 |
|---|---|---|---|---|
| `ragnarok-battle-bg.png` | dark | CPU/オンライン対戦 | `DAHUbUcy5f0` | 中央を空けたルーン環。四隅下側に炎/地を不透明度5% |
| `ragnarok-home-bg.png` | dark | ホーム/ロビー | `DAHUbV5aQBE` | ユグドラシル大樹。下1/3を半透明10層で暗く |
| `ragnarok-bg-universal.png` | dark | 汎用 | `DAHUbTCO9yg` | 静かなルーン環、下半分ほぼ空 |
| `ragnarok-battle-bg-day.png` | day | CPU/オンライン対戦 | `DAHUcJmMLCE` | ルーン石柱＋陽光の闘技場、中央床に円紋、盤面向き |
| `ragnarok-home-bg-day.png` | day | ホーム/ロビー | `DAHUcOcFbc8` | 金のユグドラシル円盤＋明るい神殿柱、下1/3は明るく開けたまま |
| `ragnarok-bg-universal-day.png` | day | 汎用 | `DAHUcG0o1SY` | 淡い陽光のヘイズ、要素なし |

- 再書き出し: Canva MCP `export-design` に上記デザインIDと `{type:"png", width:1920, height:1080, lossless:true}`。

## 場の楕円ステージ背景(SP4b, 2026-09-20 完了)

`field-stage-dark.png` / `field-stage-light.png` — 対局画面の最終出し手を囲む
楕円の中に敷く台座/祭壇イラスト(透過背景、1856×592、収める枠の比率3.14:1)。
仕様・Canvaプロンプトは `docs/art/SP4-GR-01-number-card-art.md` の
「Field stage backdrop」節を参照。

**生成方法(実施記録)**: CanvaのAI画像生成はアルファ透過を直接出力できないため、
フラットなマゼンタ背景(#FF00FF付近)で祭壇を生成 → ローカルで色距離ベースの
クロマキー処理 → 透過PNG化、という手順で作成。スクリプトは使い捨てのため
リポジトリには残していない(手順は上記ドキュメントに記載)。デスピル(縁の色被り
除去)はオブジェクト自体の色がキー色に近いと破綻する場合があるため、素材ごとに
補正の強さを調整した。

## アプリ組み込み

`docs/superpowers/specs/2026-09-07-theme-sp1-dark-theme-foundation-design.md`（THEME-SP1）を参照。
`<AppBackground variant scheme>` が `variant`(battle/home/universal) × `scheme`(light/dark) の6枚を出し分ける。
