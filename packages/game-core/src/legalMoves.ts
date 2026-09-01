import type {
  DayNight,
  NumberCard,
  NumberCombination,
  PlayActionKind,
  PlayerState,
  PlayInput,
  RankCode,
  RoundState,
} from "./core.ts";
import {
  RANK_CODES,
  SUIT_CODES,
  combinationStrength,
  rankNumber,
  resolvePlay,
} from "./core.ts";

export type LegalPlay = {
  input: PlayInput;
  actionKind: PlayActionKind | "PASS";
  resultingCombination: NumberCombination | null;
  goesOut: boolean;
};

type PlayInputPlay = Extract<PlayInput, { kind: "PLAY" }>;

/** ポリシー側と共有する「組み合わせの強さ」。combinationStrength の別名。 */
export function resultStrength(combination: NumberCombination, dayNight: DayNight): number {
  return combinationStrength(combination, dayNight);
}

// 1窓ごとに生成する連番候補（各 rank から1枚選ぶ属性直積）の上限。
// 到達しうる最大は「18枚の手札 = 6 rank × 3 suit」の窓で 3^6 = 729。
// 1024 は安全マージン。これを超える窓は丸ごとスキップする（通常対局では起きない）。
const SEQUENCE_CANDIDATE_CAP = 1024;

// 1手番で生成する JOKER_TRANSFORM 候補の上限。宣言(9×4)×手札部分集合の
// 組み合わせ爆発ガード。M3 の手札上限（18枚）でも通常到達しない。
const JOKER_TRANSFORM_CANDIDATE_CAP = 2000;

/** 手札を rank 数値ごとにグループ化する（候補生成で共有）。 */
function groupByRank(hand: readonly NumberCard[]): Map<number, NumberCard[]> {
  const byRank = new Map<number, NumberCard[]>();
  for (const card of hand) {
    const r = rankNumber(card.rankCode);
    let arr = byRank.get(r);
    if (!arr) {
      arr = [];
      byRank.set(r, arr);
    }
    arr.push(card);
  }
  return byRank;
}

/** 手札から重複しない候補 cardId 集合を生成する（単体 / 同数2..4 / 連番2..9）。 */
export function candidateCardIdSets(hand: readonly NumberCard[]): string[][] {
  const sets: string[][] = [];

  // 単体
  for (const card of hand) sets.push([card.cardId]);

  // rank ごとにグループ化
  const byRank = groupByRank(hand);

  // 同数セット（サイズ 2..min(4, 枚数)）
  for (const cards of byRank.values()) {
    const max = Math.min(4, cards.length);
    for (let size = 2; size <= max; size += 1) {
      for (const combo of combinations(cards, size)) {
        sets.push(combo.map((c) => c.cardId));
      }
    }
  }

  // 連番セット（連続 rank 窓、長さ 2..9、各 rank から1枚）
  // 長さ2は連番の EXTEND（場端に隣接する2枚の連番拡張）を拾うために必要。
  // クロス rank の不正な2枚リードは resolvePlay のドライランが弾く。
  for (let start = 1; start <= 9; start += 1) {
    for (let len = 2; start + len - 1 <= 9; len += 1) {
      const ranks = Array.from({ length: len }, (_, i) => start + i);
      const perRank = ranks.map((r) => byRank.get(r) ?? []);
      if (perRank.some((cards) => cards.length === 0)) continue;
      const product = perRank.reduce((acc, cards) => acc * cards.length, 1);
      if (product > SEQUENCE_CANDIDATE_CAP) continue;
      for (const combo of cartesian(perRank)) {
        sets.push(combo.map((c) => c.cardId));
      }
    }
  }

  return sets;
}

function* combinations<T>(items: readonly T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= items.length - size; i += 1) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      yield [items[i], ...rest];
    }
  }
}

function cartesian<T>(groups: readonly T[][]): T[][] {
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((prefix) => group.map((item) => [...prefix, item])),
    [[]],
  );
}

