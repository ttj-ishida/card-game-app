import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../features/theme/ThemeProvider';
import { resolveButtonVisual, type ButtonVariant } from './buttonStyle';

export type { ButtonVariant };

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  minWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  selected = false,
  accessibilityLabel,
  minWidth,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const visual = resolveButtonVisual(colors, variant, { disabled, selected });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        visual.container,
        minWidth != null && { minWidth },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={visual.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
