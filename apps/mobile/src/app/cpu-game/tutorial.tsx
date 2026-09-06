import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from 'zustand/react';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import {
  CPU_GAME_TUTORIAL_PAGES,
  clampTutorialIndex,
  type TutorialPage,
} from '../../features/cpu-game/tutorialModel';
import { translate } from '../../i18n/translate';
import { cpuGameTutorialStore } from '../../state/cpuGameTutorialStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';

const TUTORIAL_IMAGES: Record<string, ImageSourcePropType> = {
  'm3-tutorial-history-stats': require('../../../../../assets/runtime/m3/tutorial/m3-tutorial-history-stats.svg'),
  'm3-tutorial-lead-update': require('../../../../../assets/runtime/m3/tutorial/m3-tutorial-lead-update.svg'),
  'm3-tutorial-locks': require('../../../../../assets/runtime/m3/tutorial/m3-tutorial-locks.svg'),
  'm3-tutorial-strength-order': require('../../../../../assets/runtime/m3/tutorial/m3-tutorial-strength-order.svg'),
  'm3-tutorial-skills': require('../../../../../assets/runtime/m3/tutorial/m3-tutorial-skills.svg'),
};

function pageImage(page: TutorialPage): ImageSourcePropType {
  return TUTORIAL_IMAGES[page.imageAssetId];
}

export default function CpuGameTutorialScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const tutorial = useStore(cpuGameTutorialStore, (s) => s);
  const page = CPU_GAME_TUTORIAL_PAGES[clampTutorialIndex(index)];
  const isFirst = index === 0;
  const isLast = index === CPU_GAME_TUTORIAL_PAGES.length - 1;

  const complete = async () => {
    await cpuGameTutorialStore.getState().complete();
    if (cpuGameTutorialStore.getState().status !== 'failed') {
      router.replace('/cpu-game/setup');
    }
  };

  return (
    <AppBackground variant="universal">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{translate('cpuGame.tutorial.title')}</Text>
            <Text style={styles.progress}>
              {index + 1} / {CPU_GAME_TUTORIAL_PAGES.length}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/cpu-game/setup')}
            style={styles.ghostButton}
          >
            <Text style={styles.ghostButtonText}>{translate('cpuGame.tutorial.skip')}</Text>
          </Pressable>
        </View>

        {tutorial.status === 'failed' ? (
          <Text style={styles.error}>{translate('cpuGame.tutorial.saveFailed')}</Text>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.imageShell}>
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={translate(`${page.titleKey}.imageLabel`)}
              resizeMode="contain"
              source={pageImage(page)}
              style={styles.image}
            />
          </View>
          <View style={styles.copyColumn}>
            <Text style={styles.pageTitle}>{translate(page.titleKey)}</Text>
            <Text style={styles.body}>{translate(page.bodyKey)}</Text>
          </View>
        </View>

        <View style={styles.navRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isFirst }}
            disabled={isFirst}
            onPress={() => setIndex((value) => clampTutorialIndex(value - 1))}
            style={[styles.secondaryButton, isFirst && styles.disabledButton]}
          >
            <Text style={styles.secondaryButtonText}>{translate('cpuGame.tutorial.previous')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={
              isLast
                ? () => void complete()
                : () => setIndex((value) => clampTutorialIndex(value + 1))
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {translate(isLast ? 'cpuGame.tutorial.complete' : 'cpuGame.tutorial.next')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { gap: spacing.md, padding: spacing.lg },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    title: {
      color: c.ink.primary,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold,
    },
    progress: {
      color: c.ink.secondary,
      fontSize: typography.size.caption,
      marginTop: spacing.xs,
    },
    panel: {
      flexDirection: 'row',
      gap: spacing.lg,
      borderWidth: 1,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      backgroundColor: c.surface.card.face,
      padding: spacing.md,
    },
    imageShell: {
      flex: 1.25,
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.control,
    },
    image: { width: '100%', height: 280 },
    copyColumn: { flex: 1, justifyContent: 'center', gap: spacing.md },
    pageTitle: {
      color: c.ink.primary,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold,
    },
    body: { color: c.ink.secondary, fontSize: typography.size.body, lineHeight: 24 },
    navRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
    primaryButton: {
      minWidth: 140,
      alignItems: 'center',
      backgroundColor: c.ink.primary,
      borderRadius: radius.control,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    primaryButtonText: {
      color: c.ink.inverse,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
    secondaryButton: {
      minWidth: 120,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.ink.primary,
      borderRadius: radius.control,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    secondaryButtonText: {
      color: c.ink.primary,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
    disabledButton: { borderColor: c.state.disabled, opacity: 0.45 },
    ghostButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    ghostButtonText: { color: c.ink.secondary, fontSize: typography.size.body },
    error: {
      color: c.suit.fire,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
  });
