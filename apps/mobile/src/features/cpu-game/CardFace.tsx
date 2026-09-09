import { Image, StyleSheet, Text, View } from 'react-native';

import { radius, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import type { SuitCode } from '@ragnarok-millennium/game-core';

import { translate } from '../../i18n/translate';
import { ACCENT } from '../../components';
import { useTheme, useThemedStyles } from '../theme/ThemeProvider';
import { CARD_METRICS, cardHeight, SUIT_SYMBOL, type CardFaceSize } from './cardMetrics';
import { cardFaceLayers } from './cardFaceLayers';
import { resolveCardArt } from './cardArt';

export type { CardFaceSize } from './cardMetrics';

export type CardFaceProps = {
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  size: CardFaceSize;
};

function suitColor(c: ThemeColors, suitCode: SuitCode): string {
  switch (suitCode) {
    case 'SUIT_FIRE':
      return c.suit.fire;
    case 'SUIT_WATER':
      return c.suit.water;
    case 'SUIT_WIND':
      return c.suit.wind;
    case 'SUIT_EARTH':
      return c.suit.earth;
  }
}

/** Card-name line for the vector fallback at catalog size. */
function cardName(rank: number): string {
  return translate(`catalog.numberCard.name.${rank}`);
}

/**
 * Number-card face. Renders the baked full-art PNG when the app has it
 * (`resolveCardArt`), otherwise a themed vector card. Below a width threshold a
 * rank badge + suit emblem are drawn over the art for battle legibility. Pure
 * presentational component — no store access.
 */
export function CardFace({ rank, suitCode, isJoker, size }: CardFaceProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const width = CARD_METRICS[size].width;
  const height = cardHeight(width);
  const art = resolveCardArt(rank, suitCode);
  const layers = cardFaceLayers(size, art != null);
  const tint = suitColor(colors, suitCode);
  const suitLabel = translate(`sandbox.suit.${suitCode}`);
  const label = `${rank} ${suitLabel}${isJoker ? ` ${translate('sandbox.card.joker')}` : ''}`;

  const px = (frac: number) => Math.max(8, Math.round(width * frac));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.card, { width, height, borderColor: tint }]}
    >
      {layers.base === 'image' && art != null ? (
        <Image source={art} resizeMode="cover" style={{ width, height }} />
      ) : (
        <View style={styles.vector}>
          {layers.showName ? (
            <Text style={[styles.name, { color: tint }]} numberOfLines={1}>
              {suitLabel}／{cardName(rank)}
            </Text>
          ) : null}
          <Text style={[styles.vectorRank, { fontSize: px(0.5), color: colors.ink.primary }]}>
            {rank}
          </Text>
          <Text style={[styles.vectorSuit, { fontSize: px(0.16), color: colors.ink.secondary }]}>
            {SUIT_SYMBOL[suitCode]} {suitLabel}
          </Text>
        </View>
      )}

      {layers.overlay ? (
        <>
          <Text style={[styles.emblem, { fontSize: px(0.24), color: '#FFFFFF' }]}>
            {SUIT_SYMBOL[suitCode]}
          </Text>
          <View style={[styles.rankBadge, { backgroundColor: tint }]}>
            <Text style={[styles.rankBadgeText, { fontSize: px(0.3) }]}>{rank}</Text>
          </View>
        </>
      ) : null}

      {isJoker ? <Text style={[styles.joker, { fontSize: px(0.22) }]}>J</Text> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderWidth: 2,
      borderRadius: radius.control,
      overflow: 'hidden',
      backgroundColor: c.surface.card.face,
    },
    vector: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 2,
      gap: 2,
    },
    name: {
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
    },
    vectorRank: { fontWeight: typography.weight.bold },
    vectorSuit: {},
    emblem: {
      position: 'absolute',
      top: 2,
      left: 3,
      fontWeight: typography.weight.bold,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowRadius: 2,
    },
    rankBadge: {
      position: 'absolute',
      bottom: 2,
      left: 2,
      minWidth: 16,
      paddingHorizontal: 3,
      borderRadius: 4,
      alignItems: 'center',
    },
    rankBadgeText: { color: '#FFFFFF', fontWeight: typography.weight.bold },
    joker: {
      position: 'absolute',
      top: -2,
      right: -2,
      fontWeight: typography.weight.bold,
      color: '#1B1D24',
      backgroundColor: ACCENT,
      borderRadius: radius.control,
      paddingHorizontal: 3,
      overflow: 'hidden',
    },
  });
