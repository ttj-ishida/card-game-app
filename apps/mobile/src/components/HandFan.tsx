import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { SuitCode } from '@ragnarok-millennium/game-core';
import { radius } from '@ragnarok-millennium/ui';

import { CardFace } from '../features/cpu-game/CardFace';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';
import { fanLayout } from './fanLayout';

export type HandFanCard = {
  key: string;
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  selected: boolean;
  selectable: boolean;
  locked: boolean;
};

const CARD_WIDTH = 46;
const CARD_HEIGHT = 66;
const LIFT = 22;
const ARC = 18;

const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HandFan({
  cards,
  onPressCard,
  maxWidth,
  lowMotion = false,
}: {
  cards: HandFanCard[];
  onPressCard: (key: string) => void;
  maxWidth: number;
  lowMotion?: boolean;
}) {
  const still = lowMotion || prefersReducedMotion;
  const slots = fanLayout(cards.length, {
    cardWidth: CARD_WIDTH,
    maxWidth,
    maxSpread: 16,
    arc: ARC,
  });
  const center = maxWidth / 2;

  return (
    <View style={[styles.container, { width: maxWidth }]} accessibilityRole="list">
      {cards.map((card, i) => {
        const slot = slots[i] ?? { x: 0, y: 0, rotateDeg: 0, z: 0 };
        return (
          <FanCard
            key={card.key}
            card={card}
            left={center + slot.x - CARD_WIDTH / 2}
            baseY={slot.y}
            rotateDeg={slot.rotateDeg}
            zIndex={card.selected ? 999 : slot.z}
            still={still}
            onPress={() => onPressCard(card.key)}
          />
        );
      })}
    </View>
  );
}

function FanCard({
  card,
  left,
  baseY,
  rotateDeg,
  zIndex,
  still,
  onPress,
}: {
  card: HandFanCard;
  left: number;
  baseY: number;
  rotateDeg: number;
  zIndex: number;
  still: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [lift] = useState(() => new Animated.Value(card.selected ? 1 : 0));

  useEffect(() => {
    if (still) {
      lift.setValue(card.selected ? 1 : 0);
      return;
    }
    Animated.spring(lift, {
      toValue: card.selected ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
      speed: 18,
      bounciness: 6,
    }).start();
  }, [card.selected, still, lift]);

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [baseY, baseY - LIFT] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          left,
          zIndex,
          opacity: card.selectable || card.selected ? 1 : 0.4,
          transform: [{ translateY }, { rotate: `${rotateDeg}deg` }, { scale }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: card.selected, disabled: !card.selectable }}
        disabled={!card.selectable && !card.selected}
        onPress={onPress}
        style={[
          styles.hit,
          card.selected && { borderColor: colors.ink.primary },
          card.locked && { borderColor: ACCENT },
        ]}
      >
        <CardFace rank={card.rank} suitCode={card.suitCode} isJoker={card.isJoker} size="hand" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ARC + LIFT + CARD_HEIGHT + 8,
    alignSelf: 'center',
  },
  card: { position: 'absolute', top: LIFT, width: CARD_WIDTH },
  hit: { borderRadius: radius.control, borderWidth: 2, borderColor: 'transparent' },
});
