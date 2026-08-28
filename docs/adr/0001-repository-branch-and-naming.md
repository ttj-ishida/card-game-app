# ADR-0001: リポジトリ・ブランチ・命名戦略

- 状態: 承認
- 日付: 2026-08-27
- 決定責任者: プロジェクトオーナー
- TODO: M0-PM-01
- 関連要件: OBJ-005, TERM-REQ-001～005, I18N-002～004, DATA-M-001～006, NFR-M-001～005, REL-001～004

## 背景

Expoアプリ、UIから独立したルールエンジン、SupabaseのDB・Functions、42枚のカード定義、グラフィックmanifest、テストを段階的に開発します。同じルールやIDを複数リポジトリへ複製すると、合法性判定、DB、表示、アセットの対応がずれる危険があります。一方、正式なゲーム名はM6開始前まで未決です。

## 決定1: リポジトリモデル

### 選択肢

| 選択肢 | 開発工数 | 運用費 | セキュリティ | 将来拡張 | 利用者体験への影響 |
|---|---|---|---|---|---|
| A. Expo・Supabase・共有packageを1つのモノレポ | 低～中。初期設定は必要 | 低 | 1つの権限境界。秘密値の除外が重要 | 高。共有型とルールを直接再利用 | クライアントとサーバーの判定差を減らせる |
| B. mobile、backend、assetsを別リポジトリ | 中～高。版合わせが必要 | 中 | 権限分離しやすい | 中。package配布が必要 | 版ずれで不正判定や表示不一致が起こり得る |
| C. Expoアプリだけの単一構成 | 最初は低、M4以降は高 | 低 | サーバー責務が曖昧 | 低 | オンライン化時の作り直しが大きい |

### 決定

選択肢Aを採用します。pnpm workspaceを用い、`apps`、`packages`、`supabase`、`assets`、`tests`、`docs`を同じリポジトリで管理します。Expoはworkspace型モノレポを公式にサポートし、Supabase CLIもリポジトリ内の`supabase`ディレクトリを基準にマイグレーションとシードを再現できます。

### 影響

- `packages/game-core`をルール判定の唯一の実装にします。
- `packages/contracts`を通信・イベント型の唯一の定義にします。
- DB変更は`supabase/migrations`、ランタイム素材対応は`assets/manifests`を正とします。
- EASコマンドは`apps/mobile`をアプリルートとして実行します。
- 大容量制作元は通常Gitへ直接格納せず、manifestで所在と版を追跡します。

## 決定2: ブランチモデル

### 選択肢

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| A. Trunk-based：`main`＋短命作業ブランチ | 個人開発で管理が軽く、統合頻度が高い | `main`の検査を徹底する必要がある |
| B. GitFlow：`main`＋`develop`＋release／hotfix | 複数リリースの並行管理に強い | v1.0前の個人開発にはブランチ管理が重い |
| C. `main`へ直接コミット | 最小手順 | 差分レビュー、切戻し、TODO追跡が弱い |

### 決定

選択肢Aを採用します。`main`は常に検証可能にし、TODO単位の`feat/`、`fix/`、`docs/`、`chore/`、`test/`を短期間だけ使用します。`develop`は作りません。

### 影響

- すべての変更をTODO IDへ関連付けます。
- 変更が2営業日を超える場合は、統合可能な単位へ分割します。
- v1.0直前に長期release branchが必要になった場合だけ、期間限定で追加します。

## 決定3: 命名モデル

### 選択肢

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| A. 各技術の標準規則＋安定内部ID | TypeScript、Postgres、アセットで読みやすい | 複数の規則を覚える必要がある |
| B. 全領域を1種類の表記へ統一 | 規則は単純 | 各エコシステムで不自然になり、ツール生成名と衝突する |
| C. 表示名をファイル・DB名へ利用 | 人間には直感的 | 用語変更・英語化・文字コードで破綻する |

### 決定

選択肢Aを採用します。TypeScriptは`kebab-case`／`PascalCase`／`camelCase`、Postgresは`snake_case`、内部コードは要件定義の固定英字コード、表示文言は言語リソースキー、アセットは内部ID由来の小文字ファイル名を使用します。

## 不採用案

- 複数リポジトリは、M4のサーバー権威化までに共有ルールpackageの配布運用が必要になるため不採用です。
- GitFlowは、現段階ではブランチ間の移送作業が価値を上回るため不採用です。
- 正式ゲーム名をリポジトリ名やpackage scopeへ使う案は、M6前の名称変更で不要な大規模renameを招くため不採用です。

## 見直し条件

次のいずれかが発生した場合、このADRをSuperseded候補として再検討します。

- 同時に3人以上が継続開発する。
- モバイルとサーバーを独立した公開周期で運用する必要が生じる。
- 共有packageのビルド時間がCI時間目標を継続して超える。
- 大容量アセットが通常Gitのclone・buildを実用上妨げる。
- 公式対戦を別チームまたは別セキュリティ境界で運用する。

## 検証

- ルートREADMEだけで各ディレクトリの責務を説明できること。
- CONTRIBUTINGだけでブランチ、コミット、TypeScript、DB、アセットの名前を作成できること。
- 正式ゲーム名を変更しても、リポジトリ構成と内部IDを変更する必要がないこと。
- `main`からTODO単位のブランチ名を規則どおり作成できること。

## 参考

- [Expo: Work with monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo: Set up EAS Build with a monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/)
- [Supabase: Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase: Database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
