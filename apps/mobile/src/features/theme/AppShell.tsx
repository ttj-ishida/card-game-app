import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ACCENT } from '../../components';
import { resolveShellSize } from './resolveShellSize';

/** Deep "outside the duel" backdrop shown around the framed game on web. */
const SHELL_BACKDROP = '#07090D';

export function AppShell({ children }: { children: ReactNode }) {
  const win = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <View style={styles.fill}>{children}</View>;
  }

  const size = resolveShellSize(win);
  if (size == null) {
    return <View style={styles.fill}>{children}</View>;
  }

  return (
    <View style={styles.backdrop}>
      <View
        style={[
          styles.frame,
          { width: size.width, height: size.height },
          // RN Web accepts a CSS box-shadow string.
          { boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)' } as object,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SHELL_BACKDROP,
  },
  frame: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${ACCENT}59`, // ~35% alpha
  },
});
