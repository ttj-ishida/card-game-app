import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { useTheme, useThemedStyles } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';
import { Button } from './Button';

export type SkillPanelProps = {
  /** オーバーライン（例: 「保有スキル」）。 */
  heldLabel: string;
  /** 保有スキル名（例: 聖女Joker）。 */
  name: string;
  /** スキルの説明文。 */
  description: string;
  /** 選択可能な `SkillCard` 群。 */
  children?: ReactNode;
  /** スキルをアーム中かどうか。true の間だけ枠内にキャンセルボタンを出す。 */
  pending?: boolean;
  onCancelPending?: () => void;
  cancelLabel: string;
};

const CORNER = 7;

/**
 * 保有スキル領域の装飾フレーム。単なる罫線パネルではなく、二重罫線＋四隅の
 * 飾りをSVGで描き、その中に紋章バッジ・スキル名・説明・選択可能なカード群
 * （children）を収める。アーム中は枠内にキャンセルを出す（従来は画面右端の
 * 無関係な「選択解除」ボタンしか手段がなく分かりにくかった）。
 */
export function SkillPanel({
  heldLabel,
  name,
  description,
  children,
  pending = false,
  onCancelPending,
  cancelLabel,
}: SkillPanelProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <FrameDecoration borderColor={colors.state.disabled} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeGlyph}>✦</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.overline}>{heldLabel}</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
        </View>
        <Text style={styles.desc}>{description}</Text>
        <View style={styles.divider} />

        {children}

        {pending ? (
          <Button variant="danger" label={cancelLabel} onPress={() => onCancelPending?.()} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The border/corner geometry needs the panel's real pixel size (rotated
 * corner marks and the inset double border don't work as percentages), so
 * this measures itself via onLayout and renders nothing until it knows its
 * size — matching FieldTrail's explicit-pixel `<Svg width height>` pattern.
 */
function FrameDecoration({ borderColor }: { borderColor: string }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Rect
            x={2}
            y={2}
            width={size.width - 4}
            height={size.height - 4}
            rx={radius.modal}
            stroke={ACCENT}
            strokeWidth={2}
            fill="none"
          />
          <Rect
            x={6}
            y={6}
            width={size.width - 12}
            height={size.height - 12}
            rx={radius.modal - 4}
            stroke={borderColor}
            strokeWidth={1}
            fill="none"
          />
          {corners(size.width, size.height).map(({ x, y }) => (
            <Rect
              key={`${x}-${y}`}
              x={x - CORNER / 2}
              y={y - CORNER / 2}
              width={CORNER}
              height={CORNER}
              transform={`rotate(45, ${x}, ${y})`}
              fill={ACCENT}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function corners(width: number, height: number) {
  return [
    { x: 4, y: 4 },
    { x: width - 4, y: 4 },
    { x: 4, y: height - 4 },
    { x: width - 4, y: height - 4 },
  ];
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'relative' },
    content: { gap: spacing.xs, padding: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    badge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: ACCENT,
      backgroundColor: 'rgba(201, 169, 78, 0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeGlyph: { fontSize: 13, lineHeight: 15, color: ACCENT, fontWeight: typography.weight.bold },
    headerText: { flex: 1, gap: 1 },
    overline: { fontSize: 10, letterSpacing: 1, color: c.ink.secondary },
    name: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: ACCENT },
    desc: { fontSize: typography.size.caption, lineHeight: 16, color: c.ink.secondary },
    divider: { height: 1, backgroundColor: c.state.disabled, marginTop: 2 },
  });
