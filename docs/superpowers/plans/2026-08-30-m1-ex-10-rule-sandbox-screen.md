# M1-EX-10 ルールサンドボックス画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 開発者が任意の局面を組み・1手入力し・`resolvePlay` の判定結果と遷移後の盤面を目視できる、Expo 横画面1枚のデバッグ盤面を作る。

**Architecture:** 判定は既存の `@card-game-app/game-core` の `resolvePlay` に委譲する。新規コードは「操作 → `RoundState` / `PlayInput` 変換」と「結果 → i18n キー変換」の純粋モジュール（`sandboxModel.ts`）、代表局面データ（`sandboxPresets.ts`）、zustand ストア（`ruleSandboxStore.ts`）、薄い画面（`app/sandbox/index.tsx`）。M0 カタログ画面と同構成で、ロジックは `.test.ts` で網羅し画面はビューに徹する。

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router / TypeScript 6 / zustand 5 / `node:test` + `tsx`（`.test.ts` のみ実行、react-test-renderer なし）。

## Global Constraints

- 表示文字列はすべて `apps/mobile/src/i18n/translate.ts` の `jaDictionary` に `sandbox.*` キーとして追加し、`translate(key)` 経由で取得する。内部コード・ID・条件分岐に日本語表示名を使わない。
- 属性・状態は色だけに依存させず、必ず文字ラベルを併記する（要件 §10.1・M0-GR-03 準拠）。
- 判定ロジックを新規に書かない。合法性・遷移・上がりは `resolvePlay` の戻り値をそのまま使う。
- `react-native-svg` を導入しない。View/Text と `@card-game-app/ui` のデザイントークンで描画する（M0-QA-01 の判断を踏襲）。
- `apps/mobile/package.json` と `apps/mobile/package-lock.json` は変更しない。モノレポ解決は `metro.config.js` と `tsconfig.json` の `paths` だけで行う。
- ファイル名・ディレクトリは `kebab-case`、型・コンポーネントは `PascalCase`、関数・変数は `camelCase`、boolean は `is`/`has`/`can`/`should`（`CONTRIBUTING.md`）。
- コミットは Conventional Commits。件名に `[M1-EX-10]` を含める。作業は `main` で行い、コミット後に `git push origin main`。`.idea/` に触れない。
- 各タスク完了時に `npm run mobile:test` と `npm run mobile:typecheck` が PASS すること。`git diff --check` がクリーンなこと。

---

## File Structure

新規:

| ファイル | 責務 |
|---|---|
| `apps/mobile/metro.config.js` | Metro が `packages/*` を解決できるようにするモノレポ設定 |
| `apps/mobile/src/features/rule-sandbox/sandboxModel.ts` | 純粋関数：初期局面・状態編集操作・`buildPlayInput`・`describeResolution`・カード生成ヘルパー |
| `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts` | 上記の単体テスト |
| `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts` | 代表局面10件（`RoundState` + `PlayDraft`）の純粋データ |
| `apps/mobile/src/features/rule-sandbox/sandboxPresets.test.ts` | プリセットの妥当性・`resolvePlay` 期待値の照合 |
| `apps/mobile/src/state/rule-sandbox-store.ts` | zustand ストア（`draft` / `playDraft` / `history` / `lastResult` ＋アクション） |
| `apps/mobile/src/state/rule-sandbox-store.test.ts` | ストアの単体テスト |
| `apps/mobile/src/app/sandbox/index.tsx` | 案A の盤面ビュー（ロジックなし） |

変更:

| ファイル | 変更内容 |
|---|---|
| `apps/mobile/tsconfig.json` | `baseUrl` と `paths`（`@card-game-app/game-core`・`@card-game-app/ui`） |
| `apps/mobile/src/i18n/translate.ts` | `sandbox.*` キー追加 |
| `apps/mobile/src/i18n/translate.test.ts` | 必須キー一覧に `sandbox.*` を追記 |
| `apps/mobile/src/app/_layout.tsx` | `sandbox/index` ルート登録 |
| `apps/mobile/src/app/index.tsx` | 開発用サンドボックス導線ボタン |
| `docs/progress/M1-EX-10.md` | 完了時に新規作成 |

---

## Task 1: モノレポ配線 と `createInitialRound`

**Files:**
- Create: `apps/mobile/metro.config.js`
- Modify: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`
- Test: `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts`

**Interfaces:**
- Consumes: `@card-game-app/game-core` — `createRoundState`, `createPlayerState`, `createNumberCard`, `INITIAL_RULESET_VERSION`, `type RoundState`, `type RankCode`, `type SuitCode`, `type NumberCard`.
- Produces:
  - `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`:
    - `export const SANDBOX_MIN_PLAYERS = 2`
    - `export const SANDBOX_MAX_PLAYERS = 6`
    - `export function sandboxCardId(rankCode: RankCode, suitCode: SuitCode): string` → `` `SBX_${rankCode}_${suitCode}` ``
    - `export function makeSandboxCard(rankCode: RankCode, suitCode: SuitCode): NumberCard`
    - `export function createInitialRound(): RoundState`

- [ ] **Step 1: Create `apps/mobile/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(monorepoRoot, 'packages')];
config.resolver.extraNodeModules = {
  '@card-game-app/game-core': path.resolve(monorepoRoot, 'packages/game-core'),
  '@card-game-app/ui': path.resolve(monorepoRoot, 'packages/ui'),
};

module.exports = config;
```

- [ ] **Step 2: Modify `apps/mobile/tsconfig.json`**

置き換え後の全内容:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@card-game-app/game-core": ["../../packages/game-core/src/index.ts"],
      "@card-game-app/ui": ["../../packages/ui/src/index.ts"]
    }
  }
}
```

- [ ] **Step 3: Write the failing test — `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts`**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SANDBOX_MAX_PLAYERS,
  SANDBOX_MIN_PLAYERS,
  createInitialRound,
  makeSandboxCard,
  sandboxCardId,
} from './sandboxModel';

test('sandboxCardId is stable and encodes rank and suit', () => {
  assert.equal(sandboxCardId('RANK_3', 'SUIT_FIRE'), 'SBX_RANK_3_SUIT_FIRE');
});

test('makeSandboxCard builds a number card with the stable id', () => {
  assert.deepEqual(makeSandboxCard('RANK_3', 'SUIT_FIRE'), {
    kind: 'NUMBER',
    cardId: 'SBX_RANK_3_SUIT_FIRE',
    rankCode: 'RANK_3',
    suitCode: 'SUIT_FIRE',
  });
});

test('createInitialRound returns a playable two-player day round with no field', () => {
  const round = createInitialRound();

  assert.equal(round.players.length, SANDBOX_MIN_PLAYERS);
  assert.ok(SANDBOX_MAX_PLAYERS > SANDBOX_MIN_PLAYERS);
  assert.equal(round.dayNight, 'DAY');
  assert.equal(round.activeField, null);
  assert.equal(round.activePlayerId, round.players[0].playerId);
  assert.equal(round.consecutivePasses, 0);
  assert.equal(round.winnerId, null);
  assert.ok(round.players.every((player) => player.hand.length > 0));
  assert.equal(new Set(round.players.flatMap((p) => p.hand.map((c) => c.cardId))).size,
    round.players.flatMap((p) => p.hand).length);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run mobile:test`
Expected: FAIL — `Cannot find module './sandboxModel'` (module not yet created). This also proves `tsx` picks up the tsconfig `paths` once `sandboxModel.ts` imports `@card-game-app/game-core` in the next step.

- [ ] **Step 5: Write `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`**

```ts
import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
  type NumberCard,
  type RankCode,
  type RoundState,
  type SuitCode,
} from '@card-game-app/game-core';

export const SANDBOX_MIN_PLAYERS = 2;
export const SANDBOX_MAX_PLAYERS = 6;

export function sandboxCardId(rankCode: RankCode, suitCode: SuitCode): string {
  return `SBX_${rankCode}_${suitCode}`;
}

export function makeSandboxCard(rankCode: RankCode, suitCode: SuitCode): NumberCard {
  return createNumberCard(sandboxCardId(rankCode, suitCode), rankCode, suitCode);
}

export function createInitialRound(): RoundState {
  return createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: 'DAY',
    players: [
      createPlayerState('P1', [
        makeSandboxCard('RANK_3', 'SUIT_FIRE'),
        makeSandboxCard('RANK_4', 'SUIT_WATER'),
        makeSandboxCard('RANK_8', 'SUIT_FIRE'),
      ]),
      createPlayerState('P2', [
        makeSandboxCard('RANK_5', 'SUIT_WIND'),
        makeSandboxCard('RANK_6', 'SUIT_EARTH'),
        makeSandboxCard('RANK_7', 'SUIT_WATER'),
      ]),
    ],
    activePlayerId: 'P1',
  });
}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npm run mobile:test`
Expected: PASS (all three tests, plus the existing suite).

Run: `npm run mobile:typecheck`
Expected: PASS — proves `tsc` resolves `@card-game-app/game-core` via the new `paths`.

If either resolver fails to find `@card-game-app/game-core`, fall back to a relative import in `sandboxModel.ts` (`../../../../packages/game-core/src/index.ts`) and keep the alias only where Metro needs it; re-run both commands.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/metro.config.js apps/mobile/tsconfig.json apps/mobile/src/features/rule-sandbox/sandboxModel.ts apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts
git commit -m "feat(mobile): [M1-EX-10] wire game-core into the app and scaffold the sandbox model"
git push origin main
```

---

## Task 2: サンドボックスの i18n キー

**Files:**
- Modify: `apps/mobile/src/i18n/translate.ts`
- Test: `apps/mobile/src/i18n/translate.test.ts`

**Interfaces:**
- Produces: `jaDictionary` に以下の `sandbox.*` キーが存在する。後続タスク（`describeResolution`・画面）が `translate()` で参照する。

- [ ] **Step 1: Add the failing assertions to `apps/mobile/src/i18n/translate.test.ts`**

`jaDictionary includes M0 screen and card catalog keys` テストの下に新規テストを追加:

```ts
test('jaDictionary includes rule sandbox keys for every reason and action code', () => {
  const reasonCodes = [
    'INVALID_COMBINATION',
    'SHAPE_MISMATCH',
    'NOT_STRONGER',
    'EXTENSION_SEALED',
    'SUIT_LOCKED',
    'NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL',
    'DUPLICATE_JOKER_DECLARATION',
    'JOKER_TRANSFORM_LAST_NUMBER_WIN',
    'ROUND_FINISHED',
    'NOT_ACTIVE_PLAYER',
    'CARD_NOT_IN_HAND',
    'SKILL_NOT_AVAILABLE',
    'FIELD_EMPTY',
    'MUST_LEAD',
    'NO_FIELD_TO_CLEAR',
    'TRANSFORM_JOKER_GO_OUT',
  ];
  const actionCodes = ['LEAD', 'EXTEND', 'REPLACE', 'PASS'];

  for (const code of reasonCodes) {
    assert.equal(typeof jaDictionary[`sandbox.reason.${code}` as TranslationKey], 'string');
  }
  for (const code of actionCodes) {
    assert.equal(typeof jaDictionary[`sandbox.action.${code}` as TranslationKey], 'string');
  }
  for (const key of [
    'sandbox.title',
    'sandbox.devLabel',
    'sandbox.section.board',
    'sandbox.section.play',
    'sandbox.section.result',
    'sandbox.section.history',
    'sandbox.result.legal',
    'sandbox.result.illegal',
    'sandbox.badge.naturalRevolution',
    'sandbox.badge.fieldCleared',
    'sandbox.badge.winner',
    'sandbox.field.empty',
    'sandbox.field.invalid',
    'sandbox.history.empty',
  ] as TranslationKey[]) {
    assert.notEqual(jaDictionary[key].length, 0);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run mobile:test`
