import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import type { SuitCode } from '@ragnarok-millennium/game-core';
import { radius, spacing } from '@ragnarok-millennium/ui';

import { CardFace } from '../features/cpu-game/CardFace';
import { ACCENT } from './buttonStyle';

export type FieldCard = { rank: number; suitCode: SuitCode; isJoker: boolean };

const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The cards currently on the field, with a "slam down" entrance + gold pulse
 * whenever the set changes (a fresh play landed — human or CPU).
 */
export function FieldCardRow({
  cards,
  lowMotion = false,
}: {
  cards: FieldCard[];
  lowMotion?: boolean;
}) {
  const still = lowMotion || prefersReducedMotion;
  const signature = cards.map((c) => `${c.rank}${c.suitCode}${c.isJoker ? 'J' : ''}`).join(',');

  const [enter] = useState(() => new Animated.Value(1));
  const [glow] = useState(() => new Animated.Value(0));
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (prev.current === signature) return;
    const first = prev.current === null;
    prev.current = signature;
    if (cards.length === 0) return;

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
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (!first) pulse(glow, 240);
  }, [signature, cards.length, still, enter, glow]);

  if (cards.length === 0) return null;

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-36, 0] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.glow, { opacity: glow, borderColor: ACCENT }]}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.row, { opacity: enter, transform: [{ translateY }, { scale }] }]}
      >
        {cards.map((card, index) => (
          <CardFace
            key={index}
            rank={card.rank}
            suitCode={card.suitCode}
            isJoker={card.isJoker}
            size="field"
          />
        ))}
      </Animated.View>
    </View>
  );
}

function pulse(value: Animated.Value, duration: number) {
  Animated.sequence([
    Animated.timing(value, {
      toValue: 1,
      duration: duration * 0.4,
      useNativeDriver: Platform.OS !== 'web',
    }),
    Animated.timing(value, {
      toValue: 0,
      duration: duration * 0.6,
      useNativeDriver: Platform.OS !== 'web',
    }),
  ]).start();
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.modal,
    borderWidth: 3,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    padding: spacing.xs,
  },
});
