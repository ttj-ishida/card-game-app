# Card Game App

`card-game-app`は、正式名称が決まるまで使用する内部リポジトリ名です。ストア表示名、カード名、用語ID、パッケージ名とは分離します。

このリポジトリは、Android先行のオリジナルカードゲームを開発するためのモノレポです。v1.0の対象は、Android 10以上のスマートフォン・タブレット、横画面、CPU戦と2～6人のフレンド対戦です。

## 現在地

- 現在のマイルストーン：M0 開発土台とカードカタログ
- 完了：`M0-GR-01` アートディレクション1枚資料を作る
- 次：`M0-GR-02` カード縦横比、セーフエリア、書出しサイズを決める
- 正式名称の決定期限：M6開始前

## リポジトリ構成

```text
card-game-app/
├── apps/
│   ├── mobile/              # Expo／React Native Androidアプリ
│   └── invite-landing/      # 招待リンク案内ページ（M4で作成）
├── packages/
│   ├── game-core/           # UI・通信から独立した純粋TypeScriptルール
│   ├── contracts/           # API、イベント、状態スナップショットの共有型
│   └── ui/                  # デザイントークンと共有UI
├── supabase/
│   ├── migrations/          # 再現可能なDB変更
│   ├── functions/           # Edge Functions
│   ├── tests/               # DB、RLS、サーバー処理テスト
│   └── seed.sql             # 開発・検証用の非秘密シード
├── assets/
│   ├── runtime/             # アプリへ同梱・配信する最適化済み素材
│   ├── manifests/           # カードIDとアセット版の対応表
│   └── source-manifests/    # 大容量制作元の所在・版・ハッシュ
├── tests/
│   ├── e2e/                 # Android E2E
│   ├── fixtures/            # 再現可能な対局状態
│   └── load/                # 同時接続・オンライン負荷試験
├── scripts/                 # 検査、生成、ビルド補助
├── docs/
│   ├── adr/                 # 技術・運用の意思決定記録
│   ├── product/             # 要件、用語、マイルストーン
│   ├── qa/                  # テスト計画・受入記録
│   └── progress/            # TODOの実施記録
├── CONTRIBUTING.md          # ブランチ・コミット・命名規則
└── .editorconfig            # 共通テキスト形式
```

ディレクトリは担当技術ではなく、変更理由と責務で分けます。対局ルールは`packages/game-core`を唯一の実装とし、Expoとサーバーで別実装しません。

## 採用方針

| 項目 | 採用 |
|---|---|
| リポジトリ | 1つのモノレポ |
| JavaScriptワークスペース | pnpm workspace |
| 主要ブランチ | `main`のみ |
| 作業ブランチ | TODO単位の短命ブランチ |
| コミット | Conventional Commits＋TODO ID |
| 環境 | `local`、`development`、`staging`、`production` |
| DB変更 | `supabase/migrations`のみを正とする |
| ルール実装 | `packages/game-core`のみを正とする |
| 本番アセット | 安定IDとmanifestで管理 |

選択理由と見直し条件は[ADR-0001](docs/adr/0001-repository-branch-and-naming.md)と[ADR-0002](docs/adr/0002-environment-separation.md)を参照してください。

## 基本ワークフロー

1. 対象TODOの依存と完了条件を確認する。
2. `main`を最新にする。
3. TODO IDを含む短命ブランチを作る。
4. 実装、テスト、文書またはアセット対応表を同じ変更へ含める。
5. ローカル検査を通し、差分を自己レビューする。
6. `main`へ統合後、ブランチを削除する。

```bash
git switch main
git switch -c feat/m0-ex-01-expo-bootstrap
```

詳細は[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## 機密情報

- `.env`、秘密鍵、サービスロールキー、署名鍵、実ユーザーデータをコミットしません。
- クライアントへ含めてよい値だけを`EXPO_PUBLIC_`で始めます。
- Supabaseのマイグレーション、シード、テストには本番個人情報を含めません。
- 非公開手札や未使用スキルをログ・分析イベントへ出しません。

## 参考資料

- [Expo: Work with monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo: Set up EAS Build with a monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/)
- [Supabase: Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase: Database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
