import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import type { SuitCode } from '@ragnarok-millennium/game-core';
import { radius, spacing, typography } from '@ragnarok-millennium/ui';

import { CardFace } from '../features/cpu-game/CardFace';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';
import { centerLatestOffset } from './fieldTrailLayout';

export type FieldTrailStep = {
  key: string;
  cards: { rank: number; suitCode: SuitCode; isJoker: boolean }[];
  /** e.g. "リード" / "2番目" / "最終出し手" */
  label: string;
  seatLabel?: string;
};

const useDriver = Platform.OS !== 'web';
const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The plays that built the current field, oldest to newest, in one horizontal
 * row. The last step (最終出し手) is kept centred; when a new play lands the row
 * slides left and the new step drops in with a gold pulse.
 */
export function FieldTrail({
  steps,
  maxWidth,
  lowMotion = false,
}: {
  steps: FieldTrailStep[];
  maxWidth: number;
  lowMotion?: boolean;
}) {
  const { colors } = useTheme();
  const still = lowMotion || prefersReducedMotion;
  const latest = steps[steps.length - 1];
  const signature = latest
    ? `${latest.key}:${latest.cards.map((c) => `${c.rank}${c.suitCode}`).join(',')}`
    : '';
  const offset = centerLatestOffset(
    steps.map((s) => s.cards.length),
    maxWidth,
  );

  const [enter] = useState(() => new Animated.Value(1));
  const [glow] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(1));
  const [range, setRange] = useState<[number, number]>([offset, offset]);
  const prev = useRef<string | null>(null);
  const prevOffset = useRef(offset);

  useEffect(() => {
    if (prev.current === signature || !latest) {
      prev.current = signature;
      prevOffset.current = offset;
      return;
    }
    const first = prev.current === null;
    prev.current = signature;

    setRange([prevOffset.current, offset]);
    prevOffset.current = offset;

    if (still) {
      slide.setValue(1);
      enter.setValue(1);
      if (!first) pulse(glow, 120);
      return;
    }
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useDriver,
    }).start();
    if (!first) pulse(glow, 240);
  }, [signature, offset, still, enter, glow, slide, latest]);

  if (steps.length === 0) return null;

  const rowTranslateX = slide.interpolate({ inputRange: [0, 1], outputRange: range });
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] });

  return (
    <View style={[styles.clip, { width: maxWidth }]}>
      <Animated.View style={[styles.row, { transform: [{ translateX: rowTranslateX }] }]}>
        {steps.map((step, i) => {
          const isLatest = i === steps.length - 1;
          return (
            <View key={step.key} style={styles.step}>
              <Text
                style={[
                  styles.label,
                  { color: isLatest ? colors.ink.primary : colors.ink.secondary },
                ]}
              >
                {step.label}
              </Text>
              {step.seatLabel ? (
                <Text style={[styles.seat, { color: colors.ink.secondary }]}>{step.seatLabel}</Text>
              ) : null}
              {isLatest ? (
                <View style={styles.latestWrap}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.glow, { opacity: glow, borderColor: ACCENT }]}
                  />
                  <Animated.View
                    style={[
                      styles.cards,
                      { transform: [{ translateY: enterY }, { scale: enterScale }] },
                    ]}
                  >
                    {step.cards.map((card, ci) => (
                      <CardFace
                        key={ci}
                        rank={card.rank}
                        suitCode={card.suitCode}
                        isJoker={card.isJoker}
                        size="field"
                      />
                    ))}
                  </Animated.View>
                </View>
              ) : (
                <View style={[styles.cards, styles.past]}>
                  {step.cards.map((card, ci) => (
                    <CardFace
                      key={ci}
                      rank={card.rank}
                      suitCode={card.suitCode}
                      isJoker={card.isJoker}
                      size="mini"
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

function pulse(value: Animated.Value, duration: number) {
  Animated.sequence([
    Animated.timing(value, { toValue: 1, duration: duration * 0.4, useNativeDriver: useDriver }),
    Animated.timing(value, { toValue: 0, duration: duration * 0.6, useNativeDriver: useDriver }),
  ]).start();
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', alignSelf: 'center', paddingTop: 40, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  step: { alignItems: 'center', gap: 2 },
  label: { fontSize: typography.size.caption, fontWeight: typography.weight.bold },
  seat: { fontSize: typography.size.caption },
  latestWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: -4,
    bottom: -4,
    borderRadius: radius.modal,
    borderWidth: 3,
  },
  cards: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs, justifyContent: 'center' },
  past: { opacity: 0.7 },
});
