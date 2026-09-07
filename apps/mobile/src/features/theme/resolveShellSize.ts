export type ShellSize = { width: number; height: number };

export type ShellOptions = {
  /** Below this window width the app fills the screen (mobile). Default 760. */
  minWidth?: number;
  /** Minimum gap between the frame and the window edge. Default 24. */
  margin?: number;
  /** Frame aspect ratio, width / height. Default 16 / 9. */
  aspect?: number;
};

/**
 * Size of the centred game frame for wide/web viewports, or null to fill.
 * Returns the largest `aspect`-ratio box that fits the window minus `margin`.
 */
export function resolveShellSize(
  win: { width: number; height: number },
  opts?: ShellOptions,
): ShellSize | null {
  const minWidth = opts?.minWidth ?? 760;
  const margin = opts?.margin ?? 24;
  const aspect = opts?.aspect ?? 16 / 9;

  if (win.width < minWidth) return null;

  const availWidth = Math.max(0, win.width - margin * 2);
  const availHeight = Math.max(0, win.height - margin * 2);

  // Width-limited if the available area is "taller" than the target aspect.
  if (availWidth / availHeight <= aspect) {
    return { width: Math.round(availWidth), height: Math.round(availWidth / aspect) };
  }
  return { width: Math.round(availHeight * aspect), height: Math.round(availHeight) };
}
