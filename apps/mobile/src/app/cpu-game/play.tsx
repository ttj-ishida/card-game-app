import { Text, View } from 'react-native';

import { translate } from '../../i18n/translate';

export default function CpuGamePlayScreen() {
  return (
    <View>
      <Text>{translate('app.title')}</Text>
    </View>
  );
}
