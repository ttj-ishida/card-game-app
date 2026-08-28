# M0-EX-05 デザイントークンinterface

- TODO: M0-EX-05
- package: packages/ui
- 公開entrypoint: packages/ui/src/index.ts

## 公開カテゴリ

| カテゴリ | 責務 |
|---|---|
| colors | M0-GR-01とM0-GR-03に基づく、semantic surface、文字色、属性色、状態色。 |
| spacing | Android横画面のcompact UIで共通利用する余白値。 |
| radius | control、card、modal、source cardの角丸値。 |
| typography | system font family、固定font size、weight、letter spacing 0。 |
| card | M0-GR-02に基づく縦横比、source size、display size、safe-area bounds。 |

## 境界

- token packageは表示用の定数だけを持つ。
- Supabaseを読まない。永続化しない。個人情報、非公開手札、秘密情報をlogに出さない。
- runtime画面はtokenを直接importしてもよいし、framework固有のstyle objectへ変換してもよい。

## 確認方法

`npm run ui:test` と `npm run ui:typecheck` を実行し、token値とTypeScript互換性を検証する。
