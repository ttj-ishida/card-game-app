import type { LegalPlay, PlayInput } from '@card-game-app/game-core';

export type HandSelection = string[];

function playSet(p: LegalPlay): Set<string> | null {
  return p.input.kind === 'PLAY' ? new Set(p.input.cardIds) : null;
}

function isSubsetOf(a: Iterable<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function canSelectCard(
  selection: HandSelection,
  cardId: string,
  legalPlays: LegalPlay[],
): boolean {
  if (selection.includes(cardId)) return true; // 既選択は外せる = 触れる
  const candidate = [...selection, cardId];
  return legalPlays.some((p) => {
    const set = playSet(p);
    return set != null && isSubsetOf(candidate, set);
  });
}

export function toggleCard(
  selection: HandSelection,
  cardId: string,
  legalPlays: LegalPlay[],
): HandSelection {
  if (selection.includes(cardId)) return selection.filter((id) => id !== cardId);
  if (!canSelectCard(selection, cardId, legalPlays)) return selection;
  return [...selection, cardId];
}

export function canSubmit(selection: HandSelection, legalPlays: LegalPlay[]): boolean {
  if (selection.length === 0) return false;
  const sel = new Set(selection);
  return legalPlays.some((p) => {
    const set = playSet(p);
    return set != null && set.size === sel.size && isSubsetOf(sel, set);
  });
}

export function canSubmitPlain(selection: HandSelection, legalPlays: LegalPlay[]): boolean {
  if (selection.length === 0) return false;
  const sel = new Set(selection);
  return legalPlays.some((p) => {
    if (p.input.kind !== 'PLAY' || p.input.useSkill !== undefined) return false;
    const ids = p.input.cardIds;
    return ids.length === sel.size && ids.every((id) => sel.has(id));
  });
}

export function toPlayInput(selection: HandSelection, seatId: string): PlayInput {
  return { kind: 'PLAY', playerId: seatId, cardIds: [...selection] };
}

export function canPass(legalPlays: LegalPlay[]): boolean {
  return legalPlays.some((p) => p.input.kind === 'PASS');
}
