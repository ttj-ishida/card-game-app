# Ragnarok Millennium — 背景アート (Canva生成)

遊戯王マスターデュエルのデュエルフィールドを参照した、ラグナロク・ミレニアム用の
背景画像セット。SVGの自動生成パイプライン (`assets/source` → `assets/runtime`) とは別枠で、
Canva AI で生成 → 図形レイヤーで微調整 → PNG書き出し、という流れで作成した「原画」です。

| ファイル | 用途 | 元Canvaデザイン | 調整内容 |
|---|---|---|---|
| `ragnarok-battle-bg.png` | CPU対戦 / オンライン対戦のプレイ画面 | `DAHUbUcy5f0` | 中央を空けたルーン環。四隅の下側に炎(#D84A2B)・地(#8A6A2A)を不透明度5%で加算 |
| `ragnarok-home-bg.png` | ホーム / ロビー | `DAHUbV5aQBE` | ユグドラシル大樹。下1/3を半透明パネル10層で段階的に暗くしメニュー用スペースを確保 |
| `ragnarok-bg-universal.png` | 汎用（リスト・ダイアログ背面など） | `DAHUbTCO9yg` | 最も静かなルーン環。下半分ほぼ空 |

- 全て 1920×1080 (16:9)、Androidランドスケープ前提。
- 再書き出し: Canva MCP `export-design` に上記デザインIDと `{type:"png", width:1920, height:1080, lossless:true}` を渡す。

## アプリ組み込みの未了タスク

現状アプリUIはライトテーマ（`packages/ui/src/tokens.ts` の day 系、`index.tsx` の `#f8fafc` など）で、
この暗い背景を敷くには各画面のテキスト／ボタンをダーク前提に再調整する必要がある。
背景の配置 + ダークテーマ化は別タスクとして計画する。
