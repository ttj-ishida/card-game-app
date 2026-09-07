import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../features/theme/ThemeProvider';
import { translate } from '../i18n/translate';
import { ACCENT } from './buttonStyle';

export function MenuFab({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translate('nav.menuTitle')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.surface.card.back },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.glyph, { color: colors.ink.primary }]}>☰</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    zIndex: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  glyph: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
});
