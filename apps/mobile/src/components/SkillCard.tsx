import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { cardHeight } from '../features/cpu-game/cardMetrics';
import { useTheme, useThemedStyles } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type SkillActionKind = 'JOKER_CLEAR' | 'JOKER_TRANSFORM' | 'EXTENSION_SEAL' | 'REVOLUTION';

export const SKILL_CARD_WIDTH = 56;

const GLYPH: Record<SkillActionKind, string> = {
  JOKER_CLEAR: '↺',
  JOKER_TRANSFORM: '✧',
  EXTENSION_SEAL: '◈',
  REVOLUTION: '☀',
};
const REVOLUTION_NIGHT_GLYPH = '☾';

const useDriver = Platform.OS !== 'web';
const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type SkillCardProps = {
  kind: SkillActionKind;
  /** 短いラベル（例: 場流しJoker / 変化Joker / 追加封印 / 革命）。 */
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** REVOLUTIONのみ: 反転後が昼か夜かでグリフを出し分ける。 */
  dayNightAfter?: 'DAY' | 'NIGHT';
  lowMotion?: boolean;
};

/**
 * 保有スキルの1アクションを表す選択可能なカード。数字カードと同じ tap→lift の
 * 選択言語を踏襲しつつ、選択（アーム）した瞬間にスキル内容に応じた演出を1回
 * 再生する: 場流し=金の掃き払いスイープ／変化=控えめな明滅／追加封印=スタンプ
 * パンチ＋リング閃光／革命=昼夜グリフの縦軸フリップ。
 */
