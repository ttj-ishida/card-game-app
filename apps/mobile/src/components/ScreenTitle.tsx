import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@ragnarok-millennium/ui';

import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type ScreenTitleProps = {
  title: string;
  subtitle?: string;
  /** Optional trailing element, e.g. a refresh button. */
  right?: ReactNode;
};

export function ScreenTitle({ title, subtitle, right }: ScreenTitleProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { borderLeftColor: ACCENT }]}>
        <Text
          style={{
            color: colors.ink.primary,
            fontSize: typography.size.title,
            fontWeight: typography.weight.bold,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: colors.ink.secondary,
              fontSize: typography.size.caption,
              marginTop: spacing.xs,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bar: { borderLeftWidth: 3, paddingLeft: spacing.sm, flexShrink: 1 },
});
