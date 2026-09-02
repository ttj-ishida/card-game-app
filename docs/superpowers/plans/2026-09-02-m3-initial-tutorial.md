# M3-EX-06 初回チュートリアル 実装計画

## Goal

M3-EX-06を完了し、CPU戦設定から初回チュートリアルを開ける状態にする。

## Tasks

1. 純モデル `tutorialModel.ts` を追加し、ページ定義・必須トピック網羅・保存形式をテストする。
2. `cpuGameTutorialStore.ts` を追加し、load/complete/reset と保存失敗時の状態をテストする。
3. `/cpu-game/tutorial` 画面を追加し、5枚のM3-GR-05 SVG図解と説明文をページ送りで表示する。
4. `_layout.tsx` と `setup.tsx` と翻訳キーを更新し、設定画面から導線を出す。
5. typecheck / mobile:test / lint / format / android export で確認し、進捗記録を追加する。
