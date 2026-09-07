import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@ragnarok-millennium/ui';

import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type PanelProps = {
  children: ReactNode;
  /** 'flat' drops the gold top-line (history / log panels). */
  tone?: 'default' | 'flat';
  style?: StyleProp<ViewStyle>;
};

export function Panel({ children, tone = 'default', style }: PanelProps) {
  const { colors } = useTheme();
  const face = colors.surface.card.face;
  const r = parseInt(face.slice(1, 3), 16);
  const g = parseInt(face.slice(3, 5), 16);
  const b = parseInt(face.slice(5, 7), 16);
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: `rgba(${r}, ${g}, ${b}, 0.86)`,
          borderColor: colors.state.disabled,
          borderTopColor: tone === 'flat' ? colors.state.disabled : ACCENT,
          borderTopWidth: tone === 'flat' ? 1 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.modal,
    padding: spacing.md,
  },
});