/**
 * 現手番プレイヤーの全合法手を列挙する。
 *
 * - `options` 省略 or `includeSkills !== true` のとき：数字カードのプレイ + PASS のみ。
 *   結果は現行実装と完全に同一。
 * - `includeSkills === true` かつ手番プレイヤーが未使用スキルを持つとき：スキル手も追加で列挙。
 *   Joker（`JOKER_CLEAR` / `JOKER_TRANSFORM`）・EXTENSION_SEAL・REVOLUTION を担当。
 * - PASS が合法なら含める。
 * - 連番候補は窓ごとに `SEQUENCE_CANDIDATE_CAP`、JOKER_TRANSFORM 候補は
 *   `JOKER_TRANSFORM_CANDIDATE_CAP` で上限ガードする（超過分はスキップ）。
 * - 出力は決定的順序でソート済み（§5.6）。`useSkill` を伴う手は同キーの素の手の後ろ。
 * - 各候補は `resolvePlay` のドライランで検証し、判定ロジックを複製しない。
 */
export function enumerateLegalPlays(
  state: RoundState,
  options?: { includeSkills?: boolean },
): LegalPlay[] {
  if (state.winnerId) return [];
  const playerId = state.activePlayerId;
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return [];

  const seen = new Set<string>();
  const results: LegalPlay[] = [];

  const pushIfLegal = (input: PlayInputPlay) => {
    const res = resolvePlay(state, input);
    if (!res.ok) return;
    const actor = res.state.players.find((p) => p.playerId === playerId);
    const realHand = (actor?.hand ?? []).filter(
      (c) => c.transformedFromSkillId === undefined,
    );
    results.push({
      input,
      actionKind: res.outcome.actionKind,
      resultingCombination: res.state.activeField?.combination ?? null,
      goesOut: realHand.length === 0,
    });
  };

  // 数字手（現行）
  for (const cardIds of candidateCardIdSets(player.hand)) {
    const key = "N|" + [...cardIds].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pushIfLegal({ kind: "PLAY", playerId, cardIds });
  }

  // PASS
  const passInput: PlayInput = { kind: "PASS", playerId };
  if (resolvePlay(state, passInput).ok) {
    results.push({
      input: passInput,
      actionKind: "PASS",
      resultingCombination: null,
      goesOut: false,
    });
  }

  // スキル手
  if (options?.includeSkills && player.skill && !player.skill.used) {
    enumerateSkillPlays(state, player, seen, pushIfLegal);
  }

  return sortLegalPlays(results, state.dayNight);
}

function enumerateSkillPlays(
  state: RoundState,
  player: PlayerState,
  seen: Set<string>,
  pushIfLegal: (input: PlayInputPlay) => void,
): void {
  const playerId = player.playerId;
  const skill = player.skill;
  if (!skill) return;
  const effect = skill.effectCode;

  if (effect === "SKILL_JOKER_HERO" || effect === "SKILL_JOKER_SAINT") {
    // JOKER_CLEAR: 場ありのとき、場流し後の全合法リード
    if (state.activeField) {
      for (const cardIds of candidateCardIdSets(player.hand)) {
        const key = "JC|" + [...cardIds].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        pushIfLegal({ kind: "PLAY", playerId, cardIds, useSkill: "JOKER_CLEAR" });
      }
    }

    // JOKER_TRANSFORM: 9 rank × 4 suit 宣言 × 手札部分集合
    let produced = 0;
    for (const rankCode of RANK_CODES) {
      for (const suitCode of SUIT_CODES) {
        const decl = { skillId: skill.skillId, rankCode, suitCode };
        for (const subsetIds of jokerTransformSubsets(player.hand, rankCode)) {
          if (produced >= JOKER_TRANSFORM_CANDIDATE_CAP) return;
          const key =
            "JT|" + rankCode + suitCode + "|" + [...subsetIds].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          produced += 1;
          pushIfLegal({
            kind: "PLAY",
            playerId,
            cardIds: subsetIds,
            useSkill: "JOKER_TRANSFORM",
            jokerDeclarations: [decl],
          });
        }
      }
    }
    return;
  }

  if (effect === "SKILL_EXTENSION_SEAL") {
    // 各数字手候補に封印併用版。封印は事後効果なので手自体の合法性は
    // 変わらないが、pushIfLegal のドライランで確認し actionKind 等を写す。
    for (const cardIds of candidateCardIdSets(player.hand)) {
      const key = "ES|" + [...cardIds].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pushIfLegal({ kind: "PLAY", playerId, cardIds, useSkill: "EXTENSION_SEAL" });
    }
    return;
  }

  if (effect === "SKILL_REVOLUTION") {
    // 革命は昼夜を先に反転してから判定する（resolvePlay が usesRevolutionSkill
    // 経由で処理）。現昼夜で不正な手が反転後に合法になり得るため、全候補を
    // ドライランして ok のもののみ採用する。
    for (const cardIds of candidateCardIdSets(player.hand)) {
      const key = "RV|" + [...cardIds].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pushIfLegal({ kind: "PLAY", playerId, cardIds, useSkill: "REVOLUTION" });
    }
    return;
  }
}

