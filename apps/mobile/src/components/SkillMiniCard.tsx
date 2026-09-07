import { StyleSheet, Text, View } from 'react-native';

import { radius, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { useThemedStyles } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type SkillMiniCardProps = {
  /** 使われたスキルの表示名（例: 革命 / 追加封印 / 変化Joker / 場流し）。 */
  label: string;
  /** 数字カードの mini と揃える場合は 'mini'、場の枠内なら 'field'。 */
  size?: 'mini' | 'field';
};

const BOX: Record<'mini' | 'field', { minWidth: number; glyph: number; text: number }> = {
  mini: { minWidth: 30, glyph: 11, text: 8 },
  field: { minWidth: 40, glyph: 13, text: 9 },
};

/**
 * 場（捨て場）に併記する「スキルカード」。数字カードと同じ大きさの札として、
 * どのプレイでどのスキルが使われたかを示す。パック非依存のプレースホルダ表示。
 */
export function SkillMiniCard({ label, size = 'mini' }: SkillMiniCardProps) {
  const styles = useThemedStyles(makeStyles);
  const dims = BOX[size];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.card, { minWidth: dims.minWidth }]}
    >
      <Text style={[styles.glyph, { fontSize: dims.glyph }]}>✦</Text>
      <Text style={[styles.label, { fontSize: dims.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: ACCENT,
      borderRadius: radius.control,
      paddingHorizontal: 4,
      paddingVertical: 2,
      backgroundColor: 'rgba(201, 169, 78, 0.14)',
    },
    glyph: { color: ACCENT, fontWeight: typography.weight.bold },
    label: { color: c.ink.primary, fontWeight: typography.weight.bold },
  });
