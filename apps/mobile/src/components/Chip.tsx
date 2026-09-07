import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing, typography } from '@ragnarok-millennium/ui';

import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type ChipProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function Chip({
  label,
  onPress,
  selected = false,
  disabled = false,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: colors.surface.card.face,
          borderColor: selected ? ACCENT : colors.state.disabled,
          borderWidth: selected ? 2 : 1,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={{
          color: selected ? colors.ink.primary : colors.ink.secondary,
          fontSize: typography.size.body,
          fontWeight: selected ? typography.weight.bold : typography.weight.regular,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 48,
    alignItems: 'center',
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
