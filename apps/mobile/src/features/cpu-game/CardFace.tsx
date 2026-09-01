import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, typography } from '@card-game-app/ui';

import type { SuitCode } from '@card-game-app/game-core';

import { translate } from '../../i18n/translate';

export type CardFaceSize = 'hand' | 'field' | 'mini';

export type CardFaceProps = {
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  size: CardFaceSize;
};

const SUIT_COLOR: Record<SuitCode, string> = {
  SUIT_FIRE: colors.suit.fire,
  SUIT_WATER: colors.suit.water,
  SUIT_WIND: colors.suit.wind,
  SUIT_EARTH: colors.suit.earth,
};

// UI-A11Y-002: identify suits by shape/symbol, not colour alone.
const SUIT_SYMBOL: Record<SuitCode, string> = {
  SUIT_FIRE: '▲',
  SUIT_WATER: '●',
  SUIT_WIND: '✦',
  SUIT_EARTH: '■',
};

const SIZE: Record<CardFaceSize, { box: number; rank: number; suit: number; badge: number }> = {
  hand: { box: 46, rank: 22, suit: 11, badge: 10 },
  field: { box: 40, rank: 19, suit: 10, badge: 9 },
  mini: { box: 30, rank: 14, suit: 9, badge: 8 },
};

/**
 * パック非依存のカード表示。M2 は「デフォルトパック」＝数字大＋属性色ボーダー＋
 * 日本語ラベル＋属性記号＋変化Joker「J」バッジ のプレースホルダ。
 * 純表示コンポーネント（ロジック・ストア参照なし）。将来のデザインカード／複数パックは
 * `packId + rank + suitCode` でアセットを引く描画レイヤの仕事（§6・§10）。
 */
export function CardFace({ rank, suitCode, isJoker, size }: CardFaceProps) {
  const dims = SIZE[size];
  const suitLabel = translate(`sandbox.suit.${suitCode}`);
  const label = `${rank} ${suitLabel}${isJoker ? ` ${translate('sandbox.card.joker')}` : ''}`;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.card, { minWidth: dims.box, borderColor: SUIT_COLOR[suitCode] }]}
    >
      {isJoker ? <Text style={[styles.badge, { fontSize: dims.badge }]}>J</Text> : null}
      <Text style={[styles.rank, { fontSize: dims.rank }]}>{rank}</Text>
      <Text style={[styles.suit, { fontSize: dims.suit }]}>
        {SUIT_SYMBOL[suitCode]} {suitLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.control,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: colors.surface.card.face,
  },
  rank: {
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  suit: {
    color: colors.ink.secondary,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    fontWeight: typography.weight.bold,
    color: colors.ink.inverse,
    backgroundColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
});
