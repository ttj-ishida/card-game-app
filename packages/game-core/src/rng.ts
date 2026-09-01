export type Rng = {
  /** 一様乱数 [0, 2^32) */
  nextUint32(): number;
  /** 一様整数 [0, bound)。bound は正の整数 */
  nextInt(bound: number): number;
  /** 一様小数 [0, 1) */
  nextFloat(): number;
  /** 独立したストリームを返す。呼び出すと自分自身は1歩進む */
  fork(): Rng;
};

/**
 * mulberry32。32bit・依存なし・決定的。
 * seed は Math.trunc して uint32 に丸める。
 */
export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`createRng: seed must be finite, got ${seed}`);
  }
  let state = Math.trunc(seed) >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  const nextFloat = (): number => nextUint32() / 2 ** 32;

  const nextInt = (bound: number): number => {
    if (!Number.isInteger(bound) || bound <= 0 || bound > 2 ** 32) {
      throw new RangeError(`nextInt: bound must be a positive integer <= 2^32, got ${bound}`);
    }
    // rejection sampling で剰余バイアスを避ける
    const limit = 2 ** 32 - (2 ** 32 % bound);
    let value = nextUint32();
    while (value >= limit) value = nextUint32();
    return value % bound;
  };

  const fork = (): Rng => createRng(nextUint32());

  return { nextUint32, nextInt, nextFloat, fork };
}

/** 入力を変更せず、新しい配列に Fisher–Yates シャッフルした結果を返す。 */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
