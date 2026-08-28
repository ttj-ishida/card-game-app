# ADR-0002: Environment Separation Strategy

- Status: Accepted
- Date: 2026-08-28
- Decision owner: Project owner
- TODO: M0-PM-02
- Related requirements: OBJ-005, SCP-002, SCP-003, SCP-007, PLT-001～004, SKILL-008, TX-001～004, INFO-001～009, SYNC-001～012, NFR-S-001～005, NFR-M-001～005, REL-001～004

## Context

本プロジェクトは、Expo／React Native Androidアプリ、Supabase Auth・Postgres・Realtime・Edge Functions、共有ルールpackage、カード・演出アセットを段階的に開発します。v1.0ではCPU戦と2～6人のフレンド対戦を提供し、公式対戦、iOS、英語表示は将来版とします。

開発初期から環境境界を曖昧にすると、開発中のマイグレーション、テストデータ、広告SDK、分析イベント、秘密情報、本番ユーザーデータが混ざる危険があります。一方で、個人開発の初期段階から過度に複雑な環境を作ると、M0～M2の速度が落ちます。

## Decision 1: Environment model

### Options

| 選択肢 | 開発工数 | 運用費 | セキュリティ | 将来拡張 | 利用者体験への影響 |
|---|---|---|---|---|---|
| A. `local`、`development`、`staging`、`production`の4環境 | 中。最初に命名と設定整理が必要 | 中 | 高。本番と検証を分離できる | 高。M4以降のオンライン検証に耐える | 検証済みの状態だけを公開しやすい |
| B. `local`、`production`の2環境 | 低 | 低 | 低。本番相当確認が本番に近づきすぎる | 低 | 不具合やデータ混入が利用者へ出やすい |
| C. `development`と`production`だけをクラウドに作り、ローカルDBを使わない | 低～中 | 中 | 中。クラウド依存が強い | 中 | 手元で壊して試す余地が小さい |

### Decision

選択肢Aを採用します。環境名は`local`、`development`、`staging`、`production`に固定し、用途を次のように分けます。

| 環境 | 用途 | データ | 主な利用者 |
|---|---|---|---|
| `local` | 個人端末での実装、単体テスト、DBマイグレーションの初期検証 | 生成可能なテストデータのみ | 開発者 |
| `development` | 開発用クラウド疎通、端末実機確認、外部サービスの開発キー確認 | 開発用テストデータのみ | 開発者 |
| `staging` | リリース候補、招待テスター、Google Play審査前確認 | 本番風のテストデータのみ | 開発者、限定テスター |
| `production` | Google Play公開版 | 実ユーザーデータ | 利用者 |

`local`はSupabase CLIのローカル環境を第一候補とし、Dockerなどの前提が満たせない場合だけ`development`で代替確認します。代替した場合は実施記録へ理由と確認範囲を残します。

### Consequences

- 後続TODOは、環境名を上記4値以外へ増やしません。
- `development`と`staging`は別Supabaseプロジェクトとして扱います。
- `production`はM8まで作成せず、本番秘密情報もM8までローカル端末に置きません。
- 環境差分はコード分岐ではなく設定値で切り替えます。
- 各環境の接続先、公開鍵、リダイレクトURL、広告ID、分析先は混在させません。

## Decision 2: Configuration and secret model

### Options

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| A. `.env.example`でキーだけ管理し、実値は`.env.local`等の未追跡ファイルとサービス側のSecretへ置く | 秘密情報をGitから守りやすい | 初期設定手順が必要 |
| B. 共有しやすいように`.env`を暗号化してリポジトリへ置く | 端末追加が楽 | 復号鍵管理が別途必要で、初期個人開発には重い |
| C. アプリ設定へ直接埋め込む | 実装が簡単 | 秘密情報漏洩と環境取り違えの危険が高い |

### Decision

選択肢Aを採用します。Gitへ入れるのは`.env.example`と環境別の設定テンプレートだけとし、実値を含む`.env*`は追跡しません。

クライアントへ配布してよい値は`EXPO_PUBLIC_`で始めます。Supabase anon keyのような公開前提の値も、環境取り違えを防ぐため実値は`.env*`へ置き、サンプルにはダミー値だけを記載します。サービスロールキー、署名鍵、広告SDKの秘密値、分析サービスの秘密値、Google Play署名関連の秘密値は、クライアント環境変数へ置きません。

