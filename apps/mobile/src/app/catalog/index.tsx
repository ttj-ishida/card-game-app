import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '@ragnarok-millennium/ui';

import { buildCatalogItems, type CatalogItem } from '../../features/catalog/cardCatalog';
import { fetchCatalogMasters } from '../../features/catalog/supabaseCatalogClient';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Button, ScreenTitle } from '../../components';
import { translate } from '../../i18n/translate';

export default function CatalogScreen() {
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>();

  function applyCatalogResult(nextItems: CatalogItem[]) {
    setItems(nextItems);
    setStatus(nextItems.length === 0 ? 'empty' : 'ready');
    setErrorMessage(undefined);
  }

  function applyCatalogError(error: unknown) {
    setStatus('error');
    setErrorMessage(error instanceof Error ? error.message : translate('catalog.error.unknown'));
  }

  async function loadCatalog() {
    try {
      setStatus('loading');
      const masters = await fetchCatalogMasters();
      applyCatalogResult(buildCatalogItems(masters.numberCards, masters.skillCards));
    } catch (error) {
      applyCatalogError(error);
    }
  }

  useEffect(() => {
    let isActive = true;

    fetchCatalogMasters()
      .then((masters) => {
        if (isActive)
          applyCatalogResult(buildCatalogItems(masters.numberCards, masters.skillCards));
      })
      .catch((error: unknown) => {
        if (isActive) applyCatalogError(error);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  return (
    <AppBackground variant="universal">
      <View style={styles.screen}>
        <ScreenTitle
          title={translate('catalog.title')}
          subtitle={`${translate('catalog.countPrefix')} ${items.length}/42`}
          right={
            <Button variant="secondary" label={translate('catalog.retry')} onPress={loadCatalog} />
          }
        />

        {status === 'loading' ? (
          <Text style={styles.message}>{translate('catalog.loading')}</Text>
        ) : null}
        {status === 'error' ? (
          <Text style={styles.error}>
            {translate('catalog.error.network')} {errorMessage}
          </Text>
        ) : null}
        {status === 'empty' ? (
          <Text style={styles.message}>{translate('catalog.empty')}</Text>
        ) : null}

        <FlatList
          contentContainerStyle={styles.grid}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={6}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedItemId(item.id)}
              style={styles.card}
            >
              <Text style={styles.cardKind}>{item.kind.toUpperCase()}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              <Text numberOfLines={1} style={styles.assetId}>
                {item.assetId}
              </Text>
            </Pressable>
          )}
        />

        <Modal
          animationType="fade"
          transparent
          visible={Boolean(selectedItem)}
          onRequestClose={() => setSelectedItemId(undefined)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedItemId(undefined)}>
            {selectedItem ? (
              <View style={styles.detailCard}>
                <Text style={styles.cardKind}>{selectedItem.kind.toUpperCase()}</Text>
                <Text style={styles.detailTitle}>{selectedItem.title}</Text>
                <Text style={styles.detailSubtitle}>{selectedItem.subtitle}</Text>
                <Text style={styles.detailPath}>{selectedItem.runtimePath}</Text>
              </View>
            ) : null}
          </Pressable>
        </Modal>
      </View>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      padding: 20,
      gap: 14,
    },
    message: {
      color: c.ink.secondary,
      fontSize: 16,
      marginBottom: 12,
    },
    error: {
      color: c.suit.fire,
      fontSize: 14,
      marginBottom: 12,
    },
    grid: {
      gap: 10,
      paddingBottom: 24,
    },
    card: {
      aspectRatio: 5 / 7,
      backgroundColor: c.surface.card.face,
      borderColor: c.ink.primary,
      borderRadius: 8,
      borderWidth: 2,
      justifyContent: 'center',
      margin: 5,
      maxWidth: 126,
      minWidth: 96,
      padding: 8,
      width: '15%',
    },
    cardKind: {
      color: c.state.disabled,
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
    },
    cardTitle: {
      color: c.ink.primary,
      fontSize: 24,
      fontWeight: '700',
      marginTop: 8,
      textAlign: 'center',
    },
    cardSubtitle: {
      color: c.ink.secondary,
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },
    assetId: {
      color: c.state.disabled,
      fontSize: 9,
      marginTop: 10,
      textAlign: 'center',
    },
    modalBackdrop: {
      alignItems: 'center',
      backgroundColor: 'rgba(23, 32, 42, 0.7)',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    detailCard: {
      aspectRatio: 5 / 7,
      backgroundColor: c.surface.card.face,
      borderColor: c.ink.inverse,
      borderRadius: 12,
      borderWidth: 3,
      justifyContent: 'center',
      padding: 18,
      width: 260,
    },
    detailTitle: {
      color: c.ink.primary,
      fontSize: 36,
      fontWeight: '700',
      marginTop: 18,
      textAlign: 'center',
    },
    detailSubtitle: {
      color: c.ink.secondary,
      fontSize: 18,
      marginTop: 8,
      textAlign: 'center',
    },
    detailPath: {
      color: c.state.disabled,
      fontSize: 11,
      marginTop: 22,
      textAlign: 'center',
    },
  });