export function SkillCard({
  kind,
  label,
  selected,
  disabled = false,
  onPress,
  dayNightAfter,
  lowMotion = false,
}: SkillCardProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const still = lowMotion || prefersReducedMotion;

  const width = SKILL_CARD_WIDTH;
  const height = cardHeight(width);

  const [lift] = useState(() => new Animated.Value(selected ? 1 : 0));
  const [flourish] = useState(() => new Animated.Value(0));
  const [flip] = useState(() => new Animated.Value(0));
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (still) {
      lift.setValue(selected ? 1 : 0);
    } else {
      Animated.spring(lift, {
        toValue: selected ? 1 : 0,
        useNativeDriver: useDriver,
        speed: 18,
        bounciness: 6,
      }).start();
    }

    const risingEdge = selected && !wasSelected.current;
    wasSelected.current = selected;
    if (!risingEdge || still) return;

    if (kind === 'EXTENSION_SEAL') {
      flourish.setValue(0);
      Animated.sequence([
        Animated.timing(flourish, { toValue: 1, duration: 140, useNativeDriver: false }),
        Animated.timing(flourish, { toValue: 0, duration: 260, useNativeDriver: false }),
      ]).start();
    } else if (kind === 'JOKER_CLEAR') {
      flourish.setValue(0);
      Animated.timing(flourish, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useDriver,
      }).start();
    } else if (kind === 'REVOLUTION') {
      flip.setValue(0);
      Animated.timing(flip, {
        toValue: 1,
        duration: 360,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: useDriver,
      }).start();
    } else if (kind === 'JOKER_TRANSFORM') {
      flourish.setValue(0);
      Animated.sequence([
        Animated.timing(flourish, { toValue: 1, duration: 160, useNativeDriver: false }),
        Animated.timing(flourish, { toValue: 0, duration: 220, useNativeDriver: false }),
      ]).start();
    }
  }, [selected, still, kind, lift, flourish, flip]);

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const sweepX = flourish.interpolate({ inputRange: [0, 1], outputRange: [-width, width * 1.4] });
  const sweepOpacity = flourish.interpolate({
    inputRange: [0, 0.15, 0.6, 1],
    outputRange: [0, 0.85, 0.85, 0],
  });
  const ringOpacity = flourish;
  const punchScale = flourish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const glyphOpacity = flourish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  // 2D flip illusion (scaleX squeeze to ~0 at the midpoint, glyph swaps there)
  // instead of a real rotateY/perspective 3D transform: react-native-web does
  // not reliably support those on Animated.Text (logs an invalid DOM prop
  // warning for the auto-generated transform-origin), so this stays portable.
  const squeeze = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.05, 1] });
  const nightGlyphOpacity = flip.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });
  const dayGlyphOpacity = flip.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const glyph = GLYPH[kind];

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.outer,
          { width, height, borderColor: selected ? ACCENT : colors.state.disabled },
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.inner}>
          {kind === 'REVOLUTION' ? (
            <Animated.View style={[styles.glyphWrap, { transform: [{ scaleX: squeeze }] }]}>
              <Animated.Text
                style={[
                  styles.glyph,
                  { opacity: dayNightAfter === 'NIGHT' ? nightGlyphOpacity : dayGlyphOpacity },
                ]}
              >
                {dayNightAfter === 'NIGHT' ? glyph : REVOLUTION_NIGHT_GLYPH}
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.glyph,
                  styles.glyphOverlay,
                  { opacity: dayNightAfter === 'NIGHT' ? dayGlyphOpacity : nightGlyphOpacity },
                ]}
              >
                {dayNightAfter === 'NIGHT' ? REVOLUTION_NIGHT_GLYPH : glyph}
              </Animated.Text>
            </Animated.View>
          ) : (
            <Animated.Text
              style={[
                styles.glyph,
                {
                  opacity: kind === 'JOKER_TRANSFORM' ? glyphOpacity : 1,
                  transform: [{ scale: kind === 'EXTENSION_SEAL' ? punchScale : 1 }],
                },
              ]}
            >
              {glyph}
            </Animated.Text>
          )}
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>

          {kind === 'JOKER_CLEAR' ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sweep,
                { opacity: sweepOpacity, transform: [{ translateX: sweepX }, { rotate: '18deg' }] },
              ]}
            />
          ) : null}

          {kind === 'EXTENSION_SEAL' ? (
            <Animated.View pointerEvents="none" style={[styles.ring, { opacity: ringOpacity }]} />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Reveals `children` with a flip (2D scaleX squeeze, matching the REVOLUTION
 * glyph technique above — real rotateY/perspective isn't reliably supported
 * by react-native-web) whenever `revealKey` changes to a different value.
 * Shows `placeholder` while `revealKey` is null. Used for the 変化Joker
 * declaration preview, which should re-flip each time the declared rank or
 * suit changes.
 */
export function FlipReveal({
  revealKey,
  placeholder,
  children,
  lowMotion = false,
}: {
  revealKey: string | null;
  placeholder: ReactNode;
  children: ReactNode;
  lowMotion?: boolean;
}) {
  const still = lowMotion || prefersReducedMotion;
  const [flip] = useState(() => new Animated.Value(revealKey ? 1 : 0));
  const prevKey = useRef(revealKey);

  useEffect(() => {
    if (prevKey.current === revealKey) return;
    prevKey.current = revealKey;
    const toValue = revealKey ? 1 : 0;
    if (still) {
      flip.setValue(toValue);
      return;
    }
    flip.setValue(0);
    Animated.timing(flip, {
      toValue,
      duration: 360,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: useDriver,
    }).start();
  }, [revealKey, still, flip]);

  const squeeze = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.05, 1] });
  const frontOpacity = flip.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <Animated.View style={{ transform: [{ scaleX: squeeze }] }}>
      <View>
        <Animated.View style={{ opacity: frontOpacity }}>{placeholder}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backOpacity }]}>
          {children}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    outer: {
      borderWidth: 2,
      borderRadius: radius.control,
      overflow: 'hidden',
      backgroundColor: c.surface.card.face,
    },
    inner: {
      flex: 1,
      margin: 3,
      borderWidth: 1,
      borderColor: 'rgba(201, 169, 78, 0.45)',
      borderRadius: radius.control - 2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      overflow: 'hidden',
    },
    glyphWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
    glyph: { fontSize: 22, color: ACCENT, fontWeight: typography.weight.bold },
    glyphOverlay: { position: 'absolute' },
    label: {
      fontSize: 9,
      fontWeight: typography.weight.bold,
      color: c.ink.primary,
      paddingHorizontal: 2,
    },
    sweep: {
      position: 'absolute',
      top: -20,
      bottom: -20,
      width: 18,
      backgroundColor: ACCENT,
    },
    ring: {
      position: 'absolute',
      top: 2,
      left: 2,
      right: 2,
      bottom: 2,
      borderWidth: 3,
      borderColor: ACCENT,
      borderRadius: radius.control - 3,
    },
    disabled: { opacity: 0.4 },
  });
