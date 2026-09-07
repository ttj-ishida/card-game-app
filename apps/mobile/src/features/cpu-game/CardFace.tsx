import { StyleSheet, Text, View } from 'react-native';

import { radius, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import type { SuitCode } from '@ragnarok-millennium/game-core';

import { translate } from '../../i18n/translate';
import { useTheme, useThemedStyles } from '../theme/ThemeProvider';
import { ACCENT } from '../../components';

export type CardFaceSize = 'hand' | 'field' | 'mini';

export type CardFaceProps = {
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  size: CardFaceSize;
};

function suitColor(c: ThemeColors, suitCode: SuitCode): string {
  switch (suitCode) {
    case 'SUIT_FIRE':
      return c.suit.fire;
    case 'SUIT_WATER':
      return c.suit.water;
    case 'SUIT_WIND':
      return c.suit.wind;
    case 'SUIT_EARTH':
      return c.suit.earth;
  }
}

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
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const dims = SIZE[size];
  const suitLabel = translate(`sandbox.suit.${suitCode}`);
  const label = `${rank} ${suitLabel}${isJoker ? ` ${translate('sandbox.card.joker')}` : ''}`;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.card, { minWidth: dims.box, borderColor: suitColor(colors, suitCode) }]}
    >
      {isJoker ? <Text style={[styles.badge, { fontSize: dims.badge }]}>J</Text> : null}
      <Text style={[styles.rank, { fontSize: dims.rank }]}>{rank}</Text>
      <Text style={[styles.suit, { fontSize: dims.suit }]}>
        {SUIT_SYMBOL[suitCode]} {suitLabel}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      borderWidth: 2,
      borderRadius: radius.control,
      paddingHorizontal: 4,
      paddingVertical: 2,
      backgroundColor: c.surface.card.face,
    },
    rank: {
      fontWeight: typography.weight.bold,
      color: c.ink.primary,
    },
    suit: {
      color: c.ink.secondary,
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      fontWeight: typography.weight.bold,
      color: '#1B1D24',
      backgroundColor: ACCENT,
      borderRadius: radius.control,
      paddingHorizontal: 3,
      overflow: 'hidden',
    },
  });