### Consequences

- `.env.example`には必要キー、説明、ダミー値を記載します。
- `.env.local`、`.env.development`、`.env.staging`、`.env.production`は未追跡とします。
- Edge Functionsなどサーバー側の秘密値はSupabaseまたはCI/CDのSecretに置きます。
- ログ、クラッシュレポート、分析イベントへ秘密情報、非公開手札、未使用スキル、個人情報を出しません。
- 本番秘密情報を使う作業はM8の本番準備TODOまで行いません。

## Decision 3: Build, deploy, and data flow

### Options

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| A. 環境ごとにSupabaseプロジェクト、Expo/EAS profile、アプリ識別子を分ける | 取り違えを検知しやすい | 設定項目が増える |
| B. 同じSupabaseプロジェクトをschemaやprefixで分ける | 初期費用が低い | 権限、データ、Realtimeの分離が弱い |
| C. 本番までローカル状態だけで進める | 外部費用が最小 | M4の同期・招待・再接続検証が遅れる |

### Decision

選択肢Aを採用します。Supabaseは環境ごとにプロジェクトを分け、Expo/EASは環境ごとにprofileを分けます。`apps/mobile`は`EXPO_PUBLIC_APP_ENV`を読み、`local`、`development`、`staging`、`production`のいずれかであることを起動時に検査します。

ビルドとデプロイの基本経路は次の通りです。

| 対象 | `local` | `development` | `staging` | `production` |
|---|---|---|---|---|
| Expo | 開発サーバー | 開発ビルド | 内部配布・審査前候補 | Google Play公開ビルド |
| Supabase DB | ローカルCLI | 開発プロジェクト | 検証プロジェクト | 本番プロジェクト |
| Edge Functions | ローカル実行または開発デプロイ | 開発デプロイ | 検証デプロイ | 本番デプロイ |
| 広告・分析 | 原則無効またはモック | 開発用設定 | テスト広告・検証先 | 本番設定 |

### Consequences

- M0-EX-02で`APP_ENV`検査と環境別設定読み込みを実装します。
- M0-SB-01では`development`用Supabaseプロジェクトを作成し、本番とは分離します。
- M0-SB-02以降のマイグレーションは、空DBへ再適用できることを確認します。
- `staging`はM4以降のフレンド対戦α、招待、再接続、広告・同意確認の受け皿にします。
- `production`へのデプロイはM8のリリースゲートを満たすまで行いません。

## Rejected alternatives

- 2環境だけで進める案は、M4以降のオンライン同期、招待、切断、広告、退会を本番相当で確認する場所が不足するため不採用です。
- 同一Supabaseプロジェクト内でschemaやprefixだけを分ける案は、RLS、Realtime、Storage、Edge Functions、ログの境界が弱く、本番データ混入の危険が残るため不採用です。
- `.env`実値をリポジトリへ含める案は、秘密情報漏洩と環境取り違えを招くため不採用です。
- 本番Supabaseを早期に作成する案は、M8以前に本番秘密情報を扱う必要が出るため不採用です。

## Review triggers

次のいずれかが発生した場合、このADRをSuperseded候補として再検討します。

- Supabaseの無料枠または月額上限が、複数環境の維持に対して実用上厳しくなる。
- Expo/EAS、Google Play、広告SDK、分析基盤の制約により、環境別profileや識別子を分けられない。
- 公式対戦をv1.0へ前倒しし、ランキングや不正監査の本番相当検証が必要になる。
- 複数人開発になり、権限分離やSecret管理の責務を細かく分ける必要が生じる。
- iOSまたは英語版をv1.0へ含める方針へ変わる。

## Verification

- 環境名と用途をREADMEまたはADRから説明できること。
- `CONTRIBUTING.md`の環境名と本ADRの環境名が一致すること。
- 後続TODOの`M0-SB-01`、`M0-EX-02`が本ADRを参照して作業できること。
- 秘密情報の実値を含むファイルをGitへ追加しない方針が明記されていること。
- `production`への作業がM8まで発生しないことを説明できること。

## References

- [ADR-0001: Repository, Branch, and Naming Strategy](0001-repository-branch-and-naming.md)
- [M0 detail TODO](../product/独自カードゲーム_M0_詳細TODO_v0.2.md)
- [Requirements v0.2](../product/独自カードゲーム_要件定義書_v0.2.md)
