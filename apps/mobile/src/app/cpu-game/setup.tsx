import { Text, View } from 'react-native';

import { translate } from '../../i18n/translate';

export default function CpuGameSetupScreen() {
  return (
    <View>
      <Text>{translate('cpuGame.setup.title')}</Text>
    </View>
  );
}
