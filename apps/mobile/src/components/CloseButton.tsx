import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../features/theme/ThemeProvider';

export type CloseButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  /** Position it at the call site (e.g. absolute top-right). */
  style?: StyleProp<ViewStyle>;
};

const SIZE = 36;

/**
 * 丸い ✕ ボタン。「退出」などの離脱操作に、文字ラベルの代わりに置く。
 */
export function CloseButton({ onPress, accessibilityLabel, style }: CloseButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surface.card.face,
          borderColor: colors.suit.fire,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.glyph, { color: colors.suit.fire }]}>✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
});