/**
 * 宣言 rank と組んで単体 / 同数 / 連番になり得る手札部分集合の cardId 列。
 * 宣言カード自体は含めない（`[]` = 宣言のみ = 単体）。
 */
function jokerTransformSubsets(
  hand: readonly NumberCard[],
  declRank: RankCode,
): string[][] {
  const subsets: string[][] = [[]]; // 宣言のみ = 単体
  const dr = rankNumber(declRank);
  const byRank = groupByRank(hand);

  // 同数: 宣言 rank と同じ数字の手札 1..3 枚
  const same = byRank.get(dr) ?? [];
  for (let size = 1; size <= Math.min(3, same.length); size += 1) {
    for (const combo of combinations(same, size)) {
      subsets.push(combo.map((c) => c.cardId));
    }
  }

  // 連番: 宣言 rank を含む連続窓 (長さ 3..9)、宣言以外の rank から 1 枚ずつ
  for (let start = 1; start <= 9; start += 1) {
    for (let len = 3; start + len - 1 <= 9; len += 1) {
      const ranks = Array.from({ length: len }, (_, i) => start + i);
      if (!ranks.includes(dr)) continue;
      const perRank = ranks
        .filter((r) => r !== dr)
        .map((r) => byRank.get(r) ?? []);
      if (perRank.some((cs) => cs.length === 0)) continue;
      const product = perRank.reduce((a, cs) => a * cs.length, 1);
      if (product > SEQUENCE_CANDIDATE_CAP) continue;
      for (const combo of cartesian(perRank)) {
        subsets.push(combo.map((c) => c.cardId));
      }
    }
  }

  return subsets;
}

function sortLegalPlays(plays: LegalPlay[], dayNight: DayNight): LegalPlay[] {
  const rank = (
    p: LegalPlay,
  ): [number, number, number, string, number, number, string] => {
    const isPass = p.actionKind === "PASS" ? 1 : 0;
    const count = p.input.kind === "PLAY" ? p.input.cardIds.length : 99;
    const useSkill = p.input.kind === "PLAY" ? p.input.useSkill : undefined;
    const skillFlag = useSkill ? 1 : 0;
    const skillName = useSkill ?? "";
    const decls =
      p.input.kind === "PLAY" ? p.input.jokerDeclarations ?? [] : [];
    const jokerKey = decls.length
      ? rankNumber(decls[0].rankCode) * 10 + SUIT_CODES.indexOf(decls[0].suitCode)
      : 0;
    const strength = p.resultingCombination
      ? combinationStrength(p.resultingCombination, dayNight)
      : 0;
    const ids =
      p.input.kind === "PLAY" ? [...p.input.cardIds].sort().join(",") : "~";
    return [isPass, count, skillFlag, skillName, jokerKey, strength, ids];
  };
  return [...plays].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return (
      ra[0] - rb[0] ||
      ra[1] - rb[1] ||
      ra[2] - rb[2] ||
      (ra[3] < rb[3] ? -1 : ra[3] > rb[3] ? 1 : 0) ||
      ra[4] - rb[4] ||
      ra[5] - rb[5] ||
      (ra[6] < rb[6] ? -1 : ra[6] > rb[6] ? 1 : 0)
    );
  });
}
