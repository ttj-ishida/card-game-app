import { StyleSheet, Text, View } from 'react-native';

import { translate } from '../../i18n/translate';

export default function CatalogScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{translate('catalog.title')}</Text>
      <Text style={styles.body}>{translate('catalog.placeholder')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    color: '#475569',
    fontSize: 16,
    marginTop: 12,
  },
});