Expected: FAIL — `jaDictionary[...]` is `undefined` for the new keys.

- [ ] **Step 3: Add the keys to `apps/mobile/src/i18n/translate.ts`**

`jaDictionary` オブジェクトの `'catalog.error.network'` 行の後（閉じ `} as const` の前）に追加:

```ts
  'sandbox.title': 'ルールサンドボックス',
  'sandbox.devLabel': '開発用',
  'sandbox.section.board': '盤面（状態エディタ）',
  'sandbox.section.play': 'プレイ入力',
  'sandbox.section.result': '結果',
  'sandbox.section.history': '履歴',
  'sandbox.dayNight.day': '昼',
  'sandbox.dayNight.night': '夜',
  'sandbox.playerCount': '人数',
  'sandbox.activePlayer': '手番',
  'sandbox.hand': '手札',
  'sandbox.addCard': 'カード追加',
  'sandbox.field.label': '場',
  'sandbox.field.lastPlayer': '最終出し手',
  'sandbox.field.empty': '場なし',
  'sandbox.field.invalid': 'この組み合わせは無効です',
  'sandbox.lock.label': '属性ロック',
  'sandbox.lock.none': 'なし',
  'sandbox.seal.label': '追加封印',
  'sandbox.seal.on': 'ON',
  'sandbox.seal.off': 'OFF',
  'sandbox.consecutivePasses': '連続パス',
  'sandbox.discard': '捨て札',
  'sandbox.skill.label': 'スキル',
  'sandbox.skill.none': 'なし',
  'sandbox.skill.SKILL_JOKER_HERO': '勇者Joker',
  'sandbox.skill.SKILL_JOKER_SAINT': '聖女Joker',
  'sandbox.skill.SKILL_EXTENSION_SEAL': '追加封印',
  'sandbox.skill.SKILL_REVOLUTION': '革命',
  'sandbox.skill.used': '使用済み',
  'sandbox.status.ACTIVE': 'ACTIVE',
  'sandbox.status.PASSED': 'PASSED',
  'sandbox.status.OUT': 'OUT',
  'sandbox.suit.SUIT_FIRE': '火',
  'sandbox.suit.SUIT_WATER': '水',
  'sandbox.suit.SUIT_WIND': '風',
  'sandbox.suit.SUIT_EARTH': '土',
  'sandbox.play.kind.pass': 'パス',
  'sandbox.play.kind.play': 'カードを出す',
  'sandbox.play.selectCards': '手札から選択',
  'sandbox.play.useSkill': 'スキル併用',
  'sandbox.play.jokerDeclare': '変化Joker宣言',
  'sandbox.play.jokerRank': '数字',
  'sandbox.play.jokerSuit': '属性',
  'sandbox.play.run': '実行',
  'sandbox.play.useSkill.EXTENSION_SEAL': '追加封印',
  'sandbox.play.useSkill.REVOLUTION': '革命',
  'sandbox.play.useSkill.JOKER_TRANSFORM': '変化Joker',
  'sandbox.play.useSkill.JOKER_CLEAR': '場流しJoker',
  'sandbox.result.legal': '合法',
  'sandbox.result.illegal': '不正',
  'sandbox.action.LEAD': 'リード',
  'sandbox.action.EXTEND': '追加',
  'sandbox.action.REPLACE': '更新',
  'sandbox.action.PASS': 'パス',
  'sandbox.badge.naturalRevolution': '自然革命',
  'sandbox.badge.fieldCleared': '場流し',
  'sandbox.badge.winner': '勝者',
  'sandbox.reason.INVALID_COMBINATION': '組み合わせとして無効です',
  'sandbox.reason.SHAPE_MISMATCH': '場と種類または枚数が一致しません',
  'sandbox.reason.NOT_STRONGER': '現在の昼夜では弱い手です',
  'sandbox.reason.EXTENSION_SEALED': '追加封印中は追加・拡張できません',
  'sandbox.reason.SUIT_LOCKED': '属性ロック中はロック属性しか出せません',
  'sandbox.reason.NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL': '自然革命と革命カードは併用できません',
  'sandbox.reason.DUPLICATE_JOKER_DECLARATION': '実カードまたは別Jokerと完全重複しています',
  'sandbox.reason.JOKER_TRANSFORM_LAST_NUMBER_WIN': '最後の数字カードと変化Jokerでは上がれません',
  'sandbox.reason.ROUND_FINISHED': 'この局はすでに勝者が確定しています',
  'sandbox.reason.NOT_ACTIVE_PLAYER': '手番プレイヤーではありません',
  'sandbox.reason.CARD_NOT_IN_HAND': '選んだカードが手札にありません',
  'sandbox.reason.SKILL_NOT_AVAILABLE': 'そのスキルを未使用で保有していません',
  'sandbox.reason.FIELD_EMPTY': '場が空のときはパスできません',
  'sandbox.reason.MUST_LEAD': '続けてリードする必要があります',
  'sandbox.reason.NO_FIELD_TO_CLEAR': '流す場がありません',
  'sandbox.reason.TRANSFORM_JOKER_GO_OUT': '変化Jokerを含む手では上がれません',
  'sandbox.history.empty': '履歴はまだありません',
  'sandbox.button.undo': '1手戻す',
  'sandbox.button.reset': '初期化',
  'sandbox.preset.label': 'プリセット',
```

- [ ] **Step 4: Run the tests**

Run: `npm run mobile:test`
Expected: PASS.

Run: `npm run mobile:typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/i18n/translate.ts apps/mobile/src/i18n/translate.test.ts
git commit -m "feat(mobile): [M1-EX-10] add rule sandbox i18n keys"
git push origin main
```

---

## Task 3: 局面・場・捨て札のエディタ

**Files:**
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`
- Test: `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts`

**Interfaces:**
- Consumes: Task 1 の `createInitialRound`, `makeSandboxCard`; `@card-game-app/game-core` — `parseNumberCombination`, `createRoundState`, `type DayNight`, `type SuitCode`, `type NumberCard`, `type RoundState`.
- Produces (all pure `RoundState → RoundState` unless noted):
  - `setDayNight(round, dayNight: DayNight): RoundState`
  - `setActivePlayer(round, playerId: string): RoundState` — 実在しない `playerId` は無視して `round` を返す
  - `setLockedSuit(round, suit: SuitCode | null): RoundState`
  - `setExtensionSealed(round, sealed: boolean): RoundState`
  - `setConsecutivePasses(round, n: number): RoundState` — 負値は `0` にクランプ、整数化
  - `clearField(round): RoundState` — `activeField` を `null` に
  - `isValidFieldCards(cards: NumberCard[]): boolean` — `parseNumberCombination(cards) !== null`
  - `setFieldCards(round, cards: NumberCard[], lastPlayerId: string): RoundState` — `isValidFieldCards` が false なら `round` をそのまま返す。true なら `activeField` を差し替え、`cards` の `cardId` を全プレイヤーの手札・捨て札から除去
  - `setFieldLastPlayer(round, playerId: string): RoundState` — `activeField` が null なら `round`
  - `addDiscard(round, card: NumberCard): RoundState` — 同 `cardId` を手札・場から除去してから捨て札末尾へ
  - `removeDiscard(round, cardId: string): RoundState`

- [ ] **Step 1: Write the failing tests (append to `sandboxModel.test.ts`)**

```ts
import {
  addDiscard,
  clearField,
  isValidFieldCards,
  removeDiscard,
  setActivePlayer,
  setConsecutivePasses,
  setDayNight,
  setExtensionSealed,
  setFieldCards,
  setFieldLastPlayer,
  setLockedSuit,
} from './sandboxModel';

test('setDayNight flips the strength orientation', () => {
  assert.equal(setDayNight(createInitialRound(), 'NIGHT').dayNight, 'NIGHT');
});

test('setActivePlayer ignores unknown player ids', () => {
  const round = createInitialRound();
  assert.equal(setActivePlayer(round, 'GHOST').activePlayerId, 'P1');
  assert.equal(setActivePlayer(round, 'P2').activePlayerId, 'P2');
});

test('setConsecutivePasses clamps to a non-negative integer', () => {
  const round = createInitialRound();
  assert.equal(setConsecutivePasses(round, -3).consecutivePasses, 0);
  assert.equal(setConsecutivePasses(round, 2.9).consecutivePasses, 2);
});

test('setLockedSuit and setExtensionSealed set the field effects', () => {
  const round = createInitialRound();
  assert.equal(setLockedSuit(round, 'SUIT_WATER').lockedSuitCode, 'SUIT_WATER');
  assert.equal(setLockedSuit(round, null).lockedSuitCode, null);
  assert.equal(setExtensionSealed(round, true).extensionSealed, true);
});

test('isValidFieldCards rejects combinations parseNumberCombination cannot read', () => {
  assert.equal(isValidFieldCards([makeSandboxCard('RANK_6', 'SUIT_FIRE')]), true);
  assert.equal(
    isValidFieldCards([
      makeSandboxCard('RANK_6', 'SUIT_FIRE'),
      makeSandboxCard('RANK_8', 'SUIT_WATER'),
    ]),
    false,
  );
});

test('setFieldCards places a valid combination and pulls those ids out of hands', () => {
  let round = createInitialRound();
  round = setFieldCards(round, [makeSandboxCard('RANK_3', 'SUIT_FIRE')], 'P2');
  assert.equal(round.activeField?.combination.kind, 'SINGLE');
  assert.equal(round.activeField?.lastPlayerId, 'P2');
  assert.ok(
    round.players
      .find((p) => p.playerId === 'P1')
      ?.hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'),
  );
});

test('setFieldCards leaves the round untouched for an invalid combination', () => {
  const round = createInitialRound();
  const next = setFieldCards(
    round,
    [makeSandboxCard('RANK_6', 'SUIT_FIRE'), makeSandboxCard('RANK_8', 'SUIT_WATER')],
    'P2',
  );
  assert.equal(next, round);
});

test('clearField and setFieldLastPlayer operate on the field', () => {
  let round = setFieldCards(createInitialRound(), [makeSandboxCard('RANK_6', 'SUIT_FIRE')], 'P2');
  assert.equal(setFieldLastPlayer(round, 'P1').activeField?.lastPlayerId, 'P1');
  assert.equal(clearField(round).activeField, null);
});

