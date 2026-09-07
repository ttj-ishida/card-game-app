import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ACCENT } from '../../components';
import { resolveShellSize } from './resolveShellSize';

/** Deep "outside the duel" backdrop shown around the framed game on web. */
const SHELL_BACKDROP = '#07090D';

export type ShellSize = { width: number; height: number };

const ShellSizeContext = createContext<ShellSize>({ width: 0, height: 0 });

/** The current game surface size — the web frame, or the full window otherwise. */
export function useShellSize(): ShellSize {
  return useContext(ShellSizeContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const win = useWindowDimensions();
  const frame = Platform.OS === 'web' ? resolveShellSize(win) : null;
  const fw = frame?.width ?? win.width;
  const fh = frame?.height ?? win.height;
  const shellSize = useMemo<ShellSize>(() => ({ width: fw, height: fh }), [fw, fh]);

  const content = (
    <ShellSizeContext.Provider value={shellSize}>{children}</ShellSizeContext.Provider>
  );

  if (frame == null) {
    return <View style={styles.fill}>{content}</View>;
  }

  return (
    <View style={styles.backdrop}>
      <View
        style={[
          styles.frame,
          { width: frame.width, height: frame.height },
          { boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)' } as object,
        ]}
      >
        {content}
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
    borderColor: `${ACCENT}59`,
  },
});
