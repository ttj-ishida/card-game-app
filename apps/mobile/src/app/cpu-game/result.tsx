import { Text, View } from 'react-native';

import { translate } from '../../i18n/translate';

export default function CpuGameResultScreen() {
  return (
    <View>
      <Text>{translate('cpuGame.result.title')}</Text>
    </View>
  );
}