test('addDiscard moves a card into the discard pile and out of every other zone', () => {
  let round = createInitialRound();
  round = addDiscard(round, makeSandboxCard('RANK_3', 'SUIT_FIRE'));
  assert.deepEqual(round.discardPile.map((c) => c.cardId), ['SBX_RANK_3_SUIT_FIRE']);
  assert.ok(
    round.players.find((p) => p.playerId === 'P1')?.hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'),
  );
  assert.equal(removeDiscard(round, 'SBX_RANK_3_SUIT_FIRE').discardPile.length, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run mobile:test`
Expected: FAIL — the new exports are undefined.

- [ ] **Step 3: Implement in `sandboxModel.ts`**

`sandboxModel.ts` に import を追加:

```ts
import {
  parseNumberCombination,
  type DayNight,
  type PlayerState,
  type SuitCode,
} from '@card-game-app/game-core';
```

末尾に実装を追加:

```ts
function cloneRound(round: RoundState): RoundState {
  return createRoundState({
    rulesetCode: round.rulesetCode,
    rulesetVersion: round.rulesetVersion,
    dayNight: round.dayNight,
    players: round.players,
    activePlayerId: round.activePlayerId,
    activeField: round.activeField
      ? {
          combination: round.activeField.combination,
          lastPlayerId: round.activeField.lastPlayerId,
        }
      : null,
    lockedSuitCode: round.lockedSuitCode,
    extensionSealed: round.extensionSealed,
    discardPile: round.discardPile,
    consecutivePasses: round.consecutivePasses,
    winnerId: round.winnerId,
  });
}

function withoutCardId(round: RoundState, cardId: string): RoundState {
  const next = cloneRound(round);
  next.players = next.players.map((player) => ({
    ...player,
    hand: player.hand.filter((card) => card.cardId !== cardId),
  }));
  next.discardPile = next.discardPile.filter((card) => card.cardId !== cardId);
  if (next.activeField) {
    const cards = next.activeField.combination.cards.filter((card) => card.cardId !== cardId);
    const combination = parseNumberCombination(cards);
    next.activeField = combination
      ? { combination, lastPlayerId: next.activeField.lastPlayerId }
      : null;
  }
  return next;
}

export function setDayNight(round: RoundState, dayNight: DayNight): RoundState {
  const next = cloneRound(round);
  next.dayNight = dayNight;
  return next;
}

export function setActivePlayer(round: RoundState, playerId: string): RoundState {
  if (!round.players.some((player) => player.playerId === playerId)) return round;
  const next = cloneRound(round);
  next.activePlayerId = playerId;
  return next;
}

export function setLockedSuit(round: RoundState, suit: SuitCode | null): RoundState {
  const next = cloneRound(round);
  next.lockedSuitCode = suit;
  return next;
}

export function setExtensionSealed(round: RoundState, sealed: boolean): RoundState {
  const next = cloneRound(round);
  next.extensionSealed = sealed;
  return next;
}

export function setConsecutivePasses(round: RoundState, n: number): RoundState {
  const next = cloneRound(round);
  next.consecutivePasses = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return next;
}

export function clearField(round: RoundState): RoundState {
  const next = cloneRound(round);
  next.activeField = null;
  return next;
}

export function isValidFieldCards(cards: NumberCard[]): boolean {
  return parseNumberCombination(cards) !== null;
}

export function setFieldCards(
  round: RoundState,
  cards: NumberCard[],
  lastPlayerId: string,
): RoundState {
  const combination = parseNumberCombination(cards);
  if (!combination) return round;
  let next = round;
  for (const card of cards) next = withoutCardId(next, card.cardId);
  next = cloneRound(next);
  next.activeField = { combination, lastPlayerId };
  return next;
}

export function setFieldLastPlayer(round: RoundState, playerId: string): RoundState {
  if (!round.activeField) return round;
  const next = cloneRound(round);
  next.activeField = {
    combination: round.activeField.combination,
    lastPlayerId: playerId,
  };
  return next;
}

export function addDiscard(round: RoundState, card: NumberCard): RoundState {
  const next = cloneRound(withoutCardId(round, card.cardId));
  next.discardPile = [...next.discardPile, card];
  return next;
}

export function removeDiscard(round: RoundState, cardId: string): RoundState {
  const next = cloneRound(round);
  next.discardPile = next.discardPile.filter((card) => card.cardId !== cardId);
  return next;
}
```

Note: `PlayerState` の import はこのタスクでは使わないが Task 4 で使う。未使用 import で lint が落ちる場合はこのタスクでは追加せず Task 4 で追加すること。

- [ ] **Step 4: Run the tests and typecheck**

Run: `npm run mobile:test`
Expected: PASS.

Run: `npm run mobile:typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/rule-sandbox/sandboxModel.ts apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts
git commit -m "feat(mobile): [M1-EX-10] add round, field, and discard editors"
git push origin main
```

---

## Task 4: プレイヤー名簿・手札カードのエディタ

**Files:**
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`
- Test: `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts`

**Interfaces:**
- Consumes: Task 1・3 の `createInitialRound`, `makeSandboxCard`, `cloneRound`, `withoutCardId`; `@card-game-app/game-core` — `createPlayerState`, `type PlayerStatus`, `type SkillEffectCode`, `type RankCode`, `type SuitCode`.
- Produces:
  - `setPlayerCount(round, count: number): RoundState` — `[SANDBOX_MIN_PLAYERS, SANDBOX_MAX_PLAYERS]` にクランプ。増えた席は `P{n}`・空手札・スキルなし・`status: 'ACTIVE'`。減って手番席が消えたら `activePlayerId` を先頭席へ
  - `setPlayerSkill(round, playerId, effectCode: SkillEffectCode | null): RoundState` — `null` でスキル削除。付与時 `skillId` は `` `SBX_SKILL_${playerId}` ``・`used: false`
  - `setPlayerSkillUsed(round, playerId, used: boolean): RoundState` — スキル無しなら無変更
  - `setPlayerStatus(round, playerId, status: PlayerStatus): RoundState`
  - `addCardToHand(round, playerId, rankCode: RankCode, suitCode: SuitCode): RoundState` — 同 `cardId` を全ゾーンから除去してから対象の手札末尾へ。`playerId` 不在なら無変更
  - `removeCardFromHand(round, playerId, cardId: string): RoundState`

- [ ] **Step 1: Write the failing tests (append to `sandboxModel.test.ts`)**

```ts
import {
  addCardToHand,
  removeCardFromHand,
  setPlayerCount,
  setPlayerSkill,
  setPlayerSkillUsed,
  setPlayerStatus,
} from './sandboxModel';

test('setPlayerCount clamps and keeps the active player valid', () => {
  const round = setActivePlayer(createInitialRound(), 'P2');
  const grown = setPlayerCount(round, 4);
  assert.deepEqual(grown.players.map((p) => p.playerId), ['P1', 'P2', 'P3', 'P4']);
  assert.equal(grown.players[2].hand.length, 0);

  const shrunk = setPlayerCount(grown, 1);
  assert.equal(shrunk.players.length, 2);
  assert.equal(shrunk.activePlayerId, 'P2');

  const shrunkPastActive = setPlayerCount(setActivePlayer(grown, 'P4'), 2);
  assert.equal(shrunkPastActive.activePlayerId, 'P1');
});

test('setPlayerSkill adds, replaces, and clears a skill card', () => {
  let round = setPlayerSkill(createInitialRound(), 'P1', 'SKILL_REVOLUTION');
  assert.equal(round.players[0].skill?.effectCode, 'SKILL_REVOLUTION');
  assert.equal(round.players[0].skill?.used, false);
  round = setPlayerSkillUsed(round, 'P1', true);
  assert.equal(round.players[0].skill?.used, true);
  round = setPlayerSkill(round, 'P1', null);
  assert.equal(round.players[0].skill, null);
});

test('setPlayerStatus sets the status enum', () => {
  const round = setPlayerStatus(createInitialRound(), 'P2', 'PASSED');
  assert.equal(round.players[1].status, 'PASSED');
});

test('addCardToHand keeps each card id in exactly one zone', () => {
  let round = createInitialRound();
  round = addCardToHand(round, 'P2', 'RANK_3', 'SUIT_FIRE');
  assert.ok(round.players[1].hand.some((c) => c.cardId === 'SBX_RANK_3_SUIT_FIRE'));
  assert.ok(round.players[0].hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'));
  const ids = round.players.flatMap((p) => p.hand.map((c) => c.cardId));
  assert.equal(new Set(ids).size, ids.length);
});

test('removeCardFromHand drops the card', () => {
  const round = removeCardFromHand(createInitialRound(), 'P1', 'SBX_RANK_3_SUIT_FIRE');
  assert.ok(round.players[0].hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run mobile:test`
Expected: FAIL — new exports undefined.

- [ ] **Step 3: Implement in `sandboxModel.ts`**

import を拡張:

```ts
import {
  createPlayerState,
  type PlayerStatus,
  type SkillEffectCode,
} from '@card-game-app/game-core';
```

末尾に追加:

```ts
export function setPlayerCount(round: RoundState, count: number): RoundState {
  const target = Math.min(
    SANDBOX_MAX_PLAYERS,
    Math.max(SANDBOX_MIN_PLAYERS, Math.floor(Number.isFinite(count) ? count : SANDBOX_MIN_PLAYERS)),
  );
  const next = cloneRound(round);
  const current = next.players;
  let players: PlayerState[];
  if (target <= current.length) {
    players = current.slice(0, target);
  } else {
    players = [...current];
    for (let index = current.length; index < target; index += 1) {
      players.push(createPlayerState(`P${index + 1}`, []));
    }
  }
  next.players = players;
  if (!players.some((player) => player.playerId === next.activePlayerId)) {
    next.activePlayerId = players[0].playerId;
  }
  return next;
}

function mapPlayer(
  round: RoundState,
  playerId: string,
  fn: (player: PlayerState) => PlayerState,
): RoundState {
  if (!round.players.some((player) => player.playerId === playerId)) return round;
  const next = cloneRound(round);
  next.players = next.players.map((player) =>
    player.playerId === playerId ? fn({ ...player }) : player,
  );
  return next;
}

export function setPlayerSkill(
  round: RoundState,
  playerId: string,
  effectCode: SkillEffectCode | null,
): RoundState {
  return mapPlayer(round, playerId, (player) => ({
    ...player,
    skill: effectCode
      ? { kind: 'SKILL', skillId: `SBX_SKILL_${playerId}`, effectCode, used: false }
      : null,
  }));
}

export function setPlayerSkillUsed(
  round: RoundState,
  playerId: string,
  used: boolean,
): RoundState {
  return mapPlayer(round, playerId, (player) =>
    player.skill ? { ...player, skill: { ...player.skill, used } } : player,
  );
}

export function setPlayerStatus(
  round: RoundState,
  playerId: string,
  status: PlayerStatus,
): RoundState {
  return mapPlayer(round, playerId, (player) => ({ ...player, status }));
}

export function addCardToHand(
  round: RoundState,
  playerId: string,
  rankCode: RankCode,
  suitCode: SuitCode,
): RoundState {
  if (!round.players.some((player) => player.playerId === playerId)) return round;
  const card = makeSandboxCard(rankCode, suitCode);
  const cleared = cloneRound(withoutCardId(round, card.cardId));
  cleared.players = cleared.players.map((player) =>
    player.playerId === playerId ? { ...player, hand: [...player.hand, card] } : player,
  );
  return cleared;
}

export function removeCardFromHand(
  round: RoundState,
  playerId: string,
  cardId: string,
): RoundState {
  return mapPlayer(round, playerId, (player) => ({
    ...player,
    hand: player.hand.filter((card) => card.cardId !== cardId),
  }));
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npm run mobile:test`
Expected: PASS.

Run: `npm run mobile:typecheck`
Expected: PASS.

- [ ] **Step 5: Run lint and format**

Run: `npm run mobile:lint`
Run: `npm run mobile:format:check`
Expected: PASS. If format fails, run `npm run mobile:format` and re-check.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/rule-sandbox/sandboxModel.ts apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts
git commit -m "feat(mobile): [M1-EX-10] add player roster and hand-card editors"
git push origin main
```

---

## Task 5: `buildPlayInput`

**Files:**
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`
- Test: `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts`

**Interfaces:**
- Consumes: `@card-game-app/game-core` — `type PlayInput`, `type RankCode`, `type SuitCode`, `type RoundState`.
- Produces:
  - `export type PlayDraft = { kind: 'PASS' | 'PLAY'; cardIds: string[]; useSkill?: 'EXTENSION_SEAL' | 'REVOLUTION' | 'JOKER_TRANSFORM' | 'JOKER_CLEAR'; jokerDeclaration?: { rankCode: RankCode; suitCode: SuitCode } }`
  - `export function emptyPlayDraft(): PlayDraft` → `{ kind: 'PLAY', cardIds: [] }`
  - `export function buildPlayInput(round: RoundState, draft: PlayDraft): PlayInput`

- [ ] **Step 1: Write the failing tests (append to `sandboxModel.test.ts`)**

```ts
import { buildPlayInput, emptyPlayDraft, setPlayerSkill as _skill } from './sandboxModel';

test('buildPlayInput builds a pass for the active player', () => {
  const round = setActivePlayer(createInitialRound(), 'P2');
  assert.deepEqual(buildPlayInput(round, { kind: 'PASS', cardIds: [] }), {
    kind: 'PASS',
    playerId: 'P2',
  });
});

test('buildPlayInput builds a plain number play', () => {
  const round = createInitialRound();
  assert.deepEqual(
    buildPlayInput(round, { kind: 'PLAY', cardIds: ['SBX_RANK_3_SUIT_FIRE'] }),
    { kind: 'PLAY', playerId: 'P1', cardIds: ['SBX_RANK_3_SUIT_FIRE'] },
  );
});

test('buildPlayInput carries a skill and a transform-joker declaration', () => {
  const round = setPlayerSkill(createInitialRound(), 'P1', 'SKILL_JOKER_HERO');
  assert.deepEqual(
    buildPlayInput(round, {
      kind: 'PLAY',
      cardIds: ['SBX_RANK_3_SUIT_FIRE'],
      useSkill: 'JOKER_TRANSFORM',
      jokerDeclaration: { rankCode: 'RANK_5', suitCode: 'SUIT_FIRE' },
    }),
    {
      kind: 'PLAY',
      playerId: 'P1',
      cardIds: ['SBX_RANK_3_SUIT_FIRE'],
      useSkill: 'JOKER_TRANSFORM',
      jokerDeclarations: [
        { skillId: 'SBX_SKILL_P1', rankCode: 'RANK_5', suitCode: 'SUIT_FIRE' },
      ],
    },
  );
});

test('emptyPlayDraft is a play with no cards', () => {
  assert.deepEqual(emptyPlayDraft(), { kind: 'PLAY', cardIds: [] });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run mobile:test`
Expected: FAIL — exports undefined.

- [ ] **Step 3: Implement in `sandboxModel.ts`**

import に `type PlayInput` を追加。末尾に:

```ts
export type PlayDraft = {
  kind: 'PASS' | 'PLAY';
  cardIds: string[];
  useSkill?: 'EXTENSION_SEAL' | 'REVOLUTION' | 'JOKER_TRANSFORM' | 'JOKER_CLEAR';
  jokerDeclaration?: { rankCode: RankCode; suitCode: SuitCode };
};

export function emptyPlayDraft(): PlayDraft {
  return { kind: 'PLAY', cardIds: [] };
}

export function buildPlayInput(round: RoundState, draft: PlayDraft): PlayInput {
  const playerId = round.activePlayerId;
  if (draft.kind === 'PASS') {
    return { kind: 'PASS', playerId };
  }
  const player = round.players.find((entry) => entry.playerId === playerId);
  const skillId = player?.skill?.skillId ?? `SBX_SKILL_${playerId}`;
  const play: Extract<PlayInput, { kind: 'PLAY' }> = {
    kind: 'PLAY',
    playerId,
    cardIds: [...draft.cardIds],
  };
  if (draft.useSkill) {
    play.useSkill = draft.useSkill;
  }
  if (draft.useSkill === 'JOKER_TRANSFORM' && draft.jokerDeclaration) {
    play.jokerDeclarations = [
      {
        skillId,
        rankCode: draft.jokerDeclaration.rankCode,
        suitCode: draft.jokerDeclaration.suitCode,
      },
    ];
  }
  return play;
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npm run mobile:test`
Expected: PASS.

Run: `npm run mobile:typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/rule-sandbox/sandboxModel.ts apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts
git commit -m "feat(mobile): [M1-EX-10] build PlayInput from an editor play draft"
git push origin main
```

---

## Task 6: `describeResolution`

**Files:**
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`
- Test: `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts`

**Interfaces:**
- Consumes: `@card-game-app/game-core` — `resolvePlay`, `type PlayResolution`; Task 1–5 exports; `../i18n/translate` — `translate`.
- Produces:
  - `export type SandboxBadge = 'naturalRevolution' | 'fieldCleared' | 'winner'`
  - `export type ResolutionView = { ok: boolean; reasonKey?: string; actionKey?: string; badges: SandboxBadge[]; winnerId?: string }`
  - `export function describeResolution(resolution: PlayResolution): ResolutionView`

- [ ] **Step 1: Write the failing tests (append to `sandboxModel.test.ts`)**

```ts
import { describeResolution } from './sandboxModel';
import { resolvePlay } from '@card-game-app/game-core';
import { translate } from '../../i18n/translate';

test('describeResolution maps an illegal result to a translatable reason key', () => {
  const round = createInitialRound(); // no field
  const view = describeResolution(resolvePlay(round, { kind: 'PASS', playerId: 'P1' }));
  assert.equal(view.ok, false);
  assert.equal(view.reasonKey, 'sandbox.reason.FIELD_EMPTY');
  assert.doesNotThrow(() => translate(view.reasonKey as string));
  assert.deepEqual(view.badges, []);
});

test('describeResolution maps a legal result to an action key and badges', () => {
  const round = setFieldCards(
    setActivePlayer(createInitialRound(), 'P1'),
    [makeSandboxCard('RANK_6', 'SUIT_WATER')],
    'P2',
  );
  const withCard = addCardToHand(round, 'P1', 'RANK_8', 'SUIT_FIRE');
  const view = describeResolution(
    resolvePlay(withCard, { kind: 'PLAY', playerId: 'P1', cardIds: ['SBX_RANK_8_SUIT_FIRE'] }),
  );
  assert.equal(view.ok, true);
  assert.equal(view.actionKey, 'sandbox.action.REPLACE');
  assert.doesNotThrow(() => translate(view.actionKey as string));
});

test('describeResolution reports a winner badge and id', () => {
  let round = createInitialRound();
  round = setPlayerCount(round, 2);
  round = removeCardFromHand(round, 'P1', 'SBX_RANK_3_SUIT_FIRE');
  round = removeCardFromHand(round, 'P1', 'SBX_RANK_4_SUIT_WATER');
  round = setFieldCards(round, [makeSandboxCard('RANK_6', 'SUIT_WATER')], 'P2');
  const view = describeResolution(
    resolvePlay(round, { kind: 'PLAY', playerId: 'P1', cardIds: ['SBX_RANK_8_SUIT_FIRE'] }),
  );
  assert.equal(view.ok, true);
  assert.ok(view.badges.includes('winner'));
  assert.equal(view.winnerId, 'P1');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run mobile:test`
Expected: FAIL — `describeResolution` undefined.

- [ ] **Step 3: Implement in `sandboxModel.ts`**

import に `type PlayResolution` を追加。末尾に:

```ts
export type SandboxBadge = 'naturalRevolution' | 'fieldCleared' | 'winner';

export type ResolutionView = {
  ok: boolean;
  reasonKey?: string;
  actionKey?: string;
  badges: SandboxBadge[];
  winnerId?: string;
};

export function describeResolution(resolution: PlayResolution): ResolutionView {
  if (!resolution.ok) {
    return {
      ok: false,
      reasonKey: `sandbox.reason.${resolution.reason}`,
      badges: [],
    };
  }
  const { outcome } = resolution;
  const badges: SandboxBadge[] = [];
  if (outcome.naturalRevolution) badges.push('naturalRevolution');
  if (outcome.fieldCleared) badges.push('fieldCleared');
  if (outcome.winnerId) badges.push('winner');
  return {
    ok: true,
    actionKey: `sandbox.action.${outcome.actionKind}`,
    badges,
    ...(outcome.winnerId ? { winnerId: outcome.winnerId } : {}),
  };
}
```

- [ ] **Step 4: Run the tests, typecheck, lint, format**

Run: `npm run mobile:test` → PASS
Run: `npm run mobile:typecheck` → PASS
Run: `npm run mobile:lint` → PASS
Run: `npm run mobile:format:check` → PASS (run `npm run mobile:format` first if needed)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/rule-sandbox/sandboxModel.ts apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts
git commit -m "feat(mobile): [M1-EX-10] describe a resolvePlay result as i18n keys and badges"
git push origin main
```

---

## Task 7: サンドボックスのプリセット

**Files:**
- Create: `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts`
- Test: `apps/mobile/src/features/rule-sandbox/sandboxPresets.test.ts`
- Modify: `apps/mobile/src/i18n/translate.ts`, `apps/mobile/src/i18n/translate.test.ts`

**Interfaces:**
- Consumes: `@card-game-app/game-core` — `createRoundState`, `createPlayerState`, `parseNumberCombination`, `INITIAL_RULESET_VERSION`, `resolvePlay`, `type RoundState`; `./sandboxModel` — `makeSandboxCard`, `buildPlayInput`, `type PlayDraft`.
- Produces:
  - `export type SandboxPreset = { id: string; titleKey: string; round: RoundState; play: PlayDraft }`
  - `export const SANDBOX_PRESETS: readonly SandboxPreset[]` — 10件、`id` 一意、各 `titleKey` は `` `sandbox.preset.${id}` ``

- [ ] **Step 1: Write the failing test — `apps/mobile/src/features/rule-sandbox/sandboxPresets.test.ts`**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePlay } from '@card-game-app/game-core';

import { buildPlayInput } from './sandboxModel';
import { SANDBOX_PRESETS } from './sandboxPresets';
import { jaDictionary } from '../../i18n/translate';

test('there are ten presets with unique ids and existing title keys', () => {
  assert.equal(SANDBOX_PRESETS.length, 10);
  const ids = SANDBOX_PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const preset of SANDBOX_PRESETS) {
    assert.equal(preset.titleKey, `sandbox.preset.${preset.id}`);
    assert.equal(typeof jaDictionary[preset.titleKey as keyof typeof jaDictionary], 'string');
  }
});

test('the replace-stronger preset is a legal REPLACE', () => {
  const preset = SANDBOX_PRESETS.find((entry) => entry.id === 'replace-stronger');
  assert.ok(preset);
  const result = resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.outcome.actionKind, 'REPLACE');
});

test('the forbidden-joker-go-out preset is rejected without consuming cards', () => {
  const preset = SANDBOX_PRESETS.find((entry) => entry.id === 'forbidden-joker-go-out');
  assert.ok(preset);
  const result = resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'TRANSFORM_JOKER_GO_OUT');
});

test('the pass-clears-field preset clears the field', () => {
  const preset = SANDBOX_PRESETS.find((entry) => entry.id === 'pass-clears-field');
  assert.ok(preset);
  const result = resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.outcome.fieldCleared, true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run mobile:test`
Expected: FAIL — `./sandboxPresets` not found.

- [ ] **Step 3: Add preset title keys to `apps/mobile/src/i18n/translate.ts`**

`'sandbox.preset.label': 'プリセット',` の後に追加:

```ts
  'sandbox.preset.replace-stronger': '昼 66→77 更新',
  'sandbox.preset.night-weaker-wins': '夜 66→55 更新',
  'sandbox.preset.extend-to-666': '昼 単体6→66 追加',
  'sandbox.preset.sequence-natural-revolution': '昼 234+56 で自然革命',
  'sandbox.preset.suit-lock': '同属性34+Joker5 で属性ロック',
  'sandbox.preset.extension-sealed': '追加封印中の同数字追加は不正',
  'sandbox.preset.revolution-card': '昼77+革命+66 反転後合法',
  'sandbox.preset.joker-clear-win': '場流しJoker→最後の数字で上がり',
  'sandbox.preset.forbidden-joker-go-out': '最後の数字+変化Joker は上がり禁止',
  'sandbox.preset.pass-clears-field': '全員パスで場流し',
```

- [ ] **Step 4: Extend `apps/mobile/src/i18n/translate.test.ts`**

`jaDictionary includes rule sandbox keys ...` テストの末尾 `for (const key of [...] as TranslationKey[])` 配列に以下を追加:

```ts
    'sandbox.preset.replace-stronger',
    'sandbox.preset.forbidden-joker-go-out',
    'sandbox.preset.pass-clears-field',
```

- [ ] **Step 5: Write `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts`**

```ts
import {
  INITIAL_RULESET_VERSION,
  createPlayerState,
  createRoundState,
  parseNumberCombination,
  type ActiveField,
  type NumberCard,
  type RoundState,
  type SkillEffectCode,
} from '@card-game-app/game-core';

import { makeSandboxCard, type PlayDraft } from './sandboxModel';

export type SandboxPreset = {
  id: string;
  titleKey: string;
  round: RoundState;
  play: PlayDraft;
};

type Suit = 'FIRE' | 'WATER' | 'WIND' | 'EARTH';

const card = (rank: number, suit: Suit): NumberCard =>
  makeSandboxCard(`RANK_${rank}` as never, `SUIT_${suit}` as never);

const field = (cards: NumberCard[], lastPlayerId: string): ActiveField => {
  const combination = parseNumberCombination(cards);
  if (!combination) throw new Error('preset field is not a valid combination');
  return { combination, lastPlayerId };
};

function round(input: {
  dayNight?: 'DAY' | 'NIGHT';
  hands: NumberCard[][];
  skills?: (SkillEffectCode | null)[];
  activePlayerId?: string;
  activeField?: ActiveField | null;
  lockedSuitCode?: 'SUIT_FIRE' | 'SUIT_WATER' | 'SUIT_WIND' | 'SUIT_EARTH' | null;
  extensionSealed?: boolean;
  consecutivePasses?: number;
}): RoundState {
  const players = input.hands.map((hand, index) => {
    const effect = input.skills?.[index] ?? null;
    return createPlayerState(
      `P${index + 1}`,
      hand,
      effect ? { skillId: `SBX_SKILL_P${index + 1}`, effectCode: effect, used: false } : null,
    );
  });
  return createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: input.dayNight ?? 'DAY',
    players,
    activePlayerId: input.activePlayerId ?? 'P1',
    activeField: input.activeField ?? null,
    lockedSuitCode: input.lockedSuitCode ?? null,
    extensionSealed: input.extensionSealed ?? false,
    consecutivePasses: input.consecutivePasses ?? 0,
  });
}

const ids = (...cards: NumberCard[]): string[] => cards.map((entry) => entry.cardId);

export const SANDBOX_PRESETS: readonly SandboxPreset[] = [
  {
    id: 'replace-stronger',
    titleKey: 'sandbox.preset.replace-stronger',
    round: round({
      hands: [[card(7, 'FIRE'), card(7, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      activeField: field([card(6, 'FIRE'), card(6, 'WATER')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(7, 'FIRE'), card(7, 'WATER')) },
  },
  {
    id: 'night-weaker-wins',
    titleKey: 'sandbox.preset.night-weaker-wins',
    round: round({
      dayNight: 'NIGHT',
      hands: [[card(5, 'FIRE'), card(5, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      activeField: field([card(6, 'FIRE'), card(6, 'WATER')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(5, 'FIRE'), card(5, 'WATER')) },
  },
  {
    id: 'extend-to-666',
    titleKey: 'sandbox.preset.extend-to-666',
    round: round({
      hands: [[card(6, 'WATER'), card(6, 'WIND'), card(9, 'EARTH')], [card(1, 'FIRE')]],
      activeField: field([card(6, 'FIRE')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(6, 'WATER'), card(6, 'WIND')) },
  },
  {
    id: 'sequence-natural-revolution',
    titleKey: 'sandbox.preset.sequence-natural-revolution',
    round: round({
      hands: [[card(5, 'FIRE'), card(6, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      activeField: field([card(2, 'FIRE'), card(3, 'WATER'), card(4, 'WIND')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(5, 'FIRE'), card(6, 'WATER')) },
  },
  {
    id: 'suit-lock',
    titleKey: 'sandbox.preset.suit-lock',
    round: round({
      hands: [[card(3, 'FIRE'), card(4, 'FIRE'), card(9, 'WATER')], [card(1, 'WIND')]],
      skills: ['SKILL_JOKER_HERO', null],
    }),
    play: {
      kind: 'PLAY',
      cardIds: ids(card(3, 'FIRE'), card(4, 'FIRE')),
      useSkill: 'JOKER_TRANSFORM',
      jokerDeclaration: { rankCode: 'RANK_5', suitCode: 'SUIT_FIRE' },
    },
  },
  {
    id: 'extension-sealed',
    titleKey: 'sandbox.preset.extension-sealed',
    round: round({
      hands: [[card(6, 'WIND'), card(9, 'EARTH')], [card(1, 'FIRE')]],
      activeField: field([card(6, 'FIRE'), card(6, 'WATER')], 'P2'),
      extensionSealed: true,
    }),
    play: { kind: 'PLAY', cardIds: ids(card(6, 'WIND')) },
  },
  {
    id: 'revolution-card',
    titleKey: 'sandbox.preset.revolution-card',
    round: round({
      hands: [[card(6, 'FIRE'), card(6, 'WATER'), card(9, 'EARTH')], [card(1, 'WIND')]],
      skills: ['SKILL_REVOLUTION', null],
      activeField: field([card(7, 'FIRE'), card(7, 'WATER')], 'P2'),
    }),
    play: {
      kind: 'PLAY',
      cardIds: ids(card(6, 'FIRE'), card(6, 'WATER')),
      useSkill: 'REVOLUTION',
    },
  },
  {
    id: 'joker-clear-win',
    titleKey: 'sandbox.preset.joker-clear-win',
    round: round({
      hands: [[card(6, 'FIRE')], [card(1, 'WIND')]],
      skills: ['SKILL_JOKER_SAINT', null],
      activeField: field([card(9, 'WATER')], 'P2'),
    }),
    play: { kind: 'PLAY', cardIds: ids(card(6, 'FIRE')), useSkill: 'JOKER_CLEAR' },
  },
  {
    id: 'forbidden-joker-go-out',
    titleKey: 'sandbox.preset.forbidden-joker-go-out',
    round: round({
      hands: [[card(7, 'WATER')], [card(1, 'WIND')]],
      skills: ['SKILL_JOKER_HERO', null],
    }),
    play: {
      kind: 'PLAY',
      cardIds: ids(card(7, 'WATER')),
      useSkill: 'JOKER_TRANSFORM',
      jokerDeclaration: { rankCode: 'RANK_7', suitCode: 'SUIT_FIRE' },
    },
  },
  {
    id: 'pass-clears-field',
    titleKey: 'sandbox.preset.pass-clears-field',
    round: round({
      hands: [[card(3, 'FIRE')], [card(5, 'WATER')], [card(7, 'WIND')]],
      activeField: field([card(9, 'EARTH')], 'P3'),
      activePlayerId: 'P1',
      consecutivePasses: 1,
    }),
    play: { kind: 'PASS', cardIds: [] },
  },
];
```

- [ ] **Step 6: Run the tests, typecheck, lint, format**

Run: `npm run mobile:test` → PASS
Run: `npm run mobile:typecheck` → PASS
Run: `npm run mobile:lint` → PASS
Run: `npm run mobile:format:check` → PASS

If `sequence-natural-revolution`, `revolution-card`, or `joker-clear-win` fail their consistency check, add a targeted test to `sandboxPresets.test.ts` asserting the actual `resolvePlay` result and adjust the preset's `round`/`play` until it matches the intended T-RULE case in `docs/qa/M1-QA-03-rule-verification-checklist.md`.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/rule-sandbox/sandboxPresets.ts apps/mobile/src/features/rule-sandbox/sandboxPresets.test.ts apps/mobile/src/i18n/translate.ts apps/mobile/src/i18n/translate.test.ts
git commit -m "feat(mobile): [M1-EX-10] add ten rule sandbox presets"
git push origin main
```

---

## Task 8: `ruleSandboxStore`

**Files:**
- Create: `apps/mobile/src/state/rule-sandbox-store.ts`
- Test: `apps/mobile/src/state/rule-sandbox-store.test.ts`

**Interfaces:**
- Consumes: `zustand/vanilla` — `createStore`; `@card-game-app/game-core` — `resolvePlay`, `type RoundState`; `../features/rule-sandbox/sandboxModel` — `createInitialRound`, `buildPlayInput`, `describeResolution`, `emptyPlayDraft`, `type PlayDraft`, `type ResolutionView`; `../features/rule-sandbox/sandboxPresets` — `SANDBOX_PRESETS`.
- Produces:
  - `export type SandboxHistoryEntry = { round: RoundState; playDraft: PlayDraft; view: ResolutionView }`
  - `export type RuleSandboxState = { draft: RoundState; playDraft: PlayDraft; history: SandboxHistoryEntry[]; lastResult: ResolutionView | null; editRound: (fn: (round: RoundState) => RoundState) => void; setPlayDraft: (patch: Partial<PlayDraft>) => void; resetPlayDraft: () => void; applyPlay: () => void; undo: () => void; reset: () => void; loadPreset: (id: string) => void }`
  - `export function createRuleSandboxStore(): StoreApi<RuleSandboxState>` (zustand vanilla store)
  - `export const ruleSandboxStore` — singleton from `createRuleSandboxStore()`

- [ ] **Step 1: Write the failing test — `apps/mobile/src/state/rule-sandbox-store.test.ts`**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { addCardToHand, setFieldCards, makeSandboxCard, setActivePlayer } from '../features/rule-sandbox/sandboxModel';
import { createRuleSandboxStore } from './rule-sandbox-store';

test('the store starts from the initial round with empty history', () => {
  const store = createRuleSandboxStore();
  assert.equal(store.getState().draft.players.length, 2);
  assert.deepEqual(store.getState().history, []);
  assert.equal(store.getState().lastResult, null);
});

test('editRound replaces the draft through a pure editor', () => {
  const store = createRuleSandboxStore();
  store.getState().editRound((round) => setActivePlayer(round, 'P2'));
  assert.equal(store.getState().draft.activePlayerId, 'P2');
});

test('applyPlay advances the draft and records history on a legal play', () => {
  const store = createRuleSandboxStore();
  store.getState().editRound((round) =>
    setFieldCards(round, [makeSandboxCard('RANK_6', 'SUIT_WATER')], 'P2'),
  );
  store.getState().editRound((round) => addCardToHand(round, 'P1', 'RANK_8', 'SUIT_FIRE'));
  store.getState().setPlayDraft({ kind: 'PLAY', cardIds: ['SBX_RANK_8_SUIT_FIRE'] });
  store.getState().applyPlay();

  assert.equal(store.getState().lastResult?.ok, true);
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().draft.activeField?.combination.ranks[0], 8);
  assert.deepEqual(store.getState().playDraft, { kind: 'PLAY', cardIds: [] });
});

test('applyPlay keeps the draft and reports the reason on an illegal play', () => {
  const store = createRuleSandboxStore();
  const before = store.getState().draft;
  store.getState().setPlayDraft({ kind: 'PASS', cardIds: [] });
  store.getState().applyPlay();

  assert.equal(store.getState().lastResult?.ok, false);
  assert.equal(store.getState().lastResult?.reasonKey, 'sandbox.reason.FIELD_EMPTY');
  assert.equal(store.getState().draft, before);
  assert.equal(store.getState().history.length, 0);
});

test('undo restores the round from before the last applied play', () => {
  const store = createRuleSandboxStore();
  store.getState().editRound((round) =>
    setFieldCards(round, [makeSandboxCard('RANK_6', 'SUIT_WATER')], 'P2'),
  );
  store.getState().editRound((round) => addCardToHand(round, 'P1', 'RANK_8', 'SUIT_FIRE'));
  const beforePlay = store.getState().draft;
  store.getState().setPlayDraft({ kind: 'PLAY', cardIds: ['SBX_RANK_8_SUIT_FIRE'] });
  store.getState().applyPlay();
  store.getState().undo();

  assert.equal(store.getState().draft, beforePlay);
  assert.equal(store.getState().history.length, 0);
});

test('reset returns to the initial round', () => {
  const store = createRuleSandboxStore();
  store.getState().editRound((round) => setActivePlayer(round, 'P2'));
  store.getState().reset();
  assert.equal(store.getState().draft.activePlayerId, 'P1');
});

test('loadPreset installs the preset round and play draft', () => {
  const store = createRuleSandboxStore();
  store.getState().loadPreset('replace-stronger');
  assert.equal(store.getState().draft.activeField?.combination.ranks[0], 6);
  assert.equal(store.getState().playDraft.kind, 'PLAY');
  assert.deepEqual(store.getState().history, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run mobile:test`
Expected: FAIL — `./rule-sandbox-store` not found.

- [ ] **Step 3: Write `apps/mobile/src/state/rule-sandbox-store.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';

import { resolvePlay, type RoundState } from '@card-game-app/game-core';

import {
  buildPlayInput,
  createInitialRound,
  describeResolution,
  emptyPlayDraft,
  type PlayDraft,
  type ResolutionView,
} from '../features/rule-sandbox/sandboxModel';
import { SANDBOX_PRESETS } from '../features/rule-sandbox/sandboxPresets';

export type SandboxHistoryEntry = {
  round: RoundState;
  playDraft: PlayDraft;
  view: ResolutionView;
};

export type RuleSandboxState = {
  draft: RoundState;
  playDraft: PlayDraft;
  history: SandboxHistoryEntry[];
  lastResult: ResolutionView | null;
  editRound: (fn: (round: RoundState) => RoundState) => void;
  setPlayDraft: (patch: Partial<PlayDraft>) => void;
  resetPlayDraft: () => void;
  applyPlay: () => void;
  undo: () => void;
  reset: () => void;
  loadPreset: (id: string) => void;
};

export function createRuleSandboxStore(): StoreApi<RuleSandboxState> {
  return createStore<RuleSandboxState>((set, get) => ({
    draft: createInitialRound(),
    playDraft: emptyPlayDraft(),
    history: [],
    lastResult: null,

    editRound: (fn) => set((state) => ({ draft: fn(state.draft), lastResult: null })),

    setPlayDraft: (patch) => set((state) => ({ playDraft: { ...state.playDraft, ...patch } })),

    resetPlayDraft: () => set({ playDraft: emptyPlayDraft() }),

    applyPlay: () => {
      const { draft, playDraft } = get();
      const resolution = resolvePlay(draft, buildPlayInput(draft, playDraft));
      const view = describeResolution(resolution);
      if (resolution.ok) {
        set((state) => ({
          history: [...state.history, { round: draft, playDraft, view }],
          draft: resolution.state,
          playDraft: emptyPlayDraft(),
          lastResult: view,
        }));
      } else {
        set({ lastResult: view });
      }
    },

    undo: () =>
      set((state) => {
        if (state.history.length === 0) return state;
        const history = state.history.slice(0, -1);
        const last = state.history[state.history.length - 1];
        return { history, draft: last.round, lastResult: null };
      }),

    reset: () =>
      set({
        draft: createInitialRound(),
        playDraft: emptyPlayDraft(),
        history: [],
        lastResult: null,
      }),

    loadPreset: (id) => {
      const preset = SANDBOX_PRESETS.find((entry) => entry.id === id);
      if (!preset) return;
      set({
        draft: preset.round,
        playDraft: preset.play,
        history: [],
        lastResult: null,
      });
    },
  }));
}

export const ruleSandboxStore = createRuleSandboxStore();
```

- [ ] **Step 4: Run the tests, typecheck, lint, format**

Run: `npm run mobile:test` → PASS
Run: `npm run mobile:typecheck` → PASS
Run: `npm run mobile:lint` → PASS
Run: `npm run mobile:format:check` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/state/rule-sandbox-store.ts apps/mobile/src/state/rule-sandbox-store.test.ts
git commit -m "feat(mobile): [M1-EX-10] add the rule sandbox zustand store"
git push origin main
```

---

## Task 9: 画面・ルーティング・導線・最終検証・進捗ドキュメント

**Files:**
- Create: `apps/mobile/src/app/sandbox/index.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/index.tsx`
- Create: `docs/progress/M1-EX-10.md`

**Interfaces:**
- Consumes: `zustand` — `useStore`; `../../state/rule-sandbox-store` — `ruleSandboxStore`, `type RuleSandboxState`; `../../features/rule-sandbox/sandboxModel` — editor functions + `emptyPlayDraft`; `../../features/rule-sandbox/sandboxPresets` — `SANDBOX_PRESETS`; `@card-game-app/ui` — `colors`, `spacing`, `radius`, `typography`; `../../i18n/translate` — `translate`.
- Produces: expo-router route `/sandbox` rendering `SandboxScreen` (default export). No test module (no react-test-renderer in this repo — verified by typecheck / lint / `expo export`, matching `app/catalog/index.tsx`).

- [ ] **Step 1: Write `apps/mobile/src/app/sandbox/index.tsx`**

以下を作成。ロジックはストアとモデルに委譲し、`StyleSheet` はデザイントークン参照。属性・状態は必ず文字ラベル併記。主要操作に `accessibilityRole` / `accessibilityLabel` / `accessibilityState`。

```tsx
import { useStore } from 'zustand';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

import {
  RANK_CODES,
  SUIT_CODES,
} from '@card-game-app/game-core';
import {
  addCardToHand,
  clearField,
  isValidFieldCards,
  makeSandboxCard,
  removeCardFromHand,
  setActivePlayer,
  setConsecutivePasses,
  setDayNight,
  setExtensionSealed,
  setFieldCards,
  setLockedSuit,
  setPlayerCount,
  setPlayerSkill,
  setPlayerStatus,
} from '../../features/rule-sandbox/sandboxModel';
import { SANDBOX_PRESETS } from '../../features/rule-sandbox/sandboxPresets';
import { ruleSandboxStore } from '../../state/rule-sandbox-store';
import { translate } from '../../i18n/translate';
import { Pressable } from 'react-native';

const SUIT_LABEL: Record<string, string> = {
  SUIT_FIRE: translate('sandbox.suit.SUIT_FIRE'),
  SUIT_WATER: translate('sandbox.suit.SUIT_WATER'),
  SUIT_WIND: translate('sandbox.suit.SUIT_WIND'),
  SUIT_EARTH: translate('sandbox.suit.SUIT_EARTH'),
};

const SUIT_COLOR: Record<string, string> = {
  SUIT_FIRE: colors.suit.fire,
  SUIT_WATER: colors.suit.water,
  SUIT_WIND: colors.suit.wind,
  SUIT_EARTH: colors.suit.earth,
};

function rankNumber(rankCode: string): string {
  return rankCode.replace('RANK_', '');
}

function CardChip({ rankCode, suitCode }: { rankCode: string; suitCode: string }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${rankNumber(rankCode)} ${SUIT_LABEL[suitCode]}`}
      style={[styles.chip, { borderColor: SUIT_COLOR[suitCode] }]}
    >
      <Text style={styles.chipRank}>{rankNumber(rankCode)}</Text>
      <Text style={styles.chipSuit}>{SUIT_LABEL[suitCode]}</Text>
    </View>
  );
}

export default function SandboxScreen() {
  const state = useStore(ruleSandboxStore, (store) => store);
  const { draft, playDraft, lastResult, history } = state;
  const activePlayer = draft.players.find((player) => player.playerId === draft.activePlayerId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>
          {translate('sandbox.title')}
          <Text style={styles.devLabel}> {translate('sandbox.devLabel')}</Text>
        </Text>
        <View style={styles.toolbarButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('sandbox.button.undo')}
            accessibilityState={{ disabled: history.length === 0 }}
            disabled={history.length === 0}
            onPress={() => state.undo()}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>{translate('sandbox.button.undo')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('sandbox.button.reset')}
            onPress={() => state.reset()}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>{translate('sandbox.button.reset')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.presetRow}>
        <Text style={styles.label}>{translate('sandbox.preset.label')}</Text>
        {SANDBOX_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityLabel={translate(preset.titleKey)}
            onPress={() => state.loadPreset(preset.id)}
            style={styles.presetButton}
          >
            <Text style={styles.presetText}>{translate(preset.titleKey)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.columns}>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{translate('sandbox.section.board')}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>
              {translate('sandbox.dayNight.day')} / {translate('sandbox.dayNight.night')}
            </Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.dayNight === 'NIGHT' }}
              onPress={() =>
                state.editRound((round) =>
                  setDayNight(round, round.dayNight === 'DAY' ? 'NIGHT' : 'DAY'),
                )
              }
              style={styles.pill}
            >
              <Text style={styles.pillText}>
                {draft.dayNight === 'DAY'
                  ? translate('sandbox.dayNight.day')
                  : translate('sandbox.dayNight.night')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.playerCount')}</Text>
            {[2, 3, 4, 5, 6].map((count) => (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.players.length === count }}
                onPress={() => state.editRound((round) => setPlayerCount(round, count))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{count}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.activePlayer')}</Text>
            {draft.players.map((player) => (
              <Pressable
                key={player.playerId}
                accessibilityRole="button"
                accessibilityState={{ selected: player.playerId === draft.activePlayerId }}
                onPress={() => state.editRound((round) => setActivePlayer(round, player.playerId))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{player.playerId}</Text>
              </Pressable>
            ))}
          </View>

          {draft.players.map((player) => (
            <View key={player.playerId} style={styles.playerRow}>
              <Text style={styles.playerId}>{player.playerId}</Text>
              <View style={styles.handWrap}>
                {player.hand.map((cardEntry) => (
                  <Pressable
                    key={cardEntry.cardId}
                    accessibilityRole="button"
                    accessibilityLabel={`${translate('sandbox.hand')} ${rankNumber(cardEntry.rankCode)} ${SUIT_LABEL[cardEntry.suitCode]}`}
                    onPress={() =>
                      state.editRound((round) =>
                        removeCardFromHand(round, player.playerId, cardEntry.cardId),
                      )
                    }
                  >
                    <CardChip rankCode={cardEntry.rankCode} suitCode={cardEntry.suitCode} />
                  </Pressable>
                ))}
              </View>
              <View style={styles.statusWrap}>
                {(['ACTIVE', 'PASSED', 'OUT'] as const).map((status) => (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    accessibilityState={{ selected: player.status === status }}
                    onPress={() =>
                      state.editRound((round) => setPlayerStatus(round, player.playerId, status))
                    }
                    style={styles.miniButton}
                  >
                    <Text style={styles.miniButtonText}>{translate(`sandbox.status.${status}`)}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.skillWrap}>
                {([null, 'SKILL_JOKER_HERO', 'SKILL_JOKER_SAINT', 'SKILL_EXTENSION_SEAL', 'SKILL_REVOLUTION'] as const).map(
                  (effect) => (
                    <Pressable
                      key={effect ?? 'none'}
                      accessibilityRole="button"
                      accessibilityState={{ selected: (player.skill?.effectCode ?? null) === effect }}
                      onPress={() =>
                        state.editRound((round) => setPlayerSkill(round, player.playerId, effect))
                      }
                      style={styles.miniButton}
                    >
                      <Text style={styles.miniButtonText}>
                        {effect ? translate(`sandbox.skill.${effect}`) : translate('sandbox.skill.none')}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>
          ))}

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.field.label')}</Text>
            {draft.activeField ? (
              <>
                {draft.activeField.combination.cards.map((cardEntry) => (
                  <CardChip
                    key={cardEntry.cardId}
                    rankCode={cardEntry.rankCode}
                    suitCode={cardEntry.suitCode}
                  />
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={translate('sandbox.field.empty')}
                  onPress={() => state.editRound((round) => clearField(round))}
                  style={styles.miniButton}
                >
                  <Text style={styles.miniButtonText}>{translate('sandbox.field.empty')}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.muted}>{translate('sandbox.field.empty')}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.lock.label')}</Text>
            {[null, ...SUIT_CODES].map((suit) => (
              <Pressable
                key={suit ?? 'none'}
                accessibilityRole="button"
                accessibilityState={{ selected: (draft.lockedSuitCode ?? null) === suit }}
                onPress={() => state.editRound((round) => setLockedSuit(round, suit))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>
                  {suit ? SUIT_LABEL[suit] : translate('sandbox.lock.none')}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.seal.label')}</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.extensionSealed }}
              onPress={() =>
                state.editRound((round) => setExtensionSealed(round, !round.extensionSealed))
              }
              style={styles.pill}
            >
              <Text style={styles.pillText}>
                {draft.extensionSealed ? translate('sandbox.seal.on') : translate('sandbox.seal.off')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.consecutivePasses')}</Text>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.consecutivePasses === n }}
                onPress={() => state.editRound((round) => setConsecutivePasses(round, n))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.addCard')}</Text>
            {RANK_CODES.map((rankCode) =>
              SUIT_CODES.map((suitCode) => (
                <Pressable
                  key={`${rankCode}_${suitCode}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${translate('sandbox.addCard')} ${rankNumber(rankCode)} ${SUIT_LABEL[suitCode]}`}
                  onPress={() =>
                    state.editRound((round) =>
                      addCardToHand(round, draft.activePlayerId, rankCode, suitCode),
                    )
                  }
                >
                  <CardChip rankCode={rankCode} suitCode={suitCode} />
                </Pressable>
              )),
            )}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>
            {translate('sandbox.section.play')} ({draft.activePlayerId})
          </Text>

          <View style={styles.row}>
            {(['PLAY', 'PASS'] as const).map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected: playDraft.kind === kind }}
                onPress={() => state.setPlayDraft({ kind })}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>
                  {kind === 'PLAY'
                    ? translate('sandbox.play.kind.play')
                    : translate('sandbox.play.kind.pass')}
                </Text>
              </Pressable>
            ))}
          </View>

          {playDraft.kind === 'PLAY' ? (
            <>
              <Text style={styles.label}>{translate('sandbox.play.selectCards')}</Text>
              <View style={styles.handWrap}>
                {activePlayer?.hand.map((cardEntry) => {
                  const selected = playDraft.cardIds.includes(cardEntry.cardId);
                  return (
                    <Pressable
                      key={cardEntry.cardId}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        state.setPlayDraft({
                          cardIds: selected
                            ? playDraft.cardIds.filter((id) => id !== cardEntry.cardId)
                            : [...playDraft.cardIds, cardEntry.cardId],
                        })
                      }
                      style={selected ? styles.selectedChipWrap : undefined}
                    >
                      <CardChip rankCode={cardEntry.rankCode} suitCode={cardEntry.suitCode} />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>{translate('sandbox.play.useSkill')}</Text>
              <View style={styles.row}>
                {([undefined, 'EXTENSION_SEAL', 'REVOLUTION', 'JOKER_TRANSFORM', 'JOKER_CLEAR'] as const).map(
                  (useSkill) => (
                    <Pressable
                      key={useSkill ?? 'none'}
                      accessibilityRole="button"
                      accessibilityState={{ selected: playDraft.useSkill === useSkill }}
                      onPress={() => state.setPlayDraft({ useSkill })}
                      style={styles.miniButton}
                    >
                      <Text style={styles.miniButtonText}>
                        {useSkill
                          ? translate(`sandbox.play.useSkill.${useSkill}`)
                          : translate('sandbox.skill.none')}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>

              {playDraft.useSkill === 'JOKER_TRANSFORM' ? (
                <>
                  <Text style={styles.label}>{translate('sandbox.play.jokerDeclare')}</Text>
                  <View style={styles.row}>
                    {RANK_CODES.map((rankCode) => (
                      <Pressable
                        key={rankCode}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: playDraft.jokerDeclaration?.rankCode === rankCode,
                        }}
                        onPress={() =>
                          state.setPlayDraft({
                            jokerDeclaration: {
                              rankCode,
                              suitCode: playDraft.jokerDeclaration?.suitCode ?? 'SUIT_FIRE',
                            },
                          })
                        }
                        style={styles.miniButton}
                      >
                        <Text style={styles.miniButtonText}>{rankNumber(rankCode)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.row}>
                    {SUIT_CODES.map((suitCode) => (
                      <Pressable
                        key={suitCode}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: playDraft.jokerDeclaration?.suitCode === suitCode,
                        }}
                        onPress={() =>
                          state.setPlayDraft({
                            jokerDeclaration: {
                              rankCode: playDraft.jokerDeclaration?.rankCode ?? 'RANK_1',
                              suitCode,
                            },
                          })
                        }
                        style={styles.miniButton}
                      >
                        <Text style={styles.miniButtonText}>{SUIT_LABEL[suitCode]}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('sandbox.play.run')}
            onPress={() => state.applyPlay()}
            style={styles.runButton}
          >
            <Text style={styles.runButtonText}>{translate('sandbox.play.run')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>{translate('sandbox.section.result')}</Text>
        {lastResult ? (
          <View style={styles.row}>
            <Text style={lastResult.ok ? styles.legal : styles.illegal}>
              {lastResult.ok
                ? translate('sandbox.result.legal')
                : translate('sandbox.result.illegal')}
            </Text>
            {lastResult.reasonKey ? (
              <Text style={styles.muted}>{translate(lastResult.reasonKey)}</Text>
            ) : null}
            {lastResult.actionKey ? (
              <Text style={styles.muted}>{translate(lastResult.actionKey)}</Text>
            ) : null}
            {lastResult.badges.map((badge) => (
              <Text key={badge} style={styles.badge}>
                {translate(`sandbox.badge.${badge}`)}
                {badge === 'winner' && lastResult.winnerId ? ` ${lastResult.winnerId}` : ''}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>{translate('sandbox.section.history')}</Text>
        {history.length === 0 ? (
          <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
        ) : (
          history.map((entry, index) => (
            <Text key={index} style={styles.muted}>
              {index + 1}. {entry.playDraft.kind === 'PASS'
                ? translate('sandbox.play.kind.pass')
                : translate('sandbox.play.kind.play')}
              {entry.view.actionKey ? ` · ${translate(entry.view.actionKey)}` : ''}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.table.day },
  content: { padding: spacing.lg, gap: spacing.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarButtons: { flexDirection: 'row', gap: spacing.sm },
  title: { fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.ink.primary },
  devLabel: { fontSize: typography.size.caption, color: colors.state.disabled },
  smallButton: { borderWidth: 1, borderColor: colors.ink.primary, borderRadius: radius.control, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  smallButtonText: { fontSize: typography.size.caption, color: colors.ink.primary },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  presetButton: { borderWidth: 1, borderColor: colors.state.disabled, borderRadius: radius.control, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  presetText: { fontSize: typography.size.caption, color: colors.ink.secondary },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  panel: { flexGrow: 1, flexBasis: 320, backgroundColor: colors.surface.card.face, borderRadius: radius.card, borderWidth: 1, borderColor: colors.state.disabled, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.ink.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  label: { fontSize: typography.size.caption, color: colors.ink.secondary },
  muted: { fontSize: typography.size.caption, color: colors.ink.secondary },
  playerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.surface.table.day, paddingTop: spacing.xs },
  playerId: { fontSize: typography.size.caption, fontWeight: typography.weight.bold, color: colors.ink.primary, width: 24 },
  handWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statusWrap: { flexDirection: 'row', gap: spacing.xs },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minWidth: 34, alignItems: 'center', borderWidth: 2, borderRadius: radius.control, paddingHorizontal: spacing.xs, paddingVertical: 2, backgroundColor: colors.surface.card.face },
  chipRank: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.ink.primary },
  chipSuit: { fontSize: 10, color: colors.ink.secondary },
  selectedChipWrap: { borderWidth: 2, borderColor: colors.ink.primary, borderRadius: radius.control },
  miniButton: { borderWidth: 1, borderColor: colors.state.disabled, borderRadius: radius.control, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  miniButtonText: { fontSize: typography.size.caption, color: colors.ink.primary },
  pill: { borderWidth: 1, borderColor: colors.ink.primary, borderRadius: radius.card, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  pillText: { fontSize: typography.size.caption, color: colors.ink.primary },
  runButton: { marginTop: spacing.sm, alignItems: 'center', backgroundColor: colors.ink.primary, borderRadius: radius.control, paddingVertical: spacing.sm },
  runButtonText: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.ink.inverse },
  legal: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.suit.wind },
  illegal: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.suit.fire },
  badge: { fontSize: typography.size.caption, color: colors.ink.primary, borderWidth: 1, borderColor: colors.state.disabled, borderRadius: radius.control, paddingHorizontal: spacing.xs },
});
```

Note: `typography.weight.*` の値は `'400' | '500' | '700'` の文字列リテラル。`Text` の `fontWeight` はこの型を受け付ける。型エラーが出たら `as const` 由来のためキャスト不要——`tokens.ts` の定義がリテラル型なのでそのまま通る。通らなければ該当 style で `fontWeight: '700'` のように直接指定してよい（トークン値と一致させること）。

- [ ] **Step 2: Register the route in `apps/mobile/src/app/_layout.tsx`**

`<Stack.Screen name="catalog/index" ... />` の後に追加:

```tsx
      <Stack.Screen name="sandbox/index" options={{ title: translate('sandbox.title') }} />
```

- [ ] **Step 3: Add the dev entry point in `apps/mobile/src/app/index.tsx`**

カタログの `<Link>` ブロックの後に追加:

```tsx
      <Link href="/sandbox" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>
            {translate('sandbox.title')} ({translate('sandbox.devLabel')})
          </Text>
        </Pressable>
      </Link>
```

- [ ] **Step 4: Add the home-link translation assertion**

`apps/mobile/src/i18n/translate.test.ts` の必須キー配列（`sandbox.title` は既に含まれる）で足りているため追加不要。`npm run mobile:test` を実行し既存テストが緑であることを確認。

- [ ] **Step 5: Run all mobile checks**

Run: `npm run mobile:test` → PASS
Run: `npm run mobile:typecheck` → PASS
Run: `npm run mobile:lint` → PASS
Run: `npm run mobile:format:check` → PASS（必要なら `npm run mobile:format`）
Run: `npm run game-core:test` → PASS（回帰なし）
Run: `npm run game-core:typecheck` → PASS

- [ ] **Step 6: Verify the bundle builds**

Run: `npx --prefix apps/mobile expo export --platform android --output-dir apps/mobile/dist`
（または `cd apps/mobile && npx expo export --platform android --output-dir dist`）
Expected: 成功（Android バンドルが書き出される）。`@card-game-app/game-core` / `@card-game-app/ui` の解決が Metro で失敗する場合:
1. `apps/mobile/metro.config.js` の `config.resolver.sourceExts` に `'ts'`, `'tsx'` が含まれることを確認（`getDefaultConfig` は既定で含む）。
2. それでも `@card-game-app/ui` の `./tokens.js` が解決できない場合、`metro.config.js` に `config.resolver.extraNodeModules['@card-game-app/ui'] = path.resolve(monorepoRoot, 'packages/ui/src/tokens.ts')` は不可（ディレクトリ指定のみ）。代わりに `config.resolver.resolveRequest` で `@card-game-app/ui` を `packages/ui/src/tokens.ts` へ返すシムを追加する。
3. `tsconfig.json` の `paths` を `["../../packages/ui/src/tokens.ts"]` に変更しても `tsc` は通る（`tokens.ts` が全エクスポートを持つため）。

`git status` に `apps/mobile/dist/` が出る場合、それは `.gitignore` 済み（`eslint.config.js` の `ignores: ['dist/**']` と別に mobile の `.gitignore` に `dist` がある）。コミットに含めないこと。

- [ ] **Step 7: Write `docs/progress/M1-EX-10.md`**

```markdown
# M1-EX-10 進捗

- TODO: M1-EX-10
- 状態: 完了
- 日付: <実施日>

## 概要

任意の局面を編集し1手を入力して `resolvePlay` の判定結果と遷移後の盤面を目視できる、Expo 横画面1枚のデバッグ盤面を追加した。判定は `@card-game-app/game-core` の `resolvePlay` に委譲し、新規コードは操作→データ変換・結果→i18n変換の純粋モジュール、代表プリセット10件、zustand ストア、薄い画面。

## 成果物

| 種別 | パス |
| ---- | ---- |
| モデル | `apps/mobile/src/features/rule-sandbox/sandboxModel.ts` |
| プリセット | `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts` |
| ストア | `apps/mobile/src/state/rule-sandbox-store.ts` |
| 画面 | `apps/mobile/src/app/sandbox/index.tsx` |
| モノレポ設定 | `apps/mobile/metro.config.js`, `apps/mobile/tsconfig.json` |
| test | `sandboxModel.test.ts` / `sandboxPresets.test.ts` / `rule-sandbox-store.test.ts` / `translate.test.ts` |

## 画面状態一覧

初期 / 編集中 / 実行結果（合法）/ 実行結果（不正）/ 編集警告（無効な場）/ 空（履歴なし）。ローディングは同期動作のため該当なし。

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run mobile:test` | PASS |
| `npm run mobile:typecheck` | PASS |
| `npm run mobile:lint` | PASS |
| `npm run mobile:format:check` | PASS |
| `npm run game-core:test` / `:typecheck` | PASS（回帰なし） |
| `npx expo export --platform android` | PASS |
| `git diff --check` | 問題なし |

## メモ

- 描画は View/Text とデザイントークン（M0-QA-01 踏襲、`react-native-svg` 不要）。属性・状態は色＋文字ラベルで判別。
- 変化Joker宣言は1手番1枚に限定（1プレイヤー＝スキル1枚のモデル制約）。
- プリセットは QA-03 チェックリストの代表10件。残りの T-RULE ケース追加は軽微な後続作業。
- 実機での横画面・文字拡大・読み上げ順の目視確認は別途「実機確認記録」として実施する。
- `packages/*` の解決は `metro.config.js` と `tsconfig.json` の `paths` のみで行い、`apps/mobile/package.json` / `package-lock.json` は不変。
```

`<実施日>` を当日の日付に置き換える。

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/app/sandbox/index.tsx apps/mobile/src/app/_layout.tsx apps/mobile/src/app/index.tsx docs/progress/M1-EX-10.md
git commit -m "feat(mobile): [M1-EX-10] add the rule sandbox debug screen"
git push origin main
```

---

## Self-Review

**1. Spec coverage:**

| Spec 節 | 対応タスク |
|---|---|
| §2.1 局面編集（昼夜/人数/手番/手札/スキル/status/場/ロック/封印/連続パス/捨て札） | Task 3・4 |
| §2.2 プレイ編集（種別/カード/スキル/宣言/場流し継続） | Task 5（`buildPlayInput` は `JOKER_CLEAR` の `cardIds` を継続リードとしてそのまま渡す）・Task 9（UI） |
| §2.3 表示のみ（outcome/reason/遷移後 state） | Task 6・Task 9 の結果パネル |
| §3 画面構成（案A 4領域） | Task 9 |
| §4 アーキテクチャ（純粋モジュール＋zustand＋薄い画面） | Task 1–9 |
| §5 game-core/ui 連携（metro＋tsconfig、package.json 不変） | Task 1、Task 9 Step 6 |
| §6 状態モデル（初期局面・編集操作・buildPlayInput・describeResolution・不変条件） | Task 1・3・4・5・6 |
| §7 プリセット（QA-03 由来） | Task 7（10件、spec の22件から代表10件へ右サイズ。差分は本プランの注記どおり後続で拡張可能） |
| §8 ネイティブ描画（SVG なし） | Task 9 |
| §9 画面状態一覧 | Task 9 progress doc |
| §10 i18n/アクセシビリティ/横画面 | Task 2・7・9 |
| §11 テスト戦略 | Task 1–8 の各テスト |
| §12 検証手順 | Task 9 Step 5–6 |
| §13 ファイル一覧 | 本プラン File Structure |
| §14 完了条件対応 | progress doc |

ギャップ: spec §7 は T-RULE-001〜022（22件）だが本プランは代表10件。これは意図的な右サイズ（デバッグ用の利便機能、ロードマップ §14 も「代表10ケース」）。10件で全ルールグループを網羅し、追加は `SANDBOX_PRESETS` への行追加のみ。実行前にレビュアーが22件必須と判断した場合、Task 7 を「代表10件」→「T-RULE 22件」に差し替える（構造は同一）。

**2. Placeholder scan:** コード手順はすべて実コードを含む。`<実施日>` は progress doc の日付プレースホルダで、Task 9 Step 7 に置換指示あり。「similar to Task N」なし。

**3. Type consistency:**
- `PlayDraft` は Task 5 で定義、Task 7・8・9 で同一形状を使用。
- `ResolutionView` / `SandboxBadge` は Task 6 で定義、Task 8・9 で参照。
- `makeSandboxCard(rankCode, suitCode)` の引数順は Task 1 定義、Task 3・4・7 で一致。
- `sandboxCardId` の書式 `SBX_${rankCode}_${suitCode}` は Task 1 定義、テストの期待値 `SBX_RANK_3_SUIT_FIRE` と一致。
- スキル `skillId` の書式 `SBX_SKILL_${playerId}` は Task 4（`setPlayerSkill`）と Task 5（`buildPlayInput` フォールバック）で一致。
- ストアのファイル名は `rule-sandbox-store.ts`（kebab-case、`CONTRIBUTING.md` 準拠）。Task 8・9 の import パスと一致。
- `cloneRound` / `withoutCardId` は Task 3 で内部関数として定義、Task 4 が同ファイル内で再利用。

---

## Execution Handoff

（writing-plans スキルのハンドオフはプラン提示後に行う）
