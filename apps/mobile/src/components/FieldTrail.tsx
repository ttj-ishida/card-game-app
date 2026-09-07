import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SuitCode } from '@ragnarok-millennium/game-core';
import { radius, spacing, typography } from '@ragnarok-millennium/ui';

import { CardFace } from '../features/cpu-game/CardFace';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

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
 * row. The last step (最終出し手) sits where a lone field would and gets the
 * slam-down entrance + gold pulse.
 */
export function FieldTrail({
  steps,
  lowMotion = false,
}: {
  steps: FieldTrailStep[];
  lowMotion?: boolean;
}) {
  const { colors } = useTheme();
  const still = lowMotion || prefersReducedMotion;
  const scroller = useRef<ScrollView | null>(null);
  const latest = steps[steps.length - 1];
  const signature = latest
    ? `${latest.key}:${latest.cards.map((c) => `${c.rank}${c.suitCode}`).join(',')}`
    : '';

  const [enter] = useState(() => new Animated.Value(1));
  const [glow] = useState(() => new Animated.Value(0));
  const prev = useRef<string | null>(null);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: !still });
    if (prev.current === signature || !latest) {
      prev.current = signature;
      return;
    }
    const first = prev.current === null;
    prev.current = signature;
    if (still) {
      enter.setValue(1);
      if (!first) pulse(glow, 120);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useDriver,
    }).start();
    if (!first) pulse(glow, 240);
  }, [signature, still, enter, glow, latest]);

  if (steps.length === 0) return null;

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] });

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
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
                <Animated.View style={[styles.cards, { transform: [{ translateY }, { scale }] }]}>
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
    </ScrollView>
  );
}

function pulse(value: Animated.Value, duration: number) {
  Animated.sequence([
    Animated.timing(value, {
      toValue: 1,
      duration: duration * 0.4,
      useNativeDriver: useDriver,
    }),
    Animated.timing(value, {
      toValue: 0,
      duration: duration * 0.6,
      useNativeDriver: useDriver,
    }),
  ]).start();
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 34,
  },
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
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  past: { opacity: 0.7 },
});
